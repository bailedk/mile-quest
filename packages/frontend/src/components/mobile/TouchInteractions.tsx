'use client';

import React, { useRef, useState, useEffect } from 'react';

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

// Touch-friendly card component with haptic feedback simulation
interface TouchCardProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  pressEffect?: boolean;
}

export function TouchCard({ 
  children, 
  onClick, 
  className = '',
  pressEffect = true 
}: TouchCardProps) {
  const [isPressed, setIsPressed] = useState(false);

  const handleTouchStart = () => {
    if (pressEffect) {
      setIsPressed(true);
      // Simulate haptic feedback on supported devices
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
    }
  };

  const handleTouchEnd = () => {
    if (pressEffect) {
      setIsPressed(false);
    }
    if (onClick) {
      onClick();
    }
  };

  const handleTouchCancel = () => {
    if (pressEffect) {
      setIsPressed(false);
    }
  };

  return (
    <div
      className={`
        ${className}
        ${onClick ? 'cursor-pointer select-none' : ''}
        ${pressEffect && isPressed ? 'scale-95 opacity-90' : ''}
        transition-all duration-150 ease-out
        touch-manipulation
      `}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onClick={onClick}
    >
      {children}
    </div>
  );
}