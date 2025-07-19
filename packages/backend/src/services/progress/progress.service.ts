import { PrismaClient, GoalStatus, Prisma } from '@prisma/client';
import {
  TeamProgressData,
  ContributorData,
  ProgressUpdateResult,
  MilestoneData,
  TeamProgressFilters,
  ProgressCalculationOptions,
  DailyProgressSummary,
  ProgressTrend,
} from './types';

export class ProgressService {
  private readonly MILESTONE_THRESHOLDS = [25, 50, 75, 90, 100];
  
  constructor(private prisma: PrismaClient) {}

  /**
   * Calculate comprehensive progress for a team goal
   */
  async calculateTeamProgress(
    teamGoalId: string,
    options: ProgressCalculationOptions = {}
  ): Promise<TeamProgressData> {
    const {
      includeEstimates = true,
      includeContributors = true,
      contributorLimit = 5,
    } = options;

    // Get team goal with progress
    const teamGoal = await this.prisma.teamGoal.findUnique({
      where: { id: teamGoalId },
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
        progress: true,
      },
    });

    if (!teamGoal) {
      throw new Error('Team goal not found');
    }

    // Get current progress from TeamProgress table
    const progress = teamGoal.progress || {
      totalDistance: 0,
      totalActivities: 0,
      totalDuration: 0,
      currentSegmentIndex: 0,
      segmentProgress: 0,
      lastActivityAt: null,
    };

    const percentComplete = Math.min(
      (progress.totalDistance / teamGoal.targetDistance) * 100,
      100
    );

    // Calculate estimates if requested
    let estimatedCompletionDate: Date | undefined;
    let daysRemaining: number | undefined;
    let averageDailyDistance = 0;
    let requiredDailyDistance: number | undefined;
    let isOnTrack: boolean | undefined;

    if (includeEstimates && teamGoal.startedAt) {
      const daysSinceStart = Math.max(
        1,
        Math.floor(
          (Date.now() - teamGoal.startedAt.getTime()) / (1000 * 60 * 60 * 24)
        )
      );
      averageDailyDistance = progress.totalDistance / daysSinceStart;

      if (averageDailyDistance > 0) {
        const remainingDistance = teamGoal.targetDistance - progress.totalDistance;
        const daysToComplete = Math.ceil(remainingDistance / averageDailyDistance);
        estimatedCompletionDate = new Date(
          Date.now() + daysToComplete * 24 * 60 * 60 * 1000
        );

        if (teamGoal.targetDate) {
          daysRemaining = Math.floor(
            (teamGoal.targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          
          if (daysRemaining > 0) {
            requiredDailyDistance = remainingDistance / daysRemaining;
            isOnTrack = averageDailyDistance >= requiredDailyDistance;
          }
        }
      }
    }

    // Get top contributors if requested
    let topContributors: ContributorData[] = [];
    if (includeContributors) {
      const contributors = await this.prisma.activity.groupBy({
        by: ['userId'],
        where: {
          teamGoalId,
          // Include all activities for team totals (private and public)
        },
        _sum: {
          distance: true,
        },
        _count: {
          id: true,
        },
        orderBy: {
          _sum: {
            distance: 'desc',
          },
        },
        take: contributorLimit,
      });

      // Get user details for contributors
      const userIds = contributors.map(c => c.userId);
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      });

      const userMap = new Map(users.map(u => [u.id, u]));

      topContributors = contributors.map(contributor => {
        const user = userMap.get(contributor.userId);
        const distance = contributor._sum.distance || 0;
        
        return {
          userId: contributor.userId,
          name: user?.name || 'Unknown',
          avatarUrl: user?.avatarUrl,
          totalDistance: distance,
          totalActivities: contributor._count.id,
          percentOfTeamTotal: progress.totalDistance > 0
            ? (distance / progress.totalDistance) * 100
            : 0,
        };
      });
    }

    return {
      teamId: teamGoal.teamId,
      teamGoalId: teamGoal.id,
      goalName: teamGoal.name,
      targetDistance: teamGoal.targetDistance,
      targetDate: teamGoal.targetDate || undefined,
      totalDistance: progress.totalDistance,
      totalActivities: progress.totalActivities,
      totalDuration: progress.totalDuration,
      percentComplete,
      estimatedCompletionDate,
      currentSegmentIndex: progress.currentSegmentIndex,
      segmentProgress: progress.segmentProgress,
      lastActivityAt: progress.lastActivityAt || undefined,
      daysRemaining,
      averageDailyDistance,
      requiredDailyDistance,
      isOnTrack,
      participantCount: teamGoal.team.members.length,
      topContributors,
    };
  }

  /**
   * Get progress for multiple teams
   */
  async getMultipleTeamProgress(
    filters: TeamProgressFilters,
    options: ProgressCalculationOptions = {}
  ): Promise<TeamProgressData[]> {
    const where: Prisma.TeamGoalWhereInput = {
      ...(filters.teamIds && { teamId: { in: filters.teamIds } }),
      ...(filters.goalIds && { id: { in: filters.goalIds } }),
      status: filters.includeInactive 
        ? undefined 
        : { in: [GoalStatus.ACTIVE, GoalStatus.COMPLETED] },
    };

    const teamGoals = await this.prisma.teamGoal.findMany({
      where,
      select: { id: true },
    });

    const progressData = await Promise.all(
      teamGoals.map(goal => this.calculateTeamProgress(goal.id, options))
    );

    return progressData;
  }

  /**
   * Update progress and check for milestones
   */
  async updateProgressAndCheckMilestones(
    teamGoalId: string,
    newDistance: number,
    newActivityCount: number,
    newDuration: number
  ): Promise<ProgressUpdateResult> {
    // Get current progress
    const currentProgress = await this.prisma.teamProgress.findUnique({
      where: { teamGoalId },
      include: {
        teamGoal: true,
      },
    });

    if (!currentProgress) {
      throw new Error('Team progress not found');
    }

    const oldPercentComplete = 
      (currentProgress.totalDistance / currentProgress.teamGoal.targetDistance) * 100;
    
    const newTotalDistance = currentProgress.totalDistance + newDistance;
    const newPercentComplete = 
      (newTotalDistance / currentProgress.teamGoal.targetDistance) * 100;

    // Check for milestone reached
    let milestoneReached: MilestoneData | undefined;
    for (const threshold of this.MILESTONE_THRESHOLDS) {
      if (oldPercentComplete < threshold && newPercentComplete >= threshold) {
        milestoneReached = {
          type: threshold === 100 ? 'COMPLETION' : 'PERCENT',
          value: threshold,
          message: threshold === 100
            ? `Goal completed! The team has reached ${currentProgress.teamGoal.targetDistance}m!`
            : `Milestone reached! The team has completed ${threshold}% of the goal!`,
        };
        break;
      }
    }

    // Update progress
    await this.prisma.teamProgress.update({
      where: { teamGoalId },
      data: {
        totalDistance: newTotalDistance,
        totalActivities: { increment: newActivityCount },
        totalDuration: { increment: newDuration },
        lastActivityAt: new Date(),
      },
    });

    // Update goal status if completed
    if (newPercentComplete >= 100 && currentProgress.teamGoal.status === GoalStatus.ACTIVE) {
      await this.prisma.teamGoal.update({
        where: { id: teamGoalId },
        data: {
          status: GoalStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
    }

    // Calculate full progress data
    const teamProgress = await this.calculateTeamProgress(teamGoalId, {
      includeEstimates: true,
      includeContributors: true,
    });

    // Determine if notification should be sent
    const shouldNotify = 
      milestoneReached !== undefined ||
      (teamProgress.isOnTrack === false && oldPercentComplete > 0);

    return {
      teamProgress,
      milestoneReached,
      shouldNotify,
    };
  }

  /**
   * Get daily progress summary for a team
   */
  async getDailyProgressSummary(
    teamId: string,
    days: number = 7
  ): Promise<DailyProgressSummary[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const activities = await this.prisma.activity.findMany({
      where: {
        teamId,
        startTime: { gte: startDate },
        // Include all activities for team totals
      },
      select: {
        userId: true,
        distance: true,
        startTime: true,
      },
    });

    // Group by day
    const dailyMap = new Map<string, {
      distance: number;
      activities: number;
      users: Set<string>;
    }>();

    activities.forEach(activity => {
      const dateKey = activity.startTime.toISOString().split('T')[0];
      const existing = dailyMap.get(dateKey) || {
        distance: 0,
        activities: 0,
        users: new Set<string>(),
      };

      existing.distance += activity.distance;
      existing.activities += 1;
      existing.users.add(activity.userId);

      dailyMap.set(dateKey, existing);
    });

    // Convert to array and fill missing days
    const summaries: DailyProgressSummary[] = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];
      
      const data = dailyMap.get(dateKey);
      summaries.push({
        date,
        totalDistance: data?.distance || 0,
        totalActivities: data?.activities || 0,
        activeUsers: data?.users.size || 0,
        averageDistance: data && data.users.size > 0
          ? data.distance / data.users.size
          : 0,
      });
    }

    return summaries;
  }

  /**
   * Calculate progress trend
   */
  async calculateProgressTrend(
    teamId: string,
    period: 'WEEK' | 'MONTH' = 'WEEK'
  ): Promise<ProgressTrend> {
    const days = period === 'WEEK' ? 7 : 30;
    const data = await this.getDailyProgressSummary(teamId, days);

    // Calculate trend
    const firstHalf = data.slice(0, Math.floor(days / 2));
    const secondHalf = data.slice(Math.floor(days / 2));

    const firstHalfAvg = firstHalf.reduce((sum, d) => sum + d.totalDistance, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, d) => sum + d.totalDistance, 0) / secondHalf.length;

    let trend: 'INCREASING' | 'DECREASING' | 'STABLE';
    const percentChange = firstHalfAvg > 0
      ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100
      : 0;

    if (percentChange > 10) {
      trend = 'INCREASING';
    } else if (percentChange < -10) {
      trend = 'DECREASING';
    } else {
      trend = 'STABLE';
    }

    return {
      period,
      data,
      trend,
      percentChange,
    };
  }

  /**
   * Check if team needs encouragement notification
   */
  async checkForEncouragementNeeded(teamGoalId: string): Promise<boolean> {
    const progress = await this.calculateTeamProgress(teamGoalId, {
      includeEstimates: true,
    });

    // No activity in last 3 days
    if (progress.lastActivityAt) {
      const daysSinceLastActivity = Math.floor(
        (Date.now() - progress.lastActivityAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceLastActivity >= 3) {
        return true;
      }
    }

    // Behind schedule
    if (progress.isOnTrack === false && progress.percentComplete < 90) {
      return true;
    }

    return false;
  }
}