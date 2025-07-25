/**
 * Centralized Error Handler Middleware
 * Provides consistent error handling across all Lambda handlers
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { logger } from '../services/logger';
import { 
  errorResponse, 
  CommonResponses,
  isApiError,
  toApiError,
  ErrorCodes
} from '../utils/api-response';
import { isAuthError } from '../utils/auth/jwt.utils';
import { z } from 'zod';

export interface ErrorHandlerConfig {
  logErrors?: boolean;
  includeStackTrace?: boolean;
  customErrorHandlers?: Record<string, (error: any) => APIGatewayProxyResult>;
}

/**
 * Wrap a Lambda handler with error handling
 */
export function withErrorHandler(
  handler: (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>,
  config: ErrorHandlerConfig = {}
) {
  const {
    logErrors = true,
    includeStackTrace = process.env.NODE_ENV !== 'production',
    customErrorHandlers = {}
  } = config;

  return async (
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> => {
    try {
      // Execute the handler
      return await handler(event, context);
    } catch (error: any) {
      // Generate correlation ID for error tracking
      const correlationId = context.requestId || generateCorrelationId();

      // Log error if enabled
      if (logErrors) {
        logger.error('Lambda handler error', {
          error: error.message,
          stack: includeStackTrace ? error.stack : undefined,
          path: event.path,
          method: event.httpMethod,
          correlationId,
          requestId: context.requestId,
          functionName: context.functionName,
        });
      }

      // Check for custom error handlers
      const errorName = error.constructor.name;
      if (customErrorHandlers[errorName]) {
        return customErrorHandlers[errorName](error);
      }

      // Handle specific error types
      return handleError(error, correlationId, includeStackTrace);
    }
  };
}

/**
 * Handle different error types and return appropriate responses
 */
function handleError(
  error: any,
  correlationId: string,
  includeStackTrace: boolean
): APIGatewayProxyResult {
  // Auth errors
  if (isAuthError(error)) {
    return CommonResponses.unauthorized(error.message);
  }

  // Zod validation errors
  if (error instanceof z.ZodError) {
    return CommonResponses.validationError(error.errors);
  }

  // Prisma errors
  if (error.code === 'P2002') {
    // Unique constraint violation
    const field = error.meta?.target?.[0] || 'field';
    return CommonResponses.conflict(`A record with this ${field} already exists`);
  }

  if (error.code === 'P2025') {
    // Record not found
    return CommonResponses.notFound('Resource');
  }

  if (error.code === 'P2003') {
    // Foreign key constraint violation
    return CommonResponses.badRequest('Invalid reference to related resource');
  }

  // API errors (already formatted)
  if (isApiError(error)) {
    return errorResponse(error, error.statusCode, correlationId);
  }

  // Common error patterns
  if (error.message?.toLowerCase().includes('not found')) {
    return CommonResponses.notFound();
  }

  if (error.message?.toLowerCase().includes('unauthorized')) {
    return CommonResponses.unauthorized();
  }

  if (error.message?.toLowerCase().includes('forbidden')) {
    return CommonResponses.forbidden();
  }

  if (error.message?.toLowerCase().includes('invalid')) {
    return CommonResponses.badRequest(error.message);
  }

  if (error.message?.toLowerCase().includes('timeout')) {
    return errorResponse({
      code: ErrorCodes.TIMEOUT,
      message: 'Request timeout',
    }, 504, correlationId);
  }

  // Default to internal server error
  return CommonResponses.internalError(
    'An unexpected error occurred',
    includeStackTrace ? error : undefined
  );
}

/**
 * Middleware to catch and handle async errors in router handlers
 */
export function asyncErrorHandler(
  handler: (event: APIGatewayProxyEvent, context: Context, params: any) => Promise<any>
) {
  return async (
    event: APIGatewayProxyEvent,
    context: Context,
    params: any
  ): Promise<APIGatewayProxyResult> => {
    try {
      const result = await handler(event, context, params);
      
      // Ensure the result is a valid API Gateway response
      if (!result || typeof result !== 'object' || !result.statusCode) {
        logger.warn('Handler returned invalid response', { result });
        return CommonResponses.internalError('Invalid response from handler');
      }
      
      return result;
    } catch (error: any) {
      const correlationId = context.requestId || generateCorrelationId();
      
      logger.error('Route handler error', {
        error: error.message,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
        path: event.path,
        method: event.httpMethod,
        params,
        correlationId,
      });
      
      return handleError(
        error, 
        correlationId, 
        process.env.NODE_ENV !== 'production'
      );
    }
  };
}

/**
 * Error boundary for service methods
 */
export function serviceErrorBoundary<T extends (...args: any[]) => Promise<any>>(
  method: T,
  serviceName: string
): T {
  return (async (...args: any[]) => {
    try {
      return await method(...args);
    } catch (error: any) {
      logger.error(`Service error in ${serviceName}`, {
        method: method.name,
        error: error.message,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
      });
      
      // Convert to API error
      throw toApiError(error);
    }
  }) as T;
}

/**
 * Generate a correlation ID for error tracking
 */
function generateCorrelationId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Express-style error handler for the router
 */
export function routerErrorHandler(
  err: any,
  event: APIGatewayProxyEvent,
  context: Context,
  next: Function
): APIGatewayProxyResult {
  const correlationId = context.requestId || generateCorrelationId();
  
  logger.error('Router error', {
    error: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    path: event.path,
    method: event.httpMethod,
    correlationId,
  });
  
  return handleError(
    err,
    correlationId,
    process.env.NODE_ENV !== 'production'
  );
}