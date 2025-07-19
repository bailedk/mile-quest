/**
 * Users Lambda handler with routing
 */

import { createHandler } from '../../utils/lambda-handler';
import { createRouter } from '../../utils/router';
import { validateEnvironment } from '../../config/environment';
import { verifyToken } from '../../utils/auth/jwt.utils';
import { prisma } from '../../lib/database';
import { TeamService } from '../../services/team/team.service';
import { ActivityService } from '../../services/activity/activity.service';
import { APIGatewayProxyEvent } from 'aws-lambda';

// Validate environment on cold start
validateEnvironment();

// Initialize services
const teamService = new TeamService(prisma);
const activityService = new ActivityService(prisma);

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

// Get current user (to be implemented in Sprint 1)
router.get('/me', async (_event, _context, _params) => {
  return {
    statusCode: 501,
    body: {
      message: 'Get current user endpoint - to be implemented in Sprint 1',
      task: 'BE-106',
    },
  };
});

// Get user teams (BE-010)
router.get('/me/teams', async (event, _context, _params) => {
  try {
    const user = getUserFromEvent(event);
    const teams = await teamService.getUserTeams(user.sub);
    
    return {
      statusCode: 200,
      body: teams,
    };
  } catch (error: any) {
    if (error.message === 'No token provided') {
      return {
        statusCode: 401,
        body: { error: 'Authentication required' },
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
  try {
    const user = getUserFromEvent(event);
    const stats = await activityService.getUserStats(user.sub);
    
    return {
      statusCode: 200,
      body: stats,
    };
  } catch (error: any) {
    if (error.message === 'No token provided') {
      return {
        statusCode: 401,
        body: { error: 'Authentication required' },
      };
    }
    
    console.error('Error fetching user stats:', error);
    return {
      statusCode: 500,
      body: { error: 'Failed to fetch user stats' },
    };
  }
});

router.patch('/me', async (_event, _context, _params) => {
  return {
    statusCode: 501,
    body: {
      message: 'Update current user endpoint - to be implemented in Sprint 1',
      task: 'BE-107',
    },
  };
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
export const handler = createHandler(router.handle.bind(router), {
  functionName: 'UsersHandler',
  enableCors: true,
});