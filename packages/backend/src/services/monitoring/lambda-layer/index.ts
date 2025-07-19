/**
 * Monitoring Lambda Layer
 * 
 * Pre-configured monitoring layer for easy integration across all Lambda functions
 */

import { APIGatewayProxyEvent, Context, APIGatewayProxyResult } from 'aws-lambda';
import { getMonitoring, MonitoringFactory } from '../factory';
import { withMonitoring, MonitoredContext } from '../middleware/monitoring-middleware';
import { getMonitoringConfig } from '../config/monitoring-config';
import { CloudWatchIntegrationService } from '../cloudwatch-integration.service';
import { createLogger } from '../../logger';

const logger = createLogger('monitoring-layer');

// Global monitoring instance
let globalMonitoring: any = null;
let cloudWatchIntegration: CloudWatchIntegrationService | null = null;

/**
 * Initialize monitoring layer (called once per Lambda container)
 */
export async function initializeMonitoringLayer(): Promise<void> {
  if (globalMonitoring) {
    return; // Already initialized
  }

  try {
    const config = getMonitoringConfig();
    
    logger.info('Initializing monitoring layer', {
      environment: config.environment,
      cloudWatchEnabled: config.cloudWatch.enabled,
    });

    // Initialize monitoring service
    globalMonitoring = await getMonitoring();

    // Initialize CloudWatch integration if enabled
    if (config.cloudWatch.enabled) {
      cloudWatchIntegration = new CloudWatchIntegrationService(config.cloudWatch);
      
      // Set up production monitoring (dashboards and alarms) in production
      if (config.environment === 'production') {
        await cloudWatchIntegration.setupProductionMonitoring();
      }
    }

    logger.info('Monitoring layer initialized successfully');

  } catch (error) {
    logger.error('Failed to initialize monitoring layer', error as Error);
    // Don't throw - allow Lambda to continue without monitoring
  }
}

/**
 * Shutdown monitoring layer (called on container shutdown)
 */
export async function shutdownMonitoringLayer(): Promise<void> {
  try {
    logger.info('Shutting down monitoring layer');

    await Promise.all([
      globalMonitoring?.shutdown(),
      cloudWatchIntegration?.shutdown(),
      MonitoringFactory.shutdown(),
    ]);

    globalMonitoring = null;
    cloudWatchIntegration = null;

    logger.info('Monitoring layer shutdown complete');

  } catch (error) {
    logger.error('Error during monitoring layer shutdown', error as Error);
  }
}

/**
 * Enhanced monitoring wrapper with automatic initialization
 */
export function monitoredLambda(
  functionName: string,
  options: {
    enableTracing?: boolean;
    enableMetrics?: boolean;
    enableErrorTracking?: boolean;
    enablePerformanceMonitoring?: boolean;
    customTags?: Record<string, string>;
    sensitiveFields?: string[];
    requireAuth?: boolean;
    enableCors?: boolean;
  } = {}
) {
  return (handler: (event: APIGatewayProxyEvent, context: MonitoredContext) => Promise<APIGatewayProxyResult>) => {
    return async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
      // Initialize monitoring if not already done
      await initializeMonitoringLayer();

      // Create monitored version of the handler
      const monitoredHandler = withMonitoring(functionName, handler, options);

      // Execute with monitoring
      return monitoredHandler(event, context as MonitoredContext);
    };
  };
}

/**
 * Express-style monitoring middleware for API Gateway
 */
export function createMonitoringMiddleware() {
  return async (event: APIGatewayProxyEvent, context: Context, next: Function) => {
    await initializeMonitoringLayer();
    
    if (!globalMonitoring) {
      return next(); // Continue without monitoring if initialization failed
    }

    const startTime = Date.now();
    const span = globalMonitoring.tracing.createLambdaTraceContext(
      context.functionName,
      event,
      context
    );

    try {
      // Add monitoring context to event
      (event as any).monitoring = globalMonitoring;
      (event as any).span = span;

      // Execute next middleware/handler
      const result = await next();
      
      const duration = Date.now() - startTime;
      
      // Record metrics
      globalMonitoring.recordApiRequest(
        event.httpMethod || 'unknown',
        event.path || 'unknown',
        result?.statusCode || 200,
        duration,
        event.requestContext?.authorizer?.userId
      );

      // Finish span
      globalMonitoring.tracing.finishSpan(span);

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Track error
      globalMonitoring.errorTracking.trackError(error as Error, {
        functionName: context.functionName,
        operation: `${event.httpMethod} ${event.path}`,
        userId: event.requestContext?.authorizer?.userId,
        requestId: context.awsRequestId,
        traceId: span.traceId,
        spanId: span.spanId,
      });

      // Record error metrics
      globalMonitoring.recordApiRequest(
        event.httpMethod || 'unknown',
        event.path || 'unknown',
        500,
        duration,
        event.requestContext?.authorizer?.userId,
        error as Error
      );

      // Finish span with error
      globalMonitoring.tracing.finishSpan(span, error as Error);

      throw error;
    }
  };
}

/**
 * Database monitoring wrapper
 */
export function monitorDatabase<T>(
  operation: string,
  table: string,
  query?: string
) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      if (!globalMonitoring) {
        return originalMethod.apply(this, args);
      }

      const parentSpan = args.find(arg => arg?.traceId); // Look for span in arguments
      const span = globalMonitoring.tracing.createDatabaseSpan(
        parentSpan,
        operation,
        table,
        query
      );

      const startTime = Date.now();

      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;

        // Record successful database operation
        globalMonitoring.recordDatabaseOperation(operation, table, duration, true);
        globalMonitoring.tracing.finishSpan(span);

        return result;

      } catch (error) {
        const duration = Date.now() - startTime;

        // Record failed database operation
        globalMonitoring.recordDatabaseOperation(operation, table, duration, false, error as Error);
        globalMonitoring.tracing.finishSpan(span, error as Error);

        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * External service monitoring wrapper
 */
export function monitorExternalService(
  serviceName: string,
  operation: string
) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      if (!globalMonitoring) {
        return originalMethod.apply(this, args);
      }

      const parentSpan = args.find(arg => arg?.traceId); // Look for span in arguments
      const span = globalMonitoring.tracing.createExternalSpan(
        parentSpan,
        serviceName,
        operation
      );

      const startTime = Date.now();

      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;

        // Record successful external service call
        globalMonitoring.metrics.histogram(`external.${serviceName}.${operation}.duration`, duration);
        globalMonitoring.metrics.counter(`external.${serviceName}.${operation}.success`, 1);
        globalMonitoring.tracing.finishSpan(span);

        return result;

      } catch (error) {
        const duration = Date.now() - startTime;

        // Record failed external service call
        globalMonitoring.metrics.histogram(`external.${serviceName}.${operation}.duration`, duration);
        globalMonitoring.metrics.counter(`external.${serviceName}.${operation}.error`, 1);
        
        globalMonitoring.errorTracking.trackError(error as Error, {
          service: serviceName,
          operation,
        });

        globalMonitoring.tracing.finishSpan(span, error as Error);

        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Business metric recording helper
 */
export function recordBusinessMetric(
  event: string,
  value: number = 1,
  metadata: Record<string, string> = {},
  userId?: string
): void {
  if (globalMonitoring) {
    globalMonitoring.recordBusinessEvent(event, value, metadata, userId);
  }
}

/**
 * Manual error tracking helper
 */
export function trackError(
  error: Error,
  context: {
    operation?: string;
    userId?: string;
    teamId?: string;
    metadata?: Record<string, any>;
  } = {}
): void {
  if (globalMonitoring) {
    globalMonitoring.errorTracking.trackError(error, context);
  }
}

/**
 * Get current monitoring instance
 */
export function getMonitoringInstance(): any {
  return globalMonitoring;
}

/**
 * Health check function for monitoring layer
 */
export async function healthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: any;
}> {
  try {
    if (!globalMonitoring) {
      return {
        status: 'unhealthy',
        details: { error: 'Monitoring not initialized' },
      };
    }

    const health = await globalMonitoring.getMonitoringHealth();
    return {
      status: health.status,
      details: health.details,
    };

  } catch (error) {
    return {
      status: 'unhealthy',
      details: { error: (error as Error).message },
    };
  }
}

// Lambda container lifecycle hooks
process.on('SIGTERM', shutdownMonitoringLayer);
process.on('SIGINT', shutdownMonitoringLayer);
process.on('beforeExit', shutdownMonitoringLayer);

// Export all monitoring utilities
export {
  initializeMonitoringLayer,
  shutdownMonitoringLayer,
  globalMonitoring as monitoring,
  cloudWatchIntegration,
};

// Default export for easy importing
export default {
  monitoredLambda,
  createMonitoringMiddleware,
  monitorDatabase,
  monitorExternalService,
  recordBusinessMetric,
  trackError,
  getMonitoringInstance,
  healthCheck,
  initializeMonitoringLayer,
  shutdownMonitoringLayer,
};