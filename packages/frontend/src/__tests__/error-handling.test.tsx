/**
 * Error Handling Test Suite
 * Tests for enhanced error handling components and utilities
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorMessage, RetryButton, ErrorState } from '@/components/error/ErrorComponents';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { logError, getErrorMessage, ApiError, NetworkError, ValidationError } from '@/utils/error-handling';

// Mock console methods to test logging
const consoleSpy = {
  error: jest.spyOn(console, 'error').mockImplementation(),
  log: jest.spyOn(console, 'log').mockImplementation(),
  group: jest.spyOn(console, 'group').mockImplementation(),
  groupEnd: jest.spyOn(console, 'groupEnd').mockImplementation(),
};

// Mock component that throws an error
function ThrowError({ shouldThrow = false, errorType = 'generic' }) {
  if (shouldThrow) {
    if (errorType === 'api') {
      throw new ApiError('API Error', 500);
    }
    if (errorType === 'network') {
      throw new NetworkError('Network Error');
    }
    if (errorType === 'validation') {
      throw new ValidationError('Validation Error', { field: ['Invalid'] });
    }
    throw new Error('Test error');
  }
  return <div>No error</div>;
}

// Test component using useErrorHandler hook
function TestErrorHandler() {
  const { error, isLoading, handleError, clearError, executeAsync, canRetry, retry } = useErrorHandler({
    enableRetry: true,
    maxRetries: 2,
  });

  const triggerError = () => {
    handleError(new Error('Test error'));
  };

  const triggerAsyncError = async () => {
    await executeAsync(() => Promise.reject(new Error('Async error')));
  };

  return (
    <div>
      <button onClick={triggerError}>Trigger Error</button>
      <button onClick={triggerAsyncError}>Trigger Async Error</button>
      <button onClick={clearError}>Clear Error</button>
      <button onClick={() => retry(() => Promise.resolve('success'))} disabled={!canRetry}>
        Retry
      </button>
      {error && <div data-testid="error-message">{error.message}</div>}
      {isLoading && <div data-testid="loading">Loading...</div>}
      {canRetry && <div data-testid="can-retry">Can Retry</div>}
    </div>
  );
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    consoleSpy.error.mockClear();
    consoleSpy.log.mockClear();
    consoleSpy.group.mockClear();
    consoleSpy.groupEnd.mockClear();
  });

  it('catches and displays errors', () => {
    render(
      <ErrorBoundary context="test">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('shows different layouts based on level', () => {
    const { rerender } = render(
      <ErrorBoundary level="component" context="test">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toHaveClass('p-4');

    rerender(
      <ErrorBoundary level="page" context="test">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toHaveClass('p-8');
  });

  it('shows retry attempts count', () => {
    render(
      <ErrorBoundary context="test" enableRetry={true}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const retryButton = screen.getByText('Try Again');
    fireEvent.click(retryButton);

    expect(screen.getByText(/Retry attempt 1 of 3/)).toBeInTheDocument();
  });

  it('shows reload page button after max retries', () => {
    render(
      <ErrorBoundary context="test" enableRetry={true}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const retryButton = screen.getByText('Try Again');
    
    // Exceed max retries
    fireEvent.click(retryButton);
    fireEvent.click(retryButton);
    fireEvent.click(retryButton);

    expect(screen.getByText('Reload Page')).toBeInTheDocument();
  });

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('logs errors with context', () => {
    render(
      <ErrorBoundary context="test-context">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(consoleSpy.error).toHaveBeenCalled();
  });
});

describe('ErrorMessage', () => {
  it('renders error message with default variant', () => {
    render(<ErrorMessage message="Test error message" />);
    
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('renders different variants correctly', () => {
    const { rerender } = render(<ErrorMessage message="Test" variant="error" />);
    expect(screen.getByRole('alert')).toHaveClass('bg-red-50');

    rerender(<ErrorMessage message="Test" variant="warning" />);
    expect(screen.getByRole('alert')).toHaveClass('bg-yellow-50');

    rerender(<ErrorMessage message="Test" variant="info" />);
    expect(screen.getByRole('alert')).toHaveClass('bg-blue-50');

    rerender(<ErrorMessage message="Test" variant="success" />);
    expect(screen.getByRole('alert')).toHaveClass('bg-green-50');
  });

  it('shows dismiss button when dismissible', () => {
    const onDismiss = jest.fn();
    render(<ErrorMessage message="Test" dismissible onDismiss={onDismiss} />);
    
    const dismissButton = screen.getByLabelText('Dismiss');
    fireEvent.click(dismissButton);
    
    expect(onDismiss).toHaveBeenCalled();
  });

  it('renders custom actions', () => {
    const action = <button>Custom Action</button>;
    render(<ErrorMessage message="Test" actions={action} />);
    
    expect(screen.getByText('Custom Action')).toBeInTheDocument();
  });
});

describe('RetryButton', () => {
  it('renders retry button with default text', () => {
    const onRetry = jest.fn();
    render(<RetryButton onRetry={onRetry} />);
    
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('calls onRetry when clicked', async () => {
    const onRetry = jest.fn().mockResolvedValue(void 0);
    render(<RetryButton onRetry={onRetry} />);
    
    fireEvent.click(screen.getByText('Try Again'));
    
    expect(onRetry).toHaveBeenCalled();
  });

  it('shows attempt count', async () => {
    const onRetry = jest.fn().mockRejectedValue(new Error('Retry failed'));
    render(<RetryButton onRetry={onRetry} maxAttempts={3} />);
    
    fireEvent.click(screen.getByText('Try Again'));
    
    await waitFor(() => {
      expect(screen.getByText(/Try Again \(1\/3\)/)).toBeInTheDocument();
    });
  });

  it('shows reload page after max attempts', async () => {
    const onRetry = jest.fn().mockRejectedValue(new Error('Retry failed'));
    render(<RetryButton onRetry={onRetry} maxAttempts={1} />);
    
    fireEvent.click(screen.getByText('Try Again'));
    
    await waitFor(() => {
      expect(screen.getByText('Reload Page')).toBeInTheDocument();
    });
  });

  it('shows countdown for auto-retry', async () => {
    const onRetry = jest.fn().mockRejectedValue(new Error('Retry failed'));
    render(<RetryButton onRetry={onRetry} autoRetry={true} retryDelay={1000} />);
    
    fireEvent.click(screen.getByText('Try Again'));
    
    await waitFor(() => {
      expect(screen.getByText(/Retrying in \d+s/)).toBeInTheDocument();
    });
  });
});

describe('ErrorState', () => {
  it('renders error state with title and message', () => {
    render(<ErrorState title="Error Title" message="Error message" />);
    
    expect(screen.getByText('Error Title')).toBeInTheDocument();
    expect(screen.getByText('Error message')).toBeInTheDocument();
  });

  it('renders action button when provided', () => {
    const action = { label: 'Retry', onClick: jest.fn() };
    render(<ErrorState message="Error" action={action} />);
    
    const button = screen.getByText('Retry');
    expect(button).toBeInTheDocument();
    
    fireEvent.click(button);
    expect(action.onClick).toHaveBeenCalled();
  });

  it('renders custom icon', () => {
    render(<ErrorState message="Error" icon="🔥" />);
    
    expect(screen.getByText('🔥')).toBeInTheDocument();
  });
});

describe('useErrorHandler', () => {
  it('handles errors correctly', () => {
    render(<TestErrorHandler />);
    
    fireEvent.click(screen.getByText('Trigger Error'));
    
    expect(screen.getByTestId('error-message')).toHaveTextContent('Test error');
    expect(screen.getByTestId('can-retry')).toBeInTheDocument();
  });

  it('handles async errors', async () => {
    render(<TestErrorHandler />);
    
    fireEvent.click(screen.getByText('Trigger Async Error'));
    
    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent('Async error');
    });
  });

  it('clears errors', () => {
    render(<TestErrorHandler />);
    
    fireEvent.click(screen.getByText('Trigger Error'));
    expect(screen.getByTestId('error-message')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Clear Error'));
    expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
  });
});

describe('Error Utilities', () => {
  beforeEach(() => {
    consoleSpy.error.mockClear();
    consoleSpy.log.mockClear();
    consoleSpy.group.mockClear();
    consoleSpy.groupEnd.mockClear();
  });

  describe('logError', () => {
    it('logs errors in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const error = new Error('Test error');
      logError(error, { context: 'test' });
      
      expect(consoleSpy.group).toHaveBeenCalledWith('🚨 Error Logged');
      expect(consoleSpy.error).toHaveBeenCalledWith('Error:', error);
      
      process.env.NODE_ENV = originalEnv;
    });

    it('logs errors in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const error = new Error('Test error');
      logError(error, { context: 'test' });
      
      expect(consoleSpy.error).toHaveBeenCalledWith('Production Error:', expect.any(Object));
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('getErrorMessage', () => {
    it('returns user-friendly messages for API errors', () => {
      const error = new ApiError('Internal Server Error', 500);
      expect(getErrorMessage(error)).toBe('An unexpected error occurred. Please try again later.');
    });

    it('returns user-friendly messages for network errors', () => {
      const error = new NetworkError();
      expect(getErrorMessage(error)).toBe('Unable to connect to the server. Please check your internet connection.');
    });

    it('returns validation error messages', () => {
      const error = new ValidationError('Validation failed', { email: ['Invalid email'] });
      expect(getErrorMessage(error)).toBe('Invalid email');
    });

    it('returns generic message for unknown errors', () => {
      const error = 'Unknown error type';
      expect(getErrorMessage(error)).toBe('An unexpected error occurred.');
    });
  });
});

afterAll(() => {
  consoleSpy.error.mockRestore();
  consoleSpy.log.mockRestore();
  consoleSpy.group.mockRestore();
  consoleSpy.groupEnd.mockRestore();
});