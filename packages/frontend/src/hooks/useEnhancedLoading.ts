'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface LoadingOptions {
  minimumLoadingTime?: number; // Prevent flicker by showing loading for at least this long
  delayBeforeLoading?: number; // Delay before showing loading state
  retryAttempts?: number;
  retryDelay?: number;
  cacheKey?: string;
  cacheTimeout?: number;
}

interface LoadingState<T> {
  isLoading: boolean;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  data: T | null;
  retryCount: number;
  lastFetchTime: number | null;
  hasData: boolean;
  isEmpty: boolean;
}

interface LoadingActions<T> {
  execute: () => Promise<void>;
  retry: () => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
  setData: (data: T) => void;
  clearData: () => void;
  reset: () => void;
}

interface EnhancedLoadingResult<T> extends LoadingState<T>, LoadingActions<T> {
  isStale: boolean;
  shouldShowSkeleton: boolean;
  shouldShowSpinner: boolean;
  canRetry: boolean;
}

const defaultOptions: LoadingOptions = {
  minimumLoadingTime: 300,
  delayBeforeLoading: 150,
  retryAttempts: 3,
  retryDelay: 1000,
  cacheTimeout: 5 * 60 * 1000 // 5 minutes
};

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();

export function useEnhancedLoading<T>(
  asyncFunction: () => Promise<T>,
  options: LoadingOptions = {}
): EnhancedLoadingResult<T> {
  const opts = { ...defaultOptions, ...options };
  const [state, setState] = useState<LoadingState<T>>({
    isLoading: false,
    isInitialLoading: false,
    isRefreshing: false,
    error: null,
    data: null,
    retryCount: 0,
    lastFetchTime: null,
    hasData: false,
    isEmpty: false
  });

  const loadingTimeoutRef = useRef<NodeJS.Timeout>();
  const minLoadingTimeoutRef = useRef<NodeJS.Timeout>();
  const startTimeRef = useRef<number>();

  // Check if cached data is available and valid
  const getCachedData = useCallback((): T | null => {
    if (!opts.cacheKey) return null;
    
    const cached = cache.get(opts.cacheKey);
    if (!cached) return null;
    
    const isExpired = Date.now() - cached.timestamp > (opts.cacheTimeout || 0);
    return isExpired ? null : cached.data;
  }, [opts.cacheKey, opts.cacheTimeout]);

  // Set cached data
  const setCachedData = useCallback((data: T) => {
    if (opts.cacheKey) {
      cache.set(opts.cacheKey, {
        data,
        timestamp: Date.now()
      });
    }
  }, [opts.cacheKey]);

  // Check if data is stale
  const isStale = useCallback(() => {
    if (!state.lastFetchTime || !opts.cacheTimeout) return false;
    return Date.now() - state.lastFetchTime > opts.cacheTimeout;
  }, [state.lastFetchTime, opts.cacheTimeout]);

  const execute = useCallback(async (isRefresh = false) => {
    // Clear any existing timeouts
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    if (minLoadingTimeoutRef.current) {
      clearTimeout(minLoadingTimeoutRef.current);
    }

    // Check for cached data first
    const cachedData = getCachedData();
    if (cachedData && !isRefresh) {
      setState(prev => ({
        ...prev,
        data: cachedData,
        hasData: true,
        isEmpty: Array.isArray(cachedData) ? cachedData.length === 0 : false,
        lastFetchTime: Date.now()
      }));
      return;
    }

    const setLoadingState = () => {
      setState(prev => ({
        ...prev,
        isLoading: true,
        isInitialLoading: !prev.hasData,
        isRefreshing: isRefresh || prev.hasData,
        error: null
      }));
    };

    // Delay before showing loading state to prevent flicker
    if (opts.delayBeforeLoading && opts.delayBeforeLoading > 0) {
      loadingTimeoutRef.current = setTimeout(setLoadingState, opts.delayBeforeLoading);
    } else {
      setLoadingState();
    }

    startTimeRef.current = Date.now();

    try {
      const result = await asyncFunction();
      
      // Ensure minimum loading time to prevent flicker
      const elapsedTime = Date.now() - (startTimeRef.current || 0);
      const remainingTime = Math.max(0, (opts.minimumLoadingTime || 0) - elapsedTime);

      const updateState = () => {
        setState(prev => ({
          ...prev,
          isLoading: false,
          isInitialLoading: false,
          isRefreshing: false,
          data: result,
          hasData: true,
          isEmpty: Array.isArray(result) ? result.length === 0 : false,
          error: null,
          retryCount: 0,
          lastFetchTime: Date.now()
        }));
        
        // Cache the result
        setCachedData(result);
      };

      if (remainingTime > 0) {
        minLoadingTimeoutRef.current = setTimeout(updateState, remainingTime);
      } else {
        updateState();
      }

    } catch (error) {
      const elapsedTime = Date.now() - (startTimeRef.current || 0);
      const remainingTime = Math.max(0, (opts.minimumLoadingTime || 0) - elapsedTime);

      const updateErrorState = () => {
        setState(prev => ({
          ...prev,
          isLoading: false,
          isInitialLoading: false,
          isRefreshing: false,
          error: error as Error,
          retryCount: prev.retryCount + 1
        }));
      };

      if (remainingTime > 0) {
        minLoadingTimeoutRef.current = setTimeout(updateErrorState, remainingTime);
      } else {
        updateErrorState();
      }
    }
  }, [asyncFunction, opts, getCachedData, setCachedData]);

  const retry = useCallback(async () => {
    if (state.retryCount >= (opts.retryAttempts || 0)) return;
    
    if (opts.retryDelay) {
      await new Promise(resolve => setTimeout(resolve, opts.retryDelay));
    }
    
    await execute();
  }, [execute, state.retryCount, opts.retryAttempts, opts.retryDelay]);

  const refresh = useCallback(async () => {
    await execute(true);
  }, [execute]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const setData = useCallback((data: T) => {
    setState(prev => ({
      ...prev,
      data,
      hasData: true,
      isEmpty: Array.isArray(data) ? data.length === 0 : false,
      error: null
    }));
    setCachedData(data);
  }, [setCachedData]);

  const clearData = useCallback(() => {
    setState(prev => ({
      ...prev,
      data: null,
      hasData: false,
      isEmpty: false,
      lastFetchTime: null
    }));
    
    if (opts.cacheKey) {
      cache.delete(opts.cacheKey);
    }
  }, [opts.cacheKey]);

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      isInitialLoading: false,
      isRefreshing: false,
      error: null,
      data: null,
      retryCount: 0,
      lastFetchTime: null,
      hasData: false,
      isEmpty: false
    });
    clearData();
  }, [clearData]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      if (minLoadingTimeoutRef.current) {
        clearTimeout(minLoadingTimeoutRef.current);
      }
    };
  }, []);

  // Computed properties
  const shouldShowSkeleton = state.isInitialLoading || (!state.hasData && state.isLoading);
  const shouldShowSpinner = state.isRefreshing || (state.hasData && state.isLoading);
  const canRetry = state.error && state.retryCount < (opts.retryAttempts || 0);

  return {
    ...state,
    execute,
    retry,
    refresh,
    clearError,
    setData,
    clearData,
    reset,
    isStale: isStale(),
    shouldShowSkeleton,
    shouldShowSpinner,
    canRetry
  };
}

// Hook for managing multiple loading states
interface KeyedLoadingState<T> {
  isLoading: boolean;
  error: Error | null;
  data: T | null;
  hasData: boolean;
}

/**
 * Runs several independent loaders without calling hooks in a loop.
 * `options` is reserved for callers that previously passed cache settings.
 */
export function useMultipleLoadingStates<T extends Record<string, unknown>>(
  loaders: { [K in keyof T]: () => Promise<T[K]> },
  _options: LoadingOptions = {}
) {
  const loaderRef = useRef(loaders);
  loaderRef.current = loaders;
  const keys = Object.keys(loaders) as (keyof T)[];

  const [states, setStates] = useState<{ [K in keyof T]: KeyedLoadingState<T[K]> }>(() => {
    return keys.reduce((acc, key) => {
      acc[key] = { isLoading: false, error: null, data: null, hasData: false };
      return acc;
    }, {} as { [K in keyof T]: KeyedLoadingState<T[K]> });
  });

  const runAll = useCallback(async () => {
    const entries = Object.entries(loaderRef.current) as [keyof T, () => Promise<T[keyof T]>][];
    await Promise.all(entries.map(async ([key, loader]) => {
      setStates(prev => ({
        ...prev,
        [key]: { ...prev[key], isLoading: true, error: null },
      }));
      try {
        const data = await loader();
        setStates(prev => ({
          ...prev,
          [key]: { isLoading: false, error: null, data, hasData: true },
        }));
      } catch (error) {
        setStates(prev => ({
          ...prev,
          [key]: {
            ...prev[key],
            isLoading: false,
            error: error instanceof Error ? error : new Error('Request failed'),
          },
        }));
      }
    }));
  }, []);

  const resetAll = useCallback(() => {
    setStates(prev => {
      const next = { ...prev };
      (Object.keys(next) as (keyof T)[]).forEach(key => {
        next[key] = { isLoading: false, error: null, data: null, hasData: false };
      });
      return next;
    });
  }, []);

  const stateList = Object.values(states) as KeyedLoadingState<unknown>[];
  const isAnyLoading = stateList.some(state => state.isLoading);
  const hasAnyError = stateList.some(state => state.error);
  const hasAllData = stateList.length > 0 && stateList.every(state => state.hasData);

  return {
    states,
    executeAll: runAll,
    refreshAll: runAll,
    resetAll,
    isAnyLoading,
    hasAnyError,
    hasAllData,
  };
}

// Hook for paginated loading
export function usePaginatedLoading<T>(
  loader: (page: number, pageSize: number) => Promise<{ items: T[]; hasMore: boolean }>,
  options: LoadingOptions & { pageSize?: number } = {}
) {
  const { pageSize = 20, ...loadingOptions } = options;
  const [page, setPage] = useState(1);
  const [allItems, setAllItems] = useState<T[]>([]);
  const [hasMore, setHasMore] = useState(true);

  const loadingState = useEnhancedLoading(
    () => loader(page, pageSize),
    {
      ...loadingOptions,
      cacheKey: loadingOptions.cacheKey ? `${loadingOptions.cacheKey}_page_${page}` : undefined
    }
  );

  useEffect(() => {
    if (loadingState.data) {
      if (page === 1) {
        setAllItems(loadingState.data.items);
      } else {
        setAllItems(prev => [...prev, ...loadingState.data!.items]);
      }
      setHasMore(loadingState.data.hasMore);
    }
  }, [loadingState.data, page]);

  const loadMore = useCallback(async () => {
    if (hasMore && !loadingState.isLoading) {
      setPage(prev => prev + 1);
    }
  }, [hasMore, loadingState.isLoading]);

  const refresh = useCallback(async () => {
    setPage(1);
    setAllItems([]);
    setHasMore(true);
    await loadingState.refresh();
  }, [loadingState]);

  const reset = useCallback(() => {
    setPage(1);
    setAllItems([]);
    setHasMore(true);
    loadingState.reset();
  }, [loadingState]);

  return {
    ...loadingState,
    items: allItems,
    hasMore,
    loadMore,
    refresh,
    reset,
    page,
    isLoadingMore: page > 1 && loadingState.isLoading
  };
}