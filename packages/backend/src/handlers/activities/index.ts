/**
 * Activities Lambda handler with routing
 */

import { createHandler } from '../../utils/lambda-handler';
import { createRouter } from '../../utils/router';
import { validateEnvironment } from '../../config/environment';
import { verifyToken } from '../../utils/auth/jwt.utils';
import { prisma } from '../../lib/database';
import { ActivityService } from '../../services/activity/activity.service';
import { CreateActivityInput, UpdateActivityInput } from '../../services/activity/types';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { ProgressService, ProgressWebSocketIntegration } from '../../services/progress';
import { createWebSocketService } from '../../services/websocket';
import { createLogger } from '../../services/logger';

// Validate environment on cold start
validateEnvironment();

// Initialize services
const activityService = new ActivityService(prisma);
const progressService = new ProgressService(prisma);
const websocketService = createWebSocketService();
const progressWebSocket = new ProgressWebSocketIntegration(progressService, websocketService);
const logger = createLogger('ActivitiesHandler');

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

// Create activity (BE-014)
router.post('/', async (event, context, params) => {
  try {
    const user = getUserFromEvent(event);
    const input: CreateActivityInput = JSON.parse(event.body || '{}');

    // Validate input
    if (!input.teamIds || input.teamIds.length === 0) {
      return {
        statusCode: 400,
        body: {
          error: 'At least one teamId is required',
        },
      };
    }

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

    if (!input.activityDate) {
      return {
        statusCode: 400,
        body: {
          error: 'Activity date is required',
        },
      };
    }

    const result = await activityService.createActivity(user.sub, input);

    // Send real-time updates for each team
    try {
      for (const teamUpdate of result.teamUpdates) {
        // Get full progress data
        const progressData = await progressService.calculateTeamProgress(
          teamUpdate.teamId,
          { includeContributors: true, contributorLimit: 3 }
        );

        // Check for milestones
        const progressResult = await progressService.updateProgressAndCheckMilestones(
          teamUpdate.teamId,
          input.distance,
          1,
          input.duration
        );

        // Broadcast updates
        await progressWebSocket.broadcastProgressUpdate(
          teamUpdate.teamId,
          teamUpdate.teamId,
          progressData,
          progressResult.milestoneReached
        );

        // Also broadcast activity added event
        await progressWebSocket.broadcastActivityAdded(
          teamUpdate.teamId,
          {
            userId: user.sub,
            userName: result.activity.user.name,
            distance: input.distance,
            duration: input.duration,
          },
          {
            newTotalDistance: teamUpdate.newTotalDistance,
            newPercentComplete: teamUpdate.newPercentComplete,
            distanceAdded: input.distance,
          }
        );
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
          activity: {
            id: result.activity.id,
            userId: result.activity.userId,
            distance: result.activity.distance,
            duration: result.activity.duration,
            pace: result.activity.distance > 0 ? (result.activity.duration / 60) / (result.activity.distance / 1000) : 0,
            activityDate: result.activity.startTime.toISOString(),
            note: result.activity.notes,
            isPrivate: result.activity.isPrivate,
            createdAt: result.activity.createdAt.toISOString(),
          },
          teamUpdates: result.teamUpdates,
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
    if (error.message === 'User is not a member of all specified teams') {
      return {
        statusCode: 403,
        body: {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: error.message,
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
  try {
    const user = getUserFromEvent(event);
    
    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const options = {
      cursor: queryParams.cursor,
      limit: queryParams.limit ? parseInt(queryParams.limit) : undefined,
      teamId: queryParams.teamId,
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
            activityDate: item.activityDate.toISOString(),
            note: item.note,
            isPrivate: item.isPrivate,
            createdAt: item.createdAt.toISOString(),
            teams: item.teams,
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
          activity: {
            id: activity.id,
            userId: activity.userId,
            distance: activity.distance,
            duration: activity.duration,
            pace: activity.distance > 0 ? (activity.duration / 60) / (activity.distance / 1000) : 0,
            activityDate: activity.startTime.toISOString(),
            note: activity.notes,
            isPrivate: activity.isPrivate,
            createdAt: activity.createdAt.toISOString(),
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
  try {
    const user = getUserFromEvent(event);

    const result = await activityService.deleteActivity(
      params.id,
      user.sub
    );

    // Send real-time updates for team progress decrease
    try {
      for (const teamUpdate of result.teamUpdates) {
        // Broadcast the updated progress
        const progressData = await progressService.calculateTeamProgress(
          teamUpdate.teamId,
          { includeContributors: true, contributorLimit: 3 }
        );

        await progressWebSocket.broadcastProgressUpdate(
          teamUpdate.teamId,
          teamUpdate.teamId,
          progressData
        );
      }
    } catch (wsError) {
      logger.error('Failed to send WebSocket updates for deletion', { error: wsError });
      // Don't fail the request if WebSocket fails
    }

    return {
      statusCode: 200,
      body: {
        success: true,
        data: result,
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