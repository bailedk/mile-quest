# Error Boundary and Fallback System

A comprehensive error handling system for Mile Quest that provides graceful error recovery, beautiful fallback UI, and comprehensive error reporting.

## 🎯 Features

- **Multiple Error Boundary Types**: Route-level, component-level, async operation, and dashboard-specific boundaries
- **Beautiful Fallback UI**: Mobile-optimized error pages with accessibility support
- **Error Recovery Mechanisms**: Auto-retry, manual retry, graceful degradation, and cached fallbacks
- **Comprehensive Analytics**: Error categorization, fingerprinting, and analytics dashboard
- **Mobile-First Design**: Touch-friendly interactions with haptic feedback
- **Accessibility Support**: ARIA labels, keyboard navigation, and screen reader compatibility
- **Progressive Enhancement**: Network-aware behaviors and feature degradation

## 📚 Component Categories

### Error Boundaries

#### `RouteErrorBoundary`
Catches errors at the page/route level with automatic retry and recovery.

```tsx
import { RouteErrorBoundary } from '@/components/error';

<RouteErrorBoundary routeName="dashboard">
  <DashboardPage />
</RouteErrorBoundary>
```

#### `ComponentErrorBoundary`
Isolates component-level errors to prevent cascade failures.

```tsx
import { ComponentErrorBoundary } from '@/components/error';

<ComponentErrorBoundary 
  componentName="ActivityFeed" 
  isolate={true}
  showMinimalUI={true}
>
  <ActivityFeed />
</ComponentErrorBoundary>
```

#### `AsyncErrorBoundary`
Handles async operation errors with automatic retry logic.

```tsx
import { AsyncErrorBoundary } from '@/components/error';

<AsyncErrorBoundary 
  operationName="data loading"
  autoRetry={true}
  retryDelay={2000}
>
  <DataLoader />
</AsyncErrorBoundary>
```

#### `DashboardErrorBoundary`
Specialized for dashboard sections with contextual error messages.

```tsx
import { DashboardErrorBoundary } from '@/components/error';

<DashboardErrorBoundary sectionName="team progress">
  <TeamProgressChart />
</DashboardErrorBoundary>
```

### Error Pages

#### HTTP Error Pages
```tsx
import { 
  NotFoundError, 
  ForbiddenError, 
  ServerError, 
  NetworkErrorPage 
} from '@/components/error';

// Use in your error routes
<NotFoundError />
<ForbiddenError />
<ServerError />
<NetworkErrorPage onRetry={handleRetry} />
```

#### Specialized Error Pages
```tsx
import { 
  OfflineError, 
  MaintenanceError, 
  LoadingErrorFallback 
} from '@/components/error';

<OfflineError />
<MaintenanceError />
<LoadingErrorFallback 
  error={error} 
  onRetry={handleRetry} 
  resourceName="dashboard data"
  skeletonType="chart"
/>
```

### Mobile Error States

#### `MobileErrorState`
General-purpose mobile-optimized error component.

```tsx
import { MobileErrorState } from '@/components/error';

<MobileErrorState
  title="Upload Failed"
  message="Your activity couldn't be uploaded. Please try again."
  icon="📤"
  action={{
    label: 'Retry Upload',
    onClick: handleRetry,
    variant: 'primary'
  }}
  hapticFeedback={true}
  compact={false}
/>
```

#### Specialized Mobile Components
```tsx
import { 
  MobileNetworkError,
  MobileLoadingError,
  MobilePermissionError,
  MobileFormError
} from '@/components/error';

<MobileNetworkError onRetry={handleRetry} showConnectionStatus={true} />
<MobileLoadingError resource="activities" onRetry={handleRetry} />
<MobilePermissionError permission="location access" onRetry={handleRetry} />
<MobileFormError errors={validationErrors} onDismiss={clearErrors} />
```

### Error Recovery Components

#### `GracefulFeature`
Provides graceful degradation for non-critical features.

```tsx
import { GracefulFeature } from '@/components/error';

<GracefulFeature
  featureName="real-time updates"
  timeout={5000}
  fallback={<StaticDashboard />}
  onError={logError}
  onFallback={() => console.log('Using fallback')}
>
  <RealtimeDashboard />
</GracefulFeature>
```

#### `AutoRetry`
Provides automatic retry logic with exponential backoff.

```tsx
import { AutoRetry } from '@/components/error';

<AutoRetry
  onRetry={fetchData}
  maxRetries={3}
  exponentialBackoff={true}
  autoRetryOnError={true}
>
  {(retry, isRetrying, retryCount) => (
    <div>
      {isRetrying ? 'Retrying...' : 'Loaded'}
      <button onClick={retry}>Manual Retry ({retryCount}/3)</button>
    </div>
  )}
</AutoRetry>
```

#### `NetworkAware`
Provides network-aware behaviors with connection status.

```tsx
import { NetworkAware } from '@/components/error';

<NetworkAware
  fallback={<OfflineDashboard />}
  showConnectionStatus={true}
  onOnline={() => refetchData()}
  onOffline={() => showOfflineMessage()}
>
  <OnlineDashboard />
</NetworkAware>
```

#### `CachedFallback`
Provides cached data as fallback when fresh data fails to load.

```tsx
import { CachedFallback } from '@/components/error';

<CachedFallback
  fetchData={fetchDashboardData}
  cacheKey="dashboard-data"
  cacheDuration={300000} // 5 minutes
  enableStaleWhileRevalidate={true}
  fallback={<DashboardSkeleton />}
  onError={handleError}
>
  {(data) => <Dashboard data={data} />}
</CachedFallback>
```

### Accessible Error Components

#### `AccessibleError`
Fully accessible error component with ARIA support.

```tsx
import { AccessibleError } from '@/components/error';

<AccessibleError
  title="Validation Error"
  message="Please check the required fields and try again."
  errorCode="FORM_001"
  suggestion="Make sure all required fields are filled out correctly."
  actions={[
    {
      label: 'Fix Errors',
      onClick: focusFirstError,
      primary: true,
      ariaLabel: 'Focus first error field'
    },
    {
      label: 'Cancel',
      onClick: cancelForm,
      ariaLabel: 'Cancel form submission'
    }
  ]}
  onDismiss={dismissError}
  autoFocus={true}
  live="assertive"
/>
```

#### `AccessibleErrorList`
Displays multiple errors in an accessible list format.

```tsx
import { AccessibleErrorList } from '@/components/error';

<AccessibleErrorList
  errors={[
    { id: '1', field: 'email', message: 'Email is required', severity: 'error' },
    { id: '2', field: 'password', message: 'Password is too short', severity: 'error' },
    { id: '3', field: 'team', message: 'Team name may be taken', severity: 'warning' }
  ]}
  title="Please fix the following issues:"
  onErrorClick={(errorId) => focusField(errorId)}
  onDismiss={clearAllErrors}
/>
```

## 🔧 Error Reporting and Analytics

### Basic Error Reporting
```tsx
import { reportError, getErrorReports, generateErrorAnalytics } from '@/components/error';

// Report an error
const fingerprint = reportError(error, {
  page: 'dashboard',
  component: 'TeamProgress',
  action: 'data-fetch',
  customData: { teamId: 'abc123' }
});

// Get error reports
const recentErrors = getErrorReports({
  category: 'network',
  severity: 'high',
  since: Date.now() - 86400000 // Last 24 hours
});

// Generate analytics
const analytics = generateErrorAnalytics(86400000); // Last 24 hours
console.log(`Error rate: ${analytics.errorRate} errors/hour`);
console.log(`Top errors:`, analytics.topErrors);
```

### Error Context Collection
```tsx
import { collectErrorContext, categorizeError } from '@/components/error';

// Collect comprehensive error context
const context = collectErrorContext({
  teamId: 'abc123',
  activityId: 'xyz789',
  userAction: 'submit-activity'
});

// Categorize errors
const { category, severity } = categorizeError(error);
console.log(`Error category: ${category}, severity: ${severity}`);
```

## 🎨 HOC Wrappers

Convenient Higher-Order Components for wrapping existing components:

```tsx
import { 
  withRouteErrorBoundary,
  withComponentErrorBoundary,
  withAsyncErrorBoundary,
  withDashboardErrorBoundary
} from '@/components/error';

// Wrap a page component
const SafeDashboardPage = withRouteErrorBoundary(DashboardPage, 'dashboard');

// Wrap a component with isolation
const SafeActivityFeed = withComponentErrorBoundary(ActivityFeed, 'ActivityFeed', {
  isolate: true,
  showMinimalUI: true
});

// Wrap an async component
const SafeDataLoader = withAsyncErrorBoundary(DataLoader, 'data loading', {
  autoRetry: true,
  retryDelay: 2000
});

// Wrap a dashboard section
const SafeTeamProgress = withDashboardErrorBoundary(TeamProgress, 'team progress');
```

## 🏗️ Implementation Patterns

### 1. Page-Level Error Handling
```tsx
// app/dashboard/page.tsx
import { RouteErrorBoundary } from '@/components/error';

export default function DashboardPage() {
  return (
    <RouteErrorBoundary routeName="dashboard">
      <DashboardContent />
    </RouteErrorBoundary>
  );
}
```

### 2. Component-Level Error Isolation
```tsx
// components/ActivityFeed.tsx
import { ComponentErrorBoundary } from '@/components/error';

export function ActivityFeed() {
  return (
    <ComponentErrorBoundary 
      componentName="ActivityFeed"
      isolate={true} // Don't propagate errors up
    >
      <ActivityList />
    </ComponentErrorBoundary>
  );
}
```

### 3. Form Validation Errors
```tsx
// components/CreateActivityForm.tsx
import { MobileFormError, AccessibleInlineError } from '@/components/error';

export function CreateActivityForm() {
  const [errors, setErrors] = useState([]);
  
  return (
    <form>
      {errors.length > 0 && (
        <MobileFormError 
          errors={errors.map(e => e.message)} 
          onDismiss={() => setErrors([])} 
        />
      )}
      
      <input 
        id="distance"
        aria-describedby={distanceError ? 'distance-error' : undefined}
        aria-invalid={!!distanceError}
      />
      {distanceError && (
        <AccessibleInlineError 
          message={distanceError}
          fieldId="distance"
          errorId="distance-error"
        />
      )}
    </form>
  );
}
```

### 4. Dashboard Error Boundaries
```tsx
// components/Dashboard.tsx
import { DashboardErrorBoundary } from '@/components/error';

export function Dashboard() {
  return (
    <div className="dashboard-grid">
      <DashboardErrorBoundary sectionName="team progress">
        <TeamProgressSection />
      </DashboardErrorBoundary>
      
      <DashboardErrorBoundary sectionName="activity feed">
        <ActivityFeedSection />
      </DashboardErrorBoundary>
      
      <DashboardErrorBoundary sectionName="leaderboard">
        <LeaderboardSection />
      </DashboardErrorBoundary>
    </div>
  );
}
```

### 5. Network-Aware Components
```tsx
// components/RealtimeFeatures.tsx
import { NetworkAware, GracefulFeature } from '@/components/error';

export function RealtimeFeatures() {
  return (
    <NetworkAware
      fallback={<StaticDashboard />}
      showConnectionStatus={true}
    >
      <GracefulFeature
        featureName="real-time updates"
        timeout={10000}
        fallback={<PollingDashboard />}
      >
        <RealtimeDashboard />
      </GracefulFeature>
    </NetworkAware>
  );
}
```

## 📱 Mobile Optimization

All components are optimized for mobile:

- **Touch Targets**: Minimum 44px touch targets
- **Haptic Feedback**: Vibration patterns for errors and success
- **Responsive Design**: Mobile-first responsive layouts
- **Connection Awareness**: Adapts to network conditions
- **Offline Support**: Graceful degradation when offline

## ♿ Accessibility Features

- **ARIA Support**: Proper roles, labels, and live regions
- **Keyboard Navigation**: Full keyboard support
- **Screen Reader**: Compatible with screen readers
- **Focus Management**: Automatic focus handling
- **High Contrast**: Supports high contrast mode
- **Reduced Motion**: Respects prefers-reduced-motion

## 🔧 Configuration

### Environment Variables
```env
# Error reporting endpoint (optional)
NEXT_PUBLIC_ERROR_REPORTING_ENDPOINT=https://api.example.com/errors

# Enable error reporting in development (optional)
NEXT_PUBLIC_ENABLE_ERROR_REPORTING_DEV=true
```

### Global Setup
```tsx
// app/layout.tsx
import { errorReporting } from '@/components/error';

// Configure error reporting
if (process.env.NODE_ENV === 'production') {
  errorReporting.setEnabled(true);
  if (process.env.NEXT_PUBLIC_ERROR_REPORTING_ENDPOINT) {
    errorReporting.setReportingEndpoint(
      process.env.NEXT_PUBLIC_ERROR_REPORTING_ENDPOINT
    );
  }
}
```

## 🚀 Best Practices

1. **Use Route-Level Boundaries**: Wrap each page with `RouteErrorBoundary`
2. **Isolate Critical Components**: Use `ComponentErrorBoundary` with `isolate={true}` for non-critical features
3. **Provide Contextual Messages**: Use specific error messages for different contexts
4. **Enable Auto-Retry**: Use `AsyncErrorBoundary` with `autoRetry` for network operations
5. **Report All Errors**: Use `reportError()` for comprehensive error tracking
6. **Test Error States**: Regularly test error scenarios and recovery paths
7. **Monitor Analytics**: Use `generateErrorAnalytics()` to track error trends
8. **Accessibility First**: Always test with keyboard navigation and screen readers

## 🧪 Testing Error Boundaries

```tsx
// Test utilities
import { render, screen, fireEvent } from '@testing-library/react';
import { ComponentErrorBoundary } from '@/components/error';

// Create a component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

test('error boundary catches and displays error', () => {
  render(
    <ComponentErrorBoundary componentName="TestComponent">
      <ThrowError shouldThrow={true} />
    </ComponentErrorBoundary>
  );
  
  expect(screen.getByText(/TestComponent Error/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
});
```

## 📈 Monitoring and Analytics

The error system provides comprehensive monitoring:

```tsx
import { generateErrorAnalytics, getErrorReports } from '@/components/error';

// Get error analytics for the last 24 hours
const analytics = generateErrorAnalytics(86400000);

console.log('Error Analytics:', {
  totalErrors: analytics.totalErrors,
  errorRate: analytics.errorRate,
  topErrors: analytics.topErrors.slice(0, 5),
  networkErrors: analytics.errorsByCategory.network,
  criticalErrors: analytics.errorsBySeverity.critical
});

// Get detailed error reports
const criticalErrors = getErrorReports({
  severity: 'critical',
  resolved: false,
  since: Date.now() - 3600000 // Last hour
});
```

This comprehensive error boundary system ensures that Mile Quest provides a robust, user-friendly experience even when things go wrong.