/**
 * Example of how to use the abstracted auth service in Lambda handlers
 * This file demonstrates best practices for service usage
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { getService, AuthService, AuthError, AuthErrorCode } from '../index';

/**
 * Example registration handler using the abstracted auth service
 */
export async function handleRegistration(
  event: APIGatewayProxyEvent,
  context: Context
) {
  try {
    // Get the auth service from the registry
    const authService = getService<AuthService>('auth');
    
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
    const authService = getService<AuthService>('auth');
    
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
    const authService = getService<AuthService>('auth');
    
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