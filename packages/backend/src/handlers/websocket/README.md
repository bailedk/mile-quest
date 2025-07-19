# WebSocket Authentication Handler

This handler provides authentication and authorization for real-time WebSocket connections using Pusher channels.

## Overview

The WebSocket authentication system validates JWT tokens and authorizes access to specific channels based on user permissions and team memberships. It follows the external service abstraction pattern established in the Mile Quest architecture.

## Endpoints

### POST /api/v1/websocket/auth

Authenticates WebSocket connections for Pusher channels.

**Request Body:**
```json
{
  "socket_id": "string",      // Required: Pusher socket ID
  "channel_name": "string",   // Required: Channel to subscribe to
  "team_id": "string",        // Optional: Team ID for team channels
  "user_data": {              // Optional: Additional user data for presence channels
    "status": "online",
    "location": "dashboard"
  }
}
```

**Headers:**
```
Authorization: Bearer <jwt_token>  // Required for private/presence channels
Content-Type: application/json
```

**Response (Success):**
```json
{
  "status": "ok",
  "auth": "app-key:signature",           // Pusher auth signature
  "channel_data": "{...}"                // Present for presence channels
}
```

**Response (Error):**
```json
{
  "status": "forbidden",
  "error": "Access denied to channel"
}
```

### GET /api/v1/websocket/token

Generates a temporary authentication token for WebSocket connections.

**Headers:**
```
Authorization: Bearer <jwt_token>  // Required
```

**Response:**
```json
{
  "token": "temporary_jwt_token",
  "expiresIn": 300,                // 5 minutes
  "userId": "user-id"
}
```

## Channel Types and Authorization

### Public Channels
- **Pattern:** `public-*`
- **Authorization:** None required
- **Use case:** Global announcements, system status

```javascript
// Example: Global system announcements
channel_name: "public-global"
```

### User Private Channels
- **Pattern:** `private-user-{userId}`
- **Authorization:** User can only access their own channel
- **Use case:** Personal notifications, private messages

```javascript
// Example: User-specific notifications
channel_name: "private-user-123"
// Only user with ID "123" can access this channel
```

### Team Private Channels
- **Pattern:** `private-team-{teamId}`
- **Authorization:** User must be an active member of the team
- **Use case:** Team-specific updates, private team communications

```javascript
// Example: Team planning channel
channel_name: "private-team-456"
team_id: "456"  // Must match the team ID in channel name
```

### Team Presence Channels
- **Pattern:** `presence-team-{teamId}`
- **Authorization:** User must be an active member of the team
- **Use case:** Show who's online, real-time collaboration

```javascript
// Example: Team presence for dashboard
channel_name: "presence-team-789"
team_id: "789"
user_data: {
  "status": "active",
  "current_page": "dashboard"
}
```

### Admin Channels
- **Pattern:** `private-admin-*`
- **Authorization:** User must have admin role in any team
- **Use case:** Administrative notifications, system management

```javascript
// Example: System administration channel
channel_name: "private-admin-system"
```

## Security Features

### JWT Token Validation
- Validates access tokens using the same secret as the main auth system
- Supports both standard JWT tokens and temporary WebSocket tokens
- Automatic token expiration handling

### Channel-Specific Authorization
- User identity verification for user channels
- Team membership validation for team channels
- Role-based access for admin channels

### HMAC Signature Generation
- Generates Pusher-compatible HMAC SHA-256 signatures
- Uses secure secrets from environment variables
- Fallback to JWT secret if Pusher secret not configured

### Error Handling
- Generic error messages to prevent information leakage
- Comprehensive logging for debugging (excludes sensitive data)
- Graceful handling of database errors

## Implementation Details

### Team Membership Validation
```typescript
// Checks active membership in non-deleted teams
const membership = await prisma.teamMember.findFirst({
  where: {
    userId,
    teamId,
    leftAt: null,        // Active membership
    team: {
      deletedAt: null    // Team not deleted
    }
  }
});
```

### Presence Channel Data
```typescript
// User information included in presence channels
const channelData = {
  user_id: userId,
  user_info: {
    name: user.name,
    email: user.email,
    ...additionalUserData
  }
};
```

### Temporary Token Generation
```typescript
// 5-minute temporary tokens for WebSocket auth
const tempToken = jwt.sign(
  {
    sub: user.id,
    email: user.email,
    name: user.name,
    temp: true  // Marks as temporary
  },
  secret,
  { expiresIn: '5m' }
);
```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PUSHER_SECRET` | Pusher application secret | No | Falls back to `JWT_SECRET` |
| `PUSHER_KEY` | Pusher application key | No | `"app-key"` |
| `JWT_SECRET` | JWT signing secret | Yes | - |

## Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `INVALID_REQUEST` | Missing required parameters |
| 401 | `TOKEN_REQUIRED` | Authentication token required |
| 403 | `INVALID_TOKEN` | Invalid or expired token |
| 403 | `NOT_TEAM_MEMBER` | User not a member of the team |
| 403 | `INSUFFICIENT_PERMISSIONS` | User lacks required permissions |
| 500 | `AUTH_ERROR` | Internal authentication error |

## Usage Examples

### Frontend WebSocket Connection
```typescript
// 1. Get temporary token
const response = await fetch('/api/v1/websocket/token', {
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
});
const { token } = await response.json();

// 2. Configure Pusher with auth endpoint
const pusher = new Pusher(PUSHER_KEY, {
  cluster: 'us2',
  authEndpoint: '/api/v1/websocket/auth',
  auth: {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
});

// 3. Subscribe to channels
const userChannel = pusher.subscribe(`private-user-${userId}`);
const teamChannel = pusher.subscribe(`presence-team-${teamId}`);
```

### Team Activity Updates
```typescript
// Subscribe to team progress updates
const teamChannel = pusher.subscribe(`private-team-${teamId}`);
teamChannel.bind('activity-created', (data) => {
  updateTeamProgress(data.teamProgress);
  showNotification(`${data.user.name} logged a new activity!`);
});
```

### Presence Channel for Online Users
```typescript
// Show team members who are currently online
const presenceChannel = pusher.subscribe(`presence-team-${teamId}`);

presenceChannel.bind('pusher:subscription_succeeded', (members) => {
  displayOnlineMembers(members.members);
});

presenceChannel.bind('pusher:member_added', (member) => {
  addOnlineMember(member.info);
});

presenceChannel.bind('pusher:member_removed', (member) => {
  removeOnlineMember(member.info);
});
```

## Testing

### Unit Tests
```bash
npm test -- --testPathPattern=websocket
```

### Integration Tests
```bash
npm run test:websocket
```

### Manual Testing
```bash
# Test with curl
curl -X POST http://localhost:3001/api/v1/websocket/auth \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "socket_id": "test-socket-123",
    "channel_name": "private-user-your-user-id"
  }'
```

## Performance Considerations

### Caching
- Team membership checks are cached in memory for the request duration
- User information is fetched once per authentication request
- Database queries are optimized with proper indexes

### Rate Limiting
- Inherits rate limiting from API Gateway configuration
- Consider implementing additional rate limiting for high-frequency auth requests

### Monitoring
- All authentication attempts are logged with appropriate levels
- Failed authentication attempts are tracked for security monitoring
- Performance metrics available through CloudWatch

## Security Best Practices

### Token Handling
- Short-lived temporary tokens (5 minutes)
- Secure secret management through environment variables
- No token information logged in production

### Channel Access Control
- Strict channel pattern matching
- Team membership verified against active, non-deleted teams
- User identity validation for personal channels

### Error Information
- Generic error messages to prevent enumeration attacks
- Detailed logging for debugging (server-side only)
- No sensitive information in client responses

## Future Enhancements

### Planned Improvements
1. **Dynamic Channel Permissions** - More granular role-based access
2. **Channel Rate Limiting** - Per-channel and per-user rate limits
3. **Enhanced Presence Data** - Rich user status and activity information
4. **Webhook Validation** - Pusher webhook signature verification
5. **Multi-Team Channels** - Cross-team collaboration channels

### Integration Points
- **Real-time Activity Updates** - Sprint 5 implementation
- **Live Leaderboards** - Real-time ranking updates
- **Team Progress Tracking** - Live goal progress visualization
- **Push Notifications** - Integration with PWA notification system