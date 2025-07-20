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

        {children}

        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
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
          
          {showHomeButton && (
            <Link
              href="/"
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 transition-all duration-200"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m0 0V11a1 1 0 011-1h2a1 1 0 011 1v10m-6 0a1 1 0 001 1h2a1 1 0 001-1m0 0V9a1 1 0 012-2h2a1 1 0 012 2v10.01M9 9a1 1 0 012-2h2a1 1 0 012 2M9 9a1 1 0 012-2h2a1 1 0 012 2m-3 6h3a1 1 0 001-1V9a1 1 0 00-1-1H9a1 1 0 00-1 1v10a1 1 0 001 1z" />
              </svg>
              Go Home
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// 404 Not Found
export function NotFound() {
  return (
    <ErrorPageLayout
      statusCode={404}
      title="Page Not Found"
      message="Sorry, we couldn't find the page you're looking for. It might have been moved or doesn't exist."
    />
  );
}

// 500 Internal Server Error
export function InternalServerError() {
  return (
    <ErrorPageLayout
      statusCode={500}
      title="Something went wrong"
      message="We're experiencing some technical difficulties. Please try again in a few moments."
    />
  );
}

// 403 Forbidden
export function Forbidden() {
  return (
    <ErrorPageLayout
      statusCode={403}
      title="Access Denied"
      message="You don't have permission to access this resource. Please contact your administrator if you believe this is an error."
    />
  );
}

// Generic Error Page
export function GenericError({ 
  title = "Something went wrong", 
  message = "An unexpected error occurred. Please try again.",
  children 
}: Partial<ErrorPageProps>) {
  return (
    <ErrorPageLayout title={title} message={message}>
      {children}
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
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-lg w-full text-center">
        <div className="text-6xl mb-6">📡</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">You're Offline</h1>
        <p className="text-lg text-gray-600 mb-8">Please check your internet connection and try again.</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    </div>
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
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <p className="text-yellow-800 text-sm">
          <strong>Estimated downtime:</strong> 15-30 minutes
        </p>
      </div>
    </ErrorPageLayout>
  );
}

// Authentication Required
export function AuthRequired() {
  return (
    <ErrorPageLayout
      statusCode={401}
      title="Authentication Required"
      message="You need to sign in to access this page."
      showBackButton={false}
    >
      <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
        <Link
          href="/signin"
          className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 transition-all duration-200"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
          </svg>
          Sign In
        </Link>
        
        <Link
          href="/signup"
          className="inline-flex items-center px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-4 focus:ring-gray-200 transition-all duration-200"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Create Account
        </Link>
      </div>
    </ErrorPageLayout>
  );
}