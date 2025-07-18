/**
 * AWS Systems Manager (SSM) Parameter Store implementation of ConfigService
 */

import {
  SSMClient,
  GetParameterCommand,
  GetParametersCommand,
  PutParameterCommand,
  DeleteParameterCommand,
  GetParametersByPathCommand,
  ParameterType,
  Parameter,
} from '@aws-sdk/client-ssm';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
  CreateSecretCommand,
  UpdateSecretCommand,
  DeleteSecretCommand,
  DescribeSecretCommand,
} from '@aws-sdk/client-secrets-manager';
import { BaseAWSService, ServiceConfig, ServiceMetrics } from '../aws/base-service';
import {
  ConfigService,
  ConfigValue,
  ConfigParameter,
  ConfigServiceOptions,
  ConfigError,
  ConfigErrorCode,
  ConfigCache,
} from './types';

class SimpleCache implements ConfigCache {
  private cache: Map<string, { value: any; expires: number }> = new Map();

  get(key: string): any {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  set(key: string, value: any, ttl: number = 300): void {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttl * 1000,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
}

export class SSMConfigService extends BaseAWSService implements ConfigService {
  private ssmClient: SSMClient;
  private secretsClient: SecretsManagerClient;
  private cache: ConfigCache;
  private cacheEnabled: boolean;
  private cacheTTL: number;
  private parameterPrefix: string;
  private secretPrefix: string;
  private encryptionKeyId?: string;

  constructor(options?: ConfigServiceOptions & ServiceConfig, metrics?: ServiceMetrics) {
    super('SSMConfig', options, metrics);
    
    this.cacheEnabled = options?.cacheEnabled ?? true;
    this.cacheTTL = options?.cacheTTL ?? 300; // 5 minutes default
    this.parameterPrefix = options?.parameterPrefix || '/mile-quest/';
    this.secretPrefix = options?.secretPrefix || 'mile-quest/';
    this.encryptionKeyId = options?.encryptionKeyId;
    
    this.ssmClient = new SSMClient({
      region: this.config.region,
      endpoint: this.config.endpoint,
      credentials: this.config.credentials,
    });
    
    this.secretsClient = new SecretsManagerClient({
      region: this.config.region,
      endpoint: this.config.endpoint,
      credentials: this.config.credentials,
    });
    
    this.cache = new SimpleCache();
    
    this.validateConfig();
  }

  async getConfig(key: string): Promise<ConfigValue | null> {
    return this.executeWithMetrics('getConfig', async () => {
      const cacheKey = `config:${key}`;
      
      if (this.cacheEnabled && this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      try {
        const parameterName = this.buildParameterName(key);
        const response = await this.ssmClient.send(
          new GetParameterCommand({
            Name: parameterName,
            WithDecryption: true,
          })
        );

        if (!response.Parameter) {
          return null;
        }

        const configValue = this.parameterToConfigValue(response.Parameter);
        
        if (this.cacheEnabled) {
          this.cache.set(cacheKey, configValue, this.cacheTTL);
        }
        
        return configValue;
      } catch (error: any) {
        if (error.name === 'ParameterNotFound') {
          return null;
        }
        throw this.mapError(error);
      }
    });
  }

  async getConfigs(keys: string[]): Promise<Map<string, ConfigValue>> {
    return this.executeWithMetrics('getConfigs', async () => {
      const results = new Map<string, ConfigValue>();
      const uncachedKeys: string[] = [];

      // Check cache first
      if (this.cacheEnabled) {
        for (const key of keys) {
          const cacheKey = `config:${key}`;
          if (this.cache.has(cacheKey)) {
            results.set(key, this.cache.get(cacheKey));
          } else {
            uncachedKeys.push(key);
          }
        }
      } else {
        uncachedKeys.push(...keys);
      }

      if (uncachedKeys.length === 0) {
        return results;
      }

      try {
        // Batch get from SSM (max 10 at a time)
        const chunks = this.chunkArray(uncachedKeys, 10);
        
        for (const chunk of chunks) {
          const parameterNames = chunk.map(key => this.buildParameterName(key));
          const response = await this.ssmClient.send(
            new GetParametersCommand({
              Names: parameterNames,
              WithDecryption: true,
            })
          );

          if (response.Parameters) {
            for (const param of response.Parameters) {
              const key = this.extractKeyFromParameterName(param.Name!);
              const configValue = this.parameterToConfigValue(param);
              results.set(key, configValue);
              
              if (this.cacheEnabled) {
                this.cache.set(`config:${key}`, configValue, this.cacheTTL);
              }
            }
          }
        }

        return results;
      } catch (error) {
        throw this.mapError(error);
      }
    });
  }

  async setConfig(key: string, value: ConfigValue): Promise<void> {
    return this.executeWithMetrics('setConfig', async () => {
      try {
        const parameterName = this.buildParameterName(key);
        const parameterType = value.type === 'string' && this.encryptionKeyId
          ? ParameterType.SECURE_STRING
          : ParameterType.STRING;
        
        let parameterValue: string;
        if (value.type === 'json' || typeof value.value === 'object') {
          parameterValue = JSON.stringify(value.value);
        } else {
          parameterValue = String(value.value);
        }

        await this.ssmClient.send(
          new PutParameterCommand({
            Name: parameterName,
            Value: parameterValue,
            Type: parameterType,
            Description: value.description,
            Overwrite: true,
            KeyId: this.encryptionKeyId,
          })
        );

        // Update cache
        if (this.cacheEnabled) {
          this.cache.set(`config:${key}`, value, this.cacheTTL);
        }
      } catch (error) {
        throw this.mapError(error);
      }
    });
  }

  async deleteConfig(key: string): Promise<void> {
    return this.executeWithMetrics('deleteConfig', async () => {
      try {
        const parameterName = this.buildParameterName(key);
        await this.ssmClient.send(
          new DeleteParameterCommand({
            Name: parameterName,
          })
        );

        // Remove from cache
        if (this.cacheEnabled) {
          this.cache.delete(`config:${key}`);
        }
      } catch (error: any) {
        if (error.name !== 'ParameterNotFound') {
          throw this.mapError(error);
        }
      }
    });
  }

  async getSecret(key: string): Promise<string | null> {
    return this.executeWithMetrics('getSecret', async () => {
      const cacheKey = `secret:${key}`;
      
      if (this.cacheEnabled && this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      try {
        const secretId = this.buildSecretId(key);
        const response = await this.secretsClient.send(
          new GetSecretValueCommand({
            SecretId: secretId,
          })
        );

        const secretValue = response.SecretString || '';
        
        if (this.cacheEnabled) {
          this.cache.set(cacheKey, secretValue, this.cacheTTL);
        }
        
        return secretValue;
      } catch (error: any) {
        if (error.name === 'ResourceNotFoundException') {
          return null;
        }
        throw this.mapError(error);
      }
    });
  }

  async getSecrets(keys: string[]): Promise<Map<string, string>> {
    return this.executeWithMetrics('getSecrets', async () => {
      const results = new Map<string, string>();
      
      // Secrets Manager doesn't support batch get, so we need to get them one by one
      const promises = keys.map(async key => {
        const value = await this.getSecret(key);
        if (value !== null) {
          results.set(key, value);
        }
      });

      await Promise.all(promises);
      return results;
    });
  }

  async setSecret(key: string, value: string, description?: string): Promise<void> {
    return this.executeWithMetrics('setSecret', async () => {
      const secretId = this.buildSecretId(key);
      
      try {
        // Try to update existing secret first
        await this.secretsClient.send(
          new UpdateSecretCommand({
            SecretId: secretId,
            SecretString: value,
            Description: description,
          })
        );
      } catch (error: any) {
        if (error.name === 'ResourceNotFoundException') {
          // Create new secret if it doesn't exist
          await this.secretsClient.send(
            new CreateSecretCommand({
              Name: secretId,
              SecretString: value,
              Description: description,
            })
          );
        } else {
          throw this.mapError(error);
        }
      }

      // Update cache
      if (this.cacheEnabled) {
        this.cache.set(`secret:${key}`, value, this.cacheTTL);
      }
    });
  }

  async deleteSecret(key: string): Promise<void> {
    return this.executeWithMetrics('deleteSecret', async () => {
      try {
        const secretId = this.buildSecretId(key);
        await this.secretsClient.send(
          new DeleteSecretCommand({
            SecretId: secretId,
            ForceDeleteWithoutRecovery: true,
          })
        );

        // Remove from cache
        if (this.cacheEnabled) {
          this.cache.delete(`secret:${key}`);
        }
      } catch (error: any) {
        if (error.name !== 'ResourceNotFoundException') {
          throw this.mapError(error);
        }
      }
    });
  }

  async getParameter(path: string): Promise<ConfigParameter | null> {
    return this.executeWithMetrics('getParameter', async () => {
      try {
        const response = await this.ssmClient.send(
          new GetParameterCommand({
            Name: path,
            WithDecryption: true,
          })
        );

        if (!response.Parameter) {
          return null;
        }

        return this.ssmParameterToConfigParameter(response.Parameter);
      } catch (error: any) {
        if (error.name === 'ParameterNotFound') {
          return null;
        }
        throw this.mapError(error);
      }
    });
  }

  async getParametersByPath(path: string, recursive: boolean = true): Promise<ConfigParameter[]> {
    return this.executeWithMetrics('getParametersByPath', async () => {
      const parameters: ConfigParameter[] = [];
      let nextToken: string | undefined;

      try {
        do {
          const response = await this.ssmClient.send(
            new GetParametersByPathCommand({
              Path: path,
              Recursive: recursive,
              WithDecryption: true,
              NextToken: nextToken,
            })
          );

          if (response.Parameters) {
            parameters.push(
              ...response.Parameters.map(p => this.ssmParameterToConfigParameter(p))
            );
          }

          nextToken = response.NextToken;
        } while (nextToken);

        return parameters;
      } catch (error) {
        throw this.mapError(error);
      }
    });
  }

  async setParameter(parameter: ConfigParameter): Promise<void> {
    return this.executeWithMetrics('setParameter', async () => {
      try {
        const parameterType = parameter.type as ParameterType || ParameterType.STRING;
        const value = typeof parameter.value === 'object'
          ? JSON.stringify(parameter.value)
          : String(parameter.value);

        await this.ssmClient.send(
          new PutParameterCommand({
            Name: parameter.path,
            Value: value,
            Type: parameterType,
            Overwrite: true,
            KeyId: parameterType === ParameterType.SECURE_STRING ? this.encryptionKeyId : undefined,
          })
        );
      } catch (error) {
        throw this.mapError(error);
      }
    });
  }

  async deleteParameter(path: string): Promise<void> {
    return this.executeWithMetrics('deleteParameter', async () => {
      try {
        await this.ssmClient.send(
          new DeleteParameterCommand({
            Name: path,
          })
        );
      } catch (error: any) {
        if (error.name !== 'ParameterNotFound') {
          throw this.mapError(error);
        }
      }
    });
  }

  async batchGetConfigs(prefix: string): Promise<Map<string, ConfigValue>> {
    return this.executeWithMetrics('batchGetConfigs', async () => {
      const path = this.parameterPrefix + prefix;
      const parameters = await this.getParametersByPath(path, true);
      const results = new Map<string, ConfigValue>();

      for (const param of parameters) {
        const key = this.extractKeyFromParameterName(param.path);
        const value = this.parseParameterValue(param.value);
        
        results.set(key, {
          key,
          value,
          type: this.detectValueType(value),
          lastUpdated: param.lastModified,
          version: param.version,
        });
      }

      return results;
    });
  }

  async batchGetSecrets(prefix: string): Promise<Map<string, string>> {
    // Secrets Manager doesn't have a good way to list secrets by prefix
    // In a real implementation, you might want to use tags or maintain a registry
    throw new Error('Batch get secrets not implemented for SSM provider');
  }

  clearCache(): void {
    this.cache.clear();
  }

  async preloadCache(keys: string[]): Promise<void> {
    if (!this.cacheEnabled) return;
    
    // Preload configs
    await this.getConfigs(keys);
    
    // Note: We don't preload secrets to avoid unnecessary secret access
  }

  protected async performHealthCheck(): Promise<void> {
    // Try to get a parameter to verify SSM access
    try {
      await this.ssmClient.send(
        new GetParameterCommand({
          Name: `${this.parameterPrefix}health-check`,
        })
      );
    } catch (error: any) {
      if (error.name !== 'ParameterNotFound') {
        throw error;
      }
    }
  }

  protected mapError(error: any): Error {
    if (error instanceof ConfigError) {
      return error;
    }

    const errorCode = error.name || error.Code || 'UNKNOWN_ERROR';
    const errorMessage = error.message || 'An unknown error occurred';

    switch (errorCode) {
      case 'ParameterNotFound':
      case 'ResourceNotFoundException':
        return new ConfigError('Configuration not found', ConfigErrorCode.NOT_FOUND, error);
      case 'AccessDeniedException':
        return new ConfigError('Access denied', ConfigErrorCode.ACCESS_DENIED, error);
      case 'InvalidParameter':
      case 'InvalidParameterValue':
        return new ConfigError('Invalid parameter', ConfigErrorCode.INVALID_VALUE, error);
      case 'ParameterAlreadyExists':
        return new ConfigError('Configuration already exists', ConfigErrorCode.ALREADY_EXISTS, error);
      case 'ParameterVersionMismatch':
        return new ConfigError('Version mismatch', ConfigErrorCode.VERSION_MISMATCH, error);
      default:
        return new ConfigError(errorMessage, ConfigErrorCode.UNKNOWN_ERROR, error);
    }
  }

  private buildParameterName(key: string): string {
    return `${this.parameterPrefix}${key}`;
  }

  private buildSecretId(key: string): string {
    return `${this.secretPrefix}${key}`;
  }

  private extractKeyFromParameterName(name: string): string {
    return name.replace(this.parameterPrefix, '');
  }

  private parameterToConfigValue(parameter: Parameter): ConfigValue {
    const key = this.extractKeyFromParameterName(parameter.Name!);
    const value = this.parseParameterValue(parameter.Value!);
    
    return {
      key,
      value,
      type: this.detectValueType(value),
      description: parameter.Description,
      lastUpdated: parameter.LastModifiedDate,
      version: parameter.Version,
    };
  }

  private ssmParameterToConfigParameter(parameter: Parameter): ConfigParameter {
    return {
      path: parameter.Name!,
      value: this.parseParameterValue(parameter.Value!),
      type: parameter.Type as any,
      version: parameter.Version,
      lastModified: parameter.LastModifiedDate,
    };
  }

  private parseParameterValue(value: string): any {
    // Try to parse as JSON
    try {
      return JSON.parse(value);
    } catch {
      // Try to parse as number
      const num = Number(value);
      if (!isNaN(num)) {
        return num;
      }
      
      // Try to parse as boolean
      if (value === 'true') return true;
      if (value === 'false') return false;
      
      // Return as string
      return value;
    }
  }

  private detectValueType(value: any): 'string' | 'number' | 'boolean' | 'json' {
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    return 'json';
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}