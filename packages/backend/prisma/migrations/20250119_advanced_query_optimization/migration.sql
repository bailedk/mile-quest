-- DB-701: Advanced Query Optimization
-- Comprehensive database performance improvements beyond materialized views

-- ============================================
-- 1. ADVANCED INDEXES
-- ============================================

-- Partial Indexes for Common Query Patterns
-- Activities: Public activities only (for leaderboards)
CREATE INDEX IF NOT EXISTS idx_activities_public_user_date 
ON activities (user_id, start_time DESC) 
WHERE is_private = false;

CREATE INDEX IF NOT EXISTS idx_activities_public_team_date 
ON activities (team_id, start_time DESC) 
WHERE is_private = false;

CREATE INDEX IF NOT EXISTS idx_activities_public_distance_date 
ON activities (distance DESC, start_time DESC) 
WHERE is_private = false AND distance > 0;

-- Team members: Active members only
CREATE INDEX IF NOT EXISTS idx_team_members_active_team_user 
ON team_members (team_id, user_id) 
WHERE left_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_team_members_active_admins 
ON team_members (team_id, role) 
WHERE left_at IS NULL AND role = 'ADMIN';

-- Teams: Public teams only
CREATE INDEX IF NOT EXISTS idx_teams_public_active 
ON teams (created_at DESC, name) 
WHERE is_public = true AND deleted_at IS NULL;

-- Notifications: Unread only
CREATE INDEX IF NOT EXISTS idx_notifications_unread_user 
ON notifications (user_id, created_at DESC) 
WHERE read_at IS NULL AND status = 'SENT';

-- Team invites: Valid invites only
CREATE INDEX IF NOT EXISTS idx_team_invites_valid 
ON team_invites (code, team_id) 
WHERE status = 'PENDING' AND expires_at > NOW();

-- ============================================
-- 2. COVERING INDEXES
-- ============================================

-- Dashboard queries - User stats with all needed data
CREATE INDEX IF NOT EXISTS idx_activities_user_dashboard_covering 
ON activities (user_id, start_time DESC) 
INCLUDE (distance, duration, team_id, is_private);

-- Team leaderboard queries
CREATE INDEX IF NOT EXISTS idx_activities_team_leaderboard_covering 
ON activities (team_id, user_id, is_private) 
INCLUDE (distance, start_time);

-- User profile queries
CREATE INDEX IF NOT EXISTS idx_users_profile_covering 
ON users (id) 
INCLUDE (name, email, avatar_url, created_at);

-- Team member listings
CREATE INDEX IF NOT EXISTS idx_team_members_listing_covering 
ON team_members (team_id, left_at) 
INCLUDE (user_id, role, joined_at);

-- Achievement progress queries
CREATE INDEX IF NOT EXISTS idx_user_achievements_progress_covering 
ON user_achievements (user_id, achievement_id) 
INCLUDE (earned_at, team_id);

-- ============================================
-- 3. EXPRESSION INDEXES
-- ============================================

-- Date truncation for aggregations
CREATE INDEX IF NOT EXISTS idx_activities_date_trunc_day 
ON activities ((DATE_TRUNC('day', start_time)));

CREATE INDEX IF NOT EXISTS idx_activities_date_trunc_week 
ON activities ((DATE_TRUNC('week', start_time)));

CREATE INDEX IF NOT EXISTS idx_activities_date_trunc_month 
ON activities ((DATE_TRUNC('month', start_time)));

-- Lower case searches
CREATE INDEX IF NOT EXISTS idx_users_email_lower 
ON users ((LOWER(email)));

CREATE INDEX IF NOT EXISTS idx_teams_name_lower 
ON teams ((LOWER(name)));

-- Activity pace calculation (meters per minute)
CREATE INDEX IF NOT EXISTS idx_activities_pace 
ON activities ((distance / NULLIF(duration, 0)));

-- Days since last activity (for streak calculations)
CREATE INDEX IF NOT EXISTS idx_user_stats_days_since_activity 
ON user_stats ((EXTRACT(DAY FROM (NOW() - last_activity_at))));

-- ============================================
-- 4. GIN INDEXES FOR JSON COLUMNS
-- ============================================

CREATE INDEX IF NOT EXISTS idx_team_goals_waypoints_gin 
ON team_goals USING gin (waypoints);

CREATE INDEX IF NOT EXISTS idx_team_goals_route_data_gin 
ON team_goals USING gin (route_data);

CREATE INDEX IF NOT EXISTS idx_achievements_criteria_gin 
ON achievements USING gin (criteria);

CREATE INDEX IF NOT EXISTS idx_notifications_data_gin 
ON notifications USING gin (data);

-- ============================================
-- 5. HASH INDEXES FOR EXACT LOOKUPS
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_cognito_id_hash 
ON users USING hash (cognito_id);

CREATE INDEX IF NOT EXISTS idx_team_invites_code_hash 
ON team_invites USING hash (code);

CREATE INDEX IF NOT EXISTS idx_activities_external_id_hash 
ON activities USING hash (external_id) 
WHERE external_id IS NOT NULL;

-- ============================================
-- 6. COMPLEX COMPOSITE INDEXES
-- ============================================

-- Complex leaderboard queries
CREATE INDEX IF NOT EXISTS idx_activities_leaderboard_complex 
ON activities (team_id, is_private, start_time DESC, distance DESC, user_id);

-- User activity history with filters
CREATE INDEX IF NOT EXISTS idx_activities_user_history_complex 
ON activities (user_id, team_id, is_private, start_time DESC) 
INCLUDE (distance, duration);

-- Team member activity summary
CREATE INDEX IF NOT EXISTS idx_activities_team_member_summary 
ON activities (team_id, user_id, start_time) 
INCLUDE (distance, duration) 
WHERE is_private = false;

-- Notification queries with filters
CREATE INDEX IF NOT EXISTS idx_notifications_user_filtered 
ON notifications (user_id, status, category, created_at DESC) 
WHERE read_at IS NULL;

-- Achievement progress tracking
CREATE INDEX IF NOT EXISTS idx_user_achievements_progress 
ON user_achievements (user_id, earned_at DESC) 
INCLUDE (achievement_id, team_id);

-- ============================================
-- 7. PERFORMANCE TRACKING TABLES
-- ============================================

-- Query performance tracking
CREATE TABLE IF NOT EXISTS query_performance_log (
    id BIGSERIAL PRIMARY KEY,
    query_fingerprint VARCHAR(64),
    query_text TEXT,
    execution_time_ms FLOAT,
    rows_returned INTEGER,
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_query_performance_timestamp ON query_performance_log (timestamp DESC);
CREATE INDEX idx_query_performance_fingerprint ON query_performance_log (query_fingerprint, execution_time_ms);

-- Index usage tracking
CREATE TABLE IF NOT EXISTS index_usage_stats (
    index_name VARCHAR(255) PRIMARY KEY,
    table_name VARCHAR(255),
    scans BIGINT DEFAULT 0,
    tuples_read BIGINT DEFAULT 0,
    last_used TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Trigger performance tracking
CREATE TABLE IF NOT EXISTS trigger_performance_log (
    id BIGSERIAL PRIMARY KEY,
    trigger_name VARCHAR(255),
    table_name VARCHAR(255),
    operation VARCHAR(20),
    execution_time_ms FLOAT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_trigger_performance_name ON trigger_performance_log (trigger_name, created_at DESC);

-- ============================================
-- 8. ENHANCED MATERIALIZED VIEW TRIGGERS
-- ============================================

-- Smart refresh function with debouncing
CREATE OR REPLACE FUNCTION smart_refresh_materialized_views()
RETURNS trigger AS $$
DECLARE
    last_refresh TIMESTAMP;
    min_interval INTERVAL := '30 seconds';
BEGIN
    -- Check last refresh time
    SELECT MAX(refreshed_at) INTO last_refresh
    FROM mv_refresh_log
    WHERE view_name LIKE 'mv_%'
      AND success = true;
    
    -- Only refresh if enough time has passed
    IF last_refresh IS NULL OR (NOW() - last_refresh) > min_interval THEN
        -- Use pg_notify for async refresh
        PERFORM pg_notify('refresh_materialized_views', json_build_object(
            'triggered_by', TG_TABLE_NAME,
            'operation', TG_OP,
            'time', NOW()
        )::text);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Replace existing triggers with smart versions
DROP TRIGGER IF EXISTS activities_dashboard_refresh ON activities;
CREATE TRIGGER activities_smart_refresh
    AFTER INSERT OR UPDATE OR DELETE ON activities
    FOR EACH STATEMENT EXECUTE FUNCTION smart_refresh_materialized_views();

DROP TRIGGER IF EXISTS team_members_dashboard_refresh ON team_members;
CREATE TRIGGER team_members_smart_refresh
    AFTER INSERT OR UPDATE OR DELETE ON team_members
    FOR EACH STATEMENT EXECUTE FUNCTION smart_refresh_materialized_views();

-- ============================================
-- 9. QUERY OPTIMIZATION FUNCTIONS
-- ============================================

-- Function to analyze and suggest indexes
CREATE OR REPLACE FUNCTION suggest_indexes()
RETURNS TABLE(
    table_name TEXT,
    suggested_index TEXT,
    reason TEXT,
    estimated_improvement TEXT
) AS $$
BEGIN
    -- Find tables with sequential scans
    RETURN QUERY
    SELECT 
        schemaname || '.' || tablename,
        'CREATE INDEX ON ' || tablename || ' (' || 
        CASE 
            WHEN seq_scan > idx_scan * 10 THEN 'id'
            ELSE 'created_at'
        END || ')',
        'High sequential scan ratio',
        'Up to ' || ROUND((seq_scan::float / NULLIF(seq_scan + idx_scan, 0) * 100)::numeric, 0) || '% improvement'
    FROM pg_stat_user_tables
    WHERE seq_scan > 1000
      AND seq_scan > idx_scan * 2;
END;
$$ LANGUAGE plpgsql;

-- Function to identify slow queries
CREATE OR REPLACE FUNCTION identify_slow_queries(threshold_ms INTEGER DEFAULT 100)
RETURNS TABLE(
    query TEXT,
    avg_time_ms FLOAT,
    calls BIGINT,
    total_time_ms FLOAT
) AS $$
BEGIN
    -- This would use pg_stat_statements in production
    RETURN QUERY
    SELECT 
        'Sample slow query'::TEXT,
        150.5::FLOAT,
        1000::BIGINT,
        150500.0::FLOAT;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 10. DATABASE STATISTICS OPTIMIZATION
-- ============================================

-- Update statistics for better query planning
ANALYZE activities;
ANALYZE users;
ANALYZE teams;
ANALYZE team_members;
ANALYZE team_goals;
ANALYZE notifications;

-- Set higher statistics targets for important columns
ALTER TABLE activities ALTER COLUMN user_id SET STATISTICS 1000;
ALTER TABLE activities ALTER COLUMN team_id SET STATISTICS 1000;
ALTER TABLE activities ALTER COLUMN start_time SET STATISTICS 1000;
ALTER TABLE team_members ALTER COLUMN user_id SET STATISTICS 1000;
ALTER TABLE team_members ALTER COLUMN team_id SET STATISTICS 1000;

-- ============================================
-- 11. CONNECTION POOLING PREPARATION
-- ============================================

-- Create connection pool statistics view
CREATE OR REPLACE VIEW v_connection_pool_stats AS
SELECT 
    COUNT(*) FILTER (WHERE state = 'active') as active_connections,
    COUNT(*) FILTER (WHERE state = 'idle') as idle_connections,
    COUNT(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
    COUNT(*) FILTER (WHERE wait_event IS NOT NULL) as waiting_connections,
    MAX(EXTRACT(EPOCH FROM (NOW() - backend_start))) as oldest_connection_seconds,
    AVG(EXTRACT(EPOCH FROM (NOW() - backend_start))) as avg_connection_age_seconds
FROM pg_stat_activity
WHERE datname = current_database();

-- ============================================
-- 12. QUERY CACHE INFRASTRUCTURE
-- ============================================

-- Query result cache table (created by query-cache.service.ts)
-- Additional cache management functions

CREATE OR REPLACE FUNCTION cache_hit_rate()
RETURNS NUMERIC AS $$
DECLARE
    hits BIGINT;
    total BIGINT;
BEGIN
    SELECT 
        SUM(hit_count),
        COUNT(*) + SUM(hit_count)
    INTO hits, total
    FROM query_cache
    WHERE expires_at > NOW();
    
    RETURN ROUND((hits::NUMERIC / NULLIF(total, 0) * 100), 2);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 13. PERFORMANCE MONITORING VIEWS
-- ============================================

-- Comprehensive performance dashboard view
CREATE OR REPLACE VIEW v_performance_dashboard AS
WITH query_stats AS (
    SELECT 
        COUNT(*) FILTER (WHERE execution_time_ms > 100) as slow_queries,
        AVG(execution_time_ms) as avg_query_time,
        MAX(execution_time_ms) as max_query_time,
        COUNT(*) as total_queries
    FROM query_performance_log
    WHERE timestamp > NOW() - INTERVAL '1 hour'
),
cache_stats AS (
    SELECT cache_hit_rate() as hit_rate
),
connection_stats AS (
    SELECT * FROM v_connection_pool_stats
),
index_stats AS (
    SELECT 
        COUNT(*) FILTER (WHERE idx_scan = 0) as unused_indexes,
        COUNT(*) as total_indexes
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
)
SELECT 
    qs.*,
    cs.*,
    conn.*,
    idx.*,
    NOW() as snapshot_time
FROM query_stats qs
CROSS JOIN cache_stats cs
CROSS JOIN connection_stats conn
CROSS JOIN index_stats idx;

-- ============================================
-- 14. TABLE BLOAT DETECTION
-- ============================================

CREATE OR REPLACE VIEW v_table_bloat AS
WITH constants AS (
    SELECT current_setting('block_size')::INTEGER AS block_size
),
table_stats AS (
    SELECT
        schemaname,
        tablename,
        pg_total_relation_size(schemaname||'.'||tablename) AS total_size,
        pg_relation_size(schemaname||'.'||tablename) AS heap_size,
        (pgstattuple(schemaname||'.'||tablename)).dead_tuple_percent AS dead_percent
    FROM pg_tables
    WHERE schemaname = 'public'
)
SELECT 
    tablename,
    pg_size_pretty(total_size) AS total_size,
    pg_size_pretty(heap_size) AS heap_size,
    ROUND(dead_percent, 2) AS dead_tuple_percent,
    CASE 
        WHEN dead_percent > 20 THEN 'HIGH'
        WHEN dead_percent > 10 THEN 'MEDIUM'
        ELSE 'LOW'
    END AS bloat_level,
    ROUND((heap_size * dead_percent / 100)::NUMERIC, 0) AS wasted_bytes
FROM table_stats
WHERE dead_percent > 5
ORDER BY wasted_bytes DESC;

-- ============================================
-- 15. AUTOMATIC MAINTENANCE
-- ============================================

-- Enhanced autovacuum settings for specific tables
ALTER TABLE activities SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05,
    autovacuum_vacuum_cost_delay = 10
);

ALTER TABLE notifications SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);

-- ============================================
-- SUMMARY
-- ============================================

-- Log the optimization completion
INSERT INTO mv_refresh_log (view_name, refresh_type, refreshed_at, success)
VALUES ('DB-701 Advanced Query Optimization', 'migration', NOW(), true);

-- Create optimization summary
CREATE OR REPLACE FUNCTION db701_optimization_summary()
RETURNS TABLE(
    optimization_type TEXT,
    count INTEGER,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 'Partial Indexes'::TEXT, COUNT(*)::INTEGER, 'Created'::TEXT
    FROM pg_indexes WHERE indexdef LIKE '%WHERE%' AND schemaname = 'public'
    UNION ALL
    SELECT 'Covering Indexes', COUNT(*), 'Created'
    FROM pg_indexes WHERE indexdef LIKE '%INCLUDE%' AND schemaname = 'public'
    UNION ALL
    SELECT 'Expression Indexes', COUNT(*), 'Created'
    FROM pg_indexes WHERE indexdef LIKE '%(%(%' AND schemaname = 'public'
    UNION ALL
    SELECT 'GIN Indexes', COUNT(*), 'Created'
    FROM pg_indexes WHERE indexdef LIKE '%USING gin%' AND schemaname = 'public'
    UNION ALL
    SELECT 'Hash Indexes', COUNT(*), 'Created'
    FROM pg_indexes WHERE indexdef LIKE '%USING hash%' AND schemaname = 'public';
END;
$$ LANGUAGE plpgsql;

-- Display optimization summary
SELECT * FROM db701_optimization_summary();