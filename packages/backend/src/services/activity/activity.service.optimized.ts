import { PrismaClient, ActivitySource, Prisma } from '@prisma/client';
import {
  CreateActivityInput,
  UpdateActivityInput,
  ActivityWithRelations,
  ActivityListItem,
  CreateActivityResult,
  DeleteActivityResult,
  TeamProgressUpdate,
} from './types';

export class OptimizedActivityService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create activity with optimized bulk operations
   */
  async createActivity(
    userId: string,
    input: CreateActivityInput
  ): Promise<CreateActivityResult> {
    // Batch membership validation with single query
    const memberships = await this.prisma.teamMember.findMany({
      where: {
        userId,
        teamId: { in: input.teamIds },
        leftAt: null,
      },
      select: {
        teamId: true,
        team: {
          select: {
            id: true,
            name: true,
            goals: {
              where: { status: 'ACTIVE' },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                id: true,
                targetDistance: true,
              },
            },
          },
        },
      },
    });

    if (memberships.length !== input.teamIds.length) {
      throw new Error('User is not a member of all specified teams');
    }

    const activityDate = new Date(input.activityDate);
    const startTime = activityDate;
    const endTime = new Date(activityDate.getTime() + input.duration * 1000);

    // Use transaction with optimized queries
    const result = await this.prisma.$transaction(async (tx) => {
      const teamUpdates: TeamProgressUpdate[] = [];
      const primaryTeamId = input.teamIds[0];
      const primaryMembership = memberships.find(m => m.teamId === primaryTeamId);
      
      if (!primaryMembership) {
        throw new Error('Primary team membership not found');
      }

      const activeGoal = primaryMembership.team.goals[0];

      // Create activity
      const activity = await tx.activity.create({
        data: {
          userId,
          teamId: primaryTeamId,
          teamGoalId: activeGoal?.id,
          distance: input.distance,
          duration: input.duration,
          startTime,
          endTime,
          notes: input.note,
          isPrivate: input.isPrivate ?? false,
          source: input.source ?? ActivitySource.MANUAL,
        },
        select: {
          id: true,
          userId: true,
          distance: true,
          duration: true,
          startTime: true,
          notes: true,
          isPrivate: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          team: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Batch update user stats
      await tx.userStats.upsert({
        where: { userId },
        create: {
          userId,
          totalDistance: input.distance,
          totalActivities: 1,
          totalDuration: input.duration,
          currentStreak: 1,
          longestStreak: 1,
          lastActivityAt: activityDate,
        },
        update: {
          totalDistance: { increment: input.distance },
          totalActivities: { increment: 1 },
          totalDuration: { increment: input.duration },
          lastActivityAt: activityDate,
        },
      });

      // Batch update team progress
      const progressUpdates = await Promise.all(
        memberships.map(async (membership) => {
          const activeGoal = membership.team.goals[0];
          if (!activeGoal) return null;

          const progress = await tx.teamProgress.upsert({
            where: { teamGoalId: activeGoal.id },
            create: {
              teamGoalId: activeGoal.id,
              totalDistance: input.distance,
              totalActivities: 1,
              totalDuration: input.duration,
              lastActivityAt: activityDate,
            },
            update: {
              totalDistance: { increment: input.distance },
              totalActivities: { increment: 1 },
              totalDuration: { increment: input.duration },
              lastActivityAt: activityDate,
            },
            select: {
              totalDistance: true,
            },
          });

          const percentComplete = (progress.totalDistance / activeGoal.targetDistance) * 100;
          
          return {
            teamId: membership.teamId,
            newTotalDistance: progress.totalDistance,
            newPercentComplete: Math.min(percentComplete, 100),
          };
        })
      );

      teamUpdates.push(...progressUpdates.filter((u): u is TeamProgressUpdate => u !== null));

      const activityWithTeams: ActivityWithRelations = {
        ...activity,
        teams: memberships.map(m => ({
          id: m.team.id,
          name: m.team.name,
        })),
      };

      return {
        activity: activityWithTeams,
        teamUpdates,
      };
    });

    return result;
  }

  /**
   * Get activities with optimized cursor-based pagination
   */
  async getActivities(
    userId: string,
    options?: {
      cursor?: string;
      limit?: number;
      teamId?: string;
      startDate?: string;
      endDate?: string;
      includePrivate?: boolean;
    }
  ): Promise<{ items: ActivityListItem[]; nextCursor: string | null; hasMore: boolean }> {
    const limit = Math.min(options?.limit || 20, 50);
    
    // Build optimized where clause
    const where: Prisma.ActivityWhereInput = {
      userId,
      ...(options?.teamId && { teamId: options.teamId }),
      ...(options?.startDate && {
        startTime: { gte: new Date(options.startDate) },
      }),
      ...(options?.endDate && {
        endTime: { lte: new Date(options.endDate) },
      }),
      ...(options?.includePrivate === false && { isPrivate: false }),
    };

    // Use cursor-based pagination with optimized select
    const activities = await this.prisma.activity.findMany({
      where,
      select: {
        id: true,
        distance: true,
        duration: true,
        startTime: true,
        notes: true,
        isPrivate: true,
        createdAt: true,
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { startTime: 'desc' },
        { id: 'desc' }, // Secondary sort for stable pagination
      ],
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

    // Transform with calculated fields
    const items: ActivityListItem[] = activities.map((activity) => ({
      id: activity.id,
      distance: activity.distance,
      duration: activity.duration,
      pace: this.calculatePace(activity.distance, activity.duration),
      activityDate: activity.startTime,
      note: activity.notes,
      isPrivate: activity.isPrivate,
      createdAt: activity.createdAt,
      teams: [
        {
          id: activity.team.id,
          name: activity.team.name,
        },
      ],
    }));

    const nextCursor = hasMore ? activities[activities.length - 1].id : null;

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Get team activities with aggregation
   */
  async getTeamActivities(
    teamId: string,
    options?: {
      cursor?: string;
      limit?: number;
      startDate?: string;
      endDate?: string;
      includePrivate?: boolean;
    }
  ): Promise<{
    items: ActivityListItem[];
    nextCursor: string | null;
    hasMore: boolean;
    aggregates: {
      totalDistance: number;
      totalActivities: number;
      totalDuration: number;
      uniqueMembers: number;
    };
  }> {
    const limit = Math.min(options?.limit || 20, 50);
    
    // Build where clause
    const where: Prisma.ActivityWhereInput = {
      teamId,
      ...(options?.startDate && {
        startTime: { gte: new Date(options.startDate) },
      }),
      ...(options?.endDate && {
        endTime: { lte: new Date(options.endDate) },
      }),
      ...(options?.includePrivate === false && { isPrivate: false }),
    };

    // Run parallel queries for better performance
    const [activities, aggregates] = await Promise.all([
      // Get paginated activities
      this.prisma.activity.findMany({
        where,
        select: {
          id: true,
          distance: true,
          duration: true,
          startTime: true,
          notes: true,
          isPrivate: true,
          createdAt: true,
          userId: true,
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          team: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [
          { startTime: 'desc' },
          { id: 'desc' },
        ],
        take: limit + 1,
        ...(options?.cursor && {
          cursor: { id: options.cursor },
          skip: 1,
        }),
      }),
      // Get aggregates in parallel
      this.prisma.activity.aggregate({
        where,
        _sum: {
          distance: true,
          duration: true,
        },
        _count: {
          id: true,
        },
      }),
    ]);

    // Get unique member count
    const uniqueMembers = await this.prisma.activity.groupBy({
      by: ['userId'],
      where,
      _count: {
        userId: true,
      },
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
      activityDate: activity.startTime,
      note: activity.notes,
      isPrivate: activity.isPrivate,
      createdAt: activity.createdAt,
      teams: [
        {
          id: activity.team.id,
          name: activity.team.name,
        },
      ],
      user: activity.user, // Include user info for team views
    }));

    const nextCursor = hasMore ? activities[activities.length - 1].id : null;

    return {
      items,
      nextCursor,
      hasMore,
      aggregates: {
        totalDistance: aggregates._sum.distance || 0,
        totalActivities: aggregates._count.id || 0,
        totalDuration: aggregates._sum.duration || 0,
        uniqueMembers: uniqueMembers.length,
      },
    };
  }

  /**
   * Get leaderboard data with optimized queries
   */
  async getLeaderboard(
    options: {
      teamId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
    }
  ): Promise<Array<{
    userId: string;
    user: { id: string; name: string; avatarUrl: string | null };
    totalDistance: number;
    totalActivities: number;
    totalDuration: number;
    avgPace: number;
  }>> {
    const limit = Math.min(options.limit || 10, 50);

    // Build where clause excluding private activities
    const where: Prisma.ActivityWhereInput = {
      isPrivate: false,
      ...(options.teamId && { teamId: options.teamId }),
      ...(options.startDate && {
        startTime: { gte: new Date(options.startDate) },
      }),
      ...(options.endDate && {
        endTime: { lte: new Date(options.endDate) },
      }),
    };

    // Use raw query for better performance on aggregations
    const leaderboard = await this.prisma.$queryRaw<Array<{
      userId: string;
      userName: string;
      userAvatarUrl: string | null;
      totalDistance: number;
      totalActivities: bigint;
      totalDuration: number;
    }>>`
      SELECT 
        a."userId",
        u."name" as "userName",
        u."avatarUrl" as "userAvatarUrl",
        SUM(a.distance)::float as "totalDistance",
        COUNT(a.id) as "totalActivities",
        SUM(a.duration)::float as "totalDuration"
      FROM activities a
      INNER JOIN users u ON a."userId" = u.id
      WHERE a."isPrivate" = false
        ${options.teamId ? Prisma.sql`AND a."teamId" = ${options.teamId}` : Prisma.empty}
        ${options.startDate ? Prisma.sql`AND a."startTime" >= ${new Date(options.startDate)}` : Prisma.empty}
        ${options.endDate ? Prisma.sql`AND a."endTime" <= ${new Date(options.endDate)}` : Prisma.empty}
      GROUP BY a."userId", u."name", u."avatarUrl"
      ORDER BY "totalDistance" DESC
      LIMIT ${limit}
    `;

    // Transform results
    return leaderboard.map(row => ({
      userId: row.userId,
      user: {
        id: row.userId,
        name: row.userName,
        avatarUrl: row.userAvatarUrl,
      },
      totalDistance: row.totalDistance,
      totalActivities: Number(row.totalActivities),
      totalDuration: row.totalDuration,
      avgPace: this.calculatePace(row.totalDistance, row.totalDuration),
    }));
  }

  /**
   * Update activity with minimal queries
   */
  async updateActivity(
    activityId: string,
    userId: string,
    input: UpdateActivityInput
  ): Promise<ActivityWithRelations> {
    // Single query to verify and update
    try {
      const activity = await this.prisma.activity.update({
        where: { 
          id: activityId,
          userId, // This ensures ownership check
        },
        data: {
          notes: input.note,
          isPrivate: input.isPrivate,
        },
        select: {
          id: true,
          userId: true,
          distance: true,
          duration: true,
          startTime: true,
          endTime: true,
          notes: true,
          isPrivate: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          team: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return {
        ...activity,
        teams: [activity.team],
      };
    } catch (error) {
      throw new Error('Activity not found or access denied');
    }
  }

  /**
   * Delete activity with optimized stat updates
   */
  async deleteActivity(
    activityId: string,
    userId: string
  ): Promise<DeleteActivityResult> {
    // Use transaction with optimized queries
    const result = await this.prisma.$transaction(async (tx) => {
      // Get activity details and verify ownership in one query
      const activity = await tx.activity.findFirst({
        where: {
          id: activityId,
          userId,
        },
        select: {
          id: true,
          teamId: true,
          teamGoalId: true,
          distance: true,
          duration: true,
          teamGoal: {
            select: {
              targetDistance: true,
            },
          },
        },
      });

      if (!activity) {
        throw new Error('Activity not found or access denied');
      }

      // Delete activity
      await tx.activity.delete({
        where: { id: activityId },
      });

      // Batch update stats
      const [userStats, teamProgress] = await Promise.all([
        // Update user stats
        tx.userStats.update({
          where: { userId },
          data: {
            totalDistance: { decrement: activity.distance },
            totalActivities: { decrement: 1 },
            totalDuration: { decrement: activity.duration },
          },
        }),
        // Update team progress if applicable
        activity.teamGoalId
          ? tx.teamProgress.update({
              where: { teamGoalId: activity.teamGoalId },
              data: {
                totalDistance: { decrement: activity.distance },
                totalActivities: { decrement: 1 },
                totalDuration: { decrement: activity.duration },
              },
              select: {
                totalDistance: true,
              },
            })
          : null,
      ]);

      const teamUpdates: TeamProgressUpdate[] = [];
      if (teamProgress && activity.teamGoal) {
        const percentComplete = (teamProgress.totalDistance / activity.teamGoal.targetDistance) * 100;
        teamUpdates.push({
          teamId: activity.teamId,
          newTotalDistance: teamProgress.totalDistance,
          newPercentComplete: Math.min(percentComplete, 100),
        });
      }

      return {
        deleted: true,
        teamUpdates,
      };
    });

    return result;
  }

  /**
   * Bulk import activities (for external integrations)
   */
  async bulkImportActivities(
    userId: string,
    activities: Array<CreateActivityInput & { externalId: string }>
  ): Promise<{ imported: number; skipped: number }> {
    // Get user's team memberships once
    const memberships = await this.prisma.teamMember.findMany({
      where: {
        userId,
        leftAt: null,
      },
      select: {
        teamId: true,
      },
    });

    const userTeamIds = memberships.map(m => m.teamId);

    // Filter activities to valid teams
    const validActivities = activities.filter(a => 
      a.teamIds.every(teamId => userTeamIds.includes(teamId))
    );

    // Check for existing external IDs
    const externalIds = validActivities.map(a => a.externalId);
    const existing = await this.prisma.activity.findMany({
      where: {
        externalId: { in: externalIds },
        source: { not: ActivitySource.MANUAL },
      },
      select: {
        externalId: true,
      },
    });

    const existingIds = new Set(existing.map(e => e.externalId));
    const toImport = validActivities.filter(a => !existingIds.has(a.externalId));

    // Bulk create activities
    if (toImport.length > 0) {
      await this.prisma.activity.createMany({
        data: toImport.map(a => ({
          userId,
          teamId: a.teamIds[0], // Use first team for MVP
          distance: a.distance,
          duration: a.duration,
          startTime: new Date(a.activityDate),
          endTime: new Date(new Date(a.activityDate).getTime() + a.duration * 1000),
          notes: a.note,
          isPrivate: a.isPrivate ?? false,
          source: a.source ?? ActivitySource.STRAVA,
          externalId: a.externalId,
        })),
        skipDuplicates: true,
      });

      // Update stats in bulk
      await this.updateStatsForUser(userId);
    }

    return {
      imported: toImport.length,
      skipped: activities.length - toImport.length,
    };
  }

  /**
   * Update user stats efficiently
   */
  private async updateStatsForUser(userId: string): Promise<void> {
    const aggregates = await this.prisma.activity.aggregate({
      where: { userId },
      _sum: {
        distance: true,
        duration: true,
      },
      _count: {
        id: true,
      },
      _max: {
        startTime: true,
      },
    });

    await this.prisma.userStats.upsert({
      where: { userId },
      create: {
        userId,
        totalDistance: aggregates._sum.distance || 0,
        totalActivities: aggregates._count.id || 0,
        totalDuration: aggregates._sum.duration || 0,
        lastActivityAt: aggregates._max.startTime,
      },
      update: {
        totalDistance: aggregates._sum.distance || 0,
        totalActivities: aggregates._count.id || 0,
        totalDuration: aggregates._sum.duration || 0,
        lastActivityAt: aggregates._max.startTime,
      },
    });
  }

  private calculatePace(distance: number, duration: number): number {
    const km = distance / 1000;
    const minutes = duration / 60;
    return km > 0 ? minutes / km : 0;
  }
}