import { PrismaClient, GoalStatus } from '@prisma/client';
import { ProgressService } from './progress.service';
import { ProgressWebSocketIntegration } from './websocket-integration';
import { EmailService } from '../email/types';
import { LoggerService } from '../logger';

export class ProgressScheduledJobs {
  private logger: LoggerService;

  constructor(
    private prisma: PrismaClient,
    private progressService: ProgressService,
    private websocketIntegration: ProgressWebSocketIntegration,
    private emailService: EmailService,
    logger: LoggerService
  ) {
    this.logger = logger.child({ service: 'ProgressScheduledJobs' });
  }

  /**
   * Run daily progress summary job
   * Should be scheduled to run daily at a specific time (e.g., 8 AM)
   */
  async runDailyProgressSummary(): Promise<void> {
    this.logger.info('Starting daily progress summary job');

    try {
      // Get all active team goals
      const activeGoals = await this.prisma.teamGoal.findMany({
        where: {
          status: GoalStatus.ACTIVE,
        },
        include: {
          team: {
            include: {
              members: {
                where: { leftAt: null },
                include: {
                  user: true,
                },
              },
            },
          },
        },
      });

      this.logger.info(`Processing ${activeGoals.length} active goals`);

      for (const goal of activeGoals) {
        try {
          await this.processDailySummaryForGoal(goal);
        } catch (error) {
          this.logger.error(`Error processing goal ${goal.id}`, { error });
        }
      }

      this.logger.info('Daily progress summary job completed');
    } catch (error) {
      this.logger.error('Failed to run daily progress summary job', { error });
      throw error;
    }
  }

  /**
   * Process daily summary for a single goal
   */
  private async processDailySummaryForGoal(goal: any): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get yesterday's activities
    const activities = await this.prisma.activity.findMany({
      where: {
        teamGoalId: goal.id,
        startTime: {
          gte: yesterday,
          lt: today,
        },
      },
      include: {
        user: true,
      },
    });

    if (activities.length === 0) {
      this.logger.debug(`No activities for goal ${goal.id} yesterday`);
      return;
    }

    // Calculate summary
    const summary = {
      totalDistance: activities.reduce((sum, a) => sum + a.distance, 0),
      totalActivities: activities.length,
      activeUsers: new Set(activities.map(a => a.userId)).size,
    };

    // Get top contributor
    const userDistances = new Map<string, { distance: number; name: string }>();
    activities.forEach(activity => {
      const current = userDistances.get(activity.userId) || { distance: 0, name: activity.user.name };
      current.distance += activity.distance;
      userDistances.set(activity.userId, current);
    });

    const topContributor = Array.from(userDistances.entries())
      .sort((a, b) => b[1].distance - a[1].distance)[0];

    // Get current progress
    const progress = await this.progressService.calculateTeamProgress(goal.id);

    // Broadcast summary
    await this.websocketIntegration.broadcastDailySummary(goal.teamId, {
      ...summary,
      topContributor: topContributor ? {
        userId: topContributor[0],
        name: topContributor[1].name,
        distance: topContributor[1].distance,
      } : undefined,
      progressToday: summary.totalDistance,
      percentComplete: progress.percentComplete,
    });

    this.logger.info(`Daily summary sent for team ${goal.teamId}`, { summary });
  }

  /**
   * Run encouragement check job
   * Should be scheduled to run every few hours
   */
  async runEncouragementCheck(): Promise<void> {
    this.logger.info('Starting encouragement check job');

    try {
      const activeGoals = await this.prisma.teamGoal.findMany({
        where: {
          status: GoalStatus.ACTIVE,
          startedAt: { not: null },
        },
        include: {
          team: true,
          progress: true,
        },
      });

      for (const goal of activeGoals) {
        try {
          const needsEncouragement = await this.progressService.checkForEncouragementNeeded(goal.id);
          
          if (needsEncouragement) {
            await this.sendEncouragementNotification(goal);
          }
        } catch (error) {
          this.logger.error(`Error checking encouragement for goal ${goal.id}`, { error });
        }
      }

      this.logger.info('Encouragement check job completed');
    } catch (error) {
      this.logger.error('Failed to run encouragement check job', { error });
      throw error;
    }
  }

  /**
   * Send encouragement notification
   */
  private async sendEncouragementNotification(goal: any): Promise<void> {
    const progress = await this.progressService.calculateTeamProgress(goal.id, {
      includeEstimates: true,
    });

    let type: 'INACTIVE' | 'BEHIND_SCHEDULE' | 'ALMOST_THERE';
    let message: string;

    if (!progress.lastActivityAt || 
        (Date.now() - progress.lastActivityAt.getTime()) > 3 * 24 * 60 * 60 * 1000) {
      type = 'INACTIVE';
      message = `Your team hasn't logged any activities in a while. Time to get moving towards ${goal.name}!`;
    } else if (progress.isOnTrack === false) {
      type = 'BEHIND_SCHEDULE';
      message = `Your team needs to pick up the pace! You need ${progress.requiredDailyDistance?.toFixed(0)}m per day to reach your goal on time.`;
    } else if (progress.percentComplete >= 80) {
      type = 'ALMOST_THERE';
      message = `You're so close! Just ${(goal.targetDistance - progress.totalDistance).toFixed(0)}m to go!`;
    } else {
      return; // No encouragement needed
    }

    await this.websocketIntegration.broadcastEncouragement(goal.teamId, {
      type,
      message,
      daysRemaining: progress.daysRemaining,
      percentComplete: progress.percentComplete,
      requiredDailyDistance: progress.requiredDailyDistance,
    });

    // Also send email to team admins
    const admins = await this.prisma.teamMember.findMany({
      where: {
        teamId: goal.teamId,
        role: 'ADMIN',
        leftAt: null,
      },
      include: {
        user: true,
      },
    });

    for (const admin of admins) {
      try {
        await this.emailService.sendEmail({
          to: admin.user.email,
          subject: `Team Update: ${goal.team.name}`,
          template: 'team-encouragement',
          data: {
            teamName: goal.team.name,
            goalName: goal.name,
            message,
            percentComplete: progress.percentComplete,
            ctaUrl: `${process.env.APP_URL}/teams/${goal.teamId}/goals/${goal.id}`,
          },
        });
      } catch (error) {
        this.logger.error(`Failed to send encouragement email to ${admin.user.email}`, { error });
      }
    }

    this.logger.info(`Encouragement sent for team ${goal.teamId}`, { type });
  }

  /**
   * Clean up old progress data
   * Should be scheduled to run weekly
   */
  async cleanupOldProgressData(): Promise<void> {
    this.logger.info('Starting progress data cleanup job');

    try {
      // Delete progress records for cancelled or deleted goals older than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await this.prisma.teamProgress.deleteMany({
        where: {
          teamGoal: {
            OR: [
              { status: GoalStatus.CANCELLED },
              { deletedAt: { not: null } },
            ],
            updatedAt: { lt: thirtyDaysAgo },
          },
        },
      });

      this.logger.info(`Cleaned up ${result.count} old progress records`);
    } catch (error) {
      this.logger.error('Failed to run cleanup job', { error });
      throw error;
    }
  }

  /**
   * Register all scheduled jobs
   * This should be called when the application starts
   */
  registerJobs(scheduler: any): void {
    // Daily summary at 8 AM
    scheduler.schedule('0 8 * * *', () => this.runDailyProgressSummary());

    // Encouragement check every 4 hours
    scheduler.schedule('0 */4 * * *', () => this.runEncouragementCheck());

    // Weekly cleanup on Sunday at 2 AM
    scheduler.schedule('0 2 * * 0', () => this.cleanupOldProgressData());

    this.logger.info('Progress scheduled jobs registered');
  }
}