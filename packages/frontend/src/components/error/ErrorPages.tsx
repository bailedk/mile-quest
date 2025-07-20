'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// =============================================================================
// HTTP ERROR PAGES
// =============================================================================

interface ErrorPageProps {
  title?: string;
  message?: string;
  statusCode?: number;
  showHomeButton?: boolean;
  showBackButton?: boolean;
  children?: React.ReactNode;
  className?: string;
}

function ErrorPageLayout({ 
  title, 
  message, 
  statusCode, 
  showHomeButton = true, 
  showBackButton = true,
  children,
  className = ''
}: ErrorPageProps) {
  const router = useRouter();

  return (
    <div className={`min-h-screen flex items-center justify-center bg-gray-50 px-4 ${className}`}>
      <div className="max-w-lg w-full text-center">
        {statusCode && (
          <div className="text-8xl font-bold text-gray-300 mb-4" aria-hidden="true">
            {statusCode}
          </div>
        )}
        
        <div className="text-6xl mb-6" role="img" aria-label="Error">
          😕
        </div>
        
        {title && (
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {title}
          </h1>
        )}
        
        {message && (
          <p className="text-lg text-gray-600 mb-8 leading-relaxed">
            {message}
          </p>
        )}

        {children && (
          <div className="mb-8">
            {children}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {showHomeButton && (
            <Link
              href="/dashboard"
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 transition-all duration-200"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Go to Dashboard
            </Link>
          )}
          
          {showBackButton && (
            <button
              onClick={() => router.back()}
              className="inline-flex items-center px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-4 focus:ring-gray-200 transition-all duration-200"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Go Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// 404 Not Found Page
export function NotFoundError() {
  return (
    <ErrorPageLayout
      statusCode={404}
      title="Page Not Found"
      message="The page you're looking for doesn't exist. It might have been moved, deleted, or you entered the wrong URL."
    >
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-blue-800 text-sm">
          <strong>Looking for something specific?</strong>
        </p>
        <ul className="text-blue-700 text-sm mt-2 space-y-1">
          <li>• Check your team dashboard</li>
          <li>• Browse your activity history</li>
          <li>• View team leaderboards</li>
        </ul>
      </div>
    </ErrorPageLayout>
  );
}

// 403 Forbidden Page
export function ForbiddenError() {
  return (
    <ErrorPageLayout
      statusCode={403}
      title="Access Denied"
      message="You don't have permission to access this page. You might need to sign in or contact your team administrator."
    >
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <span className="text-yellow-600 text-xl" role="img" aria-label="Info">
              🔒
            </span>
          </div>
          <div className="ml-3 text-left">
            <p className="text-yellow-800 text-sm font-medium mb-1">
              Common reasons for this error:
            </p>
            <ul className="text-yellow-700 text-sm space-y-1">
              <li>• You're not signed in to your account</li>
              <li>• You're not a member of this team</li>
              <li>• Your session has expired</li>
            </ul>
          </div>
        </div>
      </div>
    </ErrorPageLayout>
  );
}

// 500 Server Error Page
export function ServerError() {
  const handleReportIssue = () => {
    const subject = encodeURIComponent('Server Error Report');
    const body = encodeURIComponent(
      `I encountered a server error on Mile Quest.\n\n` +
      `Page: ${window.location.href}\n` +
      `Time: ${new Date().toISOString()}\n` +
      `Please describe what you were trying to do:\n\n`
    );
    window.open(`mailto:support@milequest.app?subject=${subject}&body=${body}`);
  };

  return (
    <ErrorPageLayout
      statusCode={500}
      title="Server Error"
      message="Something went wrong on our end. Our team has been notified and is working to fix the issue."
    >
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <span className="text-red-600 text-xl" role="img" aria-label="Error">
              ⚠️
            </span>
          </div>
          <div className="ml-3 text-left">
            <p className="text-red-800 text-sm font-medium mb-1">
              What you can try:
            </p>
            <ul className="text-red-700 text-sm space-y-1">
              <li>• Wait a few minutes and try again</li>
              <li>• Refresh the page</li>
              <li>• Check if the issue persists</li>
            </ul>
          </div>
        </div>
      </div>
      
      <button
        onClick={handleReportIssue}
        className="text-sm text-blue-600 hover:text-blue-700 underline mb-4"
      >
        Report this issue to support
      </button>
    </ErrorPageLayout>
  );
}

// Network/Connection Error Page
export function NetworkError({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorPageLayout
      title="Connection Problem"
      message="We're having trouble connecting to our servers. This could be a temporary network issue."
      showHomeButton={false}
      showBackButton={false}
    >
      <div className="text-6xl mb-6" role="img" aria-label="Network error">
        🌐
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <span className="text-blue-600 text-xl" role="img" aria-label="Info">
              📶
            </span>
          </div>
          <div className="ml-3 text-left">
            <p className="text-blue-800 text-sm font-medium mb-1">
              Check your connection:
            </p>
            <ul className="text-blue-700 text-sm space-y-1">
              <li>• Make sure you're connected to the internet</li>
              <li>• Try refreshing the page</li>
              <li>• Check if other websites are working</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 transition-all duration-200"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Try Again
          </button>
        )}
        
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-4 focus:ring-gray-200 transition-all duration-200"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Page
        </button>
      </div>
    </ErrorPageLayout>
  );
}

// =============================================================================
// SPECIALIZED ERROR COMPONENTS
// =============================================================================

// Loading Error with Skeleton Fallback
interface LoadingErrorFallbackProps {
  error: Error;
  onRetry?: () => void;
  resourceName?: string;
  skeletonType?: 'card' | 'list' | 'chart' | 'table';
}

export function LoadingErrorFallback({ 
  error, 
  onRetry, 
  resourceName = 'data',
  skeletonType = 'card'
}: LoadingErrorFallbackProps) {
  const getSkeletonContent = () => {
    switch (skeletonType) {
      case 'list':
        return (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-2/3" />
                </div>
              </div>
            ))}
          </div>
        );
      case 'chart':
        return (
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/3" />
            <div className="h-48 bg-gray-200 rounded animate-pulse" />
          </div>
        );
      case 'table':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded animate-pulse" />
              ))}
            </div>
          </div>
        );
      default:
        return (
          <div className="space-y-4">
            <div className="h-6 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3" />
          </div>
        );
    }
  };

  return (
    <div className="relative">
      {/* Blurred skeleton background */}
      <div className="opacity-30 blur-sm pointer-events-none">
        {getSkeletonContent()}
      </div>
      
      {/* Error overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-white/90">
        <div className="text-center p-4 max-w-sm">
          <div className="text-4xl mb-3" role="img" aria-label="Error">
            😔
          </div>
          
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Failed to load {resourceName}
          </h3>
          
          <p className="text-sm text-gray-600 mb-4">
            {error.message || `There was a problem loading ${resourceName}.`}
          </p>
          
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Offline Error Page
export function OfflineError() {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) {
    window.location.reload();
    return null;
  }

  return (
    <ErrorPageLayout
      title="You're Offline"
      message="It looks like you're not connected to the internet. Some features may not be available until you reconnect."
      showHomeButton={false}
      showBackButton={false}
    >
      <div className="text-6xl mb-6" role="img" aria-label="Offline">
        📡
      </div>
      
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <span className="text-orange-600 text-xl" role="img" aria-label="Info">
              📵
            </span>
          </div>
          <div className="ml-3 text-left">
            <p className="text-orange-800 text-sm font-medium mb-1">
              While you're offline, you can still:
            </p>
            <ul className="text-orange-700 text-sm space-y-1">
              <li>• View your cached activity history</li>
              <li>• Log new activities (they'll sync when you're back online)</li>
              <li>• Browse your team information</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center space-x-2 text-sm text-gray-600 mb-4">
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        <span>Connection status: Offline</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          href="/dashboard"
          className="inline-flex items-center px-6 py-3 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-4 focus:ring-orange-200 transition-all duration-200"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4" />
          </svg>
          Continue Offline
        </button>
        
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-4 focus:ring-gray-200 transition-all duration-200"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Check Connection
        </button>
      </div>
    </ErrorPageLayout>
  );
}

// Maintenance Mode Error
export function MaintenanceError() {
  return (
    <ErrorPageLayout
      title="Under Maintenance"
      message="We're currently performing scheduled maintenance to improve your experience. We'll be back shortly."
      showBackButton={false}
    >
      <div className="text-6xl mb-6" role="img" aria-label="Maintenance">
        🔧
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <span className="text-blue-600 text-xl" role="img" aria-label="Info">
              ℹ️
            </span>
          </div>
          <div className="ml-3 text-left">
            <p className="text-blue-800 text-sm font-medium mb-1">
              What's happening:
            </p>
            <ul className="text-blue-700 text-sm space-y-1">
              <li>• System updates and improvements</li>
              <li>• Database optimization</li>
              <li>• New feature deployment</li>
            </ul>
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-600 mb-6">
        Estimated completion: Usually takes less than 30 minutes
      </p>

      <div className="flex justify-center">
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 transition-all duration-200"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Check Again
        </button>
      </div>
    </ErrorPageLayout>
  );
}