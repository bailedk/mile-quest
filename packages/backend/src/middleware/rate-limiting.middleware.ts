/**
 * Rate Limiting Middleware - BE-701
 * Comprehensive rate limiting and throttling for API endpoints
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { cache } from '../utils/cache';
import { cacheKeys } from '../services/cache/constants';

interface RateLimitRule {
  windowMs: number;        // Time window in milliseconds
  maxRequests: number;     // Maximum requests per window
  skipSuccessfulRequests?: boolean; // Only count failed requests
  skipFailedRequests?: boolean;     // Only count successful requests
  keyGenerator?: (event: APIGatewayProxyEvent) => string; // Custom key generator
  message?: string;        // Custom rate limit message
  headers?: boolean;       // Include rate limit headers in response
}

interface RateLimitConfig {
  global?: RateLimitRule;           // Global rate limit for all endpoints
  authenticated?: RateLimitRule;    // Rate limit for authenticated users
  anonymous?: RateLimitRule;        // Rate limit for anonymous users
  perEndpoint?: Record<string, RateLimitRule>; // Per-endpoint rate limits
  perUser?: RateLimitRule;          // Per-user rate limits
  burstLimit?: {                    // Burst protection
    windowMs: number;
    maxRequests: number;
  };
}

interface RateLimitInfo {
  remaining: number;
  resetTime: number;
  totalRequests: number;
  windowMs: number;
  isBlocked: boolean;
}

interface ThrottleState {
  requestCount: number;
  firstRequestTime: number;
  lastRequestTime: number;
  isBlocked: boolean;
  blockUntil?: number;
}

export class RateLimitingMiddleware {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = {
      // Default configuration
      global: config.global || {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 1000,
        headers: true,
      },
      authenticated: config.authenticated || {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 500,
        headers: true,
      },
      anonymous: config.anonymous || {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100,
        headers: true,
      },
      perUser: config.perUser || {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 60,
        headers: true,
      },
      burstLimit: config.burstLimit || {
        windowMs: 10 * 1000, // 10 seconds
        maxRequests: 20,
      },
      ...config,
    };
  }

  /**
   * Apply rate limiting to the request
   */
  async checkRateLimit(
    event: APIGatewayProxyEvent,
    response?: APIGatewayProxyResult
  ): Promise<{
    allowed: boolean;
    response?: APIGatewayProxyResult;
    rateLimitInfo: RateLimitInfo;
  }> {
    const userId = this.extractUserId(event);
    const endpoint = this.getEndpoint(event);
    const isAuthenticated = !!userId;

    // Check multiple rate limit rules
    const checks = await Promise.all([
      this.checkGlobalRateLimit(event),
      this.checkUserRateLimit(event, userId, isAuthenticated),
      this.checkEndpointRateLimit(event, endpoint),
      this.checkBurstLimit(event, userId || this.getClientId(event)),
    ]);

    // Find the most restrictive limit that's been exceeded
    const blocked = checks.find(check => !check.allowed);
    if (blocked) {
      return {
        allowed: false,
        response: this.createRateLimitResponse(blocked.rateLimitInfo, blocked.rule),
        rateLimitInfo: blocked.rateLimitInfo,
      };
    }

    // Log successful request if response is provided
    if (response) {
      await this.logRequest(event, response, userId);
    }

    // Return the most restrictive rate limit info for headers
    const mostRestrictive = checks.reduce((min, check) => 
      check.rateLimitInfo.remaining < min.rateLimitInfo.remaining ? check : min
    );

    return {
      allowed: true,
      rateLimitInfo: mostRestrictive.rateLimitInfo,
    };
  }

  /**
   * Add rate limit headers to response
   */
  addRateLimitHeaders(
    response: APIGatewayProxyResult,
    rateLimitInfo: RateLimitInfo
  ): APIGatewayProxyResult {
    const headers = {
      ...response.headers,
      'X-RateLimit-Remaining': rateLimitInfo.remaining.toString(),
      'X-RateLimit-Reset': rateLimitInfo.resetTime.toString(),
      'X-RateLimit-Window': Math.floor(rateLimitInfo.windowMs / 1000).toString(),
    };

    // Add retry-after header if blocked
    if (rateLimitInfo.isBlocked) {
      const retryAfter = Math.ceil((rateLimitInfo.resetTime - Date.now()) / 1000);
      headers['Retry-After'] = Math.max(0, retryAfter).toString();
    }

    return {
      ...response,
      headers,
    };
  }

  /**
   * Check global rate limit
   */
  private async checkGlobalRateLimit(
    event: APIGatewayProxyEvent
  ): Promise<{
    allowed: boolean;
    rateLimitInfo: RateLimitInfo;
    rule: RateLimitRule;
  }> {
    if (!this.config.global) {
      return {
        allowed: true,
        rateLimitInfo: this.createEmptyRateLimitInfo(),
        rule: {} as RateLimitRule,
      };
    }

    const key = 'global';
    return this.checkRateLimit(key, this.config.global, event);
  }

  /**
   * Check user-specific rate limit
   */
  private async checkUserRateLimit(
    event: APIGatewayProxyEvent,
    userId: string | null,
    isAuthenticated: boolean
  ): Promise<{
    allowed: boolean;
    rateLimitInfo: RateLimitInfo;
    rule: RateLimitRule;
  }> {
    const rule = isAuthenticated ? this.config.authenticated : this.config.anonymous;
    if (!rule) {
      return {
        allowed: true,
        rateLimitInfo: this.createEmptyRateLimitInfo(),
        rule: {} as RateLimitRule,
      };
    }

    const key = userId ? `user:${userId}` : `ip:${this.getClientId(event)}`;
    return this.checkRateLimitRule(key, rule, event);
  }

  /**
   * Check endpoint-specific rate limit
   */
  private async checkEndpointRateLimit(
    event: APIGatewayProxyEvent,
    endpoint: string
  ): Promise<{
    allowed: boolean;
    rateLimitInfo: RateLimitInfo;
    rule: RateLimitRule;
  }> {
    const rule = this.config.perEndpoint?.[endpoint];
    if (!rule) {
      return {
        allowed: true,
        rateLimitInfo: this.createEmptyRateLimitInfo(),
        rule: {} as RateLimitRule,
      };
    }

    const userId = this.extractUserId(event);
    const key = `endpoint:${endpoint}:${userId || this.getClientId(event)}`;
    return this.checkRateLimitRule(key, rule, event);
  }

  /**
   * Check burst limit
   */
  private async checkBurstLimit(
    event: APIGatewayProxyEvent,
    clientId: string
  ): Promise<{
    allowed: boolean;
    rateLimitInfo: RateLimitInfo;
    rule: RateLimitRule;
  }> {
    if (!this.config.burstLimit) {
      return {
        allowed: true,
        rateLimitInfo: this.createEmptyRateLimitInfo(),
        rule: {} as RateLimitRule,
      };
    }

    const rule: RateLimitRule = {
      windowMs: this.config.burstLimit.windowMs,
      maxRequests: this.config.burstLimit.maxRequests,
      message: 'Burst limit exceeded. Please slow down your requests.',
    };

    const key = `burst:${clientId}`;
    return this.checkRateLimitRule(key, rule, event);
  }

  /**
   * Core rate limit checking logic
   */
  private async checkRateLimitRule(
    key: string,
    rule: RateLimitRule,
    event: APIGatewayProxyEvent
  ): Promise<{
    allowed: boolean;
    rateLimitInfo: RateLimitInfo;
    rule: RateLimitRule;
  }> {
    const cacheKey = cacheKeys.api.rate_limit(key, 'requests');
    const now = Date.now();
    const windowStart = now - rule.windowMs;

    // Get current state
    const state = await cache.get<ThrottleState>(cacheKey) || {
      requestCount: 0,
      firstRequestTime: now,
      lastRequestTime: now,
      isBlocked: false,
    };

    // Reset window if expired
    if (state.firstRequestTime < windowStart) {
      state.requestCount = 0;
      state.firstRequestTime = now;
      state.isBlocked = false;
      delete state.blockUntil;
    }

    // Check if still blocked from previous violations
    if (state.blockUntil && now < state.blockUntil) {
      const rateLimitInfo: RateLimitInfo = {
        remaining: 0,
        resetTime: state.blockUntil,
        totalRequests: state.requestCount,
        windowMs: rule.windowMs,
        isBlocked: true,
      };

      return {
        allowed: false,
        rateLimitInfo,
        rule,
      };
    }

    // Increment request count
    state.requestCount++;
    state.lastRequestTime = now;

    // Check if limit exceeded
    const isBlocked = state.requestCount > rule.maxRequests;
    if (isBlocked) {
      state.isBlocked = true;
      state.blockUntil = now + rule.windowMs;
    }

    // Save updated state
    const ttl = Math.ceil(rule.windowMs / 1000);
    await cache.set(cacheKey, state, ttl);

    const rateLimitInfo: RateLimitInfo = {
      remaining: Math.max(0, rule.maxRequests - state.requestCount),
      resetTime: state.firstRequestTime + rule.windowMs,
      totalRequests: state.requestCount,
      windowMs: rule.windowMs,
      isBlocked,
    };

    return {
      allowed: !isBlocked,
      rateLimitInfo,
      rule,
    };
  }

  /**
   * Log request for analytics and monitoring
   */
  private async logRequest(
    event: APIGatewayProxyEvent,
    response: APIGatewayProxyResult,
    userId: string | null
  ): Promise<void> {
    const endpoint = this.getEndpoint(event);
    const hour = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
    
    // Log hourly request count
    const countKey = cacheKeys.counter.api_calls(endpoint, hour);
    await cache.increment(countKey);

    // Log user activity if authenticated
    if (userId) {
      const userKey = cacheKeys.counter.user_actions(userId, 'api_call', hour);
      await cache.increment(userKey);
    }

    // Track error rates
    if (response.statusCode >= 400) {
      const errorKey = cacheKeys.api.error(endpoint, response.statusCode.toString());
      await cache.increment(errorKey);
    }
  }

  /**
   * Create rate limit exceeded response
   */
  private createRateLimitResponse(
    rateLimitInfo: RateLimitInfo,
    rule: RateLimitRule
  ): APIGatewayProxyResult {
    const retryAfter = Math.ceil((rateLimitInfo.resetTime - Date.now()) / 1000);
    
    return {
      statusCode: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': rateLimitInfo.resetTime.toString(),
        'Retry-After': Math.max(0, retryAfter).toString(),
      },
      body: JSON.stringify({
        error: 'Rate limit exceeded',
        message: rule.message || 'Too many requests. Please try again later.',
        retryAfter,
        resetTime: rateLimitInfo.resetTime,
      }),
    };
  }

  /**
   * Extract user ID from event
   */
  private extractUserId(event: APIGatewayProxyEvent): string | null {
    // Try to get user ID from JWT claims
    const claims = event.requestContext.authorizer?.claims;
    if (claims?.sub) {
      return claims.sub;
    }

    // Try to get from custom authorizer
    if (event.requestContext.authorizer?.userId) {
      return event.requestContext.authorizer.userId;
    }

    // Try to get from headers
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (authHeader) {
      // This would need proper JWT parsing - simplified for now
      return 'authenticated_user';
    }

    return null;
  }

  /**
   * Get client ID (IP or other identifier)
   */
  private getClientId(event: APIGatewayProxyEvent): string {
    return event.requestContext.identity.sourceIp || 
           event.headers['X-Forwarded-For']?.split(',')[0]?.trim() ||
           'unknown';
  }

  /**
   * Get normalized endpoint path
   */
  private getEndpoint(event: APIGatewayProxyEvent): string {
    const path = event.path || event.requestContext.path || '';
    const method = event.httpMethod || event.requestContext.httpMethod || 'GET';
    
    // Normalize path parameters (e.g., /users/123 -> /users/{id})
    const normalizedPath = path
      .replace(/\/\d+/g, '/{id}')                    // Replace numeric IDs
      .replace(/\/[a-f0-9-]{36}/g, '/{uuid}')        // Replace UUIDs
      .replace(/\/[a-zA-Z0-9_-]{20,}/g, '/{token}'); // Replace long tokens
    
    return `${method}:${normalizedPath}`;
  }

  /**
   * Create empty rate limit info for when no limits apply
   */
  private createEmptyRateLimitInfo(): RateLimitInfo {
    return {
      remaining: Number.MAX_SAFE_INTEGER,
      resetTime: Date.now() + 3600000, // 1 hour from now
      totalRequests: 0,
      windowMs: 3600000,
      isBlocked: false,
    };
  }
}

/**
 * Create rate limiting middleware with default configuration
 */
export function createRateLimitingMiddleware(config?: RateLimitConfig): RateLimitingMiddleware {
  return new RateLimitingMiddleware(config || {});
}

/**
 * Helper function to wrap Lambda handler with rate limiting
 */
export function withRateLimit(
  handler: (event: APIGatewayProxyEvent, context: any) => Promise<APIGatewayProxyResult>,
  config?: RateLimitConfig
) {
  const rateLimiter = new RateLimitingMiddleware(config || {});
  
  return async (event: APIGatewayProxyEvent, context: any): Promise<APIGatewayProxyResult> => {
    // Check rate limit before processing request
    const rateLimitCheck = await rateLimiter.checkRateLimit(event);
    
    if (!rateLimitCheck.allowed) {
      return rateLimitCheck.response!;
    }

    // Process request
    const response = await handler(event, context);
    
    // Log request and add rate limit headers
    await rateLimiter.checkRateLimit(event, response);
    
    return rateLimiter.addRateLimitHeaders(response, rateLimitCheck.rateLimitInfo);
  };
}