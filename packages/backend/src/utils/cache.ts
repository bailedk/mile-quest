/**
 * Simple in-memory cache with TTL for BE-015
 * This is a temporary solution until Redis/ElastiCache is added to infrastructure
 */

interface CacheItem<T> {
  value: T;
  expires: number;
}

export class SimpleCache {
  private cache = new Map<string, CacheItem<any>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(cleanupIntervalMs = 60000) { // Clean up every minute
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, cleanupIntervalMs);
  }

  /**
   * Get a value from cache
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // Check if expired
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }

    return item.value as T;
  }

  /**
   * Set a value in cache with TTL
   */
  set<T>(key: string, value: T, ttlSeconds: number): void {
    const expires = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expires });
  }

  /**
   * Delete a value from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Stop the cleanup interval (for testing)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }

  /**
   * Get cache size (for monitoring)
   */
  size(): number {
    return this.cache.size;
  }
}

// Create a singleton instance
export const cache = new SimpleCache();

/**
 * Cache key builders for consistent key generation
 */
export const cacheKeys = {
  userStats: (userId: string) => `user:stats:${userId}`,
  teamProgress: (teamId: string) => `team:progress:${teamId}`,
  activitySummary: (userId: string, period: string, teamId?: string) => 
    `activity:summary:${userId}:${period}${teamId ? `:${teamId}` : ''}`,
};

/**
 * Cache TTL values in seconds
 */
export const cacheTTL = {
  userStats: 300, // 5 minutes
  teamProgress: 300, // 5 minutes
  activitySummary: 600, // 10 minutes
};