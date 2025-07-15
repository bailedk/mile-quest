# Database Index Definitions for Mile Quest

## Overview

This document defines the database indexes needed for optimal query performance in Mile Quest. These indexes are based on the common query patterns identified in the data access patterns document and are designed to support the MVP's performance requirements.

## Index Categories

### 1. Primary Indexes (Automatically Created by Prisma)

These indexes are created automatically based on the Prisma schema:

- **Primary Keys**: All `@id` fields
- **Unique Constraints**: All `@unique` fields and `@@unique` combinations
- **Foreign Keys**: All relation fields

### 2. Additional Performance Indexes

These indexes need to be added via migrations to optimize common query patterns:

## Index Definitions

### Activities Table Indexes

```sql
-- High-frequency query: Team activity feed
CREATE INDEX idx_activities_team_start ON activities(team_id, start_time DESC)
WHERE deleted_at IS NULL;

-- High-frequency query: User dashboard recent activities
CREATE INDEX idx_activities_user_start ON activities(user_id, start_time DESC);

-- Goal progress tracking
CREATE INDEX idx_activities_goal_created ON activities(team_goal_id, created_at DESC)
WHERE team_goal_id IS NOT NULL;

-- Privacy filtering for public feeds
CREATE INDEX idx_activities_team_public ON activities(team_id, start_time DESC)
WHERE is_private = false;

-- Date range queries for leaderboards
CREATE INDEX idx_activities_team_date_range ON activities(team_id, start_time, end_time);
```

### Team Members Table Indexes

```sql
-- Active team members lookup
CREATE INDEX idx_team_members_active ON team_members(team_id, user_id) 
WHERE left_at IS NULL;

-- User's active teams
CREATE INDEX idx_team_members_user_active ON team_members(user_id, joined_at DESC)
WHERE left_at IS NULL;

-- Role-based queries
CREATE INDEX idx_team_members_admins ON team_members(team_id, role)
WHERE left_at IS NULL AND role = 'ADMIN';
```

### Teams Table Indexes

```sql
-- Public team discovery
CREATE INDEX idx_teams_public_recent ON teams(created_at DESC) 
WHERE is_public = true AND deleted_at IS NULL;

-- Team name search (for autocomplete)
CREATE INDEX idx_teams_name_search ON teams USING GIN (name gin_trgm_ops)
WHERE deleted_at IS NULL;
```

### Team Invites Table Indexes

```sql
-- Pending invites by email
CREATE INDEX idx_invites_email_pending ON team_invites(email, status) 
WHERE status = 'PENDING';

-- User's pending invites
CREATE INDEX idx_invites_user_pending ON team_invites(user_id, created_at DESC)
WHERE status = 'PENDING' AND user_id IS NOT NULL;

-- Expired invites cleanup
CREATE INDEX idx_invites_expired ON team_invites(expires_at)
WHERE status = 'PENDING';
```

### Team Goals Table Indexes

```sql
-- Active goals by team
CREATE INDEX idx_goals_team_active ON team_goals(team_id, created_at DESC)
WHERE status = 'ACTIVE';

-- Goals by status for dashboard
CREATE INDEX idx_goals_status ON team_goals(team_id, status, created_at DESC);
```

### User Stats Table Indexes

```sql
-- Leaderboard queries by total distance
CREATE INDEX idx_user_stats_distance ON user_stats(total_distance DESC);

-- Streak leaderboard
CREATE INDEX idx_user_stats_streak ON user_stats(current_streak DESC)
WHERE current_streak > 0;
```

### Team Progress Table Indexes

```sql
-- Progress lookups are already optimized via unique constraint on team_goal_id
-- No additional indexes needed
```

### User Achievements Table Indexes

```sql
-- Recent achievements for activity feeds
CREATE INDEX idx_user_achievements_recent ON user_achievements(earned_at DESC);

-- Team achievements
CREATE INDEX idx_user_achievements_team ON user_achievements(team_id, earned_at DESC)
WHERE team_id IS NOT NULL;
```

## Spatial Indexes (Future Enhancement)

### Overview

PostGIS spatial indexes will be valuable when Mile Quest implements advanced geographic features. The current schema stores route data as JSON, but future enhancements may benefit from native spatial data types and indexes.

### Recommended Spatial Indexes

When PostGIS features are implemented:

```sql
-- Enable PostGIS extension (already included in migration notes)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Waypoint location searches (if storing points separately)
CREATE INDEX idx_waypoints_location ON waypoints USING GIST (location);

-- Activity route searches (if storing GPS tracks)
CREATE INDEX idx_activities_route ON activities USING GIST (route_geometry)
WHERE route_geometry IS NOT NULL;

-- Team goal route lines (for map visualization)
CREATE INDEX idx_team_goals_route ON team_goals USING GIST (route_line)
WHERE route_line IS NOT NULL;

-- Nearby teams discovery (if implementing location-based features)
CREATE INDEX idx_teams_location ON teams USING GIST (headquarters_location)
WHERE headquarters_location IS NOT NULL;
```

### Use Cases for Spatial Indexes

1. **Route Visualization**:
   - Store route as LineString geometry
   - Efficiently query visible routes on map viewport
   - Calculate accurate distances along curved paths

2. **Proximity Searches**:
   - Find teams near a location
   - Discover routes passing through an area
   - Match activities to nearest route segment

3. **Geographic Analytics**:
   - Heat maps of activity density
   - Popular routes by region
   - Distance calculations with elevation

### Implementation Considerations

1. **Data Migration Strategy**:
   ```sql
   -- Convert JSON route data to PostGIS geometry
   ALTER TABLE team_goals ADD COLUMN route_line geometry(LineString, 4326);
   
   -- Populate from existing JSON data
   UPDATE team_goals 
   SET route_line = ST_MakeLine(
     ARRAY(
       SELECT ST_MakePoint(
         (segment->>'lng')::float,
         (segment->>'lat')::float
       )
       FROM json_array_elements(route_data->'waypoints') AS segment
     )
   );
   ```

2. **Query Examples**:
   ```sql
   -- Find routes within viewport
   SELECT * FROM team_goals
   WHERE ST_Intersects(
     route_line,
     ST_MakeEnvelope(:minLng, :minLat, :maxLng, :maxLat, 4326)
   );
   
   -- Calculate actual route distance
   SELECT ST_Length(route_line::geography) / 1609.34 as miles
   FROM team_goals WHERE id = :goalId;
   ```

3. **Performance Benefits**:
   - Bounding box queries: ~100x faster than JSON parsing
   - Distance calculations: Native vs application-level
   - Spatial joins: Efficient proximity matching

### Recommendation for Map Integration Agent

Based on the current MVP architecture and the JSON-based route storage, spatial indexes are not immediately necessary. However, the Map Integration Agent should:

1. **Phase 1 (MVP)**: Continue with JSON storage in `routeData` field
2. **Phase 2**: Evaluate PostGIS migration if:
   - Map performance becomes an issue
   - Advanced geographic features are requested
   - Route calculations need higher precision

The existing PostgreSQL installation already includes PostGIS extension, making future migration straightforward when needed.

## Index Maintenance

### Monitoring Index Usage

```sql
-- Check index usage statistics
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Find unused indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND indexname NOT LIKE '%_pkey'
AND schemaname = 'public';
```

### Index Bloat Monitoring

```sql
-- Check for index bloat
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    ROUND(100 * pg_relation_size(indexrelid) / 
          NULLIF(pg_relation_size(tablename::regclass), 0), 2) AS index_ratio
FROM pg_stat_user_indexes
JOIN pg_class ON indexrelid = pg_class.oid
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

## Performance Considerations

### Index Creation Strategy

1. **Create indexes CONCURRENTLY in production** to avoid locking tables:
   ```sql
   CREATE INDEX CONCURRENTLY idx_name ON table(column);
   ```

2. **Monitor query performance** before and after index creation:
   - Use `EXPLAIN ANALYZE` to verify index usage
   - Track query execution times
   - Monitor database CPU and I/O

3. **Index maintenance windows**:
   - Schedule REINDEX operations during low-traffic periods
   - Consider using pg_repack for online index maintenance

### Index Trade-offs

1. **Write Performance Impact**:
   - Each index adds overhead to INSERT, UPDATE, DELETE operations
   - Activities table will have the most write load
   - Balance between read optimization and write performance

2. **Storage Considerations**:
   - Each index requires disk space
   - Estimate: ~20-30% of table size per B-tree index
   - Monitor total index size vs table size ratio

3. **Memory Usage**:
   - Frequently used indexes should fit in shared_buffers
   - Monitor cache hit rates for indexes

## Implementation Migration

```typescript
// migrations/add_performance_indexes.ts
import { PrismaClient } from '@prisma/client';

export async function up() {
  const prisma = new PrismaClient();
  
  // Add indexes one at a time to monitor impact
  await prisma.$executeRaw`
    CREATE INDEX CONCURRENTLY idx_activities_team_start 
    ON activities(team_id, start_time DESC);
  `;
  
  await prisma.$executeRaw`
    CREATE INDEX CONCURRENTLY idx_activities_user_start 
    ON activities(user_id, start_time DESC);
  `;
  
  // Continue with other indexes...
}

export async function down() {
  const prisma = new PrismaClient();
  
  await prisma.$executeRaw`DROP INDEX IF EXISTS idx_activities_team_start;`;
  await prisma.$executeRaw`DROP INDEX IF EXISTS idx_activities_user_start;`;
  // Continue with other indexes...
}
```

## Monitoring and Alerts

Set up monitoring for:

1. **Slow queries** (>100ms):
   - Log queries exceeding threshold
   - Alert on repeated slow queries

2. **Missing index indicators**:
   - Sequential scans on large tables
   - High CPU usage during queries

3. **Index health**:
   - Bloat percentage >30%
   - Unused indexes after 30 days

## Next Steps

1. Implement indexes in order of query frequency
2. Test performance impact in staging environment
3. Create runbook for index maintenance procedures
4. Set up monitoring dashboards for index performance