/**
 * Performance Dashboard Service - DB-701
 * Real-time database performance monitoring and alerting
 */

import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  severity: 'normal' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
}

export interface PerformanceDashboard {
  overview: {
    health: 'healthy' | 'degraded' | 'critical';
    score: number; // 0-100
    alerts: number;
    recommendations: number;
  };
  metrics: {
    queries: QueryMetrics;
    connections: ConnectionMetrics;
    storage: StorageMetrics;
    performance: SystemPerformance;
  };
  alerts: PerformanceAlert[];
  recommendations: PerformanceRecommendation[];
  trends: PerformanceTrend[];
}

export interface QueryMetrics {
  averageQueryTime: number;
  slowQueries: number;
  queryThroughput: number;
  cacheHitRate: number;
  activeQueries: number;
  blockedQueries: number;
}

export interface ConnectionMetrics {
  activeConnections: number;
  idleConnections: number;
  maxConnections: number;
  connectionUtilization: number;
  connectionErrors: number;
  averageConnectionTime: number;
}

export interface StorageMetrics {
  databaseSize: number;
  tableSize: number;
  indexSize: number;
  tempFileSize: number;
  transactionLogSize: number;
  diskUtilization: number;
}

export interface SystemPerformance {
  cpuUsage: number;
  memoryUsage: number;
  ioWait: number;
  bufferCacheHitRate: number;
  checkpointTime: number;
  vacuumProgress: number;
}

export interface PerformanceAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: Date;
  acknowledged: boolean;
}

export interface PerformanceRecommendation {
  id: string;
  category: string;
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  estimatedImprovement: string;
  implementation: string[];
}

export interface PerformanceTrend {
  metric: string;
  period: '1h' | '24h' | '7d' | '30d';
  dataPoints: Array<{ timestamp: Date; value: number }>;
  trend: 'improving' | 'stable' | 'degrading';
  changePercent: number;
}

export class PerformanceDashboardService extends EventEmitter {
  private prisma: PrismaClient;
  private metricsHistory: Map<string, PerformanceMetric[]> = new Map();
  private alerts: PerformanceAlert[] = [];
  private monitoringInterval?: NodeJS.Timer;
  
  private thresholds = {
    queryTime: { warning: 100, critical: 500 }, // ms
    connectionUtilization: { warning: 70, critical: 90 }, // %
    cacheHitRate: { warning: 80, critical: 60 }, // % (inverse)
    diskUtilization: { warning: 80, critical: 95 }, // %
    slowQueries: { warning: 10, critical: 50 }, // count
    blockedQueries: { warning: 5, critical: 20 }, // count
  };

  constructor(prisma: PrismaClient) {
    super();
    this.prisma = prisma;
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(intervalMs = 60000): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // Initial collection
    this.collectMetrics();

    // Set up periodic collection
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    console.log(`Performance monitoring started (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    console.log('Performance monitoring stopped');
  }

  /**
   * Get current performance dashboard
   */
  async getDashboard(): Promise<PerformanceDashboard> {
    const metrics = await this.getCurrentMetrics();
    const alerts = this.getActiveAlerts();
    const recommendations = await this.generateRecommendations(metrics);
    const trends = await this.calculateTrends();
    
    const health = this.calculateHealth(metrics, alerts);
    const score = this.calculatePerformanceScore(metrics);

    return {
      overview: {
        health,
        score,
        alerts: alerts.length,
        recommendations: recommendations.length,
      },
      metrics,
      alerts,
      recommendations,
      trends,
    };
  }

  /**
   * Collect all performance metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.getCurrentMetrics();
      
      // Store metrics history
      Object.entries(metrics).forEach(([category, categoryMetrics]) => {
        Object.entries(categoryMetrics).forEach(([metric, value]) => {
          const key = `${category}.${metric}`;
          const history = this.metricsHistory.get(key) || [];
          
          history.push({
            name: key,
            value: value as number,
            unit: this.getMetricUnit(metric),
            timestamp: new Date(),
            severity: this.getMetricSeverity(metric, value as number),
            trend: this.getMetricTrend(history),
          });
          
          // Keep last 24 hours of data
          const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
          this.metricsHistory.set(key, history.filter(m => m.timestamp > cutoff));
        });
      });

      // Check for alerts
      this.checkAlerts(metrics);
      
      // Emit metrics event
      this.emit('metrics', metrics);
    } catch (error) {
      console.error('Failed to collect metrics:', error);
      this.emit('error', error);
    }
  }

  /**
   * Get current metrics from database
   */
  private async getCurrentMetrics(): Promise<{
    queries: QueryMetrics;
    connections: ConnectionMetrics;
    storage: StorageMetrics;
    performance: SystemPerformance;
  }> {
    const [queries, connections, storage, performance] = await Promise.all([
      this.getQueryMetrics(),
      this.getConnectionMetrics(),
      this.getStorageMetrics(),
      this.getSystemPerformance(),
    ]);

    return { queries, connections, storage, performance };
  }

  /**
   * Get query performance metrics
   */
  private async getQueryMetrics(): Promise<QueryMetrics> {
    const metrics = await this.prisma.$queryRaw<Array<{
      avg_query_time: number;
      slow_queries: number;
      query_throughput: number;
      cache_hit_rate: number;
      active_queries: number;
      blocked_queries: number;
    }>>`
      WITH query_stats AS (
        SELECT 
          AVG(mean_exec_time) as avg_query_time,
          COUNT(CASE WHEN mean_exec_time > 100 THEN 1 END) as slow_queries,
          SUM(calls) / EXTRACT(EPOCH FROM (NOW() - pg_stat_get_db_stat_reset_time(oid))) as query_throughput
        FROM pg_stat_statements
        WHERE query NOT LIKE '%pg_stat%'
      ),
      cache_stats AS (
        SELECT 
          ROUND(
            (SUM(heap_blks_hit) * 100.0 / NULLIF(SUM(heap_blks_hit + heap_blks_read), 0))::numeric, 
            2
          ) as cache_hit_rate
        FROM pg_statio_user_tables
      ),
      active_stats AS (
        SELECT 
          COUNT(CASE WHEN state = 'active' THEN 1 END) as active_queries,
          COUNT(CASE WHEN wait_event_type IS NOT NULL THEN 1 END) as blocked_queries
        FROM pg_stat_activity
        WHERE datname = current_database()
      )
      SELECT 
        COALESCE(qs.avg_query_time, 0) as avg_query_time,
        COALESCE(qs.slow_queries, 0) as slow_queries,
        COALESCE(qs.query_throughput, 0) as query_throughput,
        COALESCE(cs.cache_hit_rate, 0) as cache_hit_rate,
        COALESCE(acts.active_queries, 0) as active_queries,
        COALESCE(acts.blocked_queries, 0) as blocked_queries
      FROM query_stats qs
      CROSS JOIN cache_stats cs
      CROSS JOIN active_stats acts
    `;

    return metrics[0] || {
      averageQueryTime: 0,
      slowQueries: 0,
      queryThroughput: 0,
      cacheHitRate: 0,
      activeQueries: 0,
      blockedQueries: 0,
    };
  }

  /**
   * Get connection metrics
   */
  private async getConnectionMetrics(): Promise<ConnectionMetrics> {
    const metrics = await this.prisma.$queryRaw<Array<{
      active_connections: number;
      idle_connections: number;
      max_connections: number;
      connection_errors: number;
      avg_connection_time: number;
    }>>`
      WITH connection_stats AS (
        SELECT 
          COUNT(CASE WHEN state = 'active' THEN 1 END) as active_connections,
          COUNT(CASE WHEN state = 'idle' THEN 1 END) as idle_connections,
          setting::integer as max_connections
        FROM pg_stat_activity
        CROSS JOIN pg_settings
        WHERE pg_settings.name = 'max_connections'
        GROUP BY setting
      ),
      error_stats AS (
        SELECT 
          COUNT(*) as connection_errors
        FROM pg_stat_database
        WHERE datname = current_database()
          AND conflicts > 0
      )
      SELECT 
        cs.active_connections,
        cs.idle_connections,
        cs.max_connections,
        COALESCE(es.connection_errors, 0) as connection_errors,
        0 as avg_connection_time -- Would need connection logging
      FROM connection_stats cs
      CROSS JOIN error_stats es
    `;

    const stats = metrics[0] || {
      active_connections: 0,
      idle_connections: 0,
      max_connections: 100,
      connection_errors: 0,
      avg_connection_time: 0,
    };

    return {
      activeConnections: stats.active_connections,
      idleConnections: stats.idle_connections,
      maxConnections: stats.max_connections,
      connectionUtilization: ((stats.active_connections + stats.idle_connections) / stats.max_connections) * 100,
      connectionErrors: stats.connection_errors,
      averageConnectionTime: stats.avg_connection_time,
    };
  }

  /**
   * Get storage metrics
   */
  private async getStorageMetrics(): Promise<StorageMetrics> {
    const metrics = await this.prisma.$queryRaw<Array<{
      database_size: number;
      table_size: number;
      index_size: number;
      temp_size: number;
    }>>`
      SELECT 
        pg_database_size(current_database()) / 1024.0 / 1024.0 as database_size,
        SUM(pg_total_relation_size(c.oid)) / 1024.0 / 1024.0 as table_size,
        SUM(pg_indexes_size(c.oid)) / 1024.0 / 1024.0 as index_size,
        COALESCE(SUM(pg_total_relation_size(c.oid)) FILTER (WHERE c.relpersistence = 't'), 0) / 1024.0 / 1024.0 as temp_size
      FROM pg_class c
      WHERE c.relkind IN ('r', 'i')
        AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    `;

    const stats = metrics[0] || {
      database_size: 0,
      table_size: 0,
      index_size: 0,
      temp_size: 0,
    };

    return {
      databaseSize: stats.database_size,
      tableSize: stats.table_size,
      indexSize: stats.index_size,
      tempFileSize: stats.temp_size,
      transactionLogSize: 0, // Would need WAL access
      diskUtilization: 0, // Would need OS-level access
    };
  }

  /**
   * Get system performance metrics
   */
  private async getSystemPerformance(): Promise<SystemPerformance> {
    const metrics = await this.prisma.$queryRaw<Array<{
      buffer_cache_hit_rate: number;
      checkpoint_time: number;
    }>>`
      WITH buffer_stats AS (
        SELECT 
          ROUND(
            (SUM(blks_hit) * 100.0 / NULLIF(SUM(blks_hit + blks_read), 0))::numeric, 
            2
          ) as buffer_cache_hit_rate
        FROM pg_stat_database
        WHERE datname = current_database()
      ),
      checkpoint_stats AS (
        SELECT 
          EXTRACT(EPOCH FROM (checkpoint_end_time - checkpoint_start_time)) * 1000 as checkpoint_time
        FROM pg_stat_bgwriter
      )
      SELECT 
        bs.buffer_cache_hit_rate,
        COALESCE(cs.checkpoint_time, 0) as checkpoint_time
      FROM buffer_stats bs
      CROSS JOIN checkpoint_stats cs
    `;

    const stats = metrics[0] || {
      buffer_cache_hit_rate: 0,
      checkpoint_time: 0,
    };

    return {
      cpuUsage: 0, // Would need OS-level access
      memoryUsage: 0, // Would need OS-level access
      ioWait: 0, // Would need OS-level access
      bufferCacheHitRate: stats.buffer_cache_hit_rate,
      checkpointTime: stats.checkpoint_time,
      vacuumProgress: 0, // Would need pg_stat_progress_vacuum
    };
  }

  /**
   * Check for performance alerts
   */
  private checkAlerts(metrics: any): void {
    const newAlerts: PerformanceAlert[] = [];

    // Query time alerts
    if (metrics.queries.averageQueryTime > this.thresholds.queryTime.critical) {
      newAlerts.push(this.createAlert(
        'critical',
        'query_time',
        'Critical: Average query time is extremely high',
        'averageQueryTime',
        metrics.queries.averageQueryTime,
        this.thresholds.queryTime.critical
      ));
    } else if (metrics.queries.averageQueryTime > this.thresholds.queryTime.warning) {
      newAlerts.push(this.createAlert(
        'high',
        'query_time',
        'Warning: Average query time is high',
        'averageQueryTime',
        metrics.queries.averageQueryTime,
        this.thresholds.queryTime.warning
      ));
    }

    // Connection utilization alerts
    if (metrics.connections.connectionUtilization > this.thresholds.connectionUtilization.critical) {
      newAlerts.push(this.createAlert(
        'critical',
        'connections',
        'Critical: Connection pool nearly exhausted',
        'connectionUtilization',
        metrics.connections.connectionUtilization,
        this.thresholds.connectionUtilization.critical
      ));
    }

    // Cache hit rate alerts (inverse threshold)
    if (metrics.queries.cacheHitRate < this.thresholds.cacheHitRate.critical) {
      newAlerts.push(this.createAlert(
        'high',
        'cache',
        'Low cache hit rate affecting performance',
        'cacheHitRate',
        metrics.queries.cacheHitRate,
        this.thresholds.cacheHitRate.critical
      ));
    }

    // Blocked queries alert
    if (metrics.queries.blockedQueries > this.thresholds.blockedQueries.warning) {
      newAlerts.push(this.createAlert(
        'medium',
        'blocking',
        'Multiple queries are blocked',
        'blockedQueries',
        metrics.queries.blockedQueries,
        this.thresholds.blockedQueries.warning
      ));
    }

    // Add new alerts and emit events
    newAlerts.forEach(alert => {
      if (!this.alerts.find(a => a.id === alert.id)) {
        this.alerts.push(alert);
        this.emit('alert', alert);
      }
    });

    // Clean up old alerts
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.alerts = this.alerts.filter(a => a.timestamp > cutoff);
  }

  /**
   * Create a performance alert
   */
  private createAlert(
    severity: 'low' | 'medium' | 'high' | 'critical',
    type: string,
    message: string,
    metric: string,
    value: number,
    threshold: number
  ): PerformanceAlert {
    return {
      id: `${type}_${metric}_${Date.now()}`,
      severity,
      type,
      message,
      metric,
      value,
      threshold,
      timestamp: new Date(),
      acknowledged: false,
    };
  }

  /**
   * Generate performance recommendations
   */
  private async generateRecommendations(metrics: any): Promise<PerformanceRecommendation[]> {
    const recommendations: PerformanceRecommendation[] = [];

    // Query performance recommendations
    if (metrics.queries.averageQueryTime > 50) {
      recommendations.push({
        id: 'optimize_slow_queries',
        category: 'query_optimization',
        title: 'Optimize Slow Queries',
        description: 'Several queries are taking longer than expected to execute',
        impact: 'high',
        effort: 'medium',
        estimatedImprovement: '40-60% reduction in query time',
        implementation: [
          'Run EXPLAIN ANALYZE on slow queries',
          'Add missing indexes identified by query analyzer',
          'Consider query rewriting for complex joins',
          'Review and optimize materialized view refresh schedules',
        ],
      });
    }

    // Cache optimization
    if (metrics.queries.cacheHitRate < 85) {
      recommendations.push({
        id: 'improve_cache_hit_rate',
        category: 'cache_optimization',
        title: 'Improve Cache Hit Rate',
        description: 'Database cache hit rate is below optimal levels',
        impact: 'high',
        effort: 'low',
        estimatedImprovement: '20-30% better performance',
        implementation: [
          'Increase shared_buffers to 25% of available RAM',
          'Tune effective_cache_size based on system memory',
          'Implement application-level caching for frequently accessed data',
          'Review and optimize query patterns to improve cache usage',
        ],
      });
    }

    // Connection pooling
    if (metrics.connections.connectionUtilization > 60) {
      recommendations.push({
        id: 'optimize_connection_pool',
        category: 'connection_management',
        title: 'Optimize Connection Pooling',
        description: 'Connection pool utilization is high',
        impact: 'medium',
        effort: 'low',
        estimatedImprovement: 'Better connection reuse and reduced latency',
        implementation: [
          'Implement connection pooling at application level',
          'Configure PgBouncer for connection multiplexing',
          'Reduce connection acquisition time in Lambda functions',
          'Review and optimize connection lifecycle management',
        ],
      });
    }

    // Index optimization
    const indexEfficiency = (metrics.storage.indexSize / metrics.storage.tableSize) * 100;
    if (indexEfficiency > 50) {
      recommendations.push({
        id: 'optimize_indexes',
        category: 'index_management',
        title: 'Optimize Database Indexes',
        description: 'Index storage is high relative to table size',
        impact: 'medium',
        effort: 'medium',
        estimatedImprovement: '10-20% storage reduction',
        implementation: [
          'Identify and drop unused indexes',
          'Consolidate redundant indexes',
          'Consider partial indexes for filtered queries',
          'Implement covering indexes for index-only scans',
        ],
      });
    }

    return recommendations;
  }

  /**
   * Calculate performance trends
   */
  private async calculateTrends(): Promise<PerformanceTrend[]> {
    const trends: PerformanceTrend[] = [];
    const periods: Array<{ period: '1h' | '24h' | '7d' | '30d'; hours: number }> = [
      { period: '1h', hours: 1 },
      { period: '24h', hours: 24 },
      { period: '7d', hours: 168 },
      { period: '30d', hours: 720 },
    ];

    const importantMetrics = [
      'queries.averageQueryTime',
      'queries.cacheHitRate',
      'connections.connectionUtilization',
      'queries.slowQueries',
    ];

    for (const metric of importantMetrics) {
      const history = this.metricsHistory.get(metric) || [];
      
      for (const { period, hours } of periods) {
        const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
        const periodData = history.filter(h => h.timestamp > cutoff);
        
        if (periodData.length > 1) {
          const dataPoints = periodData.map(d => ({ timestamp: d.timestamp, value: d.value }));
          const trend = this.calculateTrendDirection(dataPoints);
          const changePercent = this.calculateChangePercent(dataPoints);
          
          trends.push({
            metric,
            period,
            dataPoints,
            trend,
            changePercent,
          });
        }
      }
    }

    return trends;
  }

  /**
   * Calculate overall system health
   */
  private calculateHealth(
    metrics: any,
    alerts: PerformanceAlert[]
  ): 'healthy' | 'degraded' | 'critical' {
    const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
    const highAlerts = alerts.filter(a => a.severity === 'high').length;
    
    if (criticalAlerts > 0) return 'critical';
    if (highAlerts > 2) return 'critical';
    if (highAlerts > 0 || alerts.length > 5) return 'degraded';
    
    return 'healthy';
  }

  /**
   * Calculate performance score (0-100)
   */
  private calculatePerformanceScore(metrics: any): number {
    let score = 100;
    
    // Deduct points for poor metrics
    if (metrics.queries.averageQueryTime > 100) score -= 20;
    if (metrics.queries.cacheHitRate < 80) score -= 15;
    if (metrics.connections.connectionUtilization > 70) score -= 10;
    if (metrics.queries.slowQueries > 10) score -= 10;
    if (metrics.queries.blockedQueries > 5) score -= 15;
    
    // Bonus points for excellent metrics
    if (metrics.queries.cacheHitRate > 95) score += 5;
    if (metrics.queries.averageQueryTime < 10) score += 5;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get metric unit
   */
  private getMetricUnit(metric: string): string {
    const units: Record<string, string> = {
      averageQueryTime: 'ms',
      connectionUtilization: '%',
      cacheHitRate: '%',
      databaseSize: 'MB',
      slowQueries: 'count',
      activeConnections: 'count',
    };
    
    return units[metric] || 'value';
  }

  /**
   * Get metric severity based on thresholds
   */
  private getMetricSeverity(metric: string, value: number): 'normal' | 'warning' | 'critical' {
    // Implement threshold checking
    if (metric === 'averageQueryTime') {
      if (value > this.thresholds.queryTime.critical) return 'critical';
      if (value > this.thresholds.queryTime.warning) return 'warning';
    }
    
    return 'normal';
  }

  /**
   * Calculate metric trend
   */
  private getMetricTrend(history: PerformanceMetric[]): 'up' | 'down' | 'stable' {
    if (history.length < 2) return 'stable';
    
    const recent = history.slice(-10);
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, m) => sum + m.value, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, m) => sum + m.value, 0) / secondHalf.length;
    
    const change = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    if (Math.abs(change) < 5) return 'stable';
    return change > 0 ? 'up' : 'down';
  }

  /**
   * Calculate trend direction from data points
   */
  private calculateTrendDirection(
    dataPoints: Array<{ timestamp: Date; value: number }>
  ): 'improving' | 'stable' | 'degrading' {
    if (dataPoints.length < 2) return 'stable';
    
    // Simple linear regression
    const n = dataPoints.length;
    const x = dataPoints.map((_, i) => i);
    const y = dataPoints.map(d => d.value);
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
    const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    if (Math.abs(slope) < 0.01) return 'stable';
    
    // For metrics where lower is better (like query time)
    const lowerIsBetter = ['averageQueryTime', 'slowQueries', 'blockedQueries'];
    const metricName = dataPoints[0] ? Object.keys(dataPoints[0])[1] : '';
    
    if (lowerIsBetter.some(m => metricName.includes(m))) {
      return slope > 0 ? 'degrading' : 'improving';
    }
    
    return slope > 0 ? 'improving' : 'degrading';
  }

  /**
   * Calculate percentage change
   */
  private calculateChangePercent(
    dataPoints: Array<{ timestamp: Date; value: number }>
  ): number {
    if (dataPoints.length < 2) return 0;
    
    const first = dataPoints[0].value;
    const last = dataPoints[dataPoints.length - 1].value;
    
    if (first === 0) return 0;
    
    return Math.round(((last - first) / first) * 100 * 100) / 100;
  }

  /**
   * Get active alerts
   */
  private getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(a => !a.acknowledged);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  /**
   * Export performance report
   */
  async exportReport(format: 'json' | 'csv' | 'html' = 'json'): Promise<string> {
    const dashboard = await this.getDashboard();
    
    switch (format) {
      case 'json':
        return JSON.stringify(dashboard, null, 2);
        
      case 'csv':
        // Convert metrics to CSV format
        const csv = [
          'Metric,Value,Unit,Severity',
          ...Object.entries(dashboard.metrics).flatMap(([category, metrics]) =>
            Object.entries(metrics).map(([metric, value]) =>
              `${category}.${metric},${value},${this.getMetricUnit(metric)},normal`
            )
          ),
        ].join('\n');
        return csv;
        
      case 'html':
        // Generate HTML report
        return this.generateHTMLReport(dashboard);
        
      default:
        return JSON.stringify(dashboard);
    }
  }

  /**
   * Generate HTML performance report
   */
  private generateHTMLReport(dashboard: PerformanceDashboard): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Database Performance Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
    .metric { margin: 10px 0; padding: 10px; border: 1px solid #ddd; }
    .alert { background: #ffeeee; padding: 10px; margin: 5px 0; border-radius: 3px; }
    .recommendation { background: #eeffee; padding: 10px; margin: 5px 0; border-radius: 3px; }
    .health-healthy { color: green; }
    .health-degraded { color: orange; }
    .health-critical { color: red; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Database Performance Report</h1>
    <p>Generated: ${new Date().toISOString()}</p>
    <p>Health: <span class="health-${dashboard.overview.health}">${dashboard.overview.health}</span></p>
    <p>Score: ${dashboard.overview.score}/100</p>
  </div>
  
  <h2>Metrics</h2>
  ${Object.entries(dashboard.metrics).map(([category, metrics]) => `
    <h3>${category}</h3>
    ${Object.entries(metrics).map(([metric, value]) => `
      <div class="metric">
        <strong>${metric}:</strong> ${value} ${this.getMetricUnit(metric)}
      </div>
    `).join('')}
  `).join('')}
  
  <h2>Alerts (${dashboard.alerts.length})</h2>
  ${dashboard.alerts.map(alert => `
    <div class="alert">
      <strong>${alert.severity}:</strong> ${alert.message}
      <br>Value: ${alert.value}, Threshold: ${alert.threshold}
    </div>
  `).join('')}
  
  <h2>Recommendations (${dashboard.recommendations.length})</h2>
  ${dashboard.recommendations.map(rec => `
    <div class="recommendation">
      <h4>${rec.title}</h4>
      <p>${rec.description}</p>
      <p>Impact: ${rec.impact}, Effort: ${rec.effort}</p>
      <p>Expected Improvement: ${rec.estimatedImprovement}</p>
    </div>
  `).join('')}
</body>
</html>
    `;
  }
}