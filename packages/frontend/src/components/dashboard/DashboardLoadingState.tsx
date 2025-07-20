'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  DashboardSkeleton, 
  StaggeredReveal, 
  SkeletonMorph,
  LoadingSpinner 
} from '@/components/loading';
import { MobileLayout } from '@/components/layout/MobileLayout';

interface DashboardLoadingStateProps {
  isLoading: boolean;
  children: React.ReactNode;
  variant?: 'skeleton' | 'progressive' | 'minimal';
  showHeader?: boolean;
}

export function DashboardLoadingState({
  isLoading,
  children,
  variant = 'skeleton',
  showHeader = true
}: DashboardLoadingStateProps) {
  const getLoadingContent = () => {
    if (variant === 'minimal') {
      return (
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <LoadingSpinner size="lg" variant="orbit" className="mb-4" />
            <p className="text-gray-600">Loading your dashboard...</p>
          </div>
        </div>
      );
    }

    if (variant === 'progressive') {
      const skeletonItems = [
        <DashboardTeamSkeleton key="team" />,
        <DashboardStatsSkeleton key="stats" />,
        <DashboardChartSkeleton key="chart" />,
        <DashboardActivitySkeleton key="activity" />
      ];

      return (
        <StaggeredReveal staggerDelay={0.2}>
          {skeletonItems}
        </StaggeredReveal>
      );
    }

    // Default skeleton variant
    return (
      <DashboardSkeleton 
        showTeamProgress={true}
        showStats={true}
        showCharts={true}
      />
    );
  };

  if (showHeader) {
    return (
      <MobileLayout title="Dashboard">
        <SkeletonMorph
          isLoading={isLoading}
          skeleton={
            <div className="p-4">
              {getLoadingContent()}
            </div>
          }
          morphDuration={0.5}
        >
          {children}
        </SkeletonMorph>
      </MobileLayout>
    );
  }

  return (
    <SkeletonMorph
      isLoading={isLoading}
      skeleton={getLoadingContent()}
      morphDuration={0.5}
    >
      {children}
    </SkeletonMorph>
  );
}

// Individual skeleton components for progressive loading
function DashboardTeamSkeleton() {
  return (
    <motion.div 
      className="bg-white rounded-lg shadow-sm p-6 mb-6 space-y-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex justify-between items-center">
        <div className="h-6 bg-gray-200 rounded w-32 animate-pulse" />
        <div className="h-4 bg-gray-200 rounded w-16 animate-pulse" />
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between">
          <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
        </div>
        <div className="h-3 bg-gray-200 rounded-full animate-pulse" />
        <div className="text-center">
          <div className="h-4 bg-gray-200 rounded w-40 mx-auto animate-pulse" />
        </div>
      </div>
      
      <div className="pt-4 border-t border-gray-100">
        <div className="h-3 bg-gray-200 rounded w-24 animate-pulse" />
      </div>
    </motion.div>
  );
}

function DashboardStatsSkeleton() {
  return (
    <motion.div 
      className="grid grid-cols-2 gap-4 mb-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-lg shadow-sm p-4 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
          <div className="h-6 bg-gray-200 rounded w-16 animate-pulse" />
        </div>
      ))}
    </motion.div>
  );
}

function DashboardChartSkeleton() {
  return (
    <motion.div 
      className="bg-white rounded-lg shadow-sm p-4 mb-6 space-y-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <div className="flex justify-between items-center">
        <div className="h-5 bg-gray-200 rounded w-32 animate-pulse" />
        <div className="flex space-x-2">
          <div className="h-8 bg-gray-200 rounded w-16 animate-pulse" />
          <div className="h-8 bg-gray-200 rounded w-16 animate-pulse" />
        </div>
      </div>
      <div className="h-48 bg-gray-200 rounded-lg animate-pulse" />
    </motion.div>
  );
}

function DashboardActivitySkeleton() {
  return (
    <motion.div 
      className="bg-white rounded-lg shadow-sm p-6 space-y-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
    >
      <div className="h-5 bg-gray-200 rounded w-32 animate-pulse" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center space-x-3 py-2 border-b border-gray-100 last:border-0">
            <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-48 animate-pulse" />
              <div className="h-3 bg-gray-200 rounded w-32 animate-pulse" />
            </div>
            <div className="h-3 bg-gray-200 rounded w-16 animate-pulse" />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// Loading overlay for specific dashboard sections
interface DashboardSectionLoadingProps {
  isLoading: boolean;
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export function DashboardSectionLoading({
  isLoading,
  children,
  title = 'Loading...',
  className = ''
}: DashboardSectionLoadingProps) {
  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm p-6 ${className}`}>
        <div className="text-center py-8">
          <LoadingSpinner size="md" variant="dots" className="mb-4" />
          <p className="text-gray-600 text-sm">{title}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Enhanced loading button specifically for dashboard actions
interface DashboardActionButtonProps {
  isLoading: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}

export function DashboardActionButton({
  isLoading,
  onClick,
  children,
  className = '',
  disabled = false,
  variant = 'primary'
}: DashboardActionButtonProps) {
  const baseClasses = "relative w-full px-6 py-3 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2";
  const variantClasses = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:bg-gray-400",
    secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-500 disabled:bg-gray-100"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      <span className={`${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200 flex items-center justify-center`}>
        {children}
      </span>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <LoadingSpinner size="sm" variant="spinner" color="white" />
        </div>
      )}
    </button>
  );
}