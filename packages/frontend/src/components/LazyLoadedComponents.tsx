'use client';

import { lazy, Suspense, ComponentType } from 'react';
import { LoadingSpinner } from '@/components/LoadingSpinner';

// Lazy load chart components for better initial page load
export const LazyProgressLineChart = lazy(() => 
  import('@/components/charts').then(module => ({ default: module.ProgressLineChart }))
);

export const LazyGoalProgressChart = lazy(() => 
  import('@/components/charts').then(module => ({ default: module.GoalProgressChart }))
);

export const LazyActivityBarChart = lazy(() => 
  import('@/components/charts').then(module => ({ default: module.ActivityBarChart }))
);

// Generic lazy loading wrapper with fallback
interface LazyWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
}

export function LazyWrapper({ 
  children, 
  fallback,
  className = '' 
}: LazyWrapperProps) {
  const defaultFallback = (
    <div className={`flex items-center justify-center min-h-[200px] ${className}`}>
      <LoadingSpinner />
    </div>
  );

  return (
    <Suspense fallback={fallback || defaultFallback}>
      {children}
    </Suspense>
  );
}

// HOC for lazy loading any component
export function withLazyLoading<P extends object>(
  Component: ComponentType<P>,
  fallback?: React.ReactNode
) {
  return function LazyComponent(props: P) {
    return (
      <LazyWrapper fallback={fallback}>
        <Component {...props} />
      </LazyWrapper>
    );
  };
}

// Intersection Observer hook for lazy loading content on scroll
export function useIntersectionObserver(
  ref: React.RefObject<HTMLElement>,
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = React.useState(false);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options,
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [ref, options]);

  return isIntersecting;
}

// Lazy loading container that loads content when it comes into view
interface LazyContentProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
  rootMargin?: string;
  threshold?: number;
}

export function LazyContent({
  children,
  fallback,
  className = '',
  rootMargin = '100px',
  threshold = 0.1,
}: LazyContentProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(ref, { rootMargin, threshold });
  const [hasLoaded, setHasLoaded] = React.useState(false);

  React.useEffect(() => {
    if (isVisible && !hasLoaded) {
      setHasLoaded(true);
    }
  }, [isVisible, hasLoaded]);

  return (
    <div ref={ref} className={className}>
      {hasLoaded ? children : (fallback || <div className="min-h-[200px]" />)}
    </div>
  );
}