/**
 * Activities Lambda handler with routing
 * Updated to use standardized API response format
 */

import { createHandler } from '../../utils/lambda-handler';
import { createRouter } from '../../utils/router';
import { validateEnvironment } from '../../config/environment';
import { isAuthError } from '../../utils/auth/jwt.utils';
import { getUserFromEvent } from '../../utils/auth/auth-helpers';
import { prisma } from '../../lib/database';
import { ActivityService } from '../../services/activity/activity.service';
import { UpdateActivityInput } from '../../services/activity/types';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { ProgressService, ProgressWebSocketIntegration } from '../../services/progress';
import { createWebSocketService } from '../../services/websocket';
import { createLogger } from '../../services/logger';
import { 
  successResponse, 
  errorResponse, 
  CommonResponses, 
  parseBody,
  toApiError
} from '../../utils/api-response';

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
    logger = createLogger('ActivitiesHandler');
    logger.info('Initializing services', {
      WEBSOCKET_PROVIDER: process.env.WEBSOCKET_PROVIDER,
      NODE_ENV: process.env.NODE_ENV
    });
    
    activityService = new ActivityService(prisma);
    progressService = new ProgressService(prisma);
    
    // Create WebSocket service with fallback to mock for local development
    try {
      websocketService = createWebSocketService();
    } catch (error) {
      logger.warn('Failed to create WebSocket service, falling back to mock:', error);
      // Force mock service creation
      const { MockWebSocketService } = require('../../services/websocket/mock.service');
      websocketService = new MockWebSocketService({});
    }
    
    progressWebSocket = new ProgressWebSocketIntegration(progressService, websocketService);
  }
}

// Create router
const router = createRouter();

// Create activity
router.post('/', async (event, context, params) => {
  initializeServices();
  
  try {
    logger.info('POST /activities - Request received');
    const user = getUserFromEvent(event);
    logger.info('User authenticated', { userId: user.id });
    
    const input = parseBody(event.body);
    if (!input) {
      return CommonResponses.badRequest('Request body is required');
    }

    // Validate input
    if (typeof input.distance !== 'number' || input.distance <= 0) {
      return CommonResponses.badRequest('Distance must be a positive number');
    }

    if (typeof input.duration !== 'number' || input.duration <= 0) {
      return CommonResponses.badRequest('Duration must be a positive number');
    }

    if (!input.timestamp) {
      return CommonResponses.badRequest('Timestamp is required');
    }

    const timestamp = new Date(input.timestamp);
    const now = new Date();
    
    if (timestamp > now) {
      return CommonResponses.badRequest('Cannot log future activities');
    }

    logger.info('Creating activity', {
      userId: user.id,
      distance: input.distance,
      duration: input.duration,
      timestamp,
    });

    const result = await activityService.createActivity(user.id, {
      distance: input.distance,
      duration: input.duration,
      timestamp,
      notes: input.notes,
      isPrivate: input.isPrivate ?? false,
      source: input.source ?? 'MANUAL',
    });
    
    logger.info('Activity created successfully', { activityId: result.activity.id });

    // Send real-time updates to user's teams if needed
    try {
      const userTeams = await prisma.teamMember.findMany({
        where: {
          userId: user.id,
          leftAt: null,
        },
        select: { teamId: true }
      });

      await Promise.all(
        userTeams.map(({ teamId }) => 
          progressWebSocket.handleActivityUpdate(
            teamId,
            result.activity.teamGoalId || undefined
          )
        )
      );
    } catch (wsError) {
      logger.error('Failed to send WebSocket updates', wsError);
      // Don't fail the request if WebSocket fails
    }
    
    return successResponse(result, 201);
  } catch (error) {
    logger.error('Failed to create activity', error);
    
    if (isAuthError(error)) {
      return CommonResponses.unauthorized();
    }
    
    const apiError = toApiError(error);
    return errorResponse(apiError, apiError.statusCode);
  }
});

// Get user's activities
router.get('/', async (event, context, params) => {
  initializeServices();
  
  try {
    const user = getUserFromEvent(event);
    const startDate = event.queryStringParameters?.startDate;
    const endDate = event.queryStringParameters?.endDate;
    const teamId = event.queryStringParameters?.teamId;
    const limit = event.queryStringParameters?.limit 
      ? parseInt(event.queryStringParameters.limit) 
      : 100;
    const offset = event.queryStringParameters?.offset 
      ? parseInt(event.queryStringParameters.offset) 
      : 0;

    const activities = await activityService.getUserActivities(
      user.id,
      {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        teamId,
      },
      limit,
      offset
    );
    
    return successResponse(activities);
  } catch (error) {
    logger.error('Failed to get activities', error);
    
    if (isAuthError(error)) {
      return CommonResponses.unauthorized();
    }
    
    const apiError = toApiError(error);
    return errorResponse(apiError, apiError.statusCode);
  }
});

// Get activity by ID
router.get('/:id', async (event, context, params) => {
  initializeServices();
  
  try {
    const user = getUserFromEvent(event);
    const activityId = params.id;
    
    const activity = await prisma.activity.findFirst({
      where: {
        id: activityId,
        userId: user.id,
      },
    });
    
    if (!activity) {
      return CommonResponses.notFound('Activity');
    }
    
    return successResponse(activity);
  } catch (error) {
    logger.error('Failed to get activity', error);
    
    if (isAuthError(error)) {
      return CommonResponses.unauthorized();
    }
    
    const apiError = toApiError(error);
    return errorResponse(apiError, apiError.statusCode);
  }
});

// Update activity
router.put('/:id', async (event, context, params) => {
  initializeServices();
  
  try {
    const user = getUserFromEvent(event);
    const activityId = params.id;
    const input = parseBody<UpdateActivityInput>(event.body);
    
    if (!input) {
      return CommonResponses.badRequest('Request body is required');
    }

    const result = await activityService.updateActivity(
      user.id,
      activityId,
      input
    );
    
    return successResponse(result);
  } catch (error) {
    logger.error('Failed to update activity', error);
    
    if (isAuthError(error)) {
      return CommonResponses.unauthorized();
    }
    
    if (error instanceof Error && error.message.includes('not found')) {
      return CommonResponses.notFound('Activity');
    }
    
    const apiError = toApiError(error);
    return errorResponse(apiError, apiError.statusCode);
  }
});

// Delete activity
router.delete('/:id', async (event, context, params) => {
  initializeServices();
  
  try {
    const user = getUserFromEvent(event);
    const activityId = params.id;
    
    await activityService.deleteActivity(user.id, activityId);
    
    return successResponse({ message: 'Activity deleted successfully' }, 200);
  } catch (error) {
    logger.error('Failed to delete activity', error);
    
    if (isAuthError(error)) {
      return CommonResponses.unauthorized();
    }
    
    if (error instanceof Error && error.message.includes('not found')) {
      return CommonResponses.notFound('Activity');
    }
    
    const apiError = toApiError(error);
    return errorResponse(apiError, apiError.statusCode);
  }
});

// Get activity summary
router.get('/summary', async (event, context, params) => {
  initializeServices();
  
  try {
    const user = getUserFromEvent(event);
    const period = event.queryStringParameters?.period || 'week';
    const startDate = event.queryStringParameters?.startDate;
    const endDate = event.queryStringParameters?.endDate;
    const teamId = event.queryStringParameters?.teamId;

    const summary = await activityService.getActivitySummary(
      user.id,
      period as any,
      {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        teamId,
      }
    );
    
    return successResponse(summary);
  } catch (error) {
    logger.error('Failed to get activity summary', error);
    
    if (isAuthError(error)) {
      return CommonResponses.unauthorized();
    }
    
    const apiError = toApiError(error);
    return errorResponse(apiError, apiError.statusCode);
  }
});

// Get current streak
router.get('/streak', async (event, context, params) => {
  initializeServices();
  
  try {
    const user = getUserFromEvent(event);
    const streak = await activityService.getCurrentStreak(user.id);
    
    return successResponse({ streak });
  } catch (error) {
    logger.error('Failed to get streak', error);
    
    if (isAuthError(error)) {
      return CommonResponses.unauthorized();
    }
    
    const apiError = toApiError(error);
    return errorResponse(apiError, apiError.statusCode);
  }
});

// Export handler
export const handler = createHandler(router.handle.bind(router));