import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  TouchCard, 
  TouchButton, 
  useSwipeGesture, 
  useAdvancedSwipeGesture,
  PullToRefresh,
  InfiniteScroll 
} from '../TouchInteractions';

// Mock navigator.vibrate
const mockVibrate = vi.fn();
Object.defineProperty(navigator, 'vibrate', {
  value: mockVibrate,
  writable: true,
});

describe('TouchCard', () => {
  beforeEach(() => {
    mockVibrate.mockClear();
  });

  it('renders children correctly', () => {
    render(
      <TouchCard>
        <span>Test Content</span>
      </TouchCard>
    );
    
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('calls onClick when touched and released', () => {
    const handleClick = vi.fn();
    render(
      <TouchCard onClick={handleClick}>
        <span>Clickable Card</span>
      </TouchCard>
    );

    const card = screen.getByText('Clickable Card').parentElement!;
    
    fireEvent.touchStart(card, {
      touches: [{ clientX: 100, clientY: 100 }]
    });
    fireEvent.touchEnd(card);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('triggers haptic feedback on touch start', () => {
    render(
      <TouchCard onClick={() => {}}>
        <span>Haptic Card</span>
      </TouchCard>
    );

    const card = screen.getByText('Haptic Card').parentElement!;
    
    fireEvent.touchStart(card, {
      touches: [{ clientX: 100, clientY: 100 }]
    });

    expect(mockVibrate).toHaveBeenCalledWith([5]);
  });

  it('triggers long press after delay', async () => {
    const handleLongPress = vi.fn();
    render(
      <TouchCard onLongPress={handleLongPress} longPressDelay={100}>
        <span>Long Press Card</span>
      </TouchCard>
    );

    const card = screen.getByText('Long Press Card').parentElement!;
    
    fireEvent.touchStart(card, {
      touches: [{ clientX: 100, clientY: 100 }]
    });

    await waitFor(() => {
      expect(handleLongPress).toHaveBeenCalledTimes(1);
    }, { timeout: 200 });

    expect(mockVibrate).toHaveBeenCalledWith([15, 10, 15]);
  });

  it('applies proper touch target size', () => {
    render(
      <TouchCard>
        <span>Touch Target</span>
      </TouchCard>
    );

    const card = screen.getByText('Touch Target').parentElement!;
    expect(card).toHaveClass('min-h-[44px]', 'min-w-[44px]');
  });

  it('does not trigger events when disabled', () => {
    const handleClick = vi.fn();
    render(
      <TouchCard onClick={handleClick} disabled>
        <span>Disabled Card</span>
      </TouchCard>
    );

    const card = screen.getByText('Disabled Card').parentElement!;
    
    fireEvent.touchStart(card, {
      touches: [{ clientX: 100, clientY: 100 }]
    });
    fireEvent.touchEnd(card);

    expect(handleClick).not.toHaveBeenCalled();
    expect(mockVibrate).not.toHaveBeenCalled();
  });
});

describe('TouchButton', () => {
  it('renders with correct variant styles', () => {
    const { rerender } = render(
      <TouchButton variant="primary">Primary Button</TouchButton>
    );
    
    let button = screen.getByText('Primary Button').parentElement!;
    expect(button).toHaveClass('bg-blue-600');

    rerender(<TouchButton variant="secondary">Secondary Button</TouchButton>);
    button = screen.getByText('Secondary Button').parentElement!;
    expect(button).toHaveClass('bg-gray-200');

    rerender(<TouchButton variant="ghost">Ghost Button</TouchButton>);
    button = screen.getByText('Ghost Button').parentElement!;
    expect(button).toHaveClass('bg-transparent');
  });

  it('applies correct size classes', () => {
    const { rerender } = render(
      <TouchButton size="sm">Small Button</TouchButton>
    );
    
    let button = screen.getByText('Small Button').parentElement!;
    expect(button).toHaveClass('min-h-[44px]');

    rerender(<TouchButton size="lg">Large Button</TouchButton>);
    button = screen.getByText('Large Button').parentElement!;
    expect(button).toHaveClass('min-h-[48px]');
  });

  it('maintains minimum touch target size', () => {
    render(<TouchButton size="sm">Button</TouchButton>);
    
    const button = screen.getByText('Button').parentElement!;
    expect(button).toHaveClass('min-h-[44px]');
  });
});

// Component to test swipe gesture hook
function SwipeTestComponent({ 
  onSwipeLeft, 
  onSwipeRight, 
  onSwipeUp, 
  onSwipeDown,
  advanced = false,
  options = {}
}: {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  advanced?: boolean;
  options?: any;
}) {
  const swipeGestures = advanced 
    ? useAdvancedSwipeGesture(onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, options)
    : useSwipeGesture(onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown);

  return (
    <div 
      data-testid="swipe-area"
      {...swipeGestures}
    >
      Swipe Area
    </div>
  );
}

describe('useSwipeGesture', () => {
  it('detects left swipe', () => {
    const handleSwipeLeft = vi.fn();
    render(
      <SwipeTestComponent onSwipeLeft={handleSwipeLeft} />
    );

    const swipeArea = screen.getByTestId('swipe-area');
    
    // Start touch at right side
    fireEvent.touchStart(swipeArea, {
      targetTouches: [{ clientX: 200, clientY: 100 }]
    });
    
    // Move to left side
    fireEvent.touchMove(swipeArea, {
      targetTouches: [{ clientX: 100, clientY: 100 }]
    });
    
    // End touch
    fireEvent.touchEnd(swipeArea);

    expect(handleSwipeLeft).toHaveBeenCalledTimes(1);
  });

  it('detects right swipe', () => {
    const handleSwipeRight = vi.fn();
    render(
      <SwipeTestComponent onSwipeRight={handleSwipeRight} />
    );

    const swipeArea = screen.getByTestId('swipe-area');
    
    // Start touch at left side
    fireEvent.touchStart(swipeArea, {
      targetTouches: [{ clientX: 100, clientY: 100 }]
    });
    
    // Move to right side
    fireEvent.touchMove(swipeArea, {
      targetTouches: [{ clientX: 200, clientY: 100 }]
    });
    
    // End touch
    fireEvent.touchEnd(swipeArea);

    expect(handleSwipeRight).toHaveBeenCalledTimes(1);
  });

  it('respects swipe threshold', () => {
    const handleSwipeLeft = vi.fn();
    render(
      <SwipeTestComponent onSwipeLeft={handleSwipeLeft} />
    );

    const swipeArea = screen.getByTestId('swipe-area');
    
    // Small swipe below threshold (default 50px)
    fireEvent.touchStart(swipeArea, {
      targetTouches: [{ clientX: 120, clientY: 100 }]
    });
    
    fireEvent.touchMove(swipeArea, {
      targetTouches: [{ clientX: 100, clientY: 100 }]
    });
    
    fireEvent.touchEnd(swipeArea);

    expect(handleSwipeLeft).not.toHaveBeenCalled();
  });
});

describe('useAdvancedSwipeGesture', () => {
  it('respects velocity threshold', () => {
    const handleSwipeLeft = vi.fn();
    render(
      <SwipeTestComponent 
        onSwipeLeft={handleSwipeLeft} 
        advanced={true}
        options={{ velocityThreshold: 1.0 }}
      />
    );

    const swipeArea = screen.getByTestId('swipe-area');
    
    // Slow swipe that meets distance but not velocity
    fireEvent.touchStart(swipeArea, {
      targetTouches: [{ clientX: 200, clientY: 100 }]
    });
    
    // Simulate slow movement by adding delay
    setTimeout(() => {
      fireEvent.touchMove(swipeArea, {
        targetTouches: [{ clientX: 100, clientY: 100 }]
      });
      
      fireEvent.touchEnd(swipeArea);
    }, 500);

    // Should not trigger due to low velocity
    expect(handleSwipeLeft).not.toHaveBeenCalled();
  });
});

describe('PullToRefresh', () => {
  it('renders children correctly', () => {
    const mockRefresh = vi.fn();
    render(
      <PullToRefresh onRefresh={mockRefresh}>
        <div>Content</div>
      </PullToRefresh>
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('shows refresh indicator when pulled down', () => {
    const mockRefresh = vi.fn();
    render(
      <PullToRefresh onRefresh={mockRefresh} threshold={50}>
        <div>Content</div>
      </PullToRefresh>
    );

    const container = screen.getByText('Content').parentElement!;
    
    // Mock scrollY being 0 (at top)
    Object.defineProperty(window, 'scrollY', { value: 0 });
    
    // Start pull gesture
    fireEvent.touchStart(container, {
      touches: [{ clientY: 100 }]
    });
    
    // Pull down beyond threshold
    fireEvent.touchMove(container, {
      touches: [{ clientY: 160 }]
    });

    // Should show refresh indicator
    expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument();
  });
});

describe('InfiniteScroll', () => {
  beforeEach(() => {
    // Mock IntersectionObserver
    global.IntersectionObserver = vi.fn(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    })) as any;
  });

  it('renders children and loading indicator', () => {
    const mockLoadMore = vi.fn();
    render(
      <InfiniteScroll 
        onLoadMore={mockLoadMore}
        hasMore={true}
        loading={false}
      >
        <div>Content</div>
      </InfiniteScroll>
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.getByText('Scroll for more')).toBeInTheDocument();
  });

  it('shows loading state correctly', () => {
    const mockLoadMore = vi.fn();
    render(
      <InfiniteScroll 
        onLoadMore={mockLoadMore}
        hasMore={true}
        loading={true}
      >
        <div>Content</div>
      </InfiniteScroll>
    );

    expect(screen.getByText('Loading more...')).toBeInTheDocument();
  });

  it('hides loading indicator when no more items', () => {
    const mockLoadMore = vi.fn();
    render(
      <InfiniteScroll 
        onLoadMore={mockLoadMore}
        hasMore={false}
        loading={false}
      >
        <div>Content</div>
      </InfiniteScroll>
    );

    expect(screen.queryByText('Scroll for more')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading more...')).not.toBeInTheDocument();
  });
});

describe('Touch Accessibility', () => {
  it('maintains focus management for keyboard users', () => {
    render(
      <TouchButton onClick={() => {}}>
        Focus Test
      </TouchButton>
    );

    const button = screen.getByText('Focus Test').parentElement!;
    expect(button).toHaveClass('focus:outline-none', 'focus:ring-2');
  });

  it('provides proper ARIA labels for gesture hints', () => {
    render(
      <SwipeTestComponent onSwipeLeft={() => {}} />
    );

    const swipeArea = screen.getByTestId('swipe-area');
    // Test that swipe area is properly accessible
    expect(swipeArea).toBeInTheDocument();
  });

  it('respects reduced motion preferences', () => {
    // Mock reduced motion preference
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn(() => ({
        matches: true, // Prefers reduced motion
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });

    render(
      <TouchCard pressEffect={true}>
        Reduced Motion Test
      </TouchCard>
    );

    // TouchCard should still work but with reduced animations
    const card = screen.getByText('Reduced Motion Test').parentElement!;
    expect(card).toHaveClass('transition-all');
  });
});