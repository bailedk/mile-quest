'use client';

import { useHydrated } from '@/hooks/useHydrated';

interface DevOnlyWrapperProps {
  children: React.ReactNode;
}

export function DevOnlyWrapper({ children }: DevOnlyWrapperProps) {
  const hydrated = useHydrated();
  
  if (!hydrated || process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  return <>{children}</>;
}