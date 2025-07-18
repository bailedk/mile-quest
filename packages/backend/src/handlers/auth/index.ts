/**
 * Authentication Lambda handler with routing
 */

import { createHandler } from '../../utils/lambda-handler';
import { createRouter } from '../../utils/router';
import { validateEnvironment } from '../../config/environment';

// Validate environment on cold start
validateEnvironment();

// Create router
const router = createRouter();

// Route handlers will be added in Sprint 1
// For now, just basic placeholder routes

router.post('/register', async (event, context, params) => {
  return {
    statusCode: 501,
    body: {
      message: 'Registration endpoint - to be implemented in Sprint 1',
      task: 'BE-101',
    },
  };
});

router.post('/login', async (event, context, params) => {
  return {
    statusCode: 501,
    body: {
      message: 'Login endpoint - to be implemented in Sprint 1',
      task: 'BE-102',
    },
  };
});

router.post('/refresh', async (event, context, params) => {
  return {
    statusCode: 501,
    body: {
      message: 'Token refresh endpoint - to be implemented in Sprint 1',
      task: 'BE-103',
    },
  };
});

router.post('/logout', async (event, context, params) => {
  return {
    statusCode: 501,
    body: {
      message: 'Logout endpoint - to be implemented in Sprint 1',
      task: 'BE-104',
    },
  };
});

router.post('/verify-email', async (event, context, params) => {
  return {
    statusCode: 501,
    body: {
      message: 'Email verification endpoint - to be implemented in Sprint 1',
      task: 'BE-105',
    },
  };
});

// Export handler
export const handler = createHandler(router.handle.bind(router));