/**
 * Users Lambda handler with routing
 */

import { createHandler } from '../../utils/lambda-handler';
import { createRouter } from '../../utils/router';
import { validateEnvironment } from '../../config/environment';

// Validate environment on cold start
validateEnvironment();

// Create router
const router = createRouter();

// Route handlers will be added in Sprint 1
router.get('/me', async (event, context, params) => {
  return {
    statusCode: 501,
    body: {
      message: 'Get current user endpoint - to be implemented in Sprint 1',
      task: 'BE-106',
    },
  };
});

router.patch('/me', async (event, context, params) => {
  return {
    statusCode: 501,
    body: {
      message: 'Update current user endpoint - to be implemented in Sprint 1',
      task: 'BE-107',
    },
  };
});

router.get('/:id', async (event, context, params) => {
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