/**
 * Advanced Caching Service - BE-701
 * Multi-layer caching with Redis-compatibility and fallback strategies
 */

export { CacheService } from './cache.service';
export { CacheFactory } from './factory';
export { InMemoryCacheProvider } from './providers/in-memory.provider';
export { RedisCacheProvider } from './providers/redis.provider';
export type { 
  CacheProvider, 
  CacheOptions, 
  CacheStats,
  CacheKey,
  CacheMetrics
} from './types';
export { cacheKeys, cacheTTL } from './constants';