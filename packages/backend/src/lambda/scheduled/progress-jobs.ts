import { ScheduledHandler } from 'aws-lambda';
import { PrismaClient } from '@prisma/client';
import { ProgressService, ProgressScheduledJobs } from '../../services/progress';
import { ProgressWebSocketIntegration } from '../../services/progress';
import { createWebSocketService } from '../../services/websocket';
import { createEmailService } from '../../services/email';
import { createLogger } from '../../services/logger';

const prisma = new PrismaClient();
const logger = createLogger('ProgressScheduledJobs');
const progressService = new ProgressService(prisma);
const websocketService = createWebSocketService();
const emailService = createEmailService();
const progressWebSocket = new ProgressWebSocketIntegration(progressService, websocketService);
const scheduledJobs = new ProgressScheduledJobs(
  prisma,
  progressService,
  progressWebSocket,
  emailService,
  logger
);

/**
 * Handler for daily progress summary
 * CloudWatch Events Rule: rate(1 day) at 8:00 AM UTC
 */
export const dailySummaryHandler: ScheduledHandler = async (event, context) => {
  logger.info('Starting daily summary job', { eventId: event.id });
  
  try {
    await scheduledJobs.runDailyProgressSummary();
    logger.info('Daily summary job completed successfully');
  } catch (error) {
    logger.error('Daily summary job failed', { error });
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

/**
 * Handler for encouragement check
 * CloudWatch Events Rule: rate(4 hours)
 */
export const encouragementHandler: ScheduledHandler = async (event, context) => {
  logger.info('Starting encouragement check job', { eventId: event.id });
  
  try {
    await scheduledJobs.runEncouragementCheck();
    logger.info('Encouragement check job completed successfully');
  } catch (error) {
    logger.error('Encouragement check job failed', { error });
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};

/**
 * Handler for weekly cleanup
 * CloudWatch Events Rule: rate(7 days) on Sunday at 2:00 AM UTC
 */
export const cleanupHandler: ScheduledHandler = async (event, context) => {
  logger.info('Starting cleanup job', { eventId: event.id });
  
  try {
    await scheduledJobs.cleanupOldProgressData();
    logger.info('Cleanup job completed successfully');
  } catch (error) {
    logger.error('Cleanup job failed', { error });
    throw error;
  } finally {
    await prisma.$disconnect();
  }
};