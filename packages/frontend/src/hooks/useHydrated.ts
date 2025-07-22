'use client';

import { useEffect, useState } from 'react';

/**
 * Hook to detect when the app has been hydrated on the client.
 * Useful for preventing hydration mismatches with client-only state.
 */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
}