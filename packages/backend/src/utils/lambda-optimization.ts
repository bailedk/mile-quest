/**
 * Lambda Cold Start Optimization Utilities - BE-701
 * Techniques to minimize Lambda cold start times and improve performance
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { apiPerformanceService } from '../services/performance-monitoring/api-performance.service';

// Global variables for connection reuse
let globalConnections: {
  database?: any;
  cache?: any;
  websocket?: any;
  initialized: boolean;
  initTime?: number;
} = {
  initialized: false,
};

// Pre-compute expensive operations
let precomputedData: {
  achievements?: any[];
  systemConfig?: any;
  staticData?: any;
  lastUpdated?: number;
} = {};

interface LambdaOptimizationConfig {
  enableConnectionReuse?: boolean;
  enablePrecomputation?: boolean;
  enableWarmup?: boolean;
  preloadModules?: string[];
  connectionTimeout?: number;
  cacheStaticData?: boolean;
}

export class LambdaOptimizer {
  private config: Required<LambdaOptimizationConfig>;
  private isColdStart = true;
  private initStartTime = Date.now();

  constructor(config: LambdaOptimizationConfig = {}) {
    this.config = {
      enableConnectionReuse: config.enableConnectionReuse !== false,
      enablePrecomputation: config.enablePrecomputation !== false,
      enableWarmup: config.enableWarmup !== false,
      preloadModules: config.preloadModules || [],
      connectionTimeout: config.connectionTimeout || 30000,
      cacheStaticData: config.cacheStaticData !== false,
    };
  }

  /**
   * Initialize Lambda optimizations
   */
  async initialize(): Promise<void> {
    if (globalConnections.initialized) {
      this.isColdStart = false;
      return;
    }

    const initStart = Date.now();
    console.log('🥶 Cold start detected - initializing optimizations...');

    try {
      // Parallel initialization of services
      const initPromises: Promise<any>[] = [];

      // Preload critical modules
      if (this.config.preloadModules.length > 0) {
        initPromises.push(this.preloadModules());
      }

      // Initialize connection pools
      if (this.config.enableConnectionReuse) {
        initPromises.push(this.initializeConnections());
      }

      // Precompute static data
      if (this.config.enablePrecomputation) {
        initPromises.push(this.precomputeStaticData());
      }

      await Promise.all(initPromises);

      globalConnections.initialized = true;
      globalConnections.initTime = Date.now() - initStart;

      console.log(`✅ Lambda optimizations initialized in ${globalConnections.initTime}ms`);
    } catch (error) {
      console.error('❌ Failed to initialize Lambda optimizations:', error);
      // Continue execution even if optimizations fail
    }
  }

  /**
   * Wrap handler with optimization middleware
   */
  optimizeHandler<T extends APIGatewayProxyEvent>(
    handler: (event: T, context: Context) => Promise<APIGatewayProxyResult>
  ) {
    return async (event: T, context: Context): Promise<APIGatewayProxyResult> => {
      const requestStart = Date.now();
      
      // Initialize optimizations if needed
      await this.initialize();

      // Set Lambda context optimizations
      this.optimizeContext(context);

      try {
        // Execute the handler
        const response = await handler(event, context);

        // Record performance metrics
        await this.recordPerformanceMetrics(event, response, context, requestStart, this.isColdStart);

        // Add performance headers
        return this.addPerformanceHeaders(response, requestStart);
      } catch (error) {
        console.error('Handler execution error:', error);
        throw error;
      } finally {
        this.isColdStart = false;
      }
    };
  }

  /**
   * Preload critical modules to reduce require() time
   */
  private async preloadModules(): Promise<void> {
    const preloadStart = Date.now();
    
    try {
      // Preload common modules that are likely to be used
      const criticalModules = [
        '../lib/database',
        '../services/cache',
        '../middleware/auth.middleware',
        ...this.config.preloadModules,
      ];

      await Promise.all(
        criticalModules.map(async (modulePath) => {
          try {
            await import(modulePath);
          } catch (error) {
            console.warn(`Failed to preload module ${modulePath}:`, error);
          }
        })
      );

      console.log(`📦 Preloaded ${criticalModules.length} modules in ${Date.now() - preloadStart}ms`);
    } catch (error) {
      console.error('Module preloading failed:', error);
    }
  }

  /**
   * Initialize and cache database connections
   */
  private async initializeConnections(): Promise<void> {
    const connStart = Date.now();

    try {
      // Import and initialize database connection
      const { prisma, getConnectionPool } = await import('../lib/database');
      
      // Test database connection
      await prisma.$queryRaw`SELECT 1`;
      globalConnections.database = prisma;

      // Initialize connection pool if in Lambda environment
      if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
        const pool = getConnectionPool();
        await pool.healthCheck();
      }

      // Initialize cache connection
      const { cache } = await import('../utils/cache');
      await cache.get('warmup-test'); // Test cache connection
      globalConnections.cache = cache;

      console.log(`🔗 Initialized connections in ${Date.now() - connStart}ms`);
    } catch (error) {
      console.error('Connection initialization failed:', error);
    }
  }

  /**
   * Precompute static data that's frequently accessed
   */
  private async precomputeStaticData(): Promise<void> {
    if (!this.config.cacheStaticData) return;

    const precompStart = Date.now();
    
    try {
      // Only precompute if data is stale (older than 5 minutes)
      const now = Date.now();
      if (precomputedData.lastUpdated && (now - precomputedData.lastUpdated) < 300000) {
        return;
      }

      const computePromises: Promise<any>[] = [];

      // Precompute achievements if needed
      computePromises.push(
        this.safePrecompute('achievements', async () => {
          const { cache } = await import('../utils/cache');
          return await cache.get('system:achievements') || [];
        })
      );

      // Precompute system configuration
      computePromises.push(
        this.safePrecompute('systemConfig', async () => {
          return {
            environment: process.env.NODE_ENV,
            region: process.env.AWS_REGION,
            version: process.env.npm_package_version || '1.0.0',
          };
        })
      );

      await Promise.all(computePromises);
      precomputedData.lastUpdated = now;

      console.log(`💾 Precomputed static data in ${Date.now() - precompStart}ms`);
    } catch (error) {
      console.error('Static data precomputation failed:', error);
    }
  }

  /**
   * Safely precompute data with error handling
   */
  private async safePrecompute<T>(
    key: keyof typeof precomputedData,
    computeFn: () => Promise<T>
  ): Promise<void> {
    try {
      const result = await computeFn();
      (precomputedData as any)[key] = result;
    } catch (error) {
      console.warn(`Failed to precompute ${key}:`, error);
    }
  }

  /**
   * Optimize Lambda context settings
   */
  private optimizeContext(context: Context): void {
    // Increase memory allocation suggestion if consistently high usage
    if (process.memoryUsage().heapUsed > 400 * 1024 * 1024) { // > 400MB
      console.warn('🧠 High memory usage detected - consider increasing Lambda memory allocation');
    }

    // Log remaining time if very low
    if (context.getRemainingTimeInMillis && context.getRemainingTimeInMillis() < 5000) {
      console.warn('⏰ Low remaining execution time:', context.getRemainingTimeInMillis());
    }
  }

  /**
   * Record performance metrics for monitoring
   */
  private async recordPerformanceMetrics(
    event: APIGatewayProxyEvent,
    response: APIGatewayProxyResult,
    context: Context,
    startTime: number,
    coldStart: boolean
  ): Promise<void> {
    try {
      await apiPerformanceService.recordRequest(
        event,
        response,
        context,
        startTime,
        coldStart
      );
    } catch (error) {
      console.error('Failed to record performance metrics:', error);
    }
  }

  /**
   * Add performance-related headers to response
   */
  private addPerformanceHeaders(
    response: APIGatewayProxyResult,
    startTime: number
  ): APIGatewayProxyResult {
    const headers = {
      ...response.headers,
      'X-Response-Time': `${Date.now() - startTime}ms`,
      'X-Cold-Start': this.isColdStart.toString(),
    };

    if (globalConnections.initTime) {
      headers['X-Init-Time'] = `${globalConnections.initTime}ms`;
    }

    // Add cache status if available
    if (globalConnections.cache) {
      headers['X-Cache-Available'] = 'true';
    }

    return {
      ...response,
      headers,
    };
  }

  /**
   * Get precomputed data
   */
  static getPrecomputedData<T>(key: keyof typeof precomputedData): T | undefined {
    return precomputedData[key] as T;
  }

  /**
   * Check if connections are initialized
   */
  static isInitialized(): boolean {
    return globalConnections.initialized;
  }

  /**
   * Get initialization time
   */
  static getInitTime(): number | undefined {
    return globalConnections.initTime;
  }
}

/**
 * Create optimized handler wrapper
 */
export function withOptimization<T extends APIGatewayProxyEvent>(
  handler: (event: T, context: Context) => Promise<APIGatewayProxyResult>,
  config?: LambdaOptimizationConfig
) {
  const optimizer = new LambdaOptimizer(config);
  return optimizer.optimizeHandler(handler);
}

/**
 * Lambda warmup handler to keep functions warm
 */
export async function warmupHandler(
  event: any,
  context: Context
): Promise<APIGatewayProxyResult> {
  // Check if this is a warmup event
  if (event.source === 'warmup') {
    console.log('🔥 Warmup invocation - keeping Lambda warm');
    
    // Initialize optimizations
    const optimizer = new LambdaOptimizer();
    await optimizer.initialize();
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Lambda warmed up successfully',
        timestamp: new Date().toISOString(),
        coldStart: false,
        initTime: LambdaOptimizer.getInitTime(),
      }),
    };
  }

  // Not a warmup event
  return {
    statusCode: 400,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      error: 'Not a warmup event',
    }),
  };
}

/**
 * Memory usage monitoring utility
 */
export function monitorMemoryUsage(): {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  usagePercent: number;
} {
  const usage = process.memoryUsage();
  const usagePercent = (usage.heapUsed / usage.heapTotal) * 100;
  
  return {
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
    external: Math.round(usage.external / 1024 / 1024), // MB
    rss: Math.round(usage.rss / 1024 / 1024), // MB
    usagePercent: Math.round(usagePercent * 100) / 100,
  };
}

/**
 * Create a singleton optimizer instance
 */
export const lambdaOptimizer = new LambdaOptimizer({
  enableConnectionReuse: true,
  enablePrecomputation: true,
  enableWarmup: true,
  cacheStaticData: true,
  preloadModules: [
    '../services/auth',
    '../services/team',
    '../services/activity',
    '../services/websocket',
  ],
});