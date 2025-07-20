'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  ActivityListSkeleton, 
  StaggeredReveal, 
  WaveLoading,
  LoadingSpinner,
  SmartLoading 
} from '@/components/loading';

interface ActivityListLoadingProps {
  isLoading: boolean;
  error?: Error | null;
  activities: any[];
  children: (activities: any[]) => React.ReactNode;
  variant?: 'skeleton' | 'wave' | 'staggered';
  itemCount?: number;
  className?: string;
  onRetry?: () => void;
}

export function ActivityListLoading({
  isLoading,
  error,
  activities,
  children,
  variant = 'skeleton',
  itemCount = 5,
  className = ''
}: ActivityListLoadingProps) {
  return (
    <SmartLoading
      data={activities}
      isLoading={isLoading}
      error={error}
      className={className}
      skeleton={getActivitySkeleton(variant, itemCount)}
      empty={
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 text-gray-400">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No activities yet
          </h3>
          <p className="text-gray-600">
            Start logging your walking activities to see them here.
          </p>
        </div>
      }
    >
      {children}
    </SmartLoading>
  );
}

function getActivitySkeleton(variant: string, itemCount: number) {
  if (variant === 'wave') {
    return (
      <WaveLoading items={itemCount} delay={0.15}>
        {(index) => <ActivityItemSkeleton key={index} />}
      </WaveLoading>
    );
  }

  if (variant === 'staggered') {
    const items = Array.from({ length: itemCount }, (_, i) => (
      <ActivityItemSkeleton key={i} />
    ));
    return (
      <StaggeredReveal staggerDelay={0.1}>
        {items}
      </StaggeredReveal>
    );
  }

  // Default skeleton variant
  return (
    <ActivityListSkeleton 
      items={itemCount}
      showAvatar={true}
      staggered={true}
    />
  );
}

function ActivityItemSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
      <div className="flex items-start space-x-3">
        <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="flex justify-between">
            <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
            <div className="h-3 bg-gray-200 rounded w-16 animate-pulse" />
          </div>
          <div className="h-3 bg-gray-200 rounded w-48 animate-pulse" />
          <div className="h-3 bg-gray-200 rounded w-24 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

interface ActivityFormLoadingProps {
  isSubmitting: boolean;
  children: React.ReactNode;
  className?: string;
}

export function ActivityFormLoading({
  isSubmitting,
  children,
  className = ''
}: ActivityFormLoadingProps) {
  return (
    <div className={`relative ${className}`}>
      {children}
      {isSubmitting && (
        <motion.div
          className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="text-center">
            <LoadingSpinner size="lg" variant="orbit" className="mb-4" />
            <p className="text-gray-600 font-medium">Saving your activity...</p>
            <p className="text-gray-500 text-sm mt-1">This may take a moment</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

interface ActivityStatsLoadingProps {
  isLoading: boolean;
  stats: any;
  children: (stats: any) => React.ReactNode;
  className?: string;
}

export function ActivityStatsLoading({
  isLoading,
  stats,
  children,
  className = ''
}: ActivityStatsLoadingProps) {
  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm p-6 ${className}`}>
        <div className="space-y-4">
          <div className="h-5 bg-gray-200 rounded w-32 animate-pulse" />
          <div className="grid grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="text-center space-y-2">
                <div className="h-8 bg-gray-200 rounded w-16 mx-auto animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-20 mx-auto animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      {children(stats)}
    </motion.div>
  );
}

interface ActivityDetailLoadingProps {
  isLoading: boolean;
  activity: any;
  children: (activity: any) => React.ReactNode;
  className?: string;
}

export function ActivityDetailLoading({
  isLoading,
  activity,
  children,
  className = ''
}: ActivityDetailLoadingProps) {
  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        {/* Header skeleton */}
        <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-6 bg-gray-200 rounded w-40 animate-pulse" />
              <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
            </div>
            <div className="h-4 bg-gray-200 rounded w-16 animate-pulse" />
          </div>
        </div>

        {/* Stats skeleton */}
        <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
          <div className="h-5 bg-gray-200 rounded w-32 animate-pulse" />
          <div className="grid grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="text-center space-y-2">
                <div className="h-8 bg-gray-200 rounded w-16 mx-auto animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-20 mx-auto animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Description skeleton */}
        <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
          <div className="h-5 bg-gray-200 rounded w-24 animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-full animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={className}
    >
      {children(activity)}
    </motion.div>
  );
}

// Progressive loading for activity feed that loads in chunks
interface ActivityFeedProgressiveLoadingProps {
  activities: any[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  children: (activities: any[]) => React.ReactNode;
  chunkSize?: number;
  className?: string;
}

export function ActivityFeedProgressiveLoading({
  activities,
  isLoading,
  hasMore,
  onLoadMore,
  children,
  chunkSize = 5,
  className = ''
}: ActivityFeedProgressiveLoadingProps) {
  const [visibleCount, setVisibleCount] = React.useState(chunkSize);

  React.useEffect(() => {
    if (activities.length > 0 && visibleCount < activities.length) {
      const timer = setTimeout(() => {
        setVisibleCount(prev => Math.min(prev + chunkSize, activities.length));
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [activities.length, visibleCount, chunkSize]);

  const visibleActivities = activities.slice(0, visibleCount);

  return (
    <div className={className}>
      {children(visibleActivities)}
      
      {/* Loading more indicator */}
      {visibleCount < activities.length && (
        <div className="text-center py-4">
          <LoadingSpinner size="sm" variant="dots" />
        </div>
      )}
      
      {/* Load more button */}
      {hasMore && visibleCount === activities.length && (
        <div className="text-center py-6">
          <button
            onClick={onLoadMore}
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 mx-auto"
          >
            {isLoading ? (
              <>
                <LoadingSpinner size="xs" color="white" />
                <span>Loading more...</span>
              </>
            ) : (
              <span>Load more activities</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}