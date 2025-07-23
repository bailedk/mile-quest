import { useState, useEffect, useSyncExternalStore } from 'react';

export interface OnlineStatusHook {
  isOnline: boolean;
  wasOffline: boolean;
}

// Subscribe function for online/offline events
function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

// Get current online status
function getSnapshot() {
  if (typeof navigator !== 'undefined') {
    return navigator.onLine;
  }
  return true; // Default to online on server
}

// Server snapshot always returns true
function getServerSnapshot() {
  return true;
}

export function useOnlineStatus(): OnlineStatusHook {
  // Use useSyncExternalStore for proper hydration
  const isOnline = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    // Track when we go offline
    if (!isOnline) {
      setWasOffline(true);
    }
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