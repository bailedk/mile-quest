# Mile Quest API Contracts - MVP

**Version**: 1.0  
**Date**: 2025-01-15  
**Status**: In Progress

## Overview

This document defines the core API contracts for Mile Quest MVP, using Next.js App Router API routes. All endpoints follow REST principles with a focus on mobile-first performance and offline capabilities.

## API Standards

### Base URL
- Development: `http://localhost:3000/api`
- Production: `https://app.milequest.run/api`

### Authentication
- Bearer token in Authorization header
- Token obtained from `/api/auth/login` or `/api/auth/refresh`
- Tokens expire after 1 hour (short-lived)

### Response Format
```typescript
// Success Response
{
  "success": true,
  "data": { ... }
}

// Error Response
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}

// Paginated Response
{
  "success": true,
  "data": {
    "items": [...],
    "nextCursor": "cursor_string",
    "hasMore": true
  }
}
```

### Common Headers
```
Content-Type: application/json
Authorization: Bearer <token>
X-Client-Version: 1.0.0
```

## Authentication Endpoints

### POST /api/v1/auth/register
Register a new user account.

**Request Body:**
```typescript
{
  "email": string,
  "password": string,
  "name": string,
  "provider": "email" | "google"
}
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "user": {
      "id": string,
      "email": string,
      "name": string,
      "emailVerified": boolean
    },
    "requiresVerification": boolean
  }
}
```

### POST /api/v1/auth/login
Sign in an existing user.

**Request Body:**
```typescript
{
  "email": string,
  "password": string
}
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "user": {
      "id": string,
      "email": string,
      "name": string,
      "profilePictureUrl": string | null
    },
    "accessToken": string,
    "refreshToken": string,
    "expiresIn": number // seconds
  }
}
```

### POST /api/v1/auth/refresh
Refresh access token using refresh token.

**Request Body:**
```typescript
{
  "refreshToken": string
}
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "accessToken": string,
    "expiresIn": number
  }
}
```

### POST /api/v1/auth/logout
Sign out the current user.

**Request:** No body required (uses auth token)

**Response:**
```typescript
{
  "success": true,
  "data": {}
}
```

### POST /api/v1/auth/verify-email
Verify email address with code.

**Request Body:**
```typescript
{
  "email": string,
  "code": string
}
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "verified": true
  }
}
```

## User Endpoints

### GET /api/v1/user/profile
Get current user's profile.

**Response:**
```typescript
{
  "success": true,
  "data": {
    "user": {
      "id": string,
      "email": string,
      "name": string,
      "profilePictureUrl": string | null,
      "timezone": string,
      "preferredUnits": "METRIC" | "IMPERIAL",
      "createdAt": string
    },
    "stats": {
      "totalDistance": number,
      "totalActivities": number,
      "currentStreak": number,
      "longestStreak": number,
      "lastActivityDate": string | null
    }
  }
}
```

### PATCH /api/v1/user/profile
Update user profile.

**Request Body:**
```typescript
{
  "name"?: string,
  "timezone"?: string,
  "preferredUnits"?: "METRIC" | "IMPERIAL"
}
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "user": { ... } // Updated user object
  }
}
```

## Team Endpoints

### POST /api/v1/teams
Create a new team.

**Request Body:**
```typescript
{
  "name": string,
  "goalDistance": number, // in meters
  "startDate": string, // ISO date
  "endDate": string, // ISO date
  "description"?: string
}
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "team": {
      "id": string,
      "name": string,
      "inviteCode": string,
      "goalDistance": number,
      "startDate": string,
      "endDate": string,
      "description": string | null,
      "createdAt": string
    },
    "member": {
      "userId": string,
      "teamId": string,
      "role": "ADMIN",
      "joinedAt": string
    }
  }
}
```

### GET /api/v1/teams
Get user's teams with progress.

**Query Parameters:**
- `cursor`: string (optional) - Pagination cursor
- `limit`: number (optional, default: 20, max: 50)

**Response:**
```typescript
{
  "success": true,
  "data": {
    "items": [
      {
        "team": {
          "id": string,
          "name": string,
          "inviteCode": string,
          "goalDistance": number,
          "startDate": string,
          "endDate": string,
          "memberCount": number
        },
        "progress": {
          "totalDistance": number,
          "percentComplete": number,
          "currentSegmentIndex": number,
          "daysRemaining": number
        },
        "userRole": "ADMIN" | "MEMBER"
      }
    ],
    "nextCursor": string | null,
    "hasMore": boolean
  }
}
```

### GET /api/v1/teams/:teamId
Get team details with full progress.

**Response:**
```typescript
{
  "success": true,
  "data": {
    "team": {
      "id": string,
      "name": string,
      "inviteCode": string,
      "goalDistance": number,
      "startDate": string,
      "endDate": string,
      "description": string | null,
      "createdAt": string
    },
    "progress": {
      "totalDistance": number,
      "percentComplete": number,
      "currentSegmentIndex": number,
      "distanceToNextWaypoint": number,
      "lastActivityAt": string | null
    },
    "members": {
      "count": number,
      "activeToday": number,
      "activeThisWeek": number
    },
    "userMember": {
      "role": "ADMIN" | "MEMBER",
      "joinedAt": string
    }
  }
}
```

### POST /api/v1/teams/join
Join a team using invite code.

**Request Body:**
```typescript
{
  "inviteCode": string
}
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "team": { ... },
    "member": {
      "userId": string,
      "teamId": string,
      "role": "MEMBER",
      "joinedAt": string
    }
  }
}
```

### GET /api/v1/teams/:teamId/members
Get team members with their contributions.

**Query Parameters:**
- `cursor`: string (optional)
- `limit`: number (optional, default: 20, max: 50)

**Response:**
```typescript
{
  "success": true,
  "data": {
    "items": [
      {
        "user": {
          "id": string,
          "name": string,
          "profilePictureUrl": string | null
        },
        "member": {
          "role": "ADMIN" | "MEMBER",
          "joinedAt": string
        },
        "stats": {
          "totalDistance": number,
          "activityCount": number,
          "lastActivityAt": string | null
        }
      }
    ],
    "nextCursor": string | null,
    "hasMore": boolean
  }
}
```

## Activity Endpoints

### POST /api/v1/activities
Log a new activity.

**Request Body:**
```typescript
{
  "teamIds": string[], // Activities can count for multiple teams
  "distance": number, // in meters
  "duration": number, // in seconds
  "activityDate": string, // ISO date
  "note"?: string,
  "isPrivate": boolean
}
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "activity": {
      "id": string,
      "userId": string,
      "distance": number,
      "duration": number,
      "pace": number, // min/km or min/mi based on user preference
      "activityDate": string,
      "note": string | null,
      "isPrivate": boolean,
      "createdAt": string
    },
    "teamUpdates": [
      {
        "teamId": string,
        "newTotalDistance": number,
        "newPercentComplete": number
      }
    ]
  }
}
```

### GET /api/v1/activities
Get user's activities.

**Query Parameters:**
- `cursor`: string (optional)
- `limit`: number (optional, default: 20, max: 50)
- `teamId`: string (optional) - Filter by team
- `startDate`: string (optional) - ISO date
- `endDate`: string (optional) - ISO date

**Response:**
```typescript
{
  "success": true,
  "data": {
    "items": [
      {
        "id": string,
        "distance": number,
        "duration": number,
        "pace": number,
        "activityDate": string,
        "note": string | null,
        "isPrivate": boolean,
        "createdAt": string,
        "teams": [
          {
            "id": string,
            "name": string
          }
        ]
      }
    ],
    "nextCursor": string | null,
    "hasMore": boolean
  }
}
```

### PATCH /api/v1/activities/:activityId
Update an activity.

**Request Body:**
```typescript
{
  "note"?: string,
  "isPrivate"?: boolean
}
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "activity": { ... } // Updated activity
  }
}
```

### DELETE /api/v1/activities/:activityId
Delete an activity.

**Response:**
```typescript
{
  "success": true,
  "data": {
    "deleted": true,
    "teamUpdates": [
      {
        "teamId": string,
        "newTotalDistance": number,
        "newPercentComplete": number
      }
    ]
  }
}
```

## Dashboard Endpoint

### GET /api/v1/dashboard
Get all dashboard data in a single optimized call.

**Response:**
```typescript
{
  "success": true,
  "data": {
    "user": {
      "id": string,
      "name": string,
      "profilePictureUrl": string | null,
      "stats": {
        "totalDistance": number,
        "currentStreak": number,
        "weeklyDistance": number
      }
    },
    "teams": [
      {
        "team": {
          "id": string,
          "name": string,
          "goalDistance": number
        },
        "progress": {
          "totalDistance": number,
          "percentComplete": number,
          "rank": number // User's rank in team
        }
      }
    ],
    "recentActivities": [
      {
        "id": string,
        "distance": number,
        "activityDate": string,
        "teams": [{ "id": string, "name": string }]
      }
    ],
    "teamActivity": [
      {
        "teamId": string,
        "teamName": string,
        "user": {
          "id": string,
          "name": string
        },
        "activity": {
          "distance": number,
          "timestamp": string
        }
      }
    ]
  }
}
```

## Error Codes

Common error codes used across the API:

- `UNAUTHORIZED` - Invalid or missing authentication
- `FORBIDDEN` - User lacks permission
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Invalid request data
- `TEAM_FULL` - Team has reached 50 member limit
- `ALREADY_MEMBER` - User already in team
- `INVALID_INVITE_CODE` - Team invite code invalid
- `RATE_LIMITED` - Too many requests

## Versioning Strategy (TBD)

Options being considered:
1. URL versioning: `/api/v1/...`
2. Header versioning: `X-API-Version: 1`
3. Accept header: `Accept: application/vnd.milequest.v1+json`

Decision pending Architecture Agent collaboration.

## Offline Support

Endpoints that support offline queueing:
- `POST /api/activities` - Can be queued and synced later
- `PATCH /api/activities/:id` - Can be queued for updates
- `DELETE /api/activities/:id` - Can be queued for deletion

Clients should:
1. Generate temporary IDs for offline activities
2. Queue failed requests with timestamps
3. Retry with exponential backoff
4. Replace temp IDs when synced

## WebSocket Events

Real-time updates via WebSocket (abstracted Pusher):

**Channel**: `team-{teamId}`

**Events**:
- `activity-created` - New activity in team
- `member-joined` - New member joined
- `progress-updated` - Team progress changed
- `goal-completed` - Team reached goal

**Event Format**:
```typescript
{
  "event": "activity-created",
  "data": {
    "user": { "id": string, "name": string },
    "activity": { "distance": number, "timestamp": string },
    "teamProgress": { "totalDistance": number, "percentComplete": number }
  }
}
```

## Rate Limiting

- Authenticated requests: 600/hour per user
- Activity logging: 60/hour per user
- Team creation: 10/day per user
- Auth endpoints: 20/hour per IP

## Next Steps

1. Finalize API versioning strategy with Architecture Agent
2. Create TypeScript interfaces for all contracts
3. Design error handling patterns
4. Create API client SDK structure
5. Define caching strategies