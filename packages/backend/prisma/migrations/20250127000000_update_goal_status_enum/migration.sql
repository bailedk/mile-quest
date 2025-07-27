-- Update GoalStatus enum to use ACTIVE, PASSED, FAILED
-- First, update existing values
UPDATE "team_goals" SET "status" = 'PASSED' WHERE "status" = 'COMPLETED';
UPDATE "team_goals" SET "status" = 'FAILED' WHERE "status" = 'CANCELLED';
UPDATE "team_goals" SET "status" = 'ACTIVE' WHERE "status" = 'DRAFT';

-- Drop and recreate the enum with new values
ALTER TYPE "GoalStatus" RENAME TO "GoalStatus_old";
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'PASSED', 'FAILED');

-- Update the column to use the new enum
ALTER TABLE "team_goals" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "team_goals" ALTER COLUMN "status" TYPE "GoalStatus" USING "status"::text::"GoalStatus";
ALTER TABLE "team_goals" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- Drop the old enum
DROP TYPE "GoalStatus_old";