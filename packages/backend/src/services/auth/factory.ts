/**
 * Factory for creating AuthService instances based on configuration
 */

import { AuthService, AuthConfig } from './types';
import { CognitoAuthService } from './cognito.service';
import { MockAuthService } from './mock.service';
import { ServiceConfig, ServiceMetrics } from '../aws/base-service';
import { RetryConfigs } from '../aws/retry-handler';

export type AuthProvider = 'cognito' | 'mock' | 'auth0' | 'supabase';

export interface AuthServiceFactory {
  create(
    provider?: AuthProvider,
    config?: AuthConfig & ServiceConfig,
    metrics?: ServiceMetrics
  ): AuthService;
  createWithDefaultConfig(provider?: AuthProvider): AuthService;
  getSupportedProviders(): AuthProvider[];
  validateProvider(provider: string): boolean;
}

class DefaultAuthServiceFactory implements AuthServiceFactory {
  private readonly supportedProviders: AuthProvider[] = ['cognito', 'mock', 'auth0', 'supabase'];

  create(
    provider?: AuthProvider,
    config?: AuthConfig & ServiceConfig,
    metrics?: ServiceMetrics
  ): AuthService {
    const authProvider = provider || this.getProviderFromEnvironment();

    if (!this.validateProvider(authProvider)) {
      throw new Error(`Unknown auth provider: ${authProvider}. Supported providers: ${this.supportedProviders.join(', ')}`);
    }

    const enhancedConfig = this.mergeDefaultConfig(config, authProvider);

    switch (authProvider) {
      case 'cognito':
        return new CognitoAuthService(enhancedConfig, metrics);
      
      case 'mock':
        const mockService = new MockAuthService();
        // Configure mock service based on config
        if (enhancedConfig?.autoRefresh !== undefined) {
          mockService.setAutoRefresh(enhancedConfig.autoRefresh);
        }
        if (enhancedConfig?.refreshThreshold !== undefined) {
          mockService.setRefreshThreshold(enhancedConfig.refreshThreshold);
        }
        return mockService;
      
      case 'auth0':
        // Placeholder for future Auth0 implementation
        throw new Error('Auth0 provider not yet implemented. Please use cognito or mock provider.');
      
      case 'supabase':
        // Placeholder for future Supabase implementation
        throw new Error('Supabase provider not yet implemented. Please use cognito or mock provider.');
      
      default:
        throw new Error(`Unknown auth provider: ${authProvider}`);
    }
  }

  createWithDefaultConfig(provider?: AuthProvider): AuthService {
    return this.create(provider, this.getDefaultConfig(provider));
  }

  getSupportedProviders(): AuthProvider[] {
    return [...this.supportedProviders];
  }

  validateProvider(provider: string): boolean {
    return this.supportedProviders.includes(provider as AuthProvider);
  }

  private getProviderFromEnvironment(): AuthProvider {
    const envProvider = process.env.AUTH_PROVIDER as AuthProvider;
    if (envProvider && this.validateProvider(envProvider)) {
      return envProvider;
    }
    
    // Default to mock in test/development, cognito in production
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
      return 'mock';
    }
    
    return 'cognito';
  }

  private getDefaultConfig(provider?: AuthProvider): AuthConfig & ServiceConfig {
    const baseConfig: AuthConfig & ServiceConfig = {
      region: process.env.AWS_REGION || 'us-east-1',
      autoRefresh: true,
      refreshThreshold: 300, // 5 minutes
    };

    const actualProvider = provider || this.getProviderFromEnvironment();

    switch (actualProvider) {
      case 'cognito':
        return {
          ...baseConfig,
          userPoolId: process.env.COGNITO_USER_POOL_ID,
          clientId: process.env.COGNITO_CLIENT_ID,
          retryConfig: RetryConfigs.auth,
        };
      
      case 'mock':
        return {
          ...baseConfig,
          // Mock doesn't need AWS config but we keep the structure consistent
        };
      
      default:
        return baseConfig;
    }
  }

  private mergeDefaultConfig(
    userConfig?: AuthConfig & ServiceConfig,
    provider?: AuthProvider
  ): AuthConfig & ServiceConfig {
    const defaultConfig = this.getDefaultConfig(provider);
    
    if (!userConfig) {
      return defaultConfig;
    }

    return {
      ...defaultConfig,
      ...userConfig,
      retryConfig: {
        ...defaultConfig.retryConfig,
        ...userConfig.retryConfig,
      },
    };
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

/**
 * Get the factory instance (useful for accessing factory methods directly)
 */
export function getAuthServiceFactory(): AuthServiceFactory {
  return factory;
}

/**
 * Check if a provider is supported
 */
export function isProviderSupported(provider: string): boolean {
  return factory.validateProvider(provider);
}

/**
 * Get list of supported providers
 */
export function getSupportedProviders(): AuthProvider[] {
  return factory.getSupportedProviders();
}

/**
 * Create auth service with environment-based provider selection and default config
 */
export function createDefaultAuthService(): AuthService {
  return factory.createWithDefaultConfig();
}