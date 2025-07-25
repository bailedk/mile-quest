import { APIGatewayProxyEvent } from 'aws-lambda';
import { createRouter } from '../../utils/router';
import { isAuthError } from '../../utils/auth/jwt.utils';
import { getUserFromEvent } from '../../utils/auth/auth-helpers';
import { prisma } from '../../lib/database';
import { ProgressService } from '../../services/progress';
import { createLogger } from '../../services/logger';

const logger = createLogger('ProgressHandler');
const progressService = new ProgressService(prisma);
const router = createRouter();

// Test route for debugging
router.get('/test', async (event, context, params) => {
  try {
    const teamCount = await prisma.team.count();
    const progressCount = await prisma.teamProgress.count();
    
    return {
      statusCode: 200,
      body: {
        success: true,
        teamCount,
        progressCount,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error: any) {
    logger.error('Test route error', { error });
    return {
      statusCode: 500,
      body: {
        error: 'Test route failed',
        message: error.message
      }
    };
  }
});


/**
 * GET /progress/team/:teamId
 * Get progress for all goals of a team
 */
router.get('/team/:teamId', async (event, context, params) => {
  try {
    const user = getUserFromEvent(event);
    const { teamId } = params;

    if (!teamId) {
      return {
        statusCode: 400,
        body: { error: 'Team ID is required' },
      };
    }

    // Verify user is a member of the team
    const membership = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId: user.id,
        leftAt: null,
      },
    });

    if (!membership) {
      return {
        statusCode: 403,
        body: { error: 'Access denied' },
      };
    }

    // Get progress for all team goals
    const progress = await progressService.getMultipleTeamProgress(
      { teamIds: [teamId] },
      {
        includeEstimates: true,
        includeContributors: true,
        contributorLimit: 5,
      }
    );

    return {
      statusCode: 200,
      body: { progress },
    };
  } catch (error) {
    if (isAuthError(error)) {
      return {
        statusCode: 401,
        body: { error: 'Authentication required' },
      };
    }
    
    logger.error('Failed to get team progress', { error });
    return {
      statusCode: 500,
      body: { error: 'Failed to get team progress' },
    };
  }
});

/**
 * GET /progress/goal/:goalId
 * Get detailed progress for a specific goal
 */
router.get('/goal/:goalId', async (event, context, params) => {
  try {
    const user = getUserFromEvent(event);
    const { goalId } = params;

    if (!goalId) {
      return {
        statusCode: 400,
        body: { error: 'Goal ID is required' },
      };
    }

    // Verify user has access to this goal
    const goal = await prisma.teamGoal.findUnique({
      where: { id: goalId },
      include: {
        team: {
          include: {
            members: {
              where: {
                userId: user.id,
                leftAt: null,
              },
            },
          },
        },
      },
    });

    if (!goal || goal.team.members.length === 0) {
      return {
        statusCode: 403,
        body: { error: 'Access denied' },
      };
    }

    // Get detailed progress
    const progress = await progressService.calculateTeamProgress(goalId, {
      includeEstimates: true,
      includeContributors: true,
      contributorLimit: 10,
    });

    return {
      statusCode: 200,
      body: { progress },
    };
  } catch (error) {
    if (isAuthError(error)) {
      return {
        statusCode: 401,
        body: { error: 'Authentication required' },
      };
    }
    
    logger.error('Failed to get goal progress', { error });
    return {
      statusCode: 500,
      body: { error: 'Failed to get goal progress' },
    };
  }
});

/**
 * GET /progress/goal/:goalId/daily
 * Get daily progress summary for a goal
 */
router.get('/goal/:goalId/daily', async (event, context, params) => {
  try {
    const user = getUserFromEvent(event);
    const { goalId } = params;
    const { days = '7' } = event.queryStringParameters || {};

    if (!goalId) {
      return {
        statusCode: 400,
        body: { error: 'Goal ID is required' },
      };
    }

    // Verify user has access
    const goal = await prisma.teamGoal.findUnique({
      where: { id: goalId },
      include: {
        team: {
          include: {
            members: {
              where: {
                userId: user.id,
                leftAt: null,
              },
            },
          },
        },
      },
    });

    if (!goal || goal.team.members.length === 0) {
      return {
        statusCode: 403,
        body: { error: 'Access denied' },
      };
    }

    // Get daily summary
    const summary = await progressService.getDailyProgressSummary(
      goal.teamId,
      parseInt(days, 10)
    );

    return {
      statusCode: 200,
      body: { summary },
    };
  } catch (error) {
    if (isAuthError(error)) {
      return {
        statusCode: 401,
        body: { error: 'Authentication required' },
      };
    }
    
    logger.error('Failed to get daily summary', { error });
    return {
      statusCode: 500,
      body: { error: 'Failed to get daily summary' },
    };
  }
});

/**
 * GET /progress/goal/:goalId/trend
 * Get progress trend analysis
 */
router.get('/goal/:goalId/trend', async (event, context, params) => {
  try {
    const user = getUserFromEvent(event);
    const { goalId } = params;
    const { period = 'WEEK' } = event.queryStringParameters || {};

    if (!goalId) {
      return {
        statusCode: 400,
        body: { error: 'Goal ID is required' },
      };
    }

    // Verify user has access
    const goal = await prisma.teamGoal.findUnique({
      where: { id: goalId },
      include: {
        team: {
          include: {
            members: {
              where: {
                userId: user.id,
                leftAt: null,
              },
            },
          },
        },
      },
    });

    if (!goal || goal.team.members.length === 0) {
      return {
        statusCode: 403,
        body: { error: 'Access denied' },
      };
    }

    // Get trend analysis
    const trend = await progressService.calculateProgressTrend(
      goal.teamId,
      period as 'WEEK' | 'MONTH'
    );

    return {
      statusCode: 200,
      body: { trend },
    };
  } catch (error) {
    if (isAuthError(error)) {
      return {
        statusCode: 401,
        body: { error: 'Authentication required' },
      };
    }
    
    logger.error('Failed to get progress trend', { error });
    return {
      statusCode: 500,
      body: { error: 'Failed to get progress trend' },
    };
  }
});

// Export handler for Lambda
export const handler = router.handle;