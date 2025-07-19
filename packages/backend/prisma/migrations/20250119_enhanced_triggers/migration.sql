-- DB-702: Enhanced database triggers for efficient real-time updates
-- Migration: Improved trigger system for production performance

-- 1. Drop existing basic triggers
DROP TRIGGER IF EXISTS activities_dashboard_refresh ON activities;
DROP TRIGGER IF EXISTS team_members_dashboard_refresh ON team_members;
DROP TRIGGER IF EXISTS team_goals_dashboard_refresh ON team_goals;

-- 2. Enhanced activity trigger with intelligent refresh logic
CREATE OR REPLACE FUNCTION trigger_activity_changes()
RETURNS trigger AS $$
DECLARE
    affected_teams uuid[];
    affected_user uuid;
    should_refresh boolean := false;
    change_magnitude integer := 0;
BEGIN
    -- Determine the scope of changes
    IF TG_OP = 'INSERT' THEN
        affected_user := NEW."userId";
        affected_teams := ARRAY[NEW."teamId"];
        change_magnitude := 1;
        should_refresh := true;
    ELSIF TG_OP = 'UPDATE' THEN
        affected_user := NEW."userId";
        affected_teams := ARRAY[NEW."teamId"];
        -- Only refresh if significant fields changed
        IF OLD.distance != NEW.distance OR 
           OLD.duration != NEW.duration OR 
           OLD."isPrivate" != NEW."isPrivate" OR
           OLD."teamId" != NEW."teamId" THEN
            change_magnitude := 2;
            should_refresh := true;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        affected_user := OLD."userId";
        affected_teams := ARRAY[OLD."teamId"];
        change_magnitude := 3;
        should_refresh := true;
    END IF;

    -- Only proceed if refresh is needed
    IF should_refresh THEN
        -- Immediate cache invalidation notification
        PERFORM pg_notify('cache_invalidate', json_build_object(
            'type', 'user_stats',
            'userId', affected_user,
            'timestamp', NOW()
        )::text);

        PERFORM pg_notify('cache_invalidate', json_build_object(
            'type', 'team_progress',
            'teamIds', affected_teams,
            'timestamp', NOW()
        )::text);

        -- Batch materialized view refresh with debouncing
        -- Only refresh if last refresh was more than 30 seconds ago for high-frequency changes
        IF NOT EXISTS (
            SELECT 1 FROM mv_refresh_log 
            WHERE view_name = 'dashboard_batch_refresh' 
              AND refresh_type = 'activity_trigger'
              AND refreshed_at > NOW() - INTERVAL '30 seconds'
        ) OR change_magnitude >= 3 THEN
            
            -- Schedule materialized view refresh
            PERFORM pg_notify('refresh_dashboard_views', json_build_object(
                'table', TG_TABLE_NAME,
                'operation', TG_OP,
                'userId', affected_user,
                'teamIds', affected_teams,
                'magnitude', change_magnitude,
                'timestamp', NOW()
            )::text);

            -- Log the trigger event
            INSERT INTO mv_refresh_log (view_name, refresh_type, refreshed_at, success)
            VALUES ('dashboard_batch_refresh', 'activity_trigger', NOW(), true);
        END IF;

        -- Real-time WebSocket notifications for immediate UI updates
        PERFORM pg_notify('realtime_update', json_build_object(
            'type', 'activity_change',
            'operation', TG_OP,
            'userId', affected_user,
            'teamIds', affected_teams,
            'activityId', COALESCE(NEW.id, OLD.id),
            'distance', COALESCE(NEW.distance, OLD.distance),
            'timestamp', NOW()
        )::text);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 3. Enhanced team member trigger for membership changes
CREATE OR REPLACE FUNCTION trigger_team_member_changes()
RETURNS trigger AS $$
DECLARE
    affected_team uuid;
    affected_user uuid;
    membership_change boolean := false;
BEGIN
    IF TG_OP = 'INSERT' THEN
        affected_team := NEW."teamId";
        affected_user := NEW."userId";
        membership_change := true;
    ELSIF TG_OP = 'UPDATE' THEN
        affected_team := NEW."teamId";
        affected_user := NEW."userId";
        -- Check for role changes or leave/rejoin
        IF OLD.role != NEW.role OR 
           (OLD."leftAt" IS NULL) != (NEW."leftAt" IS NULL) THEN
            membership_change := true;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        affected_team := OLD."teamId";
        affected_user := OLD."userId";
        membership_change := true;
    END IF;

    IF membership_change THEN
        -- Invalidate team-related caches
        PERFORM pg_notify('cache_invalidate', json_build_object(
            'type', 'team_members',
            'teamId', affected_team,
            'userId', affected_user,
            'timestamp', NOW()
        )::text);

        -- Schedule team statistics refresh
        PERFORM pg_notify('refresh_team_stats', json_build_object(
            'teamId', affected_team,
            'operation', TG_OP,
            'timestamp', NOW()
        )::text);

        -- Real-time notification for team updates
        PERFORM pg_notify('realtime_update', json_build_object(
            'type', 'team_membership_change',
            'operation', TG_OP,
            'teamId', affected_team,
            'userId', affected_user,
            'timestamp', NOW()
        )::text);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 4. Enhanced team goal trigger for goal state changes
CREATE OR REPLACE FUNCTION trigger_team_goal_changes()
RETURNS trigger AS $$
DECLARE
    affected_team uuid;
    goal_change boolean := false;
BEGIN
    IF TG_OP = 'INSERT' THEN
        affected_team := NEW."teamId";
        goal_change := true;
    ELSIF TG_OP = 'UPDATE' THEN
        affected_team := NEW."teamId";
        -- Check for status changes or target modifications
        IF OLD.status != NEW.status OR 
           OLD."targetDistance" != NEW."targetDistance" OR
           OLD."targetDate" != NEW."targetDate" THEN
            goal_change := true;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        affected_team := OLD."teamId";
        goal_change := true;
    END IF;

    IF goal_change THEN
        -- Invalidate goal-related caches
        PERFORM pg_notify('cache_invalidate', json_build_object(
            'type', 'team_goal',
            'teamId', affected_team,
            'goalId', COALESCE(NEW.id, OLD.id),
            'timestamp', NOW()
        )::text);

        -- Schedule goal progress refresh
        PERFORM pg_notify('refresh_goal_progress', json_build_object(
            'goalId', COALESCE(NEW.id, OLD.id),
            'teamId', affected_team,
            'operation', TG_OP,
            'timestamp', NOW()
        )::text);

        -- Real-time notification for goal updates
        PERFORM pg_notify('realtime_update', json_build_object(
            'type', 'team_goal_change',
            'operation', TG_OP,
            'teamId', affected_team,
            'goalId', COALESCE(NEW.id, OLD.id),
            'timestamp', NOW()
        )::text);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 5. User statistics trigger for immediate stat updates
CREATE OR REPLACE FUNCTION trigger_user_stats_changes()
RETURNS trigger AS $$
BEGIN
    -- Invalidate user stats cache immediately
    PERFORM pg_notify('cache_invalidate', json_build_object(
        'type', 'user_stats',
        'userId', COALESCE(NEW."userId", OLD."userId"),
        'timestamp', NOW()
    )::text);

    -- Real-time notification for user stats updates
    PERFORM pg_notify('realtime_update', json_build_object(
        'type', 'user_stats_change',
        'operation', TG_OP,
        'userId', COALESCE(NEW."userId", OLD."userId"),
        'timestamp', NOW()
    )::text);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 6. Create optimized triggers with conditional firing
CREATE TRIGGER activities_change_trigger
    AFTER INSERT OR UPDATE OR DELETE ON activities
    FOR EACH ROW EXECUTE FUNCTION trigger_activity_changes();

CREATE TRIGGER team_members_change_trigger
    AFTER INSERT OR UPDATE OR DELETE ON team_members
    FOR EACH ROW EXECUTE FUNCTION trigger_team_member_changes();

CREATE TRIGGER team_goals_change_trigger
    AFTER INSERT OR UPDATE OR DELETE ON team_goals
    FOR EACH ROW EXECUTE FUNCTION trigger_team_goal_changes();

CREATE TRIGGER user_stats_change_trigger
    AFTER INSERT OR UPDATE OR DELETE ON user_stats
    FOR EACH ROW EXECUTE FUNCTION trigger_user_stats_changes();

-- 7. Batch refresh optimization function
CREATE OR REPLACE FUNCTION batch_refresh_materialized_views(
    view_names text[] DEFAULT ARRAY['mv_user_activity_stats', 'mv_team_activity_stats', 'mv_team_member_leaderboard', 'mv_global_leaderboard', 'mv_team_goal_progress']
)
RETURNS TABLE (
    view_name text,
    refresh_success boolean,
    refresh_duration_ms integer,
    error_message text
) AS $$
DECLARE
    view_name_item text;
    start_time timestamptz;
    end_time timestamptz;
    duration_ms integer;
    success boolean;
    error_msg text;
BEGIN
    FOREACH view_name_item IN ARRAY view_names LOOP
        start_time := clock_timestamp();
        success := true;
        error_msg := NULL;
        
        BEGIN
            -- Use concurrent refresh to avoid blocking
            EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', view_name_item);
        EXCEPTION 
            WHEN OTHERS THEN
                success := false;
                error_msg := SQLERRM;
        END;
        
        end_time := clock_timestamp();
        duration_ms := EXTRACT(MILLISECONDS FROM (end_time - start_time))::integer;
        
        -- Log the refresh attempt
        INSERT INTO mv_refresh_log (view_name, refresh_type, refreshed_at, duration_ms, success, error_message)
        VALUES (view_name_item, 'batch_trigger', NOW(), duration_ms, success, error_msg);
        
        -- Return result for this view
        view_name := view_name_item;
        refresh_success := success;
        refresh_duration_ms := duration_ms;
        error_message := error_msg;
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 8. Smart refresh scheduler based on activity patterns
CREATE OR REPLACE FUNCTION smart_refresh_scheduler()
RETURNS void AS $$
DECLARE
    recent_activity_count integer;
    last_refresh_time timestamptz;
    refresh_threshold integer := 10; -- Minimum activities to trigger refresh
    refresh_interval interval := '5 minutes'; -- Minimum time between refreshes
BEGIN
    -- Check recent activity volume
    SELECT COUNT(*) INTO recent_activity_count
    FROM activities 
    WHERE "createdAt" >= NOW() - INTERVAL '15 minutes';
    
    -- Get last refresh time
    SELECT MAX(refreshed_at) INTO last_refresh_time
    FROM mv_refresh_log 
    WHERE view_name = 'smart_scheduler' 
      AND success = true;
    
    -- Decide whether to refresh based on activity and time
    IF recent_activity_count >= refresh_threshold AND 
       (last_refresh_time IS NULL OR last_refresh_time < NOW() - refresh_interval) THEN
        
        -- Perform batch refresh
        PERFORM batch_refresh_materialized_views();
        
        -- Log scheduler execution
        INSERT INTO mv_refresh_log (view_name, refresh_type, refreshed_at, success)
        VALUES ('smart_scheduler', 'scheduled', NOW(), true);
        
        -- Notify applications about refresh completion
        PERFORM pg_notify('materialized_views_refreshed', json_build_object(
            'timestamp', NOW(),
            'trigger', 'smart_scheduler',
            'activity_count', recent_activity_count
        )::text);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 9. Performance monitoring for triggers
CREATE TABLE IF NOT EXISTS trigger_performance_log (
    id SERIAL PRIMARY KEY,
    trigger_name VARCHAR(100) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(10) NOT NULL,
    execution_time_ms INTEGER NOT NULL,
    affected_rows INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trigger_performance_log_timing 
ON trigger_performance_log (trigger_name, created_at DESC);

-- 10. Trigger performance monitoring function
CREATE OR REPLACE FUNCTION log_trigger_performance(
    p_trigger_name text,
    p_table_name text,
    p_operation text,
    p_start_time timestamptz,
    p_affected_rows integer DEFAULT 1
)
RETURNS void AS $$
DECLARE
    execution_time_ms integer;
BEGIN
    execution_time_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - p_start_time))::integer;
    
    INSERT INTO trigger_performance_log (
        trigger_name, 
        table_name, 
        operation, 
        execution_time_ms, 
        affected_rows
    )
    VALUES (
        p_trigger_name, 
        p_table_name, 
        p_operation, 
        execution_time_ms, 
        p_affected_rows
    );
    
    -- Alert on slow triggers (> 100ms)
    IF execution_time_ms > 100 THEN
        PERFORM pg_notify('slow_trigger_alert', json_build_object(
            'trigger_name', p_trigger_name,
            'table_name', p_table_name,
            'operation', p_operation,
            'execution_time_ms', execution_time_ms,
            'timestamp', NOW()
        )::text);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 11. View for trigger performance analysis
CREATE OR REPLACE VIEW v_trigger_performance_summary AS
SELECT 
    trigger_name,
    table_name,
    COUNT(*) as execution_count,
    AVG(execution_time_ms)::integer as avg_execution_time_ms,
    MAX(execution_time_ms) as max_execution_time_ms,
    MIN(execution_time_ms) as min_execution_time_ms,
    SUM(affected_rows) as total_affected_rows,
    MAX(created_at) as last_execution
FROM trigger_performance_log
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY trigger_name, table_name
ORDER BY avg_execution_time_ms DESC;

-- 12. Maintenance function for trigger logs
CREATE OR REPLACE FUNCTION cleanup_trigger_logs()
RETURNS void AS $$
BEGIN
    -- Keep only last 7 days of trigger performance logs
    DELETE FROM trigger_performance_log 
    WHERE created_at < NOW() - INTERVAL '7 days';
    
    -- Keep only last 30 days of refresh logs
    DELETE FROM mv_refresh_log 
    WHERE refreshed_at < NOW() - INTERVAL '30 days';
    
    -- Log cleanup completion
    INSERT INTO mv_refresh_log (view_name, refresh_type, refreshed_at, success)
    VALUES ('log_cleanup', 'maintenance', NOW(), true);
END;
$$ LANGUAGE plpgsql;

-- 13. Create notification channels for external listeners
-- Applications can listen to these channels for real-time updates

-- Channel: cache_invalidate - for immediate cache clearing
-- Channel: refresh_dashboard_views - for materialized view refresh
-- Channel: realtime_update - for WebSocket notifications
-- Channel: materialized_views_refreshed - for refresh completion
-- Channel: slow_trigger_alert - for performance monitoring

-- 14. Comments for documentation
COMMENT ON FUNCTION trigger_activity_changes() IS 'Enhanced trigger for activity changes with intelligent refresh logic and debouncing';
COMMENT ON FUNCTION trigger_team_member_changes() IS 'Enhanced trigger for team membership changes with cache invalidation';
COMMENT ON FUNCTION trigger_team_goal_changes() IS 'Enhanced trigger for team goal changes with progress tracking';
COMMENT ON FUNCTION batch_refresh_materialized_views() IS 'Batch refresh function with error handling and performance logging';
COMMENT ON FUNCTION smart_refresh_scheduler() IS 'Intelligent refresh scheduler based on activity patterns';
COMMENT ON FUNCTION log_trigger_performance() IS 'Performance monitoring for database triggers';
COMMENT ON VIEW v_trigger_performance_summary IS 'Performance analysis view for trigger optimization';

-- 15. Enable trigger performance monitoring (commented out - enable in production monitoring)
-- This would add performance logging to triggers but may add overhead
/*
UPDATE pg_settings SET setting = 'on' 
WHERE name = 'log_statement_stats' AND setting != 'on';
*/

-- 16. Initial cleanup and setup
SELECT cleanup_trigger_logs();

-- Log migration completion
INSERT INTO mv_refresh_log (view_name, refresh_type, refreshed_at, success, duration_ms)
VALUES ('enhanced_triggers_migration', 'migration', NOW(), true, 0);