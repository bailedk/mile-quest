import React from 'react';

interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'white' | 'gray' | 'success' | 'warning' | 'error';
  className?: string;
  label?: string;
}

export function LoadingSpinner({ 
  size = 'md', 
  color = 'primary',
  className = '',
  label = 'Loading'
}: LoadingSpinnerProps) {
  const sizeClasses = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  };

  const colorClasses = {
    primary: 'text-blue-600',
    white: 'text-white',
    gray: 'text-gray-400',
    success: 'text-green-600',
    warning: 'text-yellow-600',
    error: 'text-red-600'
  };

  return (
    <svg
      className={`animate-spin ${sizeClasses[size]} ${colorClasses[color]} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-label={label}
      role="status"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

interface LoadingOverlayProps {
  message?: string;
  isVisible?: boolean;
  backdrop?: 'light' | 'dark' | 'blur';
  className?: string;
}

export function LoadingOverlay({ 
  message = 'Loading...', 
  isVisible = true,
  backdrop = 'dark',
  className = ''
}: LoadingOverlayProps) {
  if (!isVisible) return null;

  const backdropClasses = {
    light: 'bg-white bg-opacity-75',
    dark: 'bg-gray-900 bg-opacity-50',
    blur: 'bg-white bg-opacity-75 backdrop-blur-sm'
  };

  return (
    <div className={`fixed inset-0 ${backdropClasses[backdrop]} flex items-center justify-center z-50 ${className}`}>
      <div className="bg-white rounded-lg p-6 flex flex-col items-center space-y-4 shadow-lg">
        <LoadingSpinner size="lg" />
        <p className="text-gray-700 font-medium">{message}</p>
      </div>
    </div>
  );
}

interface LoadingSkeletonProps {
  className?: string;
  lines?: number;
  variant?: 'text' | 'circular' | 'rectangular';
  animation?: 'pulse' | 'wave';
  height?: string;
  width?: string;
}

export function LoadingSkeleton({ 
  className = '', 
  lines = 1,
  variant = 'text',
  animation = 'pulse',
  height,
  width
}: LoadingSkeletonProps) {
  const animationClass = animation === 'pulse' ? 'animate-pulse' : 'animate-shimmer';
  
  if (variant === 'circular') {
    return (
      <div 
        className={`${animationClass} bg-gray-200 rounded-full ${className}`}
        style={{ 
          width: width || '3rem', 
          height: height || '3rem' 
        }}
      />
    );
  }

  if (variant === 'rectangular') {
    return (
      <div 
        className={`${animationClass} bg-gray-200 rounded ${className}`}
        style={{ 
          width: width || '100%', 
          height: height || '1rem' 
        }}
      />
    );
  }

  // Text variant (default)
  return (
    <div className={`${animationClass} ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-4 bg-gray-200 rounded ${i < lines - 1 ? 'mb-2' : ''}`}
          style={{ width: `${Math.random() * 40 + 60}%` }}
        />
      ))}
    </div>
  );
}

// Card skeleton for consistent card layouts
interface CardSkeletonProps {
  className?: string;
  hasAvatar?: boolean;
  hasImage?: boolean;
  lines?: number;
}

export function CardSkeleton({ 
  className = '',
  hasAvatar = false,
  hasImage = false,
  lines = 3
}: CardSkeletonProps) {
  return (
    <div className={`p-4 bg-white rounded-lg border border-gray-200 animate-pulse ${className}`}>
      {hasImage && (
        <LoadingSkeleton 
          variant="rectangular" 
          height="12rem" 
          className="mb-4"
        />
      )}
      
      <div className="flex items-start space-x-3">
        {hasAvatar && (
          <LoadingSkeleton 
            variant="circular" 
            width="2.5rem" 
            height="2.5rem"
          />
        )}
        
        <div className="flex-1 space-y-2">
          <LoadingSkeleton 
            variant="rectangular" 
            height="1.25rem" 
            width="75%" 
          />
          <LoadingSkeleton 
            lines={lines}
            className="space-y-2"
          />
        </div>
      </div>
    </div>
  );
}

// List skeleton for consistent list layouts
interface ListSkeletonProps {
  items?: number;
  className?: string;
  hasAvatar?: boolean;
  hasActions?: boolean;
}

export function ListSkeleton({ 
  items = 3,
  className = '',
  hasAvatar = false,
  hasActions = false
}: ListSkeletonProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200 animate-pulse">
          {hasAvatar && (
            <LoadingSkeleton 
              variant="circular" 
              width="2.5rem" 
              height="2.5rem"
            />
          )}
          
          <div className="flex-1 space-y-2">
            <LoadingSkeleton 
              variant="rectangular" 
              height="1rem" 
              width="60%" 
            />
            <LoadingSkeleton 
              variant="rectangular" 
              height="0.875rem" 
              width="40%" 
            />
          </div>
          
          {hasActions && (
            <div className="flex space-x-2">
              <LoadingSkeleton 
                variant="rectangular" 
                width="5rem" 
                height="2rem" 
              />
              <LoadingSkeleton 
                variant="rectangular" 
                width="5rem" 
                height="2rem" 
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Loading state with message and optional retry
interface LoadingStateProps {
  message?: string;
  submessage?: string;
  showSpinner?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function LoadingState({
  message = 'Loading...',
  submessage,
  showSpinner = true,
  className = '',
  children
}: LoadingStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      {showSpinner && (
        <LoadingSpinner size="lg" className="mb-4" />
      )}
      
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        {message}
      </h3>
      
      {submessage && (
        <p className="text-gray-600 mb-4 max-w-md">
          {submessage}
        </p>
      )}
      
      {children}
    </div>
  );
}

// Inline loading for buttons and small components
interface InlineLoadingProps {
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  label?: string;
}

export function InlineLoading({ 
  size = 'sm', 
  className = '',
  label = 'Loading'
}: InlineLoadingProps) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      <LoadingSpinner size={size} className="mr-2" label={label} />
      <span className="sr-only">{label}</span>
    </span>
  );
}