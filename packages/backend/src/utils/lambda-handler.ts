/**
 * Lambda handler factory and utilities with BE-701 optimizations
 */

import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import { config } from '../config/environment';
import { createLogger, MileQuestLogger } from '../services/logger';
import { withOptimization, monitorMemoryUsage } from './lambda-optimization';
import { withCompression } from '../middleware/compression.middleware';
import { withRateLimit } from '../middleware/rate-limiting.middleware';

export type LambdaHandler = (
  event: APIGatewayProxyEvent,
  context: Context
) => Promise<APIGatewayProxyResult>;

export interface EnhancedContext extends Context {
  logger: MileQuestLogger;
}

export type RouteHandler = (
  event: APIGatewayProxyEvent,
  context: EnhancedContext
) => Promise<any>;

interface HandlerOptions {
  enableCors?: boolean;
  requireAuth?: boolean;
  validateBody?: boolean;
  functionName?: string;
  // BE-701 Performance optimizations
  enableOptimization?: boolean;
  enableCompression?: boolean;
  enableRateLimit?: boolean;
  rateLimitConfig?: any;
  compressionConfig?: any;
}

/**
 * Create a Lambda handler with common middleware and BE-701 optimizations
 */
export function createHandler(
  handler: RouteHandler,
  options: HandlerOptions = {}
): LambdaHandler {
  const {
    enableCors = true,
    requireAuth = false,
    validateBody = false,
    functionName = 'unknown-function',
    enableOptimization = true,
    enableCompression = true,
    enableRateLimit = false,
    rateLimitConfig,
    compressionConfig,
  } = options;

  // Create the base handler
  const baseHandler = async (
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> => {
    // Create logger for this request
    const logger = createLogger(functionName);
    
    // Set correlation ID
    const correlationId = event.headers?.['x-correlation-id'] || 
                         event.requestContext?.requestId || 
                         context.awsRequestId ||
                         `local-${Date.now()}`;
    
    logger.setCorrelationId(correlationId);
    
    // Create enhanced context with logger
    const enhancedContext = context as EnhancedContext;
    enhancedContext.logger = logger;
    
    // Monitor memory usage - BE-701
    const memoryBefore = monitorMemoryUsage();
    
    // Log incoming request with performance info
    logger.info('Incoming request', {
      httpMethod: event.httpMethod,
      path: event.path,
      pathParameters: event.pathParameters,
      queryStringParameters: event.queryStringParameters,
      headers: {
        'user-agent': event.headers?.['user-agent'],
        'content-type': event.headers?.['content-type'],
      },
      memoryUsage: memoryBefore,
      remainingTime: context.getRemainingTimeInMillis?.(),
    });
    
    const timer = logger.startTimer('request-processing');
    
    try {
      // Set context settings for performance
      context.callbackWaitsForEmptyEventLoop = false;

      // Handle CORS preflight
      if (enableCors && event.httpMethod === 'OPTIONS') {
        const response = createResponse(200, {}, getCorsHeaders());
        logger.info('CORS preflight response', { statusCode: 200 });
        return response;
      }

      // Process the request
      const result = await handler(event, enhancedContext);

      // Stop timer
      const processingTime = timer();

      // Monitor memory usage after processing
      const memoryAfter = monitorMemoryUsage();
      const memoryDelta = memoryAfter.heapUsed - memoryBefore.heapUsed;

      // Return successful response
      const response = createResponse(
        result.statusCode || 200,
        result.body || result,
        {
          ...(enableCors ? getCorsHeaders() : {}),
          'X-Processing-Time': `${processingTime}ms`,
          'X-Memory-Used': `${memoryAfter.heapUsed}MB`,
          'X-Memory-Delta': `${memoryDelta}MB`,
        }
      );
      
      logger.info('Request completed', {
        statusCode: response.statusCode,
        correlationId,
        processingTime,
        memoryUsage: memoryAfter,
        memoryDelta,
      });
      
      return response;
    } catch (error) {
      // Stop timer
      const processingTime = timer();
      
      // Log error with performance context
      logger.error('Lambda handler error', error as Error, {
        correlationId,
        httpMethod: event.httpMethod,
        path: event.path,
        processingTime,
        memoryUsage: monitorMemoryUsage(),
      });
      
      // Return error response
      return createErrorResponse(error as Error, enableCors);
    }
  };

  // Apply middleware layers in reverse order (outermost first)
  let finalHandler = baseHandler;

  // Apply optimization wrapper (closest to handler)
  if (enableOptimization) {
    finalHandler = withOptimization(finalHandler, {
      enableConnectionReuse: true,
      enablePrecomputation: true,
      enableWarmup: true,
      cacheStaticData: true,
    });
  }

  // Apply compression middleware
  if (enableCompression) {
    finalHandler = withCompression(finalHandler, compressionConfig);
  }

  // Apply rate limiting middleware (outermost)
  if (enableRateLimit) {
    finalHandler = withRateLimit(finalHandler, rateLimitConfig);
  }

  return finalHandler;
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