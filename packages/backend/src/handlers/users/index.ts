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
import { AchievementService } from '../../services/achievement';
import { APIGatewayProxyEvent } from 'aws-lambda';

// Validate environment on cold start
validateEnvironment();

// Initialize services lazily to avoid cold start issues
let teamService: TeamService;
let activityService: ActivityService;
let achievementService: AchievementService;

function initializeServices() {
  if (!teamService) {
    console.log('Users handler env check:', {
      DATABASE_URL: process.env.DATABASE_URL,
      JWT_SECRET: process.env.JWT_SECRET,
      NODE_ENV: process.env.NODE_ENV
    });
    teamService = new TeamService(prisma);
    activityService = new ActivityService(prisma);
    achievementService = new AchievementService(prisma);
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

// Get user achievements (BE-019)
router.get('/me/achievements', async (event, _context, _params) => {
  try {
    const user = getUserFromEvent(event);
    const achievements = await achievementService.getUserAchievements(user.id);
    
    return {
      statusCode: 200,
      body: achievements,
    };
  } catch (error: any) {
    if (isAuthError(error)) {
      return {
        statusCode: 401,
        body: { error: error.message || 'Authentication required' },
      };
    }
    
    console.error('Error fetching user achievements:', error);
    return {
      statusCode: 500,
      body: { error: 'Failed to fetch achievements' },
    };
  }
});

// Manual achievement check for user (BE-019)
router.post('/me/achievements/check', async (event, _context, _params) => {
  try {
    const user = getUserFromEvent(event);
    const result = await achievementService.checkUserAchievements(user.id);
    
    return {
      statusCode: 200,
      body: {
        message: 'Achievement check completed',
        newAchievements: result.newAchievements,
        checkedCount: result.checkedAchievements.length,
      },
    };
  } catch (error: any) {
    if (isAuthError(error)) {
      return {
        statusCode: 401,
        body: { error: error.message || 'Authentication required' },
      };
    }
    
    console.error('Error checking achievements:', error);
    return {
      statusCode: 500,
      body: { error: 'Failed to check achievements' },
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
export const handler = createHandler(router.handle.bind(router));