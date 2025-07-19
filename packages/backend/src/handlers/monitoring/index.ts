/**
 * Monitoring Handler
 * 
 * API endpoints for monitoring dashboard and administration
 */

import { createHandler, EnhancedContext } from '../../utils/lambda-handler';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { getMonitoring } from '../../services/monitoring/factory';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Main monitoring dashboard data
 */
async function dashboardHandler(
  event: APIGatewayProxyEvent,
  context: EnhancedContext
): Promise<{ statusCode: number; body: any }> {
  const { logger } = context;
  
  try {
    logger.info('Fetching monitoring dashboard data');
    
    const monitoring = await getMonitoring(prisma);
    const dashboardData = await monitoring.getDashboardData();
    
    logger.info('Dashboard data retrieved successfully', {
      systemStatus: dashboardData.system.health.system.status,
      activeAlerts: dashboardData.alerts.active.length,
      totalErrors: dashboardData.errors.statistics.totalErrors,
    });
    
    return {
      statusCode: 200,
      body: {
        success: true,
        data: dashboardData,
        timestamp: new Date().toISOString(),
      },
    };
    
  } catch (error) {
    logger.error('Failed to fetch dashboard data', error as Error);
    
    return {
      statusCode: 500,
      body: {
        success: false,
        error: 'Failed to fetch monitoring dashboard data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * System health check endpoint
 */
async function healthHandler(
  event: APIGatewayProxyEvent,
  context: EnhancedContext
): Promise<{ statusCode: number; body: any }> {
  const { logger } = context;
  
  try {
    const monitoring = await getMonitoring(prisma);
    const health = await monitoring.getMonitoringHealth();
    
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;
    
    return {
      statusCode,
      body: {
        status: health.status,
        services: health.services,
        details: health.details,
        timestamp: new Date().toISOString(),
      },
    };
    
  } catch (error) {
    logger.error('Health check failed', error as Error);
    
    return {
      statusCode: 503,
      body: {
        status: 'unhealthy',
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
    };
  }
}

/**
 * Metrics endpoint
 */
async function metricsHandler(
  event: APIGatewayProxyEvent,
  context: EnhancedContext
): Promise<{ statusCode: number; body: any }> {
  const { logger } = context;
  
  try {
    const monitoring = await getMonitoring(prisma);
    const timeRange = event.queryStringParameters?.timeRange || '24h';
    
    const [businessMetrics, technicalMetrics] = await Promise.all([
      monitoring.metrics.getBusinessMetrics(timeRange),
      Promise.all([
        monitoring.metrics.getMetricSummary('api.requests.total', timeRange),
        monitoring.metrics.getMetricSummary('database.operations.total', timeRange),
        monitoring.metrics.getMetricSummary('errors.total', timeRange),
      ]),
    ]);
    
    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          business: businessMetrics,
          technical: {
            requests: technicalMetrics[0],
            database: technicalMetrics[1],
            errors: technicalMetrics[2],
          },
          timeRange,
        },
        timestamp: new Date().toISOString(),
      },
    };
    
  } catch (error) {
    logger.error('Failed to fetch metrics', error as Error);
    
    return {
      statusCode: 500,
      body: {
        success: false,
        error: 'Failed to fetch metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Alerts endpoint
 */
async function alertsHandler(
  event: APIGatewayProxyEvent,
  context: EnhancedContext
): Promise<{ statusCode: number; body: any }> {
  const { logger } = context;
  
  try {
    const monitoring = await getMonitoring(prisma);
    const status = event.queryStringParameters?.status as 'firing' | 'resolved' | undefined;
    
    const [alerts, statistics, rules] = await Promise.all([
      monitoring.alerting.getAlerts(status),
      monitoring.alerting.getAlertStatistics(),
      monitoring.alerting.getRules(),
    ]);
    
    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          alerts: alerts.slice(0, 100), // Limit results
          statistics,
          rules,
        },
        timestamp: new Date().toISOString(),
      },
    };
    
  } catch (error) {
    logger.error('Failed to fetch alerts', error as Error);
    
    return {
      statusCode: 500,
      body: {
        success: false,
        error: 'Failed to fetch alerts',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Logs endpoint
 */
async function logsHandler(
  event: APIGatewayProxyEvent,
  context: EnhancedContext
): Promise<{ statusCode: number; body: any }> {
  const { logger } = context;
  
  try {
    const monitoring = await getMonitoring(prisma);
    const params = event.queryStringParameters || {};
    
    // Build query from parameters
    const query: any = {
      limit: parseInt(params.limit || '100'),
      offset: parseInt(params.offset || '0'),
    };
    
    if (params.service) query.service = params.service;
    if (params.function) query.function = params.function;
    if (params.level) query.level = params.level;
    if (params.search) query.search = params.search;
    if (params.startTime) query.startTime = new Date(params.startTime);
    if (params.endTime) query.endTime = new Date(params.endTime);
    
    const [logs, statistics] = await Promise.all([
      monitoring.logAggregation.queryLogs(query),
      monitoring.logAggregation.getLogStatistics(),
    ]);
    
    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          logs,
          statistics,
          query,
        },
        timestamp: new Date().toISOString(),
      },
    };
    
  } catch (error) {
    logger.error('Failed to fetch logs', error as Error);
    
    return {
      statusCode: 500,
      body: {
        success: false,
        error: 'Failed to fetch logs',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Errors endpoint
 */
async function errorsHandler(
  event: APIGatewayProxyEvent,
  context: EnhancedContext
): Promise<{ statusCode: number; body: any }> {
  const { logger } = context;
  
  try {
    const monitoring = await getMonitoring(prisma);
    const timeRange = event.queryStringParameters?.timeRange || '24h';
    
    const [errors, summary, statistics] = await Promise.all([
      monitoring.errorTracking.getErrors(),
      monitoring.errorTracking.getErrorSummary(timeRange),
      monitoring.errorTracking.getErrorStats(timeRange),
    ]);
    
    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          errors: errors.slice(0, 100), // Limit results
          summary,
          statistics,
          timeRange,
        },
        timestamp: new Date().toISOString(),
      },
    };
    
  } catch (error) {
    logger.error('Failed to fetch errors', error as Error);
    
    return {
      statusCode: 500,
      body: {
        success: false,
        error: 'Failed to fetch errors',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Traces endpoint
 */
async function tracesHandler(
  event: APIGatewayProxyEvent,
  context: EnhancedContext
): Promise<{ statusCode: number; body: any }> {
  const { logger } = context;
  
  try {
    const monitoring = await getMonitoring(prisma);
    const params = event.queryStringParameters || {};
    
    // Build query from parameters
    const query: any = {
      limit: parseInt(params.limit || '50'),
    };
    
    if (params.service) query.service = params.service;
    if (params.operation) query.operation = params.operation;
    if (params.status) query.status = params.status;
    if (params.minDuration) query.minDuration = parseInt(params.minDuration);
    if (params.maxDuration) query.maxDuration = parseInt(params.maxDuration);
    
    const [traces, statistics] = await Promise.all([
      monitoring.tracing.getTraces(query),
      monitoring.tracing.getTraceStatistics(),
    ]);
    
    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          traces,
          statistics,
          query,
        },
        timestamp: new Date().toISOString(),
      },
    };
    
  } catch (error) {
    logger.error('Failed to fetch traces', error as Error);
    
    return {
      statusCode: 500,
      body: {
        success: false,
        error: 'Failed to fetch traces',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Uptime monitoring endpoint
 */
async function uptimeHandler(
  event: APIGatewayProxyEvent,
  context: EnhancedContext
): Promise<{ statusCode: number; body: any }> {
  const { logger } = context;
  
  try {
    const monitoring = await getMonitoring(prisma);
    
    const [checks, statistics, incidents] = await Promise.all([
      monitoring.uptimeMonitoring.getChecks(),
      monitoring.uptimeMonitoring.getOverallStatistics(),
      monitoring.uptimeMonitoring.getIncidents(),
    ]);
    
    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          checks,
          statistics,
          incidents: incidents.slice(0, 50), // Limit results
        },
        timestamp: new Date().toISOString(),
      },
    };
    
  } catch (error) {
    logger.error('Failed to fetch uptime data', error as Error);
    
    return {
      statusCode: 500,
      body: {
        success: false,
        error: 'Failed to fetch uptime data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Route handler based on path
 */
async function monitoringHandler(
  event: APIGatewayProxyEvent,
  context: EnhancedContext
): Promise<{ statusCode: number; body: any }> {
  const path = event.path || event.requestContext?.resourcePath || '';
  const method = event.httpMethod;
  
  // Only allow GET requests for monitoring endpoints
  if (method !== 'GET') {
    return {
      statusCode: 405,
      body: {
        success: false,
        error: 'Method not allowed',
        message: 'Only GET requests are supported for monitoring endpoints',
      },
    };
  }
  
  // Route to appropriate handler
  if (path.includes('/health')) {
    return healthHandler(event, context);
  } else if (path.includes('/metrics')) {
    return metricsHandler(event, context);
  } else if (path.includes('/alerts')) {
    return alertsHandler(event, context);
  } else if (path.includes('/logs')) {
    return logsHandler(event, context);
  } else if (path.includes('/errors')) {
    return errorsHandler(event, context);
  } else if (path.includes('/traces')) {
    return tracesHandler(event, context);
  } else if (path.includes('/uptime')) {
    return uptimeHandler(event, context);
  } else {
    // Default to dashboard
    return dashboardHandler(event, context);
  }
}

// Export handler
export const handler = createHandler(monitoringHandler, {
  enableCors: true,
  requireAuth: false, // Monitoring should be accessible for health checks
  functionName: 'monitoring',
});

// Cleanup Prisma connection on Lambda container shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});