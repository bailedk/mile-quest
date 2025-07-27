/**
 * Main service exports and initialization
 */

import { getServiceRegistry } from './aws/base-service';
import { createAuthService } from './auth';
import { createWebSocketService } from './websocket';
import { createEmailService } from './email';
import { createConfigService } from './config';

// Export all service types and factories
export * from './auth';
export * from './websocket';
export * from './email';
export * from './config';
export * from './logger';
export * from './aws/base-service';
export * from './progress';
export * from './goal';

/**
 * Initialize all services and register them in the service registry
 * This should be called once at application startup
 */
export async function initializeServices(): Promise<void> {
  const registry = getServiceRegistry();
  
  // Clear any existing services
  registry.clear();
  
  // Create and register services based on environment configuration
  const authService = createAuthService();
  const webSocketService = createWebSocketService();
  const emailService = createEmailService();
  const configService = createConfigService();
  
  // Register services
  registry.register('auth', authService);
  registry.register('websocket', webSocketService);
  registry.register('email', emailService);
  registry.register('config', configService);
  
  // Initialize all services
  await registry.initialize();
}

/**
 * Get a typed service from the registry
 * Usage: const authService = getService<AuthService>('auth');
 */
export function getService<T>(name: string): T {
  return getServiceRegistry().get<T>(name);
}

/**
 * Perform health checks on all services
 */
export async function checkServicesHealth(): Promise<Record<string, { healthy: boolean; message?: string }>> {
  return getServiceRegistry().healthCheck();
}