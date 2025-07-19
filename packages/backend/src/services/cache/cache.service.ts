/**
 * Advanced Cache Service - BE-701
 * High-level caching service with multiple strategies and performance optimization
 */

import { CacheProvider, CacheOptions, CacheStats, CacheMetrics, HybridCacheConfig } from './types';
import { cacheTTL, cacheKeys } from './constants';

export class CacheService {
  private provider: CacheProvider;
  private hybridConfig?: HybridCacheConfig;
  private metrics: CacheMetrics[] = [];
  private maxMetricsHistory = 1000;

  constructor(provider: CacheProvider, hybridConfig?: HybridCacheConfig) {
    this.provider = provider;
    this.hybridConfig = hybridConfig;
  }

  /**
   * Get value from cache with automatic JSON parsing
   */
  async get<T>(key: string): Promise<T | null> {
    const start = Date.now();
    
    try {
      // Try L1 cache first if hybrid
      if (this.hybridConfig) {
        const l1Result = await this.hybridConfig.l1.get<T>(key);
        if (l1Result !== null) {
          this.recordMetric('get', start, true, key, 'l1-hit');
          return l1Result;
        }

        // Fallback to L2 cache
        const l2Result = await this.hybridConfig.l2.get<T>(key);
        if (l2Result !== null) {
          // Populate L1 cache
          const l1TTL = this.hybridConfig.l1TTL || 300;
          await this.hybridConfig.l1.set(key, l2Result, l1TTL);
          this.recordMetric('get', start, true, key, 'l2-hit');
          return l2Result;
        }

        this.recordMetric('get', start, false, key, 'cache-miss');
        return null;
      }

      // Single cache provider
      const result = await this.provider.get<T>(key);
      this.recordMetric('get', start, result !== null, key, result ? 'cache-hit' : 'cache-miss');
      return result;
    } catch (error) {
      this.recordMetric('get', start, false, key, 'error', error as Error);
      throw error;
    }
  }

  /**
   * Set value in cache with automatic JSON serialization
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const start = Date.now();
    
    try {
      if (this.hybridConfig) {
        const { syncStrategy = 'write-through' } = this.hybridConfig;

        switch (syncStrategy) {
          case 'write-through':
            // Write to both L1 and L2
            await Promise.all([
              this.hybridConfig.l1.set(key, value, this.hybridConfig.l1TTL || ttlSeconds),
              this.hybridConfig.l2.set(key, value, ttlSeconds)
            ]);
            break;

          case 'write-behind':
            // Write to L1 immediately, L2 asynchronously
            await this.hybridConfig.l1.set(key, value, this.hybridConfig.l1TTL || ttlSeconds);
            // Don't await L2 write
            this.hybridConfig.l2.set(key, value, ttlSeconds).catch(error => {
              console.error('L2 cache write-behind failed:', error);
            });
            break;

          case 'write-around':
            // Write only to L2, bypass L1
            await this.hybridConfig.l2.set(key, value, ttlSeconds);
            break;
        }
      } else {
        await this.provider.set(key, value, ttlSeconds);
      }

      this.recordMetric('set', start, true, key);
    } catch (error) {
      this.recordMetric('set', start, false, key, 'error', error as Error);
      throw error;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    const start = Date.now();
    
    try {
      if (this.hybridConfig) {
        await Promise.all([
          this.hybridConfig.l1.delete(key),
          this.hybridConfig.l2.delete(key)
        ]);
      } else {
        await this.provider.delete(key);
      }

      this.recordMetric('delete', start, true, key);
    } catch (error) {
      this.recordMetric('delete', start, false, key, 'error', error as Error);
      throw error;
    }
  }

  /**
   * Clear entire cache
   */
  async clear(): Promise<void> {
    const start = Date.now();
    
    try {
      if (this.hybridConfig) {
        await Promise.all([
          this.hybridConfig.l1.clear(),
          this.hybridConfig.l2.clear()
        ]);
      } else {
        await this.provider.clear();
      }

      this.recordMetric('clear', start, true);
    } catch (error) {
      this.recordMetric('clear', start, false, '', 'error', error as Error);
      throw error;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (this.hybridConfig) {
      const l1Exists = await this.hybridConfig.l1.exists(key);
      if (l1Exists) return true;
      return await this.hybridConfig.l2.exists(key);
    }
    
    return await this.provider.exists(key);
  }

  /**
   * Set TTL for existing key
   */
  async expire(key: string, ttlSeconds: number): Promise<void> {
    if (this.hybridConfig) {
      await Promise.all([
        this.hybridConfig.l1.expire(key, Math.min(ttlSeconds, this.hybridConfig.l1TTL || ttlSeconds)),
        this.hybridConfig.l2.expire(key, ttlSeconds)
      ]);
    } else {
      await this.provider.expire(key, ttlSeconds);
    }
  }

  /**
   * Get TTL for key
   */
  async ttl(key: string): Promise<number> {
    // For hybrid cache, return L2 TTL as it's the authoritative source
    if (this.hybridConfig) {
      return await this.hybridConfig.l2.ttl(key);
    }
    
    return await this.provider.ttl(key);
  }

  /**
   * Get multiple values
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const start = Date.now();
    
    try {
      if (this.hybridConfig) {
        // Get from L1 first
        const l1Results = await this.hybridConfig.l1.mget<T>(keys);
        const missingKeys: string[] = [];
        const missingIndexes: number[] = [];

        l1Results.forEach((result, index) => {
          if (result === null) {
            missingKeys.push(keys[index]);
            missingIndexes.push(index);
          }
        });

        if (missingKeys.length > 0) {
          // Get missing keys from L2
          const l2Results = await this.hybridConfig.l2.mget<T>(missingKeys);
          
          // Populate L1 with L2 results
          const l1Updates: Record<string, T> = {};
          l2Results.forEach((result, index) => {
            if (result !== null) {
              const key = missingKeys[index];
              l1Updates[key] = result;
              l1Results[missingIndexes[index]] = result;
            }
          });

          if (Object.keys(l1Updates).length > 0) {
            await this.hybridConfig.l1.mset(l1Updates, this.hybridConfig.l1TTL);
          }
        }

        this.recordMetric('mget', start, true);
        return l1Results;
      }

      const results = await this.provider.mget<T>(keys);
      this.recordMetric('mget', start, true);
      return results;
    } catch (error) {
      this.recordMetric('mget', start, false, '', 'error', error as Error);
      throw error;
    }
  }

  /**
   * Set multiple values
   */
  async mset<T>(keyValues: Record<string, T>, ttlSeconds?: number): Promise<void> {
    const start = Date.now();
    
    try {
      if (this.hybridConfig) {
        await Promise.all([
          this.hybridConfig.l1.mset(keyValues, this.hybridConfig.l1TTL || ttlSeconds),
          this.hybridConfig.l2.mset(keyValues, ttlSeconds)
        ]);
      } else {
        await this.provider.mset(keyValues, ttlSeconds);
      }

      this.recordMetric('mset', start, true);
    } catch (error) {
      this.recordMetric('mset', start, false, '', 'error', error as Error);
      throw error;
    }
  }

  /**
   * Increment counter
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    // For hybrid cache, only use L2 for counters to ensure consistency
    if (this.hybridConfig) {
      return await this.hybridConfig.l2.increment(key, amount);
    }
    
    return await this.provider.increment(key, amount);
  }

  /**
   * Decrement counter
   */
  async decrement(key: string, amount: number = 1): Promise<number> {
    // For hybrid cache, only use L2 for counters to ensure consistency
    if (this.hybridConfig) {
      return await this.hybridConfig.l2.decrement(key, amount);
    }
    
    return await this.provider.decrement(key, amount);
  }

  /**
   * Cache-aside pattern: get or compute value
   */
  async getOrSet<T>(
    key: string,
    computeFn: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Compute value if not in cache
    const computed = await computeFn();
    
    // Store in cache
    await this.set(key, computed, ttlSeconds);
    
    return computed;
  }

  /**
   * Cache-aside pattern with lock to prevent cache stampede
   */
  async getOrSetWithLock<T>(
    key: string,
    computeFn: () => Promise<T>,
    ttlSeconds?: number,
    lockTimeoutMs: number = 30000
  ): Promise<T> {
    const lockKey = `lock:${key}`;
    const lockValue = `${Date.now()}-${Math.random()}`;
    
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Try to acquire lock
    const lockAcquired = await this.tryLock(lockKey, lockValue, Math.floor(lockTimeoutMs / 1000));
    
    if (!lockAcquired) {
      // Wait and try cache again (another process might have computed it)
      await new Promise(resolve => setTimeout(resolve, 100));
      const retryCache = await this.get<T>(key);
      if (retryCache !== null) {
        return retryCache;
      }
      
      // If still not in cache, compute anyway (lock timeout or failure)
      return await computeFn();
    }

    try {
      // Double-check cache after acquiring lock
      const doubleCheck = await this.get<T>(key);
      if (doubleCheck !== null) {
        return doubleCheck;
      }

      // Compute and cache value
      const computed = await computeFn();
      await this.set(key, computed, ttlSeconds);
      
      return computed;
    } finally {
      // Release lock
      await this.releaseLock(lockKey, lockValue);
    }
  }

  /**
   * Invalidate cache by pattern (Redis only)
   */
  async invalidatePattern(pattern: string): Promise<void> {
    // This would require Redis KEYS or SCAN command
    // For now, just clear all cache as a fallback
    console.warn(`Pattern invalidation not implemented, clearing all cache. Pattern: ${pattern}`);
    await this.clear();
  }

  /**
   * Get comprehensive cache statistics
   */
  async getStats(): Promise<{
    primary: CacheStats;
    l1?: CacheStats;
    l2?: CacheStats;
    metrics: {
      totalOperations: number;
      averageLatency: number;
      errorRate: number;
      recentErrors: string[];
    };
  }> {
    const primary = await this.provider.getStats();
    
    const result: any = { primary };

    if (this.hybridConfig) {
      result.l1 = await this.hybridConfig.l1.getStats();
      result.l2 = await this.hybridConfig.l2.getStats();
    }

    // Calculate metrics from recent history
    const recentMetrics = this.metrics.slice(-100); // Last 100 operations
    const totalOps = recentMetrics.length;
    const avgLatency = totalOps > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / totalOps 
      : 0;
    const errors = recentMetrics.filter(m => !m.success);
    const errorRate = totalOps > 0 ? (errors.length / totalOps) * 100 : 0;

    result.metrics = {
      totalOperations: totalOps,
      averageLatency: Math.round(avgLatency * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      recentErrors: errors.slice(-5).map(e => e.error || 'Unknown error'),
    };

    return result;
  }

  /**
   * Close cache connections
   */
  async close(): Promise<void> {
    if (this.hybridConfig) {
      await Promise.all([
        this.hybridConfig.l1.close(),
        this.hybridConfig.l2.close()
      ]);
    } else {
      await this.provider.close();
    }
  }

  /**
   * Try to acquire a distributed lock
   */
  private async tryLock(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    try {
      const existing = await this.get(key);
      if (existing === null) {
        await this.set(key, value, ttlSeconds);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Release a distributed lock
   */
  private async releaseLock(key: string, expectedValue: string): Promise<void> {
    try {
      const current = await this.get<string>(key);
      if (current === expectedValue) {
        await this.delete(key);
      }
    } catch (error) {
      console.error('Failed to release lock:', error);
    }
  }

  /**
   * Record performance metrics
   */
  private recordMetric(
    operation: string,
    startTime: number,
    success: boolean,
    key: string = '',
    details?: string,
    error?: Error
  ): void {
    const metric: CacheMetrics = {
      timestamp: new Date(),
      provider: this.hybridConfig ? 'hybrid' : 'single',
      operation,
      duration: Date.now() - startTime,
      success,
      keySize: key.length,
      error: error?.message,
    };

    this.metrics.push(metric);
    
    // Keep metrics history limited
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }

    // Log performance issues in development
    if (process.env.NODE_ENV === 'development') {
      if (!success && error) {
        console.warn(`Cache ${operation} failed for key "${key}":`, error.message);
      } else if (metric.duration > 1000) {
        console.warn(`Slow cache ${operation} for key "${key}": ${metric.duration}ms`);
      }
    }
  }
}