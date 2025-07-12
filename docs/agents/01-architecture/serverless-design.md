# Serverless Architecture Design

## Lambda Function Organization

### API Lambda Functions

```
/api/
├── auth/
│   ├── login.ts         → POST /auth/login
│   ├── register.ts      → POST /auth/register
│   ├── refresh.ts       → POST /auth/refresh
│   └── logout.ts        → POST /auth/logout
├── teams/
│   ├── create.ts        → POST /teams
│   ├── get.ts           → GET /teams/{id}
│   ├── update.ts        → PUT /teams/{id}
│   ├── delete.ts        → DELETE /teams/{id}
│   ├── invite.ts        → POST /teams/{id}/invite
│   └── leave.ts         → POST /teams/{id}/leave
├── activities/
│   ├── log.ts           → POST /activities
│   ├── list.ts          → GET /activities
│   ├── sync.ts          → POST /activities/sync
│   └── delete.ts        → DELETE /activities/{id}
├── waypoints/
│   ├── create.ts        → POST /waypoints
│   ├── calculate.ts     → POST /waypoints/calculate-route
│   ├── update.ts        → PUT /waypoints/{id}
│   └── delete.ts        → DELETE /waypoints/{id}
└── websocket/
    ├── connect.ts       → $connect route
    ├── disconnect.ts    → $disconnect route
    └── message.ts       → $default route
```

### Background Processing Functions

```
/jobs/
├── aggregateProgress.ts    → SQS triggered (every 5 min)
├── calculateDistances.ts   → EventBridge triggered
├── sendNotifications.ts    → SNS triggered
├── syncFitnessData.ts      → EventBridge scheduled
└── generateReports.ts      → EventBridge weekly
```

## Event-Driven Architecture

### Real-time Updates Flow
```
User logs activity
       │
       ▼
API Gateway → Lambda
       │
       ├─→ Aurora (store)
       │
       ├─→ SQS (queue aggregation)
       │
       └─→ EventBridge (broadcast)
              │
              ├─→ WebSocket Lambda (notify team)
              │
              └─→ ElastiCache (update leaderboard)
```

### Fitness Tracker Sync Flow
```
EventBridge (hourly)
       │
       ▼
Sync Lambda
       │
       ├─→ Fitbit API
       ├─→ Google Fit API
       └─→ Apple Health (via user app)
              │
              ▼
         Process & Store
              │
              ▼
         Team Progress Update
```

## API Design Patterns

### RESTful Endpoints

```typescript
// Response format
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-12T10:00:00Z",
    "version": "1.0"
  }
}

// Error format
{
  "success": false,
  "error": {
    "code": "TEAM_NOT_FOUND",
    "message": "Team with ID xyz not found",
    "details": { ... }
  }
}
```

### WebSocket Messages

```typescript
// Client → Server
{
  "action": "subscribe",
  "teamId": "team-uuid",
  "token": "jwt-token"
}

// Server → Client
{
  "type": "progress_update",
  "teamId": "team-uuid",
  "data": {
    "totalDistance": 1523.5,
    "percentComplete": 76.2,
    "lastActivity": { ... }
  }
}
```

## Data Access Patterns

### Aurora Serverless Queries
- Connection pooling via RDS Proxy
- Prepared statements for security
- Read replicas for analytics

### DynamoDB Access
- Single table design for sessions
- GSI for team member lookups
- TTL for temporary data

### Caching Strategy
```
1. User session → DynamoDB (TTL: 24h)
2. Team progress → ElastiCache (TTL: 5min)
3. Leaderboard → ElastiCache (TTL: 1min)
4. Map tiles → S3 + CloudFront (TTL: 30d)
```

## Security Implementation

### API Authentication Flow
```
1. User login → Cognito
2. Receive ID token + Refresh token
3. Include ID token in API requests
4. API Gateway validates token
5. Lambda receives user context
```

### Authorization Patterns
```typescript
// Lambda authorizer
export const authorize = async (event) => {
  const token = event.headers.Authorization;
  const decoded = await verifyToken(token);
  
  return {
    principalId: decoded.sub,
    policyDocument: generatePolicy(decoded),
    context: {
      userId: decoded.sub,
      email: decoded.email,
      teams: decoded['custom:teams']
    }
  };
};
```

## Cost Optimization Techniques

### 1. Lambda Optimization
- ARM-based Graviton2 (20% cheaper)
- Memory optimization per function
- Reserved concurrency for predictable workloads
- Lambda SnapStart for Java/Python

### 2. API Gateway Optimization
- Caching for GET requests
- Request/response compression
- Usage plans for rate limiting

### 3. Database Optimization
- Aurora auto-pause after 5 minutes
- Batch writes for activities
- Materialized views for analytics

### 4. Storage Optimization
- S3 lifecycle policies
- Intelligent tiering for logs
- CloudFront compression

## Monitoring & Alerting

### CloudWatch Metrics
```
- Lambda invocations and errors
- API Gateway 4xx/5xx rates
- Aurora connections and CPU
- SQS queue depth
- WebSocket connection count
```

### Alarms Configuration
```
- Lambda errors > 1% → PagerDuty
- API latency > 1s → Slack
- Aurora CPU > 80% → Auto-scale
- Monthly cost > budget → Email
```

## Development Workflow

### Local Development
```bash
# Using AWS SAM
sam local start-api
sam local start-lambda

# DynamoDB Local
docker run -p 8000:8000 amazon/dynamodb-local

# LocalStack for other services
docker run localstack/localstack
```

### Deployment Pipeline
```yaml
# GitHub Actions
- Build monorepo packages
- Run tests
- Deploy Lambda functions
- Update API Gateway
- Invalidate CloudFront
- Run smoke tests
```