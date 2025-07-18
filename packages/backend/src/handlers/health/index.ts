/**
 * Health check Lambda handler
 */

import { createHandler } from '../../utils/lambda-handler';
import { config } from '../../config/environment';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  checks: {
    database?: {
      status: 'connected' | 'disconnected' | 'error';
      latency?: number;
      error?: string;
    };
    memory?: {
      used: number;
      available: number;
      percentage: number;
    };
  };
}

/**
 * Health check handler
 * Will be enhanced with database connectivity check when DB is available
 */
async function healthHandler(event: any, context: any): Promise<{ statusCode: number; body: HealthCheckResponse }> {
  const startTime = Date.now();
  
  // Memory check
  const memoryUsage = process.memoryUsage();
  const memoryTotal = 512 * 1024 * 1024; // 512MB Lambda memory
  const memoryUsed = memoryUsage.heapUsed;
  const memoryPercentage = Math.round((memoryUsed / memoryTotal) * 100);

  const response: HealthCheckResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: config.STAGE,
    checks: {
      memory: {
        used: Math.round(memoryUsed / 1024 / 1024), // MB
        available: Math.round((memoryTotal - memoryUsed) / 1024 / 1024), // MB
        percentage: memoryPercentage,
      },
    },
  };

  // Database connectivity check
  try {
    const dbStartTime = Date.now();
    // Simple query to verify connection
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStartTime;
    
    response.checks.database = {
      status: 'connected',
      latency: dbLatency,
    };
  } catch (error) {
    response.status = 'unhealthy';
    response.checks.database = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
  
  return {
    statusCode: 200,
    body: response,
  };
}

// Export handler
export const handler = createHandler(healthHandler, {
  enableCors: true,
  requireAuth: false,
});

// Cleanup Prisma connection on Lambda container shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});