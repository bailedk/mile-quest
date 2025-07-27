-- Update GoalStatus enum to use ACTIVE, PASSED, FAILED
-- First create new enum type
CREATE TYPE "GoalStatus_new" AS ENUM ('ACTIVE', 'PASSED', 'FAILED');

-- Add temporary column
ALTER TABLE "team_goals" ADD COLUMN "status_new" "GoalStatus_new";

-- Map old values to new values
UPDATE "team_goals" SET "status_new" = 
  CASE 
    WHEN "status" = 'ACTIVE' THEN 'ACTIVE'::"GoalStatus_new"
    WHEN "status" = 'COMPLETED' THEN 'PASSED'::"GoalStatus_new"
    WHEN "status" = 'CANCELLED' THEN 'FAILED'::"GoalStatus_new"
    WHEN "status" = 'DRAFT' THEN 'ACTIVE'::"GoalStatus_new"
    ELSE 'ACTIVE'::"GoalStatus_new"
  END;

-- Drop old column and rename new one
ALTER TABLE "team_goals" DROP COLUMN "status";
ALTER TABLE "team_goals" RENAME COLUMN "status_new" TO "status";

-- Set default
ALTER TABLE "team_goals" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- Set NOT NULL
ALTER TABLE "team_goals" ALTER COLUMN "status" SET NOT NULL;

-- Drop old enum type
DROP TYPE "GoalStatus";

-- Rename new enum to original name
ALTER TYPE "GoalStatus_new" RENAME TO "GoalStatus";