/**
 * Factory for creating WebSocketService instances based on configuration
 */

import { WebSocketService, WebSocketConfig } from './types';
import { PusherWebSocketService } from './pusher.service';
import { MockWebSocketService } from './mock.service';
import { ServiceConfig, ServiceMetrics } from '../aws/base-service';

export type WebSocketProvider = 'pusher' | 'mock' | 'apigateway';

export interface WebSocketServiceFactory {
  create(
    provider?: WebSocketProvider,
    config?: WebSocketConfig & ServiceConfig,
    metrics?: ServiceMetrics
  ): WebSocketService;
}

class DefaultWebSocketServiceFactory implements WebSocketServiceFactory {
  create(
    provider?: WebSocketProvider,
    config?: WebSocketConfig & ServiceConfig,
    metrics?: ServiceMetrics
  ): WebSocketService {
    const wsProvider = provider || (process.env.WEBSOCKET_PROVIDER as WebSocketProvider) || 'pusher';

    switch (wsProvider) {
      case 'pusher':
        return new PusherWebSocketService(config, metrics);
      
      case 'mock':
        return new MockWebSocketService();
      
      case 'apigateway':
        // Placeholder for future API Gateway WebSocket implementation
        throw new Error('API Gateway WebSocket provider not yet implemented');
      
      default:
        throw new Error(`Unknown WebSocket provider: ${wsProvider}`);
    }
  }
}

// Singleton instance
let factory: WebSocketServiceFactory = new DefaultWebSocketServiceFactory();

/**
 * Create a WebSocketService instance based on environment configuration
 */
export function createWebSocketService(
  config?: WebSocketConfig & ServiceConfig,
  metrics?: ServiceMetrics
): WebSocketService {
  return factory.create(undefined, config, metrics);
}

/**
 * Create a WebSocketService instance with a specific provider
 */
export function createWebSocketServiceWithProvider(
  provider: WebSocketProvider,
  config?: WebSocketConfig & ServiceConfig,
  metrics?: ServiceMetrics
): WebSocketService {
  return factory.create(provider, config, metrics);
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