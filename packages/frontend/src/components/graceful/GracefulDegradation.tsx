'use client';

import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorMessage, LoadingState } from '@/components/error';
import { logError } from '@/utils/error-handling';

// Feature fallback configuration
interface FeatureFallback {
  component: React.ComponentType<any>;
  fallback?: ReactNode;
  errorMessage?: string;
  retryable?: boolean;
  timeout?: number;
}

// Graceful feature wrapper component
interface GracefulFeatureProps {
  feature: string;
  fallback?: ReactNode;
  errorMessage?: string;
  retryable?: boolean;
  timeout?: number;
  onError?: (error: Error) => void;
  children: ReactNode;
  className?: string;
}

export function GracefulFeature({
  feature,
  fallback,
  errorMessage = 'This feature is temporarily unavailable',
  retryable = true,
  timeout = 10000,
  onError,
  children,
  className = ''
}: GracefulFeatureProps) {
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (timeout > 0) {
      const timer = setTimeout(() => {
        setHasTimedOut(true);
        logError(new Error(`Feature timeout: ${feature}`), {
          feature,
          timeout,
          context: 'GracefulFeature'
        });
      }, timeout);

      return () => clearTimeout(timer);
    }
  }, [feature, timeout]);

  const handleRetry = useCallback(() => {
    setIsRetrying(true);
    setHasTimedOut(false);
    
    // Reset timeout
    setTimeout(() => {
      setIsRetrying(false);
    }, 100);
  }, []);

  const handleError = useCallback((error: Error) => {
    logError(error, {
      feature,
      context: 'GracefulFeature',
      gracefulDegradation: true
    });
    
    onError?.(error);
  }, [feature, onError]);

  if (hasTimedOut && !isRetrying) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className={className}>
        <ErrorMessage
          variant="warning"
          title="Feature Temporarily Unavailable"
          message={errorMessage}
          actions={
            retryable ? (
              <button
                onClick={handleRetry}
                className="inline-flex items-center px-3 py-1.5 bg-yellow-600 text-white text-sm font-medium rounded hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
              >
                Try Again
              </button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <ErrorBoundary
      context={`GracefulFeature:${feature}`}
      level="component"
      onError={handleError}
      fallback={
        fallback || (
          <div className={className}>
            <ErrorMessage
              variant="warning"
              title="Feature Error"
              message={errorMessage}
              actions={
                retryable ? (
                  <button
                    onClick={handleRetry}
                    className="inline-flex items-center px-3 py-1.5 bg-yellow-600 text-white text-sm font-medium rounded hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
                  >
                    Reload Feature
                  </button>
                ) : undefined
              }
            />
          </div>
        )
      }
    >
      <div className={className}>
        {children}
      </div>
    </ErrorBoundary>
  );
}

// HOC for adding graceful degradation to any component
export function withGracefulDegradation<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: {
    feature: string;
    fallback?: ReactNode;
    errorMessage?: string;
    retryable?: boolean;
    timeout?: number;
  }
) {
  const GracefulComponent = (props: P) => (
    <GracefulFeature {...options}>
      <WrappedComponent {...props} />
    </GracefulFeature>
  );

  GracefulComponent.displayName = `withGracefulDegradation(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return GracefulComponent;
}

// Hook for graceful async operations
interface UseGracefulAsyncOptions {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
  fallbackValue?: any;
  onError?: (error: Error) => void;
}

export function useGracefulAsync<T>(
  asyncFn: () => Promise<T>,
  dependencies: React.DependencyList,
  options: UseGracefulAsyncOptions = {}
) {
  const {
    retries = 2,
    retryDelay = 1000,
    timeout = 10000,
    fallbackValue = null,
    onError
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  const executeWithGrace = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setHasFailed(false);

    let attempt = 0;
    let lastError: Error;

    while (attempt <= retries) {
      try {
        // Add timeout to the promise
        const result = await Promise.race([
          asyncFn(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Operation timeout')), timeout)
          )
        ]);
        
        setData(result);
        setIsLoading(false);
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        attempt++;
        
        if (attempt <= retries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        }
      }
    }

    // All attempts failed
    setError(lastError!);
    setHasFailed(true);
    setIsLoading(false);
    
    logError(lastError!, {
      attempts: retries + 1,
      timeout,
      context: 'useGracefulAsync',
      gracefulDegradation: true
    });
    
    onError?.(lastError!);
    
    // Return fallback value
    setData(fallbackValue);
    return fallbackValue;
  }, [asyncFn, retries, retryDelay, timeout, fallbackValue, onError]);

  useEffect(() => {
    executeWithGrace();
  }, dependencies);

  const retry = useCallback(() => {
    executeWithGrace();
  }, [executeWithGrace]);

  return {
    data,
    error,
    isLoading,
    hasFailed,
    retry,
    canRetry: hasFailed && !isLoading
  };
}

// Progressive enhancement wrapper
interface ProgressiveEnhancementProps {
  baseline: ReactNode;
  enhanced?: ReactNode;
  condition?: boolean;
  fallbackDelay?: number;
  children?: ReactNode;
}

export function ProgressiveEnhancement({
  baseline,
  enhanced,
  condition = true,
  fallbackDelay = 3000,
  children
}: ProgressiveEnhancementProps) {
  const [showBaseline, setShowBaseline] = useState(false);

  useEffect(() => {
    if (!condition) {
      const timer = setTimeout(() => {
        setShowBaseline(true);
      }, fallbackDelay);

      return () => clearTimeout(timer);
    }
  }, [condition, fallbackDelay]);

  if (!condition && showBaseline) {
    return <>{baseline}</>;
  }

  if (!condition && !showBaseline) {
    return <LoadingState message="Loading enhanced features..." />;
  }

  return (
    <ErrorBoundary
      context="ProgressiveEnhancement"
      fallback={baseline}
      level="component"
    >
      {enhanced || children}
    </ErrorBoundary>
  );
}

// Conditional feature component
interface ConditionalFeatureProps {
  condition: boolean;
  children: ReactNode;
  fallback?: ReactNode;
  loading?: ReactNode;
  isLoading?: boolean;
}

export function ConditionalFeature({
  condition,
  children,
  fallback,
  loading,
  isLoading = false
}: ConditionalFeatureProps) {
  if (isLoading && loading) {
    return <>{loading}</>;
  }

  if (!condition) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    <ErrorBoundary
      context="ConditionalFeature"
      fallback={fallback}
      level="component"
    >
      {children}
    </ErrorBoundary>
  );
}

// Network-aware component
interface NetworkAwareProps {
  children: ReactNode;
  offlineFallback?: ReactNode;
  slowNetworkFallback?: ReactNode;
  className?: string;
}

export function NetworkAware({
  children,
  offlineFallback,
  slowNetworkFallback,
  className = ''
}: NetworkAwareProps) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSlowNetwork, setIsSlowNetwork] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check network speed if available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      const slowTypes = ['slow-2g', '2g'];
      setIsSlowNetwork(slowTypes.includes(connection?.effectiveType));
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline && offlineFallback) {
    return <div className={className}>{offlineFallback}</div>;
  }

  if (isSlowNetwork && slowNetworkFallback) {
    return <div className={className}>{slowNetworkFallback}</div>;
  }

  return (
    <div className={className}>
      {children}
    </div>
  );
}