-- Add indexes for team query optimization (DB-006)

-- Team name lookups (for uniqueness checks and searches)
-- Already has unique constraint, but add index for name searches with deletedAt filter
CREATE INDEX IF NOT EXISTS "idx_teams_name_deleted" ON "teams" ("name", "deletedAt");

-- Team searches by name pattern (for autocomplete/search)
CREATE INDEX IF NOT EXISTS "idx_teams_name_pattern" ON "teams" ("name" varchar_pattern_ops) WHERE "deletedAt" IS NULL;

-- Active teams list (for public team discovery)
CREATE INDEX IF NOT EXISTS "idx_teams_public_active" ON "teams" ("isPublic", "createdAt" DESC) WHERE "deletedAt" IS NULL;

-- Team member lookups by userId (getUserTeams optimization)
-- Already has index on userId, but add compound index for active members
CREATE INDEX IF NOT EXISTS "idx_team_members_user_active" ON "team_members" ("userId", "leftAt", "joinedAt" DESC);

-- Team member lookups by teamId for counts and listings
-- Already has index on teamId, but add filtered index for active members
CREATE INDEX IF NOT EXISTS "idx_team_members_team_active" ON "team_members" ("teamId") WHERE "leftAt" IS NULL;

-- Admin member lookups (for permission checks)
CREATE INDEX IF NOT EXISTS "idx_team_members_admin" ON "team_members" ("teamId", "userId", "role") WHERE "leftAt" IS NULL AND "role" = 'ADMIN';

-- Member existence checks (for join validation)
CREATE INDEX IF NOT EXISTS "idx_team_members_unique_active" ON "team_members" ("teamId", "userId") WHERE "leftAt" IS NULL;

-- Team invite lookups by code (for join by invite)
-- Already has index on code, but add filtered index for valid invites
CREATE INDEX IF NOT EXISTS "idx_team_invites_valid" ON "team_invites" ("code", "status", "expiresAt") WHERE "status" = 'PENDING';

-- Team stats view for efficient aggregations
CREATE MATERIALIZED VIEW IF NOT EXISTS "team_stats_mv" AS
SELECT 
    t."id" AS team_id,
    COUNT(DISTINCT tm."userId") AS active_member_count,
    COUNT(DISTINCT CASE WHEN tm."role" = 'ADMIN' THEN tm."userId" END) AS admin_count,
    MAX(a."startTime") AS last_activity_at,
    COALESCE(SUM(a."distance"), 0) AS total_distance,
    COUNT(DISTINCT a."id") AS total_activities
FROM "teams" t
LEFT JOIN "team_members" tm ON t."id" = tm."teamId" AND tm."leftAt" IS NULL
LEFT JOIN "activities" a ON t."id" = a."teamId" AND a."startTime" >= NOW() - INTERVAL '30 days'
WHERE t."deletedAt" IS NULL
GROUP BY t."id";

-- Create indexes on the materialized view
CREATE INDEX IF NOT EXISTS "idx_team_stats_mv_team_id" ON "team_stats_mv" ("team_id");
CREATE INDEX IF NOT EXISTS "idx_team_stats_mv_last_activity" ON "team_stats_mv" ("last_activity_at" DESC NULLS LAST);

-- Add function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_team_stats() RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY "team_stats_mv";
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the indexes
COMMENT ON INDEX "idx_teams_name_deleted" IS 'Optimize team name uniqueness checks with soft delete support';
COMMENT ON INDEX "idx_teams_name_pattern" IS 'Optimize team name searches and autocomplete';
COMMENT ON INDEX "idx_teams_public_active" IS 'Optimize public team discovery queries';
COMMENT ON INDEX "idx_team_members_user_active" IS 'Optimize getUserTeams queries';
COMMENT ON INDEX "idx_team_members_team_active" IS 'Optimize active member counts';
COMMENT ON INDEX "idx_team_members_admin" IS 'Optimize admin permission checks';
COMMENT ON INDEX "idx_team_members_unique_active" IS 'Optimize member existence checks';
COMMENT ON INDEX "idx_team_invites_valid" IS 'Optimize invite code lookups';
COMMENT ON MATERIALIZED VIEW "team_stats_mv" IS 'Pre-aggregated team statistics for performance';