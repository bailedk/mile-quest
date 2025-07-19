/**
 * Achievements Lambda handler with routing
 */

import { createHandler } from '../../utils/lambda-handler';
import { createRouter } from '../../utils/router';
import { validateEnvironment } from '../../config/environment';
import { verifyToken } from '../../utils/auth/jwt.utils';
import { prisma } from '../../lib/database';
import { AchievementService } from '../../services/achievement';
import { APIGatewayProxyEvent } from 'aws-lambda';

// Validate environment on cold start
validateEnvironment();

// Initialize services
const achievementService = new AchievementService(prisma);

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

// Manual achievement check endpoint
router.post('/check', async (event, _context, _params) => {
  try {
    const user = getUserFromEvent(event);
    const result = await achievementService.checkUserAchievements(user.sub);
    
    return {
      statusCode: 200,
      body: {
        message: 'Achievement check completed',
        newAchievements: result.newAchievements,
        checkedCount: result.checkedAchievements.length,
      },
    };
  } catch (error: any) {
    if (error.message === 'No token provided') {
      return {
        statusCode: 401,
        body: { error: 'Authentication required' },
      };
    }
    
    console.error('Error checking achievements:', error);
    return {
      statusCode: 500,
      body: { error: 'Failed to check achievements' },
    };
  }
});

// Export handler
export const handler = createHandler(router.handle.bind(router), {
  functionName: 'AchievementsHandler',
  enableCors: true,
});