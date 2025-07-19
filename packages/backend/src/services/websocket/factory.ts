/**
 * Factory for creating WebSocketService instances based on configuration
 * Enhanced with comprehensive configuration and connection management
 */

import { WebSocketService, WebSocketConfig } from './types';
import { PusherWebSocketService } from './pusher.service';
import { MockWebSocketService } from './mock.service';
import { ServiceConfig, ServiceMetrics } from '../aws/base-service';

export type WebSocketProvider = 'pusher' | 'mock' | 'apigateway';

export interface EnhancedWebSocketConfig extends WebSocketConfig {
  // Connection management
  enableRetries?: boolean;
  maxRetries?: number;
  retryBaseDelay?: number;
  connectionTimeout?: number;
  heartbeatInterval?: number;
  enableConnectionMonitoring?: boolean;
  batchSize?: number;
  
  // Mock service specific
  enableSimulatedLatency?: boolean;
  enableConnectionSimulation?: boolean;
  enableRandomFailures?: boolean;
  failureRate?: number;
  maxLatency?: number;
  enableMetrics?: boolean;
}

export interface WebSocketServiceFactory {
  create(
    provider?: WebSocketProvider,
    config?: EnhancedWebSocketConfig & ServiceConfig,
    metrics?: ServiceMetrics
  ): WebSocketService;
}

class DefaultWebSocketServiceFactory implements WebSocketServiceFactory {
  create(
    provider?: WebSocketProvider,
    config?: EnhancedWebSocketConfig & ServiceConfig,
    metrics?: ServiceMetrics
  ): WebSocketService {
    const wsProvider = provider || (process.env.WEBSOCKET_PROVIDER as WebSocketProvider) || 'pusher';

    // Apply default configuration based on environment
    const enhancedConfig = this.applyDefaultConfig(config, wsProvider);

    switch (wsProvider) {
      case 'pusher':
        return new PusherWebSocketService(enhancedConfig, metrics);
      
      case 'mock':
        return new MockWebSocketService({
          enableSimulatedLatency: enhancedConfig?.enableSimulatedLatency,
          enableConnectionSimulation: enhancedConfig?.enableConnectionSimulation,
          enableRandomFailures: enhancedConfig?.enableRandomFailures,
          failureRate: enhancedConfig?.failureRate,
          maxLatency: enhancedConfig?.maxLatency,
          enableMetrics: enhancedConfig?.enableMetrics,
        });
      
      case 'apigateway':
        // Placeholder for future API Gateway WebSocket implementation
        throw new Error('API Gateway WebSocket provider not yet implemented');
      
      default:
        throw new Error(`Unknown WebSocket provider: ${wsProvider}`);
    }
  }

  private applyDefaultConfig(
    config?: EnhancedWebSocketConfig & ServiceConfig,
    provider?: WebSocketProvider
  ): EnhancedWebSocketConfig & ServiceConfig {
    const isProduction = process.env.NODE_ENV === 'production';
    const isTest = process.env.NODE_ENV === 'test';
    
    const defaultConfig: Partial<EnhancedWebSocketConfig> = {
      // Production defaults
      enableRetries: isProduction,
      maxRetries: isProduction ? 5 : 3,
      retryBaseDelay: 1000,
      connectionTimeout: 30000,
      heartbeatInterval: isProduction ? 60000 : 30000,
      enableConnectionMonitoring: !isTest,
      batchSize: 10,
      
      // Mock service defaults for testing
      enableSimulatedLatency: isTest,
      enableConnectionSimulation: true,
      enableRandomFailures: false,
      failureRate: 0,
      maxLatency: isTest ? 100 : 1000,
      enableMetrics: !isTest,
    };

    // Override with provider-specific defaults
    if (provider === 'mock') {
      defaultConfig.enableRetries = false; // Mock doesn't need retries
      defaultConfig.enableConnectionMonitoring = false;
    }

    return {
      ...defaultConfig,
      ...config,
    };
  }
}

// Singleton instance
let factory: WebSocketServiceFactory = new DefaultWebSocketServiceFactory();

/**
 * Create a WebSocketService instance based on environment configuration
 */
export function createWebSocketService(
  config?: EnhancedWebSocketConfig & ServiceConfig,
  metrics?: ServiceMetrics
): WebSocketService {
  return factory.create(undefined, config, metrics);
}

/**
 * Create a WebSocketService instance with a specific provider
 */
export function createWebSocketServiceWithProvider(
  provider: WebSocketProvider,
  config?: EnhancedWebSocketConfig & ServiceConfig,
  metrics?: ServiceMetrics
): WebSocketService {
  return factory.create(provider, config, metrics);
}

/**
 * Create a production-optimized WebSocketService instance
 */
export function createProductionWebSocketService(
  provider?: WebSocketProvider,
  overrides?: Partial<EnhancedWebSocketConfig & ServiceConfig>,
  metrics?: ServiceMetrics
): WebSocketService {
  const productionConfig: EnhancedWebSocketConfig = {
    enableRetries: true,
    maxRetries: 5,
    retryBaseDelay: 1000,
    connectionTimeout: 30000,
    heartbeatInterval: 60000,
    enableConnectionMonitoring: true,
    batchSize: 10,
    encrypted: true,
    ...overrides,
  };
  
  return factory.create(provider || 'pusher', productionConfig, metrics);
}

/**
 * Create a testing-optimized WebSocketService instance
 */
export function createTestWebSocketService(
  overrides?: Partial<EnhancedWebSocketConfig & ServiceConfig>
): WebSocketService {
  const testConfig: EnhancedWebSocketConfig = {
    enableRetries: false,
    enableConnectionMonitoring: false,
    enableSimulatedLatency: true,
    enableConnectionSimulation: true,
    enableRandomFailures: false,
    maxLatency: 50,
    enableMetrics: true,
    ...overrides,
  };
  
  return factory.create('mock', testConfig);
}

/**
 * Set a custom factory implementation (useful for testing)
 */
export function setWebSocketServiceFactory(customFactory: WebSocketServiceFactory): void {
  factory = customFactory;
}

/**
 * Reset to the default factory
 */
export function resetWebSocketServiceFactory(): void {
  factory = new DefaultWebSocketServiceFactory();
}