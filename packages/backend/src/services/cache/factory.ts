/**
 * Cache Factory - BE-701
 * Factory for creating cache instances with different providers and configurations
 */

import { CacheService } from './cache.service';
import { InMemoryCacheProvider } from './providers/in-memory.provider';
import { RedisCacheProvider } from './providers/redis.provider';
import { CacheConfiguration, CacheProvider, HybridCacheConfig } from './types';

export class CacheFactory {
  /**
   * Create cache service from configuration
   */
  static create(config: CacheConfiguration): CacheService {
    const provider = CacheFactory.createProvider(config);
    
    // Create hybrid cache if specified
    if (config.provider === 'hybrid') {
      const hybridConfig = CacheFactory.createHybridConfig(config);
      return new CacheService(provider, hybridConfig);
    }
    
    return new CacheService(provider);
  }

  /**
   * Create cache provider based on configuration
   */
  static createProvider(config: CacheConfiguration): CacheProvider {
    switch (config.provider) {
      case 'redis':
        if (config.redis) {
          return new RedisCacheProvider(config.redis, config.options);
        }
        throw new Error('Redis configuration required for Redis provider');
        
      case 'in-memory':
        return new InMemoryCacheProvider(config.options);
        
      case 'hybrid':
        // For hybrid, return the L2 cache as the primary provider
        if (config.redis) {
          return new RedisCacheProvider(config.redis, config.options);
        }
        return new InMemoryCacheProvider(config.options);
        
      default:
        throw new Error(`Unknown cache provider: ${config.provider}`);
    }
  }

  /**
   * Create hybrid cache configuration
   */
  static createHybridConfig(config: CacheConfiguration): HybridCacheConfig {
    const l1 = new InMemoryCacheProvider({
      ...config.options,
      maxMemoryMB: config.inMemory?.maxSize || 50, // Smaller L1 cache
      defaultTTL: 300, // 5 minutes for L1
    });

    const l2 = config.redis 
      ? new RedisCacheProvider(config.redis, config.options)
      : new InMemoryCacheProvider(config.options);

    return {
      l1,
      l2,
      l1TTL: 300, // 5 minutes for L1 cache
      syncStrategy: 'write-through',
    };
  }

  /**
   * Create development cache (in-memory only)
   */
  static createDevelopment(): CacheService {
    const provider = new InMemoryCacheProvider({
      defaultTTL: 300,
      maxMemoryMB: 100,
      enableMetrics: true,
      keyPrefix: 'dev',
    });
    
    return new CacheService(provider);
  }

  /**
   * Create production cache (Redis with in-memory fallback)
   */
  static createProduction(redisConfig?: {
    host: string;
    port: number;
    password?: string;
  }): CacheService {
    if (redisConfig) {
      // Hybrid cache for production
      const config: CacheConfiguration = {
        provider: 'hybrid',
        redis: {
          ...redisConfig,
          maxRetries: 3,
          retryDelayMs: 1000,
          connectTimeout: 5000,
          lazyConnect: true,
        },
        inMemory: {
          maxSize: 100, // 100MB for L1
          cleanupInterval: 60000,
        },
        options: {
          defaultTTL: 300,
          enableCompression: true,
          compressionThreshold: 1024,
          enableMetrics: true,
          keyPrefix: 'mq',
        },
      };
      
      return CacheFactory.create(config);
    } else {
      // Fallback to in-memory for production without Redis
      console.warn('Redis not configured, using in-memory cache for production');
      const provider = new InMemoryCacheProvider({
        defaultTTL: 300,
        maxMemoryMB: 200,
        enableMetrics: true,
        keyPrefix: 'mq',
      });
      
      return new CacheService(provider);
    }
  }

  /**
   * Create testing cache (fast, no persistence)
   */
  static createTesting(): CacheService {
    const provider = new InMemoryCacheProvider({
      defaultTTL: 60, // Short TTL for tests
      maxMemoryMB: 10,
      enableMetrics: false,
      keyPrefix: 'test',
    });
    
    return new CacheService(provider);
  }

  /**
   * Create cache from environment
   */
  static createFromEnvironment(): CacheService {
    const nodeEnv = process.env.NODE_ENV || 'development';
    
    switch (nodeEnv) {
      case 'production':
        return CacheFactory.createProduction(
          process.env.REDIS_URL ? {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            password: process.env.REDIS_PASSWORD,
          } : undefined
        );
        
      case 'test':
        return CacheFactory.createTesting();
        
      default:
        return CacheFactory.createDevelopment();
    }
  }

  /**
   * Create cache with custom configuration
   */
  static createCustom(
    provider: 'redis' | 'in-memory' | 'hybrid',
    options: {
      redis?: { host: string; port: number; password?: string };
      inMemory?: { maxSize?: number };
      defaultTTL?: number;
      keyPrefix?: string;
      enableMetrics?: boolean;
    } = {}
  ): CacheService {
    const config: CacheConfiguration = {
      provider,
      redis: options.redis,
      inMemory: options.inMemory,
      options: {
        defaultTTL: options.defaultTTL || 300,
        keyPrefix: options.keyPrefix || 'mq',
        enableMetrics: options.enableMetrics !== false,
        enableCompression: provider === 'redis' || provider === 'hybrid',
        compressionThreshold: 1024,
      },
    };
    
    return CacheFactory.create(config);
  }
}