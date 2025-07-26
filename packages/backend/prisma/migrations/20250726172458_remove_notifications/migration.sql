/*
  Warnings:

  - You are about to drop the `notification_batches` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notification_preferences` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notification_templates` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notifications` table. If the table is not empty, all the data it contains will be lost.

*/

-- Drop notification-related indexes first
DROP INDEX IF EXISTS "idx_notifications_user_status";
DROP INDEX IF EXISTS "idx_notifications_user_unread";
DROP INDEX IF EXISTS "idx_notification_batch_status";

-- DropForeignKey
ALTER TABLE "notification_preferences" DROP CONSTRAINT "notification_preferences_userId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_templateId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_userId_fkey";

-- DropTable
DROP TABLE "notification_batches";

-- DropTable
DROP TABLE "notification_preferences";

-- DropTable
DROP TABLE "notification_templates";

-- DropTable
DROP TABLE "notifications";

-- Drop notification archive table if exists
DROP TABLE IF EXISTS "notifications_archive";

-- DropEnum
DROP TYPE "NotificationBatchStatus";

-- DropEnum
DROP TYPE "NotificationCategory";

-- DropEnum
DROP TYPE "NotificationChannel";

-- DropEnum
DROP TYPE "NotificationPriority";

-- DropEnum
DROP TYPE "NotificationStatus";

-- DropEnum
DROP TYPE "NotificationType";
