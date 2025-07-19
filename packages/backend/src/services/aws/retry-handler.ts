/**
 * Retry handler for AWS services with exponential backoff and jitter
 */

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryableErrors: string[];
  jitterType?: 'none' | 'full' | 'equal';
}

export class RetryHandler {
  private config: Required<RetryConfig>;

  constructor(config: RetryConfig) {
    this.config = {
      jitterType: 'equal',
      ...config,
    };
  }

  /**
   * Execute a function with retry logic
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on the last attempt or if error is not retryable
        if (attempt === this.config.maxRetries || !this.isRetryableError(error)) {
          throw error;
        }
        
        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }
    
    throw lastError!;
  }

  /**
   * Check if an error is retryable based on configuration
   */
  private isRetryableError(error: any): boolean {
    const errorName = error.name || error.code || '';
    return this.config.retryableErrors.some(retryableError => 
      errorName.includes(retryableError)
    );
  }

  /**
   * Calculate delay with exponential backoff and optional jitter
   */
  private calculateDelay(attempt: number): number {
    // Exponential backoff: baseDelay * 2^attempt
    let delay = this.config.baseDelay * Math.pow(2, attempt);
    
    // Apply max delay limit
    delay = Math.min(delay, this.config.maxDelay);
    
    // Apply jitter
    switch (this.config.jitterType) {
      case 'full':
        delay = Math.random() * delay;
        break;
      case 'equal':
        delay = delay / 2 + Math.random() * (delay / 2);
        break;
      case 'none':
      default:
        // No jitter
        break;
    }
    
    return Math.floor(delay);
  }

  /**
   * Sleep for the specified number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create a retry handler with default AWS configuration
 */
export function createAWSRetryHandler(overrides?: Partial<RetryConfig>): RetryHandler {
  const defaultConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    retryableErrors: [
      'NetworkError',
      'TimeoutError',
      'ThrottlingException',
      'ServiceUnavailableException',
      'InternalServiceException',
      'TooManyRequestsException',
      'InternalServerError',
      'ServiceException',
    ],
    jitterType: 'equal',
  };

  return new RetryHandler({ ...defaultConfig, ...overrides });
}

/**
 * Common retry configurations for different AWS services
 */
export const RetryConfigs = {
  // For authentication services (Cognito)
  auth: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    retryableErrors: [
      'ThrottlingException',
      'TooManyRequestsException',
      'InternalServiceException',
      'ServiceUnavailableException',
      'NetworkError',
      'TimeoutError',
    ],
  },
  
  // For database operations
  database: {
    maxRetries: 5,
    baseDelay: 500,
    maxDelay: 15000,
    retryableErrors: [
      'ThrottlingException',
      'ProvisionedThroughputExceededException',
      'InternalServerError',
      'ServiceUnavailableException',
      'NetworkError',
      'TimeoutError',
    ],
  },
  
  // For email services
  email: {
    maxRetries: 3,
    baseDelay: 2000,
    maxDelay: 20000,
    retryableErrors: [
      'Throttling',
      'ServiceUnavailableException',
      'InternalServiceException',
      'NetworkError',
      'TimeoutError',
    ],
  },
} as const;