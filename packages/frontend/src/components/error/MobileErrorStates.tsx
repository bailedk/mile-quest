'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// =============================================================================
// MOBILE-OPTIMIZED ERROR STATES
// =============================================================================

interface MobileErrorStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'ghost';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  showBackButton?: boolean;
  compact?: boolean;
  hapticFeedback?: boolean;
  className?: string;
}

export function MobileErrorState({
  title = 'Something went wrong',
  message = 'We encountered an unexpected error.',
  icon,
  action,
  secondaryAction,
  showBackButton = true,
  compact = false,
  hapticFeedback = true,
  className = ''
}: MobileErrorStateProps) {
  const router = useRouter();

  // Trigger haptic feedback on mount if supported
  useEffect(() => {
    if (hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]); // Error pattern
    }
  }, [hapticFeedback]);

  const handleActionClick = (callback: () => void) => {
    // Haptic feedback for button press
    if (hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(50); // Short tap feedback
    }
    callback();
  };

  if (compact) {
    return (
      <div className={`p-4 bg-red-50 border border-red-200 rounded-lg text-center ${className}`}>
        <div className="flex items-center justify-center space-x-3">
          <div className="text-2xl" role="img" aria-label="Error">
            {icon || '⚠️'}
          </div>
          <div className="flex-1 text-left">
            <h3 className="text-sm font-medium text-red-800">{title}</h3>
            <p className="text-xs text-red-600 mt-1">{message}</p>
          </div>
          {action && (
            <button
              onClick={() => handleActionClick(action.onClick)}
              className="flex-shrink-0 bg-red-600 text-white text-xs px-3 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors min-h-[44px] min-w-[44px]"
              aria-label={action.label}
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center p-6 text-center ${className}`}>
      <div className="text-6xl mb-4" role="img" aria-label="Error">
        {icon || '😔'}
      </div>
      
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        {title}
      </h2>
      
      <p className="text-gray-600 mb-6 leading-relaxed max-w-sm">
        {message}
      </p>

      <div className="w-full max-w-sm space-y-3">
        {action && (
          <button
            onClick={() => handleActionClick(action.onClick)}
            className={`
              w-full py-3 px-4 rounded-lg font-medium text-base transition-colors
              min-h-[44px] focus:outline-none focus:ring-4 focus:ring-offset-2
              ${
                action.variant === 'secondary'
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-200'
                  : action.variant === 'ghost'
                  ? 'bg-transparent text-blue-600 hover:bg-blue-50 focus:ring-blue-200 border border-blue-600'
                  : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-200'
              }
            `}
          >
            {action.label}
          </button>
        )}
        
        {secondaryAction && (
          <button
            onClick={() => handleActionClick(secondaryAction.onClick)}
            className="w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium text-base hover:bg-gray-200 focus:outline-none focus:ring-4 focus:ring-gray-200 focus:ring-offset-2 transition-colors min-h-[44px]"
          >
            {secondaryAction.label}
          </button>
        )}
        
        {showBackButton && (
          <button
            onClick={() => handleActionClick(() => router.back())}
            className="w-full py-3 px-4 bg-transparent text-gray-600 rounded-lg font-medium text-base hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-200 focus:ring-offset-2 transition-colors min-h-[44px] border border-gray-300"
          >
            Go Back
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MOBILE NETWORK ERROR STATE
// =============================================================================

interface MobileNetworkErrorProps {
  onRetry?: () => void;
  compact?: boolean;
  showConnectionStatus?: boolean;
}

export function MobileNetworkError({ 
  onRetry, 
  compact = false,
  showConnectionStatus = true 
}: MobileNetworkErrorProps) {
  const [connectionType, setConnectionType] = useState<string>('unknown');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const updateConnection = () => {
      setIsOnline(navigator.onLine);
      const connection = (navigator as any)?.connection;
      if (connection) {
        setConnectionType(connection.effectiveType || 'unknown');
      }
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    const connection = (navigator as any)?.connection;
    if (connection) {
      connection.addEventListener('change', updateConnection);
    }
    
    updateConnection();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', updateConnection);
      }
    };
  }, []);

  const getConnectionIcon = () => {
    if (!isOnline) return '📵';
    switch (connectionType) {
      case 'slow-2g':
      case '2g':
        return '📶';
      case '3g':
        return '📶📶';
      case '4g':
        return '📶📶📶';
      default:
        return '🌐';
    }
  };

  const getConnectionMessage = () => {
    if (!isOnline) {
      return 'You appear to be offline. Please check your internet connection.';
    }
    if (connectionType === 'slow-2g' || connectionType === '2g') {
      return 'Your connection appears to be slow. This might affect loading times.';
    }
    return 'We\'re having trouble connecting to our servers. Please try again.';
  };

  return (
    <MobileErrorState
      title={isOnline ? 'Connection Problem' : 'You\'re Offline'}
      message={getConnectionMessage()}
      icon={getConnectionIcon()}
      action={onRetry ? {
        label: 'Try Again',
        onClick: onRetry,
        variant: 'primary'
      } : undefined}
      secondaryAction={{
        label: 'Refresh Page',
        onClick: () => window.location.reload()
      }}
      compact={compact}
      hapticFeedback={true}
    >
      {showConnectionStatus && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-blue-800">Connection Status:</span>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-green-500' : 'bg-red-500 animate-pulse'
              }`} />
              <span className="text-blue-700">
                {isOnline ? `Online (${connectionType})` : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      )}
    </MobileErrorState>
  );
}

// =============================================================================
// MOBILE LOADING ERROR STATE
// =============================================================================

interface MobileLoadingErrorProps {
  resource?: string;
  onRetry?: () => void;
  compact?: boolean;
  showSkeletonBackground?: boolean;
}

export function MobileLoadingError({ 
  resource = 'content',
  onRetry,
  compact = false,
  showSkeletonBackground = true
}: MobileLoadingErrorProps) {
  return (
    <div className="relative">
      {showSkeletonBackground && (
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="space-y-3 p-4">
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-5/6" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-4/6" />
          </div>
        </div>
      )}
      
      <div className="relative z-10 bg-white/95 backdrop-blur-sm">
        <MobileErrorState
          title={`Failed to load ${resource}`}
          message={`There was a problem loading ${resource}. This might be a temporary issue.`}
          icon="📄"
          action={onRetry ? {
            label: `Retry ${resource}`,
            onClick: onRetry,
            variant: 'primary'
          } : undefined}
          compact={compact}
          hapticFeedback={false} // Don't vibrate for loading errors
        />
      </div>
    </div>
  );
}

// =============================================================================
// MOBILE PERMISSION ERROR STATE
// =============================================================================

interface MobilePermissionErrorProps {
  permission?: string;
  onRetry?: () => void;
  compact?: boolean;
}

export function MobilePermissionError({ 
  permission = 'this feature',
  onRetry,
  compact = false
}: MobilePermissionErrorProps) {
  const handleSettingsClick = () => {
    // Try to open app settings (this might not work on all browsers)
    if ('permissions' in navigator) {
      // Some browsers support this
      window.open('app-settings:');
    } else {
      // Fallback to showing instructions
      alert('Please check your browser settings to enable the required permissions.');
    }
  };

  return (
    <MobileErrorState
      title="Permission Required"
      message={`We need permission to access ${permission}. Please enable it in your browser settings.`}
      icon="🔒"
      action={onRetry ? {
        label: 'Try Again',
        onClick: onRetry,
        variant: 'primary'
      } : undefined}
      secondaryAction={{
        label: 'Open Settings',
        onClick: handleSettingsClick
      }}
      compact={compact}
      hapticFeedback={true}
    />
  );
}

// =============================================================================
// MOBILE MAINTENANCE ERROR STATE
// =============================================================================

interface MobileMaintenanceErrorProps {
  estimatedTime?: string;
  compact?: boolean;
}

export function MobileMaintenanceError({ 
  estimatedTime = 'a few minutes',
  compact = false
}: MobileMaintenanceErrorProps) {
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // Auto-refresh when countdown reaches 0
          window.location.reload();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <MobileErrorState
      title="Under Maintenance"
      message={`We're currently updating Mile Quest to serve you better. This should take ${estimatedTime}.`}
      icon="🔧"
      action={{
        label: `Refresh (${countdown}s)`,
        onClick: () => window.location.reload(),
        variant: 'primary'
      }}
      compact={compact}
      showBackButton={false}
      hapticFeedback={false}
    />
  );
}

// =============================================================================
// MOBILE FORM VALIDATION ERROR STATE
// =============================================================================

interface MobileFormErrorProps {
  errors: string[];
  onDismiss?: () => void;
  compact?: boolean;
}

export function MobileFormError({ 
  errors,
  onDismiss,
  compact = false
}: MobileFormErrorProps) {
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible) return null;

  if (compact) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-2">
            <span className="text-red-600 text-sm" role="img" aria-label="Error">❌</span>
            <div className="flex-1">
              {errors.length === 1 ? (
                <p className="text-sm text-red-700">{errors[0]}</p>
              ) : (
                <div className="text-sm text-red-700">
                  <p className="font-medium mb-1">Please fix the following errors:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
          
          {onDismiss && (
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 text-red-500 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded-full p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Dismiss error"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <span className="text-red-600 text-xl" role="img" aria-label="Error">❌</span>
        </div>
        
        <div className="ml-3 flex-1">
          <h3 className="text-lg font-medium text-red-800 mb-2">
            {errors.length === 1 ? 'Error' : 'Multiple Errors'}
          </h3>
          
          {errors.length === 1 ? (
            <p className="text-red-700">{errors[0]}</p>
          ) : (
            <ul className="text-red-700 space-y-1">
              {errors.map((error, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-red-500 mr-2">•</span>
                  <span>{error}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        {onDismiss && (
          <button
            onClick={handleDismiss}
            className="ml-3 flex-shrink-0 text-red-500 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded-full p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Dismiss errors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MOBILE SUCCESS STATE (for comparison/consistency)
// =============================================================================

interface MobileSuccessStateProps {
  title?: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  autoHide?: boolean;
  autoHideDelay?: number;
  onHide?: () => void;
  compact?: boolean;
}

export function MobileSuccessState({
  title = 'Success!',
  message = 'Your action was completed successfully.',
  action,
  autoHide = false,
  autoHideDelay = 3000,
  onHide,
  compact = false
}: MobileSuccessStateProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Haptic feedback for success
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 30, 50]); // Success pattern
    }

    if (autoHide) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onHide?.();
      }, autoHideDelay);

      return () => clearTimeout(timer);
    }
  }, [autoHide, autoHideDelay, onHide]);

  if (!isVisible) return null;

  if (compact) {
    return (
      <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
        <div className="flex items-center space-x-3">
          <span className="text-green-600 text-xl" role="img" aria-label="Success">✅</span>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-green-800">{title}</h3>
            <p className="text-xs text-green-600 mt-1">{message}</p>
          </div>
          {action && (
            <button
              onClick={action.onClick}
              className="flex-shrink-0 bg-green-600 text-white text-xs px-3 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors min-h-[44px] min-w-[44px]"
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <div className="text-6xl mb-4" role="img" aria-label="Success">
        🎉
      </div>
      
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        {title}
      </h2>
      
      <p className="text-gray-600 mb-6 leading-relaxed max-w-sm">
        {message}
      </p>

      {action && (
        <button
          onClick={action.onClick}
          className="w-full max-w-sm py-3 px-4 bg-green-600 text-white rounded-lg font-medium text-base hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-200 focus:ring-offset-2 transition-colors min-h-[44px]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}