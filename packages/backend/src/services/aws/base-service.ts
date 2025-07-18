/**
 * Base service class for all AWS service abstractions
 * Provides common functionality and patterns for AWS service implementations
 */

export interface ServiceConfig {
  region?: string;
  endpoint?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
}

export interface ServiceMetrics {
  recordSuccess(operation: string, duration: number): void;
  recordError(operation: string, error: any): void;
  recordMetric(name: string, value: number, unit?: string): void;
}

export abstract class BaseAWSService {
  protected config: ServiceConfig;
  protected metrics?: ServiceMetrics;
  protected serviceName: string;

  constructor(serviceName: string, config?: ServiceConfig, metrics?: ServiceMetrics) {
    this.serviceName = serviceName;
    this.config = {
      region: config?.region || process.env.AWS_REGION || 'us-east-1',
      endpoint: config?.endpoint,
      credentials: config?.credentials,
    };
    this.metrics = metrics;
  }

  /**
   * Execute an operation with automatic metrics tracking and error handling
   */
  protected async executeWithMetrics<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      
      if (this.metrics) {
        this.metrics.recordSuccess(`${this.serviceName}.${operation}`, duration);
      }
      
      return result;
    } catch (error) {
      if (this.metrics) {
        this.metrics.recordError(`${this.serviceName}.${operation}`, error);
      }
      throw this.mapError(error);
    }
  }

  /**
   * Map provider-specific errors to standard errors
   * Should be implemented by each service
   */
  protected abstract mapError(error: any): Error;

  /**
   * Validate configuration at startup
   */
  protected validateConfig(): void {
    if (!this.config.region) {
      throw new Error(`${this.serviceName}: AWS region is required`);
    }
  }

  /**
   * Get environment variable with fallback
   */
  protected getEnvVar(key: string, fallback?: string): string {
    const value = process.env[key];
    if (!value && !fallback) {
      throw new Error(`${this.serviceName}: Missing required environment variable: ${key}`);
    }
    return value || fallback!;
  }

  /**
   * Check if running in test environment
   */
  protected isTestEnvironment(): boolean {
    return process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
  }

  /**
   * Check if running in development environment
   */
  protected isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  /**
   * Get service health status
   */
  public async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      await this.performHealthCheck();
      return { healthy: true };
    } catch (error) {
      return { 
        healthy: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Perform service-specific health check
   * Should be implemented by each service
   */
  protected abstract performHealthCheck(): Promise<void>;
}

/**
 * Service registry for dependency injection
 */
export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private services: Map<string, any> = new Map();

  private constructor() {}

  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  register<T>(name: string, service: T): void {
    this.services.set(name, service);
  }

  get<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service not found: ${name}`);
    }
    return service as T;
  }

  has(name: string): boolean {
    return this.services.has(name);
  }

  clear(): void {
    this.services.clear();
  }

  /**
   * Initialize all registered services
   */
  async initialize(): Promise<void> {
    const initPromises: Promise<void>[] = [];
    
    for (const [name, service] of this.services) {
      if (typeof service.initialize === 'function') {
        initPromises.push(
          service.initialize().catch((error: any) => {
            console.error(`Failed to initialize service ${name}:`, error);
            throw error;
          })
        );
      }
    }
    
    await Promise.all(initPromises);
  }

  /**
   * Perform health checks on all registered services
   */
  async healthCheck(): Promise<Record<string, { healthy: boolean; message?: string }>> {
    const results: Record<string, { healthy: boolean; message?: string }> = {};
    
    for (const [name, service] of this.services) {
      if (typeof service.healthCheck === 'function') {
        try {
          results[name] = await service.healthCheck();
        } catch (error) {
          results[name] = {
            healthy: false,
            message: error instanceof Error ? error.message : 'Health check failed',
          };
        }
      }
    }
    
    return results;
  }
}

/**
 * Helper function to get the service registry instance
 */
export function getServiceRegistry(): ServiceRegistry {
  return ServiceRegistry.getInstance();
}