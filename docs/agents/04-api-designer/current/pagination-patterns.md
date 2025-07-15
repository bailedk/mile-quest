# API Pagination Patterns

**Version**: 1.0  
**Date**: 2025-01-15  
**Status**: Draft

## Overview

This document defines pagination patterns for Mile Quest APIs to handle large datasets efficiently, particularly for teams with up to 50 members and thousands of activities.

## Pagination Strategy

### Cursor-Based Pagination

We'll use cursor-based pagination for all list endpoints to ensure consistent results even with concurrent data changes.

**Benefits:**
- No skipped or duplicate items during pagination
- Better performance for large datasets
- Works well with real-time updates

### Implementation Pattern

#### Request
```typescript
GET /api/v1/{resource}?cursor={cursor}&limit={limit}
```

#### Response
```typescript
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "nextCursor": string | null,
      "prevCursor": string | null,
      "hasMore": boolean,
      "total": number | null // Only for small datasets
    }
  }
}
```

### Cursor Format

Cursors are base64-encoded JSON objects containing:
```typescript
{
  "timestamp": string, // ISO timestamp of last item
  "id": string,       // ID of last item for tie-breaking
  "direction": "next" | "prev"
}
```

## Endpoint-Specific Patterns

### 1. Team Activities (`/api/v1/teams/:teamId/activities`)

**Constraints:**
- Teams can have thousands of activities
- Must respect privacy settings
- Need efficient filtering

**Implementation:**
```typescript
// Request
GET /api/v1/teams/:teamId/activities?
  cursor={cursor}&
  limit=20&
  startDate=2025-01-01&
  endDate=2025-01-31&
  userId={userId}

// Response includes
{
  "items": Activity[],
  "pagination": {
    "nextCursor": string | null,
    "hasMore": boolean
  }
}
```

### 2. Team Members (`/api/v1/teams/:teamId/members`)

**Constraints:**
- Max 50 members per team
- Include aggregated stats per member

**Implementation:**
```typescript
// Can return all members in one page for MVP
GET /api/v1/teams/:teamId/members?limit=50

// Response
{
  "items": TeamMember[],
  "pagination": {
    "nextCursor": null, // All members fit in one page
    "hasMore": false,
    "total": 37 // Safe to include total for small sets
  }
}
```

### 3. User Activities (`/api/v1/activities`)

**Constraints:**
- Users may have hundreds of activities
- Need filtering by date range and team

**Implementation:**
```typescript
// Default: 20 items per page
GET /api/v1/activities?
  cursor={cursor}&
  limit=20&
  teamId={teamId}&
  month=2025-01

// Cursor encodes last activity date+id
```

### 4. Leaderboards (`/api/v1/teams/:teamId/leaderboard`)

**Constraints:**
- Show top performers + current user
- Max 50 members total

**Implementation:**
```typescript
// No pagination needed for MVP
GET /api/v1/teams/:teamId/leaderboard?period=week

// Response includes all members ranked
{
  "items": [
    { rank: 1, user: {...}, distance: 50000 },
    { rank: 2, user: {...}, distance: 45000 },
    // ... all members ...
  ],
  "currentUser": {
    rank: 15,
    distance: 20000
  }
}
```

## Performance Considerations

### Database Indexes

Required indexes for cursor pagination:
```sql
-- Activities by team and date
CREATE INDEX idx_activities_team_date 
ON activities(teamId, activityDate DESC, id);

-- Activities by user and date
CREATE INDEX idx_activities_user_date 
ON activities(userId, activityDate DESC, id);

-- Team members by joined date
CREATE INDEX idx_team_members_joined 
ON teamMembers(teamId, joinedAt DESC, userId);
```

### Query Optimization

```typescript
// Efficient cursor query example
const activities = await prisma.activity.findMany({
  where: {
    teamId,
    activityDate: {
      lt: cursor.timestamp
    }
  },
  orderBy: [
    { activityDate: 'desc' },
    { id: 'desc' } // Tie-breaker
  ],
  take: limit + 1, // Fetch one extra to check hasMore
  include: {
    user: {
      select: { id: true, name: true }
    }
  }
});

const hasMore = activities.length > limit;
if (hasMore) activities.pop();
```

## Client-Side Implementation

### Infinite Scroll Pattern
```typescript
// React hook example
function useInfiniteActivities(teamId: string) {
  const [activities, setActivities] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  
  const loadMore = async () => {
    const response = await fetch(
      `/api/v1/teams/${teamId}/activities?cursor=${cursor}`
    );
    const data = await response.json();
    
    setActivities(prev => [...prev, ...data.items]);
    setCursor(data.pagination.nextCursor);
    setHasMore(data.pagination.hasMore);
  };
  
  return { activities, loadMore, hasMore };
}
```

### Caching Strategy
- Cache first page of results
- Invalidate on new activity
- Preserve scroll position on navigation

## Migration Path

1. **Phase 1**: Implement for activities (highest volume)
2. **Phase 2**: Add to all list endpoints
3. **Phase 3**: Optimize based on usage patterns

## Summary

This pagination pattern provides:
- Consistent performance regardless of dataset size
- No missed items during real-time updates
- Efficient database queries with proper indexes
- Simple client implementation
- Clear migration path as data grows