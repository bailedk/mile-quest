/**
 * Teams Lambda handler with routing
 */

import { createHandler } from '../../utils/lambda-handler';
import { createRouter } from '../../utils/router';
import { validateEnvironment } from '../../config/environment';
import { isAuthError } from '../../utils/auth/jwt.utils';
import { getUserFromEvent } from '../../utils/auth/auth-helpers';
import { prisma } from '../../lib/database';
import { TeamService } from '../../services/team/team.service';
import { CreateTeamInput, UpdateTeamInput, JoinTeamInput } from '../../services/team/types';
import { ActivityService } from '../../services/activity/activity.service';
import { GoalService } from '../../services/goal/goal.service';
import { CreateGoalInput, UpdateGoalInput, GoalServiceError, GoalErrorCode } from '../../services/goal/types';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Validate environment on cold start
validateEnvironment();

// Initialize services
const teamService = new TeamService(prisma);
const activityService = new ActivityService(prisma);
const goalService = new GoalService(prisma);

// Create router
const router = createRouter();


// Create team (BE-011)
router.post('/', async (event, context, params) => {
  try {
    const user = getUserFromEvent(event);
    const input: CreateTeamInput = JSON.parse(event.body || '{}');

    // Validate input
    if (!input.name || input.name.trim().length < 3) {
      return {
        statusCode: 400,
        body: {
          error: 'Team name must be at least 3 characters long',
        },
      };
    }

    const team = await teamService.createTeam(user.id, input);

    return {
      statusCode: 201,
      body: team,
    };
  } catch (error: any) {
    if (isAuthError(error)) {
      return {
        statusCode: 401,
        body: { error: error.message || 'Authentication required' },
      };
    }
    if (error.message === 'Team name already exists') {
      return {
        statusCode: 409,
        body: { error: error.message },
      };
    }
    
    console.error('Error creating team:', error);
    return {
      statusCode: 500,
      body: { error: 'Failed to create team' },
    };
  }
});

// Get team details
router.get('/:id', async (event, context, params) => {
  try {
    let userId: string | undefined;
    try {
      const user = getUserFromEvent(event);
      userId = user.id;
    } catch {
      // No auth header - continue without user ID
    }
    const team = await teamService.getTeamById(params.id, userId);

    if (!team) {
      return {
        statusCode: 404,
        body: { error: 'Team not found or access denied' },
      };
    }

    return {
      statusCode: 200,
      body: team,
    };
  } catch (error) {
    console.error('Error fetching team:', error);
    return {
      statusCode: 500,
      body: { error: 'Failed to fetch team' },
    };
  }
});

// Get team progress (BE-015)
router.get('/:id/progress', async (event, context, params) => {
  try {
    const user = getUserFromEvent(event);
    const teamProgress = await activityService.getTeamProgress(params.id, user.id);

    return {
      statusCode: 200,
      body: {
        success: true,
        data: teamProgress,
      },
    };
  } catch (error: any) {
    if (isAuthError(error)) {
      return {
        statusCode: 401,
        body: {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: error.message || 'Authentication required',
          },
        },
      };
    }
    if (error.message === 'Team not found') {
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
    if (error.message === 'User is not a member of this team') {
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
    if (error.message === 'Team has no active goal' || error.message === 'Team progress not found') {
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
    
    console.error('Error getting team progress:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get team progress',
        },
      },
    };
  }
});

// Update team (BE-012)
router.patch('/:id', async (event, context, params) => {
  try {
    const user = getUserFromEvent(event);
    const input: UpdateTeamInput = JSON.parse(event.body || '{}');

    const team = await teamService.updateTeam(params.id, user.id, input);

    return {
      statusCode: 200,
      body: team,
    };
  } catch (error: any) {
    if (isAuthError(error)) {
      return {
        statusCode: 401,
        body: { error: error.message || 'Authentication required' },
      };
    }
    if (error.message === 'Unauthorized: Only team admins can update team details') {
      return {
        statusCode: 403,
        body: { error: error.message },
      };
    }
    if (error.message === 'Team name already exists') {
      return {
        statusCode: 409,
        body: { error: error.message },
      };
    }
    
    console.error('Error updating team:', error);
    return {
      statusCode: 500,
      body: { error: 'Failed to update team' },
    };
  }
});

// Delete team (BE-204)
router.delete('/:id', async (event, context, params) => {
  try {
    const user = getUserFromEvent(event);
    
    await teamService.deleteTeam(params.id, user.id);

    return {
      statusCode: 200,
      body: {
        success: true,
        message: 'Team deleted successfully',
      },
    };
  } catch (error: any) {
    if (isAuthError(error)) {
      return {
        statusCode: 401,
        body: { 
          success: false,
          error: error.message || 'Authentication required' 
        },
      };
    }
    if (error.message === 'Team not found or user is not a member') {
      return {
        statusCode: 404,
        body: { 
          success: false,
          error: error.message 
        },
      };
    }
    if (error.message === 'Only team admins can delete teams') {
      return {
        statusCode: 403,
        body: { 
          success: false,
          error: error.message 
        },
      };
    }
    
    console.error('Error deleting team:', error);
    return {
      statusCode: 500,
      body: { 
        success: false,
        error: 'Failed to delete team' 
      },
    };
  }
});

router.post('/:id/members', async (event, context, params) => {
  return {
    statusCode: 501,
    body: {
      message: 'Add team member endpoint - to be implemented in Sprint 2',
      task: 'BE-205',
      teamId: params.id,
    },
  };
});

router.delete('/:id/members/:userId', async (event, context, params) => {
  return {
    statusCode: 501,
    body: {
      message: 'Remove team member endpoint - to be implemented in Sprint 2',
      task: 'BE-206',
      teamId: params.id,
      userId: params.userId,
    },
  };
});

// Join team (BE-013)
router.post('/join', async (event, context, params) => {
  try {
    const user = getUserFromEvent(event);
    const input: JoinTeamInput = JSON.parse(event.body || '{}');

    const team = await teamService.joinTeam(user.id, input);

    return {
      statusCode: 200,
      body: team,
    };
  } catch (error: any) {
    const errorMessages = [
      'Invalid or expired invite code',
      'Team not found or is not public',
      'User is already a member of this team',
      'Team has reached maximum member limit',
    ];

    if (isAuthError(error)) {
      return {
        statusCode: 401,
        body: { error: error.message || 'Authentication required' },
      };
    }
    if (errorMessages.includes(error.message)) {
      return {
        statusCode: 400,
        body: { error: error.message },
      };
    }
    
    console.error('Error joining team:', error);
    return {
      statusCode: 500,
      body: { error: 'Failed to join team' },
    };
  }
});

// Create team goal (INT-006)
router.post('/:id/goals', async (event, context, params) => {
  try {
    const user = getUserFromEvent(event);
    const input: CreateGoalInput = JSON.parse(event.body || '{}');

    // All validation is now handled in the service layer with detailed error messages
    const goal = await goalService.createTeamGoal(params.id, user.id, input);

    return {
      statusCode: 201,
      body: {
        success: true,
        data: goal,
      },
    };
  } catch (error: any) {
    if (isAuthError(error)) {
      return {
        statusCode: 401,
        body: {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: error.message || 'Authentication required',
          },
        },
      };
    }
    
    // Handle GoalServiceError with specific error codes
    if (error instanceof GoalServiceError) {
      let statusCode = 400; // Default to bad request
      let errorCode = error.code;
      
      switch (error.code) {
        case GoalErrorCode.TEAM_NOT_FOUND:
        case GoalErrorCode.GOAL_NOT_FOUND:
          statusCode = 404;
          break;
        case GoalErrorCode.USER_NOT_MEMBER:
        case GoalErrorCode.INSUFFICIENT_PERMISSIONS:
          statusCode = 403;
          break;
        case GoalErrorCode.INVALID_NAME:
        case GoalErrorCode.INVALID_COORDINATES:
        case GoalErrorCode.INVALID_WAYPOINT_COUNT:
        case GoalErrorCode.INVALID_TARGET_DATE:
        case GoalErrorCode.DUPLICATE_WAYPOINT:
        case GoalErrorCode.DISTANCE_TOO_LONG:
          statusCode = 400;
          break;
        case GoalErrorCode.ROUTE_CALCULATION_FAILED:
        case GoalErrorCode.NO_ROUTE_FOUND:
          statusCode = 422;
          errorCode = 'ROUTE_ERROR';
          break;
        case GoalErrorCode.TEAM_HAS_ACTIVE_GOAL:
          statusCode = 409;
          errorCode = 'CONFLICT';
          break;
        default:
          statusCode = 500;
      }
      
      return {
        statusCode,
        body: {
          success: false,
          error: {
            code: errorCode,
            message: error.message,
            details: error.details,
          },
        },
      };
    }
    
    // Legacy error handling for backward compatibility
    if (error.message === 'Team not found or user is not a member') {
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
    if (error.message.includes('Route calculation failed')) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: {
            code: 'ROUTE_ERROR',
            message: error.message,
          },
        },
      };
    }

    console.error('Error creating team goal:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create team goal',
        },
      },
    };
  }
});

// Get team goals
router.get('/:id/goals', async (event, context, params) => {
  try {
    const user = getUserFromEvent(event);
    const goals = await goalService.getTeamGoals(params.id, user.id);

    return {
      statusCode: 200,
      body: {
        success: true,
        data: goals,
      },
    };
  } catch (error: any) {
    if (isAuthError(error)) {
      return {
        statusCode: 401,
        body: {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: error.message || 'Authentication required',
          },
        },
      };
    }

    console.error('Error getting team goals:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get team goals',
        },
      },
    };
  }
});

// Get active team goal
router.get('/:id/goals/active', async (event, context, params) => {
  try {
    const user = getUserFromEvent(event);
    const goal = await goalService.getTeamActiveGoal(params.id, user.id);

    if (!goal) {
      return {
        statusCode: 404,
        body: {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'No active goal found for this team',
          },
        },
      };
    }

    return {
      statusCode: 200,
      body: {
        success: true,
        data: goal,
      },
    };
  } catch (error: any) {
    if (isAuthError(error)) {
      return {
        statusCode: 401,
        body: {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: error.message || 'Authentication required',
          },
        },
      };
    }

    console.error('Error getting active team goal:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get active team goal',
        },
      },
    };
  }
});

// Create separate handler for goal-specific operations
router.get('/goals/:goalId/progress', async (event, context, params) => {
  try {
    const user = getUserFromEvent(event);
    const progress = await goalService.getGoalProgress(params.goalId, user.id);

    return {
      statusCode: 200,
      body: {
        success: true,
        data: progress,
      },
    };
  } catch (error: any) {
    if (isAuthError(error)) {
      return {
        statusCode: 401,
        body: {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: error.message || 'Authentication required',
          },
        },
      };
    }
    
    // Handle GoalServiceError
    if (error instanceof GoalServiceError) {
      const statusCode = error.code === GoalErrorCode.GOAL_NOT_FOUND ? 404 : 403;
      return {
        statusCode,
        body: {
          success: false,
          error: {
            code: error.code === GoalErrorCode.GOAL_NOT_FOUND ? 'NOT_FOUND' : 'FORBIDDEN',
            message: error.message,
            details: error.details,
          },
        },
      };
    }
    
    // Legacy error handling
    if (error.message === 'Goal not found or user does not have access') {
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

    console.error('Error getting goal progress:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get goal progress',
        },
      },
    };
  }
});

// Delete team goal
router.delete('/:id/goals/:goalId', async (event, context, params) => {
  try {
    const user = getUserFromEvent(event);
    
    await goalService.deleteTeamGoal(params.goalId, user.id);

    return {
      statusCode: 200,
      body: {
        success: true,
        message: 'Goal deleted successfully',
      },
    };
  } catch (error: any) {
    if (isAuthError(error)) {
      return {
        statusCode: 401,
        body: {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: error.message || 'Authentication required',
          },
        },
      };
    }
    
    // Handle GoalServiceError
    if (error instanceof GoalServiceError) {
      const statusCode = error.code === GoalErrorCode.GOAL_NOT_FOUND ? 404 : 403;
      return {
        statusCode,
        body: {
          success: false,
          error: {
            code: error.code === GoalErrorCode.GOAL_NOT_FOUND ? 'NOT_FOUND' : 'FORBIDDEN',
            message: error.message,
            details: error.details,
          },
        },
      };
    }

    console.error('Error deleting team goal:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete team goal',
        },
      },
    };
  }
});

// Update team goal
router.patch('/goals/:goalId', async (event, context, params) => {
  try {
    const user = getUserFromEvent(event);
    const input: UpdateGoalInput = JSON.parse(event.body || '{}');

    const goal = await goalService.updateTeamGoal(params.goalId, user.id, input);

    return {
      statusCode: 200,
      body: {
        success: true,
        data: goal,
      },
    };
  } catch (error: any) {
    if (isAuthError(error)) {
      return {
        statusCode: 401,
        body: {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: error.message || 'Authentication required',
          },
        },
      };
    }
    
    // Handle GoalServiceError with specific error codes
    if (error instanceof GoalServiceError) {
      let statusCode = 400; // Default to bad request
      let errorCode = error.code;
      
      switch (error.code) {
        case GoalErrorCode.TEAM_NOT_FOUND:
        case GoalErrorCode.GOAL_NOT_FOUND:
          statusCode = 404;
          break;
        case GoalErrorCode.USER_NOT_MEMBER:
        case GoalErrorCode.INSUFFICIENT_PERMISSIONS:
          statusCode = 403;
          break;
        case GoalErrorCode.GOAL_COMPLETED:
          statusCode = 409;
          errorCode = 'CONFLICT';
          break;
        case GoalErrorCode.INVALID_NAME:
        case GoalErrorCode.INVALID_COORDINATES:
        case GoalErrorCode.INVALID_WAYPOINT_COUNT:
        case GoalErrorCode.INVALID_TARGET_DATE:
        case GoalErrorCode.DUPLICATE_WAYPOINT:
        case GoalErrorCode.DISTANCE_TOO_LONG:
          statusCode = 400;
          break;
        case GoalErrorCode.ROUTE_CALCULATION_FAILED:
        case GoalErrorCode.NO_ROUTE_FOUND:
          statusCode = 422;
          errorCode = 'ROUTE_ERROR';
          break;
        case GoalErrorCode.TEAM_HAS_ACTIVE_GOAL:
          statusCode = 409;
          errorCode = 'CONFLICT';
          break;
        default:
          statusCode = 500;
      }
      
      return {
        statusCode,
        body: {
          success: false,
          error: {
            code: errorCode,
            message: error.message,
            details: error.details,
          },
        },
      };
    }
    
    // Legacy error handling
    if (error.message === 'Goal not found or user does not have permission') {
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
    if (error.message.includes('Route calculation failed')) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: {
            code: 'ROUTE_ERROR',
            message: error.message,
          },
        },
      };
    }

    console.error('Error updating team goal:', error);
    return {
      statusCode: 500,
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update team goal',
        },
      },
    };
  }
});

// Export handler
export const handler = createHandler(router.handle.bind(router));