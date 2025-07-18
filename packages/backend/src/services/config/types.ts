/**
 * Configuration service interface and types
 * Provider-agnostic configuration management abstraction
 */

export interface ConfigValue {
  key: string;
  value: string | number | boolean | object;
  type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  lastUpdated?: Date;
  version?: number;
}

export interface ConfigSecret {
  key: string;
  value: string;
  description?: string;
  lastUpdated?: Date;
  version?: number;
}

export interface ConfigParameter {
  path: string;
  value: string | object;
  type?: 'String' | 'StringList' | 'SecureString';
  version?: number;
  lastModified?: Date;
}

export interface ConfigService {
  // Configuration values (non-sensitive)
  getConfig(key: string): Promise<ConfigValue | null>;
  getConfigs(keys: string[]): Promise<Map<string, ConfigValue>>;
  setConfig(key: string, value: ConfigValue): Promise<void>;
  deleteConfig(key: string): Promise<void>;
  
  // Secrets (sensitive values)
  getSecret(key: string): Promise<string | null>;
  getSecrets(keys: string[]): Promise<Map<string, string>>;
  setSecret(key: string, value: string, description?: string): Promise<void>;
  deleteSecret(key: string): Promise<void>;
  
  // Parameter Store (hierarchical configuration)
  getParameter(path: string): Promise<ConfigParameter | null>;
  getParametersByPath(path: string, recursive?: boolean): Promise<ConfigParameter[]>;
  setParameter(parameter: ConfigParameter): Promise<void>;
  deleteParameter(path: string): Promise<void>;
  
  // Batch operations
  batchGetConfigs(prefix: string): Promise<Map<string, ConfigValue>>;
  batchGetSecrets(prefix: string): Promise<Map<string, string>>;
  
  // Cache management
  clearCache(): void;
  preloadCache(keys: string[]): Promise<void>;
}

export interface ConfigServiceOptions {
  region?: string;
  cacheEnabled?: boolean;
  cacheTTL?: number; // in seconds
  encryptionKeyId?: string;
  parameterPrefix?: string;
  secretPrefix?: string;
}

export class ConfigError extends Error {
  constructor(
    message: string,
    public code: ConfigErrorCode,
    public originalError?: any
  ) {
    super(message);
    this.name = 'ConfigError';
  }
}

export enum ConfigErrorCode {
  // Access errors
  NOT_FOUND = 'NOT_FOUND',
  ACCESS_DENIED = 'ACCESS_DENIED',
  
  // Validation errors
  INVALID_KEY = 'INVALID_KEY',
  INVALID_VALUE = 'INVALID_VALUE',
  INVALID_TYPE = 'INVALID_TYPE',
  
  // Operation errors
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  VERSION_MISMATCH = 'VERSION_MISMATCH',
  
  // Service errors
  SERVICE_ERROR = 'SERVICE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  
  // Other
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface ConfigCache {
  get(key: string): ConfigValue | string | null;
  set(key: string, value: ConfigValue | string, ttl?: number): void;
  delete(key: string): void;
  clear(): void;
  has(key: string): boolean;
}