'use client';

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { logError, getErrorMessage } from '@/utils/error-handling';
import { ErrorMessage, RetryButton, ErrorState } from './ErrorComponents';

// =============================================================================
// ROUTE-LEVEL ERROR BOUNDARY
// =============================================================================

interface RouteErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  routeName?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  private maxRetries = 2;

  constructor(props: RouteErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<RouteErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logError(error, {
      context: `RouteErrorBoundary-${this.props.routeName || 'unknown'}`,
      level: 'page',
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount,
      routeName: this.props.routeName
    });

    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState({
        hasError: false,
        error: null,
        retryCount: this.state.retryCount + 1
      });
    } else {
      // Force page reload after max retries
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const canRetry = this.state.retryCount < this.maxRetries;
      const routeName = this.props.routeName || 'page';

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-2xl w-full">
            <ErrorState
              title={`${routeName.charAt(0).toUpperCase() + routeName.slice(1)} Error`}
              message={`There was a problem loading this ${routeName}. ${canRetry ? 'You can try reloading the page or wait a moment and try again.' : 'Please refresh your browser to continue.'}`}
              icon="🔄"
              action={{
                label: canRetry ? 'Reload Page' : 'Refresh Browser',
                onClick: this.handleRetry
              }}
            />
            
            {this.state.retryCount > 0 && (
              <div className="mt-4 text-center text-sm text-gray-600">
                Retry attempt {this.state.retryCount} of {this.maxRetries}
              </div>
            )}

            {process.env.NODE_ENV === 'development' && (
              <details className="mt-8">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 mb-2">
                  Developer Information
                </summary>
                <div className="bg-gray-100 rounded-lg p-4 text-xs font-mono">
                  <div className="mb-2">
                    <strong>Error:</strong> {this.state.error.name}
                  </div>
                  <div className="mb-2">
                    <strong>Message:</strong> {this.state.error.message}
                  </div>
                  <div className="mb-2">
                    <strong>Route:</strong> {this.props.routeName || 'unknown'}
                  </div>
                  {this.state.error.stack && (
                    <div>
                      <strong>Stack:</strong>
                      <pre className="mt-1 whitespace-pre-wrap break-all max-h-32 overflow-auto">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// =============================================================================
// COMPONENT-LEVEL ERROR BOUNDARY
// =============================================================================

interface ComponentErrorBoundaryProps {
  children: ReactNode;
  componentName?: string;
  fallback?: ReactNode;
  isolate?: boolean; // If true, don't propagate errors upward
  showMinimalUI?: boolean; // Show compact error UI
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ComponentErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

export class ComponentErrorBoundary extends Component<ComponentErrorBoundaryProps, ComponentErrorBoundaryState> {
  private maxRetries = 3;

  constructor(props: ComponentErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ComponentErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logError(error, {
      context: `ComponentErrorBoundary-${this.props.componentName || 'unknown'}`,
      level: 'component',
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount,
      componentName: this.props.componentName,
      isolated: this.props.isolate
    });

    this.props.onError?.(error, errorInfo);

    // If not isolated, propagate error upward after logging
    if (!this.props.isolate) {
      throw error;
    }
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const canRetry = this.state.retryCount < this.maxRetries;
      const componentName = this.props.componentName || 'component';

      if (this.props.showMinimalUI) {
        return (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-center">
            <div className="text-red-600 text-sm mb-2">
              {componentName} temporarily unavailable
            </div>
            {canRetry && (
              <button
                onClick={this.handleRetry}
                className="text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        );
      }

      return (
        <ErrorMessage
          variant="error"
          title={`${componentName} Error`}
          message={getErrorMessage(this.state.error)}
          actions={
            canRetry ? (
              <RetryButton
                onRetry={this.handleRetry}
                size="sm"
                variant="primary"
                maxAttempts={this.maxRetries}
              >
                Retry {componentName}
              </RetryButton>
            ) : undefined
          }
        />
      );
    }

    return this.props.children;
  }
}

// =============================================================================
// ASYNC OPERATION ERROR BOUNDARY
// =============================================================================

interface AsyncErrorBoundaryProps {
  children: ReactNode;
  operationName?: string;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  retryable?: boolean;
  autoRetry?: boolean;
  retryDelay?: number;
}

interface AsyncErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
  isRetrying: boolean;
}

export class AsyncErrorBoundary extends Component<AsyncErrorBoundaryProps, AsyncErrorBoundaryState> {
  private maxRetries = 5;
  private retryTimeout: NodeJS.Timeout | null = null;

  constructor(props: AsyncErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      retryCount: 0,
      isRetrying: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<AsyncErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logError(error, {
      context: `AsyncErrorBoundary-${this.props.operationName || 'unknown'}`,
      level: 'component',
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount,
      operationName: this.props.operationName,
      autoRetry: this.props.autoRetry
    });

    this.props.onError?.(error, errorInfo);

    // Auto-retry for certain types of errors
    if (this.props.autoRetry && this.isRetryableError(error) && this.state.retryCount < this.maxRetries) {
      this.scheduleRetry();
    }
  }

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  isRetryableError = (error: Error): boolean => {
    // Network errors, timeout errors, etc. are typically retryable
    return (
      error.name === 'NetworkError' ||
      error.name === 'TimeoutError' ||
      error.message.includes('fetch') ||
      error.message.includes('network') ||
      error.message.includes('timeout')
    );
  };

  scheduleRetry = () => {
    const delay = this.props.retryDelay || Math.min(1000 * Math.pow(2, this.state.retryCount), 10000);
    
    this.setState({ isRetrying: true });
    
    this.retryTimeout = setTimeout(() => {
      this.handleRetry();
    }, delay);
  };

  handleRetry = () => {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }

    this.setState(prevState => ({
      hasError: false,
      error: null,
      retryCount: prevState.retryCount + 1,
      isRetrying: false
    }));
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const canRetry = this.props.retryable !== false && this.state.retryCount < this.maxRetries;
      const operationName = this.props.operationName || 'operation';

      if (this.state.isRetrying) {
        return (
          <div className="flex items-center justify-center p-4">
            <div className="flex items-center space-x-2 text-blue-600">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm">Retrying {operationName}...</span>
            </div>
          </div>
        );
      }

      return (
        <ErrorMessage
          variant="warning"
          title={`${operationName} Failed`}
          message={`There was a problem with the ${operationName}. ${canRetry ? 'We can try again.' : 'Please refresh the page to retry.'}`}
          actions={
            canRetry ? (
              <RetryButton
                onRetry={this.handleRetry}
                size="sm"
                variant="secondary"
                maxAttempts={this.maxRetries}
                autoRetry={this.props.autoRetry}
                retryDelay={this.props.retryDelay}
              >
                Retry {operationName}
              </RetryButton>
            ) : (
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
              >
                Refresh Page
              </button>
            )
          }
        />
      );
    }

    return this.props.children;
  }
}

// =============================================================================
// DASHBOARD ERROR BOUNDARY (Specialized for dashboard components)
// =============================================================================

interface DashboardErrorBoundaryProps {
  children: ReactNode;
  sectionName?: string;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface DashboardErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

export class DashboardErrorBoundary extends Component<DashboardErrorBoundaryProps, DashboardErrorBoundaryState> {
  private maxRetries = 3;

  constructor(props: DashboardErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<DashboardErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logError(error, {
      context: `DashboardErrorBoundary-${this.props.sectionName || 'section'}`,
      level: 'section',
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount,
      sectionName: this.props.sectionName,
      dashboardSection: true
    });

    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const canRetry = this.state.retryCount < this.maxRetries;
      const sectionName = this.props.sectionName || 'dashboard section';

      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className="text-2xl" role="img" aria-label="Error">
                📊
              </span>
            </div>
            
            <div className="ml-3 flex-1">
              <h3 className="text-lg font-medium text-red-800 mb-2">
                {sectionName.charAt(0).toUpperCase() + sectionName.slice(1)} Unavailable
              </h3>
              
              <p className="text-red-700 mb-4">
                We're having trouble loading your {sectionName} data. This could be a temporary connection issue.
              </p>

              <div className="flex flex-wrap gap-3">
                {canRetry ? (
                  <button
                    onClick={this.handleRetry}
                    className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reload {sectionName}
                  </button>
                ) : (
                  <button
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh Dashboard
                  </button>
                )}
                
                <button
                  onClick={() => window.history.back()}
                  className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                >
                  Go Back
                </button>
              </div>

              {this.state.retryCount > 0 && (
                <p className="mt-3 text-sm text-red-600">
                  Retry attempt {this.state.retryCount} of {this.maxRetries}
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// =============================================================================
// HOC WRAPPERS
// =============================================================================

// HOC for route-level error boundaries
export function withRouteErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  routeName?: string,
  fallback?: ReactNode
) {
  const WithRouteErrorBoundary = (props: P) => (
    <RouteErrorBoundary routeName={routeName} fallback={fallback}>
      <WrappedComponent {...props} />
    </RouteErrorBoundary>
  );

  WithRouteErrorBoundary.displayName = `withRouteErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithRouteErrorBoundary;
}

// HOC for component-level error boundaries
export function withComponentErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string,
  options?: { isolate?: boolean; showMinimalUI?: boolean; fallback?: ReactNode }
) {
  const WithComponentErrorBoundary = (props: P) => (
    <ComponentErrorBoundary 
      componentName={componentName} 
      isolate={options?.isolate}
      showMinimalUI={options?.showMinimalUI}
      fallback={options?.fallback}
    >
      <WrappedComponent {...props} />
    </ComponentErrorBoundary>
  );

  WithComponentErrorBoundary.displayName = `withComponentErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithComponentErrorBoundary;
}

// HOC for async operation error boundaries
export function withAsyncErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  operationName?: string,
  options?: { autoRetry?: boolean; retryDelay?: number; fallback?: ReactNode }
) {
  const WithAsyncErrorBoundary = (props: P) => (
    <AsyncErrorBoundary 
      operationName={operationName}
      autoRetry={options?.autoRetry}
      retryDelay={options?.retryDelay}
      fallback={options?.fallback}
    >
      <WrappedComponent {...props} />
    </AsyncErrorBoundary>
  );

  WithAsyncErrorBoundary.displayName = `withAsyncErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithAsyncErrorBoundary;
}

// HOC for dashboard section error boundaries
export function withDashboardErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  sectionName?: string,
  fallback?: ReactNode
) {
  const WithDashboardErrorBoundary = (props: P) => (
    <DashboardErrorBoundary sectionName={sectionName} fallback={fallback}>
      <WrappedComponent {...props} />
    </DashboardErrorBoundary>
  );

  WithDashboardErrorBoundary.displayName = `withDashboardErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithDashboardErrorBoundary;
}