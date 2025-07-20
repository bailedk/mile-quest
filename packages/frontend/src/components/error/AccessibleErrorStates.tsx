'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// =============================================================================
// ACCESSIBLE ERROR COMPONENTS
// =============================================================================

interface AccessibleErrorProps {
  title: string;
  message: string;
  errorCode?: string;
  suggestion?: string;
  actions?: Array<{
    label: string;
    onClick: () => void;
    primary?: boolean;
    ariaLabel?: string;
  }>;
  onDismiss?: () => void;
  autoFocus?: boolean;
  live?: 'polite' | 'assertive';
  errorId?: string;
  className?: string;
}

export function AccessibleError({
  title,
  message,
  errorCode,
  suggestion,
  actions = [],
  onDismiss,
  autoFocus = true,
  live = 'assertive',
  errorId,
  className = ''
}: AccessibleErrorProps) {
  const errorRef = useRef<HTMLDivElement>(null);
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const [isAnnounced, setIsAnnounced] = useState(false);
  const generatedId = useRef(errorId || `error-${Date.now()}`);

  useEffect(() => {
    // Auto-focus the error container or primary action
    if (autoFocus) {
      if (primaryActionRef.current) {
        primaryActionRef.current.focus();
      } else if (errorRef.current) {
        errorRef.current.focus();
      }
    }

    // Announce to screen readers after a short delay
    const announceTimer = setTimeout(() => {
      setIsAnnounced(true);
    }, 100);

    return () => clearTimeout(announceTimer);
  }, [autoFocus]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    // Handle Escape key to dismiss if dismissible
    if (event.key === 'Escape' && onDismiss) {
      event.preventDefault();
      onDismiss();
    }
  }, [onDismiss]);

  const primaryAction = actions.find(action => action.primary);
  const secondaryActions = actions.filter(action => !action.primary);

  return (
    <div
      ref={errorRef}
      className={`
        bg-red-50 border-2 border-red-200 rounded-lg p-6 focus:outline-none focus:ring-4 focus:ring-red-300 focus:border-red-400
        ${className}
      `}
      role="alert"
      aria-live={live}
      aria-atomic="true"
      aria-labelledby={`${generatedId.current}-title`}
      aria-describedby={`${generatedId.current}-description ${suggestion ? `${generatedId.current}-suggestion` : ''}`}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      {/* Screen reader announcement */}
      {isAnnounced && (
        <div className="sr-only" aria-live={live}>
          Error: {title}. {message}. {suggestion ? `Suggestion: ${suggestion}` : ''}
        </div>
      )}

      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg
            className="h-6 w-6 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        
        <div className="ml-3 flex-1">
          <h3 
            id={`${generatedId.current}-title`}
            className="text-lg font-semibold text-red-800"
          >
            {title}
            {errorCode && (
              <span className="ml-2 text-sm font-normal text-red-600">
                (Error {errorCode})
              </span>
            )}
          </h3>
          
          <div 
            id={`${generatedId.current}-description`}
            className="mt-2 text-red-700"
          >
            {message}
          </div>
          
          {suggestion && (
            <div 
              id={`${generatedId.current}-suggestion`}
              className="mt-3 p-3 bg-red-100 border border-red-200 rounded-md"
            >
              <p className="text-sm text-red-800">
                <strong className="font-medium">Suggestion:</strong> {suggestion}
              </p>
            </div>
          )}
          
          {actions.length > 0 && (
            <div className="mt-6">
              <div className="flex flex-col sm:flex-row gap-3">
                {primaryAction && (
                  <button
                    ref={primaryActionRef}
                    onClick={primaryAction.onClick}
                    className="
                      inline-flex items-center justify-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md
                      hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-300 focus:ring-offset-2
                      transition-colors min-h-[44px]
                    "
                    aria-label={primaryAction.ariaLabel || primaryAction.label}
                  >
                    {primaryAction.label}
                  </button>
                )}
                
                {secondaryActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={action.onClick}
                    className="
                      inline-flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md
                      hover:bg-gray-200 focus:outline-none focus:ring-4 focus:ring-gray-300 focus:ring-offset-2
                      transition-colors min-h-[44px]
                    "
                    aria-label={action.ariaLabel || action.label}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {onDismiss && (
          <div className="ml-4">
            <button
              onClick={onDismiss}
              className="
                inline-flex items-center justify-center p-2 text-red-500 rounded-md
                hover:bg-red-100 focus:outline-none focus:ring-4 focus:ring-red-300 focus:ring-offset-2
                transition-colors min-h-[44px] min-w-[44px]
              "
              aria-label="Dismiss error message"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// ACCESSIBLE INLINE ERROR
// =============================================================================

interface AccessibleInlineErrorProps {
  message: string;
  fieldId?: string;
  errorId?: string;
  className?: string;
}

export function AccessibleInlineError({
  message,
  fieldId,
  errorId,
  className = ''
}: AccessibleInlineErrorProps) {
  const generatedId = errorId || `inline-error-${Date.now()}`;

  return (
    <div
      id={generatedId}
      className={`mt-1 text-sm text-red-600 ${className}`}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      aria-describedby={fieldId}
    >
      <div className="flex items-center">
        <svg
          className="h-4 w-4 mr-1 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <span>{message}</span>
      </div>
    </div>
  );
}

// =============================================================================
// ACCESSIBLE ERROR LIST
// =============================================================================

interface AccessibleErrorListProps {
  errors: Array<{
    id: string;
    field?: string;
    message: string;
    severity?: 'error' | 'warning';
  }>;
  title?: string;
  onErrorClick?: (errorId: string) => void;
  onDismiss?: () => void;
  className?: string;
}

export function AccessibleErrorList({
  errors,
  title = 'Please fix the following errors:',
  onErrorClick,
  onDismiss,
  className = ''
}: AccessibleErrorListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [announceCount, setAnnounceCount] = useState(0);

  useEffect(() => {
    // Announce error count change
    setAnnounceCount(errors.length);

    // Focus the error list when errors appear
    if (errors.length > 0 && listRef.current) {
      listRef.current.focus();
    }
  }, [errors.length]);

  if (errors.length === 0) {
    return null;
  }

  const errorCount = errors.filter(e => e.severity !== 'warning').length;
  const warningCount = errors.filter(e => e.severity === 'warning').length;

  return (
    <div
      ref={listRef}
      className={`
        bg-red-50 border-2 border-red-200 rounded-lg p-4 focus:outline-none focus:ring-4 focus:ring-red-300
        ${className}
      `}
      role="alert"
      aria-live="assertive"
      aria-atomic="false"
      aria-labelledby="error-list-title"
      tabIndex={-1}
    >
      {/* Screen reader announcement */}
      <div className="sr-only" aria-live="assertive">
        {errorCount > 0 && `${errorCount} error${errorCount === 1 ? '' : 's'} found.`}
        {warningCount > 0 && ` ${warningCount} warning${warningCount === 1 ? '' : 's'} found.`}
      </div>

      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 id="error-list-title" className="text-sm font-semibold text-red-800 mb-2">
            {title}
            <span className="ml-2 text-xs font-normal">
              ({errorCount} error{errorCount === 1 ? '' : 's'}
              {warningCount > 0 && `, ${warningCount} warning${warningCount === 1 ? '' : 's'}`})
            </span>
          </h3>
          
          <ul className="space-y-2" role="list">
            {errors.map((error, index) => (
              <li key={error.id} className="flex items-start">
                <div className="flex-shrink-0 mt-0.5">
                  <svg
                    className={`h-4 w-4 ${
                      error.severity === 'warning' ? 'text-yellow-600' : 'text-red-600'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={error.severity === 'warning' 
                        ? "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                        : "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                      }
                    />
                  </svg>
                </div>
                
                <div className="ml-2 flex-1">
                  {onErrorClick ? (
                    <button
                      onClick={() => onErrorClick(error.id)}
                      className={`
                        text-left text-sm underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-offset-1
                        ${
                          error.severity === 'warning'
                            ? 'text-yellow-800 focus:ring-yellow-500'
                            : 'text-red-700 focus:ring-red-500'
                        }
                      `}
                      aria-describedby={`error-${error.id}-field`}
                    >
                      {error.field && (
                        <span id={`error-${error.id}-field`} className="font-medium">
                          {error.field}:
                        </span>
                      )}
                      <span className={error.field ? 'ml-1' : ''}>{error.message}</span>
                    </button>
                  ) : (
                    <span className={`
                      text-sm
                      ${
                        error.severity === 'warning' ? 'text-yellow-800' : 'text-red-700'
                      }
                    `}>
                      {error.field && (
                        <span className="font-medium">{error.field}: </span>
                      )}
                      {error.message}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
        
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="
              ml-4 inline-flex items-center justify-center p-1 text-red-500 rounded-md
              hover:bg-red-100 focus:outline-none focus:ring-4 focus:ring-red-300 focus:ring-offset-2
              transition-colors min-h-[44px] min-w-[44px]
            "
            aria-label="Dismiss all errors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// ACCESSIBLE ERROR DIALOG
// =============================================================================

interface AccessibleErrorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  actions?: Array<{
    label: string;
    onClick: () => void;
    primary?: boolean;
    ariaLabel?: string;
  }>;
  className?: string;
}

export function AccessibleErrorDialog({
  isOpen,
  onClose,
  title,
  message,
  actions = [],
  className = ''
}: AccessibleErrorDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Store the previously focused element
      previousFocusRef.current = document.activeElement as HTMLElement;
      
      // Focus the dialog
      setTimeout(() => {
        if (dialogRef.current) {
          dialogRef.current.focus();
        }
      }, 100);
      
      setIsAnimating(true);
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    } else {
      // Restore focus
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
      
      // Restore body scroll
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
    
    // Trap focus within dialog
    if (event.key === 'Tab') {
      const focusableElements = dialogRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements && focusableElements.length > 0) {
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
        
        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    }
  }, [onClose]);

  if (!isOpen) {
    return null;
  }

  const primaryAction = actions.find(action => action.primary) || actions[0];
  const secondaryActions = actions.filter(action => action !== primaryAction);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-labelledby="error-dialog-title"
      aria-describedby="error-dialog-description"
    >
      {/* Backdrop */}
      <div
        className={`
          absolute inset-0 bg-black transition-opacity duration-300
          ${isAnimating ? 'opacity-50' : 'opacity-0'}
        `}
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Dialog */}
      <div
        ref={dialogRef}
        className={`
          relative bg-white rounded-lg shadow-xl max-w-md w-full transform transition-all duration-300
          ${isAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}
          ${className}
        `}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="error-dialog-title"
        aria-describedby="error-dialog-description"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="p-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-8 w-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            
            <div className="ml-4 flex-1">
              <h3 id="error-dialog-title" className="text-lg font-semibold text-gray-900 mb-2">
                {title}
              </h3>
              
              <p id="error-dialog-description" className="text-gray-700 leading-relaxed">
                {message}
              </p>
            </div>
          </div>
          
          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            {secondaryActions.map((action, index) => (
              <button
                key={index}
                onClick={() => {
                  action.onClick();
                  onClose();
                }}
                className="
                  px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md
                  hover:bg-gray-200 focus:outline-none focus:ring-4 focus:ring-gray-300 focus:ring-offset-2
                  transition-colors min-h-[44px]
                "
                aria-label={action.ariaLabel || action.label}
              >
                {action.label}
              </button>
            ))}
            
            {primaryAction && (
              <button
                onClick={() => {
                  primaryAction.onClick();
                  onClose();
                }}
                className="
                  px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md
                  hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-300 focus:ring-offset-2
                  transition-colors min-h-[44px]
                "
                aria-label={primaryAction.ariaLabel || primaryAction.label}
                autoFocus
              >
                {primaryAction.label}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}