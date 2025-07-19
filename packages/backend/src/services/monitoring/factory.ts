/**
 * Monitoring Factory
 * 
 * Factory for creating monitoring service instances with proper configuration
 */

import { PrismaClient } from '@prisma/client';
import { MonitoringService } from './monitoring.service';
import { MonitoringConfig } from './types';
import { createLogger } from '../logger';

const logger = createLogger('monitoring-factory');

/**
 * Default monitoring configuration
 */
const DEFAULT_CONFIG: MonitoringConfig = {
  errorTracking: {
    enabled: true,
    sampleRate: 1.0, // Track all errors in production
    ignoredErrors: [
      'AbortError',
      'TimeoutError',
      'ValidationError',
    ],
    groupingKey: ['error.name', 'error.message', 'function.name'],
  },
  metrics: {
    enabled: true,
    flushInterval: 60000, // 1 minute
    batchSize: 100,
    namespace: 'MileQuest',
  },
  tracing: {
    enabled: true,
    sampleRate: 0.1, // 10% sampling
    propagation: ['x-trace-id', 'x-span-id'],
  },
  alerting: {
    enabled: true,
    defaultCooldown: 900, // 15 minutes
    channels: {
      email: {
        enabled: true,
        smtp: {
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT,
          secure: true,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        },
      },
      slack: {
        enabled: true,
        webhookUrl: process.env.SLACK_WEBHOOK_URL,
      },
      webhook: {
        enabled: true,
        defaultUrl: process.env.WEBHOOK_URL,
      },
    },
  },
  uptime: {
    enabled: true,
    defaultInterval: 60, // 1 minute
    defaultTimeout: 10000, // 10 seconds
    defaultRetries: 3,
  },
};

/**
 * Development configuration (more verbose, lower thresholds)
 */
const DEVELOPMENT_CONFIG: MonitoringConfig = {
  ...DEFAULT_CONFIG,
  tracing: {
    ...DEFAULT_CONFIG.tracing,
    sampleRate: 1.0, // Sample all traces in development
  },
  metrics: {
    ...DEFAULT_CONFIG.metrics,
    flushInterval: 30000, // 30 seconds
  },
  uptime: {
    ...DEFAULT_CONFIG.uptime,
    defaultInterval: 30, // 30 seconds for faster feedback
  },
};

/**
 * Production configuration (optimized for performance)
 */
const PRODUCTION_CONFIG: MonitoringConfig = {
  ...DEFAULT_CONFIG,
  errorTracking: {
    ...DEFAULT_CONFIG.errorTracking,
    sampleRate: 1.0, // Always track errors in production
  },
  tracing: {
    ...DEFAULT_CONFIG.tracing,
    sampleRate: 0.05, // 5% sampling for production
  },
  metrics: {
    ...DEFAULT_CONFIG.metrics,
    flushInterval: 120000, // 2 minutes
    batchSize: 200,
  },
};

/**
 * Test configuration (minimal monitoring)
 */
const TEST_CONFIG: MonitoringConfig = {
  errorTracking: {
    enabled: false,
    sampleRate: 0,
    ignoredErrors: [],
    groupingKey: [],
  },
  metrics: {
    enabled: false,
    flushInterval: 60000,
    batchSize: 10,
    namespace: 'Test',
  },
  tracing: {
    enabled: false,
    sampleRate: 0,
    propagation: [],
  },
  alerting: {
    enabled: false,
    defaultCooldown: 60,
    channels: {},
  },
  uptime: {
    enabled: false,
    defaultInterval: 300,
    defaultTimeout: 5000,
    defaultRetries: 1,
  },
};

export class MonitoringFactory {
  private static instance: MonitoringService | null = null;
  private static initialized = false;

  /**
   * Create or get monitoring service instance
   */
  static async create(prisma?: PrismaClient): Promise<MonitoringService> {
    if (MonitoringFactory.instance && MonitoringFactory.initialized) {
      return MonitoringFactory.instance;
    }

    const config = MonitoringFactory.getConfig();
    
    logger.info('Creating monitoring service', {
      environment: process.env.NODE_ENV,
      errorTrackingEnabled: config.errorTracking.enabled,
      metricsEnabled: config.metrics.enabled,
      tracingEnabled: config.tracing.enabled,
      alertingEnabled: config.alerting.enabled,
    });

    const monitoring = new MonitoringService(prisma);
    
    try {
      await monitoring.initialize(config);
      MonitoringFactory.instance = monitoring;
      MonitoringFactory.initialized = true;
      
      logger.info('Monitoring service created and initialized');
      return monitoring;
    } catch (error) {
      logger.error('Failed to create monitoring service', error as Error);
      throw error;
    }
  }

  /**
   * Get existing instance (throws if not created)
   */
  static getInstance(): MonitoringService {
    if (!MonitoringFactory.instance) {
      throw new Error('Monitoring service not initialized. Call MonitoringFactory.create() first.');
    }
    return MonitoringFactory.instance;
  }

  /**
   * Check if monitoring is initialized
   */
  static isInitialized(): boolean {
    return MonitoringFactory.initialized && MonitoringFactory.instance !== null;
  }

  /**
   * Reset factory (for testing)
   */
  static reset(): void {
    MonitoringFactory.instance = null;
    MonitoringFactory.initialized = false;
  }

  /**
   * Shutdown monitoring service
   */
  static async shutdown(): Promise<void> {
    if (MonitoringFactory.instance) {
      await MonitoringFactory.instance.shutdown();
      MonitoringFactory.instance = null;
      MonitoringFactory.initialized = false;
      logger.info('Monitoring service factory shutdown');
    }
  }

  /**
   * Get configuration based on environment
   */
  private static getConfig(): MonitoringConfig {
    const env = process.env.NODE_ENV || 'development';
    
    switch (env) {
      case 'production':
        return MonitoringFactory.mergeWithEnvironment(PRODUCTION_CONFIG);
      case 'development':
        return MonitoringFactory.mergeWithEnvironment(DEVELOPMENT_CONFIG);
      case 'test':
        return TEST_CONFIG;
      default:
        return MonitoringFactory.mergeWithEnvironment(DEFAULT_CONFIG);
    }
  }

  /**
   * Merge configuration with environment variables
   */
  private static mergeWithEnvironment(baseConfig: MonitoringConfig): MonitoringConfig {
    return {
      ...baseConfig,
      errorTracking: {
        ...baseConfig.errorTracking,
        enabled: process.env.MONITORING_ERROR_TRACKING_ENABLED !== 'false',
        sampleRate: parseFloat(process.env.MONITORING_ERROR_SAMPLE_RATE || baseConfig.errorTracking.sampleRate.toString()),
      },
      metrics: {
        ...baseConfig.metrics,
        enabled: process.env.MONITORING_METRICS_ENABLED !== 'false',
        flushInterval: parseInt(process.env.MONITORING_METRICS_FLUSH_INTERVAL || baseConfig.metrics.flushInterval.toString()),
        namespace: process.env.MONITORING_METRICS_NAMESPACE || baseConfig.metrics.namespace,
      },
      tracing: {
        ...baseConfig.tracing,
        enabled: process.env.MONITORING_TRACING_ENABLED !== 'false',
        sampleRate: parseFloat(process.env.MONITORING_TRACING_SAMPLE_RATE || baseConfig.tracing.sampleRate.toString()),
      },
      alerting: {
        ...baseConfig.alerting,
        enabled: process.env.MONITORING_ALERTING_ENABLED !== 'false',
        defaultCooldown: parseInt(process.env.MONITORING_ALERTING_COOLDOWN || baseConfig.alerting.defaultCooldown.toString()),
      },
      uptime: {
        ...baseConfig.uptime,
        enabled: process.env.MONITORING_UPTIME_ENABLED !== 'false',
        defaultInterval: parseInt(process.env.MONITORING_UPTIME_INTERVAL || baseConfig.uptime.defaultInterval.toString()),
      },
    };
  }
}

/**
 * Convenience function to get monitoring instance
 */
export async function getMonitoring(prisma?: PrismaClient): Promise<MonitoringService> {
  return MonitoringFactory.create(prisma);
}

/**
 * Convenience function to get existing monitoring instance
 */
export function monitoring(): MonitoringService {
  return MonitoringFactory.getInstance();
}

/**
 * Lambda wrapper with monitoring
 */
export function withMonitoring<T extends any[], R>(
  functionName: string,
  handler: (...args: T) => Promise<R>,
  prisma?: PrismaClient
) {
  return async (...args: T): Promise<R> => {
    const monitoring = await getMonitoring(prisma);
    const wrappedHandler = monitoring.createLambdaWrapper(functionName, handler);
    return wrappedHandler(...args);
  };
}

/**
 * Express middleware with monitoring
 */
export function monitoringMiddleware() {
  return async (req: any, res: any, next: any) => {
    const monitoring = MonitoringFactory.getInstance();
    const startTime = Date.now();
    
    // Create trace span for request
    const span = monitoring.tracing.startSpan(`http.${req.method} ${req.path}`);
    monitoring.tracing.setSpanTags(span, {
      'http.method': req.method,
      'http.path': req.path,
      'http.user_agent': req.headers['user-agent'] || '',
      'user.id': req.user?.id || 'anonymous',
    });
    
    // Add monitoring to request context
    req.monitoring = monitoring;
    req.span = span;
    
    // Track response
    const originalSend = res.send;
    res.send = function(data: any) {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;
      
      // Record metrics
      monitoring.recordApiRequest(
        req.method,
        req.path,
        statusCode,
        duration,
        req.user?.id
      );
      
      // Finish span
      if (statusCode >= 400) {
        const error = new Error(`HTTP ${statusCode}: ${req.method} ${req.path}`);
        monitoring.tracing.finishSpan(span, error);
      } else {
        monitoring.tracing.finishSpan(span);
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
}

// Export singleton for backward compatibility
export const monitoringFactory = MonitoringFactory;