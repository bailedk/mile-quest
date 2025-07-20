'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { retryWithBackoff } from '@/utils/error-handling';

// =============================================================================
// GRACEFUL DEGRADATION COMPONENT
// =============================================================================

interface GracefulFeatureProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
  featureName?: string;
  timeout?: number;
  enableRetry?: boolean;
  maxRetries?: number;
  onError?: (error: Error) => void;
  onFallback?: () => void;
}

export function GracefulFeature({
  children,
  fallback,
  featureName = 'feature',
  timeout = 10000,
  enableRetry = true,
  maxRetries = 3,
  onError,
  onFallback
}: GracefulFeatureProps) {
  const [hasFailed, setHasFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const mountedRef = useRef(true);

  useEffect(() => {
    // Set up timeout for feature loading
    timeoutRef.current = setTimeout(() => {
      if (mountedRef.current && !hasFailed) {
        setHasFailed(true);
        onFallback?.();
      }
    }, timeout);

    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [timeout, hasFailed, onFallback]);

  const handleRetry = useCallback(async () => {
    if (retryCount >= maxRetries || isRetrying) return;

    setIsRetrying(true);
    setRetryCount(prev => prev + 1);

    try {
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
      
      if (mountedRef.current) {
        setHasFailed(false);
        setIsRetrying(false);
        
        // Reset timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          if (mountedRef.current && !hasFailed) {
            setHasFailed(true);
            onFallback?.();
          }
        }, timeout);
      }
    } catch (error) {
      if (mountedRef.current) {
        setIsRetrying(false);
        onError?.(error as Error);
      }
    }
  }, [retryCount, maxRetries, isRetrying, timeout, hasFailed, onError, onFallback]);

  if (hasFailed) {
    return (
      <div className="relative">
        {fallback}
        {enableRetry && retryCount < maxRetries && !isRetrying && (
          <div className="absolute top-2 right-2">
            <button
              onClick={handleRetry}
              className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition-colors"
              title={`Retry ${featureName}`}
            >
              Retry
            </button>
          </div>
        )}
        {isRetrying && (
          <div className="absolute top-2 right-2">
            <div className="text-xs bg-gray-600 text-white px-2 py-1 rounded flex items-center">
              <svg className="animate-spin h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Retrying...
            </div>
          </div>
        )}
      </div>
    );
  }

  return <>{children}</>;
}

// =============================================================================
// AUTO-RETRY COMPONENT
// =============================================================================

interface AutoRetryProps {
  children: (retry: () => Promise<void>, isRetrying: boolean, retryCount: number) => React.ReactNode;
  onRetry: () => Promise<void>;
  maxRetries?: number;
  retryDelay?: number;
  exponentialBackoff?: boolean;
  autoRetryOnError?: boolean;
  retryCondition?: (error: Error) => boolean;
}

export function AutoRetry({
  children,
  onRetry,
  maxRetries = 3,
  retryDelay = 1000,
  exponentialBackoff = true,
  autoRetryOnError = false,
  retryCondition
}: AutoRetryProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState<Error | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout>();

  const calculateDelay = useCallback((attemptNumber: number) => {
    if (exponentialBackoff) {
      return retryDelay * Math.pow(2, attemptNumber) + Math.random() * 1000;
    }
    return retryDelay;
  }, [retryDelay, exponentialBackoff]);

  const executeRetry = useCallback(async () => {
    if (retryCount >= maxRetries || isRetrying) {
      return;
    }

    setIsRetrying(true);
    setRetryCount(prev => prev + 1);

    try {
      await onRetry();
      // Success - reset state
      setRetryCount(0);
      setLastError(null);
    } catch (error) {
      const err = error as Error;
      setLastError(err);
      
      // Check if we should auto-retry
      const shouldAutoRetry = autoRetryOnError && 
        retryCount + 1 < maxRetries && 
        (!retryCondition || retryCondition(err));

      if (shouldAutoRetry) {
        const delay = calculateDelay(retryCount);
        retryTimeoutRef.current = setTimeout(() => {
          executeRetry();
        }, delay);
      }
    } finally {
      setIsRetrying(false);
    }
  }, [retryCount, maxRetries, isRetrying, onRetry, autoRetryOnError, retryCondition, calculateDelay]);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return <>{children(executeRetry, isRetrying, retryCount)}</>;
}

// =============================================================================
// NETWORK-AWARE COMPONENT
// =============================================================================

interface NetworkAwareProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showConnectionStatus?: boolean;
  onOnline?: () => void;
  onOffline?: () => void;
}

export function NetworkAware({
  children,
  fallback,
  showConnectionStatus = false,
  onOnline,
  onOffline
}: NetworkAwareProps) {
  const [isOnline, setIsOnline] = useState(() => 
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [connectionType, setConnectionType] = useState<string>('unknown');
  const [effectiveType, setEffectiveType] = useState<string>('unknown');

  useEffect(() => {
    const updateConnectionInfo = () => {
      const connection = (navigator as any)?.connection;
      if (connection) {
        setConnectionType(connection.type || 'unknown');
        setEffectiveType(connection.effectiveType || 'unknown');
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      updateConnectionInfo();
      onOnline?.();
    };

    const handleOffline = () => {
      setIsOnline(false);
      onOffline?.();
    };

    const handleConnectionChange = () => {
      updateConnectionInfo();
    };

    // Initial connection info
    updateConnectionInfo();

    // Event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    const connection = (navigator as any)?.connection;
    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
    };
  }, [onOnline, onOffline]);

  const getConnectionQuality = () => {
    if (!isOnline) return 'offline';
    
    switch (effectiveType) {
      case 'slow-2g':
      case '2g':
        return 'poor';
      case '3g':
        return 'fair';
      case '4g':
        return 'good';
      default:
        return 'unknown';
    }
  };

  const connectionQuality = getConnectionQuality();

  if (!isOnline && fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="relative">
      {children}
      
      {showConnectionStatus && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className={`
            px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200
            ${
              isOnline
                ? connectionQuality === 'good'
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : connectionQuality === 'fair'
                  ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                  : connectionQuality === 'poor'
                  ? 'bg-orange-100 text-orange-800 border border-orange-200'
                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                : 'bg-red-100 text-red-800 border border-red-200'
            }
          `}>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                isOnline
                  ? connectionQuality === 'good'
                    ? 'bg-green-500'
                    : connectionQuality === 'fair'
                    ? 'bg-yellow-500'
                    : connectionQuality === 'poor'
                    ? 'bg-orange-500'
                    : 'bg-blue-500'
                  : 'bg-red-500 animate-pulse'
              }`} />
              <span>
                {isOnline 
                  ? `${connectionQuality} connection ${effectiveType !== 'unknown' ? `(${effectiveType})` : ''}`
                  : 'Offline'
                }
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// PROGRESSIVE ENHANCEMENT COMPONENT
// =============================================================================

interface ProgressiveEnhancementProps {
  baseline: React.ReactNode;
  enhanced?: React.ReactNode;
  condition?: () => boolean | Promise<boolean>;
  fallbackDelay?: number;
  enableCaching?: boolean;
}

export function ProgressiveEnhancement({
  baseline,
  enhanced,
  condition,
  fallbackDelay = 5000,
  enableCaching = true
}: ProgressiveEnhancementProps) {
  const [showEnhanced, setShowEnhanced] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const cacheKey = 'progressive_enhancement_' + (condition?.toString().slice(0, 50) || 'default');

  useEffect(() => {
    let mounted = true;
    
    const checkCondition = async () => {
      if (hasChecked && enableCaching) return;
      
      // Check cache first
      if (enableCaching && typeof window !== 'undefined') {
        const cached = localStorage.getItem(cacheKey);
        if (cached !== null) {
          const { result, timestamp } = JSON.parse(cached);
          // Use cached result if less than 1 hour old
          if (Date.now() - timestamp < 3600000) {
            setShowEnhanced(result);
            setHasChecked(true);
            return;
          }
        }
      }
      
      setIsChecking(true);
      
      try {
        let result = true;
        
        if (condition) {
          const conditionResult = condition();
          result = conditionResult instanceof Promise ? await conditionResult : conditionResult;
        }
        
        if (mounted) {
          setShowEnhanced(result);
          setHasChecked(true);
          
          // Cache result
          if (enableCaching && typeof window !== 'undefined') {
            localStorage.setItem(cacheKey, JSON.stringify({
              result,
              timestamp: Date.now()
            }));
          }
        }
      } catch (error) {
        if (mounted) {
          setShowEnhanced(false);
          setHasChecked(true);
        }
      } finally {
        if (mounted) {
          setIsChecking(false);
        }
      }
    };

    // Set up fallback timer
    const fallbackTimer = setTimeout(() => {
      if (mounted && !hasChecked) {
        setShowEnhanced(false);
        setHasChecked(true);
        setIsChecking(false);
      }
    }, fallbackDelay);

    checkCondition();

    return () => {
      mounted = false;
      clearTimeout(fallbackTimer);
    };
  }, [condition, fallbackDelay, enableCaching, cacheKey, hasChecked]);

  if (isChecking || !hasChecked) {
    return <>{baseline}</>;
  }

  return <>{showEnhanced && enhanced ? enhanced : baseline}</>;
}

// =============================================================================
// CONDITIONAL FEATURE COMPONENT
// =============================================================================

interface ConditionalFeatureProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  condition: boolean | (() => boolean);
  enableToggle?: boolean;
  storageKey?: string;
  onToggle?: (enabled: boolean) => void;
}

export function ConditionalFeature({
  children,
  fallback,
  condition,
  enableToggle = false,
  storageKey,
  onToggle
}: ConditionalFeatureProps) {
  const [userEnabled, setUserEnabled] = useState(() => {
    if (!enableToggle || !storageKey || typeof window === 'undefined') return true;
    const stored = localStorage.getItem(`feature_${storageKey}`);
    return stored !== null ? JSON.parse(stored) : true;
  });

  const isConditionMet = typeof condition === 'function' ? condition() : condition;
  const shouldShow = isConditionMet && userEnabled;

  const handleToggle = useCallback(() => {
    const newValue = !userEnabled;
    setUserEnabled(newValue);
    
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(`feature_${storageKey}`, JSON.stringify(newValue));
    }
    
    onToggle?.(newValue);
  }, [userEnabled, storageKey, onToggle]);

  if (!shouldShow) {
    return (
      <div className="relative">
        {fallback || (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center text-sm text-gray-600">
            Feature not available
          </div>
        )}
        
        {enableToggle && isConditionMet && (
          <div className="absolute top-2 right-2">
            <button
              onClick={handleToggle}
              className="text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700 transition-colors"
              title="Enable feature"
            >
              Enable
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {children}
      
      {enableToggle && (
        <div className="absolute top-2 right-2">
          <button
            onClick={handleToggle}
            className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition-colors"
            title="Disable feature"
          >
            Disable
          </button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// CACHED FALLBACK COMPONENT
// =============================================================================

interface CachedFallbackProps<T> {
  children: (data: T) => React.ReactNode;
  fetchData: () => Promise<T>;
  fallback: React.ReactNode;
  cacheKey: string;
  cacheDuration?: number; // in milliseconds
  enableStaleWhileRevalidate?: boolean;
  onError?: (error: Error) => void;
}

export function CachedFallback<T>({
  children,
  fetchData,
  fallback,
  cacheKey,
  cacheDuration = 300000, // 5 minutes
  enableStaleWhileRevalidate = true,
  onError
}: CachedFallbackProps<T>) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    let mounted = true;
    
    const loadData = async (useCache = true) => {
      try {
        // Check cache first
        if (useCache && typeof window !== 'undefined') {
          const cached = localStorage.getItem(`cache_${cacheKey}`);
          if (cached) {
            const { data: cachedData, timestamp } = JSON.parse(cached);
            const age = Date.now() - timestamp;
            
            if (age < cacheDuration) {
              // Fresh cache
              if (mounted) {
                setData(cachedData);
                setIsLoading(false);
                setIsStale(false);
              }
              return;
            } else if (enableStaleWhileRevalidate) {
              // Stale cache - show it but refetch
              if (mounted) {
                setData(cachedData);
                setIsLoading(false);
                setIsStale(true);
              }
              // Continue to fetch fresh data
            }
          }
        }
        
        // Fetch fresh data
        const freshData = await fetchData();
        
        if (mounted) {
          setData(freshData);
          setIsLoading(false);
          setError(null);
          setIsStale(false);
          
          // Update cache
          if (typeof window !== 'undefined') {
            localStorage.setItem(`cache_${cacheKey}`, JSON.stringify({
              data: freshData,
              timestamp: Date.now()
            }));
          }
        }
      } catch (err) {
        const error = err as Error;
        
        if (mounted) {
          setError(error);
          setIsLoading(false);
          onError?.(error);
          
          // If we have cached data, use it despite the error
          if (typeof window !== 'undefined') {
            const cached = localStorage.getItem(`cache_${cacheKey}`);
            if (cached && !data) {
              const { data: cachedData } = JSON.parse(cached);
              setData(cachedData);
              setIsStale(true);
            }
          }
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [fetchData, cacheKey, cacheDuration, enableStaleWhileRevalidate, onError, data]);

  if (isLoading && !data) {
    return <>{fallback}</>;
  }

  if (error && !data) {
    return <>{fallback}</>;
  }

  if (!data) {
    return <>{fallback}</>;
  }

  return (
    <div className="relative">
      {children(data)}
      
      {isStale && (
        <div className="absolute top-1 right-1">
          <div className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded" title="Data may be outdated">
            ⚠️
          </div>
        </div>
      )}
    </div>
  );
}