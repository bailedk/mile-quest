/**
 * Users Lambda handler with routing
 */

import { createHandler } from '../../utils/lambda-handler';
import { createRouter } from '../../utils/router';
import { validateEnvironment } from '../../config/environment';
import { isAuthError } from '../../utils/auth/jwt.utils';
import { getUserFromEvent } from '../../utils/auth/auth-helpers';
import { prisma } from '../../lib/database';
import { TeamService } from '../../services/team/team.service';
import { ActivityService } from '../../services/activity/activity.service';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { AuthUser } from '@mile-quest/shared';

// Validate environment on cold start
validateEnvironment();

// Initialize services lazily to avoid cold start issues
let teamService: TeamService;
let activityService: ActivityService;

function initializeServices() {
  if (!teamService) {
    console.log('Users handler env check:', {
      DATABASE_URL: process.env.DATABASE_URL,
      JWT_SECRET: process.env.JWT_SECRET,
      NODE_ENV: process.env.NODE_ENV
    });
    teamService = new TeamService(prisma);
    activityService = new ActivityService(prisma);
  }
}

// Create router
const router = createRouter();


// Test endpoint
router.get('/test', async (_event, _context, _params) => {
  return {
    statusCode: 200,
    body: { message: 'Users handler working' },
  };
});

// Get current user (BE-106)
router.get('/me', async (event, _context, _params) => {
  try {
    const user = getUserFromEvent(event);
    
    // Get user from database with latest data
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    });
    
    if (!dbUser) {
      return {
        statusCode: 404,
        body: { error: 'User not found' },
      };
    }
    
    const authUser: AuthUser = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      emailVerified: dbUser.emailVerified,
      preferredUnits: dbUser.preferredUnits as 'miles' | 'kilometers',
      timezone: dbUser.timezone,
      createdAt: dbUser.createdAt.toISOString(),
      updatedAt: dbUser.updatedAt.toISOString(),
    };
    
    return {
      statusCode: 200,
      body: authUser,
    };
  } catch (error: any) {
    if (isAuthError(error)) {
      return {
        statusCode: 401,
        body: { error: error.message || 'Authentication required' },
      };
    }
    
    console.error('Error fetching user profile:', error);
    return {
      statusCode: 500,
      body: { error: 'Failed to fetch user profile' },
    };
  }
});

// Get user teams (BE-010)
router.get('/me/teams', async (event, _context, _params) => {
  initializeServices();
  
  try {
    const user = getUserFromEvent(event);
    const teams = await teamService.getUserTeams(user.id);
    
    return {
      statusCode: 200,
      body: teams,
    };
  } catch (error: any) {
    if (isAuthError(error)) {
      return {
        statusCode: 401,
        body: { error: error.message || 'Authentication required' },
      };
    }
    
    console.error('Error fetching user teams:', error);
    return {
      statusCode: 500,
      body: { error: 'Failed to fetch teams' },
    };
  }
});

// Get user activity stats
router.get('/me/stats', async (event, _context, _params) => {
  initializeServices();
  
  try {
    const user = getUserFromEvent(event);
    const stats = await activityService.getUserStats(user.id);
    
    return {
      statusCode: 200,
      body: stats,
    };
  } catch (error: any) {
    if (isAuthError(error)) {
      return {
        statusCode: 401,
        body: { error: error.message || 'Authentication required' },
      };
    }
    
    return {
      statusCode: 500,
      body: { error: 'Failed to fetch user stats' },
    };
  }
});

// Get user activities
router.get('/me/activities', async (event, _context, _params) => {
  initializeServices();
  
  try {
    const user = getUserFromEvent(event);
    
    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const limit = queryParams.limit ? parseInt(queryParams.limit) : 20;
    const cursor = queryParams.cursor;
    const startDate = queryParams.startDate;
    const endDate = queryParams.endDate;
    
    const activities = await activityService.getActivities(user.id, {
      limit,
      cursor,
      startDate,
      endDate,
    });
    return {
      statusCode: 200,
      body: activities,
    };
  } catch (error: any) {
    if (isAuthError(error)) {
      return {
        statusCode: 401,
        body: { error: error.message || 'Authentication required' },
      };
    }
    
    return {
      statusCode: 500,
      body: { error: 'Failed to fetch activities' },
    };
  }
});

// Update current user (BE-107)
router.patch('/me', async (event, _context, _params) => {
  try {
    const user = getUserFromEvent(event);
    const body = JSON.parse(event.body || '{}');
    
    // Validate input - only allow updating name for now
    const updates: { name?: string } = {};
    
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        return {
          statusCode: 400,
          body: { error: 'Name must be a non-empty string' },
        };
      }
      updates.name = body.name.trim();
    }
    
    // If no valid updates provided
    if (Object.keys(updates).length === 0) {
      return {
        statusCode: 400,
        body: { error: 'No valid fields to update' },
      };
    }
    
    // Update user in database
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updates,
    });
    
    const authUser: AuthUser = {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      emailVerified: updatedUser.emailVerified,
      preferredUnits: updatedUser.preferredUnits as 'miles' | 'kilometers',
      timezone: updatedUser.timezone,
      createdAt: updatedUser.createdAt.toISOString(),
      updatedAt: updatedUser.updatedAt.toISOString(),
    };
    
    return {
      statusCode: 200,
      body: authUser,
    };
  } catch (error: any) {
    if (isAuthError(error)) {
      return {
        statusCode: 401,
        body: { error: error.message || 'Authentication required' },
      };
    }
    
    console.error('Error updating user profile:', error);
    return {
      statusCode: 500,
      body: { error: 'Failed to update user profile' },
    };
  }
});

router.get('/:id', async (_event, _context, params) => {
  return {
    statusCode: 501,
    body: {
      message: 'Get user by ID endpoint - to be implemented',
      userId: params.id,
    },
  };
});

// Export handler
export const handler = createHandler(router.handle.bind(router));