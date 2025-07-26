import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { authService } from '../services/auth/auth.service';
import { logger } from '../utils/logger';
import { createRouter } from '../utils/lambda/router';
import { createHandler } from '../utils/lambda/handler';
import { withRateLimit } from '../middleware/rate-limiting.middleware';

// Request schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  acceptedTerms: z.boolean().refine(val => val === true, {
    message: 'You must accept the terms and conditions',
  }),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string(),
  newPassword: z.string().min(8),
});

const verifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string(),
});

// Create router
const router = createRouter();

// Login endpoint
router.post('/auth/login', async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { email, password } = loginSchema.parse(body);

    const result = await authService.login(email, password);

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    logger.error('Login failed', { error });

    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid request data', details: error.errors }),
      };
    }

    if (error instanceof Error && error.message === 'Invalid credentials') {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid email or password' }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Login failed' }),
    };
  }
});

// Register endpoint
router.post('/auth/register', async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}');
    const data = registerSchema.parse(body);

    const result = await authService.register(
      data.email,
      data.password,
      data.name
    );

    return {
      statusCode: 201,
      body: JSON.stringify(result),
    };
  } catch (error) {
    logger.error('Registration failed', { error });

    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid request data', details: error.errors }),
      };
    }

    if (error instanceof Error && error.message.includes('already exists')) {
      return {
        statusCode: 409,
        body: JSON.stringify({ error: 'Email already registered' }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Registration failed' }),
    };
  }
});

// Refresh token endpoint
router.post('/auth/refresh', async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { refreshToken } = refreshTokenSchema.parse(body);

    const result = await authService.refreshToken(refreshToken);

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    logger.error('Token refresh failed', { error });

    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid request data', details: error.errors }),
      };
    }

    if (error instanceof Error && error.message === 'Invalid refresh token') {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid or expired refresh token' }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Token refresh failed' }),
    };
  }
});

// Forgot password endpoint
router.post('/auth/forgot-password', async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { email } = forgotPasswordSchema.parse(body);

    await authService.forgotPassword(email);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Password reset code sent to email' }),
    };
  } catch (error) {
    logger.error('Forgot password failed', { error });

    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid request data', details: error.errors }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send password reset code' }),
    };
  }
});

// Reset password endpoint
router.post('/auth/reset-password', async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { email, code, newPassword } = resetPasswordSchema.parse(body);

    await authService.resetPassword(email, code, newPassword);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Password reset successfully' }),
    };
  } catch (error) {
    logger.error('Password reset failed', { error });

    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid request data', details: error.errors }),
      };
    }

    if (error instanceof Error && error.message === 'Invalid or expired code') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid or expired reset code' }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Password reset failed' }),
    };
  }
});

// Verify email endpoint
router.post('/auth/verify-email', async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { email, code } = verifyEmailSchema.parse(body);

    await authService.verifyEmail(email, code);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Email verified successfully' }),
    };
  } catch (error) {
    logger.error('Email verification failed', { error });

    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid request data', details: error.errors }),
      };
    }

    if (error instanceof Error && error.message === 'Invalid or expired code') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid or expired verification code' }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Email verification failed' }),
    };
  }
});

// Apply rate limiting to auth endpoints
const rateLimitConfig = {
  perEndpoint: {
    'POST:/auth/login': {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5, // 5 login attempts per 15 minutes
      skipSuccessfulRequests: true, // Only count failed attempts
      message: 'Too many login attempts. Please try again later.',
    },
    'POST:/auth/register': {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3, // 3 registration attempts per hour
      message: 'Too many registration attempts. Please try again later.',
    },
    'POST:/auth/forgot-password': {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3, // 3 password reset requests per hour
      message: 'Too many password reset requests. Please try again later.',
    },
  },
  anonymous: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 50, // 50 requests per hour for all auth endpoints combined
    headers: true,
  },
};

export const handler = withRateLimit(
  createHandler(router.handle.bind(router)),
  rateLimitConfig
);