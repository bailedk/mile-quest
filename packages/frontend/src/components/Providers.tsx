'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { AuthInitializer } from '@/components/auth/AuthInitializer';
import { ToastProvider } from '@/contexts/ToastContext';
import { HydrationProvider } from '@/contexts/HydrationContext';

// Create query client outside of component to avoid recreation
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer />
      <HydrationProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </HydrationProvider>
    </QueryClientProvider>
  );
}