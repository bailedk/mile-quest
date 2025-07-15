# API Designer Recommendations for Other Agents

**Date**: 2025-01-15  
**From**: API Designer Agent (04)

## For Architecture Agent (01)

### API Versioning Strategy Decision Needed
**Priority**: High  
**Request**: Define API versioning approach before implementation begins  
**Context**: Three viable options identified:
1. URL versioning (`/api/v1/...`)
2. Header versioning (`X-API-Version: 1`)
3. Accept header versioning

**Recommendation**: URL versioning for simplicity with Next.js routing
**Impact**: Affects all API implementations and client SDKs

## For Security Agent (06)

### Authentication Service Abstraction
**Priority**: High  
**Request**: Implement Cognito abstraction layer matching API contracts  
**Context**: API assumes abstracted auth service, not direct Cognito usage
**Deliverable**: `AuthService` interface implementation
**Key Methods**:
- `register()`, `login()`, `refresh()`, `logout()`
- Token management abstraction
- Session storage abstraction

### Rate Limiting Implementation
**Priority**: Medium  
**Request**: Implement rate limiting per API specifications  
**Limits Defined**:
- General: 600/hour per user
- Activities: 60/hour per user  
- Team creation: 10/day per user
- Auth endpoints: 20/hour per IP

## For Mobile Optimization Agent (07)

### Offline Queue Implementation
**Priority**: High  
**Request**: Implement offline queueing for activity endpoints  
**Endpoints**:
- `POST /api/activities`
- `PATCH /api/activities/:id`
- `DELETE /api/activities/:id`

**Requirements**:
- Temporary ID generation
- Timestamp preservation
- Retry with exponential backoff
- ID replacement on sync

### PWA Caching Strategy
**Priority**: Medium  
**Request**: Implement service worker caching for API responses  
**Recommendations**:
- Cache dashboard endpoint aggressively
- Cache team data with 5-minute TTL
- Skip caching for mutations
- Implement cache-first for user profile

## For Data Model Agent (03)

### Index Optimization for API Queries
**Priority**: Medium  
**Request**: Create indexes for common API access patterns  
**Suggested Indexes**:
```sql
-- For dashboard query
CREATE INDEX idx_team_members_user_active ON team_members(user_id) WHERE left_at IS NULL;
CREATE INDEX idx_activities_user_date ON activities(user_id, activity_date DESC);

-- For team queries
CREATE INDEX idx_team_progress_team ON team_progress(team_id);
CREATE INDEX idx_activities_team_private ON activities(team_id, is_private);

-- For pagination
CREATE INDEX idx_activities_created ON activities(created_at DESC);
```

### Aggregation Table Updates
**Priority**: High  
**Request**: Ensure UserStats and TeamProgress update correctly  
**Critical**: Transaction safety for concurrent activity logging

## For Integration Agent (08)

### WebSocket Abstraction Usage
**Priority**: High  
**Request**: Use WebSocketService for all real-time features  
**Channels**: `team-{teamId}`  
**Events**: 
- `activity-created`
- `member-joined`
- `progress-updated`
- `goal-completed`

**Note**: Never import Pusher directly

## For Testing & QA Agent (10)

### API Contract Testing
**Priority**: High  
**Request**: Create contract tests for all endpoints  
**Focus Areas**:
- Response format consistency
- Error format validation
- Privacy flag enforcement
- Pagination cursor validity
- Rate limit headers

### Load Testing Scenarios
**Priority**: Medium  
**Scenarios to Test**:
1. Dashboard endpoint under load (target: <500ms p95)
2. Concurrent activity logging (50 users/team)
3. Team creation bursts
4. Pagination performance with large datasets

## For DevOps Agent (11)

### API Monitoring Requirements
**Priority**: High  
**Metrics to Track**:
- Response time by endpoint
- Error rate by error code
- Rate limit violations
- Payload sizes
- Concurrent users

### Caching Configuration
**Priority**: Medium  
**CloudFront Behaviors**:
- `/api/dashboard` - 30 seconds
- `/api/teams/*` GET - 5 minutes
- `/api/auth/*` - No cache
- All mutations - No cache

## For Business Analyst Agent (14)

### API Implementation Priority
**Priority**: High  
**Recommended Order**:
1. Authentication endpoints (unblocks everything)
2. Team creation/join (core feature)
3. Activity logging (core feature)
4. Dashboard (key UX)
5. Everything else

**Reasoning**: This order allows progressive feature testing while maintaining core functionality.

## Process Recommendations

### API Documentation
- Consider OpenAPI/Swagger generation
- Maintain Postman collection
- Create SDK examples early
- Version documentation with code

### Change Management
- API changes need 2-week notice
- Deprecation policy needed
- Version sunset planning
- Client compatibility tracking

These recommendations should help ensure smooth API implementation and integration across all agents.