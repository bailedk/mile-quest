/**
 * Factory for creating ConfigService instances based on configuration
 */

import { ConfigService, ConfigServiceOptions } from './types';
import { SSMConfigService } from './ssm.service';
import { MockConfigService } from './mock.service';
import { ServiceConfig, ServiceMetrics } from '../aws/base-service';

export type ConfigProvider = 'ssm' | 'mock' | 'vault' | 'consul';

export interface ConfigServiceFactory {
  create(
    provider?: ConfigProvider,
    options?: ConfigServiceOptions & ServiceConfig,
    metrics?: ServiceMetrics
  ): ConfigService;
}

class DefaultConfigServiceFactory implements ConfigServiceFactory {
  create(
    provider?: ConfigProvider,
    options?: ConfigServiceOptions & ServiceConfig,
    metrics?: ServiceMetrics
  ): ConfigService {
    const configProvider = provider || (process.env.CONFIG_PROVIDER as ConfigProvider) || 'ssm';

    switch (configProvider) {
      case 'ssm':
        return new SSMConfigService(options, metrics);
      
      case 'mock':
        return new MockConfigService();
      
      case 'vault':
        // Placeholder for future HashiCorp Vault implementation
        throw new Error('Vault provider not yet implemented');
      
      case 'consul':
        // Placeholder for future Consul implementation
        throw new Error('Consul provider not yet implemented');
      
      default:
        throw new Error(`Unknown config provider: ${configProvider}`);
    }
  }
}

// Singleton instance
let factory: ConfigServiceFactory = new DefaultConfigServiceFactory();

/**
 * Create a ConfigService instance based on environment configuration
 */
export function createConfigService(
  options?: ConfigServiceOptions & ServiceConfig,
  metrics?: ServiceMetrics
): ConfigService {
  return factory.create(undefined, options, metrics);
}

/**
 * Create a ConfigService instance with a specific provider
 */
export function createConfigServiceWithProvider(
  provider: ConfigProvider,
  options?: ConfigServiceOptions & ServiceConfig,
  metrics?: ServiceMetrics
): ConfigService {
  return factory.create(provider, options, metrics);
}

/**
 * Set a custom factory implementation (useful for testing)
 */
export function setConfigServiceFactory(customFactory: ConfigServiceFactory): void {
  factory = customFactory;
}

/**
 * Reset to the default factory
 */
export function resetConfigServiceFactory(): void {
  factory = new DefaultConfigServiceFactory();
}