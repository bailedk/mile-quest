-- Add missing indexes identified in code review
-- Using table names consistent with existing migrations

-- Activities table indexes
-- Composite index for team activity queries
CREATE INDEX IF NOT EXISTS "idx_activities_team_timestamp" 
ON "activities" ("teamId", "timestamp" DESC)
WHERE "teamId" IS NOT NULL;

-- Composite index for team goal-specific queries
CREATE INDEX IF NOT EXISTS "idx_activities_team_goal_timestamp" 
ON "activities" ("teamId", "teamGoalId", "timestamp" DESC)
WHERE "teamId" IS NOT NULL AND "teamGoalId" IS NOT NULL;

-- TeamMember table indexes
-- Composite index for admin role checks
CREATE INDEX IF NOT EXISTS "idx_team_members_team_role_left" 
ON "team_members" ("teamId", "role", "leftAt")
WHERE "leftAt" IS NULL;

-- TeamGoal table indexes
-- Composite index for fetching active goals
CREATE INDEX IF NOT EXISTS "idx_team_goals_team_status_created" 
ON "team_goals" ("teamId", "status", "createdAt" DESC);

-- Additional optimization indexes

-- User activity lookups by date range (skip if exists from previous migration)
-- CREATE INDEX IF NOT EXISTS "idx_activities_user_timestamp" 
-- ON "activities" ("userId", "timestamp" DESC);

-- Team member lookups for active members
CREATE INDEX IF NOT EXISTS "idx_team_members_user_left" 
ON "team_members" ("userId", "leftAt")
WHERE "leftAt" IS NULL;

-- Goal progress tracking
CREATE INDEX IF NOT EXISTS "idx_activities_goal_timestamp" 
ON "activities" ("teamGoalId", "timestamp" DESC)
WHERE "teamGoalId" IS NOT NULL;

-- Leaderboard queries optimization (enhanced version of existing index)
CREATE INDEX IF NOT EXISTS "idx_activities_timestamp_private_enhanced" 
ON "activities" ("timestamp" DESC, "isPrivate", "distance")
WHERE "isPrivate" = false AND "distance" > 0;