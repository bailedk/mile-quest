# API Versioning Implementation

**Version**: 1.0  
**Date**: 2025-01-15  
**Author**: API Designer Agent  
**Status**: Complete

## Overview

This document implements the API versioning strategy recommended by the Architecture Agent (see: `docs/agents/01-architecture/current/api-versioning-strategy.md`). All Mile Quest APIs will use URL-based versioning with the `/api/v1/` prefix.

## Implementation Details

### URL Pattern Updates

All endpoints defined in `api-contracts-mvp.md` are updated to include version prefix:

#### Authentication APIs
- `/api/auth/register` → `/api/v1/auth/register`
- `/api/auth/login` → `/api/v1/auth/login`
- `/api/auth/refresh` → `/api/v1/auth/refresh`
- `/api/auth/logout` → `/api/v1/auth/logout`
- `/api/auth/verify-email` → `/api/v1/auth/verify-email`

#### Resource APIs
- `/api/user` → `/api/v1/user`
- `/api/user/stats` → `/api/v1/user/stats`
- `/api/teams` → `/api/v1/teams`
- `/api/teams/:id` → `/api/v1/teams/:id`
- `/api/teams/:id/members` → `/api/v1/teams/:id/members`
- `/api/teams/:id/join` → `/api/v1/teams/:id/join`
- `/api/activities` → `/api/v1/activities`
- `/api/activities/:id` → `/api/v1/activities/:id`
- `/api/dashboard` → `/api/v1/dashboard`

#### Utility APIs
- `/api/versions` → `/api/versions` (no version prefix - meta endpoint)

### Version Detection Endpoint

```typescript
// GET /api/versions
{
  "success": true,
  "data": {
    "current": "v1",
    "supported": ["v1"],
    "deprecated": [],
    "beta": []
  }
}
```

### Response Headers

All API responses will include version information headers:

```typescript
interface VersionHeaders {
  'X-API-Version': string;        // Current version used
  'X-API-Versions': string;       // All supported versions
  'X-API-Current': string;        // Latest stable version
  'X-API-Deprecated'?: string;    // If using deprecated version
  'X-API-Deprecation-Date'?: string;  // When version will be removed
  'X-API-Upgrade-Guide'?: string;     // Migration documentation URL
}
```

### Next.js Implementation Structure

```
app/
├── api/
│   ├── versions/
│   │   └── route.ts              // Version detection endpoint
│   └── v1/
│       ├── auth/
│       │   ├── register/
│       │   │   └── route.ts
│       │   ├── login/
│       │   │   └── route.ts
│       │   ├── refresh/
│       │   │   └── route.ts
│       │   ├── logout/
│       │   │   └── route.ts
│       │   └── verify-email/
│       │       └── route.ts
│       ├── user/
│       │   ├── route.ts
│       │   └── stats/
│       │       └── route.ts
│       ├── teams/
│       │   ├── route.ts
│       │   └── [id]/
│       │       ├── route.ts
│       │       ├── members/
│       │       │   └── route.ts
│       │       └── join/
│       │           └── route.ts
│       ├── activities/
│       │   ├── route.ts
│       │   └── [id]/
│       │       └── route.ts
│       └── dashboard/
│           └── route.ts
```

### Client SDK Configuration

```typescript
// SDK base configuration
const API_CONFIG = {
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  version: 'v1',
  get apiBase() {
    return `${this.baseURL}/api/${this.version}`;
  }
};

// Usage in SDK
const response = await fetch(`${API_CONFIG.apiBase}/teams`);
```

### Version Lifecycle Management

#### Breaking Changes (New Version Required)
- Removing required fields
- Changing field types
- Modifying authentication flow
- Altering response structure
- Changing business logic significantly

#### Non-Breaking Changes (Same Version)
- Adding optional fields
- Adding new endpoints
- Adding response data
- Performance improvements
- Bug fixes

### Migration Support

When v2 is eventually introduced:

1. **Parallel Support Period**: 6 months
2. **Migration Headers**: Automatic on v1 endpoints
3. **Documentation**: Auto-generated migration guide
4. **Client Detection**: SDK auto-detects available versions

### CloudFront Configuration

```yaml
behaviors:
  - pathPattern: /api/v1/*
    targetOriginId: nextjs-origin
    cachePolicyId: api-v1-cache-policy
    compress: true
    viewerProtocolPolicy: redirect-to-https
  
  - pathPattern: /api/versions
    targetOriginId: nextjs-origin
    cachePolicyId: no-cache
    compress: true
    viewerProtocolPolicy: redirect-to-https
```

## Implementation Checklist

- [x] Document versioning strategy
- [x] Update all endpoint paths in contracts
- [x] Define version detection endpoint
- [x] Specify response headers
- [x] Plan directory structure
- [ ] Update api-contracts-mvp.md with v1 prefix
- [ ] Create version negotiation logic
- [ ] Set up deprecation header middleware
- [ ] Create migration guide template

## Future Considerations

### Beta Features
- Endpoint pattern: `/api/v1-beta/experimental-feature`
- No stability guarantees
- Clear documentation warnings
- Separate from main version

### Version 2 Planning
- Start planning at 80% feature completion
- Gather breaking change requirements
- Design migration path early
- Consider GraphQL transition

## Dependencies

This implementation depends on:
- Architecture Agent's versioning strategy
- Next.js App Router structure
- CloudFront configuration
- Client SDK development

## Next Steps

1. Update `api-contracts-mvp.md` with v1 prefixes
2. Create middleware for version headers
3. Implement version detection endpoint
4. Update client SDK configuration
5. Document for dependent agents