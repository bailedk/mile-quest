'use client';

import React, { Component, ReactNode } from 'react';
import { logError, getErrorMessage } from '@/utils/error-handling';
import { reloadPage } from '@/utils/ssr-safe';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  context?: string;
  level?: 'component' | 'section' | 'page';
  enableRetry?: boolean;
  showErrorDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  retryCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0 
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error with context
    logError(error, {
      context: this.props.context || 'ErrorBoundary',
      level: this.props.level || 'component',
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
      retryCount: this.state.retryCount,
    });
    
    this.setState({ errorInfo });
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1
      }));
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, retryCount } = this.state;
      const { enableRetry = true, showErrorDetails = false, level = 'component' } = this.props;
      const canRetry = enableRetry && retryCount < this.maxRetries;
      const userMessage = error ? getErrorMessage(error) : 'An unexpected error occurred';

      // Different layouts based on error level
      const getErrorLayout = () => {
        switch (level) {
          case 'page':
            return 'p-8 bg-red-50 border border-red-200 rounded-lg max-w-2xl mx-auto mt-8';
          case 'section':
            return 'p-6 bg-red-50 border border-red-200 rounded-lg';
          default:
            return 'p-4 bg-red-50 border border-red-200 rounded';
        }
      };

      const getErrorIcon = () => {
        switch (level) {
          case 'page':
            return '🚫';
          case 'section':
            return '⚠️';
          default:
            return '❌';
        }
      };

      return (
        <div className={getErrorLayout()} role="alert">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <span className="text-2xl" role="img" aria-label="Error">
                {getErrorIcon()}
              </span>
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-red-800 mb-2">
                {level === 'page' ? 'Page Error' : 'Something went wrong'}
              </h3>
              
              <p className="text-red-700 mb-4 leading-relaxed">
                {userMessage}
              </p>

              {retryCount > 0 && (
                <p className="text-sm text-red-600 mb-4">
                  Retry attempt {retryCount} of {this.maxRetries}
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                {canRetry && (
                  <button
                    onClick={this.handleRetry}
                    className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Try Again
                  </button>
                )}

                {!canRetry && retryCount >= this.maxRetries && (
                  <button
                    onClick={() => reloadPage()}
                    className="inline-flex items-center px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reload Page
                  </button>
                )}
              </div>

              {(showErrorDetails || process.env.NODE_ENV === 'development') && error && (
                <details className="mt-6">
                  <summary className="cursor-pointer text-sm text-red-600 hover:text-red-700 font-medium">
                    Technical Details
                  </summary>
                  <div className="mt-3 p-3 bg-red-100 rounded text-xs font-mono">
                    <div className="mb-2">
                      <strong>Error:</strong> {error.name}
                    </div>
                    <div className="mb-2">
                      <strong>Message:</strong> {error.message}
                    </div>
                    <div className="mb-2">
                      <strong>Context:</strong> {this.props.context || 'Unknown'}
                    </div>
                    {error.stack && (
                      <div className="mb-2">
                        <strong>Stack Trace:</strong>
                        <pre className="mt-1 whitespace-pre-wrap break-all max-h-32 overflow-auto">
                          {error.stack}
                        </pre>
                      </div>
                    )}
                    {errorInfo?.componentStack && (
                      <div>
                        <strong>Component Stack:</strong>
                        <pre className="mt-1 whitespace-pre-wrap break-all max-h-32 overflow-auto">
                          {errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WithErrorBoundaryComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundaryComponent.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithErrorBoundaryComponent;
}