'use client';

import { useEffect } from 'react';
import { logError, getErrorMessage } from '@/utils/error-handling';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the critical error
    logError(error, {
      context: 'GlobalError',
      digest: error.digest,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  // Categorize error type for better user messaging
  const getErrorCategory = (error: Error) => {
    if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
      return 'chunk';
    }
    if (error.name === 'NetworkError' || error.message.includes('fetch')) {
      return 'network';
    }
    if (error.name === 'TypeError' && error.message.includes('Cannot read')) {
      return 'data';
    }
    return 'unknown';
  };

  const errorCategory = getErrorCategory(error);
  const userMessage = getErrorMessage(error);

  const getErrorIcon = (category: string) => {
    switch (category) {
      case 'chunk':
        return '🔄';
      case 'network':
        return '🌐';
      case 'data':
        return '📊';
      default:
        return '⚠️';
    }
  };

  const getErrorTitle = (category: string) => {
    switch (category) {
      case 'chunk':
        return 'App Update Required';
      case 'network':
        return 'Connection Error';
      case 'data':
        return 'Data Loading Error';
      default:
        return 'Critical Application Error';
    }
  };

  const getErrorDescription = (category: string) => {
    switch (category) {
      case 'chunk':
        return 'The application has been updated. Please refresh to get the latest version.';
      case 'network':
        return 'Unable to connect to our servers. Please check your internet connection and try again.';
      case 'data':
        return 'There was a problem loading application data. Please try refreshing the page.';
      default:
        return 'A critical error has occurred. Please refresh the page or contact support if the problem persists.';
    }
  };

  const handleRetry = () => {
    if (errorCategory === 'chunk') {
      // For chunk errors, force a hard reload
      window.location.reload();
    } else {
      reset();
    }
  };

  const handleReportError = () => {
    // In a real app, this would open a support form or send to error reporting
    const subject = encodeURIComponent(`Critical Error Report: ${error.name}`);
    const body = encodeURIComponent(
      `Error Details:\n\n` +
      `Message: ${error.message}\n` +
      `Type: ${error.name}\n` +
      `Digest: ${error.digest || 'N/A'}\n` +
      `URL: ${window.location.href}\n` +
      `User Agent: ${navigator.userAgent}\n` +
      `Timestamp: ${new Date().toISOString()}`
    );
    window.open(`mailto:support@milequest.app?subject=${subject}&body=${body}`);
  };

  return (
    <html lang="en">
      <head>
        <title>Application Error - Mile Quest</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-lg w-full text-center">
            <div className="text-6xl mb-6" role="img" aria-label="Error">
              {getErrorIcon(errorCategory)}
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {getErrorTitle(errorCategory)}
            </h1>
            
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              {getErrorDescription(errorCategory)}
            </p>

            <div className="space-y-4">
              <button
                onClick={handleRetry}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 transition-all duration-200"
                autoFocus
              >
                {errorCategory === 'chunk' ? 'Refresh Application' : 'Try Again'}
              </button>
              
              <button
                onClick={handleReportError}
                className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-200 focus:outline-none focus:ring-4 focus:ring-gray-200 transition-all duration-200"
              >
                Report This Issue
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && (
              <details className="mt-8 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 mb-2">
                  Developer Information
                </summary>
                <div className="bg-gray-100 rounded-lg p-4 text-xs font-mono">
                  <div className="mb-2">
                    <strong>Error:</strong> {error.name}
                  </div>
                  <div className="mb-2">
                    <strong>Message:</strong> {error.message}
                  </div>
                  <div className="mb-2">
                    <strong>Digest:</strong> {error.digest || 'N/A'}
                  </div>
                  <div className="mb-2">
                    <strong>User Message:</strong> {userMessage}
                  </div>
                  {error.stack && (
                    <div>
                      <strong>Stack:</strong>
                      <pre className="mt-1 whitespace-pre-wrap break-all">
                        {error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}