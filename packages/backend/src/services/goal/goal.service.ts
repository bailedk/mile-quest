/**
 * Goal Service - Handles team goal creation and progress tracking
 * Integrates with map service for route calculation
 */

import { PrismaClient, GoalStatus, TeamGoal, TeamProgress } from '@prisma/client';
import { MapService, MapServiceError, MapErrorCode, Waypoint, Position } from '../map/types';
import { createMapService } from '../map/map.factory';
import { 
  CreateGoalInput, 
  UpdateGoalInput, 
  GoalProgressInfo, 
  GoalWithProgress,
  RouteCalculationResult 
} from './types';

export class GoalService {
  private mapService: MapService;

  constructor(
    private prisma: PrismaClient,
    mapService?: MapService
  ) {
    this.mapService = mapService || createMapService();
  }

  /**
   * Create a new team goal with geographic route
   * INT-006: Team goals integration with map service
   */
  async createTeamGoal(teamId: string, createdById: string, input: CreateGoalInput): Promise<GoalWithProgress> {
    // Verify team exists and user has permission
    const team = await this.prisma.team.findFirst({
      where: {
        id: teamId,
        members: {
          some: {
            userId: createdById,
            leftAt: null,
          },
        },
      },
    });

    if (!team) {
      throw new Error('Team not found or user is not a member');
    }

    // Calculate route using map service
    const routeResult = await this.calculateRoute(input);

    // Create the goal
    const goal = await this.prisma.teamGoal.create({
      data: {
        teamId,
        createdById,
        name: input.name,
        description: input.description,
        targetDistance: routeResult.totalDistance,
        targetDate: input.targetDate,
        startLocation: input.startLocation,
        endLocation: input.endLocation,
        waypoints: routeResult.waypoints,
        routePolyline: routeResult.encodedPolyline,
        routeData: routeResult.route,
        status: GoalStatus.DRAFT,
      },
      include: {
        progress: true,
        team: {
          select: {
            name: true,
          },
        },
      },
    });

    return this.formatGoalWithProgress(goal);
  }

  /**
   * Update an existing team goal
   */
  async updateTeamGoal(
    goalId: string, 
    userId: string, 
    input: UpdateGoalInput
  ): Promise<GoalWithProgress> {
    // Verify goal exists and user has permission
    const existingGoal = await this.prisma.teamGoal.findFirst({
      where: {
        id: goalId,
        team: {
          members: {
            some: {
              userId,
              leftAt: null,
              role: 'ADMIN',
            },
          },
        },
      },
    });

    if (!existingGoal) {
      throw new Error('Goal not found or user does not have permission');
    }

    let updateData: any = {
      name: input.name,
      description: input.description,
      targetDate: input.targetDate,
    };

    // If locations or waypoints changed, recalculate route
    if (input.startLocation || input.endLocation || input.waypoints) {
      const routeInput: CreateGoalInput = {
        name: input.name || existingGoal.name,
        description: input.description || existingGoal.description || undefined,
        startLocation: input.startLocation || (existingGoal.startLocation as any),
        endLocation: input.endLocation || (existingGoal.endLocation as any),
        waypoints: input.waypoints || (existingGoal.waypoints as any),
        targetDate: input.targetDate || existingGoal.targetDate || undefined,
      };

      const routeResult = await this.calculateRoute(routeInput);
      
      updateData = {
        ...updateData,
        startLocation: routeInput.startLocation,
        endLocation: routeInput.endLocation,
        waypoints: routeResult.waypoints,
        targetDistance: routeResult.totalDistance,
        routePolyline: routeResult.encodedPolyline,
        routeData: routeResult.route,
      };
    }

    if (input.status) {
      updateData.status = input.status;
      
      // Set timestamps based on status changes
      if (input.status === 'ACTIVE' && existingGoal.status === 'DRAFT') {
        updateData.startedAt = new Date();
      } else if (input.status === 'COMPLETED' && existingGoal.status === 'ACTIVE') {
        updateData.completedAt = new Date();
      }
    }

    const updatedGoal = await this.prisma.teamGoal.update({
      where: { id: goalId },
      data: updateData,
      include: {
        progress: true,
        team: {
          select: {
            name: true,
          },
        },
      },
    });

    return this.formatGoalWithProgress(updatedGoal);
  }

  /**
   * Get goal progress information
   * INT-006: Progress tracking along route
   */
  async getGoalProgress(goalId: string, userId: string): Promise<GoalProgressInfo> {
    // Verify goal exists and user has access
    const goal = await this.prisma.teamGoal.findFirst({
      where: {
        id: goalId,
        team: {
          members: {
            some: {
              userId,
              leftAt: null,
            },
          },
        },
      },
      include: {
        progress: true,
        team: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!goal) {
      throw new Error('Goal not found or user does not have access');
    }

    // Get team's total distance for this goal
    const activities = await this.prisma.activity.aggregate({
      where: {
        teamId: goal.teamId,
        teamGoalId: goalId,
      },
      _sum: {
        distance: true,
        duration: true,
      },
      _count: {
        id: true,
      },
    });

    const totalDistance = activities._sum.distance || 0;
    const totalDuration = activities._sum.duration || 0;
    const totalActivities = activities._count.id || 0;

    // Calculate progress percentage
    const progressPercentage = goal.targetDistance > 0 
      ? Math.min((totalDistance / goal.targetDistance) * 100, 100)
      : 0;

    // Calculate current segment and segment progress
    const routeData = goal.routeData as any;
    let currentSegmentIndex = 0;
    let segmentProgress = 0;

    if (routeData?.segments && totalDistance > 0) {
      let cumulativeDistance = 0;
      
      for (let i = 0; i < routeData.segments.length; i++) {
        const segmentDistance = routeData.segments[i].distance;
        
        if (totalDistance <= cumulativeDistance + segmentDistance) {
          currentSegmentIndex = i;
          segmentProgress = totalDistance > cumulativeDistance 
            ? (totalDistance - cumulativeDistance) / segmentDistance
            : 0;
          break;
        }
        
        cumulativeDistance += segmentDistance;
      }
    }

    // Get last activity timestamp
    const lastActivity = await this.prisma.activity.findFirst({
      where: {
        teamId: goal.teamId,
        teamGoalId: goalId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        createdAt: true,
      },
    });

    return {
      goalId: goal.id,
      teamId: goal.teamId,
      goalName: goal.name,
      description: goal.description || undefined,
      startLocation: goal.startLocation as Position & { address?: string },
      endLocation: goal.endLocation as Position & { address?: string },
      waypoints: goal.waypoints as Waypoint[],
      totalDistance: goal.targetDistance,
      targetDate: goal.targetDate || undefined,
      status: goal.status,
      teamTotalDistance: totalDistance,
      progressPercentage,
      currentSegmentIndex,
      segmentProgress,
      totalActivities,
      totalDuration,
      lastActivityAt: lastActivity?.createdAt,
      routePolyline: goal.routePolyline,
      routeBounds: routeData?.bounds,
    };
  }

  /**
   * Get team's active goal
   */
  async getTeamActiveGoal(teamId: string, userId: string): Promise<GoalWithProgress | null> {
    const goal = await this.prisma.teamGoal.findFirst({
      where: {
        teamId,
        status: GoalStatus.ACTIVE,
        team: {
          members: {
            some: {
              userId,
              leftAt: null,
            },
          },
        },
      },
      include: {
        progress: true,
        team: {
          select: {
            name: true,
          },
        },
      },
    });

    return goal ? this.formatGoalWithProgress(goal) : null;
  }

  /**
   * Get all goals for a team
   */
  async getTeamGoals(teamId: string, userId: string): Promise<GoalWithProgress[]> {
    const goals = await this.prisma.teamGoal.findMany({
      where: {
        teamId,
        team: {
          members: {
            some: {
              userId,
              leftAt: null,
            },
          },
        },
      },
      include: {
        progress: true,
        team: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return goals.map(goal => this.formatGoalWithProgress(goal));
  }

  /**
   * Calculate route using map service
   */
  private async calculateRoute(input: CreateGoalInput): Promise<RouteCalculationResult> {
    try {
      // Build waypoints array
      const waypoints: Waypoint[] = [
        {
          id: 'start',
          position: input.startLocation,
          address: input.startLocation.address,
          order: 0,
          isLocked: true,
        },
        ...(input.waypoints || []).map((wp, index) => ({
          ...wp,
          order: index + 1,
        })),
        {
          id: 'end',
          position: input.endLocation,
          address: input.endLocation.address,
          order: (input.waypoints?.length || 0) + 1,
          isLocked: true,
        },
      ];

      // Calculate route
      const route = await this.mapService.calculateRoute(waypoints, {
        profile: 'walking', // Default to walking for team challenges
        steps: true,
      });

      return {
        route,
        totalDistance: route.totalDistance,
        encodedPolyline: route.encodedPolyline,
        waypoints: route.waypoints,
      };
    } catch (error) {
      if (error instanceof MapServiceError) {
        throw new Error(`Route calculation failed: ${error.message}`);
      }
      throw new Error('Failed to calculate route');
    }
  }

  /**
   * Format goal data with progress information
   */
  private formatGoalWithProgress(goal: any): GoalWithProgress {
    return {
      id: goal.id,
      teamId: goal.teamId,
      name: goal.name,
      description: goal.description,
      targetDistance: goal.targetDistance,
      targetDate: goal.targetDate,
      startLocation: goal.startLocation,
      endLocation: goal.endLocation,
      waypoints: goal.waypoints,
      routePolyline: goal.routePolyline,
      routeData: goal.routeData,
      status: goal.status,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
      startedAt: goal.startedAt,
      completedAt: goal.completedAt,
      progress: goal.progress ? {
        totalDistance: goal.progress.totalDistance,
        totalActivities: goal.progress.totalActivities,
        totalDuration: goal.progress.totalDuration,
        currentSegmentIndex: goal.progress.currentSegmentIndex,
        segmentProgress: goal.progress.segmentProgress,
        lastActivityAt: goal.progress.lastActivityAt,
        progressPercentage: goal.targetDistance > 0 
          ? Math.min((goal.progress.totalDistance / goal.targetDistance) * 100, 100)
          : 0,
      } : undefined,
    };
  }
}