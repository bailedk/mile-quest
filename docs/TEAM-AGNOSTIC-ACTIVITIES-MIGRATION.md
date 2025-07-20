# Team-Agnostic Activities Migration Guide

## Overview

This guide outlines the changes needed to migrate from team-based activities to user-based activities where team distances are calculated based on team goal date ranges.

## Key Changes

### 1. Data Model Changes

Activities are now tracked at the user level with a timestamp, not tied to specific teams:

```prisma
model Activity {
  id         String   @id @default(uuid())
  userId     String
  distance   Float    // Distance in meters
  duration   Int      // Duration in seconds
  timestamp  DateTime // Single timestamp for the activity
  date       DateTime @db.Date // Date only for daily aggregation
  notes      String?
  source     ActivitySource @default(MANUAL)
  externalId String?
  isPrivate  Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  
  // Removed: teamId, teamGoalId
}
```

### 2. Backend API Changes

#### Updated Activity Creation Endpoint

```typescript
// POST /activities
interface CreateActivityInput {
  distance: number;      // in meters
  duration: number;      // in seconds
  timestamp: string;     // ISO date string
  notes?: string;
  isPrivate?: boolean;
  source?: ActivitySource;
}

// Response
interface ActivityResponse {
  id: string;
  userId: string;
  distance: number;
  duration: number;
  timestamp: string;
  notes?: string;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}
```

#### Team Progress Calculation

Team progress is now calculated dynamically based on:
1. Team members during the goal period
2. Activities within the goal's date range
3. Excluding members who left before the goal end date

```typescript
// GET /teams/:teamId/goals/:goalId/progress
interface TeamGoalProgressResponse {
  totalDistance: number;
  targetDistance: number;
  percentageComplete: number;
  startDate: string;
  endDate: string;
  memberContributions: Array<{
    userId: string;
    userName: string;
    distance: number;
    percentage: number;
  }>;
}
```

### 3. Database Queries

#### Calculate Team Distance for a Goal

```sql
SELECT 
  SUM(a.distance) as total_distance,
  COUNT(DISTINCT a.id) as total_activities,
  SUM(a.duration) as total_duration
FROM activities a
INNER JOIN team_members tm ON a.user_id = tm.user_id
INNER JOIN team_goals tg ON tm.team_id = tg.team_id
WHERE 
  tg.id = $1  -- goal_id
  AND DATE(a.timestamp) >= tg.start_date
  AND DATE(a.timestamp) <= tg.end_date
  AND a.is_private = false  -- Exclude private activities from team totals
  AND (tm.left_at IS NULL OR tm.left_at > tg.end_date)  -- Member was active during goal
  AND tm.joined_at < tg.end_date;  -- Member joined before goal ended
```

#### Get Member Contributions

```sql
SELECT 
  u.id as user_id,
  u.name as user_name,
  COALESCE(SUM(a.distance), 0) as distance,
  COALESCE(COUNT(a.id), 0) as activity_count
FROM team_members tm
INNER JOIN users u ON tm.user_id = u.id
LEFT JOIN activities a ON (
  a.user_id = u.id 
  AND DATE(a.timestamp) >= $2  -- start_date
  AND DATE(a.timestamp) <= $3  -- end_date
  AND a.is_private = false
)
WHERE 
  tm.team_id = $1  -- team_id
  AND (tm.left_at IS NULL OR tm.left_at > $3)  -- end_date
  AND tm.joined_at < $3  -- end_date
GROUP BY u.id, u.name
ORDER BY distance DESC;
```

#### Daily Activity Aggregation

```sql
SELECT 
  DATE(timestamp) as activity_date,
  COUNT(*) as activity_count,
  SUM(distance) as total_distance,
  SUM(duration) as total_duration
FROM activities
WHERE 
  user_id = $1
  AND timestamp >= $2
  AND timestamp <= $3
GROUP BY DATE(timestamp)
ORDER BY activity_date DESC;
```

### 4. Frontend Changes

#### Activity Creation UI
- Removed team selection from activity creation
- Added quick distance selection buttons
- Improved visual design with TouchCard components
- Added real-time activity summary preview
- Simplified form with better error handling

#### Dashboard Integration
- Activities now show at user level
- Team progress calculated based on goal date ranges
- Personal stats tracked independently of teams

### 5. Migration Steps

1. **Database Migration**
   ```sql
   -- Add new timestamp column
   ALTER TABLE activities ADD COLUMN timestamp TIMESTAMP;
   
   -- Populate from existing data
   UPDATE activities SET timestamp = start_time;
   
   -- Create indexes
   CREATE INDEX idx_activities_user_timestamp ON activities(user_id, timestamp DESC);
   CREATE INDEX idx_activities_timestamp ON activities(timestamp);
   CREATE INDEX idx_activities_user_timestamp_private ON activities(user_id, timestamp, is_private);
   
   -- After verification, remove old columns
   ALTER TABLE activities DROP COLUMN team_id;
   ALTER TABLE activities DROP COLUMN team_goal_id;
   ALTER TABLE activities DROP COLUMN start_time;
   ALTER TABLE activities DROP COLUMN end_time;
   ```

2. **Update API Endpoints**
   - Update existing `/activities` endpoint
   - Update team progress calculations
   - Remove team requirements from activity creation

3. **Update Frontend**
   - Deploy new activity creation page
   - Update activity service to use updated endpoints
   - Update dashboard to show user-centric activities

### 6. Benefits

1. **Simplified User Experience**: Users don't need to select teams when logging activities
2. **Flexible Team Participation**: Users can be in multiple teams without duplicating activities
3. **Accurate Progress Tracking**: Team progress based on actual participation dates
4. **Privacy Respected**: Private activities count toward personal stats but not team totals
5. **Better Performance**: Simpler queries with proper indexing

### 7. Implementation Notes

Key changes:
- Activities no longer require team selection
- Team progress calculated dynamically based on member activities
- Privacy settings respected in team calculations
- All activities tracked at user level

### 8. Testing Checklist

- [ ] Activity creation works without team selection
- [ ] Team progress calculates correctly for date ranges
- [ ] Members who left teams don't affect current goals
- [ ] Private activities excluded from team totals
- [ ] Daily aggregations work correctly
- [ ] Activity history displays properly
- [ ] Real-time updates still function
- [ ] Mobile UI responds correctly