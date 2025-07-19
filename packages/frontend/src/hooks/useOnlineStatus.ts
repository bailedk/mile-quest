import { useState, useEffect } from 'react';

export interface OnlineStatusHook {
  isOnline: boolean;
  wasOffline: boolean;
}

export function useOnlineStatus(): OnlineStatusHook {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    // Set initial state
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      console.log('App came online');
      setIsOnline(true);
      // Mark that we were offline if we were actually offline
      if (!navigator.onLine) {
        setWasOffline(true);
      }
    };

    const handleOffline = () => {
      console.log('App went offline');
      setIsOnline(false);
      setWasOffline(true);
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Handle visibility change (page became visible)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check online status when page becomes visible
        const currentlyOnline = navigator.onLine;
        if (currentlyOnline !== isOnline) {
          setIsOnline(currentlyOnline);
          if (currentlyOnline && !isOnline) {
            // We came back online
            setWasOffline(true);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isOnline]);

  // Reset wasOffline flag after some time or when explicitly handled
  useEffect(() => {
    if (wasOffline && isOnline) {
      const timeout = setTimeout(() => {
        setWasOffline(false);
      }, 5000); // Reset after 5 seconds of being online

      return () => clearTimeout(timeout);
    }
  }, [wasOffline, isOnline]);

  return { isOnline, wasOffline };
}