'use client';

import React, { useState } from 'react';
import { retryWithBackoff } from '@/utils/error-handling';

// Enhanced Error Message Component
interface ErrorMessageProps {
  title?: string;
  message: string;
  variant?: 'error' | 'warning' | 'info' | 'success';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
}

export function ErrorMessage({
  title,
  message,
  variant = 'error',
  size = 'md',
  className = '',
  icon,
  actions,
  dismissible = false,
  onDismiss
}: ErrorMessageProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const variantStyles = {
    error: {
      container: 'bg-red-50 border-red-200 text-red-800',
      icon: icon || '❌',
      title: 'text-red-800',
      message: 'text-red-700',
      button: 'text-red-600 hover:text-red-700 focus:ring-red-500'
    },
    warning: {
      container: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      icon: icon || '⚠️',
      title: 'text-yellow-800',
      message: 'text-yellow-700',
      button: 'text-yellow-600 hover:text-yellow-700 focus:ring-yellow-500'
    },
    info: {
      container: 'bg-blue-50 border-blue-200 text-blue-800',
      icon: icon || 'ℹ️',
      title: 'text-blue-800',
      message: 'text-blue-700',
      button: 'text-blue-600 hover:text-blue-700 focus:ring-blue-500'
    },
    success: {
      container: 'bg-green-50 border-green-200 text-green-800',
      icon: icon || '✅',
      title: 'text-green-800',
      message: 'text-green-700',
      button: 'text-green-600 hover:text-green-700 focus:ring-green-500'
    }
  };

  const sizeStyles = {
    sm: 'p-3 text-sm',
    md: 'p-4 text-base',
    lg: 'p-6 text-lg'
  };

  const styles = variantStyles[variant];
  
  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  return (
    <div 
      className={`${styles.container} ${sizeStyles[size]} border rounded-lg ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <span className="text-xl" role="img" aria-label={variant}>
            {styles.icon}
          </span>
        </div>
        
        <div className="ml-3 flex-1 min-w-0">
          {title && (
            <h3 className={`font-medium ${styles.title} mb-1`}>
              {title}
            </h3>
          )}
          <div className={`${styles.message} ${title ? '' : 'font-medium'}`}>
            {message}
          </div>
          {actions && (
            <div className="mt-3">
              {actions}
            </div>
          )}
        </div>

        {dismissible && (
          <div className="ml-3 flex-shrink-0">
            <button
              type="button"
              onClick={handleDismiss}
              className={`inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${styles.button}`}
              aria-label="Dismiss"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Enhanced Retry Button Component
interface RetryButtonProps {
  onRetry: () => Promise<void> | void;
  disabled?: boolean;
  maxAttempts?: number;
  autoRetry?: boolean;
  retryDelay?: number;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children?: React.ReactNode;
}

export function RetryButton({
  onRetry,
  disabled = false,
  maxAttempts = 3,
  autoRetry = false,
  retryDelay = 1000,
  variant = 'primary',
  size = 'md',
  className = '',
  children = 'Try Again'
}: RetryButtonProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [countdown, setCountdown] = useState(0);

  const canRetry = attempts < maxAttempts && !disabled;

  const variantStyles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500',
    ghost: 'bg-transparent text-blue-600 hover:bg-blue-50 focus:ring-blue-500 border border-blue-600'
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  const handleRetry = async () => {
    if (!canRetry || isRetrying) return;

    setIsRetrying(true);
    setAttempts(prev => prev + 1);

    try {
      await onRetry();
      // Reset attempts on successful retry
      setAttempts(0);
    } catch (error) {
      // If auto-retry is enabled and we haven't reached max attempts
      if (autoRetry && attempts + 1 < maxAttempts) {
        let timeLeft = retryDelay / 1000;
        setCountdown(timeLeft);
        
        const timer = setInterval(() => {
          timeLeft -= 1;
          setCountdown(timeLeft);
          
          if (timeLeft <= 0) {
            clearInterval(timer);
            setCountdown(0);
            // Recursive retry
            setTimeout(() => handleRetry(), 100);
          }
        }, 1000);
      }
    } finally {
      setIsRetrying(false);
    }
  };

  if (!canRetry && attempts >= maxAttempts) {
    return (
      <div className="text-center">
        <p className="text-sm text-gray-600 mb-2">
          Maximum retry attempts reached
        </p>
        <button
          onClick={() => window.location.reload()}
          className={`${variantStyles.secondary} ${sizeStyles[size]} rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors`}
        >
          Reload Page
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleRetry}
      disabled={!canRetry || isRetrying}
      className={`
        ${variantStyles[variant]} 
        ${sizeStyles[size]} 
        ${className}
        rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        inline-flex items-center justify-center
      `}
    >
      {isRetrying ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Retrying...
        </>
      ) : countdown > 0 ? (
        `Retrying in ${countdown}s`
      ) : (
        <>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {children}
          {attempts > 0 && ` (${attempts}/${maxAttempts})`}
        </>
      )}
    </button>
  );
}

// Error State Component for lists/grids
interface ErrorStateProps {
  title?: string;
  message: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  icon,
  action,
  className = ''
}: ErrorStateProps) {
  return (
    <div className={`text-center py-12 px-4 ${className}`}>
      <div className="max-w-md mx-auto">
        <div className="text-6xl mb-4">
          {icon || '⚠️'}
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {title}
        </h3>
        <p className="text-gray-600 mb-6 leading-relaxed">
          {message}
        </p>
        {action && (
          <button
            onClick={action.onClick}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}

// Network Error Component with automatic retry
interface NetworkErrorProps {
  onRetry: () => Promise<void>;
  className?: string;
}

export function NetworkError({ onRetry, className = '' }: NetworkErrorProps) {
  return (
    <ErrorMessage
      variant="error"
      title="Connection Error"
      message="Unable to connect to the server. Please check your internet connection."
      icon="🌐"
      className={className}
      actions={
        <RetryButton
          onRetry={onRetry}
          autoRetry={true}
          maxAttempts={3}
          retryDelay={2000}
          variant="primary"
          size="sm"
        />
      }
    />
  );
}

// Loading Error Component for async operations
interface LoadingErrorProps {
  resource: string;
  onRetry: () => Promise<void>;
  className?: string;
}

export function LoadingError({ resource, onRetry, className = '' }: LoadingErrorProps) {
  return (
    <ErrorMessage
      variant="warning"
      title={`Failed to load ${resource}`}
      message={`There was a problem loading ${resource}. This might be a temporary issue.`}
      icon="📄"
      className={className}
      actions={
        <RetryButton
          onRetry={onRetry}
          variant="secondary"
          size="sm"
        />
      }
    />
  );
}