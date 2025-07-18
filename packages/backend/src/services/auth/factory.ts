/**
 * Factory for creating AuthService instances based on configuration
 */

import { AuthService, AuthConfig } from './types';
import { CognitoAuthService } from './cognito.service';
import { MockAuthService } from './mock.service';
import { ServiceConfig, ServiceMetrics } from '../aws/base-service';

export type AuthProvider = 'cognito' | 'mock' | 'auth0' | 'supabase';

export interface AuthServiceFactory {
  create(
    provider?: AuthProvider,
    config?: AuthConfig & ServiceConfig,
    metrics?: ServiceMetrics
  ): AuthService;
}

class DefaultAuthServiceFactory implements AuthServiceFactory {
  create(
    provider?: AuthProvider,
    config?: AuthConfig & ServiceConfig,
    metrics?: ServiceMetrics
  ): AuthService {
    const authProvider = provider || (process.env.AUTH_PROVIDER as AuthProvider) || 'cognito';

    switch (authProvider) {
      case 'cognito':
        return new CognitoAuthService(config, metrics);
      
      case 'mock':
        return new MockAuthService();
      
      case 'auth0':
        // Placeholder for future Auth0 implementation
        throw new Error('Auth0 provider not yet implemented');
      
      case 'supabase':
        // Placeholder for future Supabase implementation
        throw new Error('Supabase provider not yet implemented');
      
      default:
        throw new Error(`Unknown auth provider: ${authProvider}`);
    }
  }
}

// Singleton instance
let factory: AuthServiceFactory = new DefaultAuthServiceFactory();

/**
 * Create an AuthService instance based on environment configuration
 */
export function createAuthService(
  config?: AuthConfig & ServiceConfig,
  metrics?: ServiceMetrics
): AuthService {
  return factory.create(undefined, config, metrics);
}

/**
 * Create an AuthService instance with a specific provider
 */
export function createAuthServiceWithProvider(
  provider: AuthProvider,
  config?: AuthConfig & ServiceConfig,
  metrics?: ServiceMetrics
): AuthService {
  return factory.create(provider, config, metrics);
}

/**
 * Set a custom factory implementation (useful for testing)
 */
export function setAuthServiceFactory(customFactory: AuthServiceFactory): void {
  factory = customFactory;
}

/**
 * Reset to the default factory
 */
export function resetAuthServiceFactory(): void {
  factory = new DefaultAuthServiceFactory();
}