/**
 * React performance optimization hooks
 */

import { useCallback, useMemo, useRef, useState, useEffect } from 'react';

// Optimized state hook with shallow comparison
export function useOptimizedState<T>(
  initialState: T,
  isEqual: (a: T, b: T) => boolean = Object.is
) {
  const [state, setState] = useState(initialState);
  const setOptimizedState = useCallback((newState: T | ((prev: T) => T)) => {
    setState(prevState => {
      const nextState = typeof newState === 'function' 
        ? (newState as (prev: T) => T)(prevState)
        : newState;
      
      return isEqual(prevState, nextState) ? prevState : nextState;
    });
  }, [isEqual]);

  return [state, setOptimizedState] as const;
}

// Debounced value hook
export function useDebounced<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Throttled callback hook
export function useThrottledCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  const lastCall = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    
    if (now - lastCall.current >= delay) {
      lastCall.current = now;
      callback(...args);
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        lastCall.current = Date.now();
        callback(...args);
      }, delay - (now - lastCall.current));
    }
  }, [callback, delay]) as T;
}

// Intersection observer hook for lazy loading
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [React.RefObject<Element>, boolean] {
  const elementRef = useRef<Element>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options,
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [options]);

  return [elementRef, isIntersecting];
}

// Virtual scrolling hook for large lists
export function useVirtualScroll<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 5,
}: {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + overscan,
      items.length
    );

    const actualStartIndex = Math.max(0, startIndex - overscan);

    return {
      startIndex: actualStartIndex,
      endIndex,
      items: items.slice(actualStartIndex, endIndex),
      totalHeight: items.length * itemHeight,
      offsetY: actualStartIndex * itemHeight,
    };
  }, [scrollTop, itemHeight, containerHeight, items, overscan]);

  const onScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  return {
    ...visibleItems,
    onScroll,
  };
}

// Optimized async data fetching with caching
export function useOptimizedAsync<T, E = Error>(
  asyncFunction: () => Promise<T>,
  deps: React.DependencyList = [],
  cacheKey?: string
) {
  const [state, setState] = useState<{
    data: T | null;
    error: E | null;
    loading: boolean;
  }>({
    data: null,
    error: null,
    loading: false,
  });

  const cache = useRef<Map<string, { data: T; timestamp: number }>>(new Map());
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  const execute = useCallback(async () => {
    const key = cacheKey || JSON.stringify(deps);
    
    // Check cache first
    if (cacheKey) {
      const cached = cache.current.get(key);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setState({ data: cached.data, error: null, loading: false });
        return;
      }
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const data = await asyncFunction();
      
      // Cache the result
      if (cacheKey) {
        cache.current.set(key, { data, timestamp: Date.now() });
      }
      
      setState({ data, error: null, loading: false });
    } catch (error) {
      setState({ data: null, error: error as E, loading: false });
    }
  }, deps);

  useEffect(() => {
    execute();
  }, [execute]);

  return { ...state, refetch: execute };
}

// Memory usage monitoring hook
export function useMemoryMonitor() {
  const [memoryInfo, setMemoryInfo] = useState<{
    usedJSHeapSize?: number;
    totalJSHeapSize?: number;
    jsHeapSizeLimit?: number;
  }>({});

  useEffect(() => {
    const updateMemoryInfo = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setMemoryInfo({
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
        });
      }
    };

    updateMemoryInfo();
    const interval = setInterval(updateMemoryInfo, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return memoryInfo;
}

// Image lazy loading hook with intersection observer
export function useImageLazyLoading() {
  const [ref, isVisible] = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '50px',
  });
  
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const loadImage = useCallback((src: string) => {
    if (!isVisible || loaded) return;

    const img = new Image();
    img.onload = () => setLoaded(true);
    img.onerror = () => setError(true);
    img.src = src;
  }, [isVisible, loaded]);

  return {
    ref,
    loaded,
    error,
    shouldLoad: isVisible,
    loadImage,
  };
}

// Optimized event handler hook
export function useOptimizedEventHandler<T extends (...args: any[]) => void>(
  handler: T,
  deps: React.DependencyList
): T {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  return useCallback((...args: Parameters<T>) => {
    return handlerRef.current(...args);
  }, deps) as T;
}

// Bundle size tracking hook (development only)
export function useBundleSize() {
  const [bundleInfo, setBundleInfo] = useState<{
    totalSize?: number;
    chunkSizes?: Record<string, number>;
  }>({});

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // This would integrate with webpack-bundle-analyzer data
      // In a real implementation, you'd fetch this from a build artifact
      fetch('/api/bundle-analysis')
        .then(res => res.json())
        .then(setBundleInfo)
        .catch(() => {
          // Silently fail in development
        });
    }
  }, []);

  return bundleInfo;
}

// Component render tracking hook
export function useRenderTracker(componentName: string) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());

  useEffect(() => {
    renderCount.current += 1;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    lastRenderTime.current = now;

    if (process.env.NODE_ENV === 'development') {
      console.log(
        `${componentName} rendered ${renderCount.current} times. ` +
        `Time since last render: ${timeSinceLastRender}ms`
      );
    }
  });

  return {
    renderCount: renderCount.current,
    lastRenderTime: lastRenderTime.current,
  };
}