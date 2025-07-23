/**
 * Hydration utilities for Next.js SSR/SSG compatibility
 * 
 * These utilities help prevent hydration mismatches by ensuring
 * browser-specific APIs are only accessed after hydration
 */

import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * Hook to detect when the app has been hydrated on the client.
 * This is re-exported from the existing hook for convenience.
 */
export { useHydrated } from '@/hooks/useHydrated';

/**
 * Re-export hydration components
 */
export { HydratedOnly } from '@/components/hydration/HydratedOnly';

/**
 * Type-safe wrapper for accessing browser globals
 */
export const isBrowser = typeof window !== 'undefined';
export const isServer = !isBrowser;

/**
 * Safe access to browser APIs with fallback values
 */
export const safeWindow = isBrowser ? window : undefined;
export const safeDocument = isBrowser ? document : undefined;
export const safeNavigator = isBrowser ? navigator : undefined;
export const safeLocalStorage = isBrowser ? localStorage : undefined;

/**
 * Hook for media queries with SSR support
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = (callback: () => void) => {
    if (!isBrowser) return () => {};
    
    const matchMedia = window.matchMedia(query);
    matchMedia.addEventListener('change', callback);
    return () => matchMedia.removeEventListener('change', callback);
  };

  const getSnapshot = () => {
    if (!isBrowser) return false;
    return window.matchMedia(query).matches;
  };

  const getServerSnapshot = () => false;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Hook for window dimensions with SSR support
 */
export interface WindowDimensions {
  width: number;
  height: number;
}

export function useWindowDimensions(): WindowDimensions {
  const subscribe = (callback: () => void) => {
    if (!isBrowser) return () => {};
    
    window.addEventListener('resize', callback);
    return () => window.removeEventListener('resize', callback);
  };

  const getSnapshot = (): WindowDimensions => {
    if (!isBrowser) return { width: 0, height: 0 };
    return {
      width: window.innerWidth,
      height: window.innerHeight
    };
  };

  const getServerSnapshot = (): WindowDimensions => ({
    width: 0,
    height: 0
  });

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Hook for localStorage with SSR support
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  // Initial hydration
  useEffect(() => {
    setHydrated(true);
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      }
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
    }
  }, [key]);

  // Return a wrapped version of useState's setter function that persists the new value to localStorage
  const setValue = (value: T | ((prev: T) => T)) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Save state
      setStoredValue(valueToStore);
      
      // Save to local storage after hydration
      if (hydrated && isBrowser) {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(`Error saving localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
}


/**
 * Hook for device detection with SSR support
 */
export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
}

export function useDeviceDetection(): DeviceInfo {
  const dimensions = useWindowDimensions();
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isTouchDevice: false
  });

  useEffect(() => {
    const updateDeviceInfo = () => {
      const width = window.innerWidth;
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      setDeviceInfo({
        isMobile: width < 768,
        isTablet: width >= 768 && width < 1024,
        isDesktop: width >= 1024,
        isTouchDevice
      });
    };

    updateDeviceInfo();
  }, [dimensions.width]);

  return deviceInfo;
}

/**
 * Safe ID generator that works with SSR
 * Uses a counter instead of Math.random() to ensure consistency
 */
let idCounter = 0;
export function useStableId(prefix = 'id'): string {
  const [id] = useState(() => {
    // Only increment counter on client to ensure server/client match
    if (isBrowser) {
      idCounter += 1;
      return `${prefix}-${idCounter}`;
    }
    return `${prefix}-ssr`;
  });
  
  return id;
}

/**
 * Hook for checking if code is running in development mode
 * Returns false during SSR to prevent hydration mismatches
 */
export function useIsDevelopment(): boolean {
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    setIsDev(process.env.NODE_ENV === 'development');
  }, []);

  return isDev;
}

/**
 * Hook for reduced motion preference with SSR support
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/**
 * Hook for color scheme preference with SSR support
 */
export function usePrefersColorScheme(): 'light' | 'dark' | 'no-preference' {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const prefersLight = useMediaQuery('(prefers-color-scheme: light)');
  
  if (prefersDark) return 'dark';
  if (prefersLight) return 'light';
  return 'no-preference';
}