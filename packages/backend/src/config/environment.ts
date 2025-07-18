/**
 * Environment configuration for Lambda functions
 */

interface EnvironmentConfig {
  // Database
  DATABASE_URL: string;
  
  // Authentication
  JWT_SECRET: string;
  COGNITO_USER_POOL_ID?: string;
  COGNITO_CLIENT_ID?: string;
  
  // API Configuration
  CORS_ORIGIN: string;
  API_VERSION: string;
  
  // AWS Configuration
  AWS_REGION: string;
  STAGE: 'dev' | 'staging' | 'production';
  
  // External Services
  PUSHER_APP_ID?: string;
  PUSHER_KEY?: string;
  PUSHER_SECRET?: string;
  PUSHER_CLUSTER?: string;
  
  // Feature Flags
  ENABLE_REAL_TIME?: boolean;
  ENABLE_OFFLINE_SYNC?: boolean;
  
  // Logging
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
}

// Validate and return environment configuration
export function getEnvironmentConfig(): EnvironmentConfig {
  const stage = (process.env.STAGE || 'dev') as EnvironmentConfig['STAGE'];
  
  return {
    // Database
    DATABASE_URL: process.env.DATABASE_URL || '',
    
    // Authentication
    JWT_SECRET: process.env.JWT_SECRET || '',
    COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID,
    COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID,
    
    // API Configuration
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
    API_VERSION: 'v1',
    
    // AWS Configuration
    AWS_REGION: process.env.AWS_REGION || 'us-east-1',
    STAGE: stage,
    
    // External Services
    PUSHER_APP_ID: process.env.PUSHER_APP_ID,
    PUSHER_KEY: process.env.PUSHER_KEY,
    PUSHER_SECRET: process.env.PUSHER_SECRET,
    PUSHER_CLUSTER: process.env.PUSHER_CLUSTER || 'us2',
    
    // Feature Flags
    ENABLE_REAL_TIME: process.env.ENABLE_REAL_TIME === 'true',
    ENABLE_OFFLINE_SYNC: process.env.ENABLE_OFFLINE_SYNC === 'true',
    
    // Logging
    LOG_LEVEL: (process.env.LOG_LEVEL || 'info') as EnvironmentConfig['LOG_LEVEL'],
  };
}

// Validate required environment variables
export function validateEnvironment(): void {
  const config = getEnvironmentConfig();
  const requiredVars: (keyof EnvironmentConfig)[] = [
    'DATABASE_URL',
    'JWT_SECRET',
    'AWS_REGION',
  ];
  
  const missing = requiredVars.filter(key => !config[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Export singleton config
export const config = getEnvironmentConfig();