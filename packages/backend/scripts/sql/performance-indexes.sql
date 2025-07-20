-- Mile Quest Performance Indexes
-- Apply these indexes after the schema is created

-- User indexes
CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users"("email");
CREATE INDEX IF NOT EXISTS "idx_users_cognito_id" ON "users"("cognitoId");

-- Team indexes
CREATE INDEX IF NOT EXISTS "idx_teams_name" ON "teams"("name");
CREATE INDEX IF NOT EXISTS "idx_teams_created_at" ON "teams"("createdAt" DESC);

-- Team member indexes (critical for performance)
CREATE INDEX IF NOT EXISTS "idx_team_members_user_team" ON "team_members"("userId", "teamId");
CREATE INDEX IF NOT EXISTS "idx_team_members_team_user_role" ON "team_members"("teamId", "userId", "role");
CREATE INDEX IF NOT EXISTS "idx_team_members_team_role" ON "team_members"("teamId", "role");
CREATE INDEX IF NOT EXISTS "idx_team_members_active" ON "team_members"("teamId", "userId") WHERE "leftAt" IS NULL;

-- Activity indexes with privacy support
CREATE INDEX IF NOT EXISTS "idx_activities_user_date" ON "activities"("userId", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "idx_activities_user_public_date" ON "activities"("userId", "timestamp" DESC) WHERE "isPrivate" = false;
CREATE INDEX IF NOT EXISTS "idx_activities_date_desc" ON "activities"("timestamp" DESC);
CREATE INDEX IF NOT EXISTS "idx_activities_user_distance" ON "activities"("userId", "distance" DESC) WHERE "distance" > 0;
CREATE INDEX IF NOT EXISTS "idx_activities_public_leaderboard" ON "activities"("timestamp", "distance" DESC) WHERE "isPrivate" = false AND "distance" > 0;

-- Team goal indexes
CREATE INDEX IF NOT EXISTS "idx_team_goals_team_status" ON "team_goals"("teamId", "status");
CREATE INDEX IF NOT EXISTS "idx_team_goals_active" ON "team_goals"("teamId", "startDate", "endDate") WHERE "status" = 'ACTIVE';
CREATE INDEX IF NOT EXISTS "idx_team_goals_dates" ON "team_goals"("startDate", "endDate");

-- Team invites indexes
CREATE INDEX IF NOT EXISTS "idx_team_invites_email_status" ON "team_invites"("email", "status");
CREATE INDEX IF NOT EXISTS "idx_team_invites_team_status" ON "team_invites"("teamId", "status");
CREATE INDEX IF NOT EXISTS "idx_team_invites_pending" ON "team_invites"("email", "teamId") WHERE "status" = 'PENDING';

-- Achievement indexes
CREATE INDEX IF NOT EXISTS "idx_achievements_category" ON "achievements"("category");
CREATE INDEX IF NOT EXISTS "idx_user_achievements_user_date" ON "user_achievements"("userId", "earnedAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_user_achievements_user_achievement" ON "user_achievements"("userId", "achievementId");

-- Notification indexes
CREATE INDEX IF NOT EXISTS "idx_notifications_user_status" ON "notifications"("userId", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_notifications_user_unread" ON "notifications"("userId", "createdAt" DESC) WHERE "status" IN ('PENDING', 'DELIVERED');
CREATE INDEX IF NOT EXISTS "idx_notification_batch_status" ON "notification_batches"("status", "scheduledFor");