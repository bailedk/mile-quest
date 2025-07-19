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

export class ActivityService {
  constructor(private prisma: PrismaClient) {}

  async createActivity(
    userId: string,
    input: CreateActivityInput
  ): Promise<CreateActivityResult> {
    // Validate user is member of all specified teams
    const memberships = await this.prisma.teamMember.findMany({
      where: {
        userId,
        teamId: { in: input.teamIds },
        leftAt: null,
      },
      include: {
        team: {
          include: {
            goals: {
              where: {
                status: 'ACTIVE',
              },
              orderBy: {
                createdAt: 'desc',
              },
              take: 1,
            },
          },
        },
      },
    });

    if (memberships.length !== input.teamIds.length) {
      throw new Error('User is not a member of all specified teams');
    }

    // Parse activity date
    const activityDate = new Date(input.activityDate);
    const startTime = activityDate;
    const endTime = new Date(activityDate.getTime() + input.duration * 1000);

    // Create activity for each team in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const teamUpdates: TeamProgressUpdate[] = [];

      // For MVP, we'll create one activity and associate it with the first team
      // In the future, we can extend this to support multiple teams per activity
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
      });

      // Update user stats
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

      // Update team progress for all teams
      for (const membership of memberships) {
        const team = membership.team;
        const activeGoal = team.goals[0];

        if (activeGoal) {
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
          });

          const percentComplete = (progress.totalDistance / activeGoal.targetDistance) * 100;
          
          teamUpdates.push({
            teamId: membership.teamId,
            newTotalDistance: progress.totalDistance,
            newPercentComplete: Math.min(percentComplete, 100),
          });
        }
      }

      // Return the activity with relations
      const activityWithRelations = await tx.activity.findFirst({
        where: { id: activity.id },
        include: {
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

      if (!activityWithRelations) {
        throw new Error('Failed to create activity');
      }

      // Add teams array to match API contract
      const activityWithTeams: ActivityWithRelations = {
        ...activityWithRelations,
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
      ...(options?.teamId && { teamId: options.teamId }),
      ...(options?.startDate && {
        startTime: { gte: new Date(options.startDate) },
      }),
      ...(options?.endDate && {
        endTime: { lte: new Date(options.endDate) },
      }),
    };

    const activities = await this.prisma.activity.findMany({
      where,
      include: {
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        startTime: 'desc',
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
      include: {
        teamGoal: {
          include: {
            team: true,
          },
        },
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

      const teamUpdates: TeamProgressUpdate[] = [];

      // Update team progress if there was an active goal
      if (activity.teamGoalId) {
        const progress = await tx.teamProgress.update({
          where: { teamGoalId: activity.teamGoalId },
          data: {
            totalDistance: { decrement: activity.distance },
            totalActivities: { decrement: 1 },
            totalDuration: { decrement: activity.duration },
          },
        });

        const percentComplete = (progress.totalDistance / activity.teamGoal!.targetDistance) * 100;

        teamUpdates.push({
          teamId: activity.teamId,
          newTotalDistance: progress.totalDistance,
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

  private calculatePace(distance: number, duration: number): number {
    // Calculate pace in min/km
    const km = distance / 1000;
    const minutes = duration / 60;
    return km > 0 ? minutes / km : 0;
  }
}