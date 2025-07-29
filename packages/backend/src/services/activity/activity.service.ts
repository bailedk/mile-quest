import { PrismaClient, ActivitySource, Prisma } from '@prisma/client';
import {
  CreateActivityInput,
  UpdateActivityInput,
  ActivityWithRelations,
  ActivityListItem,
  CreateActivityResult,
  DeleteActivityResult,
  TeamProgressUpdate,
  UserActivityStats,
  TeamProgressInfo,
  ActivitySummaryPeriod,
  ActivitySummaryOptions,
} from './types';
import { cache, cacheKeys, cacheTTL } from '../../utils/cache';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { MaterializedViewsService } from '../materialized-views/materialized-views.service';

export class ActivityService {
  private leaderboardService: LeaderboardService;
  private materializedViewsService: MaterializedViewsService;

  constructor(private prisma: PrismaClient) {
    this.leaderboardService = new LeaderboardService(prisma);
    this.materializedViewsService = new MaterializedViewsService(prisma);
  }

  async createActivity(
    userId: string,
    input: CreateActivityInput
  ): Promise<CreateActivityResult> {
    // Create activity in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create activity
      const activity = await tx.activity.create({
        data: {
          userId,
          distance: input.distance,
          duration: input.duration,
          timestamp: input.timestamp,
          notes: input.notes,
          isPrivate: input.isPrivate ?? false,
          source: input.source ?? ActivitySource.MANUAL,
        },
      });

      // Update user stats with proper streak calculation
      const newStreaks = await this.calculateUserStreaks(userId, input.timestamp, tx);
      await tx.userStats.upsert({
        where: { userId },
        create: {
          userId,
          totalDistance: input.distance,
          totalActivities: 1,
          totalDuration: input.duration,
          currentStreak: newStreaks.currentStreak,
          longestStreak: newStreaks.longestStreak,
          lastActivityAt: input.timestamp,
        },
        update: {
          totalDistance: { increment: input.distance },
          totalActivities: { increment: 1 },
          totalDuration: { increment: input.duration },
          currentStreak: newStreaks.currentStreak,
          longestStreak: newStreaks.longestStreak,
          lastActivityAt: input.timestamp,
        },
      });

      // Return the activity with relations
      const activityWithRelations = await tx.activity.findUnique({
        where: { id: activity.id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      });

      if (!activityWithRelations) {
        throw new Error('Failed to create activity');
      }

      // Invalidate relevant caches
      cache.delete(cacheKeys.userStats(userId));

      return {
        activity: activityWithRelations,
      };
    });

    // Refresh materialized views after successful activity creation
    // This ensures dashboard shows updated stats immediately
    try {
      await this.materializedViewsService.refreshView('mv_user_activity_stats');
      // Clear the materialized view cache as well
      cache.delete(`mv_user_stats:${userId}`);
    } catch (error) {
      console.error('Failed to refresh materialized views after activity creation:', error);
      // Don't fail the activity creation if view refresh fails
    }

    return result;
  }

  async getActivities(
    userId: string,
    options?: {
      cursor?: string;
      limit?: number;
      teamId?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<{ items: ActivityListItem[]; nextCursor: string | null; hasMore: boolean }> {
    const limit = Math.min(options?.limit || 20, 50);
    
    const where: Prisma.ActivityWhereInput = {
      userId,
      ...(options?.startDate && {
        timestamp: { gte: new Date(options.startDate) },
      }),
      ...(options?.endDate && {
        timestamp: { lte: new Date(options.endDate) },
      }),
    };

    const activities = await this.prisma.activity.findMany({
      where,
      orderBy: {
        timestamp: 'desc',
      },
      take: limit + 1,
      ...(options?.cursor && {
        cursor: { id: options.cursor },
        skip: 1,
      }),
    });

    const hasMore = activities.length > limit;
    if (hasMore) {
      activities.pop();
    }

    const items: ActivityListItem[] = activities.map((activity) => ({
      id: activity.id,
      distance: activity.distance,
      duration: activity.duration,
      pace: this.calculatePace(activity.distance, activity.duration),
      timestamp: activity.timestamp,
      notes: activity.notes,
      isPrivate: activity.isPrivate,
      source: activity.source,
      createdAt: activity.createdAt,
    }));

    const nextCursor = hasMore ? activities[activities.length - 1].id : null;

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  async updateActivity(
    activityId: string,
    userId: string,
    input: UpdateActivityInput
  ): Promise<ActivityWithRelations> {
    // Verify ownership
    const existingActivity = await this.prisma.activity.findFirst({
      where: {
        id: activityId,
        userId,
      },
    });

    if (!existingActivity) {
      throw new Error('Activity not found or access denied');
    }

    const activity = await this.prisma.activity.update({
      where: { id: activityId },
      data: {
        notes: input.note,
        isPrivate: input.isPrivate,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    return activity;
  }

  async deleteActivity(
    activityId: string,
    userId: string
  ): Promise<DeleteActivityResult> {
    // Verify ownership
    const activity = await this.prisma.activity.findFirst({
      where: {
        id: activityId,
        userId,
      },
    });

    if (!activity) {
      throw new Error('Activity not found or access denied');
    }

    // Delete activity and update stats in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Delete activity
      await tx.activity.delete({
        where: { id: activityId },
      });

      // Update user stats
      await tx.userStats.update({
        where: { userId },
        data: {
          totalDistance: { decrement: activity.distance },
          totalActivities: { decrement: 1 },
          totalDuration: { decrement: activity.duration },
        },
      });

      // Invalidate relevant caches
      cache.delete(cacheKeys.userStats(userId));

      return {
        deleted: true,
        teamUpdates: [],
      };
    });

    return result;
  }

  private calculatePace(distance: number, duration: number): number {
    // Calculate pace in min/km
    const km = distance / 1000;
    const minutes = duration / 60;
    return km > 0 ? minutes / km : 0;
  }

  // Aggregation methods for BE-015
  async getUserStats(userId: string): Promise<UserActivityStats> {
    // Check cache first
    const cacheKey = cacheKeys.userStats(userId);
    const cached = cache.get<UserActivityStats>(cacheKey);
    if (cached) {
      return cached;
    }
    // Get user stats from the UserStats table, create if doesn't exist
    let userStats = await this.prisma.userStats.findUnique({
      where: { userId },
    });
    
    // If no UserStats record exists, create one with default values
    if (!userStats) {
      userStats = await this.prisma.userStats.create({
        data: {
          userId,
          totalDistance: 0,
          totalActivities: 0,
          totalDuration: 0,
          currentStreak: 0,
          longestStreak: 0,
          lastActivityAt: null,
        },
      });
    }

    // Get weekly stats (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weeklyAgg = await this.prisma.activity.aggregate({
      where: {
        userId,
        timestamp: { gte: weekAgo },
      },
      _sum: {
        distance: true,
        duration: true,
      },
      _count: true,
    });

    // Get monthly stats (last 30 days)
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);

    const monthlyAgg = await this.prisma.activity.aggregate({
      where: {
        userId,
        timestamp: { gte: monthAgo },
      },
      _sum: {
        distance: true,
        duration: true,
      },
      _count: true,
    });

    // Calculate averages
    const totalDistance = userStats?.totalDistance || 0;
    const totalDuration = userStats?.totalDuration || 0;
    const totalActivities = userStats?.totalActivities || 0;

    const averagePace = totalDistance > 0 ? this.calculatePace(totalDistance, totalDuration) : 0;
    const averageDistance = totalActivities > 0 ? totalDistance / totalActivities : 0;

    const stats: UserActivityStats = {
      totalDistance,
      totalDuration,
      totalActivities,
      averagePace,
      averageDistance,
      currentStreak: userStats?.currentStreak || 0,
      longestStreak: userStats?.longestStreak || 0,
      lastActivityDate: userStats?.lastActivityAt || null,
      weeklyStats: {
        distance: weeklyAgg._sum.distance || 0,
        duration: weeklyAgg._sum.duration || 0,
        activities: weeklyAgg._count,
      },
      monthlyStats: {
        distance: monthlyAgg._sum.distance || 0,
        duration: monthlyAgg._sum.duration || 0,
        activities: monthlyAgg._count,
      },
    };

    // Cache the result
    cache.set(cacheKey, stats, cacheTTL.userStats);

    return stats;
  }

  async getTeamProgress(teamId: string, userId: string): Promise<TeamProgressInfo> {
    // Check cache first
    const cacheKey = cacheKeys.teamProgress(teamId);
    const cached = cache.get<TeamProgressInfo>(cacheKey);
    if (cached) {
      // Still need to verify user is a member
      const isMember = await this.prisma.teamMember.findFirst({
        where: {
          teamId,
          userId,
          leftAt: null,
        },
      });
      if (!isMember) {
        throw new Error('User is not a member of this team');
      }
      return cached;
    }
    // Get team with active goal
    const team = await this.prisma.team.findFirst({
      where: {
        id: teamId,
        deletedAt: null,
      },
      include: {
        goals: {
          where: {
            status: 'ACTIVE',
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          include: {
            progress: true,
          },
        },
        members: {
          where: {
            leftAt: null,
          },
        },
      },
    });

    if (!team) {
      throw new Error('Team not found');
    }

    // Check if user is a member
    const isMember = team.members.some(m => m.userId === userId);
    if (!isMember) {
      throw new Error('User is not a member of this team');
    }

    const activeGoal = team.goals[0];
    if (!activeGoal) {
      throw new Error('Team has no active goal');
    }

    const progress = activeGoal.progress;
    if (!progress) {
      throw new Error('Team progress not found');
    }

    // Calculate days remaining
    const now = new Date();
    const endDate = activeGoal.targetDate || new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // Default 90 days
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    // Calculate average daily distance
    const daysSinceStart = Math.max(1, Math.ceil((now.getTime() - activeGoal.startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const averageDailyDistance = progress.totalDistance / daysSinceStart;

    // Calculate projected completion date
    let projectedCompletionDate: Date | null = null;
    if (averageDailyDistance > 0) {
      const remainingDistance = activeGoal.targetDistance - progress.totalDistance;
      const daysToComplete = remainingDistance / averageDailyDistance;
      projectedCompletionDate = new Date(now.getTime() + daysToComplete * 24 * 60 * 60 * 1000);
    }

    // Get top contributors
    const memberContributions = await this.prisma.activity.groupBy({
      by: ['userId'],
      where: {
        teamId,
        teamGoalId: activeGoal.id,
      },
      _sum: {
        distance: true,
      },
      orderBy: {
        _sum: {
          distance: 'desc',
        },
      },
      take: 5,
    });

    // Get user details for top contributors
    const topContributorIds = memberContributions.map(c => c.userId);
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: topContributorIds },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const userMap = new Map(users.map(u => [u.id, u]));
    const topContributors = memberContributions.map(c => ({
      userId: c.userId,
      name: userMap.get(c.userId)?.name || 'Unknown',
      distance: c._sum.distance || 0,
      percentage: progress.totalDistance > 0 ? ((c._sum.distance || 0) / progress.totalDistance) * 100 : 0,
    }));

    // Count active members (those who have logged activities)
    const activeMembers = await this.prisma.activity.findMany({
      where: {
        teamId,
        teamGoalId: activeGoal.id,
      },
      select: {
        userId: true,
      },
      distinct: ['userId'],
    });

    const percentComplete = (progress.totalDistance / activeGoal.targetDistance) * 100;

    const routeData = activeGoal.routeData as any;
    
    const result: TeamProgressInfo = {
      team: {
        id: team.id,
        name: team.name,
        goalDistance: activeGoal.targetDistance,
        startDate: activeGoal.startDate,
        endDate: endDate,
      },
      goal: {
        id: activeGoal.id,
        name: activeGoal.name,
        description: activeGoal.description || undefined,
        startLocation: activeGoal.startLocation as {
          lat: number;
          lng: number;
          address?: string;
        },
        endLocation: activeGoal.endLocation as {
          lat: number;
          lng: number;
          address?: string;
        },
        waypoints: (activeGoal.waypoints as any[]) || [],
        routePolyline: activeGoal.routePolyline,
        routeBounds: routeData?.bounds,
      },
      progress: {
        totalDistance: progress.totalDistance,
        percentComplete: Math.min(percentComplete, 100),
        currentSegmentIndex: progress.currentSegmentIndex,
        distanceToNextWaypoint: progress.segmentProgress,
        segmentProgress: progress.segmentProgress,
        averageDailyDistance,
        projectedCompletionDate,
        daysRemaining,
        lastActivityAt: progress.lastActivityAt,
      },
      memberStats: {
        totalMembers: team.members.length,
        activeMembers: activeMembers.length,
        topContributors,
      },
    };

    // Cache the result
    cache.set(cacheKey, result, cacheTTL.teamProgress);

    return result;
  }

  async getActivitySummary(
    userId: string,
    options: ActivitySummaryOptions
  ): Promise<ActivitySummaryPeriod[]> {
    const { period, startDate, endDate, teamId, limit = 12 } = options;

    // Check cache first
    const cacheKey = cacheKeys.activitySummary(userId, period, teamId);
    const cached = cache.get<ActivitySummaryPeriod[]>(cacheKey);
    if (cached && !startDate && !endDate) {
      // Only use cache if no custom date range specified
      return cached;
    }

    // Determine date range
    let queryStartDate: Date;
    let queryEndDate: Date;

    if (startDate && endDate) {
      queryStartDate = new Date(startDate);
      queryEndDate = new Date(endDate);
    } else {
      queryEndDate = new Date();
      if (period === 'daily') {
        queryStartDate = new Date();
        queryStartDate.setDate(queryStartDate.getDate() - limit);
      } else if (period === 'weekly') {
        queryStartDate = new Date();
        queryStartDate.setDate(queryStartDate.getDate() - (limit * 7));
      } else {
        queryStartDate = new Date();
        queryStartDate.setMonth(queryStartDate.getMonth() - limit);
      }
    }

    // Build where clause
    const where: Prisma.ActivityWhereInput = {
      userId,
      timestamp: {
        gte: queryStartDate,
        lte: queryEndDate,
      },
    };
    
    // Note: teamId filtering would need to be done at the team member level
    // since activities don't belong to teams directly

    // Get all activities in the date range
    const activities = await this.prisma.activity.findMany({
      where,
      select: {
        distance: true,
        duration: true,
        timestamp: true,
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    // Group activities by period
    const periodMap = new Map<string, ActivitySummaryPeriod>();

    activities.forEach(activity => {
      const periodKey = this.getPeriodKey(activity.timestamp, period);
      const existing = periodMap.get(periodKey);

      if (existing) {
        existing.totalDistance += activity.distance;
        existing.totalDuration += activity.duration;
        existing.totalActivities += 1;
      } else {
        const { start, end } = this.getPeriodBounds(activity.timestamp, period);
        periodMap.set(periodKey, {
          startDate: start,
          endDate: end,
          totalDistance: activity.distance,
          totalDuration: activity.duration,
          totalActivities: 1,
          averagePace: 0,
          averageDistance: 0,
          activeDays: 1,
        });
      }
    });

    // Calculate averages and active days for each period
    const summaries = Array.from(periodMap.values()).map(summary => {
      summary.averagePace = summary.totalDistance > 0 
        ? this.calculatePace(summary.totalDistance, summary.totalDuration) 
        : 0;
      summary.averageDistance = summary.totalActivities > 0 
        ? summary.totalDistance / summary.totalActivities 
        : 0;

      // Count unique days with activities
      const daysWithActivity = new Set(
        activities
          .filter(a => 
            a.timestamp >= summary.startDate && 
            a.timestamp <= summary.endDate
          )
          .map(a => a.timestamp.toDateString())
      );
      summary.activeDays = daysWithActivity.size;

      return summary;
    });

    // Sort by start date descending and limit
    const result = summaries
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
      .slice(0, limit);

    // Cache the result if no custom date range
    if (!startDate && !endDate) {
      cache.set(cacheKey, result, cacheTTL.activitySummary);
    }

    return result;
  }

  private getPeriodKey(date: Date, period: 'daily' | 'weekly' | 'monthly'): string {
    if (period === 'daily') {
      return date.toISOString().split('T')[0];
    } else if (period === 'weekly') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      return weekStart.toISOString().split('T')[0];
    } else {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
  }

  private getPeriodBounds(date: Date, period: 'daily' | 'weekly' | 'monthly'): { start: Date; end: Date } {
    if (period === 'daily') {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    } else if (period === 'weekly') {
      const start = new Date(date);
      start.setDate(date.getDate() - date.getDay());
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    } else {
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
  }

  /**
   * Calculate user streaks based on activity history
   */
  private async calculateUserStreaks(
    userId: string, 
    newActivityDate: Date, 
    tx?: any
  ): Promise<{ currentStreak: number; longestStreak: number }> {
    const prismaClient = tx || this.prisma;
    
    // Get all activities for the user, grouped by date
    const activities = await prismaClient.activity.findMany({
      where: { userId },
      select: { timestamp: true },
      orderBy: { timestamp: 'desc' },
    });

    // Create a set of unique activity dates (YYYY-MM-DD format)
    const activityDates = new Set<string>();
    activities.forEach(activity => {
      const dateStr = activity.timestamp.toISOString().split('T')[0];
      activityDates.add(dateStr);
    });
    
    // Add the new activity date
    const newDateStr = newActivityDate.toISOString().split('T')[0];
    activityDates.add(newDateStr);
    
    // Convert to sorted array (most recent first)
    const sortedDates = Array.from(activityDates).sort().reverse();
    
    if (sortedDates.length === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    // Calculate current streak
    let currentStreak = 0;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    for (let i = 0; i < sortedDates.length; i++) {
      const dateStr = sortedDates[i];
      const date = new Date(dateStr);
      
      // Calculate expected date for streak continuation
      const expectedDate = new Date(today);
      expectedDate.setDate(today.getDate() - i);
      const expectedDateStr = expectedDate.toISOString().split('T')[0];
      
      if (dateStr === expectedDateStr) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 0;
    
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) {
        tempStreak = 1;
        continue;
      }
      
      const currentDate = new Date(sortedDates[i]);
      const previousDate = new Date(sortedDates[i - 1]);
      const daysDiff = Math.floor((previousDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    
    longestStreak = Math.max(longestStreak, tempStreak, currentStreak);
    
    return { currentStreak, longestStreak };
  }
}