/**
 * Materialized Views Service - DB-008
 * Manages dashboard materialized views refresh and monitoring
 */

import { PrismaClient } from '@prisma/client';
import { cache, cacheKeys, cacheTTL } from '../../utils/cache';

export interface MaterializedViewRefreshResult {
  viewName: string;
  success: boolean;
  durationMs: number;
  error?: string;
}

export interface MaterializedViewStats {
  viewName: string;
  lastRefreshed: Date | null;
  rowCount: number;
  sizeBytes: number;
  refreshFrequency: string;
}

export class MaterializedViewsService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Available materialized views for dashboard optimization
   */
  private readonly materializedViews = [
    'mv_user_activity_stats',
    'mv_team_activity_stats', 
    'mv_team_member_leaderboard',
    'mv_global_leaderboard',
    'mv_team_goal_progress'
  ];

  /**
   * Refresh all dashboard materialized views
   */
  async refreshAllViews(): Promise<MaterializedViewRefreshResult[]> {
    const results: MaterializedViewRefreshResult[] = [];
    
    for (const viewName of this.materializedViews) {
      const result = await this.refreshView(viewName);
      results.push(result);
    }

    // Clear related caches after refresh
    this.clearDashboardCaches();
    
    return results;
  }

  /**
   * Refresh a specific materialized view
   */
  async refreshView(viewName: string): Promise<MaterializedViewRefreshResult> {
    const startTime = Date.now();
    
    try {
      // Use CONCURRENTLY for production to avoid locking
      await this.prisma.$executeRawUnsafe(
        `REFRESH MATERIALIZED VIEW CONCURRENTLY ${viewName}`
      );
      
      const durationMs = Date.now() - startTime;
      
      // Log the refresh
      await this.logRefresh(viewName, 'manual', durationMs, true);
      
      return {
        viewName,
        success: true,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Log the failed refresh
      await this.logRefresh(viewName, 'manual', durationMs, false, errorMessage);
      
      return {
        viewName,
        success: false,
        durationMs,
        error: errorMessage,
      };
    }
  }

  /**
   * Refresh views that are stale (based on activity)
   */
  async refreshStaleViews(): Promise<MaterializedViewRefreshResult[]> {
    // Check for recent activity that would make views stale
    const recentActivityCount = await this.prisma.activity.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
        },
      },
    });

    // If no recent activity, skip refresh
    if (recentActivityCount === 0) {
      return [];
    }

    // Check last refresh times
    const staleViews = await this.getStaleViews();
    
    if (staleViews.length === 0) {
      return [];
    }

    const results: MaterializedViewRefreshResult[] = [];
    
    for (const viewName of staleViews) {
      const result = await this.refreshView(viewName);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Get statistics for all materialized views
   */
  async getViewStatistics(): Promise<MaterializedViewStats[]> {
    const stats: MaterializedViewStats[] = [];
    
    for (const viewName of this.materializedViews) {
      const viewStat = await this.getViewStatistic(viewName);
      stats.push(viewStat);
    }
    
    return stats;
  }

  /**
   * Get optimized user activity stats from materialized view
   */
  async getUserActivityStats(userId: string) {
    const cacheKey = `mv_user_stats:${userId}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const stats = await this.prisma.$queryRaw<Array<{
      user_id: string;
      total_distance: number;
      total_activities: number;
      total_duration: number;
      best_distance: number;
      last_activity_date: Date | null;
      week_distance: number;
      week_activities: number;
      month_distance: number;
      month_activities: number;
      public_total_distance: number;
      public_total_activities: number;
      public_avg_distance: number;
      has_private_activities: boolean;
    }>>`
      SELECT * FROM mv_user_activity_stats 
      WHERE user_id = ${userId}
    `;

    const result = stats[0] || null;
    
    // Cache for 5 minutes
    cache.set(cacheKey, result, 5 * 60 * 1000);
    
    return result;
  }

  /**
   * Get optimized team leaderboard from materialized view
   */
  async getTeamLeaderboard(teamId: string, limit: number = 50) {
    const cacheKey = `mv_team_leaderboard:${teamId}:${limit}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const leaderboard = await this.prisma.$queryRaw<Array<{
      team_id: string;
      user_id: string;
      user_name: string;
      user_avatar: string | null;
      team_role: string;
      total_distance: number;
      total_activities: number;
      avg_distance: number;
      public_distance: number;
      public_activities: number;
      public_avg_distance: number;
      has_private_activities: boolean;
      last_public_activity: Date | null;
      last_activity: Date | null;
      week_distance: number;
      month_distance: number;
      week_public_distance: number;
      month_public_distance: number;
      public_rank: number;
      total_rank: number;
    }>>`
      SELECT * FROM mv_team_member_leaderboard 
      WHERE team_id = ${teamId}
      ORDER BY public_rank
      LIMIT ${limit}
    `;

    // Cache for 5 minutes
    cache.set(cacheKey, leaderboard, 5 * 60 * 1000);
    
    return leaderboard;
  }

  /**
   * Get optimized global leaderboard from materialized view
   */
  async getGlobalLeaderboard(period: 'all' | 'week' | 'month' = 'all', limit: number = 50) {
    const cacheKey = `mv_global_leaderboard:${period}:${limit}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    let orderBy = 'global_rank';
    if (period === 'week') orderBy = 'week_rank';
    if (period === 'month') orderBy = 'month_rank';

    const leaderboard = await this.prisma.$queryRaw<Array<{
      user_id: string;
      user_name: string;
      user_avatar: string | null;
      total_distance: number;
      total_activities: number;
      avg_distance: number;
      has_private_activities: boolean;
      last_activity: Date | null;
      week_distance: number;
      month_distance: number;
      week_activities: number;
      month_activities: number;
      global_rank: number;
      week_rank: number;
      month_rank: number;
    }>>`
      SELECT * FROM mv_global_leaderboard 
      ORDER BY ${orderBy}
      LIMIT ${limit}
    `;

    // Cache for 5 minutes
    cache.set(cacheKey, leaderboard, 5 * 60 * 1000);
    
    return leaderboard;
  }

  /**
   * Get optimized team goal progress from materialized view
   */
  async getTeamGoalProgress(goalId: string) {
    const cacheKey = `mv_goal_progress:${goalId}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const progress = await this.prisma.$queryRaw<Array<{
      goal_id: string;
      team_id: string;
      goal_name: string;
      target_distance: number;
      goal_status: string;
      target_date: Date | null;
      started_at: Date | null;
      current_distance: number;
      total_activities: number;
      total_duration: number;
      percent_complete: number;
      days_remaining: number | null;
      last_activity_date: Date | null;
      active_members: number;
      is_on_track: boolean | null;
    }>>`
      SELECT * FROM mv_team_goal_progress 
      WHERE goal_id = ${goalId}
    `;

    const result = progress[0] || null;
    
    // Cache for 2 minutes (goal progress changes more frequently)
    cache.set(cacheKey, result, 2 * 60 * 1000);
    
    return result;
  }

  /**
   * Schedule automatic refresh based on activity patterns
   */
  async scheduleAutomaticRefresh(): Promise<void> {
    // This would typically be called from a cron job or scheduler
    // Check for recent activity and refresh accordingly
    
    const recentActivity = await this.prisma.activity.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 15 * 60 * 1000), // Last 15 minutes
        },
      },
    });

    if (recentActivity > 0) {
      console.log(`Found ${recentActivity} recent activities, refreshing materialized views`);
      await this.refreshAllViews();
    }
  }

  /**
   * Clear dashboard-related caches
   */
  private clearDashboardCaches(): void {
    // Clear cache patterns
    cache.clear(); // For simplicity, clear all caches
    // In production, you might want to be more selective:
    // cache.clearPattern('dashboard:*');
    // cache.clearPattern('mv_*');
    // cache.clearPattern('leaderboard:*');
  }

  /**
   * Get views that are stale and need refresh
   */
  private async getStaleViews(): Promise<string[]> {
    const staleThreshold = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
    
    const staleViews = await this.prisma.$queryRaw<Array<{ view_name: string }>>`
      SELECT DISTINCT view_name 
      FROM mv_refresh_log 
      WHERE view_name = ANY(${this.materializedViews})
        AND refreshed_at < ${staleThreshold}
      
      UNION
      
      SELECT unnest(${this.materializedViews}::text[]) as view_name
      WHERE NOT EXISTS (
        SELECT 1 FROM mv_refresh_log 
        WHERE view_name = ANY(${this.materializedViews})
      )
    `;

    return staleViews.map(v => v.view_name);
  }

  /**
   * Get statistics for a specific materialized view
   */
  private async getViewStatistic(viewName: string): Promise<MaterializedViewStats> {
    // Get last refresh time
    const lastRefresh = await this.prisma.$queryRaw<Array<{ refreshed_at: Date }>>`
      SELECT refreshed_at 
      FROM mv_refresh_log 
      WHERE view_name = ${viewName} 
        AND success = true
      ORDER BY refreshed_at DESC 
      LIMIT 1
    `;

    // Get view size and row count
    const sizeInfo = await this.prisma.$queryRaw<Array<{
      row_count: bigint;
      size_bytes: bigint;
    }>>`
      SELECT 
        (SELECT COUNT(*) FROM ${viewName}) as row_count,
        pg_total_relation_size('${viewName}') as size_bytes
    `;

    return {
      viewName,
      lastRefreshed: lastRefresh[0]?.refreshed_at || null,
      rowCount: Number(sizeInfo[0]?.row_count || 0),
      sizeBytes: Number(sizeInfo[0]?.size_bytes || 0),
      refreshFrequency: 'On-demand', // Could be made configurable
    };
  }

  /**
   * Log materialized view refresh
   */
  private async logRefresh(
    viewName: string,
    refreshType: string,
    durationMs: number,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        INSERT INTO mv_refresh_log (view_name, refresh_type, refreshed_at, duration_ms, success, error_message)
        VALUES (${viewName}, ${refreshType}, NOW(), ${durationMs}, ${success}, ${errorMessage || null})
      `;
    } catch (error) {
      console.error('Failed to log materialized view refresh:', error);
    }
  }
}