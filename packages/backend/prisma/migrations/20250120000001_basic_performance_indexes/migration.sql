-- Mile Quest Basic Performance Indexes
-- Simplified version focusing on essential indexes only
-- Created: 2025-01-20

-- ========================================
-- CORE INDEXES FOR PERFORMANCE
-- ========================================

-- User indexes
CREATE INDEX "idx_users_email" ON "users"("email");
CREATE INDEX "idx_users_cognito_id" ON "users"("cognitoId");

-- Team indexes
CREATE INDEX "idx_teams_name" ON "teams"("name");
CREATE INDEX "idx_teams_created_at" ON "teams"("createdAt" DESC);

-- Team member indexes (critical for performance)
CREATE INDEX "idx_team_members_user_team" ON "team_members"("userId", "teamId");
CREATE INDEX "idx_team_members_team_user_role" ON "team_members"("teamId", "userId", "role");
CREATE INDEX "idx_team_members_team_role" ON "team_members"("teamId", "role");
CREATE INDEX "idx_team_members_active" ON "team_members"("teamId", "userId") WHERE "leftAt" IS NULL;

-- Activity indexes with privacy support
CREATE INDEX "idx_activities_user_date" ON "activities"("userId", "timestamp" DESC);
CREATE INDEX "idx_activities_user_public_date" ON "activities"("userId", "timestamp" DESC) WHERE "isPrivate" = false;
CREATE INDEX "idx_activities_date_desc" ON "activities"("timestamp" DESC);
CREATE INDEX "idx_activities_user_distance" ON "activities"("userId", "distance" DESC) WHERE "distance" > 0;
CREATE INDEX "idx_activities_public_leaderboard" ON "activities"("timestamp", "distance" DESC) WHERE "isPrivate" = false AND "distance" > 0;

-- Team goal indexes
CREATE INDEX "idx_team_goals_team_status" ON "team_goals"("teamId", "status");
CREATE INDEX "idx_team_goals_active" ON "team_goals"("teamId", "startDate", "endDate") WHERE "status" = 'ACTIVE';
CREATE INDEX "idx_team_goals_dates" ON "team_goals"("startDate", "endDate");

-- Team invites indexes
CREATE INDEX "idx_team_invites_email_status" ON "team_invites"("email", "status");
CREATE INDEX "idx_team_invites_team_status" ON "team_invites"("teamId", "status");
CREATE INDEX "idx_team_invites_pending" ON "team_invites"("email", "teamId") WHERE "status" = 'PENDING';

-- Achievement indexes
CREATE INDEX "idx_achievements_category" ON "achievements"("category");
CREATE INDEX "idx_user_achievements_user_date" ON "user_achievements"("userId", "earnedAt" DESC);
CREATE INDEX "idx_user_achievements_user_achievement" ON "user_achievements"("userId", "achievementId");

-- Notification indexes
CREATE INDEX "idx_notifications_user_status" ON "notifications"("userId", "status", "createdAt" DESC);
CREATE INDEX "idx_notifications_user_unread" ON "notifications"("userId", "createdAt" DESC) WHERE "status" IN ('PENDING', 'DELIVERED');
CREATE INDEX "idx_notification_batch_status" ON "notification_batches"("status", "scheduledFor");

-- ========================================
-- PERFORMANCE MONITORING SETUP
-- ========================================

-- Create extension for monitoring (if not exists)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Performance monitoring views (simplified for compatibility)
CREATE OR REPLACE VIEW v_index_usage AS
SELECT 
    s.schemaname,
    s.relname as tablename,
    s.indexrelname as indexname,
    s.idx_scan,
    s.idx_tup_read,
    s.idx_tup_fetch,
    pg_size_pretty(pg_relation_size(s.indexrelid)) as index_size
FROM pg_stat_user_indexes s
ORDER BY s.idx_scan DESC;

CREATE OR REPLACE VIEW v_table_stats AS
SELECT 
    s.schemaname,
    s.relname as tablename,
    s.n_live_tup as live_rows,
    s.n_dead_tup as dead_rows,
    ROUND(100.0 * s.n_dead_tup / NULLIF(s.n_live_tup + s.n_dead_tup, 0), 2) as dead_percentage,
    s.last_vacuum,
    s.last_autovacuum,
    s.last_analyze,
    s.last_autoanalyze
FROM pg_stat_user_tables s
ORDER BY s.n_live_tup DESC;

-- ========================================
-- UTILITY FUNCTIONS
-- ========================================

-- Function to get table sizes
CREATE OR REPLACE FUNCTION get_table_sizes()
RETURNS TABLE(
    table_name TEXT,
    total_size TEXT,
    table_size TEXT,
    indexes_size TEXT,
    row_estimate BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.schemaname||'.'||s.relname AS table_name,
        pg_size_pretty(pg_total_relation_size(s.schemaname||'.'||s.relname)) AS total_size,
        pg_size_pretty(pg_relation_size(s.schemaname||'.'||s.relname)) AS table_size,
        pg_size_pretty(pg_total_relation_size(s.schemaname||'.'||s.relname) - pg_relation_size(s.schemaname||'.'||s.relname)) AS indexes_size,
        s.n_live_tup AS row_estimate
    FROM pg_stat_user_tables s
    ORDER BY pg_total_relation_size(s.schemaname||'.'||s.relname) DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to check index health
CREATE OR REPLACE FUNCTION check_index_health()
RETURNS TABLE(
    index_name TEXT,
    table_name TEXT,
    index_size TEXT,
    index_scans BIGINT,
    rows_read_per_scan NUMERIC,
    health_status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.indexrelname AS index_name,
        s.relname AS table_name,
        pg_size_pretty(pg_relation_size(s.indexrelid)) AS index_size,
        s.idx_scan AS index_scans,
        CASE 
            WHEN s.idx_scan > 0 THEN ROUND(s.idx_tup_read::NUMERIC / s.idx_scan, 2)
            ELSE 0
        END AS rows_read_per_scan,
        CASE 
            WHEN s.idx_scan = 0 THEN 'UNUSED'
            WHEN s.idx_scan < 100 THEN 'RARELY_USED'
            WHEN s.idx_tup_read::NUMERIC / NULLIF(s.idx_scan, 0) > 1000 THEN 'INEFFICIENT'
            ELSE 'HEALTHY'
        END AS health_status
    FROM pg_stat_user_indexes s
    ORDER BY s.idx_scan DESC;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- COMMENTS FOR DOCUMENTATION
-- ========================================

COMMENT ON FUNCTION get_table_sizes() IS 'Returns current table sizes and row counts for capacity planning';
COMMENT ON FUNCTION check_index_health() IS 'Analyzes index usage and identifies unused or inefficient indexes';