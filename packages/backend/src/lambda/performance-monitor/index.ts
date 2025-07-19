/**
 * Performance Monitor Lambda handler - DB-008
 * Provides endpoints for monitoring materialized view performance
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { createHandler } from '../../utils/lambda-handler';
import { createRouter } from '../../utils/router';
import { validateEnvironment } from '../../config/environment';
import { verifyToken } from '../../utils/auth/jwt.utils';
import { prisma } from '../../lib/database';
import { MaterializedViewsService } from '../../services/materialized-views/materialized-views.service';
import { PerformanceMonitoringService } from '../../services/performance-monitoring/performance.service';
import { MaterializedViewsSchedulerService } from '../../services/scheduler/materialized-views-scheduler.service';

// Validate environment on cold start
validateEnvironment();

// Initialize services
const materializedViewsService = new MaterializedViewsService(prisma);
const performanceService = new PerformanceMonitoringService(prisma);
const schedulerService = new MaterializedViewsSchedulerService(
  prisma,
  materializedViewsService,
  performanceService
);

// Create router
const router = createRouter();

// Helper to extract user from token and check admin permissions
const getAdminUserFromEvent = (event: APIGatewayProxyEvent) => {
  const authHeader = event.headers.Authorization || event.headers.authorization;
  const token = authHeader?.split(' ')[1];
  
  if (!token) {
    throw new Error('No token provided');
  }
  
  const user = verifyToken(token);
  
  // In a real implementation, you'd check if user has admin permissions
  // For now, we'll allow any authenticated user to access performance metrics
  return user;
};

// Get performance report
router.get('/report', async (event, context, params) => {
  try {
    const user = getAdminUserFromEvent(event);
    
    const report = await performanceService.generatePerformanceReport();
    
    return {
      statusCode: 200,
      body: {
        report,
        generatedBy: user.sub,
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('Performance report error:', error);
    return {
      statusCode: 500,
      body: {
        error: 'Failed to generate performance report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
});

// Get materialized view statistics
router.get('/materialized-views', async (event, context, params) => {
  try {
    const user = getAdminUserFromEvent(event);
    
    const stats = await materializedViewsService.getViewStatistics();
    
    return {
      statusCode: 200,
      body: {
        materializedViews: stats,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('Materialized views stats error:', error);
    return {
      statusCode: 500,
      body: {
        error: 'Failed to get materialized view statistics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
});

// Refresh all materialized views
router.post('/materialized-views/refresh', async (event, context, params) => {
  try {
    const user = getAdminUserFromEvent(event);
    
    console.log(`Manual refresh requested by user ${user.sub}`);
    
    const results = await materializedViewsService.refreshAllViews();
    
    const successCount = results.filter(r => r.success).length;
    const totalTime = results.reduce((sum, r) => sum + r.durationMs, 0);
    
    return {
      statusCode: 200,
      body: {
        message: `Refreshed ${successCount}/${results.length} materialized views`,
        results,
        totalTimeMs: totalTime,
        triggeredBy: user.sub,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('Materialized views refresh error:', error);
    return {
      statusCode: 500,
      body: {
        error: 'Failed to refresh materialized views',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
});

// Refresh specific materialized view
router.post('/materialized-views/:viewName/refresh', async (event, context, params) => {
  try {
    const user = getAdminUserFromEvent(event);
    const { viewName } = params;
    
    if (!viewName) {
      return {
        statusCode: 400,
        body: {
          error: 'View name is required',
        },
      };
    }
    
    console.log(`Manual refresh of ${viewName} requested by user ${user.sub}`);
    
    const result = await materializedViewsService.refreshView(viewName);
    
    return {
      statusCode: result.success ? 200 : 500,
      body: {
        message: result.success 
          ? `Successfully refreshed ${viewName}` 
          : `Failed to refresh ${viewName}`,
        result,
        triggeredBy: user.sub,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('Materialized view refresh error:', error);
    return {
      statusCode: 500,
      body: {
        error: 'Failed to refresh materialized view',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
});

// Get scheduler status
router.get('/scheduler/status', async (event, context, params) => {
  try {
    const user = getAdminUserFromEvent(event);
    
    const status = await schedulerService.getSchedulerStatus();
    
    return {
      statusCode: 200,
      body: {
        scheduler: status,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('Scheduler status error:', error);
    return {
      statusCode: 500,
      body: {
        error: 'Failed to get scheduler status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
});

// Start scheduler
router.post('/scheduler/start', async (event, context, params) => {
  try {
    const user = getAdminUserFromEvent(event);
    
    await schedulerService.start();
    
    return {
      statusCode: 200,
      body: {
        message: 'Materialized views scheduler started',
        startedBy: user.sub,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('Scheduler start error:', error);
    return {
      statusCode: 500,
      body: {
        error: 'Failed to start scheduler',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
});

// Stop scheduler
router.post('/scheduler/stop', async (event, context, params) => {
  try {
    const user = getAdminUserFromEvent(event);
    
    schedulerService.stop();
    
    return {
      statusCode: 200,
      body: {
        message: 'Materialized views scheduler stopped',
        stoppedBy: user.sub,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('Scheduler stop error:', error);
    return {
      statusCode: 500,
      body: {
        error: 'Failed to stop scheduler',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
});

// Get dashboard performance metrics
router.get('/dashboard/metrics', async (event, context, params) => {
  try {
    const user = getAdminUserFromEvent(event);
    
    const metrics = await performanceService.getDashboardPerformanceMetrics();
    
    return {
      statusCode: 200,
      body: {
        dashboardMetrics: metrics,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    return {
      statusCode: 500,
      body: {
        error: 'Failed to get dashboard metrics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
});

// Detect performance issues
router.get('/issues', async (event, context, params) => {
  try {
    const user = getAdminUserFromEvent(event);
    
    const issues = await performanceService.detectPerformanceIssues();
    
    return {
      statusCode: 200,
      body: {
        issues,
        issueCount: issues.length,
        severity: issues.length > 5 ? 'high' : issues.length > 2 ? 'medium' : 'low',
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('Performance issues detection error:', error);
    return {
      statusCode: 500,
      body: {
        error: 'Failed to detect performance issues',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
});

// Get refresh recommendations
router.get('/recommendations', async (event, context, params) => {
  try {
    const user = getAdminUserFromEvent(event);
    
    const recommendations = await schedulerService.getRefreshRecommendations();
    
    return {
      statusCode: 200,
      body: {
        recommendations,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('Recommendations error:', error);
    return {
      statusCode: 500,
      body: {
        error: 'Failed to get recommendations',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
});

// Performance monitor handler
async function performanceMonitorHandler(event: APIGatewayProxyEvent, context: Context) {
  return router.handle(event, context);
}

// Export handler
export const handler = createHandler(performanceMonitorHandler);