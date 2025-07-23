'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
  lines?: number;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  animation?: 'pulse' | 'wave' | 'shimmer' | 'fade';
  height?: string;
  width?: string;
  delay?: number;
}

export function Skeleton({ 
  className = '', 
  lines = 1,
  variant = 'text',
  animation = 'wave',
  height,
  width,
  delay = 0
}: SkeletonProps) {
  const getVariantClasses = () => {
    switch (variant) {
      case 'circular':
        return 'rounded-full';
      case 'rectangular':
        return 'rounded-none';
      case 'rounded':
        return 'rounded-lg';
      default:
        return 'rounded';
    }
  };

  const getAnimationComponent = (index = 0) => {
    const baseClasses = `bg-gray-200 ${getVariantClasses()} ${className}`;
    const animationDelay = delay + (index * 0.1);

    if (animation === 'pulse') {
      return (
        <motion.div
          className={baseClasses}
          style={{ 
            width: width || (variant === 'text' ? '85%' : '100%'), 
            height: height || (variant === 'text' ? '1rem' : '3rem')
          }}
          animate={{
            opacity: [0.3, 0.7, 0.3]
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: animationDelay,
            ease: 'easeInOut'
          }}
        />
      );
    }

    if (animation === 'fade') {
      return (
        <motion.div
          className={baseClasses}
          style={{ 
            width: width || (variant === 'text' ? '85%' : '100%'), 
            height: height || (variant === 'text' ? '1rem' : '3rem')
          }}
          animate={{
            opacity: [0.2, 0.8, 0.2]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: animationDelay,
            ease: 'easeInOut'
          }}
        />
      );
    }

    if (animation === 'shimmer') {
      return (
        <div
          className={`${baseClasses} relative overflow-hidden`}
          style={{ 
            width: width || (variant === 'text' ? '85%' : '100%'), 
            height: height || (variant === 'text' ? '1rem' : '3rem')
          }}
        >
          <motion.div
            className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent"
            animate={{
              translateX: ['0%', '200%']
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: animationDelay,
              ease: 'linear'
            }}
          />
        </div>
      );
    }

    // Default wave animation
    return (
      <div
        className={`${baseClasses} relative overflow-hidden`}
        style={{ 
          width: width || (variant === 'text' ? '85%' : '100%'), 
          height: height || (variant === 'text' ? '1rem' : '3rem')
        }}
      >
        <motion.div
          className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-gray-300/30 to-transparent"
          animate={{
            translateX: ['0%', '200%']
          }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            delay: animationDelay,
            ease: 'linear'
          }}
        />
      </div>
    );
  };

  if (variant === 'text' && lines > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i}>
            {getAnimationComponent(i)}
          </div>
        ))}
      </div>
    );
  }

  return getAnimationComponent();
}

// Dashboard-specific skeleton components
interface DashboardSkeletonProps {
  className?: string;
  showTeamProgress?: boolean;
  showStats?: boolean;
  showCharts?: boolean;
}

export function DashboardSkeleton({ 
  className = '',
  showTeamProgress = true,
  showStats = true,
  showCharts = true
}: DashboardSkeletonProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Team selector skeleton */}
      <div className="space-y-2">
        <Skeleton variant="rectangular" height="2.5rem" width="40%" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton variant="rounded" height="3rem" />
          <Skeleton variant="rounded" height="3rem" />
        </div>
      </div>

      {/* Team progress skeleton */}
      {showTeamProgress && (
        <motion.div 
          className="bg-white rounded-lg shadow-sm p-6 space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex justify-between items-center">
            <Skeleton width="60%" height="1.5rem" />
            <Skeleton width="30%" height="1rem" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Skeleton width="25%" height="0.875rem" />
              <Skeleton width="25%" height="0.875rem" />
            </div>
            <Skeleton variant="rounded" height="0.75rem" />
            <div className="text-center">
              <Skeleton width="50%" height="0.875rem" className="mx-auto" />
            </div>
          </div>
        </motion.div>
      )}

      {/* Log activity button skeleton */}
      <Skeleton variant="rounded" height="3rem" />

      {/* Personal stats skeleton */}
      {showStats && (
        <motion.div 
          className="grid grid-cols-2 gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm p-4 space-y-2">
              <Skeleton width="70%" height="0.875rem" />
              <Skeleton width="40%" height="1.25rem" />
            </div>
          ))}
        </motion.div>
      )}

      {/* Chart skeleton */}
      {showCharts && (
        <motion.div 
          className="bg-white rounded-lg shadow-sm p-4 space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex justify-between items-center">
            <Skeleton width="50%" height="1.25rem" />
            <div className="flex space-x-2">
              <Skeleton width="4rem" height="2rem" variant="rounded" />
              <Skeleton width="4rem" height="2rem" variant="rounded" />
            </div>
          </div>
          <Skeleton variant="rounded" height="12rem" />
        </motion.div>
      )}
    </div>
  );
}

interface ActivityListSkeletonProps {
  items?: number;
  className?: string;
  showAvatar?: boolean;
  staggered?: boolean;
}

export function ActivityListSkeleton({ 
  items = 5,
  className = '',
  showAvatar = true,
  staggered = true
}: ActivityListSkeletonProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: items }).map((_, i) => (
        <motion.div 
          key={i} 
          className="bg-white rounded-lg shadow-sm p-4 space-y-3"
          initial={staggered ? { opacity: 0, x: -20 } : { opacity: 1 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: staggered ? i * 0.1 : 0 }}
        >
          <div className="flex items-start space-x-3">
            {showAvatar && (
              <Skeleton variant="circular" width="2.5rem" height="2.5rem" />
            )}
            <div className="flex-1 space-y-2">
              <div className="flex justify-between">
                <Skeleton width="60%" height="1rem" />
                <Skeleton width="20%" height="0.875rem" />
              </div>
              <Skeleton width="80%" height="0.875rem" />
              <Skeleton width="40%" height="0.875rem" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

interface TeamListSkeletonProps {
  items?: number;
  className?: string;
  showProgress?: boolean;
}

export function TeamListSkeleton({ 
  items = 3,
  className = '',
  showProgress = true
}: TeamListSkeletonProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: items }).map((_, i) => (
        <motion.div 
          key={i} 
          className="bg-white rounded-lg shadow-sm p-6 space-y-4"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.1 }}
        >
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <Skeleton width="8rem" height="1.25rem" />
              <Skeleton width="6rem" height="0.875rem" />
            </div>
            <Skeleton width="4rem" height="0.875rem" />
          </div>
          
          {showProgress && (
            <div className="space-y-2">
              <div className="flex justify-between">
                <Skeleton width="25%" height="0.875rem" />
                <Skeleton width="25%" height="0.875rem" />
              </div>
              <Skeleton variant="rounded" height="0.75rem" />
            </div>
          )}
          
          <div className="flex justify-between pt-2 border-t border-gray-100">
            <Skeleton width="30%" height="0.75rem" />
            <Skeleton width="20%" height="0.75rem" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

interface LeaderboardSkeletonProps {
  items?: number;
  className?: string;
  showRanking?: boolean;
}

export function LeaderboardSkeleton({ 
  items = 5,
  className = '',
  showRanking = true
}: LeaderboardSkeletonProps) {
  return (
    <div className={`bg-white rounded-lg shadow-sm p-4 ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <Skeleton width="40%" height="1.25rem" />
        <div className="flex space-x-2">
          <Skeleton width="3rem" height="1.5rem" variant="rounded" />
          <Skeleton width="3rem" height="1.5rem" variant="rounded" />
        </div>
      </div>
      
      <div className="space-y-3">
        {Array.from({ length: items }).map((_, i) => (
          <motion.div 
            key={i} 
            className="flex items-center space-x-4 p-3 rounded-lg border border-gray-100"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            {showRanking && (
              <div className="flex-shrink-0 w-6">
                <Skeleton width="1.5rem" height="1.5rem" variant="circular" />
              </div>
            )}
            <Skeleton variant="circular" width="2.5rem" height="2.5rem" />
            <div className="flex-1 space-y-1">
              <Skeleton width="60%" height="1rem" />
              <Skeleton width="40%" height="0.875rem" />
            </div>
            <div className="text-right space-y-1">
              <Skeleton width="3rem" height="1rem" />
              <Skeleton width="2rem" height="0.875rem" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

interface ProfileSkeletonProps {
  className?: string;
  showAchievements?: boolean;
  showStats?: boolean;
}

export function ProfileSkeleton({ 
  className = '',
  showAchievements = true,
  showStats = true
}: ProfileSkeletonProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Profile header */}
      <motion.div 
        className="bg-white rounded-lg shadow-sm p-6 text-center space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Skeleton variant="circular" width="6rem" height="6rem" className="mx-auto" />
        <div className="space-y-2">
          <Skeleton width="40%" height="1.5rem" className="mx-auto" />
          <Skeleton width="60%" height="1rem" className="mx-auto" />
          <Skeleton width="30%" height="0.875rem" className="mx-auto" />
        </div>
      </motion.div>

      {/* Stats grid */}
      {showStats && (
        <motion.div 
          className="grid grid-cols-2 gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm p-4 text-center space-y-2">
              <Skeleton width="70%" height="0.875rem" className="mx-auto" />
              <Skeleton width="50%" height="1.5rem" className="mx-auto" />
            </div>
          ))}
        </motion.div>
      )}

      {/* Achievements */}
      {showAchievements && (
        <motion.div 
          className="bg-white rounded-lg shadow-sm p-4 space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Skeleton width="40%" height="1.25rem" />
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="text-center space-y-2">
                <Skeleton variant="circular" width="3rem" height="3rem" className="mx-auto" />
                <Skeleton width="100%" height="0.75rem" />
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Progressive loading skeleton that reveals content in stages
interface ProgressiveSkeletonProps {
  stage: 'initial' | 'loading' | 'partial' | 'complete';
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
}

export function ProgressiveSkeleton({ 
  stage,
  children,
  fallback,
  className = ''
}: ProgressiveSkeletonProps) {
  if (stage === 'initial' || stage === 'loading') {
    return (
      <div className={className}>
        {fallback || <DashboardSkeleton />}
      </div>
    );
  }

  if (stage === 'partial') {
    return (
      <motion.div 
        className={className}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div 
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {children}
    </motion.div>
  );
}