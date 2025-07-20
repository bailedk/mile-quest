'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LoadingState {
  isLoading: boolean;
  error: Error | null;
  lastLoadTime: number | null;
  retryCount: number;
  cachedData: any;
  loadingStage: string | null;
}

interface LoadingConfig {
  cacheTimeout: number; // milliseconds
  maxRetries: number;
  retryDelay: number; // milliseconds
  showCachedWhileLoading: boolean;
  minimumLoadingTime: number; // milliseconds to prevent flicker
}

const defaultConfig: LoadingConfig = {
  cacheTimeout: 5 * 60 * 1000, // 5 minutes
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  showCachedWhileLoading: true,
  minimumLoadingTime: 300 // 300ms
};

type LoadingAction = 
  | { type: 'START_LOADING'; stage?: string }
  | { type: 'LOADING_SUCCESS'; data: any }
  | { type: 'LOADING_ERROR'; error: Error }
  | { type: 'RETRY_LOADING' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_CACHED_DATA'; data: any }
  | { type: 'CLEAR_CACHE' }
  | { type: 'SET_STAGE'; stage: string };

const initialState: LoadingState = {
  isLoading: false,
  error: null,
  lastLoadTime: null,
  retryCount: 0,
  cachedData: null,
  loadingStage: null
};

function loadingReducer(state: LoadingState, action: LoadingAction): LoadingState {
  switch (action.type) {
    case 'START_LOADING':
      return {
        ...state,
        isLoading: true,
        error: null,
        loadingStage: action.stage || null
      };
    case 'LOADING_SUCCESS':
      return {
        ...state,
        isLoading: false,
        error: null,
        lastLoadTime: Date.now(),
        retryCount: 0,
        cachedData: action.data,
        loadingStage: null
      };
    case 'LOADING_ERROR':
      return {
        ...state,
        isLoading: false,
        error: action.error,
        retryCount: state.retryCount + 1,
        loadingStage: null
      };
    case 'RETRY_LOADING':
      return {
        ...state,
        isLoading: true,
        error: null,
        loadingStage: 'retrying'
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
        retryCount: 0
      };
    case 'SET_CACHED_DATA':
      return {
        ...state,
        cachedData: action.data
      };
    case 'CLEAR_CACHE':
      return {
        ...state,
        cachedData: null,
        lastLoadTime: null
      };
    case 'SET_STAGE':
      return {
        ...state,
        loadingStage: action.stage
      };
    default:
      return state;
  }
}

interface LoadingContextValue {
  state: LoadingState;
  config: LoadingConfig;
  startLoading: (stage?: string) => void;
  setSuccess: (data: any) => void;
  setError: (error: Error) => void;
  retry: () => void;
  clearError: () => void;
  setCachedData: (data: any) => void;
  clearCache: () => void;
  setStage: (stage: string) => void;
  isCacheValid: () => boolean;
  shouldShowCached: () => boolean;
  canRetry: () => boolean;
}

const LoadingContext = createContext<LoadingContextValue | null>(null);

interface LoadingProviderProps {
  children: React.ReactNode;
  config?: Partial<LoadingConfig>;
  onRetry?: () => Promise<void> | void;
}

export function LoadingProvider({ children, config, onRetry }: LoadingProviderProps) {
  const [state, dispatch] = useReducer(loadingReducer, initialState);
  const finalConfig = { ...defaultConfig, ...config };

  const startLoading = useCallback((stage?: string) => {
    dispatch({ type: 'START_LOADING', stage });
  }, []);

  const setSuccess = useCallback((data: any) => {
    // Ensure minimum loading time to prevent flicker
    const loadingDuration = Date.now() - (state.lastLoadTime || 0);
    const delay = Math.max(0, finalConfig.minimumLoadingTime - loadingDuration);
    
    setTimeout(() => {
      dispatch({ type: 'LOADING_SUCCESS', data });
    }, delay);
  }, [state.lastLoadTime, finalConfig.minimumLoadingTime]);

  const setError = useCallback((error: Error) => {
    dispatch({ type: 'LOADING_ERROR', error });
  }, []);

  const retry = useCallback(async () => {
    if (state.retryCount >= finalConfig.maxRetries) return;
    
    dispatch({ type: 'RETRY_LOADING' });
    
    // Wait for retry delay
    await new Promise(resolve => setTimeout(resolve, finalConfig.retryDelay));
    
    if (onRetry) {
      try {
        await onRetry();
      } catch (error) {
        setError(error as Error);
      }
    }
  }, [state.retryCount, finalConfig.maxRetries, finalConfig.retryDelay, onRetry, setError]);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const setCachedData = useCallback((data: any) => {
    dispatch({ type: 'SET_CACHED_DATA', data });
  }, []);

  const clearCache = useCallback(() => {
    dispatch({ type: 'CLEAR_CACHE' });
  }, []);

  const setStage = useCallback((stage: string) => {
    dispatch({ type: 'SET_STAGE', stage });
  }, []);

  const isCacheValid = useCallback(() => {
    if (!state.lastLoadTime || !state.cachedData) return false;
    return Date.now() - state.lastLoadTime < finalConfig.cacheTimeout;
  }, [state.lastLoadTime, state.cachedData, finalConfig.cacheTimeout]);

  const shouldShowCached = useCallback(() => {
    return finalConfig.showCachedWhileLoading && isCacheValid() && state.cachedData;
  }, [finalConfig.showCachedWhileLoading, isCacheValid, state.cachedData]);

  const canRetry = useCallback(() => {
    return state.retryCount < finalConfig.maxRetries;
  }, [state.retryCount, finalConfig.maxRetries]);

  const contextValue: LoadingContextValue = {
    state,
    config: finalConfig,
    startLoading,
    setSuccess,
    setError,
    retry,
    clearError,
    setCachedData,
    clearCache,
    setStage,
    isCacheValid,
    shouldShowCached,
    canRetry
  };

  return (
    <LoadingContext.Provider value={contextValue}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoadingState() {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoadingState must be used within a LoadingProvider');
  }
  return context;
}

// Custom hook for managed loading operations
interface UseLoadingOperationOptions {
  key: string;
  loader: () => Promise<any>;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  autoLoad?: boolean;
  dependencies?: any[];
}

export function useLoadingOperation({
  key,
  loader,
  onSuccess,
  onError,
  autoLoad = true,
  dependencies = []
}: UseLoadingOperationOptions) {
  const {
    state,
    startLoading,
    setSuccess,
    setError,
    retry,
    clearError,
    isCacheValid,
    shouldShowCached
  } = useLoadingState();

  const load = useCallback(async () => {
    if (state.isLoading) return;

    try {
      startLoading(key);
      const data = await loader();
      setSuccess(data);
      if (onSuccess) onSuccess(data);
    } catch (error) {
      const err = error as Error;
      setError(err);
      if (onError) onError(err);
    }
  }, [key, loader, startLoading, setSuccess, setError, onSuccess, onError, state.isLoading]);

  const retryLoad = useCallback(async () => {
    clearError();
    await load();
  }, [clearError, load]);

  useEffect(() => {
    if (autoLoad && (!isCacheValid() || !state.cachedData)) {
      load();
    }
  }, [autoLoad, isCacheValid, state.cachedData, load, ...dependencies]);

  return {
    ...state,
    load,
    retry: retryLoad,
    data: shouldShowCached() ? state.cachedData : (!state.isLoading && !state.error ? state.cachedData : null),
    hasValidCache: isCacheValid()
  };
}

// Loading state component with built-in caching and error handling
interface ManagedLoadingProps {
  loader: () => Promise<any>;
  children: (data: any, helpers: { reload: () => void; clearCache: () => void }) => React.ReactNode;
  loadingFallback?: React.ReactNode;
  errorFallback?: (error: Error, retry: () => void) => React.ReactNode;
  emptyFallback?: React.ReactNode;
  className?: string;
  loadingKey: string;
  config?: Partial<LoadingConfig>;
  dependencies?: any[];
}

export function ManagedLoading({
  loader,
  children,
  loadingFallback,
  errorFallback,
  emptyFallback,
  className = '',
  loadingKey,
  config,
  dependencies = []
}: ManagedLoadingProps) {
  return (
    <LoadingProvider config={config}>
      <ManagedLoadingInner
        loader={loader}
        loadingFallback={loadingFallback}
        errorFallback={errorFallback}
        emptyFallback={emptyFallback}
        className={className}
        loadingKey={loadingKey}
        dependencies={dependencies}
      >
        {children}
      </ManagedLoadingInner>
    </LoadingProvider>
  );
}

function ManagedLoadingInner({
  loader,
  children,
  loadingFallback,
  errorFallback,
  emptyFallback,
  className,
  loadingKey,
  dependencies
}: Omit<ManagedLoadingProps, 'config'>) {
  const {
    isLoading,
    error,
    data,
    load,
    retry,
    clearCache,
    shouldShowCached
  } = useLoadingOperation({
    key: loadingKey,
    loader,
    dependencies
  });

  const isEmpty = !data || (Array.isArray(data) && data.length === 0);

  if (isLoading && !shouldShowCached()) {
    return (
      <div className={className}>
        {loadingFallback || (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        )}
      </div>
    );
  }

  if (error && !shouldShowCached()) {
    return (
      <div className={className}>
        {errorFallback ? errorFallback(error, retry) : (
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">{error.message}</p>
            <button
              onClick={retry}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    );
  }

  if (isEmpty && !shouldShowCached()) {
    return (
      <div className={className}>
        {emptyFallback || (
          <div className="text-center py-8">
            <p className="text-gray-600">No data available</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <AnimatePresence mode="wait">
        <motion.div
          key={data ? 'content' : 'empty'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {children(data, { reload: load, clearCache })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}