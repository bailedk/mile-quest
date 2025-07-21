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
  RouteCalculationResult,
  GOAL_VALIDATION,
  GoalServiceError,
  GoalErrorCode
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
   * Validate coordinates with enhanced error messages
   */
  private validateCoordinates(position: Position, locationName: string): void {
    if (!position || typeof position.lat !== 'number' || typeof position.lng !== 'number') {
      throw new GoalServiceError(
        `Invalid coordinates for ${locationName}: coordinates must have numeric latitude and longitude properties. Received: ${JSON.stringify(position)}`,
        GoalErrorCode.INVALID_COORDINATES,
        { 
          position, 
          locationName,
          expectedFormat: { lat: 'number', lng: 'number' },
          received: {
            lat: typeof position?.lat,
            lng: typeof position?.lng
          }
        }
      );
    }

    if (position.lat < GOAL_VALIDATION.MIN_LATITUDE || position.lat > GOAL_VALIDATION.MAX_LATITUDE) {
      throw new GoalServiceError(
        `Invalid latitude for ${locationName}: ${position.lat} is outside valid range. Latitude must be between ${GOAL_VALIDATION.MIN_LATITUDE} and ${GOAL_VALIDATION.MAX_LATITUDE} degrees.`,
        GoalErrorCode.INVALID_COORDINATES,
        { 
          position, 
          locationName,
          coordinate: 'latitude',
          value: position.lat,
          minValue: GOAL_VALIDATION.MIN_LATITUDE,
          maxValue: GOAL_VALIDATION.MAX_LATITUDE
        }
      );
    }

    if (position.lng < GOAL_VALIDATION.MIN_COORDINATE || position.lng > GOAL_VALIDATION.MAX_COORDINATE) {
      throw new GoalServiceError(
        `Invalid longitude for ${locationName}: ${position.lng} is outside valid range. Longitude must be between ${GOAL_VALIDATION.MIN_COORDINATE} and ${GOAL_VALIDATION.MAX_COORDINATE} degrees.`,
        GoalErrorCode.INVALID_COORDINATES,
        { 
          position, 
          locationName,
          coordinate: 'longitude',
          value: position.lng,
          minValue: GOAL_VALIDATION.MIN_COORDINATE,
          maxValue: GOAL_VALIDATION.MAX_COORDINATE
        }
      );
    }
  }

  /**
   * Create validation summary for debugging
   */
  private createValidationSummary(input: CreateGoalInput): object {
    const intermediateWaypoints = input.waypoints?.length || 0;
    const totalWaypoints = 2 + intermediateWaypoints;
    
    return {
      goalName: input.name,
      status: input.status || 'DRAFT',
      startLocation: input.startLocation,
      endLocation: input.endLocation,
      intermediateWaypoints,
      totalWaypoints,
      targetDate: input.targetDate,
      description: input.description?.substring(0, 50) + ((input.description?.length || 0) > 50 ? '...' : ''),
      validationChecks: {
        nameValid: !!input.name && input.name.trim().length > 0,
        coordinatesValid: 'to be validated',
        waypointCountValid: totalWaypoints >= GOAL_VALIDATION.MIN_WAYPOINTS && totalWaypoints <= GOAL_VALIDATION.MAX_WAYPOINTS,
        targetDateValid: !input.targetDate || new Date(input.targetDate) > new Date(),
        statusValid: !input.status || ['DRAFT', 'ACTIVE'].includes(input.status)
      }
    };
  }

  /**
   * Validate goal input with comprehensive error messages
   */
  private validateGoalInput(input: CreateGoalInput): void {
    // Validate name
    if (!input.name || input.name.trim().length === 0) {
      throw new GoalServiceError(
        'Goal name is required and cannot be empty',
        GoalErrorCode.INVALID_NAME
      );
    }

    // Validate coordinates
    this.validateCoordinates(input.startLocation, 'start location');
    this.validateCoordinates(input.endLocation, 'end location');

    // Validate waypoints
    const intermediateWaypoints = input.waypoints?.length || 0;
    const totalWaypoints = 2 + intermediateWaypoints; // start + end + intermediate waypoints
    
    // Check minimum waypoints (must have at least start and end)
    if (totalWaypoints < GOAL_VALIDATION.MIN_WAYPOINTS) {
      throw new GoalServiceError(
        `Too few waypoints: minimum ${GOAL_VALIDATION.MIN_WAYPOINTS} waypoints required (start and end locations)`,
        GoalErrorCode.TOO_FEW_WAYPOINTS,
        { 
          provided: totalWaypoints, 
          minimum: GOAL_VALIDATION.MIN_WAYPOINTS,
          intermediateWaypoints 
        }
      );
    }
    
    // Check maximum waypoints
    if (totalWaypoints > GOAL_VALIDATION.MAX_WAYPOINTS) {
      throw new GoalServiceError(
        `Too many waypoints: maximum ${GOAL_VALIDATION.MAX_WAYPOINTS} waypoints allowed (including start and end). You provided ${totalWaypoints} waypoints (${intermediateWaypoints} intermediate waypoints plus start and end).`,
        GoalErrorCode.TOO_MANY_WAYPOINTS,
        { 
          provided: totalWaypoints, 
          maximum: GOAL_VALIDATION.MAX_WAYPOINTS,
          intermediateWaypoints
        }
      );
    }

    // Validate each waypoint
    if (input.waypoints && input.waypoints.length > 0) {
      const waypointPositions = new Set<string>();
      const locationNames: string[] = [];
      
      // Add start and end to check for duplicates
      const startKey = `${input.startLocation.lat},${input.startLocation.lng}`;
      const endKey = `${input.endLocation.lat},${input.endLocation.lng}`;
      waypointPositions.add(startKey);
      waypointPositions.add(endKey);
      locationNames.push('start location', 'end location');

      input.waypoints.forEach((waypoint, index) => {
        this.validateCoordinates(waypoint.position, `waypoint ${index + 1}`);
        
        // Check for duplicate waypoints
        const posKey = `${waypoint.position.lat},${waypoint.position.lng}`;
        if (waypointPositions.has(posKey)) {
          // Find which existing location this duplicates
          let duplicateLocation = 'unknown location';
          if (posKey === startKey) {
            duplicateLocation = 'start location';
          } else if (posKey === endKey) {
            duplicateLocation = 'end location';
          } else {
            // Find duplicate among previous waypoints
            const existingIndex = Array.from(waypointPositions).indexOf(posKey);
            if (existingIndex >= 2) { // 0=start, 1=end, 2+=waypoints
              duplicateLocation = `waypoint ${existingIndex - 1}`;
            }
          }
          
          throw new GoalServiceError(
            `Duplicate waypoint detected: waypoint ${index + 1} has the same coordinates as ${duplicateLocation}. All waypoints must have unique coordinates to create a valid route.`,
            GoalErrorCode.DUPLICATE_WAYPOINT,
            { 
              waypoint, 
              waypointIndex: index,
              duplicateLocation,
              coordinates: waypoint.position,
              suggestion: 'Please adjust the coordinates to create a unique waypoint'
            }
          );
        }
        waypointPositions.add(posKey);
      });
    }

    // Validate target date if provided
    if (input.targetDate) {
      const targetDate = new Date(input.targetDate);
      const now = new Date();
      
      if (targetDate <= now) {
        throw new GoalServiceError(
          'Target date must be in the future',
          GoalErrorCode.INVALID_TARGET_DATE,
          { targetDate, currentDate: now }
        );
      }
    }

    // Validate status if provided
    if (input.status && !['DRAFT', 'ACTIVE'].includes(input.status)) {
      throw new GoalServiceError(
        'Invalid status: new goals can only be created as DRAFT or ACTIVE',
        GoalErrorCode.INVALID_STATUS,
        { 
          status: input.status, 
          allowedValues: ['DRAFT', 'ACTIVE']
        }
      );
    }
  }

  /**
   * Create a new team goal with geographic route
   * BE-1.1: Enhanced with comprehensive waypoint validation, draft support, and detailed error handling
   * INT-006: Team goals integration with map service
   */
  async createTeamGoal(teamId: string, createdById: string, input: CreateGoalInput): Promise<GoalWithProgress> {
    // Create validation summary for debugging (exclude sensitive data)
    const validationSummary = this.createValidationSummary(input);
    
    // Validate input first with enhanced error messages
    try {
      this.validateGoalInput(input);
    } catch (error) {
      if (error instanceof GoalServiceError) {
        // Add validation context to error details
        error.details = {
          ...error.details,
          validationSummary,
          teamId,
          createdById
        };
      }
      throw error;
    }

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
      throw new GoalServiceError(
        'Cannot create goal: either the team does not exist, or you are not an active member of this team. Please check the team ID and ensure you have joined the team.',
        GoalErrorCode.USER_NOT_MEMBER,
        { 
          teamId, 
          userId: createdById,
          suggestion: 'Verify team exists and you are an active member',
          validationSummary 
        }
      );
    }

    try {
      // Calculate route using map service
      const routeResult = await this.calculateRoute(input);

      // Validate total distance
      const distanceInKm = routeResult.totalDistance / 1000;
      if (distanceInKm > GOAL_VALIDATION.MAX_DISTANCE_KM) {
        throw new GoalServiceError(
          `Route distance of ${distanceInKm.toFixed(1)} km exceeds maximum allowed distance of ${GOAL_VALIDATION.MAX_DISTANCE_KM.toLocaleString()} km. Please adjust your waypoints to create a shorter route.`,
          GoalErrorCode.DISTANCE_TOO_LONG,
          { 
            calculatedDistance: routeResult.totalDistance,
            calculatedDistanceKm: distanceInKm,
            maxDistance: GOAL_VALIDATION.MAX_DISTANCE_KM * 1000,
            maxDistanceKm: GOAL_VALIDATION.MAX_DISTANCE_KM,
            waypointCount: routeResult.waypoints.length,
            suggestion: 'Consider reducing the number of waypoints or choosing closer locations'
          }
        );
      }

      // Set default dates for startDate and endDate
      const now = new Date();
      const defaultEndDate = new Date(now);
      defaultEndDate.setMonth(defaultEndDate.getMonth() + 3); // Default to 3 months from now

      // Determine goal status with enhanced draft support
      const goalStatus = input.status === 'ACTIVE' ? GoalStatus.ACTIVE : GoalStatus.DRAFT;
      
      // For draft goals, we allow more flexible validation
      const isDraftGoal = goalStatus === GoalStatus.DRAFT;
      
      // Set appropriate start and end dates based on status
      let endDate = input.targetDate || defaultEndDate;
      
      // For active goals, start date is now
      // For draft goals, start date can be in the future (when they plan to start)
      const startDate = goalStatus === GoalStatus.ACTIVE 
        ? now 
        : (input.targetDate ? new Date(input.targetDate) : defaultEndDate);
      
      const goal = await this.prisma.teamGoal.create({
        data: {
          teamId,
          createdById,
          name: input.name.trim(),
          description: input.description?.trim(),
          targetDistance: routeResult.totalDistance,
          targetDate: input.targetDate,
          endDate: endDate,
          startLocation: input.startLocation as any,
          endLocation: input.endLocation as any,
          waypoints: routeResult.waypoints as any,
          routePolyline: routeResult.encodedPolyline,
          routeData: routeResult.route as any,
          status: goalStatus,
          startDate: startDate,
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
    } catch (error) {
      // Handle map service errors with enhanced context
      if (error instanceof MapServiceError) {
        if (error.code === MapErrorCode.NO_ROUTE_FOUND) {
          throw new GoalServiceError(
            'No walking route found between the specified locations. This could be due to waypoints being in water, unreachable areas, or too far apart. Please check your waypoints and try again.',
            GoalErrorCode.NO_ROUTE_FOUND,
            { 
              startLocation: input.startLocation, 
              endLocation: input.endLocation, 
              waypoints: input.waypoints,
              waypointCount: (input.waypoints?.length || 0) + 2,
              suggestion: 'Try selecting waypoints that are connected by roads or walking paths',
              validationSummary
            }
          );
        }
        throw new GoalServiceError(
          `Route calculation failed: ${error.message}. This may be due to invalid coordinates, service unavailability, or network issues.`,
          GoalErrorCode.ROUTE_CALCULATION_FAILED,
          { 
            originalError: error,
            mapServiceError: error.code,
            validationSummary,
            suggestion: 'Check your internet connection and verify all coordinates are valid'
          }
        );
      }
      
      // Re-throw GoalServiceError with enhanced context
      if (error instanceof GoalServiceError) {
        // Add validation summary if not already present
        if (!error.details?.validationSummary) {
          error.details = {
            ...error.details,
            validationSummary
          };
        }
        throw error;
      }
      
      // Handle unexpected errors with full context
      throw new GoalServiceError(
        'Failed to create team goal due to an unexpected error. Please try again, and if the problem persists, contact support.',
        GoalErrorCode.UNKNOWN_ERROR,
        { 
          originalError: error,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          validationSummary,
          teamId,
          createdById
        }
      );
    }
  }

  /**
   * Update an existing team goal
   * Enhanced with validation and better error handling
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
      throw new GoalServiceError(
        'Goal not found or user does not have permission to update',
        GoalErrorCode.GOAL_NOT_FOUND,
        { goalId, userId }
      );
    }

    // Check if goal is in a state that allows updates
    if (existingGoal.status === 'COMPLETED') {
      throw new GoalServiceError(
        'Cannot update a completed goal',
        GoalErrorCode.GOAL_COMPLETED,
        { goalId, status: existingGoal.status }
      );
    }

    try {
      let updateData: any = {};

      // Validate and set name if provided
      if (input.name !== undefined) {
        if (!input.name || input.name.trim().length === 0) {
          throw new GoalServiceError(
            'Goal name cannot be empty',
            GoalErrorCode.INVALID_NAME
          );
        }
        updateData.name = input.name.trim();
      }

      // Set description if provided
      if (input.description !== undefined) {
        updateData.description = input.description?.trim() || null;
      }

      // Validate and set target date if provided
      if (input.targetDate !== undefined) {
        if (input.targetDate) {
          const targetDate = new Date(input.targetDate);
          const now = new Date();
          
          if (targetDate <= now) {
            throw new GoalServiceError(
              'Target date must be in the future',
              GoalErrorCode.INVALID_TARGET_DATE,
              { targetDate, currentDate: now }
            );
          }
        }
        updateData.targetDate = input.targetDate;
        updateData.endDate = input.targetDate || updateData.endDate;
      }

      // If locations or waypoints changed, recalculate route
      if (input.startLocation || input.endLocation || input.waypoints !== undefined) {
        const routeInput: CreateGoalInput = {
          name: updateData.name || existingGoal.name,
          description: updateData.description ?? existingGoal.description ?? undefined,
          startLocation: input.startLocation || (existingGoal.startLocation as any),
          endLocation: input.endLocation || (existingGoal.endLocation as any),
          waypoints: input.waypoints !== undefined ? input.waypoints : (existingGoal.waypoints as any),
          targetDate: updateData.targetDate || existingGoal.targetDate || undefined,
        };

        // Validate the new route input
        this.validateGoalInput(routeInput);

        const routeResult = await this.calculateRoute(routeInput);
        
        // Validate total distance
        const distanceInKm = routeResult.totalDistance / 1000;
        if (distanceInKm > GOAL_VALIDATION.MAX_DISTANCE_KM) {
          throw new GoalServiceError(
            `Route distance of ${distanceInKm.toFixed(1)} km exceeds maximum allowed distance of ${GOAL_VALIDATION.MAX_DISTANCE_KM} km`,
            GoalErrorCode.DISTANCE_TOO_LONG,
            { 
              calculatedDistance: routeResult.totalDistance,
              maxDistance: GOAL_VALIDATION.MAX_DISTANCE_KM * 1000,
              distanceInKm 
            }
          );
        }

        updateData = {
          ...updateData,
          startLocation: routeInput.startLocation as any,
          endLocation: routeInput.endLocation as any,
          waypoints: routeResult.waypoints as any,
          targetDistance: routeResult.totalDistance,
          routePolyline: routeResult.encodedPolyline,
          routeData: routeResult.route as any,
        };
      }

      // Handle status changes
      if (input.status) {
        // Validate status transition
        if (existingGoal.status === 'DRAFT' && input.status === 'COMPLETED') {
          throw new GoalServiceError(
            'Cannot complete a draft goal directly. Please activate it first.',
            GoalErrorCode.UNKNOWN_ERROR,
            { currentStatus: existingGoal.status, requestedStatus: input.status }
          );
        }

        updateData.status = input.status;
        
        // Set timestamps based on status changes
        const now = new Date();
        if (input.status === 'ACTIVE' && existingGoal.status === 'DRAFT') {
          updateData.startDate = now;
          // Also update startDate if it's in the past
          if (existingGoal.startDate < now) {
            updateData.startDate = now;
          }
        } else if (input.status === 'COMPLETED' && existingGoal.status === 'ACTIVE') {
          updateData.completedAt = now;
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
    } catch (error) {
      // Handle map service errors
      if (error instanceof MapServiceError) {
        if (error.code === MapErrorCode.NO_ROUTE_FOUND) {
          throw new GoalServiceError(
            'No walking route found between the specified locations. Please check your waypoints and try again.',
            GoalErrorCode.NO_ROUTE_FOUND
          );
        }
        throw new GoalServiceError(
          `Route calculation failed: ${error.message}`,
          GoalErrorCode.ROUTE_CALCULATION_FAILED,
          { originalError: error }
        );
      }
      
      // Re-throw GoalServiceError
      if (error instanceof GoalServiceError) {
        throw error;
      }
      
      // Handle unexpected errors
      throw new GoalServiceError(
        'Failed to update team goal',
        GoalErrorCode.UNKNOWN_ERROR,
        { originalError: error }
      );
    }
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
      throw new GoalServiceError(
        'Goal not found or user does not have access',
        GoalErrorCode.GOAL_NOT_FOUND,
        { goalId, userId }
      );
    }

    // Get team's total distance from all members' activities
    // Note: In the team-agnostic model, activities are not linked to specific goals
    // We calculate progress based on activities since the goal was created
    const teamMembers = await this.prisma.teamMember.findMany({
      where: {
        teamId: goal.teamId,
        leftAt: null,
      },
      select: {
        userId: true,
      },
    });
    
    const memberIds = teamMembers.map(m => m.userId);
    
    const activities = await this.prisma.activity.aggregate({
      where: {
        userId: { in: memberIds },
        timestamp: { gte: goal.createdAt },
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

    // Get last activity timestamp from team members
    const lastActivity = await this.prisma.activity.findFirst({
      where: {
        userId: { in: memberIds },
        timestamp: { gte: goal.createdAt },
      },
      orderBy: {
        timestamp: 'desc',
      },
      select: {
        timestamp: true,
      },
    });

    return {
      goalId: goal.id,
      teamId: goal.teamId,
      goalName: goal.name,
      description: goal.description || undefined,
      startLocation: goal.startLocation as unknown as Position & { address?: string },
      endLocation: goal.endLocation as unknown as Position & { address?: string },
      waypoints: goal.waypoints as unknown as Waypoint[],
      totalDistance: goal.targetDistance,
      targetDate: goal.targetDate || undefined,
      status: goal.status,
      teamTotalDistance: totalDistance,
      progressPercentage,
      currentSegmentIndex,
      segmentProgress,
      totalActivities,
      totalDuration,
      lastActivityAt: lastActivity?.timestamp,
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
   * BE-1.1: Enhanced with comprehensive waypoint validation and error handling
   */
  private async calculateRoute(input: CreateGoalInput): Promise<RouteCalculationResult> {
    try {
      // Build waypoints array with proper IDs and ordering
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
          id: wp.id || `waypoint-${index + 1}`,
          order: index + 1,
          isLocked: wp.isLocked ?? false, // Allow waypoints to be reordered unless explicitly locked
        })),
        {
          id: 'end',
          position: input.endLocation,
          address: input.endLocation.address,
          order: (input.waypoints?.length || 0) + 1,
          isLocked: true,
        },
      ];

      // Validate we have at least start and end (should never fail due to earlier validation)
      if (waypoints.length < GOAL_VALIDATION.MIN_WAYPOINTS) {
        throw new GoalServiceError(
          `Route must have at least ${GOAL_VALIDATION.MIN_WAYPOINTS} waypoints (start and end locations). Current waypoint count: ${waypoints.length}`,
          GoalErrorCode.TOO_FEW_WAYPOINTS,
          { 
            waypointCount: waypoints.length,
            minimumRequired: GOAL_VALIDATION.MIN_WAYPOINTS,
            providedWaypoints: waypoints.map(wp => ({ id: wp.id, position: wp.position }))
          }
        );
      }

      // Calculate route
      const route = await this.mapService.calculateRoute(waypoints, {
        profile: 'walking', // Default to walking for team challenges
        steps: true,
      });

      // Ensure route has valid distance
      if (!route.totalDistance || route.totalDistance <= 0) {
        throw new GoalServiceError(
          'Calculated route has invalid distance',
          GoalErrorCode.ROUTE_CALCULATION_FAILED,
          { totalDistance: route.totalDistance }
        );
      }

      return {
        route,
        totalDistance: route.totalDistance,
        encodedPolyline: route.encodedPolyline,
        waypoints: route.waypoints,
      };
    } catch (error) {
      // Re-throw if already a GoalServiceError
      if (error instanceof GoalServiceError) {
        throw error;
      }
      
      // Handle MapServiceError
      if (error instanceof MapServiceError) {
        throw error; // Let the caller handle map service errors with context
      }
      
      // Generic error
      throw new GoalServiceError(
        'Failed to calculate route',
        GoalErrorCode.ROUTE_CALCULATION_FAILED,
        { originalError: error }
      );
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
      startedAt: goal.startDate,
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