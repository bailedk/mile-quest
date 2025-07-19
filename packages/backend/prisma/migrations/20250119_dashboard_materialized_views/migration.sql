-- DB-008: Dashboard query optimization with materialized views
-- Migration: Create materialized views for dashboard data aggregation

-- 1. Materialized view for user activity statistics
-- This aggregates all user activity data for quick dashboard access
CREATE MATERIALIZED VIEW mv_user_activity_stats AS
SELECT 
    u.id as user_id,
    COALESCE(SUM(a.distance), 0) as total_distance,
    COUNT(a.id) as total_activities,
    COALESCE(SUM(a.duration), 0) as total_duration,
    MAX(a.distance) as best_distance,
    MAX(a."startTime") as last_activity_date,
    -- Weekly stats (last 7 days)
    COALESCE(SUM(CASE WHEN a."startTime" >= NOW() - INTERVAL '7 days' THEN a.distance ELSE 0 END), 0) as week_distance,
    COUNT(CASE WHEN a."startTime" >= NOW() - INTERVAL '7 days' THEN a.id END) as week_activities,
    -- Monthly stats (last 30 days)
    COALESCE(SUM(CASE WHEN a."startTime" >= NOW() - INTERVAL '30 days' THEN a.distance ELSE 0 END), 0) as month_distance,
    COUNT(CASE WHEN a."startTime" >= NOW() - INTERVAL '30 days' THEN a.id END) as month_activities,
    -- Public activity stats (for leaderboards)
    COALESCE(SUM(CASE WHEN a."isPrivate" = false THEN a.distance ELSE 0 END), 0) as public_total_distance,
    COUNT(CASE WHEN a."isPrivate" = false THEN a.id END) as public_total_activities,
    COALESCE(AVG(CASE WHEN a."isPrivate" = false THEN a.distance END), 0) as public_avg_distance,
    -- Check if user has any private activities
    EXISTS(SELECT 1 FROM activities WHERE "userId" = u.id AND "isPrivate" = true) as has_private_activities,
    NOW() as last_updated
FROM users u
LEFT JOIN activities a ON a."userId" = u.id 
    AND u."deletedAt" IS NULL
    AND a."startTime" >= '2024-01-01'  -- Project start date
WHERE u."deletedAt" IS NULL
GROUP BY u.id;

-- Index for fast user lookups
CREATE UNIQUE INDEX mv_user_activity_stats_user_id_idx ON mv_user_activity_stats (user_id);
CREATE INDEX mv_user_activity_stats_public_distance_idx ON mv_user_activity_stats (public_total_distance DESC);
CREATE INDEX mv_user_activity_stats_total_distance_idx ON mv_user_activity_stats (total_distance DESC);

-- 2. Materialized view for team activity aggregations
-- This aggregates team-level activity data including member contributions
CREATE MATERIALIZED VIEW mv_team_activity_stats AS
SELECT 
    t.id as team_id,
    t.name as team_name,
    COUNT(DISTINCT tm."userId") as active_member_count,
    -- Total team stats (including private activities for team goals)
    COALESCE(SUM(a.distance), 0) as total_distance,
    COUNT(a.id) as total_activities,
    COALESCE(SUM(a.duration), 0) as total_duration,
    -- Public stats only (for public leaderboards)
    COALESCE(SUM(CASE WHEN a."isPrivate" = false THEN a.distance ELSE 0 END), 0) as public_total_distance,
    COUNT(CASE WHEN a."isPrivate" = false THEN a.id END) as public_total_activities,
    -- Recent activity
    MAX(a."startTime") as last_activity_date,
    -- Weekly stats
    COALESCE(SUM(CASE WHEN a."startTime" >= NOW() - INTERVAL '7 days' THEN a.distance ELSE 0 END), 0) as week_distance,
    COUNT(CASE WHEN a."startTime" >= NOW() - INTERVAL '7 days' THEN a.id END) as week_activities,
    -- Monthly stats
    COALESCE(SUM(CASE WHEN a."startTime" >= NOW() - INTERVAL '30 days' THEN a.distance ELSE 0 END), 0) as month_distance,
    COUNT(CASE WHEN a."startTime" >= NOW() - INTERVAL '30 days' THEN a.id END) as month_activities,
    NOW() as last_updated
FROM teams t
LEFT JOIN team_members tm ON tm."teamId" = t.id AND tm."leftAt" IS NULL
LEFT JOIN activities a ON a."teamId" = t.id AND a."userId" = tm."userId"
WHERE t."deletedAt" IS NULL
GROUP BY t.id, t.name;

-- Index for fast team lookups
CREATE UNIQUE INDEX mv_team_activity_stats_team_id_idx ON mv_team_activity_stats (team_id);
CREATE INDEX mv_team_activity_stats_total_distance_idx ON mv_team_activity_stats (total_distance DESC);
CREATE INDEX mv_team_activity_stats_public_distance_idx ON mv_team_activity_stats (public_total_distance DESC);

-- 3. Materialized view for team member leaderboards
-- This pre-computes leaderboard rankings within each team
CREATE MATERIALIZED VIEW mv_team_member_leaderboard AS
SELECT 
    tm."teamId" as team_id,
    tm."userId" as user_id,
    u.name as user_name,
    u."avatarUrl" as user_avatar,
    tm.role as team_role,
    -- Total stats (including private activities for team totals)
    COALESCE(SUM(a.distance), 0) as total_distance,
    COUNT(a.id) as total_activities,
    COALESCE(AVG(a.distance), 0) as avg_distance,
    -- Public stats (for public leaderboards)
    COALESCE(SUM(CASE WHEN a."isPrivate" = false THEN a.distance ELSE 0 END), 0) as public_distance,
    COUNT(CASE WHEN a."isPrivate" = false THEN a.id END) as public_activities,
    COALESCE(AVG(CASE WHEN a."isPrivate" = false THEN a.distance END), 0) as public_avg_distance,
    -- Check if user has private activities in this team
    EXISTS(
        SELECT 1 FROM activities 
        WHERE "userId" = tm."userId" 
        AND "teamId" = tm."teamId" 
        AND "isPrivate" = true
    ) as has_private_activities,
    -- Recent activity
    MAX(CASE WHEN a."isPrivate" = false THEN a."startTime" END) as last_public_activity,
    MAX(a."startTime") as last_activity,
    -- Weekly and monthly stats
    COALESCE(SUM(CASE WHEN a."startTime" >= NOW() - INTERVAL '7 days' THEN a.distance ELSE 0 END), 0) as week_distance,
    COALESCE(SUM(CASE WHEN a."startTime" >= NOW() - INTERVAL '30 days' THEN a.distance ELSE 0 END), 0) as month_distance,
    COALESCE(SUM(CASE WHEN a."startTime" >= NOW() - INTERVAL '7 days' AND a."isPrivate" = false THEN a.distance ELSE 0 END), 0) as week_public_distance,
    COALESCE(SUM(CASE WHEN a."startTime" >= NOW() - INTERVAL '30 days' AND a."isPrivate" = false THEN a.distance ELSE 0 END), 0) as month_public_distance,
    -- Rankings (will be computed in separate view)
    ROW_NUMBER() OVER (PARTITION BY tm."teamId" ORDER BY COALESCE(SUM(CASE WHEN a."isPrivate" = false THEN a.distance ELSE 0 END), 0) DESC, u.name ASC) as public_rank,
    ROW_NUMBER() OVER (PARTITION BY tm."teamId" ORDER BY COALESCE(SUM(a.distance), 0) DESC, u.name ASC) as total_rank,
    NOW() as last_updated
FROM team_members tm
INNER JOIN users u ON u.id = tm."userId"
LEFT JOIN activities a ON a."userId" = tm."userId" AND a."teamId" = tm."teamId"
WHERE tm."leftAt" IS NULL 
    AND u."deletedAt" IS NULL
GROUP BY tm."teamId", tm."userId", u.name, u."avatarUrl", tm.role;

-- Indexes for fast team member lookups
CREATE UNIQUE INDEX mv_team_member_leaderboard_team_user_idx ON mv_team_member_leaderboard (team_id, user_id);
CREATE INDEX mv_team_member_leaderboard_team_public_rank_idx ON mv_team_member_leaderboard (team_id, public_rank);
CREATE INDEX mv_team_member_leaderboard_team_total_rank_idx ON mv_team_member_leaderboard (team_id, total_rank);
CREATE INDEX mv_team_member_leaderboard_user_id_idx ON mv_team_member_leaderboard (user_id);

-- 4. Materialized view for global leaderboard (public activities only)
CREATE MATERIALIZED VIEW mv_global_leaderboard AS
SELECT 
    u.id as user_id,
    u.name as user_name,
    u."avatarUrl" as user_avatar,
    -- Public stats only
    COALESCE(SUM(CASE WHEN a."isPrivate" = false THEN a.distance ELSE 0 END), 0) as total_distance,
    COUNT(CASE WHEN a."isPrivate" = false THEN a.id END) as total_activities,
    COALESCE(AVG(CASE WHEN a."isPrivate" = false THEN a.distance END), 0) as avg_distance,
    -- Check if user has private activities
    EXISTS(SELECT 1 FROM activities WHERE "userId" = u.id AND "isPrivate" = true) as has_private_activities,
    -- Recent public activity
    MAX(CASE WHEN a."isPrivate" = false THEN a."startTime" END) as last_activity,
    -- Time period stats (public only)
    COALESCE(SUM(CASE WHEN a."startTime" >= NOW() - INTERVAL '7 days' AND a."isPrivate" = false THEN a.distance ELSE 0 END), 0) as week_distance,
    COALESCE(SUM(CASE WHEN a."startTime" >= NOW() - INTERVAL '30 days' AND a."isPrivate" = false THEN a.distance ELSE 0 END), 0) as month_distance,
    COUNT(CASE WHEN a."startTime" >= NOW() - INTERVAL '7 days' AND a."isPrivate" = false THEN a.id END) as week_activities,
    COUNT(CASE WHEN a."startTime" >= NOW() - INTERVAL '30 days' AND a."isPrivate" = false THEN a.id END) as month_activities,
    -- Global ranking
    ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(CASE WHEN a."isPrivate" = false THEN a.distance ELSE 0 END), 0) DESC, u.name ASC) as global_rank,
    ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(CASE WHEN a."startTime" >= NOW() - INTERVAL '7 days' AND a."isPrivate" = false THEN a.distance ELSE 0 END), 0) DESC, u.name ASC) as week_rank,
    ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(CASE WHEN a."startTime" >= NOW() - INTERVAL '30 days' AND a."isPrivate" = false THEN a.distance ELSE 0 END), 0) DESC, u.name ASC) as month_rank,
    NOW() as last_updated
FROM users u
LEFT JOIN activities a ON a."userId" = u.id
WHERE u."deletedAt" IS NULL
    AND EXISTS(
        SELECT 1 FROM activities 
        WHERE "userId" = u.id 
        AND "isPrivate" = false
    )  -- Only include users with at least one public activity
GROUP BY u.id, u.name, u."avatarUrl";

-- Indexes for fast global leaderboard queries
CREATE UNIQUE INDEX mv_global_leaderboard_user_id_idx ON mv_global_leaderboard (user_id);
CREATE INDEX mv_global_leaderboard_global_rank_idx ON mv_global_leaderboard (global_rank);
CREATE INDEX mv_global_leaderboard_week_rank_idx ON mv_global_leaderboard (week_rank);
CREATE INDEX mv_global_leaderboard_month_rank_idx ON mv_global_leaderboard (month_rank);
CREATE INDEX mv_global_leaderboard_total_distance_idx ON mv_global_leaderboard (total_distance DESC);

-- 5. Materialized view for team goal progress
CREATE MATERIALIZED VIEW mv_team_goal_progress AS
SELECT 
    tg.id as goal_id,
    tg."teamId" as team_id,
    tg.name as goal_name,
    tg."targetDistance" as target_distance,
    tg.status as goal_status,
    tg."targetDate" as target_date,
    tg."startedAt" as started_at,
    -- Progress calculations (includes all activities - private and public for team goals)
    COALESCE(SUM(a.distance), 0) as current_distance,
    COUNT(a.id) as total_activities,
    COALESCE(SUM(a.duration), 0) as total_duration,
    -- Progress percentage
    CASE 
        WHEN tg."targetDistance" > 0 
        THEN (COALESCE(SUM(a.distance), 0) / tg."targetDistance") * 100 
        ELSE 0 
    END as percent_complete,
    -- Days remaining calculation
    CASE 
        WHEN tg."targetDate" IS NOT NULL 
        THEN EXTRACT(DAYS FROM (tg."targetDate" - NOW()))::INTEGER
        ELSE NULL 
    END as days_remaining,
    -- Recent activity
    MAX(a."startTime") as last_activity_date,
    COUNT(DISTINCT a."userId") as active_members,
    -- On track calculation (rough estimate)
    CASE 
        WHEN tg."targetDate" IS NOT NULL AND tg."startedAt" IS NOT NULL
        THEN 
            CASE 
                WHEN EXTRACT(DAYS FROM (NOW() - tg."startedAt")) = 0 THEN true
                ELSE (COALESCE(SUM(a.distance), 0) / NULLIF(EXTRACT(DAYS FROM (NOW() - tg."startedAt")), 0)) * 
                     EXTRACT(DAYS FROM (tg."targetDate" - tg."startedAt")) >= tg."targetDistance"
            END
        ELSE NULL 
    END as is_on_track,
    NOW() as last_updated
FROM team_goals tg
LEFT JOIN activities a ON a."teamGoalId" = tg.id
WHERE tg."deletedAt" IS NULL
GROUP BY tg.id, tg."teamId", tg.name, tg."targetDistance", tg.status, 
         tg."targetDate", tg."startedAt";

-- Indexes for fast team goal progress queries
CREATE UNIQUE INDEX mv_team_goal_progress_goal_id_idx ON mv_team_goal_progress (goal_id);
CREATE INDEX mv_team_goal_progress_team_id_idx ON mv_team_goal_progress (team_id);
CREATE INDEX mv_team_goal_progress_status_idx ON mv_team_goal_progress (goal_status);
CREATE INDEX mv_team_goal_progress_team_status_idx ON mv_team_goal_progress (team_id, goal_status);

-- 6. Create refresh function for all materialized views
CREATE OR REPLACE FUNCTION refresh_dashboard_materialized_views()
RETURNS void AS $$
BEGIN
    -- Refresh all dashboard materialized views
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_activity_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_team_activity_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_team_member_leaderboard;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_global_leaderboard;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_team_goal_progress;
    
    -- Log refresh
    INSERT INTO mv_refresh_log (view_name, refresh_type, refreshed_at)
    VALUES 
        ('mv_user_activity_stats', 'manual', NOW()),
        ('mv_team_activity_stats', 'manual', NOW()),
        ('mv_team_member_leaderboard', 'manual', NOW()),
        ('mv_global_leaderboard', 'manual', NOW()),
        ('mv_team_goal_progress', 'manual', NOW());
END;
$$ LANGUAGE plpgsql;

-- 7. Create table to track materialized view refreshes
CREATE TABLE mv_refresh_log (
    id SERIAL PRIMARY KEY,
    view_name VARCHAR(100) NOT NULL,
    refresh_type VARCHAR(50) NOT NULL, -- 'manual', 'scheduled', 'trigger'
    refreshed_at TIMESTAMP DEFAULT NOW(),
    duration_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT
);

CREATE INDEX mv_refresh_log_view_time_idx ON mv_refresh_log (view_name, refreshed_at DESC);

-- 8. Create trigger function to refresh materialized views after activity changes
CREATE OR REPLACE FUNCTION trigger_refresh_dashboard_views()
RETURNS trigger AS $$
BEGIN
    -- Schedule a refresh of materialized views
    -- Using pg_notify to trigger background refresh
    PERFORM pg_notify('refresh_dashboard_views', json_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP,
        'timestamp', NOW()
    )::text);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers on tables that affect dashboard data
CREATE TRIGGER activities_dashboard_refresh
    AFTER INSERT OR UPDATE OR DELETE ON activities
    FOR EACH ROW EXECUTE FUNCTION trigger_refresh_dashboard_views();

CREATE TRIGGER team_members_dashboard_refresh
    AFTER INSERT OR UPDATE OR DELETE ON team_members
    FOR EACH ROW EXECUTE FUNCTION trigger_refresh_dashboard_views();

CREATE TRIGGER team_goals_dashboard_refresh
    AFTER INSERT OR UPDATE OR DELETE ON team_goals
    FOR EACH ROW EXECUTE FUNCTION trigger_refresh_dashboard_views();

-- 9. Initial refresh of all materialized views
SELECT refresh_dashboard_materialized_views();

-- 10. Add comments for documentation
COMMENT ON MATERIALIZED VIEW mv_user_activity_stats IS 'Aggregated user activity statistics for dashboard personal stats';
COMMENT ON MATERIALIZED VIEW mv_team_activity_stats IS 'Aggregated team activity statistics for dashboard team summaries';
COMMENT ON MATERIALIZED VIEW mv_team_member_leaderboard IS 'Pre-computed team member rankings and statistics';
COMMENT ON MATERIALIZED VIEW mv_global_leaderboard IS 'Pre-computed global user rankings based on public activities';
COMMENT ON MATERIALIZED VIEW mv_team_goal_progress IS 'Real-time team goal progress tracking and calculations';
COMMENT ON FUNCTION refresh_dashboard_materialized_views() IS 'Refreshes all dashboard materialized views and logs the refresh';
COMMENT ON FUNCTION trigger_refresh_dashboard_views() IS 'Trigger function to notify for materialized view refresh after data changes';