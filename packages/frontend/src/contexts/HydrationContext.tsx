'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuthStore } from '@/store/auth.store';

interface HydrationContextValue {
  isHydrated: boolean;
  isAuthInitialized: boolean;
}

const HydrationContext = createContext<HydrationContextValue>({
  isHydrated: false,
  isAuthInitialized: false,
});

interface HydrationProviderProps {
  children: ReactNode;
}

export function HydrationProvider({ children }: HydrationProviderProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [isAuthInitialized, setIsAuthInitialized] = useState(false);

  useEffect(() => {
    // Mark as hydrated
    setIsHydrated(true);

    // Initialize auth store
    const initializeAuth = async () => {
      try {
        // Check current auth status
        const store = useAuthStore.getState();
        await store.checkAuth();
        
        setIsAuthInitialized(true);
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        setIsAuthInitialized(true); // Mark as initialized even on error
      }
    };

    initializeAuth();
  }, []);

  return (
    <HydrationContext.Provider value={{ isHydrated, isAuthInitialized }}>
      {children}
    </HydrationContext.Provider>
  );
}

export function useHydration() {
  const context = useContext(HydrationContext);
  if (!context) {
    throw new Error('useHydration must be used within HydrationProvider');
  }
  return context;
}

/**
 * @deprecated Use useHydration from HydrationContext instead
 */
export function useHydrated() {
  const { isHydrated } = useHydration();
  return isHydrated;
}