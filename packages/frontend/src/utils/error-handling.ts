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
 * Log error to error reporting service (e.g., Sentry, LogRocket)
 */
export function logError(error: unknown, context?: Record<string, any>): void {
  // In production, this would send to an error reporting service
  console.error('Error logged:', {
    error,
    context,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : 'server',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
  });
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