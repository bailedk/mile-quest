/**
 * Activities Lambda handler with routing
 */

import { createHandler } from '../../utils/lambda-handler';
import { createRouter } from '../../utils/router';
import { validateEnvironment } from '../../config/environment';
import { verifyToken } from '../../utils/auth/jwt.utils';
import { prisma } from '../../lib/database';
import { ActivityService } from '../../services/activity/activity.service';
import { UpdateActivityInput } from '../../services/activity/types';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { ProgressService, ProgressWebSocketIntegration } from '../../services/progress';
import { createWebSocketService } from '../../services/websocket';
import { createLogger } from '../../services/logger';

// Validate environment on cold start
validateEnvironment();

// Initialize services lazily to avoid cold start issues
let activityService: ActivityService;
let progressService: ProgressService;
let websocketService: ReturnType<typeof createWebSocketService>;
let progressWebSocket: ProgressWebSocketIntegration;
let logger: ReturnType<typeof createLogger>;

function initializeServices() {
  if (!activityService) {
    activityService = new ActivityService(prisma);
    progressService = new ProgressService(prisma);
    websocketService = createWebSocketService();
    progressWebSocket = new ProgressWebSocketIntegration(progressService, websocketService);
    logger = createLogger('ActivitiesHandler');
  }
}

// Create router
const router = createRouter();

// Helper to extract user from token
const getUserFromEvent = (event: APIGatewayProxyEvent) => {
  const authHeader = event.headers.Authorization || event.headers.authorization;
  const token = authHeader?.split(' ')[1];
  
  if (!token) {
    throw new Error('No token provided');
  }
  
  return verifyToken(token);
};

// Create activity
router.post('/', async (event, context, params) => {
  initializeServices();
  
  try {
    const user = getUserFromEvent(event);
    const input = JSON.parse(event.body || '{}');

    // Validate input
    if (typeof input.distance !== 'number' || input.distance <= 0) {
      return {
        statusCode: 400,
        body: {
          error: 'Distance must be a positive number',
        },
      };
    }

    if (typeof input.duration !== 'number' || input.duration <= 0) {
      return {
        statusCode: 400,
        body: {
          error: 'Duration must be a positive number',
        },
      };
    }

    if (!input.timestamp) {
      return {
        statusCode: 400,
        body: {
          error: 'Timestamp is required',
        },
      };
    }

    const timestamp = new Date(input.timestamp);
    const now = new Date();
    
    if (timestamp > now) {
      return {
        statusCode: 400,
        body: {
          error: 'Cannot log future activities',
        },
      };
    }

    const result = await activityService.createActivity(user.sub, {
      distance: input.distance,
      duration: input.duration,
      timestamp,
      notes: input.notes,
      isPrivate: input.isPrivate ?? false,
      source: input.source ?? 'MANUAL',
    });

    // Send real-time updates to user's teams if needed
    try {
      const userTeams = await prisma.teamMember.findMany({
        where: {
          userId: user.sub,
          leftAt: null,
        },
        include: {
          team: {
            include: {
              goals: {
                where: {
                  status: 'ACTIVE',
                  startDate: { lte: timestamp },
                  endDate: { gte: timestamp },
                },
                take: 1,
              },
            },
          },
        },
      });

      // Update progress for each team with an active goal
      for (const membership of userTeams) {
        const activeGoal = membership.team.goals[0];
        if (activeGoal) {
          const progressData = await progressService.calculateTeamProgress(
            activeGoal.id,
            { includeContributors: true, contributorLimit: 3 }
          );

          await progressWebSocket.broadcastProgressUpdate(
            membership.teamId,
            activeGoal.id,
            progressData
          );
        }
      }
    } catch (wsError) {
      logger.error('Failed to send WebSocket updates', { error: wsError });
      // Don't fail the request if WebSocket fails
    }

    return {
      statusCode: 201,
      body: {
        success: true,
        data: {
          id: result.activity.id,
          userId: result.activity.userId,
          distance: result.activity.distance,
          duration: result.activity.duration,
          timestamp: result.activity.timestamp.toISOString(),
          notes: result.activity.notes,
          isPrivate: result.activity.isPrivate,
          createdAt: result.activity.createdAt.toISOString(),
          updatedAt: result.activity.updatedAt.toISOString(),
          achievements: result.achievements,
        },
      },
    };
  } catch (error: any) {
    if (error.message === 'No token provided') {
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
    
    console.error('Error creating activity:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create activity',
        },
      },
    };
  }
});

// List activities (BE-014)
router.get('/', async (event, context, params) => {
  initializeServices();
  
  try {
    const user = getUserFromEvent(event);
    
    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const options = {
      cursor: queryParams.cursor,
      limit: queryParams.limit ? parseInt(queryParams.limit) : undefined,
      startDate: queryParams.startDate,
      endDate: queryParams.endDate,
    };

    const result = await activityService.getActivities(user.sub, options);

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          items: result.items.map(item => ({
            id: item.id,
            distance: item.distance,
            duration: item.duration,
            pace: item.pace,
            timestamp: item.timestamp.toISOString(),
            notes: item.notes,
            isPrivate: item.isPrivate,
            createdAt: item.createdAt.toISOString(),
          })),
          nextCursor: result.nextCursor,
          hasMore: result.hasMore,
        },
      },
    };
  } catch (error: any) {
    if (error.message === 'No token provided') {
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
    
    console.error('Error listing activities:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to list activities',
        },
      },
    };
  }
});

// Update activity (BE-014)
router.patch('/:id', async (event, context, params) => {
  initializeServices();
  
  try {
    const user = getUserFromEvent(event);
    const input: UpdateActivityInput = JSON.parse(event.body || '{}');

    const activity = await activityService.updateActivity(
      params.id,
      user.sub,
      input
    );

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          id: activity.id,
          userId: activity.userId,
          distance: activity.distance,
          duration: activity.duration,
          timestamp: activity.timestamp.toISOString(),
          notes: activity.notes,
          isPrivate: activity.isPrivate,
          createdAt: activity.createdAt.toISOString(),
          updatedAt: activity.updatedAt.toISOString(),
        },
      },
    };
  } catch (error: any) {
    if (error.message === 'No token provided') {
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
    if (error.message === 'Activity not found or access denied') {
      return {
        statusCode: 404,
        body: {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: error.message,
          },
        },
      };
    }
    
    console.error('Error updating activity:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update activity',
        },
      },
    };
  }
});

// Delete activity (BE-014)
router.delete('/:id', async (event, context, params) => {
  initializeServices();
  
  try {
    const user = getUserFromEvent(event);

    const result = await activityService.deleteActivity(
      params.id,
      user.sub
    );

    // Send real-time updates for team progress decrease
    try {
      // Update progress for user's teams if needed
      const userTeams = await prisma.teamMember.findMany({
        where: {
          userId: user.sub,
          leftAt: null,
        },
        include: {
          team: {
            include: {
              goals: {
                where: {
                  status: 'ACTIVE',
                },
                take: 1,
              },
            },
          },
        },
      });

      for (const membership of userTeams) {
        const activeGoal = membership.team.goals[0];
        if (activeGoal) {
          const progressData = await progressService.calculateTeamProgress(
            activeGoal.id,
            { includeContributors: true, contributorLimit: 3 }
          );

          await progressWebSocket.broadcastProgressUpdate(
            membership.teamId,
            activeGoal.id,
            progressData
          );
        }
      }
    } catch (wsError) {
      logger.error('Failed to send WebSocket updates for deletion', { error: wsError });
      // Don't fail the request if WebSocket fails
    }

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          deleted: result.deleted,
        },
      },
    };
  } catch (error: any) {
    if (error.message === 'No token provided') {
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
    if (error.message === 'Activity not found or access denied') {
      return {
        statusCode: 404,
        body: {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: error.message,
          },
        },
      };
    }
    
    console.error('Error deleting activity:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete activity',
        },
      },
    };
  }
});

// Get user activity stats (BE-015)
router.get('/stats', async (event, context, params) => {
  initializeServices();
  
  try {
    const user = getUserFromEvent(event);
    const stats = await activityService.getUserStats(user.sub);

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          stats: {
            totalDistance: stats.totalDistance,
            totalDuration: stats.totalDuration,
            totalActivities: stats.totalActivities,
            averagePace: stats.averagePace,
            averageDistance: stats.averageDistance,
            currentStreak: stats.currentStreak,
            longestStreak: stats.longestStreak,
            lastActivityDate: stats.lastActivityDate?.toISOString() || null,
            weeklyStats: stats.weeklyStats,
            monthlyStats: stats.monthlyStats,
          },
        },
      },
    };
  } catch (error: any) {
    if (error.message === 'No token provided') {
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
    
    console.error('Error getting user stats:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get user stats',
        },
      },
    };
  }
});

// Get activity summary by period (BE-015)
router.get('/summary', async (event, context, params) => {
  initializeServices();
  
  try {
    const user = getUserFromEvent(event);
    
    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const period = queryParams.period as 'daily' | 'weekly' | 'monthly' || 'weekly';
    
    // Validate period
    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid period. Must be daily, weekly, or monthly',
          },
        },
      };
    }

    const options = {
      period,
      startDate: queryParams.startDate,
      endDate: queryParams.endDate,
      teamId: queryParams.teamId,
      limit: queryParams.limit ? parseInt(queryParams.limit) : undefined,
    };

    const summaries = await activityService.getActivitySummary(user.sub, options);

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          summaries: summaries.map(summary => ({
            startDate: summary.startDate.toISOString(),
            endDate: summary.endDate.toISOString(),
            totalDistance: summary.totalDistance,
            totalDuration: summary.totalDuration,
            totalActivities: summary.totalActivities,
            averagePace: summary.averagePace,
            averageDistance: summary.averageDistance,
            activeDays: summary.activeDays,
          })),
        },
      },
    };
  } catch (error: any) {
    if (error.message === 'No token provided') {
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
    
    console.error('Error getting activity summary:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get activity summary',
        },
      },
    };
  }
});

// Export handler
export const handler = createHandler(router.handle.bind(router));