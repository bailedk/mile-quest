# Data Access Patterns for Mile Quest

## Overview

This document outlines the common data access patterns, query optimization strategies, and caching approaches for Mile Quest.

## High-Frequency Queries

### 1. User Dashboard
**Frequency**: Every page load for authenticated users

**Queries Needed**:
- User's active teams with member counts
- Recent activities (last 7 days)
- Current stats (total distance, streak)
- Unread notifications count

**Optimization Strategy**:
```typescript
// Single query with selective loading
const dashboardData = await prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    name: true,
    avatarUrl: true,
    stats: true,
    teamMemberships: {
      where: { leftAt: null },
      select: {
        role: true,
        team: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            _count: {
              select: {
                members: {
                  where: { leftAt: null }
                }
              }
            }
          }
        }
      }
    },
    activities: {
      where: {
        startTime: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      },
      orderBy: { startTime: 'desc' },
      take: 10
    }
  }
});
```

**Caching**: 
- Cache in Redis for 5 minutes
- Invalidate on activity creation or team changes

### 2. Team Activity Feed
**Frequency**: High - main team view

**Query Pattern**:
```typescript
const teamFeed = await prisma.activity.findMany({
  where: {
    teamId: teamId,
    teamGoalId: goalId // optional filter
  },
  include: {
    user: {
      select: {
        id: true,
        name: true,
        avatarUrl: true
      }
    }
  },
  orderBy: { startTime: 'desc' },
  take: 20,
  cursor: cursor ? { id: cursor } : undefined
});
```

**Optimization**:
- Index on `(teamId, startTime DESC)`
- Cursor-based pagination
- Limit includes to necessary fields

### 3. Team Leaderboard
**Frequency**: Medium - viewed often but not on every page

**Query Pattern**:
```sql
-- Raw SQL for performance
SELECT 
  u.id,
  u.name,
  u.avatar_url,
  COALESCE(SUM(a.distance), 0) as total_distance,
  COUNT(DISTINCT DATE(a.start_time)) as active_days,
  COALESCE(AVG(a.distance), 0) as avg_distance
FROM users u
INNER JOIN team_members tm ON tm.user_id = u.id
LEFT JOIN activities a ON a.user_id = u.id 
  AND a.team_id = $1
  AND a.start_time >= $2
  AND a.start_time <= $3
WHERE tm.team_id = $1
  AND tm.left_at IS NULL
  AND u.deleted_at IS NULL
GROUP BY u.id
ORDER BY total_distance DESC
LIMIT 50;
```

**Caching**:
- Cache for 15 minutes
- Key: `leaderboard:${teamId}:${period}`
- Invalidate on new activities

### 4. Goal Progress Calculation
**Frequency**: After each activity, displayed on team page

**Query Pattern**:
```typescript
// Get current progress
const progress = await prisma.teamProgress.findUnique({
  where: { teamGoalId: goalId },
  include: {
    teamGoal: {
      select: {
        targetDistance: true,
        routeData: true
      }
    }
  }
});

// Calculate segment position
const routeData = progress.teamGoal.routeData as RouteData;
const segments = routeData.segments;
let remainingDistance = progress.totalDistance;

for (let i = 0; i < segments.length; i++) {
  if (remainingDistance <= segments[i].distance) {
    return {
      currentSegmentIndex: i,
      segmentProgress: remainingDistance,
      percentComplete: (progress.totalDistance / progress.teamGoal.targetDistance) * 100
    };
  }
  remainingDistance -= segments[i].distance;
}
```

**Optimization**:
- Pre-calculate on activity creation
- Store in TeamProgress table
- Update via database trigger or application logic

## Write Patterns

### 1. Activity Creation
**Transaction Requirements**:
- Create activity record
- Update user stats
- Update team progress
- Check for achievements
- Send notifications

```typescript
async function createActivity(data: CreateActivityInput) {
  return await prisma.$transaction(async (tx) => {
    // 1. Create activity
    const activity = await tx.activity.create({ data });

    // 2. Update user stats
    await tx.userStats.upsert({
      where: { userId: activity.userId },
      create: {
        userId: activity.userId,
        totalDistance: activity.distance,
        totalActivities: 1,
        totalDuration: activity.duration,
        currentStreak: 1,
        lastActivityAt: activity.startTime
      },
      update: {
        totalDistance: { increment: activity.distance },
        totalActivities: { increment: 1 },
        totalDuration: { increment: activity.duration },
        lastActivityAt: activity.startTime
        // Streak calculation done separately
      }
    });

    // 3. Update team progress
    if (activity.teamGoalId) {
      const progress = await updateTeamProgress(tx, activity);
      
      // 4. Check goal completion
      if (progress.totalDistance >= progress.teamGoal.targetDistance) {
        await tx.teamGoal.update({
          where: { id: activity.teamGoalId },
          data: { 
            status: 'COMPLETED',
            completedAt: new Date()
          }
        });
      }
    }

    // 5. Queue achievement check (async)
    await queueAchievementCheck(activity.userId, activity.id);

    return activity;
  });
}
```

### 2. Team Member Management
**Constraints**:
- Check team capacity
- Ensure at least one admin
- Handle role changes

```typescript
async function addTeamMember(teamId: string, userId: string, role: TeamRole) {
  return await prisma.$transaction(async (tx) => {
    // Check team capacity
    const team = await tx.team.findUnique({
      where: { id: teamId },
      include: {
        _count: {
          select: {
            members: {
              where: { leftAt: null }
            }
          }
        }
      }
    });

    if (team._count.members >= team.maxMembers) {
      throw new Error('Team is full');
    }

    // Add member
    return await tx.teamMember.create({
      data: {
        teamId,
        userId,
        role
      }
    });
  });
}
```

## Indexing Strategy

### Primary Indexes (Created by Prisma)
- All primary keys
- All foreign keys
- Unique constraints

### Additional Indexes Needed

```sql
-- Activities: Common query patterns
CREATE INDEX idx_activities_team_start ON activities(team_id, start_time DESC);
CREATE INDEX idx_activities_user_start ON activities(user_id, start_time DESC);
CREATE INDEX idx_activities_goal_created ON activities(team_goal_id, created_at DESC);

-- Team members: Active members
CREATE INDEX idx_team_members_active ON team_members(team_id, user_id) 
  WHERE left_at IS NULL;

-- Teams: Public discovery
CREATE INDEX idx_teams_public ON teams(created_at DESC) 
  WHERE is_public = true AND deleted_at IS NULL;

-- Invites: Pending lookups
CREATE INDEX idx_invites_pending ON team_invites(email, status) 
  WHERE status = 'PENDING';
```

## Caching Strategy

### Cache Layers

1. **Application Memory** (Node.js)
   - User session data
   - Feature flags
   - Achievement definitions

2. **CloudFront** (CDN)
   - API responses for public data
   - Team avatars and images
   - Static achievement icons

3. **Future: Redis** (When added)
   - User dashboard data (5 min TTL)
   - Team leaderboards (15 min TTL)
   - Activity feeds (5 min TTL)
   - Goal progress (5 min TTL)

### Cache Invalidation

```typescript
class CacheService {
  // Invalidate patterns
  async invalidateUserCache(userId: string) {
    const patterns = [
      `user:${userId}:*`,
      `dashboard:${userId}`,
      `stats:${userId}`
    ];
    // Invalidate all matching patterns
  }

  async invalidateTeamCache(teamId: string) {
    const patterns = [
      `team:${teamId}:*`,
      `leaderboard:${teamId}:*`,
      `feed:${teamId}:*`
    ];
    // Invalidate all matching patterns
  }
}
```

## Performance Monitoring

### Key Metrics to Track

1. **Query Performance**
   - p95 query time < 100ms
   - p99 query time < 500ms
   - Slow query log threshold: 1s

2. **Connection Pool**
   - Active connections
   - Waiting connections
   - Connection timeouts

3. **Cache Hit Rates**
   - Target: >80% for frequently accessed data
   - Monitor cache misses

### Query Analysis

```sql
-- Find slow queries
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE mean_time > 100
ORDER BY mean_time DESC
LIMIT 20;

-- Index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

## Scaling Considerations

### When to Consider Read Replicas
- Leaderboard queries exceeding 1s
- Dashboard queries affecting write performance
- More than 100 concurrent users

### When to Add Caching Layer
- Same queries repeated >10 times/minute
- Database CPU consistently >70%
- API response times >500ms p95

### When to Migrate to Aurora
- Database size >100GB
- Need for auto-scaling
- Require <30s failover time
- Global application deployment