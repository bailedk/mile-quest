/**
 * SSR-safe utility functions for accessing browser APIs
 */

/**
 * Check if code is running in browser environment
 */
export const isBrowser = (): boolean => {
  return typeof window !== 'undefined';
};

/**
 * Check if code is running on server
 */
export const isServer = (): boolean => {
  return !isBrowser();
};

/**
 * Safe window access
 */
export const safeWindow = () => {
  if (!isBrowser()) {
    return undefined;
  }
  return window;
};

/**
 * Get location pathname safely
 */
export const getLocationPathname = (): string => {
  if (!isBrowser()) return '';
  return window.location.pathname;
};

/**
 * Get location href safely
 */
export const getLocationHref = (): string => {
  if (!isBrowser()) return '';
  return window.location.href;
};

/**
 * Navigate to URL safely
 */
export const navigateTo = (url: string): void => {
  if (!isBrowser()) return;
  window.location.href = url;
};

/**
 * Reload page safely
 */
export const reloadPage = (): void => {
  if (!isBrowser()) return;
  window.location.reload();
};

/**
 * Get user agent safely
 */
export const getUserAgent = (): string => {
  if (!isBrowser()) return '';
  return navigator.userAgent;
};

/**
 * Check if online safely
 */
export const isOnline = (): boolean => {
  if (!isBrowser()) return true; // Assume online on server
  return navigator.onLine;
};

/**
 * Safe localStorage access
 */
export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (!isBrowser()) return null;
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error('localStorage.getItem error:', error);
      return null;
    }
  },
  
  setItem: (key: string, value: string): void => {
    if (!isBrowser()) return;
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error('localStorage.setItem error:', error);
    }
  },
  
  removeItem: (key: string): void => {
    if (!isBrowser()) return;
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('localStorage.removeItem error:', error);
    }
  },
  
  clear: (): void => {
    if (!isBrowser()) return;
    try {
      localStorage.clear();
    } catch (error) {
      console.error('localStorage.clear error:', error);
    }
  },
  
  isAvailable: (): boolean => {
    if (!isBrowser()) return false;
    try {
      const testKey = '__localStorage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }
};

/**
 * Safe sessionStorage access
 */
export const safeSessionStorage = {
  getItem: (key: string): string | null => {
    if (!isBrowser()) return null;
    try {
      return sessionStorage.getItem(key);
    } catch (error) {
      console.error('sessionStorage.getItem error:', error);
      return null;
    }
  },
  
  setItem: (key: string, value: string): void => {
    if (!isBrowser()) return;
    try {
      sessionStorage.setItem(key, value);
    } catch (error) {
      console.error('sessionStorage.setItem error:', error);
    }
  },
  
  removeItem: (key: string): void => {
    if (!isBrowser()) return;
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      console.error('sessionStorage.removeItem error:', error);
    }
  },
  
  clear: (): void => {
    if (!isBrowser()) return;
    try {
      sessionStorage.clear();
    } catch (error) {
      console.error('sessionStorage.clear error:', error);
    }
  }
};

/**
 * Safe document access
 */
export const safeDocument = () => {
  if (!isBrowser()) return undefined;
  return document;
};

/**
 * Add event listener safely
 */
export const addEventListener = (
  event: string,
  handler: EventListener,
  options?: boolean | AddEventListenerOptions
): (() => void) => {
  if (!isBrowser()) return () => {};
  
  window.addEventListener(event, handler, options);
  return () => window.removeEventListener(event, handler, options);
};

/**
 * Safe navigator access
 */
export const safeNavigator = () => {
  if (!isBrowser()) return undefined;
  return navigator;
};

/**
 * Check if service worker is supported
 */
export const isServiceWorkerSupported = (): boolean => {
  if (!isBrowser()) return false;
  return 'serviceWorker' in navigator;
};

/**
 * Get screen dimensions safely
 */
export const getScreenDimensions = () => {
  if (!isBrowser()) {
    return { width: 0, height: 0 };
  }
  return {
    width: window.screen.width,
    height: window.screen.height
  };
};

/**
 * Get viewport dimensions safely
 */
export const getViewportDimensions = () => {
  if (!isBrowser()) {
    return { width: 0, height: 0 };
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight
  };
};

/**
 * Safe performance API access
 */
export const safePerformance = () => {
  if (!isBrowser()) return undefined;
  return window.performance;
};

/**
 * Request animation frame safely
 */
export const safeRequestAnimationFrame = (callback: FrameRequestCallback): number => {
  if (!isBrowser()) return 0;
  return window.requestAnimationFrame(callback);
};

/**
 * Cancel animation frame safely
 */
export const safeCancelAnimationFrame = (id: number): void => {
  if (!isBrowser()) return;
  window.cancelAnimationFrame(id);
};