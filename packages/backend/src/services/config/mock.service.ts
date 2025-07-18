/**
 * Mock implementation of ConfigService for testing
 */

import {
  ConfigService,
  ConfigValue,
  ConfigParameter,
  ConfigError,
  ConfigErrorCode,
} from './types';

export class MockConfigService implements ConfigService {
  private configs: Map<string, ConfigValue> = new Map();
  private secrets: Map<string, string> = new Map();
  private parameters: Map<string, ConfigParameter> = new Map();
  private mockDelay: number = 0;
  private shouldFailNext: boolean = false;
  private nextFailureError: ConfigError | null = null;

  constructor() {
    // Add some default configs
    this.setDefaultConfigs();
  }

  // Helper methods for testing
  setMockDelay(ms: number): void {
    this.mockDelay = ms;
  }

  failNext(error?: ConfigError): void {
    this.shouldFailNext = true;
    this.nextFailureError = error || new ConfigError(
      'Mock failure',
      ConfigErrorCode.SERVICE_ERROR
    );
  }

  clearMockData(): void {
    this.configs.clear();
    this.secrets.clear();
    this.parameters.clear();
    this.shouldFailNext = false;
    this.nextFailureError = null;
    this.setDefaultConfigs();
  }

  getStoredConfigs(): Map<string, ConfigValue> {
    return new Map(this.configs);
  }

  getStoredSecrets(): Map<string, string> {
    return new Map(this.secrets);
  }

  // ConfigService implementation
  async getConfig(key: string): Promise<ConfigValue | null> {
    await this.delay();
    
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      throw this.nextFailureError!;
    }

    return this.configs.get(key) || null;
  }

  async getConfigs(keys: string[]): Promise<Map<string, ConfigValue>> {
    await this.delay();
    
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      throw this.nextFailureError!;
    }

    const results = new Map<string, ConfigValue>();
    
    for (const key of keys) {
      const config = this.configs.get(key);
      if (config) {
        results.set(key, config);
      }
    }

    return results;
  }

  async setConfig(key: string, value: ConfigValue): Promise<void> {
    await this.delay();
    
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      throw this.nextFailureError!;
    }

    if (!this.isValidKey(key)) {
      throw new ConfigError('Invalid key format', ConfigErrorCode.INVALID_KEY);
    }

    this.configs.set(key, {
      ...value,
      key,
      lastUpdated: new Date(),
      version: (this.configs.get(key)?.version || 0) + 1,
    });
  }

  async deleteConfig(key: string): Promise<void> {
    await this.delay();
    
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      throw this.nextFailureError!;
    }

    this.configs.delete(key);
  }

  async getSecret(key: string): Promise<string | null> {
    await this.delay();
    
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      throw this.nextFailureError!;
    }

    return this.secrets.get(key) || null;
  }

  async getSecrets(keys: string[]): Promise<Map<string, string>> {
    await this.delay();
    
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      throw this.nextFailureError!;
    }

    const results = new Map<string, string>();
    
    for (const key of keys) {
      const secret = this.secrets.get(key);
      if (secret) {
        results.set(key, secret);
      }
    }

    return results;
  }

  async setSecret(key: string, value: string, description?: string): Promise<void> {
    await this.delay();
    
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      throw this.nextFailureError!;
    }

    if (!this.isValidKey(key)) {
      throw new ConfigError('Invalid key format', ConfigErrorCode.INVALID_KEY);
    }

    this.secrets.set(key, value);
  }

  async deleteSecret(key: string): Promise<void> {
    await this.delay();
    
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      throw this.nextFailureError!;
    }

    this.secrets.delete(key);
  }

  async getParameter(path: string): Promise<ConfigParameter | null> {
    await this.delay();
    
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      throw this.nextFailureError!;
    }

    return this.parameters.get(path) || null;
  }

  async getParametersByPath(path: string, recursive: boolean = true): Promise<ConfigParameter[]> {
    await this.delay();
    
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      throw this.nextFailureError!;
    }

    const results: ConfigParameter[] = [];
    
    for (const [key, param] of this.parameters) {
      if (recursive) {
        if (key.startsWith(path)) {
          results.push(param);
        }
      } else {
        // Non-recursive: only direct children
        if (key.startsWith(path) && !key.slice(path.length).includes('/')) {
          results.push(param);
        }
      }
    }

    return results;
  }

  async setParameter(parameter: ConfigParameter): Promise<void> {
    await this.delay();
    
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      throw this.nextFailureError!;
    }

    this.parameters.set(parameter.path, {
      ...parameter,
      version: (this.parameters.get(parameter.path)?.version || 0) + 1,
      lastModified: new Date(),
    });
  }

  async deleteParameter(path: string): Promise<void> {
    await this.delay();
    
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      throw this.nextFailureError!;
    }

    this.parameters.delete(path);
  }

  async batchGetConfigs(prefix: string): Promise<Map<string, ConfigValue>> {
    await this.delay();
    
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      throw this.nextFailureError!;
    }

    const results = new Map<string, ConfigValue>();
    
    for (const [key, config] of this.configs) {
      if (key.startsWith(prefix)) {
        results.set(key, config);
      }
    }

    return results;
  }

  async batchGetSecrets(prefix: string): Promise<Map<string, string>> {
    await this.delay();
    
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      throw this.nextFailureError!;
    }

    const results = new Map<string, string>();
    
    for (const [key, secret] of this.secrets) {
      if (key.startsWith(prefix)) {
        results.set(key, secret);
      }
    }

    return results;
  }

  clearCache(): void {
    // Mock doesn't have a cache
  }

  async preloadCache(keys: string[]): Promise<void> {
    // Mock doesn't have a cache
    await this.delay();
  }

  // Helper methods
  private async delay(): Promise<void> {
    if (this.mockDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.mockDelay));
    }
  }

  private isValidKey(key: string): boolean {
    // Simple validation: no spaces, special characters
    return /^[a-zA-Z0-9_\-./]+$/.test(key);
  }

  private setDefaultConfigs(): void {
    // Add some default configs for testing
    this.configs.set('app.name', {
      key: 'app.name',
      value: 'Mile Quest',
      type: 'string',
      description: 'Application name',
      lastUpdated: new Date(),
      version: 1,
    });

    this.configs.set('app.environment', {
      key: 'app.environment',
      value: 'test',
      type: 'string',
      description: 'Environment',
      lastUpdated: new Date(),
      version: 1,
    });

    this.configs.set('app.debug', {
      key: 'app.debug',
      value: true,
      type: 'boolean',
      description: 'Debug mode',
      lastUpdated: new Date(),
      version: 1,
    });

    this.configs.set('app.maxTeamSize', {
      key: 'app.maxTeamSize',
      value: 50,
      type: 'number',
      description: 'Maximum team size',
      lastUpdated: new Date(),
      version: 1,
    });

    this.configs.set('app.features', {
      key: 'app.features',
      value: {
        achievements: true,
        leaderboards: true,
        privateActivities: true,
      },
      type: 'json',
      description: 'Feature flags',
      lastUpdated: new Date(),
      version: 1,
    });

    // Add some default secrets
    this.secrets.set('db.password', 'test-password');
    this.secrets.set('api.key', 'test-api-key');
    this.secrets.set('jwt.secret', 'test-jwt-secret');

    // Add some default parameters
    this.parameters.set('/mile-quest/dev/db/host', {
      path: '/mile-quest/dev/db/host',
      value: 'localhost',
      type: 'String',
      version: 1,
      lastModified: new Date(),
    });

    this.parameters.set('/mile-quest/dev/db/port', {
      path: '/mile-quest/dev/db/port',
      value: '5432',
      type: 'String',
      version: 1,
      lastModified: new Date(),
    });
  }
}