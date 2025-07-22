'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';

interface AuthGuardProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export function AuthGuard({ children, redirectTo = '/signin' }: AuthGuardProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuthStore();

  useEffect(() => {
    // Don't check during initial load
    if (isLoading) return;

    // If not authenticated, redirect
    if (!isAuthenticated || !user) {
      router.replace(redirectTo);
    }
  }, [isAuthenticated, isLoading, user, router, redirectTo]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Don't render children until we've confirmed authentication
  if (!isAuthenticated || !user) {
    return null;
  }

  return <>{children}</>;
}