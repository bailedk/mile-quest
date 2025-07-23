'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useHydrated } from '@/hooks/useHydrated';
import { Header } from './Header';

interface ProtectedLayoutProps {
  children: React.ReactNode;
}

export function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useHydrated();
  const { isAuthenticated, isLoading, user, checkAuth } = useAuthStore();

  useEffect(() => {
    if (!hydrated) return;

    const verifyAndRedirect = async () => {
      // Check auth state if not already loading
      if (!isLoading && !isAuthenticated) {
        await checkAuth();
        
        // After checking, if still not authenticated, redirect
        const currentAuth = useAuthStore.getState();
        if (!currentAuth.isAuthenticated && !currentAuth.isLoading) {
          const redirectUrl = `/signin?redirect=${encodeURIComponent(pathname)}`;
          router.replace(redirectUrl);
        }
      }
    };

    verifyAndRedirect();
  }, [hydrated, pathname, router, isAuthenticated, isLoading, checkAuth]);

  // Show loading state while checking auth
  if (!hydrated || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // If not authenticated after check, show loading (will redirect soon)
  if (!isAuthenticated || !user) {
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

  // User is authenticated, render the layout
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}