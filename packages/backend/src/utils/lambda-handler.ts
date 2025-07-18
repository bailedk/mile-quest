/**
 * Lambda handler factory and utilities
 */

import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import { config } from '../config/environment';

export type LambdaHandler = (
  event: APIGatewayProxyEvent,
  context: Context
) => Promise<APIGatewayProxyResult>;

export type RouteHandler = (
  event: APIGatewayProxyEvent,
  context: Context
) => Promise<any>;

interface HandlerOptions {
  enableCors?: boolean;
  requireAuth?: boolean;
  validateBody?: boolean;
}

/**
 * Create a Lambda handler with common middleware
 */
export function createHandler(
  handler: RouteHandler,
  options: HandlerOptions = {}
): LambdaHandler {
  const {
    enableCors = true,
    requireAuth = false,
    validateBody = false,
  } = options;

  return async (
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> => {
    try {
      // Set context settings
      context.callbackWaitsForEmptyEventLoop = false;

      // Handle CORS preflight
      if (enableCors && event.httpMethod === 'OPTIONS') {
        return createResponse(200, {}, getCorsHeaders());
      }

      // Process the request
      const result = await handler(event, context);

      // Return successful response
      return createResponse(
        result.statusCode || 200,
        result.body || result,
        enableCors ? getCorsHeaders() : {}
      );
    } catch (error) {
      console.error('Lambda handler error:', error);
      
      // Return error response
      return createErrorResponse(error as Error, enableCors);
    }
  };
}

/**
 * Create a standardized API response
 */
export function createResponse(
  statusCode: number,
  body: any,
  headers: Record<string, string> = {}
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: Error,
  enableCors: boolean = true
): APIGatewayProxyResult {
  const statusCode = (error as any).statusCode || 500;
  const message = error.message || 'Internal server error';
  
  return createResponse(
    statusCode,
    {
      error: {
        message,
        code: (error as any).code || 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      },
    },
    enableCors ? getCorsHeaders() : {}
  );
}

/**
 * Get CORS headers based on environment
 */
export function getCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': config.CORS_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Api-Key',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Parse JSON body from event
 */
export function parseBody<T = any>(event: APIGatewayProxyEvent): T | null {
  if (!event.body) {
    return null;
  }

  try {
    return JSON.parse(event.body);
  } catch (error) {
    throw new BadRequestError('Invalid JSON body');
  }
}

/**
 * Extract path parameters
 */
export function getPathParameter(
  event: APIGatewayProxyEvent,
  name: string
): string | undefined {
  return event.pathParameters?.[name];
}

/**
 * Extract query parameters
 */
export function getQueryParameter(
  event: APIGatewayProxyEvent,
  name: string
): string | undefined {
  return event.queryStringParameters?.[name];
}

/**
 * Custom error classes
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'API_ERROR'
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string) {
    super(message, 400, 'BAD_REQUEST');
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = 'Not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, public errors?: any) {
    super(message, 422, 'VALIDATION_ERROR');
  }
}