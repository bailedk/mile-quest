-- Mile Quest Materialized Views
-- These views improve dashboard and leaderboard performance

-- Drop existing views if they exist (for development resets)
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

-- Refresh function for development
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW mv_user_activity_stats;
    REFRESH MATERIALIZED VIEW mv_team_activity_stats;
    -- Add other views as needed
END;
$$ LANGUAGE plpgsql;