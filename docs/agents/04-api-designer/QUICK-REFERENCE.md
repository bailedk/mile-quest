# API Designer Agent - Quick Reference

## Purpose
Design and document all API contracts for Mile Quest

## Status
🔄 PENDING - Waiting for Data Model Agent

## Key Deliverables
- OpenAPI 3.0 specification
- REST endpoint documentation  
- TypeScript interfaces
- Postman collection
- GraphQL migration guide

## API Design Principles
1. **RESTful** - Follow REST best practices
2. **Consistent** - Standardized patterns across all endpoints
3. **Efficient** - Optimize for mobile with field filtering
4. **Secure** - JWT auth with proper rate limiting
5. **Future-proof** - Design with GraphQL migration in mind

## Core API Groups
- Authentication (`/api/auth/*`)
- Users (`/api/users/*`)
- Teams (`/api/teams/*`)
- Activities (`/api/activities/*`)
- Goals (`/api/goals/*`)
- Leaderboards (`/api/leaderboards/*`)
- Achievements (`/api/achievements/*`)

## Common Patterns
- Pagination: Cursor-based with `?cursor=xxx&limit=20`
- Filtering: Field selection with `?fields=id,name,distance`
- Sorting: `?sort=-createdAt,name`
- Search: `?q=searchterm`
- Privacy: Respect `isPrivate` flag on activities

## Next Steps
1. Complete Data Model Agent
2. Start with authentication endpoints
3. Design CRUD operations for core entities
4. Add specialized endpoints for app features