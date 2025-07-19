/**
 * Query Cache Service - DB-701
 * Implements database-level query result caching
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export interface CacheEntry {
  queryHash: string;
  queryText: string;
  params?: any[];
  resultData: any;
  createdAt: Date;
  expiresAt: Date;
  hitCount: number;
  lastAccessed: Date;
  tags: string[];
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for invalidation
  key?: string; // Custom cache key
}

export interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  avgResponseTime: number;
  cacheSize: number;
}

export class QueryCacheService {
  private prisma: PrismaClient;
  private inMemoryCache: Map<string, CacheEntry> = new Map();
  private stats = {
    hits: 0,
    misses: 0,
    responseTimes: [] as number[],
  };

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.initializeCache();
  }

  /**
   * Initialize query cache table
   */
  private async initializeCache(): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS query_cache (
          query_hash VARCHAR(64) PRIMARY KEY,
          query_text TEXT NOT NULL,
          params JSONB,
          result_data JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          expires_at TIMESTAMP NOT NULL,
          hit_count INTEGER DEFAULT 0,
          last_accessed TIMESTAMP DEFAULT NOW(),
          tags TEXT[] DEFAULT '{}',
          size_bytes INTEGER
        )
      `;

      // Create indexes for cache management
      await this.prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_query_cache_expires 
        ON query_cache (expires_at) 
        WHERE expires_at > NOW()
      `;

      await this.prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_query_cache_tags 
        ON query_cache USING gin (tags)
      `;

      await this.prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_query_cache_accessed 
        ON query_cache (last_accessed)
      `;

      // Set up automatic cleanup
      await this.setupCacheCleanup();
      
      console.log('Query cache initialized');
    } catch (error) {
      console.error('Failed to initialize query cache:', error);
    }
  }

  /**
   * Execute query with caching
   */
  async cachedQuery<T>(
    query: string,
    params?: any[],
    options: CacheOptions = {}
  ): Promise<T> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(query, params, options.key);
    
    // Check in-memory cache first
    const memCached = this.inMemoryCache.get(cacheKey);
    if (memCached && memCached.expiresAt > new Date()) {
      this.stats.hits++;
      this.stats.responseTimes.push(Date.now() - startTime);
      return memCached.resultData as T;
    }

    // Check database cache
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      this.stats.hits++;
      this.stats.responseTimes.push(Date.now() - startTime);
      // Update in-memory cache
      this.inMemoryCache.set(cacheKey, cached);
      return cached.resultData as T;
    }

    // Cache miss - execute query
    this.stats.misses++;
    try {
      const result = await this.prisma.$queryRawUnsafe(query, ...(params || []));
      
      // Store in cache
      await this.storeInCache(cacheKey, query, params, result, options);
      
      this.stats.responseTimes.push(Date.now() - startTime);
      return result as T;
    } catch (error) {
      console.error('Query execution failed:', error);
      throw error;
    }
  }

  /**
   * Generate cache key from query and params
   */
  private generateCacheKey(query: string, params?: any[], customKey?: string): string {
    if (customKey) {
      return crypto.createHash('sha256').update(customKey).digest('hex');
    }
    
    const normalized = this.normalizeQuery(query);
    const keyData = JSON.stringify({ query: normalized, params: params || [] });
    return crypto.createHash('sha256').update(keyData).digest('hex');
  }

  /**
   * Normalize query for consistent caching
   */
  private normalizeQuery(query: string): string {
    return query
      .replace(/\s+/g, ' ')
      .replace(/\s*,\s*/g, ',')
      .replace(/\s*\(\s*/g, '(')
      .replace(/\s*\)\s*/g, ')')
      .trim()
      .toLowerCase();
  }

  /**
   * Get entry from cache
   */
  private async getFromCache(queryHash: string): Promise<CacheEntry | null> {
    try {
      const result = await this.prisma.$queryRaw<CacheEntry[]>`
        UPDATE query_cache 
        SET 
          hit_count = hit_count + 1,
          last_accessed = NOW()
        WHERE 
          query_hash = ${queryHash}
          AND expires_at > NOW()
        RETURNING *
      `;

      return result[0] || null;
    } catch (error) {
      console.error('Cache retrieval failed:', error);
      return null;
    }
  }

  /**
   * Store result in cache
   */
  private async storeInCache(
    queryHash: string,
    queryText: string,
    params: any[] | undefined,
    resultData: any,
    options: CacheOptions
  ): Promise<void> {
    const ttl = options.ttl || 300; // Default 5 minutes
    const expiresAt = new Date(Date.now() + ttl * 1000);
    const tags = options.tags || [];
    const sizeBytes = JSON.stringify(resultData).length;

    const entry: CacheEntry = {
      queryHash,
      queryText,
      params,
      resultData,
      createdAt: new Date(),
      expiresAt,
      hitCount: 0,
      lastAccessed: new Date(),
      tags,
    };

    // Store in memory
    this.inMemoryCache.set(queryHash, entry);

    // Store in database
    try {
      await this.prisma.$executeRaw`
        INSERT INTO query_cache (
          query_hash, query_text, params, result_data, 
          expires_at, tags, size_bytes
        ) VALUES (
          ${queryHash}, ${queryText}, ${JSON.stringify(params)}, 
          ${JSON.stringify(resultData)}, ${expiresAt}, 
          ${tags}, ${sizeBytes}
        )
        ON CONFLICT (query_hash) DO UPDATE SET
          result_data = EXCLUDED.result_data,
          expires_at = EXCLUDED.expires_at,
          tags = EXCLUDED.tags,
          size_bytes = EXCLUDED.size_bytes,
          created_at = NOW()
      `;
    } catch (error) {
      console.error('Cache storage failed:', error);
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    // Clear from in-memory cache
    for (const [key, entry] of this.inMemoryCache.entries()) {
      if (tags.some(tag => entry.tags.includes(tag))) {
        this.inMemoryCache.delete(key);
      }
    }

    // Clear from database
    const result = await this.prisma.$queryRaw<Array<{ count: number }>>`
      DELETE FROM query_cache 
      WHERE tags && ${tags}::text[]
      RETURNING COUNT(*) as count
    `;

    return result[0]?.count || 0;
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    // Clear from in-memory cache
    const regex = new RegExp(pattern);
    for (const [key, entry] of this.inMemoryCache.entries()) {
      if (regex.test(entry.queryText)) {
        this.inMemoryCache.delete(key);
      }
    }

    // Clear from database
    const result = await this.prisma.$queryRaw<Array<{ count: number }>>`
      DELETE FROM query_cache 
      WHERE query_text ~ ${pattern}
      RETURNING COUNT(*) as count
    `;

    return result[0]?.count || 0;
  }

  /**
   * Clear all cache entries
   */
  async clearCache(): Promise<void> {
    this.inMemoryCache.clear();
    await this.prisma.$executeRaw`TRUNCATE TABLE query_cache`;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const dbStats = await this.prisma.$queryRaw<Array<{
      total_entries: number;
      total_hits: number;
      cache_size: number;
    }>>`
      SELECT 
        COUNT(*) as total_entries,
        SUM(hit_count) as total_hits,
        SUM(size_bytes) as cache_size
      FROM query_cache
      WHERE expires_at > NOW()
    `;

    const stats = dbStats[0] || {
      total_entries: 0,
      total_hits: 0,
      cache_size: 0,
    };

    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
    
    const avgResponseTime = this.stats.responseTimes.length > 0
      ? this.stats.responseTimes.reduce((a, b) => a + b, 0) / this.stats.responseTimes.length
      : 0;

    return {
      totalEntries: stats.total_entries,
      totalHits: stats.total_hits + this.stats.hits,
      totalMisses: this.stats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      avgResponseTime: Math.round(avgResponseTime),
      cacheSize: stats.cache_size,
    };
  }

  /**
   * Setup automatic cache cleanup
   */
  private async setupCacheCleanup(): Promise<void> {
    // Create cleanup function
    await this.prisma.$executeRaw`
      CREATE OR REPLACE FUNCTION cleanup_expired_cache()
      RETURNS void AS $$
      BEGIN
        DELETE FROM query_cache WHERE expires_at < NOW();
      END;
      $$ LANGUAGE plpgsql;
    `;

    // Schedule cleanup every hour
    setInterval(async () => {
      try {
        await this.prisma.$executeRaw`SELECT cleanup_expired_cache()`;
        // Also clean up in-memory cache
        for (const [key, entry] of this.inMemoryCache.entries()) {
          if (entry.expiresAt < new Date()) {
            this.inMemoryCache.delete(key);
          }
        }
      } catch (error) {
        console.error('Cache cleanup failed:', error);
      }
    }, 3600000); // 1 hour
  }

  /**
   * Warm cache with common queries
   */
  async warmCache(queries: Array<{ query: string; params?: any[]; options?: CacheOptions }>): Promise<void> {
    console.log(`Warming cache with ${queries.length} queries...`);
    
    const warmupPromises = queries.map(({ query, params, options }) =>
      this.cachedQuery(query, params, { ...options, ttl: options?.ttl || 3600 })
        .catch(err => console.error('Cache warmup failed for query:', err))
    );

    await Promise.all(warmupPromises);
    console.log('Cache warmup complete');
  }

  /**
   * Intelligent cache key suggestions based on query patterns
   */
  async suggestCacheKeys(): Promise<Array<{ pattern: string; count: number; avgSize: number }>> {
    const patterns = await this.prisma.$queryRaw<Array<{
      pattern: string;
      count: number;
      avg_size: number;
    }>>`
      WITH query_patterns AS (
        SELECT 
          CASE 
            WHEN query_text LIKE 'SELECT%FROM activities%' THEN 'activities_query'
            WHEN query_text LIKE 'SELECT%FROM users%' THEN 'users_query'
            WHEN query_text LIKE 'SELECT%FROM teams%' THEN 'teams_query'
            WHEN query_text LIKE '%JOIN%' THEN 'join_query'
            WHEN query_text LIKE '%GROUP BY%' THEN 'aggregation_query'
            ELSE 'other_query'
          END as pattern,
          COUNT(*) as count,
          AVG(size_bytes) as avg_size
        FROM query_cache
        GROUP BY pattern
      )
      SELECT * FROM query_patterns
      ORDER BY count DESC
    `;

    return patterns.map(p => ({
      pattern: p.pattern,
      count: p.count,
      avgSize: p.avg_size,
    }));
  }

  /**
   * Advanced cache strategies for specific query types
   */
  async setupAdvancedCaching(): Promise<void> {
    // Cache strategy for dashboard queries
    await this.setupDashboardCaching();
    
    // Cache strategy for leaderboard queries
    await this.setupLeaderboardCaching();
    
    // Cache strategy for user stats
    await this.setupUserStatsCaching();
  }

  private async setupDashboardCaching(): Promise<void> {
    // Pre-compute and cache common dashboard queries
    const dashboardQueries = [
      {
        query: `
          SELECT 
            COUNT(DISTINCT user_id) as active_users,
            SUM(distance) as total_distance,
            COUNT(*) as total_activities
          FROM activities
          WHERE start_time >= NOW() - INTERVAL '24 hours'
        `,
        options: { ttl: 300, tags: ['dashboard', 'stats'] },
      },
    ];

    await this.warmCache(dashboardQueries);
  }

  private async setupLeaderboardCaching(): Promise<void> {
    // Cache leaderboard queries with appropriate TTL
    const periods = ['day', 'week', 'month'];
    const leaderboardQueries = periods.map(period => ({
      query: `
        SELECT 
          user_id,
          SUM(distance) as total_distance,
          COUNT(*) as activity_count
        FROM activities
        WHERE 
          start_time >= DATE_TRUNC('${period}', NOW())
          AND is_private = false
        GROUP BY user_id
        ORDER BY total_distance DESC
        LIMIT 100
      `,
      options: { 
        ttl: period === 'day' ? 300 : period === 'week' ? 900 : 1800,
        tags: ['leaderboard', period],
      },
    }));

    await this.warmCache(leaderboardQueries);
  }

  private async setupUserStatsCaching(): Promise<void> {
    // User stats caching is handled per-user with custom keys
    console.log('User stats caching configured');
  }
}