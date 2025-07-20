-- Mile Quest Materialized Views
-- Performance optimization through pre-calculated views
-- Created: 2025-01-20

-- ========================================
-- MATERIALIZED VIEWS FOR DASHBOARD PERFORMANCE
-- ========================================

-- Drop existing views if they exist
DROP MATERIALIZED VIEW IF EXISTS mv_user_activity_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_team_activity_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_team_member_leaderboard CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_global_leaderboard CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_team_goal_progress CASCADE;

-- User activity statistics
CREATE MATERIALIZED VIEW mv_user_activity_stats AS
SELECT 
    u.id as user_id,
    u.name as user_name,
    u."avatarUrl" as avatar_url,
    COUNT(DISTINCT a.id) as total_activities,
    COALESCE(SUM(a.distance), 0) as total_distance,
    COALESCE(SUM(a.duration), 0) as total_duration,
    COALESCE(AVG(a.distance), 0) as avg_distance,
    CASE 
        WHEN SUM(a.duration) > 0 THEN (SUM(a.distance) / SUM(a.duration) * 60)::numeric
        ELSE 0 
    END as avg_pace,
    MAX(a."timestamp") as last_activity_date,
    COUNT(DISTINCT DATE(a."timestamp")) as active_days,
    EXTRACT(EPOCH FROM NOW() - MAX(a."timestamp"))/86400 as days_since_last_activity
FROM users u
LEFT JOIN activities a ON u.id = a."userId"
GROUP BY u.id, u.name, u."avatarUrl";

CREATE UNIQUE INDEX idx_mv_user_activity_stats_user_id ON mv_user_activity_stats(user_id);

-- Team activity statistics
CREATE MATERIALIZED VIEW mv_team_activity_stats AS
SELECT 
    t.id as team_id,
    t.name as team_name,
    COUNT(DISTINCT tm."userId") as member_count,
    COUNT(DISTINCT tm."userId") FILTER (WHERE tm.role = 'ADMIN') as admin_count,
    COUNT(DISTINCT a.id) as total_activities,
    COALESCE(SUM(a.distance), 0) as total_distance,
    COALESCE(AVG(a.distance), 0) as avg_distance_per_activity,
    COUNT(DISTINCT a."userId") as active_members,
    MAX(a."timestamp") as last_activity_date
FROM teams t
LEFT JOIN team_members tm ON t.id = tm."teamId" AND tm."leftAt" IS NULL
LEFT JOIN activities a ON tm."userId" = a."userId" 
    AND a."timestamp" >= COALESCE(tm."joinedAt", '1900-01-01')
GROUP BY t.id, t.name;

CREATE UNIQUE INDEX idx_mv_team_activity_stats_team_id ON mv_team_activity_stats(team_id);

-- Team member leaderboard
CREATE MATERIALIZED VIEW mv_team_member_leaderboard AS
SELECT 
    tm."teamId" as team_id,
    tm."userId" as user_id,
    u.name as user_name,
    u."avatarUrl" as avatar_url,
    COUNT(DISTINCT a.id) as activity_count,
    COALESCE(SUM(a.distance), 0) as total_distance,
    CASE 
        WHEN SUM(a.duration) > 0 THEN (SUM(a.distance) / SUM(a.duration) * 60)::numeric
        ELSE 0 
    END as avg_pace,
    MAX(a."timestamp") as last_activity_date,
    RANK() OVER (PARTITION BY tm."teamId" ORDER BY COALESCE(SUM(a.distance), 0) DESC) as team_rank
FROM team_members tm
JOIN users u ON tm."userId" = u.id
LEFT JOIN activities a ON tm."userId" = a."userId" 
    AND a."isPrivate" = false
    AND a."timestamp" >= COALESCE(tm."joinedAt", '1900-01-01')
WHERE tm."leftAt" IS NULL
GROUP BY tm."teamId", tm."userId", u.name, u."avatarUrl";

CREATE UNIQUE INDEX idx_mv_team_member_leaderboard_team_user ON mv_team_member_leaderboard(team_id, user_id);
CREATE INDEX idx_mv_team_member_leaderboard_team_rank ON mv_team_member_leaderboard(team_id, team_rank);

-- Global leaderboard
CREATE MATERIALIZED VIEW mv_global_leaderboard AS
SELECT 
    u.id as user_id,
    u.name as user_name,
    u."avatarUrl" as avatar_url,
    COUNT(DISTINCT a.id) as activity_count,
    COALESCE(SUM(a.distance), 0) as total_distance,
    CASE 
        WHEN SUM(a.duration) > 0 THEN (SUM(a.distance) / SUM(a.duration) * 60)::numeric
        ELSE 0 
    END as avg_pace,
    MAX(a."timestamp") as last_activity_date,
    RANK() OVER (ORDER BY COALESCE(SUM(a.distance), 0) DESC) as global_rank
FROM users u
LEFT JOIN activities a ON u.id = a."userId" AND a."isPrivate" = false
GROUP BY u.id, u.name, u."avatarUrl"
HAVING COUNT(a.id) > 0;

CREATE UNIQUE INDEX idx_mv_global_leaderboard_user_id ON mv_global_leaderboard(user_id);
CREATE INDEX idx_mv_global_leaderboard_rank ON mv_global_leaderboard(global_rank);

-- Team goal progress
CREATE MATERIALIZED VIEW mv_team_goal_progress AS
SELECT 
    tg.id as goal_id,
    tg."teamId" as team_id,
    tg.name as goal_name,
    tg."targetDistance" as target_distance,
    tg.status,
    tg."startDate" as start_date,
    tg."endDate" as end_date,
    COUNT(DISTINCT a."userId") as active_participants,
    COALESCE(SUM(a.distance), 0) as current_distance,
    CASE 
        WHEN tg."targetDistance" > 0 THEN (COALESCE(SUM(a.distance), 0) / tg."targetDistance" * 100)
        ELSE 0 
    END as progress_percentage,
    tg."endDate" - CURRENT_DATE as days_remaining
FROM team_goals tg
LEFT JOIN team_members tm ON tg."teamId" = tm."teamId" AND tm."leftAt" IS NULL
LEFT JOIN activities a ON tm."userId" = a."userId"
    AND a."timestamp" BETWEEN tg."startDate" AND tg."endDate"
WHERE tg.status IN ('ACTIVE', 'COMPLETED')
GROUP BY tg.id, tg."teamId", tg.name, tg."targetDistance", tg.status, tg."startDate", tg."endDate";

CREATE UNIQUE INDEX idx_mv_team_goal_progress_goal_id ON mv_team_goal_progress(goal_id);
CREATE INDEX idx_mv_team_goal_progress_team_status ON mv_team_goal_progress(team_id, status);

-- ========================================
-- REFRESH FUNCTIONS
-- ========================================

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW mv_user_activity_stats;
    REFRESH MATERIALIZED VIEW mv_team_activity_stats;
    REFRESH MATERIALIZED VIEW mv_team_member_leaderboard;
    REFRESH MATERIALIZED VIEW mv_global_leaderboard;
    REFRESH MATERIALIZED VIEW mv_team_goal_progress;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh team-specific views
CREATE OR REPLACE FUNCTION refresh_team_views(p_team_id TEXT)
RETURNS void AS $$
BEGIN
    -- For now, refresh all views since we don't have partial refresh
    -- In future, could implement partial refresh logic
    PERFORM refresh_all_materialized_views();
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- REFRESH LOGGING
-- ========================================

-- Create a simple refresh log table
CREATE TABLE IF NOT EXISTS materialized_view_refresh_log (
    id SERIAL PRIMARY KEY,
    view_name TEXT NOT NULL,
    refreshed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    duration_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT
);

-- Function to log refresh operations
CREATE OR REPLACE FUNCTION log_materialized_view_refresh(
    p_view_name TEXT,
    p_duration_ms INTEGER,
    p_success BOOLEAN DEFAULT true,
    p_error_message TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    INSERT INTO materialized_view_refresh_log (view_name, duration_ms, success, error_message)
    VALUES (p_view_name, p_duration_ms, p_success, p_error_message);
    
    -- Clean up old logs (keep last 30 days)
    DELETE FROM materialized_view_refresh_log
    WHERE refreshed_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- COMMENTS FOR DOCUMENTATION
-- ========================================

COMMENT ON MATERIALIZED VIEW mv_user_activity_stats IS 'Aggregated user activity statistics for dashboard performance';
COMMENT ON MATERIALIZED VIEW mv_team_activity_stats IS 'Aggregated team statistics for quick team overview';
COMMENT ON MATERIALIZED VIEW mv_team_member_leaderboard IS 'Pre-calculated team member rankings excluding private activities';
COMMENT ON MATERIALIZED VIEW mv_global_leaderboard IS 'Global user rankings based on public activities only';
COMMENT ON MATERIALIZED VIEW mv_team_goal_progress IS 'Real-time team goal progress tracking';

COMMENT ON FUNCTION refresh_all_materialized_views() IS 'Refreshes all materialized views - should be called periodically';
COMMENT ON FUNCTION refresh_team_views(TEXT) IS 'Refreshes team-specific views (currently refreshes all views)';