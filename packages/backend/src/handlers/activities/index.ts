/**
 * Activities Lambda handler with routing
 */

import { createHandler } from '../../utils/lambda-handler';
import { createRouter } from '../../utils/router';
import { validateEnvironment } from '../../config/environment';

// Validate environment on cold start
validateEnvironment();

// Create router
const router = createRouter();

// Route handlers will be added in Sprint 3
router.post('/', async (event, context, params) => {
  return {
    statusCode: 501,
    body: {
      message: 'Create activity endpoint - to be implemented in Sprint 3',
      task: 'BE-301',
    },
  };
});

router.get('/', async (event, context, params) => {
  return {
    statusCode: 501,
    body: {
      message: 'List activities endpoint - to be implemented in Sprint 3',
      task: 'BE-302',
    },
  };
});

router.patch('/:id', async (event, context, params) => {
  return {
    statusCode: 501,
    body: {
      message: 'Update activity endpoint - to be implemented in Sprint 3',
      task: 'BE-303',
      activityId: params.id,
    },
  };
});

router.delete('/:id', async (event, context, params) => {
  return {
    statusCode: 501,
    body: {
      message: 'Delete activity endpoint - to be implemented in Sprint 3',
      task: 'BE-304',
      activityId: params.id,
    },
  };
});

// Export handler
export const handler = createHandler(router.handle.bind(router));