'use client';

import React, { Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingSpinner } from './LoadingSpinner';
import { DashboardSkeleton, ActivityListSkeleton, TeamListSkeleton, LeaderboardSkeleton, ProfileSkeleton } from './SkeletonComponents';

interface PageLoadingProps {
  title?: string;
  subtitle?: string;
  variant?: 'spinner' | 'skeleton' | 'minimal';
  className?: string;
  fullScreen?: boolean;
}

export function PageLoading({
  title = 'Loading',
  subtitle,
  variant = 'spinner',
  className = '',
  fullScreen = false
}: PageLoadingProps) {
  const containerClasses = fullScreen 
    ? 'min-h-screen flex items-center justify-center bg-gray-50'
    : 'flex items-center justify-center py-12 px-4';

  if (variant === 'minimal') {
    return (
      <div className={`${containerClasses} ${className}`}>
        <LoadingSpinner size="md" variant="dots" />
      </div>
    );
  }

  if (variant === 'skeleton') {
    return (
      <div className={`${className} p-4`}>
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className={`${containerClasses} ${className}`}>
      <motion.div 
        className="text-center max-w-md mx-auto"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <LoadingSpinner size="lg" className="mb-6" />
        <motion.h2 
          className="text-xl font-semibold text-gray-900 mb-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {title}
        </motion.h2>
        {subtitle && (
          <motion.p 
            className="text-gray-600"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {subtitle}
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}

interface RouteLoadingProps {
  route: 'dashboard' | 'activities' | 'teams' | 'profile' | 'leaderboard';
  className?: string;
}

export function RouteLoading({ route, className = '' }: RouteLoadingProps) {
  const getRouteSpecificSkeleton = () => {
    switch (route) {
      case 'dashboard':
        return <DashboardSkeleton className={className} />;
      case 'activities':
        return <ActivityListSkeleton className={className} />;
      case 'teams':
        return <TeamListSkeleton className={className} />;
      case 'leaderboard':
        return <LeaderboardSkeleton className={className} />;
      case 'profile':
        return <ProfileSkeleton className={className} />;
      default:
        return <DashboardSkeleton className={className} />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="p-4"
    >
      {getRouteSpecificSkeleton()}
    </motion.div>
  );
}

interface SuspenseWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  route?: 'dashboard' | 'activities' | 'teams' | 'profile' | 'leaderboard';
  className?: string;
}

export function SuspenseWrapper({
  children,
  fallback,
  route = 'dashboard',
  className = ''
}: SuspenseWrapperProps) {
  const defaultFallback = fallback || <RouteLoading route={route} className={className} />;

  return (
    <Suspense fallback={defaultFallback}>
      <AnimatePresence mode="wait">
        {children}
      </AnimatePresence>
    </Suspense>
  );
}

interface LoadingStateManagerProps {
  isLoading: boolean;
  hasError: boolean;
  isEmpty: boolean;
  children: React.ReactNode;
  loadingSkeleton?: React.ReactNode;
  errorFallback?: React.ReactNode;
  emptyFallback?: React.ReactNode;
  className?: string;
  transition?: boolean;
}

export function LoadingStateManager({
  isLoading,
  hasError,
  isEmpty,
  children,
  loadingSkeleton,
  errorFallback,
  emptyFallback,
  className = '',
  transition = true
}: LoadingStateManagerProps) {
  const content = () => {
    if (isLoading) {
      return loadingSkeleton || <DashboardSkeleton />;
    }

    if (hasError) {
      return errorFallback || (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 text-red-500">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Something went wrong
          </h3>
          <p className="text-gray-600">
            We encountered an error while loading this content.
          </p>
        </div>
      );
    }

    if (isEmpty) {
      return emptyFallback || (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 text-gray-400">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No data available
          </h3>
          <p className="text-gray-600">
            There's no content to display at the moment.
          </p>
        </div>
      );
    }

    return children;
  };

  if (!transition) {
    return <div className={className}>{content()}</div>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={isLoading ? 'loading' : hasError ? 'error' : isEmpty ? 'empty' : 'content'}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className={className}
      >
        {content()}
      </motion.div>
    </AnimatePresence>
  );
}

interface LazyLoadTriggerProps {
  onLoad: () => void;
  threshold?: number;
  rootMargin?: string;
  children: React.ReactNode;
  className?: string;
}

export function LazyLoadTrigger({
  onLoad,
  threshold = 0.1,
  rootMargin = '100px',
  children,
  className = ''
}: LazyLoadTriggerProps) {
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasLoaded) {
          setHasLoaded(true);
          onLoad();
        }
      },
      { threshold, rootMargin }
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [onLoad, threshold, rootMargin, hasLoaded]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

interface StaggeredLoadingProps {
  items: Array<React.ReactNode>;
  staggerDelay?: number;
  className?: string;
}

export function StaggeredLoading({
  items,
  staggerDelay = 0.1,
  className = ''
}: StaggeredLoadingProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {items.map((item, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * staggerDelay }}
        >
          {item}
        </motion.div>
      ))}
    </div>
  );
}

interface ContentRevealProps {
  show: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
  delay?: number;
}

export function ContentReveal({
  show,
  children,
  fallback,
  className = '',
  delay = 0
}: ContentRevealProps) {
  return (
    <AnimatePresence mode="wait">
      {show ? (
        <motion.div
          key="content"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3, delay }}
          className={className}
        >
          {children}
        </motion.div>
      ) : (
        <motion.div
          key="fallback"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={className}
        >
          {fallback}
        </motion.div>
      )}
    </AnimatePresence>
  );
}