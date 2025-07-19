/**
 * Materialized Views Scheduler Service - DB-008
 * Manages automated refresh scheduling for materialized views
 */

import { PrismaClient } from '@prisma/client';
import { MaterializedViewsService } from '../materialized-views/materialized-views.service';
import { PerformanceMonitoringService } from '../performance-monitoring/performance.service';

export interface RefreshStrategy {
  viewName: string;
  refreshIntervalMinutes: number;
  condition?: 'always' | 'on_activity' | 'scheduled';
  priority: 'high' | 'medium' | 'low';
}

export interface SchedulerConfig {
  enabled: boolean;
  strategies: RefreshStrategy[];
  maxConcurrentRefreshes: number;
  activityThreshold: number; // Minimum activities to trigger refresh
  quietHours: {
    start: number; // 0-23 hour
    end: number;   // 0-23 hour
  };
}

export class MaterializedViewsSchedulerService {
  private config: SchedulerConfig;
  private isRunning = false;
  private refreshQueue: RefreshStrategy[] = [];

  constructor(
    private prisma: PrismaClient,
    private materializedViewsService: MaterializedViewsService,
    private performanceService: PerformanceMonitoringService,
    config?: Partial<SchedulerConfig>
  ) {
    this.config = {
      enabled: true,
      maxConcurrentRefreshes: 2,
      activityThreshold: 5,
      quietHours: {
        start: 2,  // 2 AM
        end: 6,    // 6 AM
      },
      strategies: [
        {
          viewName: 'mv_user_activity_stats',
          refreshIntervalMinutes: 15,
          condition: 'on_activity',
          priority: 'high',
        },
        {
          viewName: 'mv_team_activity_stats',
          refreshIntervalMinutes: 10,
          condition: 'on_activity',
          priority: 'high',
        },
        {
          viewName: 'mv_team_member_leaderboard',
          refreshIntervalMinutes: 20,
          condition: 'on_activity',
          priority: 'medium',
        },
        {
          viewName: 'mv_global_leaderboard',
          refreshIntervalMinutes: 30,
          condition: 'on_activity',
          priority: 'medium',
        },
        {
          viewName: 'mv_team_goal_progress',
          refreshIntervalMinutes: 5,
          condition: 'on_activity',
          priority: 'high',
        },
      ],
      ...config,
    };
  }

  /**
   * Start the automated scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Materialized views scheduler is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting materialized views scheduler');

    // Initial refresh of all views
    await this.performInitialRefresh();

    // Set up periodic check interval (every 5 minutes)
    setInterval(async () => {
      if (this.isRunning) {
        await this.checkAndRefreshViews();
      }
    }, 5 * 60 * 1000);

    console.log('Materialized views scheduler started successfully');
  }

  /**
   * Stop the automated scheduler
   */
  stop(): void {
    this.isRunning = false;
    this.refreshQueue = [];
    console.log('Materialized views scheduler stopped');
  }

  /**
   * Force refresh of all views (ignoring schedule)
   */
  async forceRefreshAll(): Promise<void> {
    console.log('Force refreshing all materialized views');
    const results = await this.materializedViewsService.refreshAllViews();
    
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      console.error('Some views failed to refresh:', failures);
    } else {
      console.log('All materialized views refreshed successfully');
    }
  }

  /**
   * Get scheduler status and statistics
   */
  async getSchedulerStatus() {
    const [lastRefreshes, recentActivity, queueStatus] = await Promise.all([
      this.getLastRefreshTimes(),
      this.getRecentActivityCount(),
      this.getQueueStatus(),
    ]);

    return {
      isRunning: this.isRunning,
      config: this.config,
      lastRefreshes,
      recentActivity,
      queueStatus,
      nextScheduledCheck: this.getNextScheduledCheck(),
    };
  }

  /**
   * Update scheduler configuration
   */
  updateConfig(newConfig: Partial<SchedulerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Scheduler configuration updated');
  }

  /**
   * Perform initial refresh when scheduler starts
   */
  private async performInitialRefresh(): Promise<void> {
    try {
      console.log('Performing initial materialized views refresh');
      
      // Check if any views are very stale (more than 1 hour)
      const staleViews = await this.getStaleViews(60); // 60 minutes
      
      if (staleViews.length > 0) {
        console.log(`Found ${staleViews.length} stale views, refreshing:`, staleViews);
        
        for (const viewName of staleViews) {
          await this.materializedViewsService.refreshView(viewName);
        }
      } else {
        console.log('All materialized views are up to date');
      }
    } catch (error) {
      console.error('Error during initial refresh:', error);
    }
  }

  /**
   * Main scheduler logic - check and refresh views based on strategies
   */
  private async checkAndRefreshViews(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Skip during quiet hours
    if (this.isQuietHours()) {
      return;
    }

    try {
      // Get recent activity count
      const recentActivityCount = await this.getRecentActivityCount();
      
      // Process each refresh strategy
      for (const strategy of this.config.strategies) {
        if (await this.shouldRefreshView(strategy, recentActivityCount)) {
          this.addToRefreshQueue(strategy);
        }
      }

      // Process refresh queue
      await this.processRefreshQueue();
    } catch (error) {
      console.error('Error in scheduler check:', error);
    }
  }

  /**
   * Determine if a view should be refreshed based on strategy
   */
  private async shouldRefreshView(
    strategy: RefreshStrategy,
    recentActivityCount: number
  ): Promise<boolean> {
    // Check if view was refreshed recently
    const lastRefresh = await this.getLastRefreshTime(strategy.viewName);
    const minutesSinceRefresh = lastRefresh
      ? (Date.now() - lastRefresh.getTime()) / (1000 * 60)
      : Infinity;

    // If interval hasn't passed, don't refresh
    if (minutesSinceRefresh < strategy.refreshIntervalMinutes) {
      return false;
    }

    // Apply condition-based logic
    switch (strategy.condition) {
      case 'always':
        return true;

      case 'on_activity':
        return recentActivityCount >= this.config.activityThreshold;

      case 'scheduled':
        // For scheduled refreshes, check if it's time
        return minutesSinceRefresh >= strategy.refreshIntervalMinutes;

      default:
        return false;
    }
  }

  /**
   * Add view to refresh queue
   */
  private addToRefreshQueue(strategy: RefreshStrategy): void {
    // Check if already in queue
    const alreadyQueued = this.refreshQueue.some(
      item => item.viewName === strategy.viewName
    );

    if (!alreadyQueued) {
      this.refreshQueue.push(strategy);
      console.log(`Added ${strategy.viewName} to refresh queue`);
    }
  }

  /**
   * Process the refresh queue with concurrency limits
   */
  private async processRefreshQueue(): Promise<void> {
    if (this.refreshQueue.length === 0) {
      return;
    }

    // Sort queue by priority (high -> medium -> low)
    this.refreshQueue.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    // Process up to maxConcurrentRefreshes items
    const toProcess = this.refreshQueue.splice(0, this.config.maxConcurrentRefreshes);
    
    console.log(`Processing ${toProcess.length} materialized view refreshes`);

    const refreshPromises = toProcess.map(async (strategy) => {
      try {
        const result = await this.materializedViewsService.refreshView(strategy.viewName);
        
        if (result.success) {
          console.log(`Successfully refreshed ${strategy.viewName} in ${result.durationMs}ms`);
        } else {
          console.error(`Failed to refresh ${strategy.viewName}: ${result.error}`);
        }
        
        return result;
      } catch (error) {
        console.error(`Error refreshing ${strategy.viewName}:`, error);
        return {
          viewName: strategy.viewName,
          success: false,
          durationMs: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    await Promise.all(refreshPromises);
  }

  /**
   * Check if current time is during quiet hours
   */
  private isQuietHours(): boolean {
    const now = new Date();
    const currentHour = now.getHours();
    
    const { start, end } = this.config.quietHours;
    
    if (start <= end) {
      return currentHour >= start && currentHour < end;
    } else {
      // Quiet hours span midnight (e.g., 22:00 to 06:00)
      return currentHour >= start || currentHour < end;
    }
  }

  /**
   * Get recent activity count (last 15 minutes)
   */
  private async getRecentActivityCount(): Promise<number> {
    try {
      const count = await this.prisma.activity.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 15 * 60 * 1000), // Last 15 minutes
          },
        },
      });
      return count;
    } catch (error) {
      console.error('Error getting recent activity count:', error);
      return 0;
    }
  }

  /**
   * Get views that are stale (older than specified minutes)
   */
  private async getStaleViews(thresholdMinutes: number): Promise<string[]> {
    try {
      const staleViews = await this.prisma.$queryRaw<Array<{ view_name: string }>>`
        SELECT DISTINCT view_name 
        FROM mv_refresh_log 
        WHERE success = true
          AND refreshed_at < NOW() - INTERVAL '${thresholdMinutes} minutes'
          AND view_name LIKE 'mv_%'
        
        UNION
        
        SELECT unnest(ARRAY[
          'mv_user_activity_stats',
          'mv_team_activity_stats',
          'mv_team_member_leaderboard',
          'mv_global_leaderboard',
          'mv_team_goal_progress'
        ]) as view_name
        WHERE NOT EXISTS (
          SELECT 1 FROM mv_refresh_log 
          WHERE view_name LIKE 'mv_%' AND success = true
        )
      `;

      return staleViews.map(v => v.view_name);
    } catch (error) {
      console.error('Error getting stale views:', error);
      return [];
    }
  }

  /**
   * Get last refresh time for a specific view
   */
  private async getLastRefreshTime(viewName: string): Promise<Date | null> {
    try {
      const result = await this.prisma.mv_refresh_log.findFirst({
        where: {
          view_name: viewName,
          success: true,
        },
        orderBy: {
          refreshed_at: 'desc',
        },
        select: {
          refreshed_at: true,
        },
      });

      return result?.refreshed_at || null;
    } catch (error) {
      console.error(`Error getting last refresh time for ${viewName}:`, error);
      return null;
    }
  }

  /**
   * Get last refresh times for all views
   */
  private async getLastRefreshTimes(): Promise<Record<string, Date | null>> {
    const result: Record<string, Date | null> = {};
    
    for (const strategy of this.config.strategies) {
      result[strategy.viewName] = await this.getLastRefreshTime(strategy.viewName);
    }
    
    return result;
  }

  /**
   * Get queue status
   */
  private getQueueStatus() {
    return {
      queueLength: this.refreshQueue.length,
      queuedViews: this.refreshQueue.map(item => ({
        viewName: item.viewName,
        priority: item.priority,
      })),
    };
  }

  /**
   * Get next scheduled check time
   */
  private getNextScheduledCheck(): Date {
    const now = new Date();
    const nextCheck = new Date(now.getTime() + 5 * 60 * 1000); // Next 5-minute interval
    return nextCheck;
  }

  /**
   * Manual refresh of a specific view (bypasses queue)
   */
  async manualRefresh(viewName: string): Promise<void> {
    console.log(`Manual refresh requested for ${viewName}`);
    const result = await this.materializedViewsService.refreshView(viewName);
    
    if (!result.success) {
      throw new Error(`Failed to refresh ${viewName}: ${result.error}`);
    }
    
    console.log(`Manual refresh of ${viewName} completed in ${result.durationMs}ms`);
  }

  /**
   * Get performance recommendations based on current refresh patterns
   */
  async getRefreshRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];
    
    try {
      // Analyze refresh patterns
      const refreshStats = await this.prisma.$queryRaw<Array<{
        view_name: string;
        avg_duration_ms: number;
        success_rate: number;
        refresh_count: number;
      }>>`
        SELECT 
          view_name,
          AVG(duration_ms) as avg_duration_ms,
          (COUNT(CASE WHEN success THEN 1 END) * 100.0 / COUNT(*)) as success_rate,
          COUNT(*) as refresh_count
        FROM mv_refresh_log 
        WHERE refreshed_at >= NOW() - INTERVAL '24 hours'
          AND view_name LIKE 'mv_%'
        GROUP BY view_name
      `;

      for (const stat of refreshStats) {
        const strategy = this.config.strategies.find(s => s.viewName === stat.view_name);
        
        if (!strategy) continue;

        // Check for slow refreshes
        if (Number(stat.avg_duration_ms) > 30000) {
          recommendations.push(
            `Consider optimizing ${stat.view_name} - average refresh time is ${Math.round(Number(stat.avg_duration_ms) / 1000)}s`
          );
        }

        // Check for low success rates
        if (Number(stat.success_rate) < 95) {
          recommendations.push(
            `Investigate refresh failures for ${stat.view_name} - success rate is ${Number(stat.success_rate).toFixed(1)}%`
          );
        }

        // Check for too frequent refreshes
        if (Number(stat.refresh_count) > 288) { // More than every 5 minutes for 24 hours
          recommendations.push(
            `${stat.view_name} may be refreshing too frequently (${stat.refresh_count} times in 24h) - consider increasing interval`
          );
        }
      }

      if (recommendations.length === 0) {
        recommendations.push('Materialized view refresh patterns look optimal');
      }

    } catch (error) {
      console.error('Error generating refresh recommendations:', error);
      recommendations.push('Unable to analyze refresh patterns');
    }

    return recommendations;
  }
}