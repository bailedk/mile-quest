/**
 * Performance optimization components and utilities
 */

// Components
export { default as LazyImage } from './LazyImage';
export { VirtualList, VirtualActivityList, VirtualTeamList } from './VirtualList';
export { PerformanceProvider, usePerformanceContext } from './PerformanceProvider';
export { default as PerformanceDashboard } from './PerformanceDashboard';

// Lazy routes
export * from './LazyRoutes';

// Utilities and hooks
export * from '@/utils/performance';
export * from '@/utils/optimizedFetching';
export * from '@/hooks/usePerformance';

// Types
export interface PerformanceConfig {
  enableMetrics: boolean;
  enableDevtools: boolean;
  monitoringInterval: number;
  budgetAlerts: boolean;
}

export interface OptimizationFeatures {
  bundleSplitting: boolean;
  lazyLoading: boolean;
  virtualScrolling: boolean;
  imageOptimization: boolean;
  serviceWorkerCaching: boolean;
  performanceMonitoring: boolean;
  prefetching: boolean;
  memoryManagement: boolean;
}

// Default configuration
export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  enableMetrics: true,
  enableDevtools: process.env.NODE_ENV === 'development',
  monitoringInterval: 5000,
  budgetAlerts: true,
};

export const OPTIMIZATION_FEATURES: OptimizationFeatures = {
  bundleSplitting: true,
  lazyLoading: true,
  virtualScrolling: true,
  imageOptimization: true,
  serviceWorkerCaching: true,
  performanceMonitoring: true,
  prefetching: true,
  memoryManagement: true,
};