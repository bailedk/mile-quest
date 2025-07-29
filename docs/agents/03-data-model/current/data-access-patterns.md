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
    teamGoalId: goalId, // optional filter
    isPrivate: false // Only show public activities in feed
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
- Index on `isPrivate` for filtering
- Cursor-based pagination
- Limit includes to necessary fields

### 3. Team Leaderboard
**Frequency**: Medium - viewed often but not on every page

**Query Pattern**:
```sql
-- Raw SQL for performance (respecting privacy)
SELECT 
  u.id,
  u.name,
  u.avatar_url,
  COALESCE(SUM(CASE WHEN a.is_private = false THEN a.distance ELSE 0 END), 0) as total_distance,
  COUNT(DISTINCT CASE WHEN a.is_private = false THEN DATE(a.start_time) END) as active_days,
  COALESCE(AVG(CASE WHEN a.is_private = false THEN a.distance END), 0) as avg_distance,
  EXISTS(SELECT 1 FROM activities WHERE user_id = u.id AND team_id = $1 AND is_private = true) as has_private_activities
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

## Team Goal Aggregation Best Practices

### Overview
Team goal progress is aggregated in real-time during activity creation to ensure data consistency and immediate user feedback. This section details the implementation approach.

### Aggregation Strategy

#### 1. Real-time Updates (Recommended Approach)
Aggregate data immediately when activities are created, updated, or deleted:

```typescript
async function createActivity(data: CreateActivityInput) {
  return await prisma.$transaction(async (tx) => {
    // 1. Create the activity (with privacy preference)
    const activity = await tx.activity.create({ 
      data: {
        ...data,
        isPrivate: data.isPrivate || false // User's privacy preference
      }
    });

    // 2. Update user stats
    await tx.userStats.upsert({
      where: { userId: activity.userId },
      create: {
        userId: activity.userId,
        totalDistance: activity.distance,
        totalActivities: 1,
        totalDuration: activity.duration,
        lastActivityAt: activity.startTime
      },
      update: {
        totalDistance: { increment: activity.distance },
        totalActivities: { increment: 1 },
        totalDuration: { increment: activity.duration },
        lastActivityAt: activity.startTime
      }
    });

    // 3. Update team progress if activity is linked to a goal
    if (activity.teamGoalId) {
      const progress = await tx.teamProgress.upsert({
        where: { teamGoalId: activity.teamGoalId },
        create: {
          teamGoalId: activity.teamGoalId,
          totalDistance: activity.distance,
          totalActivities: 1,
          totalDuration: activity.duration,
          lastActivityAt: activity.startTime
        },
        update: {
          totalDistance: { increment: activity.distance },
          totalActivities: { increment: 1 },
          totalDuration: { increment: activity.duration },
          lastActivityAt: activity.startTime
        }
      });

      // 4. Update segment progress
      await updateSegmentProgress(tx, activity.teamGoalId, progress.totalDistance);

      // 5. Check for goal completion
      const goal = await tx.teamGoal.findUnique({
        where: { id: activity.teamGoalId },
        select: { targetDistance: true, status: true }
      });

      if (goal.status === 'ACTIVE' && progress.totalDistance >= goal.targetDistance) {
        await tx.teamGoal.update({
          where: { id: activity.teamGoalId },
          data: { 
            status: 'COMPLETED',
            completedAt: new Date()
          }
        });
        
        // Queue notifications for team members
        await queueGoalCompletionNotifications(activity.teamGoalId);
      }
    }

    return activity;
  });
}
```

#### 2. Segment Progress Calculation
Update which segment of the route the team has reached:

```typescript
async function updateSegmentProgress(
  tx: PrismaTransaction, 
  teamGoalId: string, 
  totalDistance: number
) {
  const goal = await tx.teamGoal.findUnique({
    where: { id: teamGoalId },
    select: { routeData: true }
  });

  const routeData = goal.routeData as RouteData;
  const segments = routeData.segments;
  
  let remainingDistance = totalDistance;
  let currentSegmentIndex = 0;
  let segmentProgress = 0;

  // Find current position on route
  for (let i = 0; i < segments.length; i++) {
    if (remainingDistance <= segments[i].distance) {
      currentSegmentIndex = i;
      segmentProgress = remainingDistance;
      break;
    }
    remainingDistance -= segments[i].distance;
    currentSegmentIndex = i + 1;
  }

  // Update progress tracking
  await tx.teamProgress.update({
    where: { teamGoalId },
    data: {
      currentSegmentIndex,
      segmentProgress
    }
  });
}
```

### Handling Edge Cases

#### 1. Activity Updates
When activities are edited, adjust the aggregates:

```typescript
async function updateActivity(activityId: string, updates: UpdateActivityInput) {
  return await prisma.$transaction(async (tx) => {
    // Get the original activity
    const original = await tx.activity.findUnique({
      where: { id: activityId },
      select: { distance: true, duration: true, teamGoalId: true, userId: true }
    });

    // Calculate differences
    const distanceDiff = (updates.distance || original.distance) - original.distance;
    const durationDiff = (updates.duration || original.duration) - original.duration;

    // Update the activity
    const updated = await tx.activity.update({
      where: { id: activityId },
      data: updates
    });

    // Update aggregates if values changed
    if (distanceDiff !== 0 || durationDiff !== 0) {
      // Update user stats
      await tx.userStats.update({
        where: { userId: original.userId },
        data: {
          totalDistance: { increment: distanceDiff },
          totalDuration: { increment: durationDiff }
        }
      });

      // Update team progress if linked to goal
      if (original.teamGoalId) {
        const progress = await tx.teamProgress.update({
          where: { teamGoalId: original.teamGoalId },
          data: {
            totalDistance: { increment: distanceDiff },
            totalDuration: { increment: durationDiff }
          }
        });

        // Recalculate segment progress
        await updateSegmentProgress(tx, original.teamGoalId, progress.totalDistance);
      }
    }

    return updated;
  });
}
```

#### 2. Activity Deletion
Handle aggregate updates when activities are removed:

```typescript
async function deleteActivity(activityId: string) {
  return await prisma.$transaction(async (tx) => {
    const activity = await tx.activity.findUnique({
      where: { id: activityId },
      select: { distance: true, duration: true, teamGoalId: true, userId: true }
    });

    // Delete the activity
    await tx.activity.delete({ where: { id: activityId } });

    // Update user stats
    await tx.userStats.update({
      where: { userId: activity.userId },
      data: {
        totalDistance: { decrement: activity.distance },
        totalActivities: { decrement: 1 },
        totalDuration: { decrement: activity.duration }
      }
    });

    // Update team progress
    if (activity.teamGoalId) {
      const progress = await tx.teamProgress.update({
        where: { teamGoalId: activity.teamGoalId },
        data: {
          totalDistance: { decrement: activity.distance },
          totalActivities: { decrement: 1 },
          totalDuration: { decrement: activity.duration }
        }
      });

      await updateSegmentProgress(tx, activity.teamGoalId, progress.totalDistance);
    }
  });
}
```

### Data Reconciliation

#### 1. Periodic Verification
Run a nightly job to ensure aggregate accuracy:

```typescript
async function reconcileTeamProgress() {
  const goals = await prisma.teamGoal.findMany({
    where: { status: 'ACTIVE' }
  });

  for (const goal of goals) {
    await prisma.$transaction(async (tx) => {
      // Calculate actual totals from activities
      const actual = await tx.activity.aggregate({
        where: { teamGoalId: goal.id },
        _sum: { distance: true, duration: true },
        _count: true
      });

      // Get current recorded progress
      const recorded = await tx.teamProgress.findUnique({
        where: { teamGoalId: goal.id }
      });

      // Check for discrepancies
      const distanceDiff = Math.abs((actual._sum.distance || 0) - recorded.totalDistance);
      const countDiff = Math.abs(actual._count - recorded.totalActivities);

      // If significant difference found (>0.1 miles or count mismatch)
      if (distanceDiff > 0.1 || countDiff > 0) {
        console.warn(`Discrepancy found for goal ${goal.id}:`, {
          recordedDistance: recorded.totalDistance,
          actualDistance: actual._sum.distance,
          recordedCount: recorded.totalActivities,
          actualCount: actual._count
        });

        // Update to correct values
        await tx.teamProgress.update({
          where: { teamGoalId: goal.id },
          data: {
            totalDistance: actual._sum.distance || 0,
            totalActivities: actual._count,
            totalDuration: actual._sum.duration || 0
          }
        });

        // Recalculate segment progress
        await updateSegmentProgress(tx, goal.id, actual._sum.distance || 0);
      }
    });
  }
}
```

#### 2. Individual Progress Calculation
When needed, calculate individual contributions without storing them:

```typescript
async function getIndividualProgress(userId: string, teamGoalId: string) {
  const result = await prisma.activity.aggregate({
    where: {
      userId,
      teamGoalId
    },
    _sum: {
      distance: true,
      duration: true
    },
    _count: true
  });

  return {
    totalDistance: result._sum.distance || 0,
    totalActivities: result._count,
    totalDuration: result._sum.duration || 0
  };
}

// For team leaderboard with individual progress (privacy-aware)
async function getTeamLeaderboard(teamId: string, teamGoalId?: string) {
  const members = await prisma.$queryRaw`
    SELECT 
      u.id,
      u.name,
      u.avatar_url,
      COALESCE(SUM(CASE WHEN a.is_private = false THEN a.distance ELSE 0 END), 0) as total_distance,
      COUNT(CASE WHEN a.is_private = false THEN a.id END) as activity_count,
      COALESCE(AVG(CASE WHEN a.is_private = false THEN a.distance END), 0) as avg_distance,
      EXISTS(SELECT 1 FROM activities WHERE user_id = u.id AND team_id = ${teamId} AND is_private = true) as has_private_activities
    FROM users u
    INNER JOIN team_members tm ON tm.user_id = u.id
    LEFT JOIN activities a ON a.user_id = u.id 
      AND a.team_id = ${teamId}
      ${teamGoalId ? Prisma.sql`AND a.team_goal_id = ${teamGoalId}` : Prisma.empty}
    WHERE tm.team_id = ${teamId}
      AND tm.left_at IS NULL
    GROUP BY u.id, u.name, u.avatar_url
    ORDER BY total_distance DESC
  `;

  return members;
}
```

### Privacy Considerations

#### 1. Privacy Principles
- **Private activities always count toward team goals** - Users can contribute without being on leaderboards
- **User stats respect privacy** - Private activities are excluded from public stats
- **Team progress includes all activities** - Both private and public count toward goals
- **Activity feed excludes private activities** - Only public activities shown in feeds

#### 2. Querying User's Own Data
Users can always see their complete data including private activities:

```typescript
async function getUserCompleteStats(userId: string) {
  const stats = await prisma.activity.aggregate({
    where: { userId },
    _sum: { distance: true, duration: true },
    _count: true
  });

  const publicStats = await prisma.activity.aggregate({
    where: { userId, isPrivate: false },
    _sum: { distance: true, duration: true },
    _count: true
  });

  return {
    total: {
      distance: stats._sum.distance || 0,
      activities: stats._count,
      duration: stats._sum.duration || 0
    },
    public: {
      distance: publicStats._sum.distance || 0,
      activities: publicStats._count,
      duration: publicStats._sum.duration || 0
    },
    private: {
      distance: (stats._sum.distance || 0) - (publicStats._sum.distance || 0),
      activities: stats._count - publicStats._count,
      duration: (stats._sum.duration || 0) - (publicStats._sum.duration || 0)
    }
  };
}
```

#### 3. Privacy-Aware Activity Feed
Show privacy indicators without revealing details:

```typescript
async function getTeamActivityFeed(teamId: string, viewerId: string) {
  // Get public activities
  const publicActivities = await prisma.activity.findMany({
    where: {
      teamId,
      isPrivate: false
    },
    include: {
      user: {
        select: { id: true, name: true, avatarUrl: true }
      }
    },
    orderBy: { startTime: 'desc' },
    take: 20
  });

  // Get viewer's private activities
  const viewerPrivateActivities = await prisma.activity.findMany({
    where: {
      teamId,
      userId: viewerId,
      isPrivate: true
    },
    orderBy: { startTime: 'desc' },
    take: 20
  });

  // Merge and sort by startTime
  const allActivities = [...publicActivities, ...viewerPrivateActivities]
    .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
    .slice(0, 20);

  return allActivities;
}
```

#### 4. Privacy Toggle Implementation
Allow users to change privacy settings on existing activities:

```typescript
async function toggleActivityPrivacy(activityId: string, userId: string) {
  // Verify ownership
  const activity = await prisma.activity.findFirst({
    where: { id: activityId, userId }
  });

  if (!activity) {
    throw new Error('Activity not found or unauthorized');
  }

  // Toggle privacy
  return await prisma.activity.update({
    where: { id: activityId },
    data: { isPrivate: !activity.isPrivate }
  });
}

// Bulk privacy update
async function updatePrivacySettings(userId: string, makePrivate: boolean) {
  return await prisma.activity.updateMany({
    where: { userId },
    data: { isPrivate: makePrivate }
  });
}
```

### Performance Considerations

1. **Transaction Size**: Keep transactions small and focused
2. **Batch Updates**: For bulk imports, consider batching updates
3. **Async Processing**: Queue non-critical updates (achievements, notifications)
4. **Index Usage**: Ensure proper indexes on teamGoalId and userId

### Monitoring Aggregation Health

```typescript
// Add metrics for monitoring
async function trackAggregationMetrics(operation: string, duration: number) {
  // Log to monitoring service
  metrics.histogram('aggregation.duration', duration, { operation });
  
  if (duration > 1000) {
    // Alert on slow aggregations
    console.error(`Slow aggregation detected: ${operation} took ${duration}ms`);
  }
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

## Notification System Queries

### 1. User Notification Feed
**Frequency**: High - checked on every page load and via real-time updates

**Query Pattern**:
```typescript
// Get unread notifications with pagination
const notifications = await prisma.notification.findMany({
  where: {
    userId: userId,
    status: { in: ['PENDING', 'SENT', 'DELIVERED'] },
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: new Date() } }
    ]
  },
  include: {
    template: {
      select: { key: true, category: true }
    }
  },
  orderBy: { createdAt: 'desc' },
  take: 20,
  cursor: cursor ? { id: cursor } : undefined
});

// Get unread count
const unreadCount = await prisma.notification.count({
  where: {
    userId: userId,
    status: { in: ['PENDING', 'SENT', 'DELIVERED'] },
    readAt: null
  }
});
```

**Optimization**:
- Compound index on `[userId, status]` for efficient filtering
- Index on `[userId, createdAt(sort: Desc)]` for timeline queries
- Separate count query cached for 1 minute

### 2. Notification Preferences
**Frequency**: Low - loaded once per session, updated rarely

**Query Pattern**:
```typescript
// Load all user preferences
const preferences = await prisma.notificationPreference.findMany({
  where: { userId: userId }
});

// Convert to map for easy lookup
const prefMap = new Map(
  preferences.map(p => [p.category, p])
);

// Check if notification should be sent
function shouldSendNotification(
  category: NotificationCategory,
  channel: NotificationChannel,
  currentTime: Date
): boolean {
  const pref = prefMap.get(category);
  
  if (!pref || !pref.isEnabled) return false;
  if (!pref.channels.includes(channel)) return false;
  
  // Check quiet hours
  if (pref.quietHoursStart && pref.quietHoursEnd) {
    const hour = currentTime.getHours();
    const start = parseInt(pref.quietHoursStart.split(':')[0]);
    const end = parseInt(pref.quietHoursEnd.split(':')[0]);
    
    if (start < end) {
      if (hour >= start && hour < end) return false;
    } else {
      if (hour >= start || hour < end) return false;
    }
  }
  
  return true;
}
```

**Caching**:
- Cache preferences for entire session
- Invalidate on any preference update

### 3. Notification Processing Queue
**Frequency**: Continuous - background job processing

**Query Pattern**:
```typescript
// Get pending notifications for processing
const pendingNotifications = await prisma.notification.findMany({
  where: {
    status: 'PENDING',
    OR: [
      { scheduledFor: null },
      { scheduledFor: { lte: new Date() } }
    ],
    retryCount: { lt: prisma.notification.fields.maxRetries }
  },
  include: {
    user: {
      select: {
        email: true,
        name: true,
        notificationPreferences: true
      }
    },
    template: true
  },
  orderBy: [
    { priority: 'desc' },
    { createdAt: 'asc' }
  ],
  take: 100 // Process in batches
});
```

**Optimization**:
- Compound index on `[status, scheduledFor]` for queue queries
- Priority ordering ensures urgent notifications sent first
- Batch processing reduces database round trips

### 4. Create Activity Notification
**Frequency**: After every activity creation

**Transaction Pattern**:
```typescript
async function createActivityNotifications(
  activity: Activity,
  teamMembers: string[]
) {
  const notifications = await prisma.$transaction(async (tx) => {
    // Get team member preferences
    const preferences = await tx.notificationPreference.findMany({
      where: {
        userId: { in: teamMembers },
        category: 'ACTIVITY',
        isEnabled: true
      }
    });
    
    const enabledUsers = preferences.map(p => p.userId);
    
    // Create notifications for enabled users
    const notificationData = enabledUsers
      .filter(userId => userId !== activity.userId) // Don't notify self
      .map(userId => ({
        userId,
        type: 'ACTIVITY_CREATED' as NotificationType,
        category: 'ACTIVITY' as NotificationCategory,
        priority: 'MEDIUM' as NotificationPriority,
        title: 'New Team Activity',
        content: `${activity.user.name} logged ${activity.distance}m`,
        channels: ['REALTIME'] as NotificationChannel[],
        data: {
          activityId: activity.id,
          teamId: activity.teamId,
          userId: activity.userId,
          distance: activity.distance
        }
      }));
    
    // Bulk create notifications
    await tx.notification.createMany({
      data: notificationData
    });
    
    return notificationData.length;
  });
  
  // Queue real-time delivery
  await queueRealtimeNotifications(notifications);
}
```

### 5. Batch Notification Processing
**Frequency**: Scheduled jobs for announcements, reminders

**Query Pattern**:
```typescript
// Create batch notifications
async function createBatchNotifications(
  type: NotificationType,
  category: NotificationCategory,
  userIds: string[],
  content: NotificationContent
) {
  return await prisma.$transaction(async (tx) => {
    // Create batch record
    const batch = await tx.notificationBatch.create({
      data: {
        type,
        category,
        totalCount: userIds.length,
        status: 'PROCESSING'
      }
    });
    
    // Get user preferences
    const preferences = await tx.notificationPreference.findMany({
      where: {
        userId: { in: userIds },
        category,
        isEnabled: true
      }
    });
    
    const preferenceMap = new Map(
      preferences.map(p => [p.userId, p])
    );
    
    // Create notifications with preference filtering
    const notifications = userIds
      .filter(userId => preferenceMap.has(userId))
      .map(userId => {
        const pref = preferenceMap.get(userId);
        return {
          userId,
          type,
          category,
          priority: content.priority,
          title: content.title,
          content: content.body,
          channels: pref.channels,
          data: { batchId: batch.id }
        };
      });
    
    // Bulk insert
    await tx.notification.createMany({
      data: notifications
    });
    
    // Update batch count
    await tx.notificationBatch.update({
      where: { id: batch.id },
      data: {
        sentCount: notifications.length,
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });
    
    return batch;
  });
}
```

### 6. Mark Notifications as Read
**Frequency**: Medium - user interaction driven

**Query Pattern**:
```typescript
// Mark single notification as read
async function markAsRead(notificationId: string, userId: string) {
  return await prisma.notification.update({
    where: {
      id: notificationId,
      userId: userId // Ensure user owns notification
    },
    data: {
      status: 'READ',
      readAt: new Date()
    }
  });
}

// Mark all as read
async function markAllAsRead(userId: string) {
  return await prisma.notification.updateMany({
    where: {
      userId: userId,
      status: { in: ['DELIVERED', 'SENT'] },
      readAt: null
    },
    data: {
      status: 'READ',
      readAt: new Date()
    }
  });
}
```

### 7. Notification Analytics
**Frequency**: Low - admin dashboards

**Query Pattern**:
```typescript
// Notification delivery stats
const stats = await prisma.notification.groupBy({
  by: ['type', 'status'],
  where: {
    createdAt: {
      gte: startDate,
      lte: endDate
    }
  },
  _count: true
});

// User engagement metrics
const engagement = await prisma.$queryRaw`
  SELECT 
    category,
    COUNT(*) as total_sent,
    COUNT(read_at) as total_read,
    COUNT(clicked_at) as total_clicked,
    AVG(EXTRACT(EPOCH FROM (read_at - sent_at))) as avg_time_to_read
  FROM notifications
  WHERE sent_at >= ${startDate}
    AND sent_at <= ${endDate}
  GROUP BY category
`;
```

### 8. Cleanup Expired Notifications
**Frequency**: Daily maintenance job

**Query Pattern**:
```typescript
async function cleanupExpiredNotifications() {
  // Delete expired notifications
  const deleted = await prisma.notification.deleteMany({
    where: {
      OR: [
        {
          expiresAt: { lt: new Date() },
          status: { in: ['EXPIRED', 'CANCELLED'] }
        },
        {
          createdAt: { 
            lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days
          },
          status: 'READ'
        }
      ]
    }
  });
  
  console.log(`Cleaned up ${deleted.count} expired notifications`);
  
  // Archive old batch records
  const archivedBatches = await prisma.notificationBatch.deleteMany({
    where: {
      completedAt: {
        lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // 90 days
      }
    }
  });
  
  console.log(`Archived ${archivedBatches.count} old batch records`);
}
```

## Notification Performance Considerations

1. **Real-time Delivery**: Use WebSocket connections (Pusher) for instant delivery
2. **Email Batching**: Group emails to same user within 5-minute window
3. **Preference Caching**: Cache user preferences in memory for quick access
4. **Queue Processing**: Use separate workers for different priority levels
5. **Retry Logic**: Exponential backoff for failed deliveries

## Privacy Considerations for Notifications

1. **Activity Notifications**: Respect `isPrivate` flag - don't include distance/details for private activities
2. **Team Notifications**: Only send to active team members
3. **Preference Compliance**: Always check user preferences before sending
4. **Unsubscribe Links**: Include in all email notifications
5. **Data Minimization**: Only include necessary data in notification payload