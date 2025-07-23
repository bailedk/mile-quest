// Utility functions for responsive design and mobile optimization

// Common mobile breakpoints
export const BREAKPOINTS = {
  mobile: 0,
  mobileLarge: 375,
  tablet: 768,
  desktop: 1024,
  desktopLarge: 1280,
  desktopXL: 1536,
} as const;

// Touch target sizes (iOS/Android guidelines)
export const TOUCH_TARGETS = {
  minimum: 44, // iOS minimum
  recommended: 48, // Android minimum
  comfortable: 56, // Large touch targets
} as const;

// Viewport detection utilities
export function getViewportInfo() {
  if (typeof window === 'undefined') {
    return {
      width: 0,
      height: 0,
      isMobile: false,
      isTablet: false,
      isDesktop: false,
      orientation: 'landscape' as const,
      devicePixelRatio: 1,
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  
  return {
    width,
    height,
    isMobile: width < BREAKPOINTS.tablet,
    isTablet: width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop,
    isDesktop: width >= BREAKPOINTS.desktop,
    orientation: width > height ? 'landscape' : 'portrait' as const,
    devicePixelRatio: window.devicePixelRatio || 1,
  };
}

// React hook for responsive design
export function useResponsive() {
  const [viewportInfo, setViewportInfo] = React.useState(getViewportInfo);

  React.useEffect(() => {
    const handleResize = () => {
      setViewportInfo(getViewportInfo());
    };

    const handleOrientationChange = () => {
      // Add a small delay to ensure dimensions are updated after orientation change
      setTimeout(handleResize, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  return viewportInfo;
}

// Device and capability detection
// WARNING: This function can cause hydration mismatches if called during SSR
// Use the useDeviceCapabilities hook instead for React components
export function getDeviceCapabilities() {
  if (typeof window === 'undefined') {
    return {
      hasTouch: false,
      hasHover: false,
      hasPointerFine: false,
      hasVibration: false,
      hasDeviceMotion: false,
      hasDeviceOrientation: false,
      hasNotifications: false,
      hasServiceWorker: false,
      hasWebShare: false,
    };
  }

  return {
    hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    hasHover: window.matchMedia('(hover: hover)').matches,
    hasPointerFine: window.matchMedia('(pointer: fine)').matches,
    hasVibration: 'vibrate' in navigator,
    hasDeviceMotion: 'DeviceMotionEvent' in window,
    hasDeviceOrientation: 'DeviceOrientationEvent' in window,
    hasNotifications: 'Notification' in window,
    hasServiceWorker: 'serviceWorker' in navigator,
    hasWebShare: 'share' in navigator,
  };
}

// React hook for device capabilities with proper hydration handling
export function useDeviceCapabilities() {
  const [capabilities, setCapabilities] = React.useState({
    hasTouch: false,
    hasHover: false,
    hasPointerFine: false,
    hasVibration: false,
    hasDeviceMotion: false,
    hasDeviceOrientation: false,
    hasNotifications: false,
    hasServiceWorker: false,
    hasWebShare: false,
  });

  React.useEffect(() => {
    // Only check capabilities after hydration
    setCapabilities(getDeviceCapabilities());
  }, []);

  return capabilities;
}

// Safe area utilities for devices with notches
export function getSafeAreaInsets() {
  if (typeof window === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  const style = getComputedStyle(document.documentElement);
  
  return {
    top: parseInt(style.getPropertyValue('env(safe-area-inset-top)') || '0', 10),
    right: parseInt(style.getPropertyValue('env(safe-area-inset-right)') || '0', 10),
    bottom: parseInt(style.getPropertyValue('env(safe-area-inset-bottom)') || '0', 10),
    left: parseInt(style.getPropertyValue('env(safe-area-inset-left)') || '0', 10),
  };
}

// Touch optimization utilities
export function optimizeForTouch(element: HTMLElement) {
  // Apply touch-friendly styles
  element.style.touchAction = 'manipulation';
  element.style.webkitTapHighlightColor = 'transparent';
  element.style.webkitTouchCallout = 'none';
  element.style.webkitUserSelect = 'none';
  element.style.userSelect = 'none';
  
  // Ensure minimum touch target size
  const rect = element.getBoundingClientRect();
  if (rect.width < TOUCH_TARGETS.minimum || rect.height < TOUCH_TARGETS.minimum) {
    element.style.minWidth = `${TOUCH_TARGETS.minimum}px`;
    element.style.minHeight = `${TOUCH_TARGETS.minimum}px`;
  }
}

// Performance optimization for mobile
export function enableMobileOptimizations() {
  if (typeof document === 'undefined') return;

  // Disable iOS elastic bounce
  document.body.style.overscrollBehavior = 'none';
  
  // Optimize viewport for mobile
  let viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) {
    viewport = document.createElement('meta');
    viewport.setAttribute('name', 'viewport');
    document.head.appendChild(viewport);
  }
  
  viewport.setAttribute(
    'content',
    'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
  );
  
  // Add theme color for mobile browsers
  let themeColor = document.querySelector('meta[name="theme-color"]');
  if (!themeColor) {
    themeColor = document.createElement('meta');
    themeColor.setAttribute('name', 'theme-color');
    themeColor.setAttribute('content', '#2563EB');
    document.head.appendChild(themeColor);
  }
}

// Gesture conflict prevention
export function preventGestureConflicts(element: HTMLElement, gestureType: 'pan-x' | 'pan-y' | 'pinch-zoom' | 'manipulation') {
  switch (gestureType) {
    case 'pan-x':
      element.style.touchAction = 'pan-x';
      break;
    case 'pan-y':
      element.style.touchAction = 'pan-y';
      break;
    case 'pinch-zoom':
      element.style.touchAction = 'pinch-zoom';
      break;
    case 'manipulation':
    default:
      element.style.touchAction = 'manipulation';
      break;
  }
}

// Screen orientation utilities
export function getScreenOrientation() {
  if (typeof screen === 'undefined' || !screen.orientation) {
    return 'unknown';
  }
  
  return screen.orientation.type;
}

export function lockOrientation(orientation: 'portrait' | 'landscape') {
  if (typeof screen === 'undefined' || !screen.orientation || !screen.orientation.lock) {
    return Promise.reject(new Error('Screen Orientation API not supported'));
  }
  
  return screen.orientation.lock(orientation === 'portrait' ? 'portrait-primary' : 'landscape-primary');
}

// Accessibility helpers for touch interfaces
export function announceToScreenReader(message: string) {
  if (typeof document === 'undefined') return;

  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.style.position = 'absolute';
  announcement.style.left = '-10000px';
  announcement.style.width = '1px';
  announcement.style.height = '1px';
  announcement.style.overflow = 'hidden';
  
  document.body.appendChild(announcement);
  announcement.textContent = message;
  
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

// Haptic feedback patterns
export const HAPTIC_PATTERNS = {
  light: [5],
  medium: [10],
  heavy: [15, 10, 15],
  success: [10, 5, 10],
  warning: [15, 5, 15, 5, 15],
  error: [20, 10, 20, 10, 20],
  notification: [5, 10, 5],
} as const;

export function triggerHapticFeedback(pattern: keyof typeof HAPTIC_PATTERNS | number[]) {
  if (typeof navigator === 'undefined' || !navigator.vibrate) {
    return false;
  }
  
  const vibrationPattern = Array.isArray(pattern) ? pattern : HAPTIC_PATTERNS[pattern];
  return navigator.vibrate(vibrationPattern);
}

// React import for hooks
import React from 'react';