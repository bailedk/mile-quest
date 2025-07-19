/**
 * API Performance Monitoring Service - BE-701
 * Comprehensive API performance tracking and metrics collection
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { cache } from '../../utils/cache';
import { cacheKeys } from '../cache/constants';
import { checkDatabaseHealth } from '../../lib/database';

export interface APIMetrics {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  requestSize: number;
  responseSize: number;
  timestamp: Date;
  userId?: string;
  userAgent?: string;
  region?: string;
  coldStart?: boolean;
  memoryUsed?: number;
  cpuTime?: number;
  errors?: string[];
}

export interface PerformanceAlert {
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'latency' | 'error_rate' | 'throughput' | 'memory' | 'database';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: Date;
  endpoint?: string;
  recommendations: string[];
}

export interface PerformanceSummary {
  timeRange: string;
  totalRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  successRate: number;
  throughputRps: number;
  topEndpoints: Array<{
    endpoint: string;
    requestCount: number;
    averageResponseTime: number;
    errorRate: number;
  }>;
  slowestEndpoints: Array<{
    endpoint: string;
    averageResponseTime: number;
    p95ResponseTime: number;
  }>;
  errorsByStatus: Record<string, number>;
  memoryUsage: {
    average: number;
    peak: number;
    trending: 'up' | 'down' | 'stable';
  };
  databaseHealth: {
    connectionPool: any;
    queryPerformance: any;
    availability: 'healthy' | 'degraded' | 'unhealthy';
  };
}

export class APIPerformanceService {
  private metricsBuffer: APIMetrics[] = [];
  private maxBufferSize = 1000;
  private flushInterval = 60000; // 1 minute
  private flushTimer?: NodeJS.Timeout;

  private alertThresholds = {
    latency: {
      warning: 1000,    // 1 second
      critical: 5000,   // 5 seconds
    },
    errorRate: {
      warning: 5,       // 5%
      critical: 10,     // 10%
    },
    throughput: {
      warning: 10,      // 10 RPS minimum
      critical: 5,      // 5 RPS minimum
    },
    memory: {
      warning: 80,      // 80% of limit
      critical: 95,     // 95% of limit
    },
  };

  constructor() {
    this.startFlushTimer();
  }

  /**
   * Record API request metrics
   */
  async recordRequest(
    event: APIGatewayProxyEvent,
    response: APIGatewayProxyResult,
    context: Context,
    startTime: number,
    coldStart: boolean = false
  ): Promise<void> {
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    const metrics: APIMetrics = {
      endpoint: this.normalizeEndpoint(event),
      method: event.httpMethod,
      statusCode: response.statusCode,
      responseTime,
      requestSize: this.calculateRequestSize(event),
      responseSize: this.calculateResponseSize(response),
      timestamp: new Date(startTime),
      userId: this.extractUserId(event),
      userAgent: event.headers['User-Agent'] || event.headers['user-agent'],
      region: process.env.AWS_REGION,
      coldStart,
      memoryUsed: this.getMemoryUsage(context),
      cpuTime: context.getRemainingTimeInMillis ? 
        (30000 - context.getRemainingTimeInMillis()) : undefined,
    };

    // Add to buffer
    this.metricsBuffer.push(metrics);

    // Flush if buffer is full
    if (this.metricsBuffer.length >= this.maxBufferSize) {
      await this.flushMetrics();
    }

    // Store real-time metrics in cache for immediate alerts
    await this.storeRealtimeMetrics(metrics);

    // Check for performance alerts
    await this.checkPerformanceAlerts(metrics);
  }

  /**
   * Get performance summary for a time range
   */
  async getPerformanceSummary(
    timeRangeHours: number = 24
  ): Promise<PerformanceSummary> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (timeRangeHours * 60 * 60 * 1000));

    // Get metrics from cache (for recent data) and flush buffer
    await this.flushMetrics();
    
    const metrics = await this.getMetricsFromCache(startTime, endTime);
    
    if (metrics.length === 0) {
      return this.createEmptyPerformanceSummary(timeRangeHours);
    }

    // Calculate summary statistics
    const totalRequests = metrics.length;
    const responseTimes = metrics.map(m => m.responseTime).sort((a, b) => a - b);
    const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / totalRequests;
    const p95ResponseTime = responseTimes[Math.floor(totalRequests * 0.95)] || 0;
    const p99ResponseTime = responseTimes[Math.floor(totalRequests * 0.99)] || 0;

    const errorCount = metrics.filter(m => m.statusCode >= 400).length;
    const errorRate = (errorCount / totalRequests) * 100;
    const successRate = 100 - errorRate;

    const timeRangeMs = endTime.getTime() - startTime.getTime();
    const throughputRps = (totalRequests * 1000) / timeRangeMs;

    // Analyze endpoints
    const endpointStats = this.analyzeEndpoints(metrics);
    const memoryStats = this.analyzeMemoryUsage(metrics);
    const errorsByStatus = this.analyzeErrorsByStatus(metrics);

    // Get database health
    const databaseHealth = await this.getDatabaseHealth();

    return {
      timeRange: `${timeRangeHours}h`,
      totalRequests,
      averageResponseTime: Math.round(averageResponseTime),
      p95ResponseTime: Math.round(p95ResponseTime),
      p99ResponseTime: Math.round(p99ResponseTime),
      errorRate: Math.round(errorRate * 100) / 100,
      successRate: Math.round(successRate * 100) / 100,
      throughputRps: Math.round(throughputRps * 100) / 100,
      topEndpoints: endpointStats.top,
      slowestEndpoints: endpointStats.slowest,
      errorsByStatus,
      memoryUsage: memoryStats,
      databaseHealth,
    };
  }

  /**
   * Get current performance alerts
   */
  async getPerformanceAlerts(): Promise<PerformanceAlert[]> {
    const alertKeys = [
      'alerts:latency',
      'alerts:error_rate',
      'alerts:throughput',
      'alerts:memory',
      'alerts:database',
    ];

    const alerts: PerformanceAlert[] = [];
    
    for (const key of alertKeys) {
      const alert = await cache.get<PerformanceAlert>(key);
      if (alert) {
        alerts.push(alert);
      }
    }

    // Sort by severity and timestamp
    return alerts.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  }

  /**
   * Get real-time performance metrics
   */
  async getRealtimeMetrics(): Promise<{
    currentThroughput: number;
    averageLatency: number;
    errorRate: number;
    activeConnections: number;
    memoryUsage: number;
    cpuUsage: number;
  }> {
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);

    // Get recent metrics
    const recentMetrics = this.metricsBuffer.filter(
      m => m.timestamp.getTime() > fiveMinutesAgo
    );

    const throughput = recentMetrics.length / 5; // per minute
    const latency = recentMetrics.length > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length
      : 0;
    
    const errors = recentMetrics.filter(m => m.statusCode >= 400).length;
    const errorRate = recentMetrics.length > 0 ? (errors / recentMetrics.length) * 100 : 0;

    // Get system metrics
    const memoryUsage = process.memoryUsage();
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    return {
      currentThroughput: Math.round(throughput * 100) / 100,
      averageLatency: Math.round(latency),
      errorRate: Math.round(errorRate * 100) / 100,
      activeConnections: 1, // Would need actual connection tracking
      memoryUsage: Math.round(memoryUsagePercent),
      cpuUsage: 0, // Would need CPU monitoring
    };
  }

  /**
   * Store real-time metrics in cache
   */
  private async storeRealtimeMetrics(metrics: APIMetrics): Promise<void> {
    const minute = new Date(metrics.timestamp).toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
    
    // Store per-minute metrics
    const minuteKey = `metrics:minute:${minute}`;
    const existingMinuteMetrics = await cache.get<APIMetrics[]>(minuteKey) || [];
    existingMinuteMetrics.push(metrics);
    await cache.set(minuteKey, existingMinuteMetrics, 3600); // 1 hour TTL

    // Store per-endpoint metrics
    const endpointKey = `metrics:endpoint:${metrics.endpoint}:${minute}`;
    const existingEndpointMetrics = await cache.get<APIMetrics[]>(endpointKey) || [];
    existingEndpointMetrics.push(metrics);
    await cache.set(endpointKey, existingEndpointMetrics, 3600);
  }

  /**
   * Check for performance alerts
   */
  private async checkPerformanceAlerts(metrics: APIMetrics): Promise<void> {
    const alerts: PerformanceAlert[] = [];

    // Check latency
    if (metrics.responseTime > this.alertThresholds.latency.critical) {
      alerts.push({
        severity: 'critical',
        type: 'latency',
        message: `Extremely high response time detected: ${metrics.responseTime}ms`,
        metric: 'response_time',
        value: metrics.responseTime,
        threshold: this.alertThresholds.latency.critical,
        timestamp: new Date(),
        endpoint: metrics.endpoint,
        recommendations: [
          'Check database query performance',
          'Review application logic for bottlenecks',
          'Consider scaling resources',
          'Check external service dependencies',
        ],
      });
    } else if (metrics.responseTime > this.alertThresholds.latency.warning) {
      alerts.push({
        severity: 'medium',
        type: 'latency',
        message: `High response time detected: ${metrics.responseTime}ms`,
        metric: 'response_time',
        value: metrics.responseTime,
        threshold: this.alertThresholds.latency.warning,
        timestamp: new Date(),
        endpoint: metrics.endpoint,
        recommendations: [
          'Monitor for sustained high latency',
          'Review recent code changes',
          'Check database performance',
        ],
      });
    }

    // Check error rate
    if (metrics.statusCode >= 500) {
      alerts.push({
        severity: 'high',
        type: 'error_rate',
        message: `Server error detected: ${metrics.statusCode}`,
        metric: 'status_code',
        value: metrics.statusCode,
        threshold: 500,
        timestamp: new Date(),
        endpoint: metrics.endpoint,
        recommendations: [
          'Check application logs for error details',
          'Verify database connectivity',
          'Review recent deployments',
        ],
      });
    }

    // Check memory usage
    if (metrics.memoryUsed) {
      const memoryUsagePercent = (metrics.memoryUsed / 512) * 100; // Assuming 512MB limit
      if (memoryUsagePercent > this.alertThresholds.memory.critical) {
        alerts.push({
          severity: 'critical',
          type: 'memory',
          message: `Critical memory usage: ${memoryUsagePercent.toFixed(1)}%`,
          metric: 'memory_usage',
          value: memoryUsagePercent,
          threshold: this.alertThresholds.memory.critical,
          timestamp: new Date(),
          recommendations: [
            'Increase Lambda memory allocation',
            'Review memory leaks in application',
            'Optimize data structures and caching',
          ],
        });
      }
    }

    // Store alerts in cache
    for (const alert of alerts) {
      const alertKey = `alerts:${alert.type}:${Date.now()}`;
      await cache.set(alertKey, alert, 3600); // 1 hour TTL
    }
  }

  /**
   * Flush metrics buffer to persistent storage
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    const metricsToFlush = [...this.metricsBuffer];
    this.metricsBuffer = [];

    // Store in cache for aggregation (in production, this would go to CloudWatch/DataDog)
    const hour = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
    const hourKey = `metrics:hour:${hour}`;
    
    const existingHourMetrics = await cache.get<APIMetrics[]>(hourKey) || [];
    existingHourMetrics.push(...metricsToFlush);
    await cache.set(hourKey, existingHourMetrics, 86400); // 24 hours TTL

    console.log(`Flushed ${metricsToFlush.length} metrics to storage`);
  }

  /**
   * Start metrics flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flushMetrics().catch(error => {
        console.error('Failed to flush metrics:', error);
      });
    }, this.flushInterval);
  }

  /**
   * Stop metrics collection
   */
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flushMetrics();
  }

  /**
   * Normalize endpoint path
   */
  private normalizeEndpoint(event: APIGatewayProxyEvent): string {
    const path = event.path || '';
    const method = event.httpMethod || 'GET';
    
    // Normalize path parameters
    const normalizedPath = path
      .replace(/\/\d+/g, '/{id}')
      .replace(/\/[a-f0-9-]{36}/g, '/{uuid}')
      .replace(/\/[a-zA-Z0-9_-]{20,}/g, '/{token}');
    
    return `${method} ${normalizedPath}`;
  }

  /**
   * Extract user ID from event
   */
  private extractUserId(event: APIGatewayProxyEvent): string | undefined {
    return event.requestContext.authorizer?.claims?.sub ||
           event.requestContext.authorizer?.userId;
  }

  /**
   * Calculate request size
   */
  private calculateRequestSize(event: APIGatewayProxyEvent): number {
    const bodySize = event.body ? Buffer.byteLength(event.body, 'utf8') : 0;
    const headersSize = JSON.stringify(event.headers || {}).length;
    return bodySize + headersSize;
  }

  /**
   * Calculate response size
   */
  private calculateResponseSize(response: APIGatewayProxyResult): number {
    const bodySize = response.body ? Buffer.byteLength(response.body, 'utf8') : 0;
    const headersSize = JSON.stringify(response.headers || {}).length;
    return bodySize + headersSize;
  }

  /**
   * Get memory usage from Lambda context
   */
  private getMemoryUsage(context: Context): number | undefined {
    const memoryUsage = process.memoryUsage();
    return memoryUsage.heapUsed;
  }

  /**
   * Get metrics from cache for time range
   */
  private async getMetricsFromCache(startTime: Date, endTime: Date): Promise<APIMetrics[]> {
    const allMetrics: APIMetrics[] = [];
    
    // Get hourly metrics
    const startHour = new Date(startTime).setMinutes(0, 0, 0);
    const endHour = new Date(endTime).setMinutes(59, 59, 999);
    
    const hours = [];
    for (let time = startHour; time <= endHour; time += 3600000) {
      hours.push(new Date(time).toISOString().slice(0, 13));
    }

    for (const hour of hours) {
      const hourKey = `metrics:hour:${hour}`;
      const hourMetrics = await cache.get<APIMetrics[]>(hourKey) || [];
      allMetrics.push(...hourMetrics);
    }

    // Add current buffer
    allMetrics.push(...this.metricsBuffer);

    // Filter by exact time range
    return allMetrics.filter(m => 
      m.timestamp >= startTime && m.timestamp <= endTime
    );
  }

  /**
   * Analyze endpoints performance
   */
  private analyzeEndpoints(metrics: APIMetrics[]): {
    top: Array<{ endpoint: string; requestCount: number; averageResponseTime: number; errorRate: number }>;
    slowest: Array<{ endpoint: string; averageResponseTime: number; p95ResponseTime: number }>;
  } {
    const endpointMap = new Map<string, APIMetrics[]>();
    
    metrics.forEach(metric => {
      if (!endpointMap.has(metric.endpoint)) {
        endpointMap.set(metric.endpoint, []);
      }
      endpointMap.get(metric.endpoint)!.push(metric);
    });

    const endpointStats = Array.from(endpointMap.entries()).map(([endpoint, endpointMetrics]) => {
      const requestCount = endpointMetrics.length;
      const averageResponseTime = endpointMetrics.reduce((sum, m) => sum + m.responseTime, 0) / requestCount;
      const errorCount = endpointMetrics.filter(m => m.statusCode >= 400).length;
      const errorRate = (errorCount / requestCount) * 100;
      
      const responseTimes = endpointMetrics.map(m => m.responseTime).sort((a, b) => a - b);
      const p95ResponseTime = responseTimes[Math.floor(requestCount * 0.95)] || 0;

      return {
        endpoint,
        requestCount,
        averageResponseTime: Math.round(averageResponseTime),
        errorRate: Math.round(errorRate * 100) / 100,
        p95ResponseTime: Math.round(p95ResponseTime),
      };
    });

    const top = endpointStats
      .sort((a, b) => b.requestCount - a.requestCount)
      .slice(0, 10);

    const slowest = endpointStats
      .sort((a, b) => b.averageResponseTime - a.averageResponseTime)
      .slice(0, 10)
      .map(({ endpoint, averageResponseTime, p95ResponseTime }) => ({
        endpoint,
        averageResponseTime,
        p95ResponseTime,
      }));

    return { top, slowest };
  }

  /**
   * Analyze memory usage patterns
   */
  private analyzeMemoryUsage(metrics: APIMetrics[]): {
    average: number;
    peak: number;
    trending: 'up' | 'down' | 'stable';
  } {
    const memoryMetrics = metrics
      .filter(m => m.memoryUsed)
      .map(m => m.memoryUsed!);

    if (memoryMetrics.length === 0) {
      return { average: 0, peak: 0, trending: 'stable' };
    }

    const average = memoryMetrics.reduce((sum, mem) => sum + mem, 0) / memoryMetrics.length;
    const peak = Math.max(...memoryMetrics);

    // Simple trending analysis
    const firstHalf = memoryMetrics.slice(0, Math.floor(memoryMetrics.length / 2));
    const secondHalf = memoryMetrics.slice(Math.floor(memoryMetrics.length / 2));
    
    const firstHalfAvg = firstHalf.reduce((sum, mem) => sum + mem, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, mem) => sum + mem, 0) / secondHalf.length;
    
    const trendThreshold = average * 0.1; // 10% change
    const trending = secondHalfAvg - firstHalfAvg > trendThreshold ? 'up' :
                     firstHalfAvg - secondHalfAvg > trendThreshold ? 'down' : 'stable';

    return {
      average: Math.round(average),
      peak: Math.round(peak),
      trending,
    };
  }

  /**
   * Analyze errors by status code
   */
  private analyzeErrorsByStatus(metrics: APIMetrics[]): Record<string, number> {
    const errorsByStatus: Record<string, number> = {};
    
    metrics.forEach(metric => {
      if (metric.statusCode >= 400) {
        const statusCode = metric.statusCode.toString();
        errorsByStatus[statusCode] = (errorsByStatus[statusCode] || 0) + 1;
      }
    });

    return errorsByStatus;
  }

  /**
   * Get database health information
   */
  private async getDatabaseHealth(): Promise<any> {
    try {
      const health = await checkDatabaseHealth();
      return {
        connectionPool: health.connectionPool,
        queryPerformance: {
          responseTime: health.responseTime,
        },
        availability: health.status,
      };
    } catch (error) {
      return {
        connectionPool: null,
        queryPerformance: null,
        availability: 'unhealthy',
      };
    }
  }

  /**
   * Create empty performance summary
   */
  private createEmptyPerformanceSummary(timeRangeHours: number): PerformanceSummary {
    return {
      timeRange: `${timeRangeHours}h`,
      totalRequests: 0,
      averageResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      errorRate: 0,
      successRate: 0,
      throughputRps: 0,
      topEndpoints: [],
      slowestEndpoints: [],
      errorsByStatus: {},
      memoryUsage: { average: 0, peak: 0, trending: 'stable' },
      databaseHealth: {
        connectionPool: null,
        queryPerformance: null,
        availability: 'healthy',
      },
    };
  }
}

// Export singleton instance
export const apiPerformanceService = new APIPerformanceService();