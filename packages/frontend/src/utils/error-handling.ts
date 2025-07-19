/**
 * Error handling utilities for Mile Quest
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: Record<string, string[]>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string = 'You do not have permission to perform this action') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NetworkError extends Error {
  constructor(message: string = 'Network connection error') {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Type guard to check if an error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Type guard to check if an error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Type guard to check if an error is an AuthenticationError
 */
export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

/**
 * Type guard to check if an error is an AuthorizationError
 */
export function isAuthorizationError(error: unknown): error is AuthorizationError {
  return error instanceof AuthorizationError;
}

/**
 * Type guard to check if an error is a NetworkError
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

/**
 * Get a user-friendly error message from any error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Custom error types
    if (error instanceof ApiError) {
      switch (error.statusCode) {
        case 400:
          return error.message || 'Invalid request. Please check your input.';
        case 401:
          return 'Please sign in to continue.';
        case 403:
          return 'You do not have permission to perform this action.';
        case 404:
          return 'The requested resource was not found.';
        case 409:
          return error.message || 'A conflict occurred. Please try again.';
        case 429:
          return 'Too many requests. Please try again later.';
        case 500:
          return 'An unexpected error occurred. Please try again later.';
        case 502:
        case 503:
        case 504:
          return 'Service temporarily unavailable. Please try again later.';
        default:
          return error.message || 'An unexpected error occurred.';
      }
    }
    
    if (error instanceof ValidationError) {
      const firstError = Object.values(error.errors)[0]?.[0];
      return firstError || 'Please check your input and try again.';
    }
    
    if (error instanceof AuthenticationError) {
      return error.message;
    }
    
    if (error instanceof AuthorizationError) {
      return error.message;
    }
    
    if (error instanceof NetworkError) {
      return 'Unable to connect to the server. Please check your internet connection.';
    }
    
    // Generic error - error is still Error type here
    return error.message || 'An unexpected error occurred.';
  }
  
  // Unknown error type
  return 'An unexpected error occurred.';
}

/**
 * Enhanced error logging with categorization and user context
 */
export function logError(error: unknown, context?: Record<string, any>): void {
  const errorData = {
    // Error details
    error: {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    },
    
    // Context information
    context: {
      ...context,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : 'server',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      
      // Browser/device info
      ...(typeof window !== 'undefined' && {
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        screen: {
          width: window.screen?.width,
          height: window.screen?.height,
        },
        connection: (navigator as any)?.connection ? {
          effectiveType: (navigator as any).connection.effectiveType,
          downlink: (navigator as any).connection.downlink,
        } : undefined,
      }),
    },
    
    // Error categorization
    category: categorizeErrorForLogging(error),
    severity: getSeverityLevel(error),
    
    // User context (if available)
    user: getUserContextForLogging(),
  };

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.group('🚨 Error Logged');
    console.error('Error:', error);
    console.log('Context:', errorData.context);
    console.log('Category:', errorData.category);
    console.log('Severity:', errorData.severity);
    console.groupEnd();
  }

  // In production, send to error reporting service
  if (process.env.NODE_ENV === 'production') {
    // This would integrate with services like Sentry, LogRocket, or custom analytics
    try {
      // Example: Sentry.captureException(error, { extra: errorData });
      // Example: LogRocket.captureException(error);
      
      // For now, send to a custom endpoint or console
      console.error('Production Error:', errorData);
      
      // Could also send to analytics
      sendErrorToAnalytics(errorData);
    } catch (loggingError) {
      console.error('Failed to log error:', loggingError);
    }
  }
}

/**
 * Categorize errors for better logging and monitoring
 */
function categorizeErrorForLogging(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.statusCode >= 500) return 'server_error';
    if (error.statusCode >= 400) return 'client_error';
    return 'api_error';
  }
  
  if (error instanceof NetworkError) return 'network_error';
  if (error instanceof AuthenticationError) return 'auth_error';
  if (error instanceof AuthorizationError) return 'auth_error';
  if (error instanceof ValidationError) return 'validation_error';
  
  if (error instanceof Error) {
    if (error.name === 'ChunkLoadError') return 'chunk_load_error';
    if (error.name === 'TypeError') return 'type_error';
    if (error.name === 'ReferenceError') return 'reference_error';
    if (error.name === 'SyntaxError') return 'syntax_error';
  }
  
  return 'unknown_error';
}

/**
 * Determine error severity level
 */
function getSeverityLevel(error: unknown): 'low' | 'medium' | 'high' | 'critical' {
  if (error instanceof ApiError) {
    if (error.statusCode >= 500) return 'high';
    if (error.statusCode === 401) return 'medium';
    if (error.statusCode >= 400) return 'low';
  }
  
  if (error instanceof NetworkError) return 'medium';
  if (error instanceof AuthenticationError) return 'medium';
  if (error instanceof ValidationError) return 'low';
  
  if (error instanceof Error) {
    if (error.name === 'ChunkLoadError') return 'medium';
    if (error.name === 'TypeError' && error.message.includes('Cannot read')) return 'high';
  }
  
  return 'medium';
}

/**
 * Get user context for error logging (without PII)
 */
function getUserContextForLogging(): Record<string, any> | undefined {
  if (typeof window === 'undefined') return undefined;
  
  try {
    // This would integrate with your auth system
    // For now, return basic session info without PII
    return {
      isAuthenticated: localStorage.getItem('auth_token') ? true : false,
      sessionDuration: getSessionDuration(),
      // Don't include email, name, or other PII
    };
  } catch {
    return undefined;
  }
}

/**
 * Get session duration for context
 */
function getSessionDuration(): number | undefined {
  if (typeof window === 'undefined') return undefined;
  
  try {
    const sessionStart = localStorage.getItem('session_start');
    if (sessionStart) {
      return Date.now() - parseInt(sessionStart);
    }
  } catch {
    // Ignore localStorage errors
  }
  
  return undefined;
}

/**
 * Send error data to analytics service
 */
function sendErrorToAnalytics(errorData: any): void {
  // This would integrate with your analytics service
  // Example: Google Analytics, Mixpanel, etc.
  
  try {
    // Example analytics event
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'exception', {
        description: errorData.error.name,
        fatal: errorData.severity === 'critical',
        custom_map: {
          category: errorData.category,
          severity: errorData.severity,
        }
      });
    }
  } catch {
    // Ignore analytics errors
  }
}

/**
 * Handle API response errors
 */
export async function handleApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorData: any = {};
    let errorMessage = 'An error occurred';
    
    try {
      errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      // Response might not be JSON
      errorMessage = response.statusText || errorMessage;
    }
    
    // Handle validation errors specially
    if (response.status === 400 && errorData.errors) {
      throw new ValidationError(errorMessage, errorData.errors);
    }
    
    throw new ApiError(
      errorMessage,
      response.status,
      errorData.code,
      errorData
    );
  }
  
  // Handle empty responses
  if (response.status === 204) {
    return {} as T;
  }
  
  return response.json();
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: unknown;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on client errors (4xx)
      if (isApiError(error) && error.statusCode >= 400 && error.statusCode < 500) {
        throw error;
      }
      
      // Don't retry on the last attempt
      if (i === maxRetries - 1) {
        throw error;
      }
      
      // Exponential backoff with jitter
      const delay = initialDelay * Math.pow(2, i) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}