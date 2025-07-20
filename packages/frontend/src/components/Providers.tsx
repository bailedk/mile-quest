'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, useEffect } from 'react';
import { PWAProvider } from './PWAProvider';
import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { PerformanceProvider } from '@/components/optimization/PerformanceProvider';
import { preloadCriticalRoutes } from '@/components/optimization/LazyRoutes';
import { 
  VisualAccessibilityProvider,
  KeyboardNavigationProvider,
  MobileAccessibilityProvider,
  AccessibilityQuickActions,
  AccessibilityDevTools
} from '@/components/accessibility';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // With SSR, we usually want to set some default staleTime
            // above 0 to avoid refetching immediately on the client
            staleTime: 60 * 1000, // 1 minute
            gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
            retry: 2,
            refetchOnWindowFocus: false,
            // Performance optimization: reduce network waterfall
            networkMode: 'online',
          },
          mutations: {
            // Optimize mutation error handling
            retry: 1,
            networkMode: 'online',
          },
        },
      })
  );

  // Preload critical routes after initial load
  useEffect(() => {
    preloadCriticalRoutes();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <PerformanceProvider>
        <VisualAccessibilityProvider>
          <KeyboardNavigationProvider>
            <MobileAccessibilityProvider>
              <PWAProvider>
                <WebSocketProvider>
                  {children}
                  
                  {/* Accessibility UI Components */}
                  <AccessibilityQuickActions />
                  <AccessibilityDevTools />
                </WebSocketProvider>
              </PWAProvider>
            </MobileAccessibilityProvider>
          </KeyboardNavigationProvider>
        </VisualAccessibilityProvider>
      </PerformanceProvider>
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
    </QueryClientProvider>
  );
}