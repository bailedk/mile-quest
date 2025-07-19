-- DB-008: Additional performance indexes for dashboard queries
-- Migration: Add supplementary indexes for optimized dashboard performance

-- 1. Additional indexes for activity table (dashboard query optimization)
-- These complement existing indexes with specific patterns used by dashboard

-- Index for user activity aggregations with time filtering (used in personal stats)
CREATE INDEX CONCURRENTLY IF NOT EXISTS activities_user_time_stats_idx 
ON activities (
    "userId", 
    "startTime" DESC, 
    "isPrivate"
) 
INCLUDE ("distance", "duration");

-- Index for team activity aggregations (used in team leaderboards)
CREATE INDEX CONCURRENTLY IF NOT EXISTS activities_team_user_stats_idx 
ON activities (
    "teamId", 
    "userId", 
    "isPrivate"
) 
INCLUDE ("distance", "duration", "startTime");

-- Index for recent activities across teams (used in dashboard recent feed)
CREATE INDEX CONCURRENTLY IF NOT EXISTS activities_recent_feed_idx 
ON activities (
    "teamId", 
    "createdAt" DESC,
    "isPrivate"
) 
INCLUDE ("userId", "distance", "duration", "startTime", "notes");

-- Index for goal-specific activity aggregations
CREATE INDEX CONCURRENTLY IF NOT EXISTS activities_goal_aggregation_idx 
ON activities (
    "teamGoalId",
    "startTime" DESC
) 
WHERE "teamGoalId" IS NOT NULL
INCLUDE ("distance", "duration", "userId");

-- 2. Additional indexes for team_members table
-- Index for active team membership lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS team_members_active_membership_idx 
ON team_members (
    "userId",
    "leftAt"
) 
WHERE "leftAt" IS NULL
INCLUDE ("teamId", "role", "joinedAt");

-- Index for team membership counts
CREATE INDEX CONCURRENTLY IF NOT EXISTS team_members_team_count_idx 
ON team_members (
    "teamId",
    "leftAt"
) 
WHERE "leftAt" IS NULL;

-- 3. Additional indexes for teams table
-- Index for public team discovery with activity
CREATE INDEX CONCURRENTLY IF NOT EXISTS teams_public_active_idx 
ON teams (
    "isPublic",
    "createdAt" DESC,
    "deletedAt"
) 
WHERE "deletedAt" IS NULL AND "isPublic" = true
INCLUDE ("name", "description", "avatarUrl", "maxMembers");

-- 4. Additional indexes for team_goals table
-- Index for active goals per team (used in dashboard progress)
CREATE INDEX CONCURRENTLY IF NOT EXISTS team_goals_active_by_team_idx 
ON team_goals (
    "teamId",
    "status",
    "createdAt" DESC
) 
WHERE "status" = 'ACTIVE'
INCLUDE ("name", "targetDistance", "targetDate", "startedAt");

-- Index for goal completion tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS team_goals_completion_tracking_idx 
ON team_goals (
    "status",
    "completedAt" DESC,
    "teamId"
) 
WHERE "completedAt" IS NOT NULL
INCLUDE ("name", "targetDistance", "startedAt");

-- 5. Additional indexes for user_stats table
-- Index for stats lookup and updates
CREATE INDEX CONCURRENTLY IF NOT EXISTS user_stats_lookup_idx 
ON user_stats (
    "userId",
    "updatedAt" DESC
) 
INCLUDE ("totalDistance", "totalActivities", "currentStreak", "lastActivityAt");

-- 6. Additional indexes for team_progress table
-- Index for progress tracking by goal
CREATE INDEX CONCURRENTLY IF NOT EXISTS team_progress_goal_tracking_idx 
ON team_progress (
    "teamGoalId",
    "updatedAt" DESC
) 
INCLUDE ("totalDistance", "totalActivities", "currentSegmentIndex", "lastActivityAt");

-- 7. Partial indexes for common dashboard filters

-- Index for user's own activities (including private)
CREATE INDEX CONCURRENTLY IF NOT EXISTS activities_user_own_idx 
ON activities (
    "userId",
    "startTime" DESC
) 
INCLUDE ("teamId", "distance", "duration", "isPrivate", "notes");

-- Index for public activities only (for leaderboards)
CREATE INDEX CONCURRENTLY IF NOT EXISTS activities_public_only_idx 
ON activities (
    "startTime" DESC,
    "userId"
) 
WHERE "isPrivate" = false
INCLUDE ("teamId", "distance", "duration");

-- Index for private activities (for privacy checks)
CREATE INDEX CONCURRENTLY IF NOT EXISTS activities_private_only_idx 
ON activities (
    "userId",
    "teamId",
    "startTime" DESC
) 
WHERE "isPrivate" = true
INCLUDE ("distance");

-- 8. Expression indexes for common calculations

-- Index for distance ranking calculations
CREATE INDEX CONCURRENTLY IF NOT EXISTS activities_distance_ranking_idx 
ON activities (
    "teamId",
    "distance" DESC,
    "isPrivate"
) 
WHERE "distance" > 0
INCLUDE ("userId", "startTime");

-- Index for activity counts per user/team
CREATE INDEX CONCURRENTLY IF NOT EXISTS activities_count_aggregation_idx 
ON activities (
    "userId",
    "teamId",
    "isPrivate"
) 
INCLUDE ("distance", "duration");

-- 9. Composite indexes for complex dashboard queries

-- Index for team leaderboard with time filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS activities_team_leaderboard_time_idx 
ON activities (
    "teamId",
    "isPrivate",
    "startTime" DESC,
    "userId"
) 
INCLUDE ("distance", "duration");

-- Index for global leaderboard with time filtering  
CREATE INDEX CONCURRENTLY IF NOT EXISTS activities_global_leaderboard_time_idx 
ON activities (
    "isPrivate",
    "startTime" DESC,
    "userId"
) 
WHERE "isPrivate" = false
INCLUDE ("distance", "teamId");

-- Index for user activity timeline
CREATE INDEX CONCURRENTLY IF NOT EXISTS activities_user_timeline_idx 
ON activities (
    "userId",
    "startTime" DESC,
    "isPrivate"
) 
INCLUDE ("teamId", "distance", "duration", "notes");

-- 10. Indexes for materialized view maintenance

-- Index for tracking data changes for materialized view refresh
CREATE INDEX CONCURRENTLY IF NOT EXISTS activities_mv_refresh_tracking_idx 
ON activities (
    "updatedAt" DESC,
    "createdAt" DESC
) 
INCLUDE ("userId", "teamId", "teamGoalId", "distance");

-- Index for team membership changes affecting materialized views
CREATE INDEX CONCURRENTLY IF NOT EXISTS team_members_mv_tracking_idx 
ON team_members (
    "updatedAt" DESC,
    "leftAt"
) 
INCLUDE ("userId", "teamId");

-- 11. Statistics and performance monitoring indexes

-- Index for query performance analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS mv_refresh_log_performance_idx 
ON mv_refresh_log (
    "view_name",
    "refreshed_at" DESC,
    "success"
) 
INCLUDE ("duration_ms", "refresh_type");

-- 12. Add database statistics for better query planning
-- These help PostgreSQL make better decisions about query plans

-- Analyze all tables to update statistics
ANALYZE activities;
ANALYZE teams;
ANALYZE team_members;
ANALYZE team_goals;
ANALYZE team_progress;
ANALYZE users;
ANALYZE user_stats;

-- 13. Create index usage monitoring view
CREATE OR REPLACE VIEW v_index_usage_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan,
    CASE 
        WHEN idx_scan = 0 THEN 'Never used'
        WHEN idx_scan < 100 THEN 'Rarely used'
        WHEN idx_scan < 1000 THEN 'Moderately used'
        ELSE 'Frequently used'
    END as usage_category,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC, pg_relation_size(indexrelid) DESC;

-- 14. Create performance monitoring function
CREATE OR REPLACE FUNCTION get_dashboard_query_performance()
RETURNS TABLE (
    operation text,
    avg_time_ms numeric,
    calls bigint,
    total_time_ms numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'Dashboard Query Performance' as operation,
        0::numeric as avg_time_ms,
        0::bigint as calls,
        0::numeric as total_time_ms
    WHERE false; -- Placeholder - would need pg_stat_statements extension
END;
$$ LANGUAGE plpgsql;

-- 15. Add comments for documentation
COMMENT ON INDEX activities_user_time_stats_idx IS 'Optimizes user activity aggregations with time filtering for personal stats';
COMMENT ON INDEX activities_team_user_stats_idx IS 'Optimizes team leaderboard calculations';
COMMENT ON INDEX activities_recent_feed_idx IS 'Optimizes dashboard recent activity feed queries';
COMMENT ON INDEX activities_goal_aggregation_idx IS 'Optimizes team goal progress calculations';
COMMENT ON INDEX team_members_active_membership_idx IS 'Optimizes active team membership lookups';
COMMENT ON INDEX teams_public_active_idx IS 'Optimizes public team discovery queries';
COMMENT ON INDEX team_goals_active_by_team_idx IS 'Optimizes active goal lookups per team for dashboard';
COMMENT ON INDEX user_stats_lookup_idx IS 'Optimizes user statistics lookups and updates';

-- Log the index creation
INSERT INTO mv_refresh_log (view_name, refresh_type, refreshed_at, success) 
VALUES ('performance_indexes', 'creation', NOW(), true);