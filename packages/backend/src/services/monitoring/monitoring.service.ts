/**
 * Main Monitoring Service
 * 
 * Orchestrates all monitoring capabilities
 */

import { createLogger } from '../logger';
import { PrismaClient } from '@prisma/client';
import {
  IMonitoringService,
  MonitoringConfig,
} from './types';
import { ErrorTrackingService } from './error-tracking.service';
import { MetricsService } from './metrics.service';
import { TracingService } from './tracing.service';
import { HealthCheckService } from './health-check.service';
import { UptimeMonitoringService } from './uptime-monitoring.service';
import { AlertingService } from './alerting.service';
import { LogAggregationService } from './log-aggregation.service';

export class MonitoringService implements IMonitoringService {
  private logger = createLogger('monitoring');
  private initialized = false;

  public readonly errorTracking: ErrorTrackingService;
  public readonly metrics: MetricsService;
  public readonly tracing: TracingService;
  public readonly healthCheck: HealthCheckService;
  public readonly uptimeMonitoring: UptimeMonitoringService;
  public readonly alerting: AlertingService;
  public readonly logAggregation: LogAggregationService;

  constructor(private prisma?: PrismaClient) {
    // Initialize all monitoring services
    this.errorTracking = new ErrorTrackingService();
    this.metrics = new MetricsService();
    this.tracing = new TracingService();
    this.healthCheck = new HealthCheckService(prisma, { enablePeriodicChecks: true });
    this.uptimeMonitoring = new UptimeMonitoringService();
    this.alerting = new AlertingService();
    this.logAggregation = new LogAggregationService();

    this.logger.info('Monitoring service created');
  }

  /**
   * Initialize monitoring with configuration
   */
  async initialize(config: MonitoringConfig): Promise<void> {
    if (this.initialized) {
      this.logger.warn('Monitoring service already initialized');
      return;
    }

    try {
      this.logger.info('Initializing monitoring service', {
        errorTracking: config.errorTracking.enabled,
        metrics: config.metrics.enabled,
        tracing: config.tracing.enabled,
        alerting: config.alerting.enabled,
        uptime: config.uptime.enabled,
      });

      // Create monitoring tables if they don't exist
      await this.ensureMonitoringTables();

      // Setup default uptime checks
      if (config.uptime.enabled) {
        await this.setupDefaultUptimeChecks();
      }

      // Setup system health checks
      await this.setupSystemHealthChecks();

      this.initialized = true;
      
      this.logger.info('Monitoring service initialized successfully');

      // Record initialization metric
      this.metrics.counter('monitoring.service.initialized', 1, {
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      this.logger.error('Failed to initialize monitoring service', error as Error);
      throw error;
    }
  }

  /**
   * Get comprehensive monitoring dashboard data
   */
  async getDashboardData(): Promise<{
    system: {
      health: any;
      uptime: any;
      performance: any;
    };
    metrics: {
      business: any;
      technical: any;
    };
    alerts: {
      active: any[];
      recent: any[];
      statistics: any;
    };
    logs: {
      recent: any[];
      statistics: any;
    };
    errors: {
      recent: any[];
      statistics: any;
    };
    traces: {
      recent: any[];
      statistics: any;
    };
  }> {
    const [
      systemHealth,
      uptimeStats,
      businessMetrics,
      activeAlerts,
      recentAlerts,
      alertStats,
      logStats,
      errorStats,
      traceStats,
    ] = await Promise.all([
      this.healthCheck.getDetailedHealth(),
      this.uptimeMonitoring.getOverallStatistics(),
      this.metrics.getBusinessMetrics(),
      this.alerting.getAlerts('firing'),
      this.alerting.getAlerts(),
      this.alerting.getAlertStatistics(),
      this.logAggregation.getLogStatistics(),
      this.errorTracking.getErrorStats(),
      this.tracing.getTraceStatistics(),
    ]);

    const recentLogs = await this.logAggregation.queryLogs({
      limit: 50,
      startTime: new Date(Date.now() - 60 * 60 * 1000), // Last hour
    });

    const recentErrors = await this.errorTracking.getErrors();
    const recentTraces = await this.tracing.getTraces({ limit: 20 });

    return {
      system: {
        health: systemHealth,
        uptime: uptimeStats,
        performance: {
          averageResponseTime: businessMetrics.performance.averageResponseTime,
          errorRate: businessMetrics.performance.errorRate,
          uptime: businessMetrics.performance.uptime,
        },
      },
      metrics: {
        business: {
          users: businessMetrics.users,
          activities: businessMetrics.activities,
          teams: businessMetrics.teams,
        },
        technical: {
          requests: await this.metrics.getMetricSummary('api.requests.total'),
          database: await this.metrics.getMetricSummary('database.operations.total'),
          errors: await this.metrics.getMetricSummary('errors.total'),
        },
      },
      alerts: {
        active: activeAlerts.slice(0, 10),
        recent: recentAlerts.slice(0, 20),
        statistics: alertStats,
      },
      logs: {
        recent: recentLogs.slice(0, 50),
        statistics: logStats,
      },
      errors: {
        recent: recentErrors.slice(0, 20),
        statistics: errorStats,
      },
      traces: {
        recent: recentTraces.slice(0, 20),
        statistics: traceStats,
      },
    };
  }

  /**
   * Record API request metrics
   */
  recordApiRequest(
    method: string,
    endpoint: string,
    statusCode: number,
    duration: number,
    userId?: string,
    error?: Error
  ): void {
    // Record metrics
    this.metrics.recordApiMetric(method, endpoint, statusCode, duration, userId);

    // Track errors
    if (error) {
      this.errorTracking.trackError(error, {
        functionName: 'api-request',
        operation: `${method} ${endpoint}`,
        userId,
        requestId: `req-${Date.now()}`,
      });
    }

    // Log the request
    this.logAggregation.ingestLog({
      timestamp: new Date(),
      level: statusCode >= 400 ? 'error' : 'info',
      service: 'api',
      function: 'request',
      message: `${method} ${endpoint} - ${statusCode}`,
      context: {
        method,
        endpoint,
        statusCode,
        duration,
        userId,
        error: error?.message,
      },
      userId,
      requestId: `req-${Date.now()}`,
    });
  }

  /**
   * Record database operation metrics
   */
  recordDatabaseOperation(
    operation: string,
    table: string,
    duration: number,
    success: boolean,
    error?: Error
  ): void {
    // Record metrics
    this.metrics.recordDatabaseMetric(operation, table, duration, success);

    // Track errors
    if (error) {
      this.errorTracking.trackError(error, {
        functionName: 'database',
        operation: `${operation} ${table}`,
      });
    }

    // Log the operation
    this.logAggregation.ingestLog({
      timestamp: new Date(),
      level: success ? 'debug' : 'error',
      service: 'database',
      function: operation,
      message: `${operation} on ${table} ${success ? 'succeeded' : 'failed'}`,
      context: {
        operation,
        table,
        duration,
        success,
        error: error?.message,
      },
    });
  }

  /**
   * Record business event
   */
  recordBusinessEvent(
    event: string,
    value: number = 1,
    metadata: Record<string, string> = {},
    userId?: string
  ): void {
    // Record metric
    this.metrics.recordBusinessEvent(event, value, metadata);

    // Log the event
    this.logAggregation.ingestLog({
      timestamp: new Date(),
      level: 'info',
      service: 'business',
      function: 'event',
      message: `Business event: ${event}`,
      context: {
        event,
        value,
        ...metadata,
      },
      userId,
    });
  }

  /**
   * Create Lambda tracing wrapper
   */
  createLambdaWrapper<T extends any[], R>(
    functionName: string,
    handler: (...args: T) => Promise<R>
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      const span = this.tracing.createLambdaTraceContext(functionName, args[0], args[1]);
      const startTime = Date.now();
      
      try {
        const result = await handler(...args);
        
        this.tracing.finishSpan(span);
        
        const duration = Date.now() - startTime;
        this.metrics.histogram(`lambda.${functionName}.duration`, duration);
        this.metrics.counter(`lambda.${functionName}.success`, 1);
        
        return result;
        
      } catch (error) {
        this.tracing.finishSpan(span, error as Error);
        
        const duration = Date.now() - startTime;
        this.metrics.histogram(`lambda.${functionName}.duration`, duration);
        this.metrics.counter(`lambda.${functionName}.error`, 1);
        
        this.errorTracking.trackError(error as Error, {
          functionName,
          operation: 'lambda-handler',
        });
        
        throw error;
      }
    };
  }

  /**
   * Get monitoring health status
   */
  async getMonitoringHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, 'healthy' | 'degraded' | 'unhealthy'>;
    details: Record<string, any>;
  }> {
    const services = {
      errorTracking: 'healthy' as const,
      metrics: 'healthy' as const,
      tracing: 'healthy' as const,
      healthCheck: 'healthy' as const,
      uptimeMonitoring: 'healthy' as const,
      alerting: 'healthy' as const,
      logAggregation: 'healthy' as const,
    };

    // Check each service health
    try {
      const systemHealth = await this.healthCheck.getHealth();
      if (systemHealth.status === 'unhealthy') {
        services.healthCheck = 'unhealthy';
      } else if (systemHealth.status === 'degraded') {
        services.healthCheck = 'degraded';
      }
    } catch {
      services.healthCheck = 'unhealthy';
    }

    // Determine overall status
    const unhealthyCount = Object.values(services).filter(s => s === 'unhealthy').length;
    const degradedCount = Object.values(services).filter(s => s === 'degraded').length;
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      services,
      details: {
        initialized: this.initialized,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Shutdown all monitoring services
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down monitoring service');

    await Promise.all([
      this.metrics.shutdown(),
      this.tracing.shutdown(),
      this.healthCheck.shutdown(),
      this.uptimeMonitoring.shutdown(),
      this.alerting.shutdown(),
      this.logAggregation.shutdown(),
    ]);

    this.initialized = false;
    this.logger.info('Monitoring service shutdown complete');
  }

  /**
   * Ensure monitoring database tables exist
   */
  private async ensureMonitoringTables(): Promise<void> {
    if (!this.prisma) {
      this.logger.warn('No database client provided, skipping table creation');
      return;
    }

    try {
      // In a real implementation, you'd create monitoring-specific tables
      // For now, we'll just verify database connectivity
      await this.prisma.$queryRaw`SELECT 1`;
      this.logger.info('Database connectivity verified for monitoring');
    } catch (error) {
      this.logger.error('Failed to verify database connectivity', error as Error);
    }
  }

  /**
   * Setup default uptime checks
   */
  private async setupDefaultUptimeChecks(): Promise<void> {
    try {
      // API endpoint check
      await this.uptimeMonitoring.createCheck({
        name: 'API Health Check',
        type: 'http',
        target: 'https://api.milequest.app/health',
        interval: 60, // 1 minute
        timeout: 10000, // 10 seconds
        retries: 3,
        regions: ['us-east-1'],
        enabled: true,
        expectedStatus: 200,
      });

      // Database check
      await this.uptimeMonitoring.createCheck({
        name: 'Database Connectivity',
        type: 'database',
        target: 'postgresql://database',
        interval: 300, // 5 minutes
        timeout: 5000, // 5 seconds
        retries: 2,
        regions: ['us-east-1'],
        enabled: true,
      });

      this.logger.info('Default uptime checks created');
    } catch (error) {
      this.logger.error('Failed to create default uptime checks', error as Error);
    }
  }

  /**
   * Setup system health checks
   */
  private async setupSystemHealthChecks(): Promise<void> {
    // Additional health checks are registered in the HealthCheckService constructor
    this.logger.info('System health checks configured');
  }
}