/**
 * Standardized API Response Format Utility
 * Ensures consistent response structure across all endpoints
 */

import { APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '../services/logger';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export interface ApiMeta {
  timestamp: string;
  correlationId?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

/**
 * Standard error codes for consistency
 */
export const ErrorCodes = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',
  
  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Business logic
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  INVALID_OPERATION: 'INVALID_OPERATION',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Create a successful API response
 */
export function successResponse<T>(
  data: T,
  statusCode: number = 200,
  meta?: Partial<ApiMeta>
): APIGatewayProxyResult {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': meta?.correlationId || generateRequestId(),
    },
    body: JSON.stringify(response),
  };
}

/**
 * Create an error API response
 */
export function errorResponse(
  error: ApiError | Error | string,
  statusCode: number = 500,
  correlationId?: string
): APIGatewayProxyResult {
  let apiError: ApiError;

  if (typeof error === 'string') {
    apiError = {
      code: ErrorCodes.INTERNAL_ERROR,
      message: error,
    };
  } else if (error instanceof Error) {
    apiError = {
      code: ErrorCodes.INTERNAL_ERROR,
      message: error.message,
      details: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
    };
  } else {
    apiError = error;
  }

  const response: ApiResponse = {
    success: false,
    error: apiError,
    meta: {
      timestamp: new Date().toISOString(),
      correlationId: correlationId || generateRequestId(),
    },
  };

  // Log error for monitoring
  logger.error('API Error Response', {
    statusCode,
    error: apiError,
    correlationId: response.meta?.correlationId,
  });

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': response.meta?.correlationId,
    },
    body: JSON.stringify(response),
  };
}

/**
 * Common error responses
 */
export const CommonResponses = {
  // 400 Bad Request
  badRequest: (message: string = 'Bad request', details?: any) =>
    errorResponse({
      code: ErrorCodes.VALIDATION_ERROR,
      message,
      details,
    }, 400),

  // 401 Unauthorized
  unauthorized: (message: string = 'Authentication required') =>
    errorResponse({
      code: ErrorCodes.UNAUTHORIZED,
      message,
    }, 401),

  // 403 Forbidden
  forbidden: (message: string = 'Access denied') =>
    errorResponse({
      code: ErrorCodes.FORBIDDEN,
      message,
    }, 403),

  // 404 Not Found
  notFound: (resource: string = 'Resource') =>
    errorResponse({
      code: ErrorCodes.NOT_FOUND,
      message: `${resource} not found`,
    }, 404),

  // 409 Conflict
  conflict: (message: string = 'Resource conflict') =>
    errorResponse({
      code: ErrorCodes.CONFLICT,
      message,
    }, 409),

  // 422 Unprocessable Entity
  validationError: (errors: any) =>
    errorResponse({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Validation failed',
      details: errors,
    }, 422),

  // 429 Too Many Requests
  rateLimitExceeded: (retryAfter?: number) =>
    errorResponse({
      code: ErrorCodes.RATE_LIMIT_EXCEEDED,
      message: 'Too many requests',
      details: retryAfter ? { retryAfter } : undefined,
    }, 429),

  // 500 Internal Server Error
  internalError: (message: string = 'Internal server error', error?: Error) =>
    errorResponse({
      code: ErrorCodes.INTERNAL_ERROR,
      message,
      details: process.env.NODE_ENV !== 'production' && error ? error.stack : undefined,
    }, 500),

  // 503 Service Unavailable
  serviceUnavailable: (message: string = 'Service temporarily unavailable') =>
    errorResponse({
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      message,
    }, 503),
};

/**
 * Create a paginated response
 */
export function paginatedResponse<T>(
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  },
  statusCode: number = 200
): APIGatewayProxyResult {
  return successResponse(data, statusCode, {
    pagination: {
      ...pagination,
      hasMore: pagination.page * pagination.limit < pagination.total,
    },
  });
}

/**
 * Parse API Gateway event body with error handling
 */
export function parseBody<T>(body: string | null): T | null {
  if (!body) {
    return null;
  }

  try {
    return JSON.parse(body) as T;
  } catch (error) {
    throw new ValidationError('Invalid JSON in request body');
  }
}

/**
 * Custom error classes for better error handling
 */
export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: any) {
    super(ErrorCodes.VALIDATION_ERROR, message, 400, details);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Authentication required') {
    super(ErrorCodes.UNAUTHORIZED, message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = 'Access denied') {
    super(ErrorCodes.FORBIDDEN, message, 403);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string = 'Resource') {
    super(ErrorCodes.NOT_FOUND, `${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(ErrorCodes.CONFLICT, message, 409);
    this.name = 'ConflictError';
  }
}

/**
 * Generate a unique request ID for correlation
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Type guard to check if error is an ApiError
 */
export function isApiError(error: any): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Convert various error types to ApiError
 */
export function toApiError(error: any): ApiError {
  if (isApiError(error)) {
    return error;
  }

  if (error.name === 'ZodError') {
    return new ValidationError('Validation failed', error.errors);
  }

  if (error.message?.includes('Unauthorized')) {
    return new UnauthorizedError(error.message);
  }

  if (error.message?.includes('not found')) {
    return new NotFoundError();
  }

  return new ApiError(
    ErrorCodes.INTERNAL_ERROR,
    error.message || 'An unexpected error occurred',
    500,
    process.env.NODE_ENV !== 'production' ? error.stack : undefined
  );
}