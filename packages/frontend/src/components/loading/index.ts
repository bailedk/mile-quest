// Enhanced Loading Components Export
export {
  LoadingSpinner,
  LoadingOverlay,
  InlineLoading,
  LoadingButton
} from './LoadingSpinner';

export {
  Skeleton,
  DashboardSkeleton,
  ActivityListSkeleton,
  TeamListSkeleton,
  LeaderboardSkeleton,
  ProfileSkeleton,
  ProgressiveSkeleton
} from './SkeletonComponents';

export {
  PageLoading,
  RouteLoading,
  SuspenseWrapper,
  LoadingStateManager,
  LazyLoadTrigger,
  StaggeredLoading,
  ContentReveal
} from './PageLoading';

export {
  ProgressiveLoading,
  StaggeredReveal,
  SkeletonMorph,
  WaveLoading,
  SmartLoading
} from './ProgressiveLoading';

export {
  LoadingProvider,
  useLoadingState,
  useLoadingOperation,
  ManagedLoading
} from './LoadingStateManager';

// Enhanced loading hook
export {
  useEnhancedLoading,
  useMultipleLoadingStates,
  usePaginatedLoading
} from '../../hooks/useEnhancedLoading';

// Dashboard specific loading components
export {
  DashboardLoadingState,
  DashboardSectionLoading,
  DashboardActionButton
} from '../dashboard/DashboardLoadingState';

// Activity specific loading components
export {
  ActivityListLoading,
  ActivityFormLoading,
  ActivityStatsLoading,
  ActivityDetailLoading,
  ActivityFeedProgressiveLoading
} from '../activities/ActivityLoadingStates';

// Re-export legacy LoadingSpinner for backward compatibility
export { 
  LoadingSpinner as LegacyLoadingSpinner,
  LoadingOverlay as LegacyLoadingOverlay,
  LoadingSkeleton,
  CardSkeleton,
  ListSkeleton,
  LoadingState,
  InlineLoading as LegacyInlineLoading
} from '../LoadingSpinner';