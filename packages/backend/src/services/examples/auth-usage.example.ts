/**
 * Enhanced examples of using the abstracted auth service
 * Demonstrates new features: retry logic, auto-refresh, comprehensive error handling
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { 
  createDefaultAuthService,
  createAuthServiceWithProvider,
  AuthService, 
  AuthError, 
  AuthErrorCode,
  MockAuthService 
} from '../auth/index';

/**
 * Example registration handler using the abstracted auth service
 */
export async function handleRegistration(
  event: APIGatewayProxyEvent,
  context: Context
) {
  try {
    // Get the auth service with automatic provider selection and retry logic
    const authService = createDefaultAuthService();
    
    // Parse request body
    const { email, password, name } = JSON.parse(event.body || '{}');
    
    // Validate input
    if (!email || !password || !name) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required fields: email, password, name',
        }),
      };
    }
    
    // Create user using the abstracted service
    const user = await authService.signUp({
      email,
      password,
      name,
      attributes: {
        source: 'web',
        registeredAt: new Date().toISOString(),
      },
    });
    
    // Send confirmation email (would use email service)
    // const emailService = getService<EmailService>('email');
    // await emailService.sendTemplatedEmail('welcome', email, { name });
    
    return {
      statusCode: 201,
      body: JSON.stringify({
        message: 'Registration successful. Please check your email to verify your account.',
        userId: user.id,
      }),
    };
  } catch (error) {
    // Handle auth-specific errors
    if (error instanceof AuthError) {
      switch (error.code) {
        case AuthErrorCode.USER_EXISTS:
          return {
            statusCode: 409,
            body: JSON.stringify({
              error: 'User already exists',
            }),
          };
        case AuthErrorCode.INVALID_PASSWORD:
          return {
            statusCode: 400,
            body: JSON.stringify({
              error: 'Password does not meet requirements',
            }),
          };
        case AuthErrorCode.INVALID_EMAIL:
          return {
            statusCode: 400,
            body: JSON.stringify({
              error: 'Invalid email format',
            }),
          };
        default:
          console.error('Auth error:', error);
          return {
            statusCode: 500,
            body: JSON.stringify({
              error: 'Registration failed',
            }),
          };
      }
    }
    
    // Handle unexpected errors
    console.error('Unexpected error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
      }),
    };
  }
}

/**
 * Example login handler using the abstracted auth service
 */
export async function handleLogin(
  event: APIGatewayProxyEvent,
  context: Context
) {
  try {
    const authService = createDefaultAuthService();
    
    const { email, password } = JSON.parse(event.body || '{}');
    
    if (!email || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required fields: email, password',
        }),
      };
    }
    
    // Sign in using the abstracted service
    const session = await authService.signIn({ email, password });
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
        },
        tokens: {
          idToken: session.idToken,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresAt: session.expiresAt.toISOString(),
        },
      }),
    };
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.code) {
        case AuthErrorCode.INVALID_CREDENTIALS:
          return {
            statusCode: 401,
            body: JSON.stringify({
              error: 'Invalid email or password',
            }),
          };
        case AuthErrorCode.USER_NOT_CONFIRMED:
          return {
            statusCode: 403,
            body: JSON.stringify({
              error: 'Please verify your email before logging in',
            }),
          };
        default:
          console.error('Auth error:', error);
          return {
            statusCode: 500,
            body: JSON.stringify({
              error: 'Login failed',
            }),
          };
      }
    }
    
    console.error('Unexpected error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
      }),
    };
  }
}

/**
 * Example middleware for validating JWT tokens
 */
export async function validateToken(token: string): Promise<any> {
  try {
    const authService = createDefaultAuthService();
    
    // Remove 'Bearer ' prefix if present
    const cleanToken = token.replace(/^Bearer\s+/i, '');
    
    // Verify the token
    const user = await authService.verifyToken(cleanToken);
    
    return {
      isValid: true,
      user,
    };
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.code) {
        case AuthErrorCode.INVALID_TOKEN:
        case AuthErrorCode.TOKEN_EXPIRED:
          return {
            isValid: false,
            error: error.code,
          };
      }
    }
    
    throw error;
  }
}

/**
 * Example of using the service in a protected endpoint
 */
export async function handleProtectedEndpoint(
  event: APIGatewayProxyEvent,
  context: Context
) {
  // Get authorization header
  const authHeader = event.headers.Authorization || event.headers.authorization;
  
  if (!authHeader) {
    return {
      statusCode: 401,
      body: JSON.stringify({
        error: 'Missing authorization header',
      }),
    };
  }
  
  // Validate token
  const validation = await validateToken(authHeader);
  
  if (!validation.isValid) {
    return {
      statusCode: 401,
      body: JSON.stringify({
        error: 'Invalid or expired token',
      }),
    };
  }
  
  // Token is valid, proceed with the request
  // The user information is available in validation.user
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Protected resource accessed successfully',
      user: validation.user,
    }),
  };
}

/**
 * Example of switching providers for testing
 */
export async function setupTestEnvironment() {
  // In tests, you can use the mock provider
  process.env.AUTH_PROVIDER = 'mock';
  
  // Or use the factory directly
  import { createAuthServiceWithProvider, MockAuthService } from '../auth';
  
  const mockAuth = createAuthServiceWithProvider('mock') as MockAuthService;
  
  // Add test users
  mockAuth.addMockUser({
    user: {
      id: 'test-123',
      email: 'test@example.com',
      name: 'Test User',
      emailVerified: true,
      createdAt: new Date(),
    },
    password: 'testpass123',
    confirmed: true,
  });
  
  // Set mock delays to simulate network latency
  mockAuth.setMockDelay(100);
  
  // Test with the mock service
  const session = await mockAuth.signIn({
    email: 'test@example.com',
    password: 'testpass123',
  });
  
  console.log('Mock session:', session);
}

/**
 * Example of using the enhanced auth service with auto-refresh
 */
export async function handleLongRunningOperation(
  event: APIGatewayProxyEvent,
  context: Context
) {
  try {
    // Create auth service with custom configuration
    const authService = createAuthServiceWithProvider('cognito', {
      autoRefresh: true,
      refreshThreshold: 300, // Refresh 5 minutes before expiry
      retryConfig: {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 5000,
      },
    });

    // Get authorization header
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Missing authorization header' }),
      };
    }

    // Verify token - will auto-refresh if needed
    const user = await authService.verifyToken(authHeader.replace('Bearer ', ''));

    // Simulate long-running operation
    await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds

    // Get access token again - might be refreshed automatically
    const accessToken = await authService.getAccessToken();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Operation completed successfully',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        tokenInfo: {
          isValid: true,
          needsRefresh: await authService.isTokenExpired(),
        },
      }),
    };
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.code) {
        case AuthErrorCode.TOKEN_EXPIRED:
          return {
            statusCode: 401,
            body: JSON.stringify({
              error: 'Session expired, please sign in again',
              code: 'SESSION_EXPIRED',
            }),
          };
        case AuthErrorCode.SESSION_EXPIRED:
          return {
            statusCode: 401,
            body: JSON.stringify({
              error: 'Session expired, please sign in again',
              code: 'SESSION_EXPIRED',
            }),
          };
        default:
          return {
            statusCode: 403,
            body: JSON.stringify({
              error: 'Authentication failed',
              code: error.code,
            }),
          };
      }
    }

    console.error('Unexpected error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

/**
 * Example of admin operations with comprehensive error handling
 */
export async function handleAdminUserManagement(
  event: APIGatewayProxyEvent,
  context: Context
) {
  try {
    const authService = createDefaultAuthService();
    const { operation, userId, userData } = JSON.parse(event.body || '{}');

    // Verify admin token
    const authHeader = event.headers.Authorization || event.headers.authorization;
    const admin = await authService.verifyToken(authHeader!.replace('Bearer ', ''));

    // Check admin permissions (example attribute check)
    if (!admin.attributes?.role || admin.attributes.role !== 'admin') {
      return {
        statusCode: 403,
        body: JSON.stringify({
          error: 'Admin privileges required',
          code: 'INSUFFICIENT_PERMISSIONS',
        }),
      };
    }

    let result;
    switch (operation) {
      case 'list':
        result = await authService.adminListUsers(50);
        break;
      case 'get':
        result = await authService.adminGetUser(userId);
        break;
      case 'create':
        result = await authService.adminCreateUser(userData);
        break;
      case 'update':
        await authService.adminUpdateUserAttributes(userId, userData.attributes);
        result = { success: true };
        break;
      case 'disable':
        await authService.adminDisableUser(userId);
        result = { success: true };
        break;
      case 'enable':
        await authService.adminEnableUser(userId);
        result = { success: true };
        break;
      case 'delete':
        await authService.adminDeleteUser(userId);
        result = { success: true };
        break;
      default:
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: 'Invalid operation',
            validOperations: ['list', 'get', 'create', 'update', 'disable', 'enable', 'delete'],
          }),
        };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.code) {
        case AuthErrorCode.USER_NOT_FOUND:
          return {
            statusCode: 404,
            body: JSON.stringify({
              error: 'User not found',
              code: 'USER_NOT_FOUND',
            }),
          };
        case AuthErrorCode.USER_EXISTS:
          return {
            statusCode: 409,
            body: JSON.stringify({
              error: 'User already exists',
              code: 'USER_EXISTS',
            }),
          };
        case AuthErrorCode.LIMIT_EXCEEDED:
          return {
            statusCode: 429,
            body: JSON.stringify({
              error: 'Rate limit exceeded, please try again later',
              code: 'RATE_LIMIT_EXCEEDED',
            }),
          };
        default:
          return {
            statusCode: 500,
            body: JSON.stringify({
              error: 'Admin operation failed',
              code: error.code,
            }),
          };
      }
    }

    console.error('Admin operation error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

/**
 * Example of testing with mock service features
 */
export async function setupTestingScenarios() {
  // Create mock auth service for testing
  const mockAuth = createAuthServiceWithProvider('mock') as MockAuthService;

  // Clear any existing data
  mockAuth.clearMockData();
  mockAuth.clearCallHistory();

  // Add test users with different scenarios
  mockAuth.addMockUser({
    user: {
      id: 'test-disabled-user',
      email: 'disabled@example.com',
      name: 'Disabled User',
      emailVerified: true,
      createdAt: new Date(),
    },
    password: 'password123',
    confirmed: true,
    enabled: false, // Disabled user
  });

  mockAuth.addMockUser({
    user: {
      id: 'test-temp-password-user',
      email: 'temp@example.com',
      name: 'Temp Password User',
      emailVerified: true,
      createdAt: new Date(),
    },
    password: 'temppass123',
    confirmed: true,
    enabled: true,
    temporaryPassword: true, // Requires password change
  });

  mockAuth.addMockUser({
    user: {
      id: 'test-mfa-user',
      email: 'mfa@example.com',
      name: 'MFA User',
      emailVerified: true,
      createdAt: new Date(),
    },
    password: 'password123',
    confirmed: true,
    enabled: true,
    mfaEnabled: true, // MFA required
  });

  // Test different error scenarios
  console.log('Testing disabled user login...');
  try {
    await mockAuth.signIn({ email: 'disabled@example.com', password: 'password123' });
  } catch (error) {
    console.log('Expected error:', error.message);
  }

  console.log('Testing temporary password user...');
  try {
    await mockAuth.signIn({ email: 'temp@example.com', password: 'temppass123' });
  } catch (error) {
    console.log('Expected error:', error.message);
  }

  console.log('Testing MFA user...');
  try {
    await mockAuth.signIn({ email: 'mfa@example.com', password: 'password123' });
  } catch (error) {
    console.log('Expected error:', error.message);
  }

  // Test error simulation
  console.log('Testing error simulation...');
  mockAuth.simulateError('signIn', new AuthError('Simulated service error', AuthErrorCode.SERVICE_ERROR));
  
  try {
    await mockAuth.signIn({ email: 'test@example.com', password: 'password123' });
  } catch (error) {
    console.log('Simulated error:', error.message);
  }

  // Clear error simulation
  mockAuth.clearErrorSimulation('signIn');

  // Test call history tracking
  console.log('Testing call history...');
  mockAuth.clearCallHistory();
  
  await mockAuth.signIn({ email: 'test@example.com', password: 'password123' });
  await mockAuth.getCurrentUser();
  await mockAuth.refreshSession();

  const history = mockAuth.getCallHistory();
  console.log('Call history:', history.map(call => call.method));

  // Test auto-refresh configuration
  console.log('Testing auto-refresh...');
  mockAuth.setAutoRefresh(true);
  mockAuth.setRefreshThreshold(60); // 1 minute threshold

  const session = await mockAuth.getSession();
  const shouldRefresh = await mockAuth.autoRefreshToken();
  console.log('Auto-refresh result:', shouldRefresh ? 'Refreshed' : 'Not needed');

  return {
    message: 'All testing scenarios completed',
    callHistory: mockAuth.getCallHistory(),
    users: mockAuth.getMockUsers().map(u => ({ 
      id: u.user.id, 
      email: u.user.email, 
      enabled: u.enabled, 
      confirmed: u.confirmed 
    })),
  };
}