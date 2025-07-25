/**
 * Scheduled jobs handler for progress tracking
 */

import { ScheduledEvent, Context } from 'aws-lambda';
import { prisma } from '../../lib/database';
import { ProgressService } from '../../services/progress';
import { ProgressScheduledJobs } from '../../services/progress/scheduled-jobs';
import { createEmailService } from '../../services/email';
import { createLogger } from '../../services/logger';

const logger = createLogger('ProgressScheduledJobs');

// Initialize services
const progressService = new ProgressService(prisma);
const emailService = createEmailService();
const scheduledJobs = new ProgressScheduledJobs(
  prisma,
  progressService,
  emailService,
  logger
);

export const handler = async (event: ScheduledEvent, context: Context): Promise<void> => {
  logger.info('Scheduled job triggered', { 
    source: event.source,
    detail: event.detail,
    time: event.time 
  });

  try {
    // Determine which job to run based on the event detail
    const jobType = event.detail?.jobType || event['detail-type'];
    
    switch (jobType) {
      case 'daily-summary':
        await scheduledJobs.runDailyProgressSummary();
        break;
      
      case 'encouragement-check':
        await scheduledJobs.runEncouragementCheck();
        break;
      
      case 'cleanup':
        await scheduledJobs.cleanupOldProgressData();
        break;
      
      default:
        logger.warn('Unknown job type', { jobType });
    }
    
    logger.info('Scheduled job completed successfully');
  } catch (error) {
    logger.error('Scheduled job failed', { error });
    throw error;
  }
};