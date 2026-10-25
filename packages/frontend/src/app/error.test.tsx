import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RouteError from './error';

describe('route error boundary', () => {
  it('logs the caught error to the console', () => {
    const error = Object.assign(new Error('teamMembers is not iterable'), {
      digest: 'digest-123',
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<RouteError error={error} reset={() => {}} />);

    expect(spy).toHaveBeenCalledWith(error);
    expect(screen.getByText('Application Error')).toBeInTheDocument();
    spy.mockRestore();
  });
});
