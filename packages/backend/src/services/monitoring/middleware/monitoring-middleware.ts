/**
 * Monitoring Middleware
 * 
 * Easy-to-use middleware for Lambda functions that provides comprehensive monitoring
 */

import { APIGatewayProxyEvent, Context, APIGatewayProxyResult } from 'aws-lambda';
import { createLogger } from '../../logger';
import { getMonitoring } from '../factory';
import { TraceSpan } from '../types';

const logger = createLogger('monitoring-middleware');

export interface MonitoringOptions {
  enableTracing?: boolean;
  enableMetrics?: boolean;
  enableErrorTracking?: boolean;
  enablePerformanceMonitoring?: boolean;
  customTags?: Record<string, string>;
  sensitiveFields?: string[];
}

export interface MonitoredContext extends Context {
  monitoring?: {
    span?: TraceSpan;
    tags: Record<string, string>;
    metrics: {
      counter: (name: string, value?: number, tags?: Record<string, string>) => void;
      gauge: (name: string, value: number, tags?: Record<string, string>) => void;
      histogram: (name: string, value: number, tags?: Record<string, string>) => void;
      timer: (name: string, tags?: Record<string, string>) => () => void;
    };
    trackError: (error: Error, context?: any) => void;
    addLog: (level: string, message: string, fields?: any) => void;
  };
}

type LambdaHandler = (
  event: APIGatewayProxyEvent,
  context: MonitoredContext
) => Promise<APIGatewayProxyResult>;

/**
 * Wrap a Lambda handler with comprehensive monitoring
 */
export function withMonitoring(
  functionName: string,
  handler: LambdaHandler,
  options: MonitoringOptions = {}
): LambdaHandler {
  const {
    enableTracing = true,
    enableMetrics = true,
    enableErrorTracking = true,
    enablePerformanceMonitoring = true,
    customTags = {},
    sensitiveFields = ['password', 'token', 'authorization', 'secret'],
  } = options;

  return async (event: APIGatewayProxyEvent, context: MonitoredContext): Promise<APIGatewayProxyResult> => {
    const startTime = Date.now();
    let span: TraceSpan | undefined;
    let monitoring: any;

    try {
      // Initialize monitoring
      monitoring = await getMonitoring();

      // Create trace span
      if (enableTracing) {
        span = monitoring.tracing.createLambdaTraceContext(functionName, event, context);
        monitoring.tracing.setSpanTags(span, {
          ...customTags,
          'lambda.function_name': functionName,
          'http.method': event.httpMethod || 'unknown',
          'http.path': event.path || event.requestContext?.resourcePath || 'unknown',
          'user.id': event.requestContext?.authorizer?.userId || 'anonymous',
        });
      }

      // Add monitoring utilities to context
      context.monitoring = {
        span,
        tags: { ...customTags },
        metrics: {
          counter: (name: string, value = 1, tags = {}) => {
            if (enableMetrics) {
              monitoring.metrics.counter(`${functionName}.${name}`, value, { ...customTags, ...tags });
            }
          },
          gauge: (name: string, value: number, tags = {}) => {
            if (enableMetrics) {
              monitoring.metrics.gauge(`${functionName}.${name}`, value, { ...customTags, ...tags });
            }
          },
          histogram: (name: string, value: number, tags = {}) => {
            if (enableMetrics) {
              monitoring.metrics.histogram(`${functionName}.${name}`, value, { ...customTags, ...tags });
            }
          },
          timer: (name: string, tags = {}) => {
            if (enableMetrics) {
              return monitoring.metrics.timer(`${functionName}.${name}`, { ...customTags, ...tags });
            }
            return () => {}; // No-op if metrics disabled
          },
        },
        trackError: (error: Error, errorContext = {}) => {
          if (enableErrorTracking) {
            monitoring.errorTracking.trackError(error, {
              functionName,
              operation: `${event.httpMethod} ${event.path}`,
              userId: event.requestContext?.authorizer?.userId,
              requestId: context.awsRequestId,
              traceId: span?.traceId,
              spanId: span?.spanId,
              ...errorContext,
            });
          }
        },
        addLog: (level: string, message: string, fields = {}) => {
          if (span) {
            monitoring.tracing.addSpanLog(span, level as any, message, {
              ...fields,
              timestamp: new Date().toISOString(),
            });
          }
        },
      };

      // Record function invocation
      if (enableMetrics) {
        monitoring.metrics.counter(`${functionName}.invocations`, 1, customTags);
      }

      // Log function start
      logger.info('Lambda function started', {
        functionName,
        requestId: context.awsRequestId,
        traceId: span?.traceId,
        userId: event.requestContext?.authorizer?.userId,
        method: event.httpMethod,
        path: event.path,
      });

      // Add request details to span
      if (span) {
        monitoring.tracing.addSpanLog(span, 'info', 'Function started', {
          event: sanitizeEventForLogging(event, sensitiveFields),
          context: {
            requestId: context.awsRequestId,
            functionVersion: context.functionVersion,
            memoryLimitInMB: context.memoryLimitInMB,
            remainingTimeInMillis: context.getRemainingTimeInMillis(),
          },
        });
      }

      // Execute the handler
      const result = await handler(event, context);
      const duration = Date.now() - startTime;

      // Record success metrics
      if (enableMetrics) {
        monitoring.metrics.counter(`${functionName}.success`, 1, {
          ...customTags,
          status: result.statusCode.toString(),
        });
        monitoring.metrics.histogram(`${functionName}.duration`, duration, customTags);
      }

      // Record performance metrics
      if (enablePerformanceMonitoring) {
        monitoring.recordApiRequest(
          event.httpMethod || 'unknown',
          event.path || 'unknown',
          result.statusCode,
          duration,
          event.requestContext?.authorizer?.userId
        );
      }

      // Add response details to span
      if (span) {
        monitoring.tracing.setSpanTags(span, {
          'http.status_code': result.statusCode.toString(),
          'response.size': JSON.stringify(result.body || '').length.toString(),
        });

        monitoring.tracing.addSpanLog(span, 'info', 'Function completed successfully', {
          statusCode: result.statusCode,
          duration,
          responseSize: JSON.stringify(result.body || '').length,
        });

        // Finish span
        monitoring.tracing.finishSpan(span);
      }

      // Log function completion
      logger.info('Lambda function completed', {
        functionName,
        requestId: context.awsRequestId,
        traceId: span?.traceId,
        statusCode: result.statusCode,
        duration,
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error as Error;

      // Record error metrics
      if (enableMetrics && monitoring) {
        monitoring.metrics.counter(`${functionName}.errors`, 1, {
          ...customTags,
          error_type: err.name,
        });
        monitoring.metrics.histogram(`${functionName}.duration`, duration, {
          ...customTags,
          status: 'error',
        });
      }

      // Track error
      if (enableErrorTracking && monitoring) {
        monitoring.errorTracking.trackError(err, {
          functionName,
          operation: `${event.httpMethod} ${event.path}`,
          userId: event.requestContext?.authorizer?.userId,
          requestId: context.awsRequestId,
          traceId: span?.traceId,
          spanId: span?.spanId,
          event: sanitizeEventForLogging(event, sensitiveFields),
        });
      }

      // Add error details to span
      if (span && monitoring) {
        monitoring.tracing.addSpanLog(span, 'error', 'Function failed', {
          error: {
            name: err.name,
            message: err.message,
            stack: err.stack,
          },
          duration,
        });

        // Finish span with error
        monitoring.tracing.finishSpan(span, err);
      }

      // Log error
      logger.error('Lambda function failed', err, {
        functionName,
        requestId: context.awsRequestId,
        traceId: span?.traceId,
        duration,
        userId: event.requestContext?.authorizer?.userId,
        method: event.httpMethod,
        path: event.path,
      });

      // Re-throw the error
      throw error;
    }
  };
}

/**
 * Simple monitoring decorator for TypeScript/Node.js functions
 */
export function monitor(
  operationName: string,
  options: MonitoringOptions = {}
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      let span: TraceSpan | undefined;
      let monitoring: any;

      try {
        monitoring = await getMonitoring();

        // Create trace span
        if (options.enableTracing !== false) {
          span = monitoring.tracing.startSpan(operationName);
          monitoring.tracing.setSpanTags(span, {
            'operation.name': operationName,
            'method.name': propertyKey,
            'class.name': target.constructor.name,
            ...options.customTags,
          });
        }

        // Record invocation metric
        if (options.enableMetrics !== false) {
          monitoring.metrics.counter(`${operationName}.invocations`, 1, options.customTags);
        }

        // Execute the original method
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;

        // Record success metrics
        if (options.enableMetrics !== false) {
          monitoring.metrics.counter(`${operationName}.success`, 1, options.customTags);
          monitoring.metrics.histogram(`${operationName}.duration`, duration, options.customTags);
        }

        // Finish span
        if (span) {
          monitoring.tracing.finishSpan(span);
        }

        return result;

      } catch (error) {
        const duration = Date.now() - startTime;
        const err = error as Error;

        // Record error metrics
        if (options.enableMetrics !== false && monitoring) {
          monitoring.metrics.counter(`${operationName}.errors`, 1, {
            ...options.customTags,
            error_type: err.name,
          });
          monitoring.metrics.histogram(`${operationName}.duration`, duration, {
            ...options.customTags,
            status: 'error',
          });
        }

        // Track error
        if (options.enableErrorTracking !== false && monitoring) {
          monitoring.errorTracking.trackError(err, {
            operation: operationName,
            method: propertyKey,
            class: target.constructor.name,
            args: sanitizeArgsForLogging(args, options.sensitiveFields),
          });
        }

        // Finish span with error
        if (span && monitoring) {
          monitoring.tracing.finishSpan(span, err);
        }

        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Sanitize event object for logging (remove sensitive data)
 */
function sanitizeEventForLogging(
  event: APIGatewayProxyEvent,
  sensitiveFields: string[]
): any {
  const sanitized = { ...event };

  // Remove sensitive headers
  if (sanitized.headers) {
    sanitized.headers = { ...sanitized.headers };
    sensitiveFields.forEach(field => {
      Object.keys(sanitized.headers).forEach(key => {
        if (key.toLowerCase().includes(field.toLowerCase())) {
          sanitized.headers[key] = '[REDACTED]';
        }
      });
    });
  }

  // Remove sensitive query parameters
  if (sanitized.queryStringParameters) {
    sanitized.queryStringParameters = { ...sanitized.queryStringParameters };
    sensitiveFields.forEach(field => {
      Object.keys(sanitized.queryStringParameters || {}).forEach(key => {
        if (key.toLowerCase().includes(field.toLowerCase())) {
          sanitized.queryStringParameters![key] = '[REDACTED]';
        }
      });
    });
  }

  // Remove sensitive body fields (if JSON)
  if (sanitized.body) {
    try {
      const bodyObj = JSON.parse(sanitized.body);
      const sanitizedBody = { ...bodyObj };
      
      sensitiveFields.forEach(field => {
        Object.keys(sanitizedBody).forEach(key => {
          if (key.toLowerCase().includes(field.toLowerCase())) {
            sanitizedBody[key] = '[REDACTED]';
          }
        });
      });
      
      sanitized.body = JSON.stringify(sanitizedBody);
    } catch {
      // Not JSON, leave as is
    }
  }

  return sanitized;
}

/**
 * Sanitize function arguments for logging
 */
function sanitizeArgsForLogging(
  args: any[],
  sensitiveFields: string[] = []
): any[] {
  return args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      const sanitized = { ...arg };
      sensitiveFields.forEach(field => {
        Object.keys(sanitized).forEach(key => {
          if (key.toLowerCase().includes(field.toLowerCase())) {
            sanitized[key] = '[REDACTED]';
          }
        });
      });
      return sanitized;
    }
    return arg;
  });
}

/**
 * Create a monitored version of any async function
 */
export function createMonitoredFunction<T extends any[], R>(
  functionName: string,
  fn: (...args: T) => Promise<R>,
  options: MonitoringOptions = {}
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now();
    let span: TraceSpan | undefined;
    let monitoring: any;

    try {
      monitoring = await getMonitoring();

      // Create trace span
      if (options.enableTracing !== false) {
        span = monitoring.tracing.startSpan(functionName);
        monitoring.tracing.setSpanTags(span, {
          'function.name': functionName,
          ...options.customTags,
        });
      }

      // Record invocation metric
      if (options.enableMetrics !== false) {
        monitoring.metrics.counter(`${functionName}.invocations`, 1, options.customTags);
      }

      // Execute the function
      const result = await fn(...args);
      const duration = Date.now() - startTime;

      // Record success metrics
      if (options.enableMetrics !== false) {
        monitoring.metrics.counter(`${functionName}.success`, 1, options.customTags);
        monitoring.metrics.histogram(`${functionName}.duration`, duration, options.customTags);
      }

      // Finish span
      if (span) {
        monitoring.tracing.finishSpan(span);
      }

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error as Error;

      // Record error metrics
      if (options.enableMetrics !== false && monitoring) {
        monitoring.metrics.counter(`${functionName}.errors`, 1, {
          ...options.customTags,
          error_type: err.name,
        });
        monitoring.metrics.histogram(`${functionName}.duration`, duration, {
          ...options.customTags,
          status: 'error',
        });
      }

      // Track error
      if (options.enableErrorTracking !== false && monitoring) {
        monitoring.errorTracking.trackError(err, {
          functionName,
          args: sanitizeArgsForLogging(args, options.sensitiveFields),
        });
      }

      // Finish span with error
      if (span && monitoring) {
        monitoring.tracing.finishSpan(span, err);
      }

      throw error;
    }
  };
}