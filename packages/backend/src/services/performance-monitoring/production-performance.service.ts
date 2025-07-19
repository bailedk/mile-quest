/**
 * Production Performance Monitoring Service - DB-702
 * Advanced database performance monitoring and alerting for production environments
 */

import { PrismaClient } from '@prisma/client';

export interface DatabaseMetrics {
  connectionPool: {
    activeConnections: number;
    idleConnections: number;
    totalConnections: number;
    maxConnections: number;
    connectionUtilization: number;
  };
  queryPerformance: {
    averageQueryTime: number;
    slowQueryCount: number;
    totalQueries: number;
    cacheHitRatio: number;
  };
  indexEfficiency: {
    totalIndexes: number;
    unusedIndexes: number;
    indexHitRatio: number;
    largestIndexes: Array<{
      indexName: string;
      tableName: string;
      sizeMB: number;
      usageCount: number;
    }>;
  };
  materializedViews: {
    totalViews: number;
    staleViews: number;
    averageRefreshTime: number;
    failedRefreshes: number;
    lastRefreshTime: Date | null;
  };
  tableHealth: {
    totalTables: number;
    bloatedTables: number;
    largestTables: Array<{
      tableName: string;
      sizeMB: number;
      rowCount: number;
      bloatRatio: number;
    }>;
  };
  triggerPerformance: {
    totalTriggers: number;
    slowTriggers: number;
    averageTriggerTime: number;
    triggerFailures: number;
  };
}

export interface PerformanceAlert {
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'performance' | 'availability' | 'data_integrity' | 'capacity';
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: Date;
  recommendations: string[];
}

export interface QueryPlan {
  query: string;
  executionTime: number;
  planType: string;
  cost: number;
  rows: number;
  indexes: string[];
  recommendations: string[];
}

export class ProductionPerformanceService {
  private alertThresholds = {
    slowQueryThreshold: 1000, // ms
    connectionUtilizationThreshold: 80, // %
    cacheHitRatioThreshold: 85, // %
    triggerExecutionThreshold: 100, // ms
    indexUsageThreshold: 100, // minimum scans
    tableBloatThreshold: 2.0, // ratio
    refreshFailureThreshold: 10, // %
  };

  constructor(private prisma: PrismaClient) {}

  /**
   * Comprehensive database health check
   */
  async getComprehensiveMetrics(): Promise<DatabaseMetrics> {
    const [
      connectionMetrics,
      queryMetrics,
      indexMetrics,
      mvMetrics,
      tableMetrics,
      triggerMetrics,
    ] = await Promise.all([
      this.getConnectionPoolMetrics(),
      this.getQueryPerformanceMetrics(),
      this.getIndexEfficiencyMetrics(),
      this.getMaterializedViewMetrics(),
      this.getTableHealthMetrics(),
      this.getTriggerPerformanceMetrics(),
    ]);

    return {
      connectionPool: connectionMetrics,
      queryPerformance: queryMetrics,
      indexEfficiency: indexMetrics,
      materializedViews: mvMetrics,
      tableHealth: tableMetrics,
      triggerPerformance: triggerMetrics,
    };
  }

  /**
   * Real-time performance alerts
   */
  async checkPerformanceAlerts(): Promise<PerformanceAlert[]> {
    const alerts: PerformanceAlert[] = [];
    const metrics = await this.getComprehensiveMetrics();

    // Connection pool alerts
    if (metrics.connectionPool.connectionUtilization > this.alertThresholds.connectionUtilizationThreshold) {
      alerts.push({
        severity: metrics.connectionPool.connectionUtilization > 95 ? 'critical' : 'high',
        category: 'availability',
        message: 'High connection pool utilization detected',
        metric: 'connection_utilization',
        value: metrics.connectionPool.connectionUtilization,
        threshold: this.alertThresholds.connectionUtilizationThreshold,
        timestamp: new Date(),
        recommendations: [
          'Review connection pool configuration',
          'Implement connection pooling optimizations',
          'Check for connection leaks in application code',
          'Consider increasing max_connections if hardware allows',
        ],
      });
    }

    // Query performance alerts
    if (metrics.queryPerformance.cacheHitRatio < this.alertThresholds.cacheHitRatioThreshold) {
      alerts.push({
        severity: metrics.queryPerformance.cacheHitRatio < 70 ? 'high' : 'medium',
        category: 'performance',
        message: 'Low cache hit ratio detected',
        metric: 'cache_hit_ratio',
        value: metrics.queryPerformance.cacheHitRatio,
        threshold: this.alertThresholds.cacheHitRatioThreshold,
        timestamp: new Date(),
        recommendations: [
          'Increase shared_buffers configuration',
          'Review query patterns for optimization opportunities',
          'Consider adding missing indexes',
          'Implement application-level caching',
        ],
      });
    }

    // Slow query alerts
    if (metrics.queryPerformance.slowQueryCount > 10) {
      alerts.push({
        severity: metrics.queryPerformance.slowQueryCount > 50 ? 'high' : 'medium',
        category: 'performance',
        message: 'High number of slow queries detected',
        metric: 'slow_query_count',
        value: metrics.queryPerformance.slowQueryCount,
        threshold: 10,
        timestamp: new Date(),
        recommendations: [
          'Review and optimize slow queries',
          'Add appropriate indexes',
          'Consider query rewriting',
          'Implement materialized views for complex aggregations',
        ],
      });
    }

    // Index efficiency alerts
    if (metrics.indexEfficiency.unusedIndexes > 5) {
      alerts.push({
        severity: 'low',
        category: 'capacity',
        message: 'Multiple unused indexes detected',
        metric: 'unused_indexes',
        value: metrics.indexEfficiency.unusedIndexes,
        threshold: 5,
        timestamp: new Date(),
        recommendations: [
          'Review and drop unused indexes',
          'Analyze index usage patterns',
          'Consider consolidating similar indexes',
        ],
      });
    }

    // Materialized view alerts
    if (metrics.materializedViews.staleViews > 2) {
      alerts.push({
        severity: 'medium',
        category: 'data_integrity',
        message: 'Multiple stale materialized views detected',
        metric: 'stale_materialized_views',
        value: metrics.materializedViews.staleViews,
        threshold: 2,
        timestamp: new Date(),
        recommendations: [
          'Review materialized view refresh schedule',
          'Check for refresh job failures',
          'Consider implementing automatic refresh triggers',
        ],
      });
    }

    // Table bloat alerts
    const bloatedTables = metrics.tableHealth.largestTables.filter(
      t => t.bloatRatio > this.alertThresholds.tableBloatThreshold
    );
    if (bloatedTables.length > 0) {
      alerts.push({
        severity: 'medium',
        category: 'capacity',
        message: `Table bloat detected in ${bloatedTables.length} tables`,
        metric: 'table_bloat_count',
        value: bloatedTables.length,
        threshold: 0,
        timestamp: new Date(),
        recommendations: [
          'Schedule VACUUM and REINDEX operations',
          'Review autovacuum settings',
          'Consider pg_repack for severely bloated tables',
          `Affected tables: ${bloatedTables.map(t => t.tableName).join(', ')}`,
        ],
      });
    }

    // Trigger performance alerts
    if (metrics.triggerPerformance.slowTriggers > 0) {
      alerts.push({
        severity: 'medium',
        category: 'performance',
        message: 'Slow database triggers detected',
        metric: 'slow_triggers',
        value: metrics.triggerPerformance.slowTriggers,
        threshold: 0,
        timestamp: new Date(),
        recommendations: [
          'Review trigger logic for optimization',
          'Consider batching trigger operations',
          'Use conditional trigger execution',
          'Monitor trigger execution patterns',
        ],
      });
    }

    return alerts;
  }

  /**
   * Analyze query plans for optimization opportunities
   */
  async analyzeQueryPlans(queries: string[]): Promise<QueryPlan[]> {
    const plans: QueryPlan[] = [];

    for (const query of queries) {
      try {
        const explainResult = await this.prisma.$queryRawUnsafe(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`);
        const plan = this.parseQueryPlan(query, explainResult);
        plans.push(plan);
      } catch (error) {
        console.error(`Failed to analyze query plan for: ${query.substring(0, 100)}...`, error);
      }
    }

    return plans;
  }

  /**
   * Generate performance optimization recommendations
   */
  async generateOptimizationRecommendations(): Promise<{
    indexRecommendations: string[];
    queryOptimizations: string[];
    configurationTuning: string[];
    maintenanceActions: string[];
  }> {
    const metrics = await this.getComprehensiveMetrics();
    const recommendations = {
      indexRecommendations: [],
      queryOptimizations: [],
      configurationTuning: [],
      maintenanceActions: [],
    };

    // Index recommendations
    if (metrics.indexEfficiency.unusedIndexes > 0) {
      recommendations.indexRecommendations.push(
        `Drop ${metrics.indexEfficiency.unusedIndexes} unused indexes to reduce storage overhead`
      );
    }

    if (metrics.indexEfficiency.indexHitRatio < 95) {
      recommendations.indexRecommendations.push(
        'Consider adding covering indexes for frequently accessed columns'
      );
    }

    // Query optimization recommendations
    if (metrics.queryPerformance.slowQueryCount > 0) {
      recommendations.queryOptimizations.push(
        `Optimize ${metrics.queryPerformance.slowQueryCount} slow queries detected in the last 24 hours`
      );
    }

    if (metrics.queryPerformance.cacheHitRatio < 90) {
      recommendations.queryOptimizations.push(
        'Implement query result caching for frequently executed queries'
      );
    }

    // Configuration tuning
    if (metrics.connectionPool.connectionUtilization > 80) {
      recommendations.configurationTuning.push(
        'Tune connection pool settings - consider increasing max_connections or implementing connection pooling'
      );
    }

    if (metrics.queryPerformance.cacheHitRatio < 85) {
      recommendations.configurationTuning.push(
        'Increase shared_buffers and effective_cache_size for better memory utilization'
      );
    }

    // Maintenance actions
    const bloatedTables = metrics.tableHealth.largestTables.filter(t => t.bloatRatio > 2.0);
    if (bloatedTables.length > 0) {
      recommendations.maintenanceActions.push(
        `Schedule VACUUM operations for ${bloatedTables.length} bloated tables`
      );
    }

    if (metrics.materializedViews.staleViews > 0) {
      recommendations.maintenanceActions.push(
        `Refresh ${metrics.materializedViews.staleViews} stale materialized views`
      );
    }

    return recommendations;
  }

  /**
   * Get connection pool metrics
   */
  private async getConnectionPoolMetrics(): Promise<DatabaseMetrics['connectionPool']> {
    const connectionStats = await this.prisma.$queryRaw<Array<{
      total_connections: number;
      active_connections: number;
      idle_connections: number;
      max_connections: number;
    }>>`
      SELECT 
        (SELECT COUNT(*) FROM pg_stat_activity) as total_connections,
        (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
        (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections,
        (SELECT setting::integer FROM pg_settings WHERE name = 'max_connections') as max_connections
    `;

    const stats = connectionStats[0];
    const connectionUtilization = (stats.total_connections / stats.max_connections) * 100;

    return {
      activeConnections: stats.active_connections,
      idleConnections: stats.idle_connections,
      totalConnections: stats.total_connections,
      maxConnections: stats.max_connections,
      connectionUtilization: Math.round(connectionUtilization * 100) / 100,
    };
  }

  /**
   * Get query performance metrics
   */
  private async getQueryPerformanceMetrics(): Promise<DatabaseMetrics['queryPerformance']> {
    // Note: Requires pg_stat_statements extension for production
    const queryStats = await this.prisma.$queryRaw<Array<{
      avg_query_time: number;
      slow_query_count: number;
      total_queries: number;
      cache_hit_ratio: number;
    }>>`
      WITH query_stats AS (
        SELECT 
          COALESCE(AVG(duration_ms), 0) as avg_query_time,
          COUNT(CASE WHEN duration_ms > ${this.alertThresholds.slowQueryThreshold} THEN 1 END) as slow_query_count,
          COUNT(*) as total_queries
        FROM mv_refresh_log 
        WHERE refreshed_at >= NOW() - INTERVAL '24 hours'
      ),
      cache_stats AS (
        SELECT 
          ROUND(
            (SUM(heap_blks_hit) * 100.0 / NULLIF(SUM(heap_blks_hit + heap_blks_read), 0))::numeric, 
            2
          ) as cache_hit_ratio
        FROM pg_statio_user_tables
        WHERE schemaname = 'public'
      )
      SELECT 
        qs.avg_query_time,
        qs.slow_query_count,
        qs.total_queries,
        COALESCE(cs.cache_hit_ratio, 0) as cache_hit_ratio
      FROM query_stats qs
      CROSS JOIN cache_stats cs
    `;

    const stats = queryStats[0] || {
      avg_query_time: 0,
      slow_query_count: 0,
      total_queries: 0,
      cache_hit_ratio: 0,
    };

    return {
      averageQueryTime: stats.avg_query_time,
      slowQueryCount: stats.slow_query_count,
      totalQueries: stats.total_queries,
      cacheHitRatio: stats.cache_hit_ratio,
    };
  }

  /**
   * Get index efficiency metrics
   */
  private async getIndexEfficiencyMetrics(): Promise<DatabaseMetrics['indexEfficiency']> {
    const indexStats = await this.prisma.$queryRaw<Array<{
      total_indexes: number;
      unused_indexes: number;
      index_hit_ratio: number;
    }>>`
      WITH index_stats AS (
        SELECT 
          COUNT(*) as total_indexes,
          COUNT(CASE WHEN idx_scan = 0 THEN 1 END) as unused_indexes,
          ROUND(
            (SUM(idx_blks_hit) * 100.0 / NULLIF(SUM(idx_blks_hit + idx_blks_read), 0))::numeric, 
            2
          ) as index_hit_ratio
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
      )
      SELECT * FROM index_stats
    `;

    const largestIndexes = await this.prisma.$queryRaw<Array<{
      indexname: string;
      tablename: string;
      size_mb: number;
      usage_count: number;
    }>>`
      SELECT 
        indexname,
        tablename,
        ROUND(pg_relation_size(indexrelid) / 1024.0 / 1024.0, 2) as size_mb,
        idx_scan as usage_count
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
      ORDER BY pg_relation_size(indexrelid) DESC
      LIMIT 10
    `;

    const stats = indexStats[0] || {
      total_indexes: 0,
      unused_indexes: 0,
      index_hit_ratio: 0,
    };

    return {
      totalIndexes: stats.total_indexes,
      unusedIndexes: stats.unused_indexes,
      indexHitRatio: stats.index_hit_ratio,
      largestIndexes: largestIndexes.map(idx => ({
        indexName: idx.indexname,
        tableName: idx.tablename,
        sizeMB: idx.size_mb,
        usageCount: idx.usage_count,
      })),
    };
  }

  /**
   * Get materialized view metrics
   */
  private async getMaterializedViewMetrics(): Promise<DatabaseMetrics['materializedViews']> {
    const mvStats = await this.prisma.$queryRaw<Array<{
      total_views: number;
      stale_views: number;
      avg_refresh_time: number;
      failed_refreshes: number;
      last_refresh: Date | null;
    }>>`
      WITH mv_stats AS (
        SELECT 
          COUNT(DISTINCT view_name) as total_views,
          COUNT(DISTINCT CASE 
            WHEN refreshed_at < NOW() - INTERVAL '1 hour' THEN view_name 
          END) as stale_views,
          COALESCE(AVG(duration_ms), 0) as avg_refresh_time,
          COUNT(CASE WHEN success = false THEN 1 END) as failed_refreshes,
          MAX(refreshed_at) as last_refresh
        FROM mv_refresh_log
        WHERE refreshed_at >= NOW() - INTERVAL '24 hours'
          AND view_name LIKE 'mv_%'
      )
      SELECT * FROM mv_stats
    `;

    const stats = mvStats[0] || {
      total_views: 0,
      stale_views: 0,
      avg_refresh_time: 0,
      failed_refreshes: 0,
      last_refresh: null,
    };

    return {
      totalViews: stats.total_views,
      staleViews: stats.stale_views,
      averageRefreshTime: stats.avg_refresh_time,
      failedRefreshes: stats.failed_refreshes,
      lastRefreshTime: stats.last_refresh,
    };
  }

  /**
   * Get table health metrics
   */
  private async getTableHealthMetrics(): Promise<DatabaseMetrics['tableHealth']> {
    const tableStats = await this.prisma.$queryRaw<Array<{
      total_tables: number;
      bloated_tables: number;
    }>>`
      WITH table_stats AS (
        SELECT 
          COUNT(*) as total_tables,
          COUNT(CASE WHEN table_bloat_ratio > ${this.alertThresholds.tableBloatThreshold} THEN 1 END) as bloated_tables
        FROM v_table_bloat
        WHERE schemaname = 'public'
      )
      SELECT * FROM table_stats
    `;

    const largestTables = await this.prisma.$queryRaw<Array<{
      tablename: string;
      size_mb: number;
      row_count: number;
      bloat_ratio: number;
    }>>`
      SELECT 
        tablename,
        ROUND(pg_total_relation_size(oid) / 1024.0 / 1024.0, 2) as size_mb,
        reltuples::bigint as row_count,
        COALESCE(table_bloat_ratio, 1.0) as bloat_ratio
      FROM pg_class c
      LEFT JOIN v_table_bloat vb ON vb.tablename = c.relname
      WHERE c.relkind = 'r' 
        AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ORDER BY pg_total_relation_size(c.oid) DESC
      LIMIT 10
    `;

    const stats = tableStats[0] || {
      total_tables: 0,
      bloated_tables: 0,
    };

    return {
      totalTables: stats.total_tables,
      bloatedTables: stats.bloated_tables,
      largestTables: largestTables.map(table => ({
        tableName: table.tablename,
        sizeMB: table.size_mb,
        rowCount: table.row_count,
        bloatRatio: table.bloat_ratio,
      })),
    };
  }

  /**
   * Get trigger performance metrics
   */
  private async getTriggerPerformanceMetrics(): Promise<DatabaseMetrics['triggerPerformance']> {
    const triggerStats = await this.prisma.$queryRaw<Array<{
      total_triggers: number;
      slow_triggers: number;
      avg_trigger_time: number;
      trigger_failures: number;
    }>>`
      WITH trigger_stats AS (
        SELECT 
          COUNT(DISTINCT trigger_name) as total_triggers,
          COUNT(CASE WHEN execution_time_ms > ${this.alertThresholds.triggerExecutionThreshold} THEN 1 END) as slow_triggers,
          COALESCE(AVG(execution_time_ms), 0) as avg_trigger_time,
          0 as trigger_failures  -- Would need error tracking for actual failures
        FROM trigger_performance_log
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      )
      SELECT * FROM trigger_stats
    `;

    const stats = triggerStats[0] || {
      total_triggers: 0,
      slow_triggers: 0,
      avg_trigger_time: 0,
      trigger_failures: 0,
    };

    return {
      totalTriggers: stats.total_triggers,
      slowTriggers: stats.slow_triggers,
      averageTriggerTime: stats.avg_trigger_time,
      triggerFailures: stats.trigger_failures,
    };
  }

  /**
   * Parse query plan from EXPLAIN output
   */
  private parseQueryPlan(query: string, explainResult: any): QueryPlan {
    const plan = explainResult[0]?.['QUERY PLAN']?.[0];
    
    return {
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
      executionTime: plan?.['Actual Total Time'] || 0,
      planType: plan?.['Node Type'] || 'Unknown',
      cost: plan?.['Total Cost'] || 0,
      rows: plan?.['Actual Rows'] || 0,
      indexes: this.extractIndexesFromPlan(plan),
      recommendations: this.generatePlanRecommendations(plan),
    };
  }

  /**
   * Extract indexes used in query plan
   */
  private extractIndexesFromPlan(plan: any): string[] {
    const indexes: string[] = [];
    
    if (plan?.['Index Name']) {
      indexes.push(plan['Index Name']);
    }
    
    // Recursively check sub-plans
    if (plan?.Plans) {
      for (const subPlan of plan.Plans) {
        indexes.push(...this.extractIndexesFromPlan(subPlan));
      }
    }
    
    return [...new Set(indexes)]; // Remove duplicates
  }

  /**
   * Generate recommendations based on query plan
   */
  private generatePlanRecommendations(plan: any): string[] {
    const recommendations: string[] = [];
    
    if (plan?.['Node Type'] === 'Seq Scan') {
      recommendations.push('Consider adding an index to avoid sequential scan');
    }
    
    if (plan?.['Total Cost'] > 1000) {
      recommendations.push('High cost query - consider optimization');
    }
    
    if (plan?.['Actual Rows'] > plan?.['Plan Rows'] * 10) {
      recommendations.push('Row estimate is significantly off - consider running ANALYZE');
    }
    
    return recommendations;
  }
}