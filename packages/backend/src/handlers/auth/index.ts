/**
 * Authentication Lambda handler with routing
 */

import { createHandler } from '../../utils/lambda-handler';
import { createRouter } from '../../utils/router';
import { validateEnvironment } from '../../config/environment';
import { getAuthService } from '../../services/auth';
import { getPrismaClient } from '../../lib/prisma';
import { generateTokens } from '../../utils/auth/jwt.utils';
import { 
  RegisterSchema, 
  LoginSchema, 
  RefreshTokenSchema, 
  VerifyEmailSchema,
  AuthUser,
  RegisterResponse,
  LoginResponse,
  RefreshResponse,
  LogoutResponse,
  VerifyEmailResponse
} from '@mile-quest/shared';
import { logger } from '../../services/logger';
import { z } from 'zod';

// Validate environment on cold start
validateEnvironment();

// Create router
const router = createRouter();

// Get services
const authService = getAuthService();
const prisma = getPrismaClient();

// BE-008: User registration endpoint
router.post('/register', async (event, context, params) => {
  try {
    // Validate request body
    const body = RegisterSchema.parse(JSON.parse(event.body || '{}'));
    
    // Create user in Cognito
    const cognitoUser = await authService.signUp({
      email: body.email,
      password: body.password,
      name: body.name,
      attributes: {
        'custom:preferred_units': body.preferredUnits || 'miles',
        'custom:timezone': body.timezone || 'UTC',
      },
    });
    
    // Create user in database
    const dbUser = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        cognitoId: cognitoUser.id,
        preferredUnits: body.preferredUnits || 'miles',
        timezone: body.timezone || 'UTC',
      },
    });
    
    logger.info('User registered successfully', { userId: dbUser.id, email: body.email });
    
    const response: RegisterResponse = {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        emailVerified: false,
        preferredUnits: dbUser.preferredUnits as 'miles' | 'kilometers',
        timezone: dbUser.timezone,
        createdAt: dbUser.createdAt.toISOString(),
        updatedAt: dbUser.updatedAt.toISOString(),
      },
      message: 'Registration successful. Please check your email for verification.',
    };
    
    return {
      statusCode: 201,
      body: response,
    };
  } catch (error) {
    logger.error('Registration failed', { error });
    
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        body: { error: 'Invalid request data', details: error.errors },
      };
    }
    
    if (error instanceof Error && error.message.includes('User already exists')) {
      return {
        statusCode: 409,
        body: { error: 'User with this email already exists' },
      };
    }
    
    return {
      statusCode: 500,
      body: { error: 'Registration failed' },
    };
  }
});

// BE-009: User login endpoint
router.post('/login', async (event, context, params) => {
  try {
    // Validate request body
    const body = LoginSchema.parse(JSON.parse(event.body || '{}'));
    
    // Sign in with Cognito
    const session = await authService.signIn({
      email: body.email,
      password: body.password,
    });
    
    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { cognitoId: session.user.id },
    });
    
    if (!dbUser) {
      throw new Error('User not found in database');
    }
    
    // Generate our own JWT tokens
    const tokens = generateTokens({
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      emailVerified: session.user.emailVerified,
      preferredUnits: dbUser.preferredUnits as 'miles' | 'kilometers',
      timezone: dbUser.timezone,
      createdAt: dbUser.createdAt.toISOString(),
      updatedAt: dbUser.updatedAt.toISOString(),
    });
    
    logger.info('User logged in successfully', { userId: dbUser.id, email: body.email });
    
    const response: LoginResponse = {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        emailVerified: session.user.emailVerified,
        preferredUnits: dbUser.preferredUnits as 'miles' | 'kilometers',
        timezone: dbUser.timezone,
        createdAt: dbUser.createdAt.toISOString(),
        updatedAt: dbUser.updatedAt.toISOString(),
      },
      tokens,
    };
    
    return {
      statusCode: 200,
      body: response,
    };
  } catch (error) {
    logger.error('Login failed', { error });
    
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        body: { error: 'Invalid request data', details: error.errors },
      };
    }
    
    if (error instanceof Error && error.message.includes('Invalid credentials')) {
      return {
        statusCode: 401,
        body: { error: 'Invalid email or password' },
      };
    }
    
    return {
      statusCode: 500,
      body: { error: 'Login failed' },
    };
  }
});

// BE-006/BE-007: Token refresh endpoint (combines JWT generation and validation)
router.post('/refresh', async (event, context, params) => {
  try {
    // Validate request body
    const body = RefreshTokenSchema.parse(JSON.parse(event.body || '{}'));
    
    // Refresh session with Cognito
    const newSession = await authService.refreshSession();
    
    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { cognitoId: newSession.user.id },
    });
    
    if (!dbUser) {
      throw new Error('User not found in database');
    }
    
    // Generate new JWT tokens
    const tokens = generateTokens({
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      emailVerified: newSession.user.emailVerified,
      preferredUnits: dbUser.preferredUnits as 'miles' | 'kilometers',
      timezone: dbUser.timezone,
      createdAt: dbUser.createdAt.toISOString(),
      updatedAt: dbUser.updatedAt.toISOString(),
    });
    
    logger.info('Token refreshed successfully', { userId: dbUser.id });
    
    const response: RefreshResponse = {
      tokens,
    };
    
    return {
      statusCode: 200,
      body: response,
    };
  } catch (error) {
    logger.error('Token refresh failed', { error });
    
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        body: { error: 'Invalid request data', details: error.errors },
      };
    }
    
    return {
      statusCode: 401,
      body: { error: 'Invalid or expired refresh token' },
    };
  }
});

// Logout endpoint
router.post('/logout', async (event, context, params) => {
  try {
    await authService.signOut();
    
    const response: LogoutResponse = {
      message: 'Logged out successfully',
    };
    
    return {
      statusCode: 200,
      body: response,
    };
  } catch (error) {
    logger.error('Logout failed', { error });
    
    return {
      statusCode: 500,
      body: { error: 'Logout failed' },
    };
  }
});

// Email verification endpoint
router.post('/verify-email', async (event, context, params) => {
  try {
    // Validate request body
    const body = VerifyEmailSchema.parse(JSON.parse(event.body || '{}'));
    
    // Confirm sign up with Cognito
    await authService.confirmSignUp({
      email: body.email,
      code: body.code,
    });
    
    // Update user in database
    await prisma.user.update({
      where: { email: body.email },
      data: { emailVerified: true },
    });
    
    logger.info('Email verified successfully', { email: body.email });
    
    const response: VerifyEmailResponse = {
      message: 'Email verified successfully',
    };
    
    return {
      statusCode: 200,
      body: response,
    };
  } catch (error) {
    logger.error('Email verification failed', { error });
    
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        body: { error: 'Invalid request data', details: error.errors },
      };
    }
    
    if (error instanceof Error && error.message.includes('Invalid verification code')) {
      return {
        statusCode: 400,
        body: { error: 'Invalid or expired verification code' },
      };
    }
    
    return {
      statusCode: 500,
      body: { error: 'Email verification failed' },
    };
  }
});

// Export handler
export const handler = createHandler(router.handle.bind(router));