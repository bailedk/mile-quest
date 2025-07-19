/**
 * Metrics Service
 * 
 * Application performance monitoring and metrics collection
 */

import { createLogger } from '../logger';
import { 
  IMetricsService, 
  MetricEvent, 
  MetricSummary, 
  MetricType 
} from './types';

export class MetricsService implements IMetricsService {
  private logger = createLogger('metrics');
  private metrics: Map<string, MetricEvent[]> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private timers: Map<string, number> = new Map();
  private flushInterval: number;
  private batchSize: number;
  private namespace: string;
  private flushTimer?: NodeJS.Timeout;

  constructor(
    private config: {
      flushInterval?: number;
      batchSize?: number;
      namespace?: string;
      enableCloudWatch?: boolean;
    } = {}
  ) {
    this.flushInterval = config.flushInterval ?? 60000; // 1 minute
    this.batchSize = config.batchSize ?? 100;
    this.namespace = config.namespace ?? 'MileQuest';
    
    // Start auto-flush
    this.startAutoFlush();
  }

  /**
   * Increment a counter metric
   */
  counter(name: string, value: number = 1, tags: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, tags);
    const currentValue = this.counters.get(key) || 0;
    this.counters.set(key, currentValue + value);
    
    this.addMetricEvent({
      name,
      type: 'counter',
      value,
      timestamp: new Date(),
      tags,
    });

    this.logger.debug('Counter metric recorded', {
      name,
      value,
      tags,
      total: currentValue + value,
    });
  }

  /**
   * Set a gauge metric
   */
  gauge(name: string, value: number, tags: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, tags);
    this.gauges.set(key, value);
    
    this.addMetricEvent({
      name,
      type: 'gauge',
      value,
      timestamp: new Date(),
      tags,
    });

    this.logger.debug('Gauge metric recorded', {
      name,
      value,
      tags,
    });
  }

  /**
   * Record a histogram value
   */
  histogram(name: string, value: number, tags: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, tags);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);
    
    this.addMetricEvent({
      name,
      type: 'histogram',
      value,
      timestamp: new Date(),
      tags,
    });

    this.logger.debug('Histogram metric recorded', {
      name,
      value,
      tags,
      count: values.length,
    });
  }

  /**
   * Start a timer and return function to stop it
   */
  timer(name: string, tags: Record<string, string> = {}): () => void {
    const startTime = Date.now();
    const timerId = `${name}:${Date.now()}:${Math.random()}`;
    this.timers.set(timerId, startTime);
    
    return () => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      this.timers.delete(timerId);
      
      this.histogram(`${name}.duration`, duration, tags);
      
      this.logger.debug('Timer metric completed', {
        name,
        duration,
        tags,
      });
    };
  }

  /**
   * Flush all metrics to persistent storage
   */
  async flush(): Promise<void> {
    try {
      const metricBatches = this.prepareBatches();
      
      for (const batch of metricBatches) {
        await this.sendBatch(batch);
      }
      
      this.logger.info('Metrics flushed', {
        batchCount: metricBatches.length,
        totalMetrics: metricBatches.reduce((sum, batch) => sum + batch.length, 0),
      });
      
    } catch (error) {
      this.logger.error('Failed to flush metrics', error as Error);
    }
  }

  /**
   * Get metric events
   */
  async getMetrics(query: Partial<MetricEvent> = {}): Promise<MetricEvent[]> {
    const allMetrics: MetricEvent[] = [];
    
    for (const events of this.metrics.values()) {
      allMetrics.push(...events);
    }
    
    return allMetrics.filter(metric => {
      if (query.name && metric.name !== query.name) return false;
      if (query.type && metric.type !== query.type) return false;
      if (query.tags) {
        for (const [key, value] of Object.entries(query.tags)) {
          if (metric.tags[key] !== value) return false;
        }
      }
      return true;
    }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get metric summary for a specific metric
   */
  async getMetricSummary(name: string, timeRange: string = '1h'): Promise<MetricSummary> {
    const cutoff = this.getTimeRangeCutoff(timeRange);
    const metrics = await this.getMetrics({ name });
    const recentMetrics = metrics.filter(m => m.timestamp >= cutoff);
    
    if (recentMetrics.length === 0) {
      return {
        name,
        type: 'counter',
        count: 0,
        sum: 0,
        min: 0,
        max: 0,
        avg: 0,
        p95: 0,
        p99: 0,
        tags: {},
        period: timeRange,
      };
    }
    
    const values = recentMetrics.map(m => m.value);
    const sum = values.reduce((a, b) => a + b, 0);
    const sortedValues = values.sort((a, b) => a - b);
    
    return {
      name,
      type: recentMetrics[0].type,
      count: recentMetrics.length,
      sum,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: sum / values.length,
      p95: this.percentile(sortedValues, 0.95),
      p99: this.percentile(sortedValues, 0.99),
      tags: recentMetrics[0].tags,
      period: timeRange,
    };
  }

  /**
   * Get business metrics dashboard data
   */
  async getBusinessMetrics(timeRange: string = '24h'): Promise<{
    users: {
      activeUsers: number;
      newRegistrations: number;
      retentionRate: number;
    };
    activities: {
      totalActivities: number;
      totalDistance: number;
      averageDistance: number;
    };
    teams: {
      activeTeams: number;
      teamProgress: number;
      completedGoals: number;
    };
    performance: {
      averageResponseTime: number;
      errorRate: number;
      uptime: number;
    };
  }> {
    const cutoff = this.getTimeRangeCutoff(timeRange);
    
    // Get all recent metrics
    const allMetrics = await this.getMetrics();
    const recentMetrics = allMetrics.filter(m => m.timestamp >= cutoff);
    
    // Calculate business metrics
    const activeUsers = this.getMetricValue(recentMetrics, 'users.active', 'gauge') || 0;
    const newRegistrations = this.getMetricValue(recentMetrics, 'users.registrations', 'counter') || 0;
    const totalActivities = this.getMetricValue(recentMetrics, 'activities.created', 'counter') || 0;
    const totalDistance = this.getMetricValue(recentMetrics, 'activities.distance.total', 'counter') || 0;
    const activeTeams = this.getMetricValue(recentMetrics, 'teams.active', 'gauge') || 0;
    const completedGoals = this.getMetricValue(recentMetrics, 'goals.completed', 'counter') || 0;
    
    // Calculate performance metrics
    const responseTimeMetrics = recentMetrics.filter(m => m.name.includes('.duration'));
    const averageResponseTime = responseTimeMetrics.length > 0 
      ? responseTimeMetrics.reduce((sum, m) => sum + m.value, 0) / responseTimeMetrics.length 
      : 0;
    
    const errorCount = this.getMetricValue(recentMetrics, 'errors.total', 'counter') || 0;
    const requestCount = this.getMetricValue(recentMetrics, 'requests.total', 'counter') || 1;
    const errorRate = (errorCount / requestCount) * 100;
    
    return {
      users: {
        activeUsers,
        newRegistrations,
        retentionRate: this.calculateRetentionRate(recentMetrics),
      },
      activities: {
        totalActivities,
        totalDistance,
        averageDistance: totalActivities > 0 ? totalDistance / totalActivities : 0,
      },
      teams: {
        activeTeams,
        teamProgress: this.calculateTeamProgress(recentMetrics),
        completedGoals,
      },
      performance: {
        averageResponseTime,
        errorRate,
        uptime: this.calculateUptime(recentMetrics),
      },
    };
  }

  /**
   * Record API performance metrics
   */
  recordApiMetric(
    method: string, 
    endpoint: string, 
    statusCode: number, 
    duration: number,
    userId?: string
  ): void {
    const tags = {
      method,
      endpoint,
      status: statusCode.toString(),
      status_class: Math.floor(statusCode / 100) + 'xx',
    };
    
    if (userId) {
      tags.user = userId;
    }
    
    // Record request count
    this.counter('api.requests.total', 1, tags);
    
    // Record response time
    this.histogram('api.requests.duration', duration, tags);
    
    // Record error rate
    if (statusCode >= 400) {
      this.counter('api.requests.errors', 1, tags);
    }
    
    // Record by status code
    this.counter(`api.requests.status.${statusCode}`, 1, tags);
  }

  /**
   * Record database performance metrics
   */
  recordDatabaseMetric(
    operation: string,
    table: string,
    duration: number,
    success: boolean
  ): void {
    const tags = {
      operation,
      table,
      status: success ? 'success' : 'error',
    };
    
    this.counter('database.operations.total', 1, tags);
    this.histogram('database.operations.duration', duration, tags);
    
    if (!success) {
      this.counter('database.operations.errors', 1, tags);
    }
  }

  /**
   * Record business event metrics
   */
  recordBusinessEvent(
    event: string,
    value: number = 1,
    metadata: Record<string, string> = {}
  ): void {
    this.counter(`business.events.${event}`, value, metadata);
    
    this.logger.info('Business event recorded', {
      event,
      value,
      metadata,
    });
  }

  /**
   * Add metric event to storage
   */
  private addMetricEvent(event: MetricEvent): void {
    const events = this.metrics.get(event.name) || [];
    events.push(event);
    
    // Keep only recent events (last 1000 per metric)
    if (events.length > 1000) {
      events.splice(0, events.length - 1000);
    }
    
    this.metrics.set(event.name, events);
  }

  /**
   * Generate metric key with tags
   */
  private getMetricKey(name: string, tags: Record<string, string>): string {
    const tagString = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join(',');
    return `${name}${tagString ? `|${tagString}` : ''}`;
  }

  /**
   * Prepare metrics for batch sending
   */
  private prepareBatches(): MetricEvent[][] {
    const allEvents: MetricEvent[] = [];
    
    for (const events of this.metrics.values()) {
      allEvents.push(...events);
    }
    
    // Sort by timestamp
    allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Split into batches
    const batches: MetricEvent[][] = [];
    for (let i = 0; i < allEvents.length; i += this.batchSize) {
      batches.push(allEvents.slice(i, i + this.batchSize));
    }
    
    return batches;
  }

  /**
   * Send batch of metrics to CloudWatch
   */
  private async sendBatch(batch: MetricEvent[]): Promise<void> {
    // In a real implementation, this would send to CloudWatch
    // For now, we'll just log the metrics
    
    this.logger.info('Metrics batch prepared for CloudWatch', {
      batchSize: batch.length,
      namespace: this.namespace,
      metrics: batch.map(m => ({
        name: m.name,
        type: m.type,
        value: m.value,
        timestamp: m.timestamp,
        tags: m.tags,
      })),
    });
    
    // Simulate CloudWatch API call
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  /**
   * Get time range cutoff
   */
  private getTimeRangeCutoff(timeRange: string): Date {
    const now = new Date();
    const minutes = this.parseTimeRange(timeRange);
    return new Date(now.getTime() - (minutes * 60 * 1000));
  }

  /**
   * Parse time range string to minutes
   */
  private parseTimeRange(timeRange: string): number {
    const match = timeRange.match(/^(\d+)([hmd])$/);
    if (!match) return 60; // Default to 1 hour
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'm': return value;
      case 'h': return value * 60;
      case 'd': return value * 60 * 24;
      default: return 60;
    }
  }

  /**
   * Calculate percentile
   */
  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    
    const index = Math.ceil(values.length * p) - 1;
    return values[Math.max(0, index)];
  }

  /**
   * Get metric value by name and type
   */
  private getMetricValue(metrics: MetricEvent[], name: string, type: MetricType): number {
    const filtered = metrics.filter(m => m.name === name && m.type === type);
    if (filtered.length === 0) return 0;
    
    if (type === 'counter') {
      return filtered.reduce((sum, m) => sum + m.value, 0);
    } else if (type === 'gauge') {
      return filtered[filtered.length - 1].value; // Latest value
    } else {
      return filtered.reduce((sum, m) => sum + m.value, 0) / filtered.length;
    }
  }

  /**
   * Calculate retention rate from metrics
   */
  private calculateRetentionRate(metrics: MetricEvent[]): number {
    // Simplified retention rate calculation
    const activeUsers = this.getMetricValue(metrics, 'users.active', 'gauge');
    const returningUsers = this.getMetricValue(metrics, 'users.returning', 'counter');
    
    return activeUsers > 0 ? (returningUsers / activeUsers) * 100 : 0;
  }

  /**
   * Calculate team progress from metrics
   */
  private calculateTeamProgress(metrics: MetricEvent[]): number {
    // Simplified team progress calculation
    const totalGoals = this.getMetricValue(metrics, 'goals.total', 'gauge');
    const completedGoals = this.getMetricValue(metrics, 'goals.completed', 'counter');
    
    return totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0;
  }

  /**
   * Calculate uptime from metrics
   */
  private calculateUptime(metrics: MetricEvent[]): number {
    // Simplified uptime calculation
    const totalRequests = this.getMetricValue(metrics, 'requests.total', 'counter');
    const errorRequests = this.getMetricValue(metrics, 'requests.errors', 'counter');
    
    return totalRequests > 0 ? ((totalRequests - errorRequests) / totalRequests) * 100 : 100;
  }

  /**
   * Start auto-flush timer
   */
  private startAutoFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(error => {
        this.logger.error('Auto-flush failed', error as Error);
      });
    }, this.flushInterval);
  }

  /**
   * Stop auto-flush and clean up
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    
    // Final flush
    await this.flush();
    
    this.logger.info('Metrics service shutdown complete');
  }
}