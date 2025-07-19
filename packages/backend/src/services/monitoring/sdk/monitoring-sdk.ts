/**
 * Monitoring SDK
 * 
 * High-level SDK for easy monitoring integration
 */

import { getMonitoring } from '../factory';
import { MonitoringService } from '../monitoring.service';
import { TraceSpan } from '../types';
import { MonitoringOptions, ExternalServiceConfig, BusinessEvent, MonitoringMetadata } from './types';
import { createLogger } from '../../logger';

export class MonitoringSDK {
  private logger = createLogger('monitoring-sdk');
  private monitoring?: MonitoringService;

  constructor() {
    this.initializeMonitoring();
  }

  /**
   * Initialize monitoring service
   */
  private async initializeMonitoring(): Promise<void> {
    try {
      this.monitoring = await getMonitoring();
    } catch (error) {
      this.logger.error('Failed to initialize monitoring service', error as Error);
    }
  }

  /**
   * Track an error with context
   */
  async trackError(error: Error, metadata: MonitoringMetadata = {}): Promise<void> {
    if (!this.monitoring) {
      await this.initializeMonitoring();
    }

    if (this.monitoring) {
      await this.monitoring.errorTracking.trackError(error, {
        functionName: metadata.operation || 'unknown',
        userId: metadata.userId,
        teamId: metadata.teamId,
        sessionId: metadata.sessionId,
        requestId: metadata.requestId,
        traceId: metadata.traceId,
        spanId: metadata.spanId,
        ...metadata.tags,
      });
    }
  }

  /**
   * Record a metric
   */
  recordMetric(
    name: string, 
    value: number, 
    type: 'counter' | 'gauge' | 'histogram' = 'counter',
    tags: Record<string, string> = {}
  ): void {
    if (this.monitoring) {
      switch (type) {
        case 'counter':
          this.monitoring.metrics.counter(name, value, tags);
          break;
        case 'gauge':
          this.monitoring.metrics.gauge(name, value, tags);
          break;
        case 'histogram':
          this.monitoring.metrics.histogram(name, value, tags);
          break;
      }
    }
  }

  /**
   * Start a timer and return function to stop it
   */
  startTimer(name: string, tags: Record<string, string> = {}): () => void {
    if (this.monitoring) {
      return this.monitoring.metrics.timer(name, tags);
    }
    
    // Return no-op function if monitoring not available
    return () => {};
  }

  /**
   * Start a trace span
   */
  startTrace(operationName: string, parentSpan?: TraceSpan, tags: Record<string, any> = {}): TraceSpan | null {
    if (this.monitoring) {
      const span = this.monitoring.tracing.startSpan(operationName, parentSpan);
      if (Object.keys(tags).length > 0) {
        this.monitoring.tracing.setSpanTags(span, tags);
      }
      return span;
    }
    return null;
  }

  /**
   * Finish a trace span
   */
  finishTrace(span: TraceSpan | null, error?: Error): void {
    if (this.monitoring && span) {
      this.monitoring.tracing.finishSpan(span, error);
    }
  }

  /**
   * Record a business event
   */
  recordBusinessEvent(event: BusinessEvent): void {
    if (this.monitoring) {
      this.monitoring.recordBusinessEvent(
        event.name,
        event.value,
        event.metadata || {},
        event.userId
      );
    }
  }

  /**
   * Record API request
   */
  recordApiRequest(
    method: string,
    endpoint: string,
    statusCode: number,
    duration: number,
    userId?: string,
    error?: Error
  ): void {
    if (this.monitoring) {
      this.monitoring.recordApiRequest(method, endpoint, statusCode, duration, userId, error);
    }
  }

  /**
   * Record database operation
   */
  recordDatabaseOperation(
    operation: string,
    table: string,
    duration: number,
    success: boolean,
    error?: Error
  ): void {
    if (this.monitoring) {
      this.monitoring.recordDatabaseOperation(operation, table, duration, success, error);
    }
  }

  /**
   * Monitor an external service call
   */
  async monitorExternalService<T>(
    config: ExternalServiceConfig,
    operation: () => Promise<T>,
    metadata: MonitoringMetadata = {}
  ): Promise<T> {
    const startTime = Date.now();
    const span = this.startTrace(`external.${config.name}`, undefined, {
      'service.name': config.name,
      'service.type': config.type,
      'service.endpoint': config.endpoint,
      ...metadata.tags,
    });

    try {
      // Track request metric
      if (config.trackRequests) {
        this.recordMetric(`external.${config.name}.requests`, 1, 'counter', {
          service: config.name,
          type: config.type,
        });
      }

      const result = await operation();
      const duration = Date.now() - startTime;

      // Track success metrics
      this.recordMetric(`external.${config.name}.success`, 1, 'counter', {
        service: config.name,
        type: config.type,
      });

      if (config.trackLatency) {
        this.recordMetric(`external.${config.name}.latency`, duration, 'histogram', {
          service: config.name,
          type: config.type,
        });
      }

      this.finishTrace(span);
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;

      // Track error metrics
      this.recordMetric(`external.${config.name}.errors`, 1, 'counter', {
        service: config.name,
        type: config.type,
        error: error instanceof Error ? error.name : 'unknown',
      });

      if (config.trackLatency) {
        this.recordMetric(`external.${config.name}.latency`, duration, 'histogram', {
          service: config.name,
          type: config.type,
          status: 'error',
        });
      }

      if (config.trackErrors) {
        await this.trackError(error as Error, {
          operation: `external.${config.name}`,
          tags: {
            service: config.name,
            type: config.type,
            endpoint: config.endpoint || 'unknown',
          },
          ...metadata,
        });
      }

      this.finishTrace(span, error as Error);
      throw error;
    }
  }

  /**
   * Monitor a function with automatic error tracking and metrics
   */
  monitorFunction<T extends any[], R>(
    functionName: string,
    fn: (...args: T) => Promise<R>,
    options: MonitoringOptions = {}
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      const startTime = Date.now();
      const span = options.trackTracing ? this.startTrace(functionName, undefined, options.tags) : null;

      try {
        const result = await fn(...args);
        const duration = Date.now() - startTime;

        // Track success metrics
        if (options.trackMetrics) {
          this.recordMetric(`function.${functionName}.success`, 1, 'counter', options.tags);
          this.recordMetric(`function.${functionName}.duration`, duration, 'histogram', options.tags);
        }

        this.finishTrace(span);
        return result;

      } catch (error) {
        const duration = Date.now() - startTime;

        // Track error metrics
        if (options.trackMetrics) {
          this.recordMetric(`function.${functionName}.errors`, 1, 'counter', {
            ...options.tags,
            error: error instanceof Error ? error.name : 'unknown',
          });
          this.recordMetric(`function.${functionName}.duration`, duration, 'histogram', {
            ...options.tags,
            status: 'error',
          });
        }

        // Track errors
        if (options.trackErrors) {
          await this.trackError(error as Error, {
            operation: functionName,
            tags: options.tags,
          });
        }

        this.finishTrace(span, error as Error);
        throw error;
      }
    };
  }

  /**
   * Create a child logger with monitoring context
   */
  createLogger(serviceName: string, metadata: MonitoringMetadata = {}) {
    const logger = createLogger(serviceName);
    
    // Add monitoring context to logger
    if (metadata.traceId) {
      logger.addContext({ traceId: metadata.traceId });
    }
    if (metadata.spanId) {
      logger.addContext({ spanId: metadata.spanId });
    }
    if (metadata.userId) {
      logger.addContext({ userId: metadata.userId });
    }
    if (metadata.teamId) {
      logger.addContext({ teamId: metadata.teamId });
    }
    if (metadata.sessionId) {
      logger.addContext({ sessionId: metadata.sessionId });
    }
    if (metadata.requestId) {
      logger.addContext({ requestId: metadata.requestId });
    }

    return logger;
  }

  /**
   * Monitor a database query
   */
  async monitorDatabaseQuery<T>(
    operation: string,
    table: string,
    query: () => Promise<T>,
    metadata: MonitoringMetadata = {}
  ): Promise<T> {
    const startTime = Date.now();
    const span = this.startTrace(`db.${operation}`, undefined, {
      'db.operation': operation,
      'db.table': table,
      'component': 'database',
      ...metadata.tags,
    });

    try {
      const result = await query();
      const duration = Date.now() - startTime;

      this.recordDatabaseOperation(operation, table, duration, true);
      this.finishTrace(span);

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;

      this.recordDatabaseOperation(operation, table, duration, false, error as Error);
      this.finishTrace(span, error as Error);

      throw error;
    }
  }

  /**
   * Monitor HTTP requests
   */
  async monitorHttpRequest<T>(
    method: string,
    url: string,
    request: () => Promise<{ data: T; status: number }>,
    metadata: MonitoringMetadata = {}
  ): Promise<{ data: T; status: number }> {
    const startTime = Date.now();
    const span = this.startTrace(`http.${method}`, undefined, {
      'http.method': method,
      'http.url': url,
      'component': 'http',
      ...metadata.tags,
    });

    try {
      const result = await request();
      const duration = Date.now() - startTime;

      // Record metrics
      this.recordMetric('http.requests.total', 1, 'counter', {
        method,
        status: result.status.toString(),
      });
      this.recordMetric('http.requests.duration', duration, 'histogram', {
        method,
        status: result.status.toString(),
      });

      this.finishTrace(span);
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;

      // Record error metrics
      this.recordMetric('http.requests.total', 1, 'counter', {
        method,
        status: 'error',
      });
      this.recordMetric('http.requests.duration', duration, 'histogram', {
        method,
        status: 'error',
      });

      await this.trackError(error as Error, {
        operation: `http.${method}`,
        tags: {
          method,
          url,
        },
        ...metadata,
      });

      this.finishTrace(span, error as Error);
      throw error;
    }
  }

  /**
   * Get current monitoring health
   */
  async getHealth(): Promise<any> {
    if (this.monitoring) {
      return this.monitoring.getMonitoringHealth();
    }
    return { status: 'unknown', message: 'Monitoring not initialized' };
  }

  /**
   * Flush all metrics
   */
  async flush(): Promise<void> {
    if (this.monitoring) {
      await this.monitoring.metrics.flush();
    }
  }
}

// Export singleton instance
export const monitoringSDK = new MonitoringSDK();