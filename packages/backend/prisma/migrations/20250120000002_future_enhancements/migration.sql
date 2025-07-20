-- Mile Quest Future Enhancements
-- These are planned features that can be uncommented and applied when ready
-- Created: 2025-01-20

-- ========================================
-- ANALYTICS TABLES (Currently commented out)
-- Uncomment when implementing analytics features
-- ========================================

/*
-- User analytics events
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventData" JSONB,
    "sessionId" TEXT,
    "deviceInfo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_analytics_events_user_date" ON "analytics_events"("userId", "createdAt" DESC);
CREATE INDEX "idx_analytics_events_type_date" ON "analytics_events"("eventType", "createdAt" DESC);
CREATE INDEX "idx_analytics_events_session" ON "analytics_events"("sessionId");

-- User sessions
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "deviceInfo" JSONB,
    "ipAddress" TEXT,
    
    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_user_sessions_user_date" ON "user_sessions"("userId", "startedAt" DESC);
*/

-- ========================================
-- SOCIAL FEATURES (Currently commented out)
-- Uncomment when implementing social features
-- ========================================

/*
-- User follows/friends
CREATE TABLE "user_connections" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "user_connections_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_connections_follower_fkey" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "user_connections_following_fkey" FOREIGN KEY ("followingId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "idx_user_connections_unique" ON "user_connections"("followerId", "followingId");
CREATE INDEX "idx_user_connections_following" ON "user_connections"("followingId");

-- Activity comments
CREATE TABLE "activity_comments" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "activity_comments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "activity_comments_activity_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE,
    CONSTRAINT "activity_comments_user_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_activity_comments_activity" ON "activity_comments"("activityId", "createdAt");
CREATE INDEX "idx_activity_comments_user" ON "activity_comments"("userId");

-- Activity likes
CREATE TABLE "activity_likes" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "activity_likes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "activity_likes_activity_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE,
    CONSTRAINT "activity_likes_user_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "idx_activity_likes_unique" ON "activity_likes"("activityId", "userId");
CREATE INDEX "idx_activity_likes_user" ON "activity_likes"("userId");
*/

-- ========================================
-- ADVANCED CACHING (Currently commented out)
-- Uncomment when implementing Redis caching
-- ========================================

/*
-- Cache invalidation tracking
CREATE TABLE "cache_invalidations" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "invalidatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    
    CONSTRAINT "cache_invalidations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_cache_invalidations_key" ON "cache_invalidations"("cacheKey", "invalidatedAt" DESC);
CREATE INDEX "idx_cache_invalidations_entity" ON "cache_invalidations"("entityType", "entityId");
*/

-- ========================================
-- DATA ARCHIVAL (Currently commented out)
-- Uncomment when implementing data archival
-- ========================================

/*
-- Archived activities (for activities older than 1 year)
CREATE TABLE "activities_archive" (
    LIKE "activities" INCLUDING ALL
);

-- Archived notifications (for notifications older than 90 days)
CREATE TABLE "notifications_archive" (
    LIKE "notifications" INCLUDING ALL
);

-- Archive tracking
CREATE TABLE "archive_operations" (
    "id" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "recordCount" INTEGER NOT NULL,
    "dateRange" JSONB,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedBy" TEXT,
    
    CONSTRAINT "archive_operations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_archive_operations_table" ON "archive_operations"("tableName", "archivedAt" DESC);
*/

-- ========================================
-- PERFORMANCE HINTS (Ready to apply)
-- ========================================

-- Suggest table partitioning for activities when table grows large
COMMENT ON TABLE "activities" IS 'Consider partitioning by timestamp when table exceeds 10M rows';

-- Suggest BRIN indexes for time-series data
COMMENT ON COLUMN "activities"."timestamp" IS 'Consider BRIN index for very large tables: CREATE INDEX idx_activities_date_brin ON activities USING brin(timestamp);';

-- Suggest compression for large JSON columns
COMMENT ON COLUMN "team_goals"."routePolyline" IS 'Consider TOAST compression: ALTER TABLE team_goals ALTER COLUMN routePolyline SET STORAGE EXTERNAL;';

-- ========================================
-- MONITORING ENHANCEMENTS (Ready to apply)
-- ========================================

-- Query performance baseline table
CREATE TABLE IF NOT EXISTS "performance_baselines" (
    "id" TEXT NOT NULL,
    "queryHash" TEXT NOT NULL,
    "queryPattern" TEXT NOT NULL,
    "avgDuration" DOUBLE PRECISION NOT NULL,
    "p95Duration" DOUBLE PRECISION NOT NULL,
    "p99Duration" DOUBLE PRECISION NOT NULL,
    "sampleCount" INTEGER NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "performance_baselines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "idx_performance_baselines_hash" ON "performance_baselines"("queryHash");

-- Alerting thresholds
CREATE TABLE IF NOT EXISTS "performance_alerts" (
    "id" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "threshold" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggered" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "performance_alerts_pkey" PRIMARY KEY ("id")
);

-- ========================================
-- UTILITY FUNCTIONS (Ready to apply)
-- ========================================

-- Function to estimate table sizes
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
        schemaname||'.'||tablename AS table_name,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size,
        n_live_tup AS row_estimate
    FROM pg_stat_user_tables
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
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
        indexrelname AS index_name,
        tablename AS table_name,
        pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
        idx_scan AS index_scans,
        CASE 
            WHEN idx_scan > 0 THEN ROUND(idx_tup_read::NUMERIC / idx_scan, 2)
            ELSE 0
        END AS rows_read_per_scan,
        CASE 
            WHEN idx_scan = 0 THEN 'UNUSED'
            WHEN idx_scan < 100 THEN 'RARELY_USED'
            WHEN idx_tup_read::NUMERIC / NULLIF(idx_scan, 0) > 1000 THEN 'INEFFICIENT'
            ELSE 'HEALTHY'
        END AS health_status
    FROM pg_stat_user_indexes
    ORDER BY idx_scan DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to suggest missing indexes
CREATE OR REPLACE FUNCTION suggest_missing_indexes()
RETURNS TABLE(
    table_name TEXT,
    column_name TEXT,
    reason TEXT
) AS $$
BEGIN
    -- This is a placeholder for more sophisticated index suggestion logic
    -- In production, this would analyze pg_stat_statements and query patterns
    RETURN QUERY
    SELECT 
        'activities'::TEXT,
        'userId, activityDate, isPrivate'::TEXT,
        'Frequently used in WHERE clauses together'::TEXT
    UNION ALL
    SELECT 
        'team_members'::TEXT,
        'teamId, leftAt'::TEXT,
        'Used for active member queries'::TEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_table_sizes() IS 'Returns current table sizes and row counts for capacity planning';
COMMENT ON FUNCTION check_index_health() IS 'Analyzes index usage and identifies unused or inefficient indexes';
COMMENT ON FUNCTION suggest_missing_indexes() IS 'Suggests potential missing indexes based on query patterns';