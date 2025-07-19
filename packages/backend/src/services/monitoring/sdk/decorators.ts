/**
 * Monitoring Decorators
 * 
 * Easy-to-use decorators and wrappers for monitoring
 */

import { monitoringSDK } from './monitoring-sdk';
import { MonitoringOptions, MonitoringMetadata } from './types';

/**
 * Decorator for monitoring functions
 */
export function withMonitoring(options: MonitoringOptions = {}) {
  return function <T extends any[], R>(
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: T) => Promise<R>>
  ) {
    const originalMethod = descriptor.value;
    if (!originalMethod) return;

    const functionName = options.functionName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = monitoringSDK.monitorFunction(
      functionName,
      originalMethod.bind(target),
      {
        trackErrors: true,
        trackMetrics: true,
        trackTracing: true,
        ...options,
      }
    );

    return descriptor;
  };
}

/**
 * Create a monitored version of a function
 */
export function createMonitoredFunction<T extends any[], R>(
  functionName: string,
  fn: (...args: T) => Promise<R>,
  options: MonitoringOptions = {}
): (...args: T) => Promise<R> {
  return monitoringSDK.monitorFunction(functionName, fn, {
    trackErrors: true,
    trackMetrics: true,
    trackTracing: true,
    ...options,
  });
}

/**
 * Monitor external service calls
 */
export function monitorExternalService(serviceName: string, serviceType: 'http' | 'database' | 'queue' | 'cache' | 'storage' = 'http') {
  return function <T extends any[], R>(
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: T) => Promise<R>>
  ) {
    const originalMethod = descriptor.value;
    if (!originalMethod) return;

    descriptor.value = async function (...args: T): Promise<R> {
      return monitoringSDK.monitorExternalService(
        {
          name: serviceName,
          type: serviceType,
          trackRequests: true,
          trackErrors: true,
          trackLatency: true,
        },
        () => originalMethod.apply(this, args)
      );
    };

    return descriptor;
  };
}

/**
 * Monitor database operations
 */
export function monitorDatabase(table: string, operation?: string) {
  return function <T extends any[], R>(
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: T) => Promise<R>>
  ) {
    const originalMethod = descriptor.value;
    if (!originalMethod) return;

    const dbOperation = operation || propertyKey;

    descriptor.value = async function (...args: T): Promise<R> {
      return monitoringSDK.monitorDatabaseQuery(
        dbOperation,
        table,
        () => originalMethod.apply(this, args)
      );
    };

    return descriptor;
  };
}

/**
 * Track business events
 */
export function trackBusinessEvent(eventName: string) {
  return function <T extends any[], R>(
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: T) => Promise<R>>
  ) {
    const originalMethod = descriptor.value;
    if (!originalMethod) return;

    descriptor.value = async function (...args: T): Promise<R> {
      const result = await originalMethod.apply(this, args);
      
      // Track the business event after successful execution
      monitoringSDK.recordBusinessEvent({
        name: eventName,
        value: 1,
        metadata: {
          method: propertyKey,
          timestamp: new Date(),
        },
      });

      return result;
    };

    return descriptor;
  };
}

/**
 * Wrapper for Lambda handlers with comprehensive monitoring
 */
export function withLambdaMonitoring<T extends any[], R>(
  functionName: string,
  handler: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now();
    const event = args[0] as any;
    const context = args[1] as any;

    // Create trace span
    const span = monitoringSDK.startTrace(`lambda.${functionName}`, undefined, {
      'aws.lambda.function_name': functionName,
      'aws.lambda.request_id': context?.awsRequestId,
      'aws.lambda.function_version': context?.functionVersion,
      'http.method': event?.httpMethod || 'unknown',
      'http.path': event?.path || event?.routeKey || 'unknown',
    });

    const metadata: MonitoringMetadata = {
      traceId: span?.traceId,
      spanId: span?.spanId,
      requestId: context?.awsRequestId,
      operation: functionName,
    };

    try {
      const result = await handler(...args);
      const duration = Date.now() - startTime;

      // Track success metrics
      monitoringSDK.recordMetric(`lambda.${functionName}.invocations`, 1, 'counter', {
        status: 'success',
      });
      monitoringSDK.recordMetric(`lambda.${functionName}.duration`, duration, 'histogram');

      monitoringSDK.finishTrace(span);
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;

      // Track error metrics
      monitoringSDK.recordMetric(`lambda.${functionName}.invocations`, 1, 'counter', {
        status: 'error',
        error: error instanceof Error ? error.name : 'unknown',
      });
      monitoringSDK.recordMetric(`lambda.${functionName}.duration`, duration, 'histogram', {
        status: 'error',
      });

      // Track error
      await monitoringSDK.trackError(error as Error, metadata);

      monitoringSDK.finishTrace(span, error as Error);
      throw error;
    }
  };
}

/**
 * Express middleware wrapper with monitoring
 */
export function withExpressMonitoring() {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    const span = monitoringSDK.startTrace(`http.${req.method} ${req.path}`, undefined, {
      'http.method': req.method,
      'http.path': req.path,
      'http.user_agent': req.headers['user-agent'] || '',
      'user.id': req.user?.id || 'anonymous',
    });

    // Add monitoring context to request
    req.monitoring = {
      span,
      sdk: monitoringSDK,
      metadata: {
        traceId: span?.traceId,
        spanId: span?.spanId,
        userId: req.user?.id,
        requestId: req.headers['x-request-id'] || `req-${Date.now()}`,
      },
    };

    // Hook into response to track metrics
    const originalSend = res.send;
    res.send = function (data: any) {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Record API metrics
      monitoringSDK.recordApiRequest(
        req.method,
        req.path,
        statusCode,
        duration,
        req.user?.id
      );

      // Finish trace
      if (statusCode >= 400) {
        const error = new Error(`HTTP ${statusCode}: ${req.method} ${req.path}`);
        monitoringSDK.finishTrace(span, error);
      } else {
        monitoringSDK.finishTrace(span);
      }

      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Utility function to get monitoring context from request
 */
export function getMonitoringContext(req: any): {
  span: any;
  sdk: typeof monitoringSDK;
  metadata: MonitoringMetadata;
} | null {
  return req.monitoring || null;
}

/**
 * Create a monitored Prisma client
 */
export function createMonitoredPrisma<T extends any>(prisma: T): T {
  return new Proxy(prisma, {
    get(target: any, prop: string) {
      const originalMethod = target[prop];
      
      if (typeof originalMethod === 'function' && prop.startsWith('$')) {
        // Monitor Prisma operations
        return async function (...args: any[]) {
          const operation = prop.replace('$', '');
          return monitoringSDK.monitorDatabaseQuery(
            operation,
            'prisma',
            () => originalMethod.apply(target, args)
          );
        };
      }
      
      // For model operations, wrap each method
      if (typeof originalMethod === 'object' && originalMethod !== null) {
        return new Proxy(originalMethod, {
          get(modelTarget: any, modelProp: string) {
            const modelMethod = modelTarget[modelProp];
            
            if (typeof modelMethod === 'function') {
              return async function (...args: any[]) {
                return monitoringSDK.monitorDatabaseQuery(
                  modelProp,
                  prop,
                  () => modelMethod.apply(modelTarget, args)
                );
              };
            }
            
            return modelMethod;
          },
        });
      }
      
      return originalMethod;
    },
  });
}