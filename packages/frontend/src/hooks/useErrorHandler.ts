'use client';

import { useCallback, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  getErrorMessage,
  isAuthenticationError,
  isNetworkError,
  isApiError,
  logError,
  retryWithBackoff,
} from '@/utils/error-handling';

interface UseErrorHandlerOptions {
  onError?: (error: unknown) => void;
  showToast?: boolean;
  redirectOnAuth?: boolean;
  enableRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

interface ErrorState {
  message: string;
  type: 'network' | 'auth' | 'validation' | 'server' | 'unknown';
  retryable: boolean;
  retryCount: number;
}

export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const router = useRouter();
  const [error, setError] = useState<ErrorState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout>();

  const {
    enableRetry = true,
    maxRetries = 3,
    retryDelay = 1000
  } = options;

  const categorizeError = useCallback((error: unknown): ErrorState => {
    const message = getErrorMessage(error);
    let type: ErrorState['type'] = 'unknown';
    let retryable = false;

    if (isNetworkError(error)) {
      type = 'network';
      retryable = true;
    } else if (isAuthenticationError(error)) {
      type = 'auth';
      retryable = false;
    } else if (isApiError(error)) {
      if (error.statusCode === 400) {
        type = 'validation';
        retryable = false;
      } else if (error.statusCode >= 500) {
        type = 'server';
        retryable = true;
      } else if (error.statusCode === 429) {
        type = 'server';
        retryable = true;
      }
    }

    return {
      message,
      type,
      retryable: retryable && enableRetry,
      retryCount: 0
    };
  }, [enableRetry]);

  const handleError = useCallback(
    (error: unknown, context?: string) => {
      const errorState = categorizeError(error);
      setError(errorState);

      // Log error for monitoring
      logError(error, { context, errorType: errorState.type });

      // Handle authentication errors
      if (errorState.type === 'auth' && options.redirectOnAuth) {
        router.push('/signin');
        return;
      }

      // Call custom error handler if provided
      if (options.onError) {
        options.onError(error);
      }

      // Show toast notification if enabled
      if (options.showToast) {
        // TODO: Integrate with toast notification system
        console.error('Toast:', errorState.message);
      }
    },
    [router, options, categorizeError]
  );

  const clearError = useCallback(() => {
    setError(null);
    setIsRetrying(false);
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
  }, []);

  const retry = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | null> => {
      if (!error?.retryable || error.retryCount >= maxRetries) {
        return null;
      }

      setIsRetrying(true);
      setError(prev => prev ? { ...prev, retryCount: prev.retryCount + 1 } : null);

      try {
        const result = await retryWithBackoff(fn, 1, retryDelay);
        clearError();
        return result;
      } catch (retryError) {
        handleError(retryError, 'retry');
        return null;
      } finally {
        setIsRetrying(false);
      }
    },
    [error, maxRetries, retryDelay, handleError, clearError]
  );

  const executeAsync = useCallback(
    async <T,>(fn: () => Promise<T>, context?: string): Promise<T | null> => {
      setIsLoading(true);
      setError(null);
      
      try {
        const result = await fn();
        return result;
      } catch (error) {
        handleError(error, context);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const executeWithRetry = useCallback(
    async <T,>(fn: () => Promise<T>, context?: string): Promise<T | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await retryWithBackoff(fn, maxRetries, retryDelay);
        return result;
      } catch (error) {
        handleError(error, context);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [handleError, maxRetries, retryDelay]
  );

  // Auto-retry for network errors
  const autoRetry = useCallback(
    async <T,>(fn: () => Promise<T>, delay: number = 5000): Promise<void> => {
      if (!error?.retryable || error.type !== 'network' || isRetrying) {
        return;
      }

      retryTimeoutRef.current = setTimeout(async () => {
        await retry(fn);
      }, delay);
    },
    [error, isRetrying, retry]
  );

  return {
    error,
    isLoading,
    isRetrying,
    handleError,
    clearError,
    retry,
    executeAsync,
    executeWithRetry,
    autoRetry,
    canRetry: error?.retryable && error.retryCount < maxRetries,
    retryCount: error?.retryCount || 0,
    maxRetries,
  };
}