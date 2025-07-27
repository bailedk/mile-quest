'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useHydration } from '@/contexts/HydrationContext';
import { Header } from '@/components/layout/Header';
import { BottomNavigation, defaultNavItems, useBottomNavigation } from '@/components/mobile/BottomNavigation';
import { useMediaQuery } from '@/utils/hydration';

export function AuthenticatedLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isHydrated, isAuthInitialized } = useHydration();
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const { shouldShow: shouldShowBottomNav } = useBottomNavigation();
  const isMobile = useMediaQuery('(max-width: 767px)');

  useEffect(() => {
    if (!isHydrated || !isAuthInitialized) return;

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
  }, [isHydrated, isAuthInitialized, isAuthenticated, isLoading, pathname, router, checkAuth]);

  // Show loading while checking auth
  if (!isHydrated || !isAuthInitialized || isLoading) {
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
    <div className="min-h-screen bg-gray-50">
      {/* Only show Header on non-mobile screens to avoid duplicate headers */}
      {!isMobile && <Header />}
      <main className={`flex-1 ${shouldShowBottomNav && !isMobile ? 'pb-20' : ''}`}>
        {children}
      </main>
      {shouldShowBottomNav && !isMobile && <BottomNavigation items={defaultNavItems} />}
    </div>
  );
}