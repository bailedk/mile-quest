import React from 'react';

interface ErrorAlertProps {
  title?: string;
  message: string;
  onDismiss?: () => void;
  variant?: 'error' | 'warning' | 'info';
  className?: string;
}

export function ErrorAlert({
  title,
  message,
  onDismiss,
  variant = 'error',
  className = ''
}: ErrorAlertProps) {
  const variantStyles = {
    error: {
      container: 'bg-red-50 border-red-200',
      icon: '❌',
      title: 'text-red-800',
      message: 'text-red-700',
      button: 'text-red-600 hover:text-red-700'
    },
    warning: {
      container: 'bg-yellow-50 border-yellow-200',
      icon: '⚠️',
      title: 'text-yellow-800',
      message: 'text-yellow-700',
      button: 'text-yellow-600 hover:text-yellow-700'
    },
    info: {
      container: 'bg-blue-50 border-blue-200',
      icon: 'ℹ️',
      title: 'text-blue-800',
      message: 'text-blue-700',
      button: 'text-blue-600 hover:text-blue-700'
    }
  };

  const styles = variantStyles[variant];

  return (
    <div className={`${styles.container} border rounded-lg p-4 ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <span className="text-xl" role="img" aria-label={variant}>
            {styles.icon}
          </span>
        </div>
        <div className="ml-3 flex-1">
          {title && (
            <h3 className={`text-sm font-medium ${styles.title}`}>
              {title}
            </h3>
          )}
          <div className={`${title ? 'mt-1' : ''} text-sm ${styles.message}`}>
            {message}
          </div>
        </div>
        {onDismiss && (
          <div className="ml-3 flex-shrink-0">
            <button
              type="button"
              onClick={onDismiss}
              className={`inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${styles.button}`}
            >
              <span className="sr-only">Dismiss</span>
              <svg
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
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