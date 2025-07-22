/**
 * Goals Lambda handler with enhanced map integration
 * INT-1.2: Implement Goal Creation API with Maps
 */

import { createHandler, UnauthorizedError } from '../../utils/lambda-handler';
import { createRouter } from '../../utils/router';
import { validateEnvironment } from '../../config/environment';
import { verifyToken, isAuthError } from '../../utils/auth/jwt.utils';
import { prisma } from '../../lib/database';
import { GoalService } from '../../services/goal/goal.service';
import { MapService } from '../../services/map/types';
import { createMapService } from '../../services/map/map.factory';
import { CreateGoalInput, UpdateGoalInput, GoalServiceError, GoalErrorCode } from '../../services/goal/types';
import { APIGatewayProxyEvent } from 'aws-lambda';

// Validate environment on cold start
validateEnvironment();

// Initialize services
const mapService = createMapService();
const goalService = new GoalService(prisma, mapService);

// Create router
const router = createRouter();

// Helper to extract user from token
const getUserFromEvent = (event: APIGatewayProxyEvent) => {
  const authHeader = event.headers.Authorization || event.headers.authorization;
  const token = authHeader?.split(' ')[1];
  
  if (!token) {
    throw new UnauthorizedError('No token provided');
  }
  
  return verifyToken(token);
};

// INT-1.2: Enhanced goal creation with advanced map features
router.post('/goals', async (event, context) => {
  try {
    const user = getUserFromEvent(event);
    const input: CreateGoalInput & { teamId: string } = JSON.parse(event.body || '{}');

    if (!input.teamId) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: {
            code: 'MISSING_TEAM_ID',
            message: 'Team ID is required',
          },
        },
      };
    }

    // Create goal with map integration
    const goal = await goalService.createTeamGoal(input.teamId, user.sub, input);

    return {
      statusCode: 201,
      body: {
        success: true,
        data: goal,
      },
    };
  } catch (error: any) {
    if (isAuthError(error)) {
      return {
        statusCode: 401,
        body: {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
      };
    }
    
    // Handle GoalServiceError with specific error codes
    if (error instanceof GoalServiceError) {
      let statusCode = 400;
      
      switch (error.code) {
        case GoalErrorCode.TEAM_NOT_FOUND:
        case GoalErrorCode.GOAL_NOT_FOUND:
          statusCode = 404;
          break;
        case GoalErrorCode.USER_NOT_MEMBER:
        case GoalErrorCode.INSUFFICIENT_PERMISSIONS:
          statusCode = 403;
          break;
        case GoalErrorCode.ROUTE_CALCULATION_FAILED:
        case GoalErrorCode.NO_ROUTE_FOUND:
          statusCode = 422;
          break;
        default:
          statusCode = 400;
      }
      
      return {
        statusCode,
        body: {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        },
      };
    }

    console.error('Error creating goal:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create goal',
        },
      },
    };
  }
});

// INT-1.2: Validate goal route without creating
router.post('/goals/validate-route', async (event, context) => {
  try {
    const user = getUserFromEvent(event);
    const input: Omit<CreateGoalInput, 'name' | 'description'> = JSON.parse(event.body || '{}');

    if (!input.startLocation || !input.endLocation) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: {
            code: 'INVALID_LOCATIONS',
            message: 'Start and end locations are required',
          },
        },
      };
    }

    // Calculate route using map service
    const waypoints = [
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
        isLocked: wp.isLocked ?? false,
      })),
      {
        id: 'end',
        position: input.endLocation,
        address: input.endLocation.address,
        order: (input.waypoints?.length || 0) + 1,
        isLocked: true,
      },
    ];

    const route = await mapService.calculateRoute(waypoints, {
      profile: 'walking',
      steps: true,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          totalDistance: route.totalDistance,
          totalDuration: route.totalDuration,
          encodedPolyline: route.encodedPolyline,
          bounds: route.bounds,
          waypoints: route.waypoints,
          segments: route.segments.map(segment => ({
            distance: segment.distance,
            duration: segment.duration,
            startWaypoint: segment.startWaypoint,
            endWaypoint: segment.endWaypoint,
          })),
        },
      },
    };
  } catch (error: any) {
    if (isAuthError(error)) {
      return {
        statusCode: 401,
        body: {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
      };
    }

    console.error('Error validating route:', error);
    return {
      statusCode: 400,
      body: {
        success: false,
        error: {
          code: 'ROUTE_VALIDATION_FAILED',
          message: error.message || 'Failed to validate route',
        },
      },
    };
  }
});

// INT-1.2: Search for addresses/locations
router.get('/goals/search-location', async (event, context) => {
  try {
    const user = getUserFromEvent(event);
    const query = event.queryStringParameters?.q;
    const limit = parseInt(event.queryStringParameters?.limit || '5');
    const lat = event.queryStringParameters?.lat;
    const lng = event.queryStringParameters?.lng;

    if (!query) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: {
            code: 'MISSING_QUERY',
            message: 'Search query is required',
          },
        },
      };
    }

    const searchOptions: any = { limit };
    if (lat && lng) {
      searchOptions.proximity = {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
      };
    }

    const results = await mapService.searchAddress(query, searchOptions);

    return {
      statusCode: 200,
      body: {
        success: true,
        data: results,
      },
    };
  } catch (error: any) {
    if (isAuthError(error)) {
      return {
        statusCode: 401,
        body: {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
      };
    }

    console.error('Error searching location:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: {
          code: 'SEARCH_FAILED',
          message: 'Failed to search location',
        },
      },
    };
  }
});

// INT-1.2: Optimize waypoint order for shortest route
router.post('/goals/optimize-waypoints', async (event, context) => {
  try {
    const user = getUserFromEvent(event);
    const input: { waypoints: any[] } = JSON.parse(event.body || '{}');

    if (!input.waypoints || input.waypoints.length < 2) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: {
            code: 'INVALID_WAYPOINTS',
            message: 'At least 2 waypoints are required',
          },
        },
      };
    }

    // Ensure start and end are locked
    const waypoints = input.waypoints.map((wp, index) => ({
      ...wp,
      id: wp.id || `waypoint-${index}`,
      order: index,
      isLocked: index === 0 || index === input.waypoints.length - 1 ? true : wp.isLocked,
    }));

    const optimizedWaypoints = await mapService.optimizeWaypoints(waypoints);

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          waypoints: optimizedWaypoints,
        },
      },
    };
  } catch (error: any) {
    if (isAuthError(error)) {
      return {
        statusCode: 401,
        body: {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
      };
    }

    console.error('Error optimizing waypoints:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: {
          code: 'OPTIMIZATION_FAILED',
          message: 'Failed to optimize waypoints',
        },
      },
    };
  }
});

// INT-1.2: Get goal with enhanced route visualization data
router.get('/goals/:goalId', async (event, context, params) => {
  try {
    const user = getUserFromEvent(event);
    const includeProgress = event.queryStringParameters?.includeProgress === 'true';

    const goal = await goalService.getGoalProgress(params.goalId, user.sub);

    // Enhance with additional visualization data
    const enhancedGoal = {
      ...goal,
      routeVisualization: {
        polyline: goal.routePolyline,
        bounds: goal.routeBounds,
        waypoints: goal.waypoints.map(wp => ({
          ...wp,
          formattedAddress: wp.address || `${wp.position.lat.toFixed(6)}, ${wp.position.lng.toFixed(6)}`,
        })),
        segments: (goal as any).routeData?.segments || [],
      },
      progress: includeProgress ? {
        percentage: goal.progressPercentage,
        distanceCovered: goal.teamTotalDistance,
        distanceRemaining: Math.max(0, goal.totalDistance - goal.teamTotalDistance),
        currentSegment: goal.currentSegmentIndex,
        segmentProgress: goal.segmentProgress,
        lastActivity: goal.lastActivityAt,
      } : undefined,
    };

    return {
      statusCode: 200,
      body: {
        success: true,
        data: enhancedGoal,
      },
    };
  } catch (error: any) {
    if (isAuthError(error)) {
      return {
        statusCode: 401,
        body: {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
      };
    }
    
    if (error instanceof GoalServiceError && error.code === GoalErrorCode.GOAL_NOT_FOUND) {
      return {
        statusCode: 404,
        body: {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Goal not found or access denied',
          },
        },
      };
    }

    console.error('Error getting goal:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get goal',
        },
      },
    };
  }
});

// INT-1.2: Get route elevation profile (mock for now)
router.get('/goals/:goalId/elevation', async (event, context, params) => {
  try {
    const user = getUserFromEvent(event);
    
    // Verify goal access
    await goalService.getGoalProgress(params.goalId, user.sub);

    // Mock elevation data for now
    // In a real implementation, this would use a terrain/elevation API
    const mockElevationProfile = {
      minElevation: 0,
      maxElevation: 150,
      totalAscent: 450,
      totalDescent: 420,
      points: Array.from({ length: 20 }, (_, i) => ({
        distance: (i / 19) * 42195, // Marathon distance in meters
        elevation: Math.sin(i / 3) * 50 + 75 + Math.random() * 20,
      })),
    };

    return {
      statusCode: 200,
      body: {
        success: true,
        data: mockElevationProfile,
      },
    };
  } catch (error: any) {
    if (isAuthError(error)) {
      return {
        statusCode: 401,
        body: {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
      };
    }

    console.error('Error getting elevation profile:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get elevation profile',
        },
      },
    };
  }
});

// Export handler
export const handler = createHandler(router.handle.bind(router));