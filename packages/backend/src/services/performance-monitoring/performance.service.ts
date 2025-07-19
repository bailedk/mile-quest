/**
 * Performance Monitoring Service - DB-008
 * Monitors database performance and materialized view efficiency
 */

import { PrismaClient } from '@prisma/client';

export interface QueryPerformanceMetric {
  operation: string;
  averageTimeMs: number;
  totalCalls: number;
  totalTimeMs: number;
  lastExecuted: Date;
}

export interface IndexUsageMetric {
  tableName: string;
  indexName: string;
  scans: number;
  tuplesRead: number;
  tuplesFetched: number;
  usageCategory: string;
  sizeMB: number;
}

export interface MaterializedViewMetric {
  viewName: string;
  lastRefreshed: Date | null;
  refreshCount: number;
  averageRefreshTimeMs: number;
  totalRefreshTimeMs: number;
  successRate: number;
  rowCount: number;
  sizeMB: number;
}

export interface DatabasePerformanceReport {
  timestamp: Date;
  queryMetrics: QueryPerformanceMetric[];
  indexMetrics: IndexUsageMetric[];
  materializedViewMetrics: MaterializedViewMetric[];
  recommendations: string[];
}

export class PerformanceMonitoringService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate comprehensive database performance report
   */
  async generatePerformanceReport(): Promise<DatabasePerformanceReport> {
    const [queryMetrics, indexMetrics, materializedViewMetrics] = await Promise.all([
      this.getQueryPerformanceMetrics(),
      this.getIndexUsageMetrics(),
      this.getMaterializedViewMetrics(),
    ]);

    const recommendations = this.generateRecommendations(
      queryMetrics,
      indexMetrics,
      materializedViewMetrics
    );

    return {
      timestamp: new Date(),
      queryMetrics,
      indexMetrics,
      materializedViewMetrics,
      recommendations,
    };
  }

  /**
   * Get query performance metrics
   */
  async getQueryPerformanceMetrics(): Promise<QueryPerformanceMetric[]> {
    // Since pg_stat_statements might not be available, we'll use custom tracking
    // In production, you would enable pg_stat_statements extension
    
    try {
      const slowQueries = await this.prisma.$queryRaw<Array<{
        operation: string;
        avg_time_ms: number;
        calls: number;
        total_time_ms: number;
        last_executed: Date;
      }>>`
        SELECT 
          'Dashboard Queries' as operation,
          COALESCE(AVG(duration_ms), 0) as avg_time_ms,
          COUNT(*) as calls,
          COALESCE(SUM(duration_ms), 0) as total_time_ms,
          MAX(refreshed_at) as last_executed
        FROM mv_refresh_log 
        WHERE refresh_type = 'manual'
          AND refreshed_at >= NOW() - INTERVAL '24 hours'
        
        UNION ALL
        
        SELECT 
          'Materialized View Refreshes' as operation,
          COALESCE(AVG(duration_ms), 0) as avg_time_ms,
          COUNT(*) as calls,
          COALESCE(SUM(duration_ms), 0) as total_time_ms,
          MAX(refreshed_at) as last_executed
        FROM mv_refresh_log 
        WHERE refreshed_at >= NOW() - INTERVAL '24 hours'
      `;

      return slowQueries.map(row => ({
        operation: row.operation,
        averageTimeMs: Number(row.avg_time_ms),
        totalCalls: Number(row.calls),
        totalTimeMs: Number(row.total_time_ms),
        lastExecuted: row.last_executed,
      }));
    } catch (error) {
      console.error('Error getting query performance metrics:', error);
      return [];
    }
  }

  /**
   * Get index usage metrics
   */
  async getIndexUsageMetrics(): Promise<IndexUsageMetric[]> {
    try {
      const indexStats = await this.prisma.$queryRaw<Array<{
        tablename: string;
        indexname: string;
        idx_scan: number;
        idx_tup_read: number;
        idx_tup_fetch: number;
        usage_category: string;
        size_mb: number;
      }>>`
        SELECT 
          tablename,
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch,
          CASE 
            WHEN idx_scan = 0 THEN 'Never used'
            WHEN idx_scan < 100 THEN 'Rarely used'
            WHEN idx_scan < 1000 THEN 'Moderately used'
            ELSE 'Frequently used'
          END as usage_category,
          ROUND(pg_relation_size(indexrelid) / 1024.0 / 1024.0, 2) as size_mb
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public'
          AND tablename IN ('activities', 'teams', 'team_members', 'team_goals', 'users', 'user_stats')
        ORDER BY idx_scan DESC, pg_relation_size(indexrelid) DESC
        LIMIT 50
      `;

      return indexStats.map(row => ({
        tableName: row.tablename,
        indexName: row.indexname,
        scans: Number(row.idx_scan),
        tuplesRead: Number(row.idx_tup_read),
        tuplesFetched: Number(row.idx_tup_fetch),
        usageCategory: row.usage_category,
        sizeMB: Number(row.size_mb),
      }));
    } catch (error) {
      console.error('Error getting index usage metrics:', error);
      return [];
    }
  }

  /**
   * Get materialized view performance metrics
   */
  async getMaterializedViewMetrics(): Promise<MaterializedViewMetric[]> {
    const materializedViews = [
      'mv_user_activity_stats',
      'mv_team_activity_stats',
      'mv_team_member_leaderboard',
      'mv_global_leaderboard',
      'mv_team_goal_progress'
    ];

    const metrics: MaterializedViewMetric[] = [];

    for (const viewName of materializedViews) {
      try {
        const viewStats = await this.prisma.$queryRaw<Array<{
          view_name: string;
          last_refreshed: Date | null;
          refresh_count: number;
          avg_refresh_time_ms: number;
          total_refresh_time_ms: number;
          success_rate: number;
          row_count: number;
          size_mb: number;
        }>>`
          WITH view_stats AS (
            SELECT 
              ${viewName} as view_name,
              MAX(CASE WHEN success = true THEN refreshed_at END) as last_refreshed,
              COUNT(*) as refresh_count,
              COALESCE(AVG(CASE WHEN success = true THEN duration_ms END), 0) as avg_refresh_time_ms,
              COALESCE(SUM(CASE WHEN success = true THEN duration_ms ELSE 0 END), 0) as total_refresh_time_ms,
              ROUND(
                (COUNT(CASE WHEN success = true THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0))::numeric, 
                2
              ) as success_rate
            FROM mv_refresh_log 
            WHERE view_name = ${viewName}
              AND refreshed_at >= NOW() - INTERVAL '7 days'
          ),
          size_stats AS (
            SELECT 
              (SELECT COUNT(*) FROM ${viewName}) as row_count,
              ROUND(pg_total_relation_size('${viewName}') / 1024.0 / 1024.0, 2) as size_mb
          )
          SELECT 
            vs.*,
            ss.row_count,
            ss.size_mb
          FROM view_stats vs
          CROSS JOIN size_stats ss
        `;

        if (viewStats.length > 0) {
          const stats = viewStats[0];
          metrics.push({
            viewName: stats.view_name,
            lastRefreshed: stats.last_refreshed,
            refreshCount: Number(stats.refresh_count),
            averageRefreshTimeMs: Number(stats.avg_refresh_time_ms),
            totalRefreshTimeMs: Number(stats.total_refresh_time_ms),
            successRate: Number(stats.success_rate),
            rowCount: Number(stats.row_count),
            sizeMB: Number(stats.size_mb),
          });
        }
      } catch (error) {
        console.error(`Error getting metrics for view ${viewName}:`, error);
        // Add placeholder metric for failed view
        metrics.push({
          viewName,
          lastRefreshed: null,
          refreshCount: 0,
          averageRefreshTimeMs: 0,
          totalRefreshTimeMs: 0,
          successRate: 0,
          rowCount: 0,
          sizeMB: 0,
        });
      }
    }

    return metrics;
  }

  /**
   * Check for slow queries and performance issues
   */
  async detectPerformanceIssues(): Promise<string[]> {
    const issues: string[] = [];

    try {
      // Check for materialized views that haven't been refreshed recently
      const staleViews = await this.prisma.$queryRaw<Array<{ view_name: string; hours_since_refresh: number }>>`
        SELECT 
          view_name,
          EXTRACT(HOURS FROM (NOW() - MAX(refreshed_at))) as hours_since_refresh
        FROM mv_refresh_log 
        WHERE success = true
          AND view_name LIKE 'mv_%'
        GROUP BY view_name
        HAVING EXTRACT(HOURS FROM (NOW() - MAX(refreshed_at))) > 1
      `;

      staleViews.forEach(view => {
        issues.push(`Materialized view ${view.view_name} hasn't been refreshed in ${Math.round(view.hours_since_refresh)} hours`);
      });

      // Check for failed materialized view refreshes
      const failedRefreshes = await this.prisma.$queryRaw<Array<{ view_name: string; failure_count: number }>>`
        SELECT 
          view_name,
          COUNT(*) as failure_count
        FROM mv_refresh_log 
        WHERE success = false
          AND refreshed_at >= NOW() - INTERVAL '24 hours'
        GROUP BY view_name
        HAVING COUNT(*) > 3
      `;

      failedRefreshes.forEach(failure => {
        issues.push(`Materialized view ${failure.view_name} has ${failure.failure_count} failed refreshes in the last 24 hours`);
      });

      // Check for long-running refresh operations
      const slowRefreshes = await this.prisma.$queryRaw<Array<{ view_name: string; avg_duration_ms: number }>>`
        SELECT 
          view_name,
          AVG(duration_ms) as avg_duration_ms
        FROM mv_refresh_log 
        WHERE success = true
          AND refreshed_at >= NOW() - INTERVAL '24 hours'
        GROUP BY view_name
        HAVING AVG(duration_ms) > 30000  -- 30 seconds
      `;

      slowRefreshes.forEach(slow => {
        issues.push(`Materialized view ${slow.view_name} takes an average of ${Math.round(slow.avg_duration_ms / 1000)} seconds to refresh`);
      });

      // Check for unused indexes (if pg_stat_user_indexes is available)
      const unusedIndexes = await this.prisma.$queryRaw<Array<{ indexname: string; size_mb: number }>>`
        SELECT 
          indexname,
          ROUND(pg_relation_size(indexrelid) / 1024.0 / 1024.0, 2) as size_mb
        FROM pg_stat_user_indexes 
        WHERE idx_scan = 0 
          AND schemaname = 'public'
          AND pg_relation_size(indexrelid) > 1024 * 1024  -- Larger than 1MB
        LIMIT 10
      `;

      unusedIndexes.forEach(index => {
        issues.push(`Index ${index.indexname} (${index.size_mb}MB) is unused and could be dropped`);
      });

    } catch (error) {
      console.error('Error detecting performance issues:', error);
      issues.push('Error checking for performance issues');
    }

    return issues;
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    queryMetrics: QueryPerformanceMetric[],
    indexMetrics: IndexUsageMetric[],
    materializedViewMetrics: MaterializedViewMetric[]
  ): string[] {
    const recommendations: string[] = [];

    // Check materialized view refresh patterns
    const staleViews = materializedViewMetrics.filter(mv => 
      !mv.lastRefreshed || 
      (new Date().getTime() - mv.lastRefreshed.getTime()) > 60 * 60 * 1000 // 1 hour
    );

    if (staleViews.length > 0) {
      recommendations.push(
        `Consider setting up automatic refresh for materialized views: ${staleViews.map(v => v.viewName).join(', ')}`
      );
    }

    // Check for low success rates
    const problematicViews = materializedViewMetrics.filter(mv => 
      mv.refreshCount > 0 && mv.successRate < 90
    );

    if (problematicViews.length > 0) {
      recommendations.push(
        `Investigate refresh failures for views with low success rates: ${problematicViews.map(v => `${v.viewName} (${v.successRate}%)`).join(', ')}`
      );
    }

    // Check for slow refresh operations
    const slowViews = materializedViewMetrics.filter(mv => 
      mv.averageRefreshTimeMs > 30000 // 30 seconds
    );

    if (slowViews.length > 0) {
      recommendations.push(
        `Optimize refresh performance for slow materialized views: ${slowViews.map(v => `${v.viewName} (${Math.round(v.averageRefreshTimeMs / 1000)}s)`).join(', ')}`
      );
    }

    // Check for unused indexes
    const unusedIndexes = indexMetrics.filter(idx => 
      idx.usageCategory === 'Never used' && idx.sizeMB > 1
    );

    if (unusedIndexes.length > 0) {
      recommendations.push(
        `Consider dropping unused indexes to save space: ${unusedIndexes.slice(0, 3).map(idx => `${idx.indexName} (${idx.sizeMB}MB)`).join(', ')}`
      );
    }

    // Check for frequently used tables without good indexes
    const heavilyQueriedTables = indexMetrics
      .filter(idx => idx.usageCategory === 'Frequently used')
      .reduce((acc, idx) => {
        acc[idx.tableName] = (acc[idx.tableName] || 0) + idx.scans;
        return acc;
      }, {} as Record<string, number>);

    Object.entries(heavilyQueriedTables).forEach(([table, scans]) => {
      if (scans > 10000) {
        recommendations.push(
          `Table ${table} is heavily queried (${scans} index scans) - monitor for additional optimization opportunities`
        );
      }
    });

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push(
        'Database performance looks good. Continue monitoring materialized view refresh patterns and query performance.'
      );
    }

    return recommendations;
  }

  /**
   * Get dashboard-specific performance metrics
   */
  async getDashboardPerformanceMetrics() {
    try {
      const metrics = await this.prisma.$queryRaw<Array<{
        metric_name: string;
        metric_value: number;
        metric_unit: string;
        measured_at: Date;
      }>>`
        WITH dashboard_metrics AS (
          SELECT 
            'materialized_view_count' as metric_name,
            5::numeric as metric_value,
            'count' as metric_unit,
            NOW() as measured_at
          
          UNION ALL
          
          SELECT 
            'last_refresh_age_minutes' as metric_name,
            COALESCE(
              EXTRACT(MINUTES FROM (NOW() - MAX(refreshed_at))),
              999
            ) as metric_value,
            'minutes' as metric_unit,
            NOW() as measured_at
          FROM mv_refresh_log 
          WHERE success = true
          
          UNION ALL
          
          SELECT 
            'avg_refresh_time_seconds' as metric_name,
            COALESCE(AVG(duration_ms) / 1000.0, 0) as metric_value,
            'seconds' as metric_unit,
            NOW() as measured_at
          FROM mv_refresh_log 
          WHERE success = true
            AND refreshed_at >= NOW() - INTERVAL '24 hours'
          
          UNION ALL
          
          SELECT 
            'refresh_success_rate' as metric_name,
            COALESCE(
              (COUNT(CASE WHEN success = true THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)),
              0
            ) as metric_value,
            'percentage' as metric_unit,
            NOW() as measured_at
          FROM mv_refresh_log 
          WHERE refreshed_at >= NOW() - INTERVAL '24 hours'
        )
        SELECT * FROM dashboard_metrics
      `;

      return metrics.map(row => ({
        metricName: row.metric_name,
        value: Number(row.metric_value),
        unit: row.metric_unit,
        measuredAt: row.measured_at,
      }));
    } catch (error) {
      console.error('Error getting dashboard performance metrics:', error);
      return [];
    }
  }
}