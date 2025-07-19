import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createRouter } from '../../utils/router';
import { withAuth } from '../../middleware/auth.middleware';
import { PrismaClient } from '@prisma/client';
import { ProgressService } from '../../services/progress';
import { createLogger } from '../../services/logger';

const prisma = new PrismaClient();
const logger = createLogger('ProgressHandler');
const progressService = new ProgressService(prisma);
const router = createRouter();

/**
 * GET /api/progress/team/:teamId
 * Get progress for all goals of a team
 */
router.get('/api/progress/team/:teamId', withAuth(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { teamId } = event.pathParameters || {};
    const userId = (event as any).userId;

    if (!teamId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Team ID is required' }),
      };
    }

    // Verify user is a member of the team
    const membership = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId,
        leftAt: null,
      },
    });

    if (!membership) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Access denied' }),
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
      body: JSON.stringify({ progress }),
    };
  } catch (error) {
    logger.error('Failed to get team progress', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to get team progress' }),
    };
  }
}));

/**
 * GET /api/progress/goal/:goalId
 * Get detailed progress for a specific goal
 */
router.get('/api/progress/goal/:goalId', withAuth(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { goalId } = event.pathParameters || {};
    const userId = (event as any).userId;

    if (!goalId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Goal ID is required' }),
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
                userId,
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
        body: JSON.stringify({ error: 'Access denied' }),
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
      body: JSON.stringify({ progress }),
    };
  } catch (error) {
    logger.error('Failed to get goal progress', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to get goal progress' }),
    };
  }
}));

/**
 * GET /api/progress/goal/:goalId/daily
 * Get daily progress summary for a goal
 */
router.get('/api/progress/goal/:goalId/daily', withAuth(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { goalId } = event.pathParameters || {};
    const { days = '7' } = event.queryStringParameters || {};
    const userId = (event as any).userId;

    if (!goalId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Goal ID is required' }),
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
                userId,
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
        body: JSON.stringify({ error: 'Access denied' }),
      };
    }

    // Get daily summary
    const summary = await progressService.getDailyProgressSummary(
      goal.teamId,
      parseInt(days, 10)
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ summary }),
    };
  } catch (error) {
    logger.error('Failed to get daily summary', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to get daily summary' }),
    };
  }
}));

/**
 * GET /api/progress/goal/:goalId/trend
 * Get progress trend analysis
 */
router.get('/api/progress/goal/:goalId/trend', withAuth(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { goalId } = event.pathParameters || {};
    const { period = 'WEEK' } = event.queryStringParameters || {};
    const userId = (event as any).userId;

    if (!goalId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Goal ID is required' }),
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
                userId,
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
        body: JSON.stringify({ error: 'Access denied' }),
      };
    }

    // Get trend analysis
    const trend = await progressService.calculateProgressTrend(
      goal.teamId,
      period as 'WEEK' | 'MONTH'
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ trend }),
    };
  } catch (error) {
    logger.error('Failed to get progress trend', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to get progress trend' }),
    };
  }
}));

// Export handler for Lambda
export const handler = router.handler();