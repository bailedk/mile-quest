# Pusher Connection Manager

Enhanced Pusher connection manager with advanced features for real-time communication in the Mile Quest application.

## Features

- **Connection Management**: Pool connections with automatic cleanup and health monitoring
- **Authentication & Authorization**: JWT-based authentication with channel-specific permissions
- **Rate Limiting**: Per-user rate limiting for messages and subscriptions with burst protection
- **Monitoring**: Comprehensive metrics collection and health status reporting
- **Error Handling**: Robust error handling with detailed error codes and logging
- **Auto-reconnection**: Automatic reconnection with exponential backoff

## Core Components

### PusherConnectionManager
Main connection manager that orchestrates all Pusher operations.

```typescript
import { PusherConnectionManager } from './connection-manager';

const manager = new PusherConnectionManager(
  // Connection config
  {
    maxConnections: 5000,
    connectionTimeout: 30000,
    enableHealthMonitoring: true
  },
  // Rate limit config
  {
    messagesPerSecond: 10,
    subscriptionsPerConnection: 100,
    burstLimit: 50
  }
);
```

### PusherRateLimiter
Token bucket-based rate limiting for messages and subscriptions.

```typescript
import { PusherRateLimiter } from './rate-limiter';

const rateLimiter = new PusherRateLimiter({
  messagesPerSecond: 10,
  messagesPerMinute: 600,
  subscriptionsPerConnection: 100,
  burstLimit: 50,
  windowSize: 60
});

const result = rateLimiter.checkMessageLimit('user-123');
if (result.allowed) {
  // Send message
} else {
  // Rate limited - retry after result.retryAfter ms
}
```

### PusherMonitoring
Real-time monitoring and metrics collection.

```typescript
import { PusherMonitoring } from './monitoring';

const monitoring = new PusherMonitoring();

// Get health status
const health = monitoring.getHealthStatus();
console.log('Status:', health.status); // 'healthy' | 'degraded' | 'unhealthy'

// Get connection metrics
const metrics = monitoring.getConnectionMetrics();
console.log('Active connections:', metrics.activeConnections);
console.log('Messages per second:', metrics.messagesPerSecond);
```

### PusherAuthHandler
JWT-based authentication and channel authorization.

```typescript
import { PusherAuthHandler } from './auth-handler';

const authHandler = new PusherAuthHandler();

const authResult = await authHandler.authenticateChannel({
  socketId: 'socket-123',
  channel: 'private-team-456',
  userId: 'user-789',
  teamId: 'team-456',
  token: 'jwt-token'
});

if (authResult.success) {
  // Channel authenticated
  console.log('Auth string:', authResult.auth);
  console.log('Permissions:', authResult.permissions);
}
```

## Channel Types and Authentication

### Public Channels
No authentication required. Anyone can subscribe.

```typescript
await manager.subscribeToChannel(connectionId, 'public-announcements');
```

### Private Channels
Require JWT authentication. Channel-specific authorization rules apply.

```typescript
await manager.subscribeToChannel(connectionId, 'private-user-123', {
  socketId: 'socket-123',
  channel: 'private-user-123',
  userId: 'user-123',
  token: 'valid-jwt-token'
});
```

### Presence Channels
Like private channels but with presence information (who's online).

```typescript
await manager.subscribeToChannel(connectionId, 'presence-team-456', {
  socketId: 'socket-123',
  channel: 'presence-team-456',
  userId: 'user-123',
  teamId: 'team-456',
  token: 'valid-jwt-token',
  userData: {
    name: 'John Doe',
    avatar: 'avatar-url'
  }
});
```

## Authorization Rules

The auth handler supports flexible authorization rules:

```typescript
// Team membership required
authHandler.addAuthorizationRule('private-team-*', {
  pattern: 'private-team-*',
  requiredTeamMembership: true
});

// Admin role required
authHandler.addAuthorizationRule('private-admin-*', {
  pattern: 'private-admin-*',
  requiredRoles: ['admin']
});

// Custom validation
authHandler.addAuthorizationRule('custom-*', {
  pattern: 'custom-*',
  customValidator: async (request) => {
    // Custom logic here
    return true;
  }
});
```

## Event Broadcasting

### Single Event
```typescript
const event: PusherEvent = {
  eventId: 'activity-123',
  channel: 'private-team-456',
  event: 'activity-created',
  data: {
    userId: 'user-123',
    distance: 5.2,
    timestamp: new Date()
  },
  userId: 'user-123',
  timestamp: new Date()
};

const result = await manager.sendEvent(event);
console.log('Delivered to:', result.deliveredTo, 'connections');
```

### Batch Events
```typescript
const events = [
  { eventId: '1', channel: 'team-1', event: 'update', data: {...} },
  { eventId: '2', channel: 'team-2', event: 'update', data: {...} }
];

const results = await manager.sendEventBatch(events);
```

## Rate Limiting

### Message Rate Limits
- **Per Second**: Configurable messages per second per user
- **Burst Protection**: Allow temporary bursts up to a limit
- **Token Bucket**: Smooth rate limiting with token refill

### Subscription Rate Limits
- **Per Connection**: Maximum subscriptions per connection
- **Per User**: Aggregate limits across all user connections

### Rate Limit Responses
```typescript
const rateLimitResult = rateLimiter.checkMessageLimit('user-123');
if (!rateLimitResult.allowed) {
  console.log('Rate limited. Retry after:', rateLimitResult.retryAfter, 'ms');
  console.log('Limit resets at:', rateLimitResult.resetTime);
}
```

## Health Monitoring

### Health Status
The system provides three health levels:
- **Healthy**: Normal operation
- **Degraded**: Some issues but still functional
- **Unhealthy**: Significant problems requiring attention

### Metrics Available
- **Connection Metrics**: Total/active connections, channels
- **Performance Metrics**: Latency, throughput, resource usage
- **Error Metrics**: Error rates by type, total errors

```typescript
const health = manager.getHealthStatus();

if (health.status === 'unhealthy') {
  console.error('System unhealthy:', {
    errorRate: health.errors.errorRate,
    averageLatency: health.performance.averageMessageLatency
  });
}
```

## Error Handling

### Error Codes
- `CONNECTION_FAILED`: Connection establishment failed
- `AUTHENTICATION_FAILED`: JWT token invalid or expired
- `AUTHORIZATION_FAILED`: User not authorized for channel
- `RATE_LIMITED`: Rate limit exceeded
- `CONNECTION_POOL_EXHAUSTED`: Too many connections
- `MESSAGE_DELIVERY_FAILED`: Failed to deliver message

### Error Response Format
```typescript
try {
  await manager.sendEvent(event);
} catch (error) {
  if (error instanceof PusherConnectionError) {
    console.error('Pusher error:', {
      code: error.code,
      message: error.message,
      connectionId: error.connectionId
    });
  }
}
```

## Configuration

### Connection Configuration
```typescript
interface ConnectionConfig {
  maxConnections: number;           // Maximum concurrent connections
  connectionTimeout: number;        // Connection timeout in ms
  heartbeatInterval: number;        // Health check interval
  reconnectAttempts: number;        // Max reconnection attempts
  reconnectDelay: number;          // Initial reconnect delay
  maxReconnectDelay: number;       // Maximum reconnect delay
  backoffMultiplier: number;       // Exponential backoff multiplier
  enableConnectionPooling: boolean; // Enable connection pooling
  enableHealthMonitoring: boolean; // Enable health monitoring
}
```

### Rate Limit Configuration
```typescript
interface RateLimitConfig {
  messagesPerSecond: number;        // Messages per second per user
  messagesPerMinute: number;        // Messages per minute per user
  subscriptionsPerConnection: number; // Max subscriptions per connection
  burstLimit: number;               // Burst message limit
  windowSize: number;               // Rate limit window size in seconds
}
```

## Environment Variables

Required environment variables:
```bash
PUSHER_APP_ID=your-app-id
NEXT_PUBLIC_PUSHER_KEY=your-public-key
PUSHER_SECRET=your-secret-key
PUSHER_CLUSTER=us2
```

## Testing

Run the test suite:
```bash
npm test src/services/pusher/
```

Tests cover:
- Connection management
- Rate limiting
- Authentication and authorization
- Event broadcasting
- Health monitoring
- Error handling

## Integration Examples

See `example-usage.ts` for comprehensive integration examples including:
- User connection handling
- Channel subscriptions
- Activity broadcasting
- Achievement notifications
- Health monitoring setup

## Performance Considerations

### Connection Pooling
- Reuses connections when possible
- Automatic cleanup of stale connections
- Configurable pool size limits

### Memory Management
- Automatic cleanup of old metrics data
- User rate limit data expiration
- Connection metadata cleanup

### Latency Optimization
- Batch message support for reduced overhead
- Connection keep-alive with heartbeats
- Efficient channel subscription management

## Security

### Authentication
- JWT token validation for all private channels
- Token expiration checking
- User identity verification

### Authorization
- Channel-specific permission checks
- Team membership validation
- Role-based access control

### Rate Limiting
- Prevents abuse and DoS attacks
- User-specific limits
- Burst protection

## Troubleshooting

### Common Issues

1. **Connection Failures**
   - Check Pusher credentials
   - Verify network connectivity
   - Check rate limits

2. **Authentication Errors**
   - Verify JWT token validity
   - Check token expiration
   - Validate user permissions

3. **Rate Limit Exceeded**
   - Check user message rates
   - Adjust rate limit configuration
   - Implement client-side throttling

4. **High Error Rates**
   - Monitor health status
   - Check Pusher service status
   - Review error logs

### Debugging

Enable debug logging:
```typescript
const manager = new PusherConnectionManager(config, rateConfig, {
  logLevel: 'DEBUG'
});
```

Monitor health status:
```typescript
setInterval(() => {
  const health = manager.getHealthStatus();
  if (health.status !== 'healthy') {
    console.warn('Pusher health degraded:', health);
  }
}, 30000);
```