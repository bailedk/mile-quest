/**
 * Advanced Cache Utility - BE-701
 * Upgraded from simple cache to advanced multi-layer caching with Redis support
 */

import { CacheFactory } from '../services/cache/factory';
import { CacheService } from '../services/cache/cache.service';

// Create cache service based on environment
export const cache = CacheFactory.createFromEnvironment();

// Legacy SimpleCache interface for backward compatibility
export class SimpleCache {
  private cacheService: CacheService;

  constructor(cleanupIntervalMs = 60000) {
    this.cacheService = CacheFactory.createCustom('in-memory', {
      defaultTTL: 300,
      enableMetrics: true,
    });
  }

  /**
   * Get a value from cache
   * @deprecated Use cache.get() instead
   */
  get<T>(key: string): T | null {
    // Convert async to sync for backward compatibility
    // In practice, you should migrate to async cache operations
    let result: T | null = null;
    this.cacheService.get<T>(key).then(value => {
      result = value;
    }).catch(() => {
      result = null;
    });
    return result;
  }

  /**
   * Set a value in cache with TTL
   * @deprecated Use cache.set() instead
   */
  set<T>(key: string, value: T, ttlSeconds: number): void {
    this.cacheService.set(key, value, ttlSeconds).catch(error => {
      console.error('Cache set error:', error);
    });
  }

  /**
   * Delete a value from cache
   * @deprecated Use cache.delete() instead
   */
  delete(key: string): void {
    this.cacheService.delete(key).catch(error => {
      console.error('Cache delete error:', error);
    });
  }

  /**
   * Clear all cache entries
   * @deprecated Use cache.clear() instead
   */
  clear(): void {
    this.cacheService.clear().catch(error => {
      console.error('Cache clear error:', error);
    });
  }

  /**
   * Stop the cleanup interval (for testing)
   * @deprecated Use cache.close() instead
   */
  destroy(): void {
    this.cacheService.close().catch(error => {
      console.error('Cache close error:', error);
    });
  }

  /**
   * Get cache size (for monitoring)
   * @deprecated Use cache.getStats() instead
   */
  size(): number {
    // This is a placeholder - the real implementation would be async
    return 0;
  }
}

/**
 * Cache key builders for consistent key generation
 */
export const cacheKeys = {
  userStats: (userId: string) => `user:stats:${userId}`,
  teamProgress: (teamId: string) => `team:progress:${teamId}`,
  activitySummary: (userId: string, period: string, teamId?: string) => 
    `activity:summary:${userId}:${period}${teamId ? `:${teamId}` : ''}`,
  userNotificationStats: (userId: string) => `notification:stats:${userId}`,
  userNotificationPreferences: (userId: string) => `notification:preferences:${userId}`,
  notificationTemplate: (key: string) => `notification:template:${key}`,
};

/**
 * Cache TTL values in seconds
 */
export const cacheTTL = {
  userStats: 300, // 5 minutes
  teamProgress: 300, // 5 minutes
  activitySummary: 600, // 10 minutes
  leaderboard: 900, // 15 minutes
  notificationStats: 300, // 5 minutes
  notificationPreferences: 1800, // 30 minutes
  notificationTemplate: 3600, // 1 hour
};