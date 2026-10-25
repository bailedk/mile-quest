-- Health Connect is a distinct source from Google Fit.
-- Recreate the enum inside this migration so it stays valid in a transaction.
-- External ids are unique per user. Manual activities leave externalId null,
-- and Postgres treats those nulls as distinct, so existing walks are unchanged.

CREATE TYPE "ActivitySource_new" AS ENUM ('MANUAL', 'STRAVA', 'APPLE_HEALTH', 'GOOGLE_FIT', 'HEALTH_CONNECT');

ALTER TABLE "activities" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "activities" ALTER COLUMN "source" TYPE "ActivitySource_new" USING ("source"::text::"ActivitySource_new");

DROP TYPE "ActivitySource";
ALTER TYPE "ActivitySource_new" RENAME TO "ActivitySource";

ALTER TABLE "activities" ALTER COLUMN "source" SET DEFAULT 'MANUAL';

DROP INDEX "activities_source_externalId_key";

CREATE UNIQUE INDEX "activities_userId_source_externalId_key" ON "activities"("userId", "source", "externalId");
