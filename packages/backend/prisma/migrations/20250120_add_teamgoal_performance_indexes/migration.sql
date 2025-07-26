-- Add GIN indexes for JSON column queries to improve waypoint and route data queries
CREATE INDEX IF NOT EXISTS idx_team_goals_waypoints ON team_goals USING GIN (waypoints);
CREATE INDEX IF NOT EXISTS idx_team_goals_route_data ON team_goals USING GIN ("routeData");

-- Add expression index for route bounds queries (common for map viewport calculations)
CREATE INDEX IF NOT EXISTS idx_team_goals_route_bounds ON team_goals USING GIN (("routeData"->'bounds'));

-- Add partial index for active goals with distance (improves active goal queries)
CREATE INDEX IF NOT EXISTS idx_team_goals_active ON team_goals ("teamId", "targetDistance") 
WHERE status = 'ACTIVE';

-- Add index for completed goals (useful for historical queries)
CREATE INDEX IF NOT EXISTS idx_team_goals_completed ON team_goals ("teamId", "completedAt" DESC) 
WHERE status = 'COMPLETED';

-- Add covering index for goal progress queries
CREATE INDEX IF NOT EXISTS idx_team_goals_progress ON team_goals ("id", "teamId", "targetDistance", "status") 
INCLUDE ("name", "routePolyline", "startLocation", "endLocation");

-- Add index for date range queries with status
CREATE INDEX IF NOT EXISTS idx_team_goals_date_status ON team_goals ("startDate", "endDate", "status") 
WHERE status IN ('ACTIVE', 'DRAFT');

-- Performance Note: Using CONCURRENTLY to avoid table locks during index creation
-- These indexes support the following query patterns:
-- 1. Waypoint searches and filtering
-- 2. Route bounds calculations for map viewport
-- 3. Active goal lookups with distance calculations
-- 4. Completed goal history queries
-- 5. Goal progress calculations without additional lookups
-- 6. Date-based goal filtering