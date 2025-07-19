-- Activity aggregation views for optimized queries
-- Run this after applying Prisma migrations

-- View for user activity statistics
CREATE OR REPLACE VIEW user_activity_stats AS
SELECT 
    a."userId",
    u.name as "userName",
    u."avatarUrl" as "userAvatarUrl",
    COUNT(DISTINCT a.id) as "totalActivities",
    COALESCE(SUM(a.distance), 0) as "totalDistance",
    COALESCE(SUM(a.duration), 0) as "totalDuration",
    COALESCE(AVG(a.distance), 0) as "avgDistance",
    COALESCE(AVG(a.duration), 0) as "avgDuration",
    COALESCE(AVG(CASE WHEN a.distance > 0 THEN (a.duration::float / 60) / (a.distance / 1000) END), 0) as "avgPace",
    MAX(a."startTime") as "lastActivityDate",
    COUNT(DISTINCT DATE(a."startTime")) as "activeDays"
FROM activities a
INNER JOIN users u ON a."userId" = u.id
WHERE u."deletedAt" IS NULL
GROUP BY a."userId", u.name, u."avatarUrl";

-- View for team activity statistics
CREATE OR REPLACE VIEW team_activity_stats AS
SELECT 
    a."teamId",
    t.name as "teamName",
    COUNT(DISTINCT a.id) as "totalActivities",
    COUNT(DISTINCT a."userId") as "activeMembers",
    COALESCE(SUM(a.distance), 0) as "totalDistance",
    COALESCE(SUM(a.duration), 0) as "totalDuration",
    COALESCE(AVG(a.distance), 0) as "avgDistance",
    COALESCE(AVG(a.duration), 0) as "avgDuration",
    MAX(a."startTime") as "lastActivityDate",
    COUNT(DISTINCT DATE(a."startTime")) as "activeDays"
FROM activities a
INNER JOIN teams t ON a."teamId" = t.id
WHERE t."deletedAt" IS NULL
GROUP BY a."teamId", t.name;

-- View for weekly activity summaries
CREATE OR REPLACE VIEW weekly_activity_summary AS
SELECT 
    a."userId",
    a."teamId",
    DATE_TRUNC('week', a."startTime") as "weekStart",
    COUNT(a.id) as "activityCount",
    COALESCE(SUM(a.distance), 0) as "totalDistance",
    COALESCE(SUM(a.duration), 0) as "totalDuration",
    COUNT(DISTINCT DATE(a."startTime")) as "activeDays"
FROM activities a
GROUP BY a."userId", a."teamId", DATE_TRUNC('week', a."startTime");

-- View for monthly activity summaries
CREATE OR REPLACE VIEW monthly_activity_summary AS
SELECT 
    a."userId",
    a."teamId",
    DATE_TRUNC('month', a."startTime") as "monthStart",
    COUNT(a.id) as "activityCount",
    COALESCE(SUM(a.distance), 0) as "totalDistance",
    COALESCE(SUM(a.duration), 0) as "totalDuration",
    COUNT(DISTINCT DATE(a."startTime")) as "activeDays"
FROM activities a
GROUP BY a."userId", a."teamId", DATE_TRUNC('month', a."startTime");

-- Materialized view for real-time leaderboards (refresh periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS team_leaderboard AS
SELECT 
    a."teamId",
    a."userId",
    u.name as "userName",
    u."avatarUrl" as "userAvatarUrl",
    COUNT(a.id) as "activityCount",
    COALESCE(SUM(a.distance), 0) as "totalDistance",
    COALESCE(SUM(a.duration), 0) as "totalDuration",
    COALESCE(AVG(CASE WHEN a.distance > 0 THEN (a.duration::float / 60) / (a.distance / 1000) END), 0) as "avgPace",
    MAX(a."startTime") as "lastActivityDate",
    RANK() OVER (PARTITION BY a."teamId" ORDER BY SUM(a.distance) DESC) as "distanceRank",
    RANK() OVER (PARTITION BY a."teamId" ORDER BY COUNT(a.id) DESC) as "activityRank"
FROM activities a
INNER JOIN users u ON a."userId" = u.id
WHERE a."isPrivate" = false
    AND u."deletedAt" IS NULL
GROUP BY a."teamId", a."userId", u.name, u."avatarUrl";

-- Create indexes on the materialized view
CREATE INDEX idx_team_leaderboard_team_rank ON team_leaderboard("teamId", "distanceRank");
CREATE INDEX idx_team_leaderboard_user ON team_leaderboard("userId");

-- Function to refresh leaderboard (call periodically or after significant updates)
CREATE OR REPLACE FUNCTION refresh_team_leaderboard()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY team_leaderboard;
END;
$$ LANGUAGE plpgsql;

-- View for goal progress with activity stats
CREATE OR REPLACE VIEW goal_progress_stats AS
SELECT 
    tg.id as "goalId",
    tg."teamId",
    tg.name as "goalName",
    tg."targetDistance",
    tg."targetDate",
    tg.status,
    tp."totalDistance" as "currentDistance",
    tp."totalActivities",
    tp."totalDuration",
    CASE 
        WHEN tg."targetDistance" > 0 
        THEN (tp."totalDistance" / tg."targetDistance" * 100)
        ELSE 0 
    END as "percentComplete",
    tp."lastActivityAt",
    COUNT(DISTINCT a."userId") as "contributingMembers",
    tg."targetDate" - CURRENT_DATE as "daysRemaining"
FROM team_goals tg
LEFT JOIN team_progress tp ON tg.id = tp."teamGoalId"
LEFT JOIN activities a ON a."teamGoalId" = tg.id
WHERE tg.status = 'ACTIVE'
GROUP BY tg.id, tg."teamId", tg.name, tg."targetDistance", tg."targetDate", 
         tg.status, tp."totalDistance", tp."totalActivities", tp."totalDuration", 
         tp."lastActivityAt";

-- Indexes for view performance
CREATE INDEX IF NOT EXISTS idx_activities_user_start ON activities("userId", "startTime" DESC);
CREATE INDEX IF NOT EXISTS idx_activities_team_start ON activities("teamId", "startTime" DESC);
CREATE INDEX IF NOT EXISTS idx_activities_team_private ON activities("teamId", "isPrivate", "startTime" DESC);
CREATE INDEX IF NOT EXISTS idx_activities_goal ON activities("teamGoalId") WHERE "teamGoalId" IS NOT NULL;