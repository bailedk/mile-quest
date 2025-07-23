'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import ReactQueryDevtools with no SSR
const ReactQueryDevtools = dynamic(
  () => import('@tanstack/react-query-devtools').then((mod) => ({
    default: mod.ReactQueryDevtools,
  })),
  { ssr: false }
);

export function ClientOnlyDevTools() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Only render after client-side mount to prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  return <ReactQueryDevtools initialIsOpen={false} />;
}