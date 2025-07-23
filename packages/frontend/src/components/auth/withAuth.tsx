'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useHydration } from '@/contexts/HydrationContext';

export interface WithAuthOptions {
  redirectTo?: string;
  fallback?: React.ReactNode;
}

/**
 * Higher-order component that protects routes requiring authentication
 * Handles hydration properly to avoid mismatches
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: WithAuthOptions = {}
) {
  const { 
    redirectTo = '/signin',
    fallback = (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  } = options;

  return function AuthenticatedComponent(props: P) {
    const router = useRouter();
    const pathname = usePathname();
    const { isHydrated, isAuthInitialized } = useHydration();
    const { isAuthenticated, isLoading, user } = useAuthStore();

    useEffect(() => {
      // Don't do anything until hydrated and auth is initialized
      if (!isHydrated || !isAuthInitialized) return;

      // After auth is initialized, redirect if not authenticated
      if (!isLoading && !isAuthenticated && !user) {
        // Encode the current path to redirect back after login
        const redirectUrl = `${redirectTo}?redirect=${encodeURIComponent(pathname)}`;
        router.replace(redirectUrl);
      }
    }, [isHydrated, isAuthInitialized, isAuthenticated, isLoading, user, router, pathname, redirectTo]);

    // Show loading while hydrating or initializing auth
    if (!isHydrated || !isAuthInitialized || isLoading) {
      return <>{fallback}</>;
    }

    // Show loading while redirecting
    if (!isAuthenticated || !user) {
      return <>{fallback}</>;
    }

    // User is authenticated, render the component
    return <Component {...props} />;
  };
}