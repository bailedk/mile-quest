/**
 * Lazy-loaded route components with performance tracking
 */

import { createLazyComponent } from '@/utils/performance';
import React, { Suspense } from 'react';

// Loading component
const RouteLoader = ({ message = 'Loading...' }: { message?: string }) => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">{message}</p>
    </div>
  </div>
);

// Error boundary for lazy routes
class LazyRouteErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy route loading error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <div className="text-center">
              <div className="text-red-500 text-6xl mb-4">⚠️</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Failed to load page
              </h2>
              <p className="text-gray-600 mb-4">
                Something went wrong while loading this page.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

// Wrapper for lazy routes
function withLazyRoute<P extends object>(
  LazyComponent: React.LazyExoticComponent<React.ComponentType<P>>,
  loadingMessage?: string,
  errorFallback?: React.ReactNode
) {
  return function LazyRouteWrapper(props: P) {
    return (
      <LazyRouteErrorBoundary fallback={errorFallback}>
        <Suspense fallback={<RouteLoader message={loadingMessage} />}>
          <LazyComponent {...props} />
        </Suspense>
      </LazyRouteErrorBoundary>
    );
  };
}

// Dashboard route - heavy with charts and real-time data
export const LazyDashboard = withLazyRoute(
  createLazyComponent(
    () => import('@/app/(authenticated)/dashboard/page'),
    'dashboard'
  ),
  'Loading dashboard...'
);

// Activities route - potentially large lists
export const LazyActivities = withLazyRoute(
  createLazyComponent(
    () => import('@/app/(authenticated)/activities/page'),
    'activities'
  ),
  'Loading activities...'
);

// New Activity route - includes maps and forms
export const LazyNewActivity = withLazyRoute(
  createLazyComponent(
    () => import('@/app/(authenticated)/activities/new/page'),
    'new-activity'
  ),
  'Loading activity form...'
);

// Teams route - lists and team management
export const LazyTeams = withLazyRoute(
  createLazyComponent(
    () => import('@/app/(authenticated)/teams/page'),
    'teams'
  ),
  'Loading teams...'
);

// Team details route - charts and member lists
export const LazyTeamDetails = withLazyRoute(
  createLazyComponent(
    () => import('@/app/(authenticated)/teams/[id]/page'),
    'team-details'
  ),
  'Loading team details...'
);

// New Team route - forms and validation
export const LazyNewTeam = withLazyRoute(
  createLazyComponent(
    () => import('@/app/(authenticated)/teams/new/page'),
    'new-team'
  ),
  'Loading team creation...'
);

// Join Team route - search and validation
export const LazyJoinTeam = withLazyRoute(
  createLazyComponent(
    () => import('@/app/(authenticated)/teams/join/page'),
    'join-team'
  ),
  'Loading team search...'
);

// Profile route - forms and settings
export const LazyProfile = withLazyRoute(
  createLazyComponent(
    () => import('@/app/(authenticated)/profile/page'),
    'profile'
  ),
  'Loading profile...'
);

// Demo routes - can be loaded on demand
export const LazyDemoAchievements = withLazyRoute(
  createLazyComponent(
    () => import('@/app/demo/achievements/page'),
    'demo-achievements'
  ),
  'Loading achievements demo...'
);

export const LazyDemoProgress = withLazyRoute(
  createLazyComponent(
    () => import('@/app/demo/progress/page'),
    'demo-progress'
  ),
  'Loading progress demo...'
);

export const LazyDemoOffline = withLazyRoute(
  createLazyComponent(
    () => import('@/app/demo/offline/page'),
    'demo-offline'
  ),
  'Loading offline demo...'
);

// Authentication routes - lighter weight, can preload
export const LazySignIn = withLazyRoute(
  createLazyComponent(
    () => import('@/app/signin/page'),
    'signin'
  ),
  'Loading sign in...'
);

export const LazySignUp = withLazyRoute(
  createLazyComponent(
    () => import('@/app/signup/page'),
    'signup'
  ),
  'Loading sign up...'
);

// Offline route - PWA functionality
export const LazyOffline = withLazyRoute(
  createLazyComponent(
    () => import('@/app/offline/page'),
    'offline'
  ),
  'Loading offline page...'
);

// Route component map for dynamic loading
export const LAZY_ROUTES = {
  '/dashboard': LazyDashboard,
  '/activities': LazyActivities,
  '/activities/new': LazyNewActivity,
  '/teams': LazyTeams,
  '/teams/new': LazyNewTeam,
  '/teams/join': LazyJoinTeam,
  '/teams/[id]': LazyTeamDetails,
  '/profile': LazyProfile,
  '/demo/achievements': LazyDemoAchievements,
  '/demo/progress': LazyDemoProgress,
  '/demo/offline': LazyDemoOffline,
  '/signin': LazySignIn,
  '/signup': LazySignUp,
  '/offline': LazyOffline,
} as const;

// Preload critical routes
export function preloadCriticalRoutes() {
  if (typeof window !== 'undefined') {
    // Preload dashboard and activities as they're commonly accessed
    setTimeout(() => {
      import('@/app/(authenticated)/dashboard/page');
      import('@/app/(authenticated)/activities/page');
    }, 2000); // Wait 2 seconds after initial load
  }
}

// Route-based preloading
export function preloadRoute(routePath: string) {
  const preloadMap: Record<string, () => Promise<any>> = {
    '/dashboard': () => import('@/app/(authenticated)/dashboard/page'),
    '/activities': () => import('@/app/(authenticated)/activities/page'),
    '/activities/new': () => import('@/app/(authenticated)/activities/new/page'),
    '/teams': () => import('@/app/(authenticated)/teams/page'),
    '/teams/new': () => import('@/app/(authenticated)/teams/new/page'),
    '/teams/join': () => import('@/app/(authenticated)/teams/join/page'),
    '/teams/[id]': () => import('@/app/(authenticated)/teams/[id]/page'),
    '/profile': () => import('@/app/(authenticated)/profile/page'),
    '/signin': () => import('@/app/signin/page'),
    '/signup': () => import('@/app/signup/page'),
  };

  const preloader = preloadMap[routePath];
  if (preloader) {
    preloader().catch(console.error);
  }
}