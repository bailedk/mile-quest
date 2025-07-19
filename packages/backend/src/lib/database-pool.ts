/**
 * Database Connection Pool - BE-701
 * Optimized database connections with pooling, monitoring, and resilience
 */

import { PrismaClient } from '@prisma/client';

interface ConnectionPoolConfig {
  maxConnections?: number;
  minConnections?: number;
  acquireTimeoutMs?: number;
  idleTimeoutMs?: number;
  evictionIntervalMs?: number;
  validateConnection?: boolean;
  retryAttempts?: number;
  retryDelayMs?: number;
}

interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  pendingRequests: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageAcquireTime: number;
  maxAcquireTime: number;
  totalAcquireTime: number;
}

interface ConnectionMetrics {
  id: string;
  createdAt: Date;
  lastUsed: Date;
  totalQueries: number;
  isActive: boolean;
  acquisitionTime?: number;
}

export class DatabaseConnectionPool {
  private prismaClients: Map<string, PrismaClient> = new Map();
  private connectionMetrics: Map<string, ConnectionMetrics> = new Map();
  private config: Required<ConnectionPoolConfig>;
  private stats: PoolStats;
  private cleanupInterval?: NodeJS.Timeout;
  private pendingAcquisitions: Array<{
    resolve: (client: PrismaClient) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];

  constructor(config: ConnectionPoolConfig = {}) {
    this.config = {
      maxConnections: config.maxConnections || 10,
      minConnections: config.minConnections || 2,
      acquireTimeoutMs: config.acquireTimeoutMs || 30000,
      idleTimeoutMs: config.idleTimeoutMs || 300000, // 5 minutes
      evictionIntervalMs: config.evictionIntervalMs || 60000, // 1 minute
      validateConnection: config.validateConnection !== false,
      retryAttempts: config.retryAttempts || 3,
      retryDelayMs: config.retryDelayMs || 1000,
    };

    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      pendingRequests: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageAcquireTime: 0,
      maxAcquireTime: 0,
      totalAcquireTime: 0,
    };

    this.initializePool();
    this.startCleanupInterval();
  }

  /**
   * Acquire a database connection from the pool
   */
  async acquire(): Promise<PrismaClient> {
    const startTime = Date.now();
    this.stats.totalRequests++;
    this.stats.pendingRequests++;

    try {
      // Try to get an idle connection first
      const idleConnection = this.getIdleConnection();
      if (idleConnection) {
        this.activateConnection(idleConnection.id);
        this.updateAcquireStats(startTime);
        this.stats.successfulRequests++;
        this.stats.pendingRequests--;
        return idleConnection.client;
      }

      // Create new connection if under limit
      if (this.prismaClients.size < this.config.maxConnections) {
        const client = await this.createConnection();
        this.updateAcquireStats(startTime);
        this.stats.successfulRequests++;
        this.stats.pendingRequests--;
        return client;
      }

      // Wait for available connection
      return await this.waitForConnection(startTime);
    } catch (error) {
      this.stats.failedRequests++;
      this.stats.pendingRequests--;
      throw error;
    }
  }

  /**
   * Release a connection back to the pool
   */
  async release(client: PrismaClient): Promise<void> {
    const connectionId = this.findConnectionId(client);
    if (!connectionId) {
      console.warn('Attempted to release unknown connection');
      return;
    }

    const metrics = this.connectionMetrics.get(connectionId);
    if (metrics) {
      metrics.isActive = false;
      metrics.lastUsed = new Date();
      metrics.totalQueries++;
    }

    this.updateConnectionStats();

    // Process pending requests
    if (this.pendingAcquisitions.length > 0) {
      const pending = this.pendingAcquisitions.shift();
      if (pending) {
        this.activateConnection(connectionId);
        pending.resolve(client);
      }
    }
  }

  /**
   * Execute a query with automatic connection management
   */
  async execute<T>(queryFn: (client: PrismaClient) => Promise<T>): Promise<T> {
    const client = await this.acquire();
    try {
      return await queryFn(client);
    } finally {
      await this.release(client);
    }
  }

  /**
   * Execute a transaction with automatic connection management
   */
  async transaction<T>(transactionFn: (client: PrismaClient) => Promise<T>): Promise<T> {
    const client = await this.acquire();
    try {
      return await client.$transaction(async (tx) => {
        return await transactionFn(tx as PrismaClient);
      });
    } finally {
      await this.release(client);
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats & { connections: ConnectionMetrics[] } {
    this.updateConnectionStats();
    return {
      ...this.stats,
      connections: Array.from(this.connectionMetrics.values()),
    };
  }

  /**
   * Close all connections and cleanup
   */
  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    const disconnectPromises = Array.from(this.prismaClients.values()).map(
      client => client.$disconnect()
    );

    await Promise.all(disconnectPromises);
    
    this.prismaClients.clear();
    this.connectionMetrics.clear();
    this.pendingAcquisitions.forEach(pending => {
      pending.reject(new Error('Connection pool closed'));
    });
    this.pendingAcquisitions.length = 0;
  }

  /**
   * Health check for the connection pool
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      totalConnections: number;
      activeConnections: number;
      idleConnections: number;
      pendingRequests: number;
      errorRate: number;
      averageAcquireTime: number;
    };
  }> {
    const stats = this.getStats();
    const errorRate = stats.totalRequests > 0 
      ? (stats.failedRequests / stats.totalRequests) * 100 
      : 0;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (errorRate > 10 || stats.averageAcquireTime > 5000) {
      status = 'unhealthy';
    } else if (errorRate > 5 || stats.averageAcquireTime > 2000 || stats.pendingRequests > 5) {
      status = 'degraded';
    }

    return {
      status,
      details: {
        totalConnections: stats.totalConnections,
        activeConnections: stats.activeConnections,
        idleConnections: stats.idleConnections,
        pendingRequests: stats.pendingRequests,
        errorRate: Math.round(errorRate * 100) / 100,
        averageAcquireTime: Math.round(stats.averageAcquireTime),
      },
    };
  }

  /**
   * Initialize the connection pool with minimum connections
   */
  private async initializePool(): Promise<void> {
    const initPromises = [];
    for (let i = 0; i < this.config.minConnections; i++) {
      initPromises.push(this.createConnection());
    }
    
    try {
      await Promise.all(initPromises);
    } catch (error) {
      console.error('Failed to initialize connection pool:', error);
    }
  }

  /**
   * Create a new database connection
   */
  private async createConnection(): Promise<PrismaClient> {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const client = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    // Test connection
    if (this.config.validateConnection) {
      await client.$connect();
      await client.$queryRaw`SELECT 1`;
    }

    this.prismaClients.set(connectionId, client);
    this.connectionMetrics.set(connectionId, {
      id: connectionId,
      createdAt: new Date(),
      lastUsed: new Date(),
      totalQueries: 0,
      isActive: true,
    });

    this.updateConnectionStats();
    return client;
  }

  /**
   * Get an idle connection from the pool
   */
  private getIdleConnection(): { id: string; client: PrismaClient } | null {
    for (const [id, metrics] of this.connectionMetrics.entries()) {
      if (!metrics.isActive) {
        const client = this.prismaClients.get(id);
        if (client) {
          return { id, client };
        }
      }
    }
    return null;
  }

  /**
   * Activate a connection (mark as in use)
   */
  private activateConnection(connectionId: string): void {
    const metrics = this.connectionMetrics.get(connectionId);
    if (metrics) {
      metrics.isActive = true;
      metrics.lastUsed = new Date();
    }
    this.updateConnectionStats();
  }

  /**
   * Wait for an available connection
   */
  private async waitForConnection(startTime: number): Promise<PrismaClient> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.pendingAcquisitions.findIndex(req => req.resolve === resolve);
        if (index !== -1) {
          this.pendingAcquisitions.splice(index, 1);
        }
        reject(new Error(`Connection acquisition timeout after ${this.config.acquireTimeoutMs}ms`));
      }, this.config.acquireTimeoutMs);

      this.pendingAcquisitions.push({
        resolve: (client) => {
          clearTimeout(timeout);
          this.updateAcquireStats(startTime);
          this.stats.successfulRequests++;
          this.stats.pendingRequests--;
          resolve(client);
        },
        reject: (error) => {
          clearTimeout(timeout);
          this.stats.failedRequests++;
          this.stats.pendingRequests--;
          reject(error);
        },
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Find connection ID by client instance
   */
  private findConnectionId(client: PrismaClient): string | undefined {
    for (const [id, prismaClient] of this.prismaClients.entries()) {
      if (prismaClient === client) {
        return id;
      }
    }
    return undefined;
  }

  /**
   * Update connection statistics
   */
  private updateConnectionStats(): void {
    this.stats.totalConnections = this.prismaClients.size;
    this.stats.activeConnections = Array.from(this.connectionMetrics.values())
      .filter(metrics => metrics.isActive).length;
    this.stats.idleConnections = this.stats.totalConnections - this.stats.activeConnections;
  }

  /**
   * Update acquisition time statistics
   */
  private updateAcquireStats(startTime: number): void {
    const acquireTime = Date.now() - startTime;
    this.stats.totalAcquireTime += acquireTime;
    this.stats.maxAcquireTime = Math.max(this.stats.maxAcquireTime, acquireTime);
    this.stats.averageAcquireTime = this.stats.totalRequests > 0 
      ? this.stats.totalAcquireTime / this.stats.totalRequests 
      : 0;
  }

  /**
   * Start cleanup interval to remove idle connections
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, this.config.evictionIntervalMs);
  }

  /**
   * Clean up idle connections that exceed the idle timeout
   */
  private async cleanupIdleConnections(): Promise<void> {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [id, metrics] of this.connectionMetrics.entries()) {
      const idleTime = now - metrics.lastUsed.getTime();
      
      if (!metrics.isActive && 
          idleTime > this.config.idleTimeoutMs && 
          this.prismaClients.size > this.config.minConnections) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      const client = this.prismaClients.get(id);
      if (client) {
        try {
          await client.$disconnect();
        } catch (error) {
          console.error(`Error disconnecting idle connection ${id}:`, error);
        }
        this.prismaClients.delete(id);
        this.connectionMetrics.delete(id);
      }
    }

    if (toRemove.length > 0) {
      this.updateConnectionStats();
      console.log(`Cleaned up ${toRemove.length} idle database connections`);
    }
  }
}

// Create singleton instance
let poolInstance: DatabaseConnectionPool | null = null;

export function getConnectionPool(): DatabaseConnectionPool {
  if (!poolInstance) {
    poolInstance = new DatabaseConnectionPool({
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
      minConnections: parseInt(process.env.DB_MIN_CONNECTIONS || '2', 10),
      acquireTimeoutMs: parseInt(process.env.DB_ACQUIRE_TIMEOUT_MS || '30000', 10),
      idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '300000', 10),
    });
  }
  return poolInstance;
}

export async function closeConnectionPool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.close();
    poolInstance = null;
  }
}