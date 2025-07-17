# API Security Middleware Implementation

**Version**: 1.0  
**Date**: 2025-01-17  
**Agent**: Security & Privacy Agent (06)  
**Status**: In Progress

## Overview

This document details the security middleware stack for Mile Quest API routes, implementing rate limiting, CORS, security headers, and request validation as specified by the API Designer Agent.

## Middleware Stack Architecture

```typescript
// Execution order for all API routes
1. Security Headers
2. CORS Configuration  
3. Rate Limiting
4. Authentication
5. Authorization
6. Input Validation
7. Route Handler
```

## Rate Limiting Implementation

### Rate Limit Configuration

Based on API Designer specifications:

```typescript
// types/rate-limit.types.ts

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyGenerator: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  message?: string;
}

export const rateLimitConfigs = {
  // Auth endpoints: 20/hour per IP
  auth: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    keyGenerator: (req: Request) => req.ip || 'unknown',
    message: 'Too many authentication attempts'
  },
  
  // Authenticated requests: 600/hour per user
  authenticated: {
    windowMs: 60 * 60 * 1000,
    max: 600,
    keyGenerator: (req: Request) => req.user?.id || req.ip || 'unknown',
    skipSuccessfulRequests: false
  },
  
  // Activity logging: 60/hour per user
  activityLogging: {
    windowMs: 60 * 60 * 1000,
    max: 60,
    keyGenerator: (req: Request) => req.user?.id || 'unknown',
    message: 'Activity logging rate limit exceeded'
  },
  
  // Team creation: 10/day per user
  teamCreation: {
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 10,
    keyGenerator: (req: Request) => req.user?.id || 'unknown',
    message: 'Team creation limit reached for today'
  }
};
```

### Rate Limiter Service

```typescript
// services/rate-limit/redis-rate-limiter.ts

import { Redis } from 'ioredis';
import { RateLimitConfig } from '@/types/rate-limit.types';

export class RedisRateLimiter {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });
  }

  async checkLimit(key: string, config: RateLimitConfig): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: Date;
  }> {
    const fullKey = `rate_limit:${key}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Remove old entries
    await this.redis.zremrangebyscore(fullKey, '-inf', windowStart);

    // Count requests in current window
    const count = await this.redis.zcard(fullKey);

    if (count >= config.max) {
      const oldestEntry = await this.redis.zrange(fullKey, 0, 0, 'WITHSCORES');
      const resetAt = oldestEntry.length > 1 
        ? new Date(parseInt(oldestEntry[1]) + config.windowMs)
        : new Date(now + config.windowMs);

      return {
        allowed: false,
        remaining: 0,
        resetAt
      };
    }

    // Add current request
    await this.redis.zadd(fullKey, now, `${now}-${Math.random()}`);
    await this.redis.expire(fullKey, Math.ceil(config.windowMs / 1000));

    return {
      allowed: true,
      remaining: config.max - count - 1,
      resetAt: new Date(now + config.windowMs)
    };
  }
}
```

### Rate Limit Middleware

```typescript
// middleware/rate-limit.middleware.ts

import { NextRequest, NextResponse } from 'next/server';
import { RedisRateLimiter } from '@/services/rate-limit/redis-rate-limiter';
import { RateLimitConfig } from '@/types/rate-limit.types';

const rateLimiter = new RedisRateLimiter();

export function createRateLimitMiddleware(config: RateLimitConfig) {
  return async function rateLimitMiddleware(
    request: NextRequest,
    context: any
  ): Promise<NextResponse | void> {
    const key = config.keyGenerator(request as any);
    const result = await rateLimiter.checkLimit(key, config);

    // Add rate limit headers
    const headers = new Headers();
    headers.set('X-RateLimit-Limit', config.max.toString());
    headers.set('X-RateLimit-Remaining', result.remaining.toString());
    headers.set('X-RateLimit-Reset', result.resetAt.toISOString());

    if (!result.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: config.message || 'Too many requests'
          }
        },
        { 
          status: 429,
          headers 
        }
      );
    }

    // Continue to next middleware
    const response = await context.next();
    
    // Add rate limit headers to successful responses
    result.remaining.toString().split('').forEach((char, i) => {
      response.headers.set(
        i === 0 ? 'X-RateLimit-Remaining' : `X-RateLimit-Remaining-${i}`,
        char
      );
    });
    response.headers.set('X-RateLimit-Limit', config.max.toString());
    response.headers.set('X-RateLimit-Reset', result.resetAt.toISOString());

    return response;
  };
}
```

## Security Headers Implementation

### Security Headers Middleware

```typescript
// middleware/security-headers.middleware.ts

import { NextRequest, NextResponse } from 'next/server';

export function securityHeadersMiddleware(
  request: NextRequest,
  context: any
): Promise<NextResponse> {
  const response = context.next();

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // HSTS (only in production)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }

  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Adjust for production
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https://api.mapbox.com wss://pusher.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);

  return response;
}
```

## CORS Configuration

### CORS Middleware

```typescript
// middleware/cors.middleware.ts

import { NextRequest, NextResponse } from 'next/server';

const allowedOrigins = [
  process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  'https://app.milequest.run',
  'https://mile-quest.com'
].filter(Boolean);

export function corsMiddleware(
  request: NextRequest,
  context: any
): NextResponse {
  const origin = request.headers.get('origin');
  const isAllowed = origin && allowedOrigins.includes(origin);

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': isAllowed ? origin : '',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Version',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  const response = context.next();

  if (isAllowed) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  return response;
}
```

## Authentication Middleware

### JWT Validation Middleware

```typescript
// middleware/auth.middleware.ts

import { NextRequest, NextResponse } from 'next/server';
import { createAuthService } from '@/services/auth/factory';

export async function authMiddleware(
  request: NextRequest,
  context: any
): Promise<NextResponse | void> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing authentication token'
        }
      },
      { status: 401 }
    );
  }

  const token = authHeader.substring(7);
  const authService = createAuthService();

  try {
    const isValid = await authService.validateAccessToken(token);
    if (!isValid) {
      throw new Error('Invalid token');
    }

    const payload = await authService.decodeAccessToken(token);
    
    // Add user info to request for downstream use
    (request as any).user = {
      id: payload.userId,
      email: payload.email,
      emailVerified: payload.emailVerified
    };

    return context.next();
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid authentication token'
        }
      },
      { status: 401 }
    );
  }
}
```

## Authorization Middleware

### Team-Based Authorization

```typescript
// middleware/team-auth.middleware.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export function requireTeamRole(requiredRole: 'ADMIN' | 'MEMBER') {
  return async function teamAuthMiddleware(
    request: NextRequest,
    context: any
  ): Promise<NextResponse | void> {
    const user = (request as any).user;
    const teamId = request.nextUrl.pathname.split('/')[4]; // /api/v1/teams/:teamId

    if (!user || !teamId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied'
          }
        },
        { status: 403 }
      );
    }

    const membership = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId: user.id,
        leftAt: null
      }
    });

    if (!membership) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Not a member of this team'
          }
        },
        { status: 403 }
      );
    }

    // Check role hierarchy
    if (requiredRole === 'ADMIN' && membership.role !== 'ADMIN') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Admin access required'
          }
        },
        { status: 403 }
      );
    }

    // Add team membership to request
    (request as any).teamMembership = membership;

    return context.next();
  };
}
```

## Input Validation Middleware

### Request Validation

```typescript
// middleware/validate.middleware.ts

import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema } from 'zod';

export function validateRequest(schema: ZodSchema) {
  return async function validationMiddleware(
    request: NextRequest,
    context: any
  ): Promise<NextResponse | void> {
    try {
      const body = await request.json();
      const validated = schema.parse(body);
      
      // Replace request body with validated data
      (request as any).validatedBody = validated;
      
      return context.next();
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors || []
          }
        },
        { status: 400 }
      );
    }
  };
}
```

### Common Validation Schemas

```typescript
// schemas/activity.schemas.ts

import { z } from 'zod';

export const createActivitySchema = z.object({
  distance: z.number().min(0).max(1000000), // meters, max 1000km
  duration: z.number().min(0).max(86400), // seconds, max 24 hours
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  type: z.enum(['WALK', 'RUN']),
  teamGoalId: z.string().uuid().optional(),
  isPrivate: z.boolean().default(false),
  notes: z.string().max(500).optional()
});

export const updateActivitySchema = createActivitySchema.partial();
```

## Middleware Composition

### Route Handler Example

```typescript
// app/api/v1/activities/route.ts

import { NextRequest } from 'next/server';
import { compose } from '@/lib/middleware';
import { securityHeadersMiddleware } from '@/middleware/security-headers';
import { corsMiddleware } from '@/middleware/cors';
import { createRateLimitMiddleware } from '@/middleware/rate-limit';
import { authMiddleware } from '@/middleware/auth';
import { validateRequest } from '@/middleware/validate';
import { createActivitySchema } from '@/schemas/activity.schemas';
import { rateLimitConfigs } from '@/types/rate-limit.types';

const middleware = compose(
  securityHeadersMiddleware,
  corsMiddleware,
  createRateLimitMiddleware(rateLimitConfigs.activityLogging),
  authMiddleware,
  validateRequest(createActivitySchema)
);

export async function POST(request: NextRequest) {
  return middleware(request, {
    next: async () => {
      // Route handler logic
      const { validatedBody, user } = request as any;
      
      // Create activity...
      
      return NextResponse.json({
        success: true,
        data: { /* activity */ }
      });
    }
  });
}
```

### Middleware Composition Utility

```typescript
// lib/middleware.ts

import { NextRequest, NextResponse } from 'next/server';

type Middleware = (
  request: NextRequest,
  context: { next: () => Promise<NextResponse> }
) => Promise<NextResponse | void>;

export function compose(...middlewares: Middleware[]) {
  return async function composedMiddleware(
    request: NextRequest,
    finalContext: { next: () => Promise<NextResponse> }
  ): Promise<NextResponse> {
    let index = -1;

    async function dispatch(i: number): Promise<NextResponse> {
      if (i <= index) {
        throw new Error('next() called multiple times');
      }
      index = i;

      const middleware = middlewares[i];

      if (!middleware) {
        return finalContext.next();
      }

      const result = await middleware(request, {
        next: () => dispatch(i + 1)
      });

      return result || dispatch(i + 1);
    }

    return dispatch(0);
  };
}
```

## Error Handling

### Global Error Handler

```typescript
// middleware/error-handler.middleware.ts

import { NextRequest, NextResponse } from 'next/server';

export function errorHandlerMiddleware(
  request: NextRequest,
  context: any
): Promise<NextResponse> {
  return context.next().catch((error: any) => {
    console.error('API Error:', error);

    // Log to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // logToCloudWatch(error, request);
    }

    // Sanitize error for client
    const isDev = process.env.NODE_ENV === 'development';
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: isDev ? error.message : 'An error occurred',
          ...(isDev && { stack: error.stack })
        }
      },
      { status: 500 }
    );
  });
}
```

## Monitoring and Alerts

### Middleware Metrics

```typescript
// services/monitoring/middleware-metrics.ts

export class MiddlewareMetrics {
  private cloudWatch: CloudWatchClient;

  async recordRateLimitHit(endpoint: string, userId?: string) {
    await this.cloudWatch.putMetricData({
      Namespace: 'MileQuest/API',
      MetricData: [{
        MetricName: 'RateLimitHits',
        Value: 1,
        Unit: 'Count',
        Dimensions: [
          { Name: 'Endpoint', Value: endpoint },
          { Name: 'UserType', Value: userId ? 'Authenticated' : 'Anonymous' }
        ]
      }]
    });
  }

  async recordAuthFailure(reason: string) {
    await this.cloudWatch.putMetricData({
      Namespace: 'MileQuest/API',
      MetricData: [{
        MetricName: 'AuthFailures',
        Value: 1,
        Unit: 'Count',
        Dimensions: [
          { Name: 'Reason', Value: reason }
        ]
      }]
    });
  }
}
```

## Testing

### Middleware Testing

```typescript
// __tests__/middleware/rate-limit.test.ts

import { createRateLimitMiddleware } from '@/middleware/rate-limit';
import { createMocks } from 'node-mocks-http';

describe('Rate Limit Middleware', () => {
  const config = {
    windowMs: 60000, // 1 minute
    max: 5,
    keyGenerator: (req: any) => 'test-key'
  };

  const middleware = createRateLimitMiddleware(config);

  it('should allow requests under limit', async () => {
    for (let i = 0; i < 5; i++) {
      const { req } = createMocks({ method: 'GET' });
      const context = {
        next: jest.fn(() => new NextResponse())
      };

      const response = await middleware(req as any, context);
      expect(context.next).toHaveBeenCalled();
    }
  });

  it('should block requests over limit', async () => {
    // Exhaust limit
    for (let i = 0; i < 5; i++) {
      const { req } = createMocks({ method: 'GET' });
      await middleware(req as any, { next: jest.fn() });
    }

    // Next request should be blocked
    const { req } = createMocks({ method: 'GET' });
    const response = await middleware(req as any, { next: jest.fn() });
    
    expect(response.status).toBe(429);
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
  });
});
```

## Conclusion

This comprehensive middleware stack provides Mile Quest with:
- Robust rate limiting per API Designer specifications
- Strong security headers and CORS protection
- JWT-based authentication with abstracted auth service
- Team-based authorization
- Input validation with Zod schemas
- Composable middleware architecture
- Comprehensive error handling and monitoring

All middleware follows Next.js App Router patterns and integrates seamlessly with the authentication service abstraction.