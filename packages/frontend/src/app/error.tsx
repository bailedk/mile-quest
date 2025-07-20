'use client';

import { useEffect } from 'react';
import { reportError } from '@/components/error';
import { MobileErrorState } from '@/components/error';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report the error with comprehensive context
    reportError(error, {
      page: 'app-error-boundary',
      component: 'NextJS-Error-Page',
      customData: {
        digest: error.digest,
        boundary: 'route-level'
      }
    });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-lg w-full">
        <MobileErrorState
          title="Application Error"
          message="We apologize for the inconvenience. An unexpected error has occurred while loading this page."
          icon="🚫"
          action={{
            label: 'Try Again',
            onClick: reset,
            variant: 'primary'
          }}
          secondaryAction={{
            label: 'Go to Dashboard',
            onClick: () => window.location.href = '/dashboard'
          }}
          hapticFeedback={true}
        />
        
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-6 p-4 bg-gray-100 rounded-lg">
            <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-2">
              Developer Information
            </summary>
            <div className="text-xs font-mono text-gray-600 space-y-2">
              <div>
                <strong>Error:</strong> {error.name}
              </div>
              <div>
                <strong>Message:</strong> {error.message}
              </div>
              {error.digest && (
                <div>
                  <strong>Digest:</strong> {error.digest}
                </div>
              )}
              {error.stack && (
                <div>
                  <strong>Stack:</strong>
                  <pre className="mt-1 whitespace-pre-wrap break-all max-h-32 overflow-auto bg-white p-2 rounded border">
                    {error.stack}
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