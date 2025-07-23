'use client';

import { Header } from '@/components/layout/Header';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useHydrated } from '@/hooks/useHydrated';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useHydrated();
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    if (!hydrated) return;

    const verifyAuth = async () => {
      // If not loading and not authenticated, check auth first
      if (!isLoading && !isAuthenticated) {
        await checkAuth();
        
        // Check again after auth check
        const state = useAuthStore.getState();
        if (!state.isAuthenticated && !state.isLoading) {
          router.replace(`/signin?redirect=${encodeURIComponent(pathname)}`);
        }
      }
    };

    verifyAuth();
  }, [hydrated, isAuthenticated, isLoading, pathname, router, checkAuth]);

  // Show loading while checking auth
  if (!hydrated || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  // Show loading while redirecting
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Redirecting to sign in...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header />
      {children}
    </>
  );
}