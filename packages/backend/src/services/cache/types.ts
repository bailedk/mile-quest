/**
 * Cache Service Types - BE-701
 */

export interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  exists(key: string): Promise<boolean>;
  expire(key: string, ttlSeconds: number): Promise<void>;
  ttl(key: string): Promise<number>;
  mget<T>(keys: string[]): Promise<(T | null)[]>;
  mset<T>(keyValues: Record<string, T>, ttlSeconds?: number): Promise<void>;
  increment(key: string, amount?: number): Promise<number>;
  decrement(key: string, amount?: number): Promise<number>;
  getStats(): Promise<CacheStats>;
  close(): Promise<void>;
}

export interface CacheOptions {
  defaultTTL?: number;
  maxMemoryMB?: number;
  compressionThreshold?: number;
  enableCompression?: boolean;
  keyPrefix?: string;
  enableMetrics?: boolean;
}

export interface CacheStats {
  provider: string;
  hits: number;
  misses: number;
  hitRate: number;
  keys: number;
  memoryUsed?: number;
  maxMemory?: number;
  evictions?: number;
  errors: number;
  totalOperations: number;
  averageLatency?: number;
  connections?: number;
}

export interface CacheKey {
  key: string;
  ttl?: number;
  tags?: string[];
}

export interface CacheMetrics {
  timestamp: Date;
  provider: string;
  operation: string;
  duration: number;
  success: boolean;
  keySize?: number;
  valueSize?: number;
  error?: string;
}

export interface CacheConfiguration {
  provider: 'redis' | 'in-memory' | 'hybrid';
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    maxRetries?: number;
    retryDelayMs?: number;
    connectTimeout?: number;
    lazyConnect?: boolean;
    enableOfflineQueue?: boolean;
  };
  inMemory?: {
    maxSize?: number;
    cleanupInterval?: number;
  };
  options?: CacheOptions;
}

export interface HybridCacheConfig {
  l1: CacheProvider; // Fast local cache (in-memory)
  l2: CacheProvider; // Distributed cache (Redis)
  l1TTL?: number;    // TTL for L1 cache
  syncStrategy?: 'write-through' | 'write-behind' | 'write-around';
}