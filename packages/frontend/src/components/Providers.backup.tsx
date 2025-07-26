'use client';

import { SafeProviders } from './SafeProviders';
import { ProvidersClient } from './ProvidersClient';
import { useEffect, useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Use SafeProviders for initial render, then switch to full providers
  if (!isClient) {
    return <SafeProviders>{children}</SafeProviders>;
  }

  return <ProvidersClient>{children}</ProvidersClient>;
}