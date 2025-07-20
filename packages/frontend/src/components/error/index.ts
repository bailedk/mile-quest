// Legacy exports (maintain backwards compatibility)
export { ErrorBoundary, withErrorBoundary } from '../ErrorBoundary';
export { ErrorAlert } from '../ErrorAlert';
export {
  ErrorMessage,
  RetryButton,
  ErrorState,
  NetworkError,
  LoadingError
} from './ErrorComponents';

// Enhanced Error Boundaries
export {
  RouteErrorBoundary,
  ComponentErrorBoundary,
  AsyncErrorBoundary,
  DashboardErrorBoundary,
  withRouteErrorBoundary,
  withComponentErrorBoundary,
  withAsyncErrorBoundary,
  withDashboardErrorBoundary
} from './ErrorBoundaries';

// Error Pages
export {
  NotFound as NotFoundError,
  Forbidden as ForbiddenError,
  InternalServerError as ServerError,
  LoadingErrorFallback,
  OfflineError,
  MaintenanceError,
  GenericError,
  AuthRequired
} from './ErrorPages';

// NetworkError is from ErrorComponents, re-export as NetworkErrorPage
export { NetworkError as NetworkErrorPage } from './ErrorComponents';

// Error Recovery Components
export {
  GracefulFeature,
  AutoRetry,
  NetworkAware,
  ProgressiveEnhancement,
  ConditionalFeature,
  CachedFallback
} from './ErrorRecovery';

// Mobile-Optimized Error States
export {
  MobileErrorState,
  MobileNetworkError,
  MobileLoadingError,
  MobilePermissionError,
  MobileMaintenanceError,
  MobileFormError,
  MobileSuccessState
} from './MobileErrorStates';

// Accessible Error Components
export {
  AccessibleError,
  AccessibleInlineError,
  AccessibleErrorList,
  AccessibleErrorDialog
} from './AccessibleErrorStates';

// Error Reporting and Analytics
export {
  errorReporting,
  reportError,
  getErrorReports,
  markErrorResolved,
  clearErrorReports,
  generateErrorAnalytics,
  categorizeError,
  generateErrorFingerprint,
  collectErrorContext
} from '../../utils/error-reporting';

export type {
  ErrorCategory,
  ErrorSeverity,
  ErrorContext,
  ErrorReport,
  ErrorAnalytics
} from '../../utils/error-reporting';