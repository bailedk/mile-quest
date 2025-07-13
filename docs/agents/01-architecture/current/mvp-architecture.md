# Mile Quest MVP Architecture (Simplified)

## Overview

Based on the Review Agent's recommendations and our evaluation, this document presents the simplified MVP architecture that balances speed-to-market with scalability.

## Core Architecture Decisions

### 1. Database
- **Choice**: RDS PostgreSQL with Multi-AZ
- **Rationale**: 60% cost savings vs Aurora, sufficient for MVP scale
- **Migration Path**: Clear triggers for Aurora migration at scale

### 2. Real-time Communication
- **Choice**: Pusher (managed WebSocket service)
- **Rationale**: 80% cost savings, faster implementation
- **Migration Path**: AWS IoT Core when >1000 concurrent users

### 3. Caching Strategy
- **Choice**: CloudFront only (no ElastiCache initially)
- **Rationale**: 100% cost savings, sufficient for MVP
- **Migration Path**: Add ElastiCache at >50 req/sec

### 4. API Design
- **Choice**: REST with field filtering
- **Rationale**: Simpler than GraphQL, team familiarity
- **Migration Path**: Add GraphQL when mobile usage >60%

## Simplified Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        CloudFront CDN                        │
│                   (Static Assets + API Cache)                │
└─────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
            ┌───────▼────────┐     ┌───────▼────────┐
            │  AWS Amplify   │     │  API Gateway   │
            │  (Next.js SSR) │     │   (REST API)   │
            └────────────────┘     └───────┬────────┘
                                           │
                                  ┌────────▼────────┐
                                  │     Lambda      │
                                  │   Functions     │
                                  └────────┬────────┘
                                           │
                ┌──────────────────────────┴───────────────────┐
                │                                              │
        ┌───────▼────────┐  ┌─────────▼────────┐
        │  RDS PostgreSQL│  │    DynamoDB      │
        │   (Multi-AZ)   │  │ (Sessions, Hot)  │
        └────────────────┘  └──────────────────┘
                                                  
        ┌────────────────┐  ┌─────────────────┐
        │    Cognito     │  │     Pusher      │
        │ (Auth + Social)│  │  (WebSockets)   │
        └────────────────┘  └─────────────────┘
```

## Service Configuration

### AWS Lambda
```javascript
// Lambda configuration
{
  runtime: "nodejs20.x",
  memorySize: 512,  // Start small
  timeout: 30,      // 30 seconds max
  environment: {
    NODE_ENV: "production",
    DATABASE_URL: process.env.DATABASE_URL
  }
}
```

### RDS PostgreSQL
```sql
-- Basic configuration
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Connection settings
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
```

### API Gateway
```yaml
# Throttling settings
throttle:
  burstLimit: 100
  rateLimit: 50

# CORS configuration  
cors:
  allowOrigins: ["https://mile-quest.com"]
  allowMethods: ["GET", "POST", "PUT", "DELETE"]
  maxAge: 86400
```

## Data Flow

### Activity Logging Flow
```
1. User logs activity (offline capable)
   └─> Store in IndexedDB
   
2. Sync when online
   └─> POST /api/activities
       └─> Lambda validates
           └─> Write to PostgreSQL
               └─> Publish to Pusher
                   └─> Update team members
```


## Cost Breakdown

### Monthly Costs (MVP)
| Service | Cost | Notes |
|---------|------|-------|
| RDS PostgreSQL | $40 | db.t3.micro Multi-AZ |
| Lambda | $10 | ~1M requests |
| API Gateway | $3.50 | $3.50 per million |
| DynamoDB | $5 | On-demand pricing |
| CloudFront | $5 | CDN transfer |
| AWS Amplify | $17 | Build minutes + bandwidth |
| Pusher | $0 | Free tier (200 connections) |
| Cognito | $0 | First 50k users free |
| **Total** | **$80.50** | ~$80/month |

### Scaling Costs
- 1,000 users: ~$70/month
- 10,000 users: ~$150/month
- 100,000 users: ~$500/month (time to migrate)

## Critical Pattern: External Service Abstraction

**All external services MUST be abstracted behind interfaces**. This is non-negotiable for:
- WebSockets (Pusher → API Gateway)
- Authentication (Cognito → Auth0/Supabase)
- Email (SES → SendGrid/Postmark)
- Maps (Mapbox → Google Maps)
- Analytics (GA4 → Mixpanel/Amplitude)

Benefits:
- No vendor lock-in
- Easy provider switching
- Simplified testing
- Cost optimization flexibility

See `external-service-abstraction-pattern.md` for implementation guide.

## Development Simplifications

### 1. Authentication
```javascript
// Simple Cognito setup
import { CognitoUserPool } from 'amazon-cognito-identity-js';

const userPool = new CognitoUserPool({
  UserPoolId: process.env.USER_POOL_ID,
  ClientId: process.env.CLIENT_ID
});

// Support email/password + Google Sign-In only
```

### 2. Database Access
```javascript
// Simple PostgreSQL client
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000
});
```

### 3. Real-time Updates (Abstracted)
```javascript
// WebSocket abstraction - works with any provider
import { createWebSocketService } from '@/services/websocket/factory';

const ws = createWebSocketService();
await ws.connect(userId, authToken);

// Subscribe to team channel
await ws.subscribe(`team-${teamId}`);
ws.on('activity-logged', (data) => {
  updateTeamProgress(data);
});

// Provider swappable via environment variable
// NEXT_PUBLIC_WEBSOCKET_PROVIDER=pusher (now)
// NEXT_PUBLIC_WEBSOCKET_PROVIDER=api-gateway (future)
```

### 4. Offline Support
```javascript
// Simple offline queue
const offlineQueue = {
  async add(action) {
    const queue = await getQueue();
    queue.push({ ...action, timestamp: Date.now() });
    await saveQueue(queue);
  },
  
  async sync() {
    const queue = await getQueue();
    for (const action of queue) {
      try {
        await processAction(action);
        await removeFromQueue(action);
      } catch (error) {
        console.error('Sync failed:', error);
      }
    }
  }
};
```

## Migration Paths

### When to Scale

1. **Database**: RDS → Aurora Serverless v2
   - Trigger: >100 requests/second
   - Migration: ~1 week, use AWS DMS

2. **WebSockets**: Pusher → AWS IoT Core  
   - Trigger: >$100/month Pusher costs
   - Migration: ~2 weeks, run parallel

3. **Caching**: Add ElastiCache
   - Trigger: Database CPU >70%
   - Migration: ~3 days, no downtime

4. **API**: Add GraphQL
   - Trigger: Mobile app launch
   - Migration: Run parallel to REST

## Security Considerations

### MVP Security
- HTTPS everywhere (CloudFront)
- Cognito for authentication
- API key for service-to-service
- Basic rate limiting

### Deferred Security
- WAF rules (Phase 2)
- Advanced DDoS protection
- Encryption at rest
- Audit logging
- Penetration testing
- Content moderation (when photos added)

## Monitoring

### Basic Monitoring (MVP)
- CloudWatch Logs
- Basic CloudWatch Metrics
- Lambda error rates
- API Gateway 4xx/5xx
- RDS CPU and connections

### Enhanced Monitoring (Phase 2)
- X-Ray tracing
- Custom CloudWatch dashboards
- Synthetic monitoring
- Real user monitoring
- Cost anomaly detection

## Deployment

### CI/CD Pipeline (Simplified)
```yaml
# GitHub Actions
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - run: npm run build
      
      # Deploy frontend to AWS Amplify
      - run: amplify publish --branch ${{ github.ref_name }}
      
      # Deploy Lambda functions
      - run: npx serverless deploy
```

## Success Metrics

### Technical KPIs
- API response time < 300ms (p95)
- Uptime > 99.5%
- Error rate < 1%
- Monthly AWS bill < $150

### Business KPIs  
- Onboarding < 2 minutes
- Daily active users > 60%
- Activity logging time < 30 seconds
- User retention > 40% (day 7)

---

*This simplified architecture enables rapid MVP development while maintaining clear paths for scaling.*