-- DB-702: Production database performance tuning
-- Migration: Additional indexes and optimizations for production-level performance

-- 1. Advanced activity query optimization indexes
-- For large-scale leaderboard queries with complex filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_complex_leaderboard
ON activities (
    "teamId", 
    "isPrivate", 
    "startTime" DESC, 
    "distance" DESC
) WHERE "isPrivate" = false;

-- For user activity history with date range filtering (common dashboard query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_user_date_range
ON activities (
    "userId", 
    "startTime" DESC, 
    "createdAt" DESC
) INCLUDE ("distance", "duration", "isPrivate");

-- For team goal progress tracking with efficient aggregation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_goal_aggregation
ON activities (
    "teamGoalId", 
    "startTime" DESC
) INCLUDE ("distance", "duration", "userId")
WHERE "teamGoalId" IS NOT NULL;

-- For activity source filtering (external integrations)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_source_external
ON activities ("source", "externalId", "userId")
WHERE "source" != 'MANUAL';

-- 2. Team member performance indexes
-- For team member permission checks (very frequent query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_members_permission_check
ON team_members (
    "teamId", 
    "userId", 
    "leftAt", 
    "role"
) WHERE "leftAt" IS NULL;

-- For active member counting with role filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_members_active_stats
ON team_members (
    "teamId", 
    "role", 
    "joinedAt" DESC
) WHERE "leftAt" IS NULL;

-- 3. Team goal optimization indexes
-- For active goal lookups (common in activity creation)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_goals_active_lookup
ON team_goals (
    "teamId", 
    "status", 
    "createdAt" DESC
) WHERE "status" = 'ACTIVE';

-- For goal deadline tracking and reporting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_goals_deadline_tracking
ON team_goals (
    "targetDate", 
    "status", 
    "teamId"
) WHERE "targetDate" IS NOT NULL AND "status" IN ('ACTIVE', 'DRAFT');

-- 4. User stats optimization
-- For user streak calculations and dashboard queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_stats_dashboard
ON user_stats (
    "userId", 
    "lastActivityAt" DESC, 
    "currentStreak" DESC
);

-- 5. Team progress optimization
-- For real-time progress updates
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_progress_realtime
ON team_progress (
    "teamGoalId", 
    "lastActivityAt" DESC, 
    "totalDistance" DESC
);

-- 6. Advanced composite indexes for common query patterns
-- For dashboard team activity feed (shows recent activities across user's teams)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_dashboard_feed
ON activities (
    "teamId", 
    "startTime" DESC, 
    "isPrivate"
) INCLUDE ("userId", "distance", "duration", "notes");

-- For leaderboard ranking calculations with privacy
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_ranking_optimized
ON activities (
    "userId", 
    "isPrivate", 
    "distance" DESC, 
    "startTime" DESC
) WHERE "isPrivate" = false;

-- For time-based leaderboard queries (weekly, monthly)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_time_leaderboard
ON activities (
    date_trunc('week', "startTime"), 
    "isPrivate", 
    "distance" DESC
) WHERE "isPrivate" = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_monthly_leaderboard
ON activities (
    date_trunc('month', "startTime"), 
    "isPrivate", 
    "distance" DESC
) WHERE "isPrivate" = false;

-- 7. Partitioning preparation indexes (for future scaling)
-- Quarterly partitioning support for activities
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_quarterly_partition
ON activities (
    date_trunc('quarter', "startTime"), 
    "teamId", 
    "userId"
);

-- 8. Materialized view refresh optimization
-- Index to speed up materialized view refresh queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_mv_refresh_helper
ON activities (
    "userId", 
    "teamId", 
    "isPrivate", 
    "startTime"
) INCLUDE ("distance", "duration");

-- 9. Statistics collection optimization
-- Enable automatic statistics collection for better query planning
ALTER TABLE activities SET (
    autovacuum_analyze_scale_factor = 0.02,
    autovacuum_analyze_threshold = 1000
);

ALTER TABLE team_members SET (
    autovacuum_analyze_scale_factor = 0.05,
    autovacuum_analyze_threshold = 500
);

-- 10. Query optimization settings for session-level performance
-- These will be applied by the performance service when needed

-- 11. Create performance monitoring views
CREATE OR REPLACE VIEW v_slow_query_analysis AS
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation,
    most_common_vals,
    most_common_freqs
FROM pg_stats 
WHERE schemaname = 'public' 
    AND tablename IN ('activities', 'team_members', 'teams', 'team_goals')
ORDER BY tablename, attname;

-- 12. Create index usage monitoring view
CREATE OR REPLACE VIEW v_index_efficiency AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    CASE 
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 100 THEN 'LOW_USAGE'
        WHEN idx_scan < 1000 THEN 'MODERATE_USAGE'
        ELSE 'HIGH_USAGE'
    END as usage_category,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- 13. Create table bloat monitoring view
CREATE OR REPLACE VIEW v_table_bloat AS
SELECT 
    schemaname,
    tablename,
    ROUND(
        CASE 
            WHEN otta = 0 THEN 0.0 
            ELSE (reltuples/otta) 
        END, 1
    ) AS table_bloat_ratio,
    CASE 
        WHEN relpages < otta THEN 0
        ELSE relpages - otta 
    END AS bloat_pages,
    pg_size_pretty(
        CASE 
            WHEN relpages < otta THEN 0 
            ELSE (relpages - otta) * 8192 
        END
    ) AS bloat_size
FROM (
    SELECT 
        schemaname, 
        tablename, 
        reltuples, 
        relpages, 
        CEIL(
            (
                reltuples * 
                (
                    4 + 
                    CASE WHEN data_width > 0 THEN data_width ELSE 24 END
                )
            ) / 8192
        ) AS otta
    FROM (
        SELECT 
            schemaname,
            tablename,
            reltuples,
            relpages,
            AVG(width) AS data_width
        FROM pg_stats
        WHERE schemaname = 'public'
            AND tablename IN ('activities', 'team_members', 'teams', 'team_goals')
        GROUP BY schemaname, tablename, reltuples, relpages
    ) AS subq
) AS bloat_analysis
WHERE schemaname = 'public'
ORDER BY bloat_pages DESC;

-- 14. Performance monitoring function
CREATE OR REPLACE FUNCTION get_performance_metrics()
RETURNS TABLE (
    metric_name TEXT,
    metric_value NUMERIC,
    metric_unit TEXT,
    measurement_time TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'index_hit_ratio' as metric_name,
        ROUND(
            (sum(idx_blks_hit) * 100.0 / NULLIF(sum(idx_blks_hit + idx_blks_read), 0))::numeric, 
            2
        ) as metric_value,
        'percentage' as metric_unit,
        NOW() as measurement_time
    FROM pg_statio_user_indexes
    WHERE schemaname = 'public'
    
    UNION ALL
    
    SELECT 
        'table_hit_ratio' as metric_name,
        ROUND(
            (sum(heap_blks_hit) * 100.0 / NULLIF(sum(heap_blks_hit + heap_blks_read), 0))::numeric, 
            2
        ) as metric_value,
        'percentage' as metric_unit,
        NOW() as measurement_time
    FROM pg_statio_user_tables
    WHERE schemaname = 'public'
    
    UNION ALL
    
    SELECT 
        'total_queries' as metric_name,
        sum(n_tup_ins + n_tup_upd + n_tup_del) as metric_value,
        'count' as metric_unit,
        NOW() as measurement_time
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    
    UNION ALL
    
    SELECT 
        'active_connections' as metric_name,
        count(*)::numeric as metric_value,
        'count' as metric_unit,
        NOW() as measurement_time
    FROM pg_stat_activity
    WHERE state = 'active';
END;
$$ LANGUAGE plpgsql;

-- 15. Maintenance procedures
CREATE OR REPLACE FUNCTION maintenance_analyze_tables()
RETURNS void AS $$
BEGIN
    -- Update statistics for critical tables
    ANALYZE activities;
    ANALYZE team_members;
    ANALYZE teams;
    ANALYZE team_goals;
    ANALYZE user_stats;
    ANALYZE team_progress;
    
    -- Log maintenance completion
    INSERT INTO mv_refresh_log (view_name, refresh_type, refreshed_at, success)
    VALUES ('table_statistics', 'maintenance', NOW(), true);
END;
$$ LANGUAGE plpgsql;

-- 16. Query optimization stored procedures
CREATE OR REPLACE FUNCTION optimize_session_for_dashboard()
RETURNS void AS $$
BEGIN
    -- Optimize session settings for dashboard queries
    SET work_mem = '32MB';
    SET maintenance_work_mem = '256MB';
    SET effective_cache_size = '2GB';
    SET random_page_cost = 1.1;
    SET seq_page_cost = 1;
    SET enable_hashjoin = on;
    SET enable_mergejoin = on;
    SET enable_nestloop = off;  -- For large result sets
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION optimize_session_for_leaderboard()
RETURNS void AS $$
BEGIN
    -- Optimize session settings for leaderboard calculations
    SET work_mem = '64MB';
    SET hash_mem_multiplier = 2.0;
    SET enable_hashagg = on;
    SET enable_sort = on;
    SET enable_nestloop = off;
    SET cpu_tuple_cost = 0.01;
END;
$$ LANGUAGE plpgsql;

-- 17. Index maintenance scheduler
CREATE OR REPLACE FUNCTION schedule_index_maintenance()
RETURNS void AS $$
BEGIN
    -- Reindex only when necessary (based on bloat)
    IF EXISTS (
        SELECT 1 FROM v_table_bloat 
        WHERE tablename = 'activities' 
        AND table_bloat_ratio > 2.0
    ) THEN
        REINDEX TABLE activities;
        INSERT INTO mv_refresh_log (view_name, refresh_type, refreshed_at, success)
        VALUES ('activities_reindex', 'maintenance', NOW(), true);
    END IF;
    
    -- Similar checks for other critical tables
    IF EXISTS (
        SELECT 1 FROM v_table_bloat 
        WHERE tablename = 'team_members' 
        AND table_bloat_ratio > 2.0
    ) THEN
        REINDEX TABLE team_members;
        INSERT INTO mv_refresh_log (view_name, refresh_type, refreshed_at, success)
        VALUES ('team_members_reindex', 'maintenance', NOW(), true);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 18. Comments for documentation
COMMENT ON FUNCTION get_performance_metrics() IS 'Returns key performance metrics for database monitoring';
COMMENT ON FUNCTION maintenance_analyze_tables() IS 'Updates table statistics for query optimization';
COMMENT ON FUNCTION optimize_session_for_dashboard() IS 'Optimizes session settings for dashboard queries';
COMMENT ON FUNCTION optimize_session_for_leaderboard() IS 'Optimizes session settings for leaderboard calculations';
COMMENT ON VIEW v_slow_query_analysis IS 'Provides statistics for query optimization analysis';
COMMENT ON VIEW v_index_efficiency IS 'Monitors index usage and efficiency';
COMMENT ON VIEW v_table_bloat IS 'Monitors table bloat for maintenance scheduling';

-- 19. Initial performance baseline
SELECT maintenance_analyze_tables();

-- 20. Log completion
INSERT INTO mv_refresh_log (view_name, refresh_type, refreshed_at, success, duration_ms)
VALUES ('production_performance_tuning', 'migration', NOW(), true, 0);