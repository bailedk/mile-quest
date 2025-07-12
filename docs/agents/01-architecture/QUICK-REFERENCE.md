# Architecture Agent - Quick Reference Card

## Current State (v2.0 - MVP Simplified)

### Stack Overview
```
Frontend:  Next.js 14 on Vercel
API:       AWS Lambda + API Gateway (REST)
Database:  RDS PostgreSQL Multi-AZ
WebSocket: Pusher (managed service)
Auth:      Cognito with Google Sign-In
Storage:   S3 + CloudFront CDN
Cost:      ~$70/month
```

### Key Decisions
- ✅ RDS PostgreSQL instead of Aurora (60% cost savings)
- ✅ Pusher instead of custom WebSockets (80% savings)
- ✅ CloudFront only, no ElastiCache (100% savings)
- ✅ REST API only, GraphQL deferred
- ✅ Vercel hosting for simpler deployment

### Migration Triggers
| Component | Current | Upgrade To | When |
|-----------|---------|------------|------|
| Database | RDS PostgreSQL | Aurora Serverless v2 | >10k users OR >100 req/sec |
| WebSocket | Pusher | AWS IoT Core | >1000 concurrent |
| Cache | CloudFront | + ElastiCache | >50 req/sec |
| API | REST | + GraphQL | >60% mobile |

### API Endpoints (Simplified)
```
POST   /auth/login          # Cognito JWT
POST   /auth/register       # Email or Google
POST   /teams              # Create team
GET    /teams/{id}         # Get team + progress
POST   /activities         # Log walk
GET    /dashboard          # Combined data
```

### Performance Targets
- API Response: <300ms (p95)
- First Load: <4 seconds
- Cost: <$150/month
- Uptime: >99.5%

### Current Constraints
- No real-time aggregations (pre-computed)
- 5-minute cache TTL (CloudFront)
- 10 items per page (pagination)
- Basic offline (activities only)

### Next Steps
1. Implement core Lambda functions
2. Set up RDS with PostGIS
3. Configure Pusher channels
4. Create monitoring dashboards

### Key Files
- `current/mvp-architecture.md` - Full details
- `current/infrastructure-diagram-mvp.md` - Visuals
- `STATE.json` - Version tracking

---
*Last Updated: 2025-01-12 | Version: 2.0*