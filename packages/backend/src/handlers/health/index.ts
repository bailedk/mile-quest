/**
 * Health check Lambda handler
 */

import { createHandler, EnhancedContext } from '../../utils/lambda-handler';
import { config } from '../../config/environment';
import { PrismaClient } from '@prisma/client';
import { APIGatewayProxyEvent } from 'aws-lambda';

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
async function healthHandler(
  event: APIGatewayProxyEvent, 
  context: EnhancedContext
): Promise<{ statusCode: number; body: HealthCheckResponse }> {
  const { logger } = context;
  const startTime = Date.now();
  
  logger.info('Health check started');
  
  // Memory check
  const memoryUsage = process.memoryUsage();
  const memoryTotal = 512 * 1024 * 1024; // 512MB Lambda memory
  const memoryUsed = memoryUsage.heapUsed;
  const memoryPercentage = Math.round((memoryUsed / memoryTotal) * 100);
  
  logger.debug('Memory check completed', {
    memoryUsedMB: Math.round(memoryUsed / 1024 / 1024),
    memoryPercentage,
  });

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
    const dbTimer = logger.startTimer('database-check');
    
    // Simple query to verify connection
    await prisma.$queryRaw`SELECT 1`;
    
    const dbLatency = Date.now() - startTime;
    dbTimer();
    
    logger.info('Database check successful', { latency: dbLatency });
    
    response.checks.database = {
      status: 'connected',
      latency: dbLatency,
    };
  } catch (error) {
    logger.error('Database check failed', error as Error);
    
    response.status = 'unhealthy';
    response.checks.database = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
  
  const totalTime = Date.now() - startTime;
  logger.info('Health check completed', {
    status: response.status,
    duration: totalTime,
    checks: {
      memory: response.checks.memory?.percentage + '%',
      database: response.checks.database?.status,
    },
  });
  
  return {
    statusCode: 200,
    body: response,
  };
}

// Export handler
export const handler = createHandler(healthHandler, {
  enableCors: true,
  requireAuth: false,
  functionName: 'health-check',
});

// Cleanup Prisma connection on Lambda container shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});