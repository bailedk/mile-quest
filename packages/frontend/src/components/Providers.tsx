'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { PWAProvider } from './PWAProvider';
import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { PerformanceProvider } from '@/components/optimization/PerformanceProvider';
import { preloadCriticalRoutes } from '@/components/optimization/LazyRoutes';
import { ToastProvider } from '@/contexts/ToastContext';
import { 
  VisualAccessibilityProvider,
  KeyboardNavigationProvider,
  MobileAccessibilityProvider,
  AccessibilityQuickActions,
  AccessibilityDevTools
} from '@/components/accessibility';

// Dynamically import ReactQueryDevtools with no SSR to prevent hydration mismatch
const ReactQueryDevtools = dynamic(
  () => import('@tanstack/react-query-devtools').then((mod) => ({
    default: mod.ReactQueryDevtools,
  })),
  { ssr: false }
);

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // With SSR, we usually want to set some default staleTime
            // above 0 to avoid refetching immediately on the client
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
            retry: 2,
            refetchOnWindowFocus: false,
            refetchOnMount: false,
            refetchOnReconnect: false,
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
        <ToastProvider>
          <VisualAccessibilityProvider>
            <KeyboardNavigationProvider>
              <MobileAccessibilityProvider>
                <PWAProvider>
                  <WebSocketProvider>
                    {children}
                    
                    {/* Accessibility UI Components */}
                    <AccessibilityQuickActions />
                    {process.env.NODE_ENV === 'development' && <AccessibilityDevTools />}
                  </WebSocketProvider>
                </PWAProvider>
              </MobileAccessibilityProvider>
            </KeyboardNavigationProvider>
          </VisualAccessibilityProvider>
        </ToastProvider>
      </PerformanceProvider>
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}