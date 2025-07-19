// Database connection and Prisma client with optimized connection pooling
import { PrismaClient } from '@prisma/client';
import { getConnectionPool, closeConnectionPool } from './database-pool';

let prisma: PrismaClient;

declare global {
  var __prisma: PrismaClient | undefined;
}

// For Lambda environments, use connection pooling for better performance
if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
  // Lambda environment - use connection pool
  const pool = getConnectionPool();
  
  // Create a proxy to the pool's execute method
  prisma = new Proxy({} as PrismaClient, {
    get(target, prop) {
      if (prop === '$executeQuery' || prop === '$queryRaw' || prop === '$queryRawUnsafe') {
        return async (...args: any[]) => {
          return pool.execute(async (client) => {
            return (client as any)[prop](...args);
          });
        };
      }
      
      if (prop === '$transaction') {
        return async (fn: any, options?: any) => {
          return pool.transaction(async (client) => {
            return client.$transaction(fn, options);
          });
        };
      }

      if (prop === '$disconnect') {
        return async () => {
          await closeConnectionPool();
        };
      }

      if (prop === '$connect') {
        return async () => {
          // Connection pool handles connections automatically
          return Promise.resolve();
        };
      }

      // For other operations, get a connection from the pool
      return async (...args: any[]) => {
        return pool.execute(async (client) => {
          const method = (client as any)[prop];
          if (typeof method === 'function') {
            return method.apply(client, args);
          }
          return method;
        });
      };
    }
  });
} else {
  // Non-Lambda environment - use traditional approach with optimizations
  if (process.env.NODE_ENV === 'production') {
    prisma = new PrismaClient({
      log: ['error'],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      // Optimize for production
      __internal: {
        engine: {
          enableEngineDebugMode: false,
        },
      },
    });
  } else {
    if (!global.__prisma) {
      global.__prisma = new PrismaClient({
        log: ['query', 'error', 'warn'],
        datasources: {
          db: {
            url: process.env.DATABASE_URL,
          },
        },
      });
    }
    prisma = global.__prisma;
  }
}

// Export both the prisma client and pool utilities
export { prisma, getConnectionPool, closeConnectionPool };

// Health check utility
export async function checkDatabaseHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  connectionPool?: any;
}> {
  const start = Date.now();
  
  try {
    // Simple health check query
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - start;
    
    let poolHealth;
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      const pool = getConnectionPool();
      poolHealth = await pool.healthCheck();
    }

    return {
      status: responseTime > 5000 ? 'degraded' : 'healthy',
      responseTime,
      connectionPool: poolHealth,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - start,
    };
  }
}