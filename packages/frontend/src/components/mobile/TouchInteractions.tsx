'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';

// Hook for swipe gesture detection
export function useSwipeGesture(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  onSwipeUp?: () => void,
  onSwipeDown?: () => void,
  threshold = 50
) {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    
    const isLeftSwipe = distanceX > threshold;
    const isRightSwipe = distanceX < -threshold;
    const isUpSwipe = distanceY > threshold;
    const isDownSwipe = distanceY < -threshold;

    // Prioritize horizontal swipes over vertical ones
    if (Math.abs(distanceX) > Math.abs(distanceY)) {
      if (isLeftSwipe && onSwipeLeft) {
        onSwipeLeft();
      }
      if (isRightSwipe && onSwipeRight) {
        onSwipeRight();
      }
    } else {
      if (isUpSwipe && onSwipeUp) {
        onSwipeUp();
      }
      if (isDownSwipe && onSwipeDown) {
        onSwipeDown();
      }
    }
  };

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}

// Pull-to-refresh component
interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  threshold?: number;
  className?: string;
}

export function PullToRefresh({ 
  onRefresh, 
  children, 
  threshold = 80,
  className = ''
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startY, setStartY] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (window.scrollY === 0 && startY > 0) {
      const currentY = e.touches[0].clientY;
      const distance = Math.max(0, currentY - startY);
      setPullDistance(Math.min(distance, threshold * 1.5));
      
      if (distance > 0) {
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    setPullDistance(0);
    setStartY(0);
  };

  const pullProgress = Math.min(pullDistance / threshold, 1);
  const shouldShowIndicator = pullDistance > 10 || isRefreshing;

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {shouldShowIndicator && (
        <div 
          className="absolute top-0 left-0 right-0 flex justify-center items-center z-10 transition-all duration-200"
          style={{ 
            transform: `translateY(-${Math.max(0, 40 - pullDistance)}px)`,
            height: `${Math.min(pullDistance, 40)}px`
          }}
        >
          <div className="bg-white rounded-full shadow-lg p-2 flex items-center justify-center">
            {isRefreshing ? (
              <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
            ) : (
              <svg 
                className="h-5 w-5 text-blue-600 transform transition-transform duration-200"
                style={{ transform: `rotate(${pullProgress * 180}deg)` }}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7-7m0 0l-7 7m7-7v18" />
              </svg>
            )}
          </div>
        </div>
      )}
      
      {/* Content with transform for pull effect */}
      <div 
        className="transition-transform duration-200"
        style={{ transform: `translateY(${pullDistance * 0.5}px)` }}
      >
        {children}
      </div>
    </div>
  );
}

// Infinite scroll component
interface InfiniteScrollProps {
  onLoadMore: () => Promise<void>;
  hasMore: boolean;
  loading: boolean;
  children: React.ReactNode;
  threshold?: number;
  className?: string;
}

export function InfiniteScroll({
  onLoadMore,
  hasMore,
  loading,
  children,
  threshold = 100,
  className = ''
}: InfiniteScrollProps) {
  const loadingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = loadingRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasMore, loading, onLoadMore]);

  return (
    <div className={className}>
      {children}
      
      {/* Loading indicator */}
      {hasMore && (
        <div 
          ref={loadingRef}
          className="flex justify-center items-center py-6"
          style={{ minHeight: threshold }}
        >
          {loading ? (
            <div className="flex items-center space-x-2 text-gray-600">
              <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
              <span className="text-sm">Loading more...</span>
            </div>
          ) : (
            <div className="text-gray-400 text-sm">Scroll for more</div>
          )}
        </div>
      )}
    </div>
  );
}

// Enhanced touch-friendly card component with improved haptic feedback
interface TouchCardProps {
  children: React.ReactNode;
  onClick?: () => void;
  onLongPress?: () => void;
  className?: string;
  pressEffect?: boolean;
  hapticFeedback?: 'light' | 'medium' | 'heavy' | boolean;
  longPressDelay?: number;
  disabled?: boolean;
}

export function TouchCard({ 
  children, 
  onClick, 
  onLongPress,
  className = '',
  pressEffect = true,
  hapticFeedback = true,
  longPressDelay = 500,
  disabled = false
}: TouchCardProps) {
  const [isPressed, setIsPressed] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const touchStartTimeRef = useRef<number>(0);

  const triggerHapticFeedback = useCallback((type: 'light' | 'medium' | 'heavy' | boolean = true) => {
    if (!hapticFeedback || disabled) return;
    
    // Use Vibration API for basic haptic feedback
    if ('vibrate' in navigator && typeof type === 'boolean' && type) {
      navigator.vibrate(10);
      return;
    }
    
    // Use Web Vibration API with different patterns for different feedback types
    if ('vibrate' in navigator && typeof type === 'string') {
      const patterns = {
        light: [5],
        medium: [10],
        heavy: [15, 10, 15]
      };
      navigator.vibrate(patterns[type] || [10]);
    }
  }, [hapticFeedback, disabled]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    
    touchStartTimeRef.current = Date.now();
    
    if (pressEffect) {
      setIsPressed(true);
      triggerHapticFeedback('light');
    }
    
    // Start long press timer
    if (onLongPress) {
      const timer = setTimeout(() => {
        triggerHapticFeedback('heavy');
        onLongPress();
        setIsPressed(false);
      }, longPressDelay);
      setLongPressTimer(timer);
    }
  }, [disabled, pressEffect, triggerHapticFeedback, onLongPress, longPressDelay]);

  const handleTouchEnd = useCallback(() => {
    if (disabled) return;
    
    const touchDuration = Date.now() - touchStartTimeRef.current;
    
    if (pressEffect) {
      setIsPressed(false);
    }
    
    // Clear long press timer
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    
    // Only trigger click if it wasn't a long press
    if (onClick && touchDuration < longPressDelay) {
      triggerHapticFeedback('medium');
      onClick();
    }
  }, [disabled, pressEffect, longPressTimer, onClick, longPressDelay, triggerHapticFeedback]);

  const handleTouchCancel = useCallback(() => {
    if (pressEffect) {
      setIsPressed(false);
    }
    
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  }, [pressEffect, longPressTimer]);

  return (
    <div
      className={`
        ${className}
        ${onClick || onLongPress ? 'cursor-pointer select-none' : ''}
        ${pressEffect && isPressed ? 'scale-95 opacity-90' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        transition-all duration-150 ease-out
        touch-manipulation
        min-h-[44px] min-w-[44px]
      `}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onClick={disabled ? undefined : onClick}
      style={{
        WebkitTapHighlightColor: 'transparent',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none'
      }}
    >
      {children}
    </div>
  );
}

// Enhanced swipe gesture hook with better sensitivity and multi-direction support
export function useAdvancedSwipeGesture(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  onSwipeUp?: () => void,
  onSwipeDown?: () => void,
  options: {
    threshold?: number;
    velocityThreshold?: number;
    preventScroll?: boolean;
    enableDiagonal?: boolean;
  } = {}
) {
  const {
    threshold = 50,
    velocityThreshold = 0.3,
    preventScroll = false,
    enableDiagonal = false
  } = options;

  const [touchStart, setTouchStart] = useState<{ x: number; y: number; time: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number; time: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
      time: Date.now()
    });
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (preventScroll && touchStart) {
      const currentX = e.targetTouches[0].clientX;
      const currentY = e.targetTouches[0].clientY;
      const distanceX = Math.abs(currentX - touchStart.x);
      const distanceY = Math.abs(currentY - touchStart.y);
      
      // Prevent scroll if there's significant horizontal movement
      if (distanceX > distanceY && distanceX > 10) {
        e.preventDefault();
      }
    }
    
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
      time: Date.now()
    });
  }, [touchStart, preventScroll]);

  const onTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return;

    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const timeDiff = touchEnd.time - touchStart.time;
    const velocity = Math.sqrt(distanceX * distanceX + distanceY * distanceY) / timeDiff;
    
    // Check if gesture meets velocity threshold
    if (velocity < velocityThreshold) return;
    
    const absDistanceX = Math.abs(distanceX);
    const absDistanceY = Math.abs(distanceY);
    
    const isLeftSwipe = distanceX > threshold;
    const isRightSwipe = distanceX < -threshold;
    const isUpSwipe = distanceY > threshold;
    const isDownSwipe = distanceY < -threshold;

    if (enableDiagonal) {
      // Allow diagonal swipes
      if (isLeftSwipe && onSwipeLeft) onSwipeLeft();
      if (isRightSwipe && onSwipeRight) onSwipeRight();
      if (isUpSwipe && onSwipeUp) onSwipeUp();
      if (isDownSwipe && onSwipeDown) onSwipeDown();
    } else {
      // Prioritize primary direction
      if (absDistanceX > absDistanceY) {
        if (isLeftSwipe && onSwipeLeft) onSwipeLeft();
        if (isRightSwipe && onSwipeRight) onSwipeRight();
      } else {
        if (isUpSwipe && onSwipeUp) onSwipeUp();
        if (isDownSwipe && onSwipeDown) onSwipeDown();
      }
    }
  }, [touchStart, touchEnd, threshold, velocityThreshold, enableDiagonal, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}

// Touch-optimized button component with proper touch targets
interface TouchButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  onLongPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  hapticFeedback?: boolean;
}

export function TouchButton({
  children,
  onClick,
  onLongPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  hapticFeedback = true
}: TouchButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-md transition-all duration-150 touch-manipulation focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    primary: 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-400 text-white shadow-sm hover:shadow-md',
    secondary: 'bg-white hover:bg-gray-50 focus:ring-gray-400 text-gray-700 border border-gray-300 hover:border-gray-400',
    ghost: 'bg-transparent hover:bg-gray-50 focus:ring-gray-400 text-gray-600 hover:text-gray-900'
  };
  
  const sizeClasses = {
    sm: 'min-h-[44px] px-3 py-2 text-sm',
    md: 'min-h-[44px] px-4 py-2 text-base',
    lg: 'min-h-[48px] px-6 py-3 text-lg'
  };

  return (
    <TouchCard
      onClick={onClick}
      onLongPress={onLongPress}
      disabled={disabled}
      hapticFeedback={hapticFeedback}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {children}
    </TouchCard>
  );
}