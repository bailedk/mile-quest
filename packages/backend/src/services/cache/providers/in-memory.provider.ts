/**
 * In-Memory Cache Provider - BE-701
 * Enhanced version of the existing cache with improved performance and monitoring
 */

import { CacheProvider, CacheOptions, CacheStats, CacheMetrics } from '../types';

interface CacheItem<T> {
  value: T;
  expires: number;
  size: number;
  accessed: number;
  created: number;
}

export class InMemoryCacheProvider implements CacheProvider {
  private cache = new Map<string, CacheItem<any>>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private options: Required<CacheOptions>;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    errors: 0,
    totalOperations: 0,
    totalLatency: 0,
  };

  constructor(options: CacheOptions = {}) {
    this.options = {
      defaultTTL: options.defaultTTL || 300,
      maxMemoryMB: options.maxMemoryMB || 100,
      compressionThreshold: options.compressionThreshold || 1024,
      enableCompression: options.enableCompression || false,
      keyPrefix: options.keyPrefix || '',
      enableMetrics: options.enableMetrics || true,
    };

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Clean up every minute
  }

  async get<T>(key: string): Promise<T | null> {
    const start = Date.now();
    const prefixedKey = this.getPrefixedKey(key);
    
    try {
      const item = this.cache.get(prefixedKey);
      
      if (!item) {
        this.recordMetric('get', start, false);
        this.stats.misses++;
        return null;
      }

      // Check if expired
      if (Date.now() > item.expires) {
        this.cache.delete(prefixedKey);
        this.recordMetric('get', start, false);
        this.stats.misses++;
        return null;
      }

      // Update access time for LRU tracking
      item.accessed = Date.now();
      this.recordMetric('get', start, true);
      this.stats.hits++;
      
      return item.value as T;
    } catch (error) {
      this.stats.errors++;
      this.recordMetric('get', start, false, error as Error);
      throw error;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const start = Date.now();
    const prefixedKey = this.getPrefixedKey(key);
    const ttl = ttlSeconds || this.options.defaultTTL;
    
    try {
      const serialized = JSON.stringify(value);
      const size = this.getStringSize(serialized);
      const expires = Date.now() + (ttl * 1000);
      const now = Date.now();

      // Check memory usage and evict if necessary
      await this.ensureMemoryLimit(size);

      this.cache.set(prefixedKey, {
        value,
        expires,
        size,
        accessed: now,
        created: now,
      });

      this.recordMetric('set', start, true, undefined, key.length, size);
    } catch (error) {
      this.stats.errors++;
      this.recordMetric('set', start, false, error as Error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const start = Date.now();
    const prefixedKey = this.getPrefixedKey(key);
    
    try {
      const existed = this.cache.delete(prefixedKey);
      this.recordMetric('delete', start, existed);
    } catch (error) {
      this.stats.errors++;
      this.recordMetric('delete', start, false, error as Error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    const start = Date.now();
    
    try {
      this.cache.clear();
      this.recordMetric('clear', start, true);
    } catch (error) {
      this.stats.errors++;
      this.recordMetric('clear', start, false, error as Error);
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    const start = Date.now();
    const prefixedKey = this.getPrefixedKey(key);
    
    try {
      const item = this.cache.get(prefixedKey);
      const exists = item ? Date.now() <= item.expires : false;
      
      if (item && !exists) {
        this.cache.delete(prefixedKey);
      }
      
      this.recordMetric('exists', start, true);
      return exists;
    } catch (error) {
      this.stats.errors++;
      this.recordMetric('exists', start, false, error as Error);
      throw error;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    const start = Date.now();
    const prefixedKey = this.getPrefixedKey(key);
    
    try {
      const item = this.cache.get(prefixedKey);
      if (item) {
        item.expires = Date.now() + (ttlSeconds * 1000);
        this.recordMetric('expire', start, true);
      } else {
        this.recordMetric('expire', start, false);
      }
    } catch (error) {
      this.stats.errors++;
      this.recordMetric('expire', start, false, error as Error);
      throw error;
    }
  }

  async ttl(key: string): Promise<number> {
    const start = Date.now();
    const prefixedKey = this.getPrefixedKey(key);
    
    try {
      const item = this.cache.get(prefixedKey);
      if (!item) {
        this.recordMetric('ttl', start, true);
        return -2; // Key doesn't exist
      }

      const remaining = Math.max(0, item.expires - Date.now());
      this.recordMetric('ttl', start, true);
      return Math.floor(remaining / 1000);
    } catch (error) {
      this.stats.errors++;
      this.recordMetric('ttl', start, false, error as Error);
      throw error;
    }
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const start = Date.now();
    
    try {
      const results = await Promise.all(keys.map(key => this.get<T>(key)));
      this.recordMetric('mget', start, true);
      return results;
    } catch (error) {
      this.stats.errors++;
      this.recordMetric('mget', start, false, error as Error);
      throw error;
    }
  }

  async mset<T>(keyValues: Record<string, T>, ttlSeconds?: number): Promise<void> {
    const start = Date.now();
    
    try {
      await Promise.all(
        Object.entries(keyValues).map(([key, value]) => 
          this.set(key, value, ttlSeconds)
        )
      );
      this.recordMetric('mset', start, true);
    } catch (error) {
      this.stats.errors++;
      this.recordMetric('mset', start, false, error as Error);
      throw error;
    }
  }

  async increment(key: string, amount: number = 1): Promise<number> {
    const start = Date.now();
    
    try {
      const current = await this.get<number>(key) || 0;
      const newValue = current + amount;
      await this.set(key, newValue);
      this.recordMetric('increment', start, true);
      return newValue;
    } catch (error) {
      this.stats.errors++;
      this.recordMetric('increment', start, false, error as Error);
      throw error;
    }
  }

  async decrement(key: string, amount: number = 1): Promise<number> {
    const start = Date.now();
    
    try {
      const current = await this.get<number>(key) || 0;
      const newValue = current - amount;
      await this.set(key, newValue);
      this.recordMetric('decrement', start, true);
      return newValue;
    } catch (error) {
      this.stats.errors++;
      this.recordMetric('decrement', start, false, error as Error);
      throw error;
    }
  }

  async getStats(): Promise<CacheStats> {
    const memoryUsed = this.calculateMemoryUsage();
    const maxMemory = this.options.maxMemoryMB * 1024 * 1024;
    
    return {
      provider: 'in-memory',
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: this.calculateHitRate(),
      keys: this.cache.size,
      memoryUsed,
      maxMemory,
      evictions: this.stats.evictions,
      errors: this.stats.errors,
      totalOperations: this.stats.totalOperations,
      averageLatency: this.calculateAverageLatency(),
    };
  }

  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let evicted = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key);
        evicted++;
      }
    }
    
    this.stats.evictions += evicted;
  }

  /**
   * Ensure memory usage stays within limits
   */
  private async ensureMemoryLimit(newItemSize: number): Promise<void> {
    const maxBytes = this.options.maxMemoryMB * 1024 * 1024;
    let currentUsage = this.calculateMemoryUsage();
    
    if (currentUsage + newItemSize <= maxBytes) {
      return;
    }

    // Evict LRU items until we have enough space
    const items = Array.from(this.cache.entries())
      .map(([key, item]) => ({ key, ...item }))
      .sort((a, b) => a.accessed - b.accessed);

    for (const item of items) {
      if (currentUsage + newItemSize <= maxBytes) {
        break;
      }
      
      this.cache.delete(item.key);
      currentUsage -= item.size;
      this.stats.evictions++;
    }
  }

  /**
   * Calculate total memory usage
   */
  private calculateMemoryUsage(): number {
    let total = 0;
    for (const item of this.cache.values()) {
      total += item.size;
    }
    return total;
  }

  /**
   * Get string size in bytes
   */
  private getStringSize(str: string): number {
    return Buffer.byteLength(str, 'utf8');
  }

  /**
   * Add key prefix
   */
  private getPrefixedKey(key: string): string {
    return this.options.keyPrefix ? `${this.options.keyPrefix}:${key}` : key;
  }

  /**
   * Record performance metrics
   */
  private recordMetric(
    operation: string,
    startTime: number,
    success: boolean,
    error?: Error,
    keySize?: number,
    valueSize?: number
  ): void {
    if (!this.options.enableMetrics) return;

    const duration = Date.now() - startTime;
    this.stats.totalOperations++;
    this.stats.totalLatency += duration;

    // Could emit metrics to external monitoring system here
    if (error && process.env.NODE_ENV === 'development') {
      console.warn(`Cache operation ${operation} failed:`, error.message);
    }
  }

  /**
   * Calculate hit rate
   */
  private calculateHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Calculate average latency
   */
  private calculateAverageLatency(): number {
    return this.stats.totalOperations > 0 
      ? this.stats.totalLatency / this.stats.totalOperations 
      : 0;
  }
}