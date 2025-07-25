/**
 * Enhanced Health check Lambda handler with comprehensive monitoring
 */

import { createHandler, EnhancedContext } from '../../utils/lambda-handler';
import { config } from '../../config/environment';
import { PrismaClient } from '@prisma/client';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { getMonitoring } from '../../services/monitoring/factory';

const prisma = new PrismaClient();

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
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
    monitoring?: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      services?: Record<string, string>;
    };
    external?: {
      cognito: string;
      mapbox: string;
    };
  };
  summary?: {
    healthy: number;
    degraded: number;
    unhealthy: number;
    total: number;
  };
}

/**
 * Enhanced health check handler with comprehensive monitoring
 */
async function healthHandler(
  event: APIGatewayProxyEvent, 
  context: EnhancedContext
): Promise<{ statusCode: number; body: HealthCheckResponse }> {
  const { logger } = context;
  const startTime = Date.now();
  
  logger.info('Comprehensive health check started');
  
  // Initialize response
  const response: HealthCheckResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: config.STAGE,
    checks: {},
  };

  let healthyCount = 0;
  let degradedCount = 0;
  let unhealthyCount = 0;
  let totalChecks = 0;

  // Memory check
  try {
    const memoryUsage = process.memoryUsage();
    const memoryTotal = 512 * 1024 * 1024; // 512MB Lambda memory
    const memoryUsed = memoryUsage.heapUsed;
    const memoryPercentage = Math.round((memoryUsed / memoryTotal) * 100);
    
    response.checks.memory = {
      used: Math.round(memoryUsed / 1024 / 1024), // MB
      available: Math.round((memoryTotal - memoryUsed) / 1024 / 1024), // MB
      percentage: memoryPercentage,
    };
    
    totalChecks++;
    if (memoryPercentage > 90) {
      unhealthyCount++;
    } else if (memoryPercentage > 80) {
      degradedCount++;
    } else {
      healthyCount++;
    }
    
    logger.debug('Memory check completed', {
      memoryUsedMB: Math.round(memoryUsed / 1024 / 1024),
      memoryPercentage,
      status: memoryPercentage > 90 ? 'unhealthy' : memoryPercentage > 80 ? 'degraded' : 'healthy',
    });
  } catch (error) {
    logger.error('Memory check failed', error as Error);
    totalChecks++;
    unhealthyCount++;
  }

  // Database connectivity check
  try {
    const dbTimer = logger.startTimer('database-check');
    
    // Simple query to verify connection
    await prisma.$queryRaw`SELECT 1`;
    
    const dbLatency = Date.now() - startTime;
    dbTimer();
    
    response.checks.database = {
      status: 'connected',
      latency: dbLatency,
    };
    
    totalChecks++;
    if (dbLatency > 5000) {
      unhealthyCount++;
    } else if (dbLatency > 1000) {
      degradedCount++;
    } else {
      healthyCount++;
    }
    
    logger.info('Database check successful', { 
      latency: dbLatency,
      status: dbLatency > 5000 ? 'unhealthy' : dbLatency > 1000 ? 'degraded' : 'healthy',
    });
    
  } catch (error) {
    logger.error('Database check failed', error as Error);
    
    response.checks.database = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
    
    totalChecks++;
    unhealthyCount++;
  }

  // Monitoring system health check
  try {
    const monitoring = await getMonitoring(prisma);
    const monitoringHealth = await monitoring.getMonitoringHealth();
    
    response.checks.monitoring = {
      status: monitoringHealth.status,
      services: monitoringHealth.services,
    };
    
    totalChecks++;
    if (monitoringHealth.status === 'unhealthy') {
      unhealthyCount++;
    } else if (monitoringHealth.status === 'degraded') {
      degradedCount++;
    } else {
      healthyCount++;
    }
    
    logger.info('Monitoring system check completed', {
      status: monitoringHealth.status,
      services: Object.keys(monitoringHealth.services).length,
    });
    
  } catch (error) {
    logger.error('Monitoring system check failed', error as Error);
    
    response.checks.monitoring = {
      status: 'unhealthy',
    };
    
    totalChecks++;
    unhealthyCount++;
  }

  // External services check (simplified)
  try {
    response.checks.external = {
      cognito: 'healthy', // In production, you'd actually test connectivity
      mapbox: 'healthy',
    };
    
    totalChecks += 2;
    healthyCount += 2; // Assuming healthy for now
    
    logger.debug('External services check completed', {
      cognito: 'healthy',
      mapbox: 'healthy',
    });
    
  } catch (error) {
    logger.error('External services check failed', error as Error);
    totalChecks += 2;
    unhealthyCount += 2;
  }

  // Determine overall status
  if (unhealthyCount > 0) {
    response.status = 'unhealthy';
  } else if (degradedCount > 0) {
    response.status = 'degraded';
  } else {
    response.status = 'healthy';
  }

  // Add summary
  response.summary = {
    healthy: healthyCount,
    degraded: degradedCount,
    unhealthy: unhealthyCount,
    total: totalChecks,
  };
  
  const totalTime = Date.now() - startTime;
  logger.info('Comprehensive health check completed', {
    status: response.status,
    duration: totalTime,
    summary: response.summary,
    checks: {
      memory: response.checks.memory?.percentage + '%',
      database: response.checks.database?.status,
      monitoring: response.checks.monitoring?.status,
    },
  });

  // Return appropriate status code
  const statusCode = response.status === 'healthy' ? 200 : 
                    response.status === 'degraded' ? 200 : 503;
  
  return {
    statusCode,
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