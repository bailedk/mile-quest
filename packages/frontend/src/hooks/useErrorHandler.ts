'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getErrorMessage,
  isAuthenticationError,
  logError,
} from '@/utils/error-handling';

interface UseErrorHandlerOptions {
  onError?: (error: unknown) => void;
  showToast?: boolean;
  redirectOnAuth?: boolean;
}

export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleError = useCallback(
    (error: unknown) => {
      // Get user-friendly error message
      const message = getErrorMessage(error);
      setError(message);

      // Log error for monitoring
      logError(error);

      // Handle authentication errors
      if (isAuthenticationError(error) && options.redirectOnAuth) {
        router.push('/signin');
        return;
      }

      // Call custom error handler if provided
      if (options.onError) {
        options.onError(error);
      }

      // Show toast notification if enabled (would integrate with toast library)
      if (options.showToast) {
        // TODO: Integrate with toast notification system
        console.error('Toast:', message);
      }
    },
    [router, options]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const executeAsync = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | null> => {
      setIsLoading(true);
      setError(null);
      
      try {
        const result = await fn();
        return result;
      } catch (error) {
        handleError(error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  return {
    error,
    isLoading,
    handleError,
    clearError,
    executeAsync,
  };
}