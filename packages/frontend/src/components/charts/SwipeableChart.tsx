'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useAdvancedSwipeGesture } from '@/components/mobile/TouchInteractions';

interface SwipeableChartProps {
  children: React.ReactNode[];
  initialIndex?: number;
  showIndicators?: boolean;
  showArrows?: boolean;
  autoSwipe?: boolean;
  autoSwipeInterval?: number;
  onIndexChange?: (index: number) => void;
  className?: string;
}

export function SwipeableChart({
  children,
  initialIndex = 0,
  showIndicators = true,
  showArrows = false,
  autoSwipe = false,
  autoSwipeInterval = 5000,
  onIndexChange,
  className = ''
}: SwipeableChartProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoSwipeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const goToIndex = useCallback((index: number) => {
    if (index < 0 || index >= children.length || isTransitioning) return;
    
    setIsTransitioning(true);
    setCurrentIndex(index);
    onIndexChange?.(index);
    
    // Reset auto-swipe timer
    if (autoSwipe && autoSwipeTimeoutRef.current) {
      clearTimeout(autoSwipeTimeoutRef.current);
      autoSwipeTimeoutRef.current = setTimeout(() => {
        goToIndex((index + 1) % children.length);
      }, autoSwipeInterval);
    }
    
    setTimeout(() => setIsTransitioning(false), 300);
  }, [children.length, isTransitioning, onIndexChange, autoSwipe, autoSwipeInterval]);

  const goToNext = useCallback(() => {
    goToIndex((currentIndex + 1) % children.length);
  }, [currentIndex, children.length, goToIndex]);

  const goToPrevious = useCallback(() => {
    goToIndex(currentIndex === 0 ? children.length - 1 : currentIndex - 1);
  }, [currentIndex, children.length, goToIndex]);

  const swipeGestures = useAdvancedSwipeGesture(
    goToNext,     // Swipe left - next chart
    goToPrevious, // Swipe right - previous chart
    undefined,    // No up swipe
    undefined,    // No down swipe
    {
      threshold: 75,
      velocityThreshold: 0.5,
      preventScroll: true,
      enableDiagonal: false
    }
  );

  // Auto-swipe setup
  React.useEffect(() => {
    if (autoSwipe) {
      autoSwipeTimeoutRef.current = setTimeout(() => {
        goToNext();
      }, autoSwipeInterval);
    }
    
    return () => {
      if (autoSwipeTimeoutRef.current) {
        clearTimeout(autoSwipeTimeoutRef.current);
      }
    };
  }, [autoSwipe, autoSwipeInterval, goToNext]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (autoSwipeTimeoutRef.current) {
        clearTimeout(autoSwipeTimeoutRef.current);
      }
    };
  }, []);

  if (children.length === 0) return null;
  if (children.length === 1) return <div className={className}>{children[0]}</div>;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Chart Container */}
      <div
        ref={containerRef}
        className="relative h-full"
        {...swipeGestures}
      >
        <div
          className={`flex transition-transform duration-300 ease-out ${isTransitioning ? '' : 'touch-pan-y'}`}
          style={{
            transform: `translateX(-${currentIndex * 100}%)`,
            width: `${children.length * 100}%`
          }}
        >
          {children.map((child, index) => (
            <div
              key={index}
              className="flex-shrink-0 w-full"
              style={{ width: `${100 / children.length}%` }}
            >
              {child}
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Arrows */}
      {showArrows && children.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            disabled={isTransitioning}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white shadow-lg hover:bg-gray-50 disabled:opacity-50 transition-all duration-150 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Previous chart"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToNext}
            disabled={isTransitioning}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white shadow-lg hover:bg-gray-50 disabled:opacity-50 transition-all duration-150 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Next chart"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Indicators */}
      {showIndicators && children.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2 z-10">
          {children.map((_, index) => (
            <button
              key={index}
              onClick={() => goToIndex(index)}
              disabled={isTransitioning}
              className={`w-2 h-2 rounded-full transition-all duration-150 min-h-[44px] min-w-[44px] flex items-center justify-center ${
                currentIndex === index
                  ? 'bg-blue-600 scale-125'
                  : 'bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={`Go to chart ${index + 1}`}
            >
              <span className="sr-only">Chart {index + 1}</span>
              <div className={`w-2 h-2 rounded-full ${
                currentIndex === index ? 'bg-white' : 'bg-current'
              }`} />
            </button>
          ))}
        </div>
      )}

      {/* Swipe hint overlay (shows briefly on first load) */}
      <SwipeHint show={currentIndex === initialIndex} />
    </div>
  );
}

// Component to show swipe hint to users
function SwipeHint({ show }: { show: boolean }) {
  const [isVisible, setIsVisible] = useState(show);

  React.useEffect(() => {
    if (show) {
      const timer = setTimeout(() => setIsVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center z-20 pointer-events-none">
      <div className="bg-white rounded-lg p-4 shadow-lg max-w-xs mx-4 text-center">
        <div className="flex items-center justify-center mb-2">
          <svg className="w-6 h-6 text-blue-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
          </svg>
          <span className="mx-2 text-gray-400">or</span>
          <svg className="w-6 h-6 text-blue-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </div>
        <p className="text-sm text-gray-600">Swipe to navigate charts</p>
      </div>
    </div>
  );
}

// Hook for managing chart navigation state
export function useSwipeableChart(totalCharts: number, initialIndex = 0) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goToIndex = useCallback((index: number) => {
    if (index < 0 || index >= totalCharts || isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex(index);
    setTimeout(() => setIsTransitioning(false), 300);
  }, [totalCharts, isTransitioning]);

  const goToNext = useCallback(() => {
    goToIndex((currentIndex + 1) % totalCharts);
  }, [currentIndex, totalCharts, goToIndex]);

  const goToPrevious = useCallback(() => {
    goToIndex(currentIndex === 0 ? totalCharts - 1 : currentIndex - 1);
  }, [currentIndex, totalCharts, goToIndex]);

  return {
    currentIndex,
    isTransitioning,
    goToIndex,
    goToNext,
    goToPrevious,
    isFirst: currentIndex === 0,
    isLast: currentIndex === totalCharts - 1
  };
}