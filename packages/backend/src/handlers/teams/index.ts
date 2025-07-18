/**
 * Teams Lambda handler with routing
 */

import { createHandler } from '../../utils/lambda-handler';
import { createRouter } from '../../utils/router';
import { validateEnvironment } from '../../config/environment';

// Validate environment on cold start
validateEnvironment();

// Create router
const router = createRouter();

// Route handlers will be added in Sprint 2
router.post('/', async (event, context, params) => {
  return {
    statusCode: 501,
    body: {
      message: 'Create team endpoint - to be implemented in Sprint 2',
      task: 'BE-201',
    },
  };
});

router.get('/:id', async (event, context, params) => {
  return {
    statusCode: 501,
    body: {
      message: 'Get team endpoint - to be implemented in Sprint 2',
      task: 'BE-202',
      teamId: params.id,
    },
  };
});

router.patch('/:id', async (event, context, params) => {
  return {
    statusCode: 501,
    body: {
      message: 'Update team endpoint - to be implemented in Sprint 2',
      task: 'BE-203',
      teamId: params.id,
    },
  };
});

router.delete('/:id', async (event, context, params) => {
  return {
    statusCode: 501,
    body: {
      message: 'Delete team endpoint - to be implemented in Sprint 2',
      task: 'BE-204',
      teamId: params.id,
    },
  };
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

router.post('/join', async (event, context, params) => {
  return {
    statusCode: 501,
    body: {
      message: 'Join team endpoint - to be implemented in Sprint 2',
      task: 'BE-207',
    },
  };
});

// Export handler
export const handler = createHandler(router.handle.bind(router));