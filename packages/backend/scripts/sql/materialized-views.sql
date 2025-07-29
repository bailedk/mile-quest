-- Mile Quest Materialized Views
-- These views improve dashboard and leaderboard performance

-- Drop existing views if they exist (for development resets)
DROP MATERIALIZED VIEW IF EXISTS mv_user_activity_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_team_activity_stats CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_team_member_leaderboard CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_global_leaderboard CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_team_goal_progress CASCADE;

-- User activity statistics with weekly/monthly breakdowns
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
    EXTRACT(EPOCH FROM NOW() - MAX(a."timestamp"))/86400 as days_since_last_activity,
    -- Best day distance
    COALESCE((
        SELECT MAX(daily_distance) 
        FROM (
            SELECT SUM(distance) as daily_distance 
            FROM activities 
            WHERE "userId" = u.id 
            GROUP BY DATE("timestamp")
        ) daily_totals
    ), 0) as best_distance,
    -- Weekly stats (last 7 days)
    COALESCE(SUM(CASE WHEN a."timestamp" >= NOW() - INTERVAL '7 days' THEN a.distance ELSE 0 END), 0) as week_distance,
    COUNT(DISTINCT CASE WHEN a."timestamp" >= NOW() - INTERVAL '7 days' THEN a.id ELSE NULL END) as week_activities,
    -- Monthly stats (last 30 days)
    COALESCE(SUM(CASE WHEN a."timestamp" >= NOW() - INTERVAL '30 days' THEN a.distance ELSE 0 END), 0) as month_distance,
    COUNT(DISTINCT CASE WHEN a."timestamp" >= NOW() - INTERVAL '30 days' THEN a.id ELSE NULL END) as month_activities,
    -- Public vs private activity flags
    COUNT(DISTINCT a.id) FILTER (WHERE a."isPrivate" = false) as public_total_activities,
    COALESCE(SUM(a.distance) FILTER (WHERE a."isPrivate" = false), 0) as public_total_distance,
    COALESCE(AVG(a.distance) FILTER (WHERE a."isPrivate" = false), 0) as public_avg_distance,
    EXISTS(SELECT 1 FROM activities WHERE "userId" = u.id AND "isPrivate" = true) as has_private_activities
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
    u."avatarUrl" as user_avatar,
    COUNT(DISTINCT a.id) as total_activities,
    COALESCE(SUM(a.distance), 0) as total_distance,
    COALESCE(AVG(a.distance), 0) as avg_distance,
    MAX(a."timestamp") as last_activity,
    -- Weekly and monthly stats
    COALESCE(SUM(CASE WHEN a."timestamp" >= NOW() - INTERVAL '7 days' THEN a.distance ELSE 0 END), 0) as week_distance,
    COALESCE(SUM(CASE WHEN a."timestamp" >= NOW() - INTERVAL '30 days' THEN a.distance ELSE 0 END), 0) as month_distance,
    -- Public stats
    COUNT(DISTINCT a.id) FILTER (WHERE a."isPrivate" = false) as public_activities,
    COALESCE(SUM(a.distance) FILTER (WHERE a."isPrivate" = false), 0) as public_total_distance,
    COALESCE(AVG(a.distance) FILTER (WHERE a."isPrivate" = false), 0) as public_avg_distance,
    EXISTS(SELECT 1 FROM activities WHERE "userId" = u.id AND "isPrivate" = true) as has_private_activities,
    MAX(a."timestamp") FILTER (WHERE a."isPrivate" = false) as last_public_activity,
    -- Rankings
    RANK() OVER (PARTITION BY tm."teamId" ORDER BY SUM(a.distance) FILTER (WHERE a."isPrivate" = false) DESC) as public_rank,
    RANK() OVER (PARTITION BY tm."teamId" ORDER BY SUM(a.distance) DESC) as total_rank,
    -- Weekly/monthly public stats
    COALESCE(SUM(a.distance) FILTER (WHERE a."isPrivate" = false AND a."timestamp" >= NOW() - INTERVAL '7 days'), 0) as week_public_distance,
    COALESCE(SUM(a.distance) FILTER (WHERE a."isPrivate" = false AND a."timestamp" >= NOW() - INTERVAL '30 days'), 0) as month_public_distance
FROM team_members tm
INNER JOIN users u ON tm."userId" = u.id
LEFT JOIN activities a ON u.id = a."userId" AND a."timestamp" >= COALESCE(tm."joinedAt", '1900-01-01')
WHERE tm."leftAt" IS NULL
GROUP BY tm."teamId", tm."userId", u.id, u.name, u."avatarUrl";

CREATE INDEX idx_mv_team_member_leaderboard_team ON mv_team_member_leaderboard(team_id);
CREATE INDEX idx_mv_team_member_leaderboard_user ON mv_team_member_leaderboard(user_id);

-- Global leaderboard
CREATE MATERIALIZED VIEW mv_global_leaderboard AS
SELECT 
    u.id as user_id,
    u.name as user_name,
    u."avatarUrl" as user_avatar,
    uas.total_activities,
    uas.total_distance,
    uas.avg_distance,
    uas.has_private_activities,
    uas.last_activity_date as last_activity,
    uas.week_distance,
    uas.month_distance,
    uas.week_activities,
    uas.month_activities,
    -- Global rankings
    RANK() OVER (ORDER BY uas.total_distance DESC) as global_rank,
    RANK() OVER (ORDER BY uas.week_distance DESC) as week_rank,
    RANK() OVER (ORDER BY uas.month_distance DESC) as month_rank
FROM mv_user_activity_stats uas
INNER JOIN users u ON uas.user_id = u.id
WHERE u."deletedAt" IS NULL;

CREATE INDEX idx_mv_global_leaderboard_user ON mv_global_leaderboard(user_id);
CREATE INDEX idx_mv_global_leaderboard_ranks ON mv_global_leaderboard(global_rank, week_rank, month_rank);

-- Team goal progress
CREATE MATERIALIZED VIEW mv_team_goal_progress AS
SELECT 
    tg.id as goal_id,
    tg."teamId" as team_id,
    tg.name as goal_name,
    tg."targetDistance" as target_distance,
    tg.status as goal_status,
    tg."targetDate" as target_date,
    tg."startDate" as started_at,
    tp."totalDistance" as current_distance,
    tp."totalActivities" as total_activities,
    tp."totalDuration" as total_duration,
    CASE 
        WHEN tg."targetDistance" > 0 
        THEN (tp."totalDistance" / tg."targetDistance" * 100)::numeric(5,2)
        ELSE 0 
    END as percent_complete,
    CASE 
        WHEN tg."targetDate" IS NOT NULL 
        THEN GREATEST(0, EXTRACT(EPOCH FROM (tg."targetDate" - NOW())) / 86400)::int
        ELSE NULL 
    END as days_remaining,
    tp."lastActivityAt" as last_activity_date,
    COUNT(DISTINCT a."userId") as active_members,
    -- Is on track calculation (simplified)
    CASE 
        WHEN tg."targetDate" IS NOT NULL AND tg."targetDistance" > 0 
        THEN tp."totalDistance" >= (
            tg."targetDistance" * 
            (EXTRACT(EPOCH FROM (NOW() - tg."startDate")) / 
             EXTRACT(EPOCH FROM (tg."targetDate" - tg."startDate")))
        )
        ELSE NULL 
    END as is_on_track
FROM team_goals tg
LEFT JOIN team_progress tp ON tg.id = tp."teamGoalId"
LEFT JOIN activities a ON a."teamGoalId" = tg.id
WHERE tg.status = 'ACTIVE'
GROUP BY tg.id, tg."teamId", tg.name, tg."targetDistance", tg."targetDate", 
         tg."startDate", tg.status, tp."totalDistance", tp."totalActivities", 
         tp."totalDuration", tp."lastActivityAt";

CREATE UNIQUE INDEX idx_mv_team_goal_progress_goal ON mv_team_goal_progress(goal_id);
CREATE INDEX idx_mv_team_goal_progress_team ON mv_team_goal_progress(team_id);

-- Refresh function for all materialized views
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_activity_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_team_activity_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_team_member_leaderboard;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_global_leaderboard;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_team_goal_progress;
END;
$$ LANGUAGE plpgsql;