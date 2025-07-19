/**
 * Connection Pool Optimizer - DB-701
 * Advanced connection pooling and optimization for Lambda environments
 */

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

export interface ConnectionPoolConfig {
  min: number;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  maxUses?: number;
  allowExitOnIdle?: boolean;
  statementTimeout?: number;
  queryTimeout?: number;
}

export interface PoolMetrics {
  totalConnections: number;
  idleConnections: number;
  activeConnections: number;
  waitingRequests: number;
  totalRequests: number;
  totalErrors: number;
  averageWaitTime: number;
  connectionUtilization: number;
}

export class ConnectionPoolOptimizer {
  private static instance: ConnectionPoolOptimizer;
  private pool: Pool | null = null;
  private prismaClient: PrismaClient | null = null;
  private metrics: PoolMetrics = {
    totalConnections: 0,
    idleConnections: 0,
    activeConnections: 0,
    waitingRequests: 0,
    totalRequests: 0,
    totalErrors: 0,
    averageWaitTime: 0,
    connectionUtilization: 0,
  };
  private waitTimes: number[] = [];

  private constructor() {}

  static getInstance(): ConnectionPoolOptimizer {
    if (!ConnectionPoolOptimizer.instance) {
      ConnectionPoolOptimizer.instance = new ConnectionPoolOptimizer();
    }
    return ConnectionPoolOptimizer.instance;
  }

  /**
   * Initialize optimized connection pool for Lambda
   */
  async initializePool(config?: Partial<ConnectionPoolConfig>): Promise<void> {
    const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
    
    // Lambda-optimized defaults
    const defaultConfig: ConnectionPoolConfig = {
      min: isLambda ? 0 : 2,
      max: isLambda ? 3 : 20,
      idleTimeoutMillis: isLambda ? 1000 : 30000,
      connectionTimeoutMillis: 5000,
      maxUses: isLambda ? 100 : 7500,
      allowExitOnIdle: isLambda,
      statementTimeout: 30000,
      queryTimeout: 30000,
    };

    const finalConfig = { ...defaultConfig, ...config };

    // Create optimized pool
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      min: finalConfig.min,
      max: finalConfig.max,
      idleTimeoutMillis: finalConfig.idleTimeoutMillis,
      connectionTimeoutMillis: finalConfig.connectionTimeoutMillis,
      statement_timeout: finalConfig.statementTimeout,
      query_timeout: finalConfig.queryTimeout,
      // Connection lifecycle hooks
      connectionTimeoutMillis: finalConfig.connectionTimeoutMillis,
      max_lifetime: isLambda ? 300000 : 1800000, // 5 min for Lambda, 30 min otherwise
    });

    // Set up event handlers
    this.setupPoolEventHandlers();

    // Initialize Prisma with optimized settings
    this.initializePrisma(isLambda);

    console.log(`Connection pool initialized with config:`, finalConfig);
  }

  /**
   * Initialize Prisma with optimized settings
   */
  private initializePrisma(isLambda: boolean): void {
    this.prismaClient = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      // Connection pool settings for Prisma
      // @ts-ignore - Prisma internal configuration
      __internal: {
        engine: {
          connectionLimit: isLambda ? 3 : 20,
          poolTimeout: 10,
          idleTimeout: isLambda ? 1 : 30,
        },
      },
    });

    // Optimize Prisma for Lambda cold starts
    if (isLambda) {
      this.optimizeForLambda();
    }
  }

  /**
   * Optimize connections for Lambda environment
   */
  private optimizeForLambda(): void {
    // Pre-warm connection on Lambda container start
    if (this.prismaClient) {
      this.prismaClient.$connect().catch(console.error);
    }

    // Set up connection reuse
    process.on('beforeExit', async () => {
      if (this.prismaClient) {
        await this.prismaClient.$disconnect();
      }
      if (this.pool) {
        await this.pool.end();
      }
    });
  }

  /**
   * Set up pool event handlers for monitoring
   */
  private setupPoolEventHandlers(): void {
    if (!this.pool) return;

    this.pool.on('connect', () => {
      this.metrics.totalConnections++;
    });

    this.pool.on('acquire', () => {
      this.metrics.activeConnections++;
      this.metrics.idleConnections--;
      this.metrics.totalRequests++;
    });

    this.pool.on('release', () => {
      this.metrics.activeConnections--;
      this.metrics.idleConnections++;
    });

    this.pool.on('remove', () => {
      this.metrics.totalConnections--;
    });

    this.pool.on('error', (err) => {
      console.error('Pool error:', err);
      this.metrics.totalErrors++;
    });
  }

  /**
   * Get optimized Prisma client
   */
  getPrismaClient(): PrismaClient {
    if (!this.prismaClient) {
      throw new Error('Connection pool not initialized');
    }
    return this.prismaClient;
  }

  /**
   * Get raw pool for advanced queries
   */
  getPool(): Pool {
    if (!this.pool) {
      throw new Error('Connection pool not initialized');
    }
    return this.pool;
  }

  /**
   * Execute query with connection pooling optimization
   */
  async executeQuery<T>(query: string, params?: any[]): Promise<T> {
    if (!this.pool) {
      throw new Error('Connection pool not initialized');
    }

    const startTime = Date.now();
    this.metrics.waitingRequests++;

    try {
      const client = await this.pool.connect();
      this.metrics.waitingRequests--;
      
      const waitTime = Date.now() - startTime;
      this.waitTimes.push(waitTime);
      
      try {
        const result = await client.query(query, params);
        return result.rows as T;
      } finally {
        client.release();
      }
    } catch (error) {
      this.metrics.totalErrors++;
      throw error;
    }
  }

  /**
   * Execute transaction with optimized connection handling
   */
  async executeTransaction<T>(
    callback: (client: any) => Promise<T>
  ): Promise<T> {
    if (!this.pool) {
      throw new Error('Connection pool not initialized');
    }

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get current pool metrics
   */
  getMetrics(): PoolMetrics {
    // Calculate average wait time
    if (this.waitTimes.length > 0) {
      this.metrics.averageWaitTime = 
        this.waitTimes.reduce((a, b) => a + b, 0) / this.waitTimes.length;
    }

    // Calculate connection utilization
    if (this.metrics.totalConnections > 0) {
      this.metrics.connectionUtilization = 
        (this.metrics.activeConnections / this.metrics.totalConnections) * 100;
    }

    // Reset wait times periodically
    if (this.waitTimes.length > 1000) {
      this.waitTimes = this.waitTimes.slice(-100);
    }

    return { ...this.metrics };
  }

  /**
   * Optimize pool configuration based on usage patterns
   */
  async optimizePoolConfiguration(): Promise<ConnectionPoolConfig> {
    const metrics = this.getMetrics();
    const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
    
    const recommendations: ConnectionPoolConfig = {
      min: 0,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

    // Adjust based on utilization
    if (metrics.connectionUtilization > 80) {
      recommendations.max = Math.min(isLambda ? 5 : 30, Math.ceil(metrics.totalConnections * 1.5));
    } else if (metrics.connectionUtilization < 20) {
      recommendations.max = Math.max(isLambda ? 2 : 5, Math.floor(metrics.totalConnections * 0.7));
    }

    // Adjust idle timeout based on request patterns
    if (metrics.averageWaitTime > 100) {
      recommendations.min = Math.min(recommendations.max / 2, isLambda ? 1 : 5);
    }

    // Lambda-specific optimizations
    if (isLambda) {
      recommendations.idleTimeoutMillis = 1000;
      recommendations.maxUses = 100;
      recommendations.allowExitOnIdle = true;
    }

    return recommendations;
  }

  /**
   * Health check for connection pool
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    details: {
      poolHealthy: boolean;
      prismaHealthy: boolean;
      canConnect: boolean;
      metrics: PoolMetrics;
    };
  }> {
    const details = {
      poolHealthy: false,
      prismaHealthy: false,
      canConnect: false,
      metrics: this.getMetrics(),
    };

    try {
      // Check pool
      if (this.pool) {
        const client = await this.pool.connect();
        await client.query('SELECT 1');
        client.release();
        details.poolHealthy = true;
        details.canConnect = true;
      }

      // Check Prisma
      if (this.prismaClient) {
        await this.prismaClient.$queryRaw`SELECT 1`;
        details.prismaHealthy = true;
      }

      const healthy = details.poolHealthy && details.prismaHealthy;
      return { healthy, details };
    } catch (error) {
      console.error('Health check failed:', error);
      return { healthy: false, details };
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down connection pool...');
    
    if (this.prismaClient) {
      await this.prismaClient.$disconnect();
    }
    
    if (this.pool) {
      await this.pool.end();
    }
    
    console.log('Connection pool shut down successfully');
  }

  /**
   * Advanced query execution with prepared statements
   */
  async executePreparedQuery<T>(
    name: string,
    query: string,
    params?: any[]
  ): Promise<T> {
    if (!this.pool) {
      throw new Error('Connection pool not initialized');
    }

    const client = await this.pool.connect();
    
    try {
      // Prepare statement if not already prepared
      const preparedQueries = (client as any)._preparedQueries || new Set();
      if (!preparedQueries.has(name)) {
        await client.query({
          name,
          text: query,
          values: params,
        });
        preparedQueries.add(name);
        (client as any)._preparedQueries = preparedQueries;
      }

      // Execute prepared statement
      const result = await client.query({
        name,
        values: params,
      });
      
      return result.rows as T;
    } finally {
      client.release();
    }
  }

  /**
   * Batch query execution for performance
   */
  async executeBatch<T>(queries: Array<{ query: string; params?: any[] }>): Promise<T[]> {
    if (!this.pool) {
      throw new Error('Connection pool not initialized');
    }

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const results: T[] = [];
      for (const { query, params } of queries) {
        const result = await client.query(query, params);
        results.push(result.rows as T);
      }
      
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Connection warming for Lambda cold starts
   */
  async warmConnections(count = 1): Promise<void> {
    if (!this.pool) return;

    const warmupPromises = [];
    
    for (let i = 0; i < count; i++) {
      warmupPromises.push(
        this.pool.connect().then(client => {
          return client.query('SELECT 1').then(() => client.release());
        })
      );
    }
    
    await Promise.all(warmupPromises);
    console.log(`Warmed ${count} connections`);
  }
}