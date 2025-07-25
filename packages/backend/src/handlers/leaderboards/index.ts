/**
 * Leaderboards Lambda handler with routing
 * Handles team and global leaderboard endpoints for BE-018
 */

import { createHandler } from '../../utils/lambda-handler';
import { createRouter } from '../../utils/router';
import { validateEnvironment } from '../../config/environment';
import { isAuthError } from '../../utils/auth/jwt.utils';
import { getUserFromEvent } from '../../utils/auth/auth-helpers';
import { prisma } from '../../lib/database';
import { LeaderboardService, LeaderboardPeriod } from '../../services/leaderboard';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Validate environment on cold start
validateEnvironment();

// Initialize services
const leaderboardService = new LeaderboardService(prisma);

// Create router
const router = createRouter();


// Helper to validate period parameter
const validatePeriod = (period: string | undefined): LeaderboardPeriod => {
  if (!period || !['week', 'month', 'all'].includes(period)) {
    return 'week'; // Default to week
  }
  return period as LeaderboardPeriod;
};

// Helper to validate and parse limit
const validateLimit = (limit: string | undefined): number => {
  if (!limit) return 50; // Default limit
  const parsed = parseInt(limit, 10);
  if (isNaN(parsed) || parsed < 1) return 50;
  return Math.min(parsed, 100); // Max 100 entries
};

// GET /teams/:teamId/leaderboard - Team leaderboard
router.get('/teams/:teamId/leaderboard', async (event, context, params) => {
  try {
    const user = getUserFromEvent(event);
    const { teamId } = params;
    
    if (!teamId) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Team ID is required',
          },
        },
      };
    }

    const period = validatePeriod(event.queryStringParameters?.period);
    const limit = validateLimit(event.queryStringParameters?.limit);
    const teamGoalId = event.queryStringParameters?.teamGoalId;

    const leaderboard = await leaderboardService.getTeamLeaderboard(
      teamId,
      user.id,
      {
        period,
        limit,
        userId: user.id,
        teamGoalId,
      }
    );

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          leaderboard,
        },
      },
    };
  } catch (error) {
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
    
    console.error('Team leaderboard error:', error);
    
    if (error instanceof Error) {
      if (error.message === 'User is not a member of this team') {
        return {
          statusCode: 403,
          body: {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You are not a member of this team',
            },
          },
        };
      }
    }

    return {
      statusCode: 500,
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get team leaderboard',
        },
      },
    };
  }
});

// GET /leaderboards/global - Global leaderboard
router.get('/leaderboards/global', async (event, context, params) => {
  try {
    const user = getUserFromEvent(event);
    
    const period = validatePeriod(event.queryStringParameters?.period);
    const limit = validateLimit(event.queryStringParameters?.limit);

    const leaderboard = await leaderboardService.getGlobalLeaderboard(
      user.id,
      {
        period,
        limit,
        userId: user.id,
      }
    );

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          leaderboard,
        },
      },
    };
  } catch (error) {
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
    
    console.error('Global leaderboard error:', error);
    
    return {
      statusCode: 500,
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get global leaderboard',
        },
      },
    };
  }
});

// GET /teams/:teamId/leaderboard/rank - User's rank in team
router.get('/teams/:teamId/leaderboard/rank', async (event, context, params) => {
  try {
    const user = getUserFromEvent(event);
    const { teamId } = params;
    
    if (!teamId) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Team ID is required',
          },
        },
      };
    }

    const period = validatePeriod(event.queryStringParameters?.period);
    const teamGoalId = event.queryStringParameters?.teamGoalId;

    const rank = await leaderboardService.getUserRank(
      user.id,
      teamId,
      {
        period,
        teamGoalId,
      }
    );

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          rank,
        },
      },
    };
  } catch (error) {
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
    
    console.error('User rank error:', error);
    
    if (error instanceof Error) {
      if (error.message === 'User is not a member of this team') {
        return {
          statusCode: 403,
          body: {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'You are not a member of this team',
            },
          },
        };
      }

      if (error.message === 'User not found in team leaderboard') {
        return {
          statusCode: 404,
          body: {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'User not found in leaderboard',
            },
          },
        };
      }
    }

    return {
      statusCode: 500,
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get user rank',
        },
      },
    };
  }
});

// Route handler function
async function leaderboardsHandler(event: APIGatewayProxyEvent, context: Context) {
  return router.handle(event, context);
}

// Export handler
export const handler = createHandler(leaderboardsHandler);