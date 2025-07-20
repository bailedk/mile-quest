'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';

// ============================================================================
// Voice Control Support
// ============================================================================

interface VoiceCommand {
  command: string;
  aliases?: string[];
  action: () => void;
  description: string;
}

export function useVoiceControl(commands: VoiceCommand[], enabled = true) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check if Speech Recognition is supported
    const SpeechRecognition = 
      (window as any).SpeechRecognition || 
      (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setIsSupported(true);
      
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
        
        // Find matching command
        const matchedCommand = commands.find(cmd => {
          const commandWords = cmd.command.toLowerCase();
          const aliases = cmd.aliases?.map(alias => alias.toLowerCase()) || [];
          return [commandWords, ...aliases].some(phrase => 
            transcript.includes(phrase)
          );
        });

        if (matchedCommand) {
          matchedCommand.action();
          // Provide audio feedback
          if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(`Executing ${matchedCommand.command}`);
            utterance.volume = 0.5;
            window.speechSynthesis.speak(utterance);
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [commands]);

  const startListening = useCallback(() => {
    if (enabled && isSupported && recognitionRef.current && !isListening) {
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [enabled, isSupported, isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  return {
    isSupported,
    isListening,
    startListening,
    stopListening
  };
}

// ============================================================================
// Screen Reader Optimizations
// ============================================================================

export function ScreenReaderAnnouncement({ message, priority = 'polite', delay = 0 }: {
  message: string;
  priority?: 'polite' | 'assertive';
  delay?: number;
}) {
  const [shouldAnnounce, setShouldAnnounce] = useState(false);

  useEffect(() => {
    if (delay > 0) {
      const timer = setTimeout(() => setShouldAnnounce(true), delay);
      return () => clearTimeout(timer);
    } else {
      setShouldAnnounce(true);
    }
  }, [delay]);

  if (!shouldAnnounce) return null;

  return (
    <div
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
      role={priority === 'assertive' ? 'alert' : 'status'}
    >
      {message}
    </div>
  );
}

export function useScreenReaderAnnouncements() {
  const [announcements, setAnnouncements] = useState<{
    id: string;
    message: string;
    priority: 'polite' | 'assertive';
  }[]>([]);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const id = Math.random().toString(36).substr(2, 9);
    const announcement = { id, message, priority };
    
    setAnnouncements(prev => [...prev, announcement]);
    
    // Remove announcement after it's been read
    setTimeout(() => {
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    }, 3000);
  }, []);

  const AnnouncementRegion = useCallback(() => (
    <div className="sr-only">
      {announcements.map(announcement => (
        <ScreenReaderAnnouncement
          key={announcement.id}
          message={announcement.message}
          priority={announcement.priority}
        />
      ))}
    </div>
  ), [announcements]);

  return { announce, AnnouncementRegion };
}

// ============================================================================
// Touch Target Enhancements
// ============================================================================

interface AccessibleTouchTargetProps {
  children: React.ReactNode;
  onTap?: () => void;
  onLongPress?: () => void;
  onDoubleTap?: () => void;
  minSize?: number;
  hapticFeedback?: boolean;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
  role?: string;
}

export function AccessibleTouchTarget({
  children,
  onTap,
  onLongPress,
  onDoubleTap,
  minSize = 44,
  hapticFeedback = true,
  className = '',
  disabled = false,
  ariaLabel,
  role = 'button'
}: AccessibleTouchTargetProps) {
  const [pressState, setPressState] = useState<'idle' | 'pressing' | 'long-press'>('idle');
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<number>(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' = 'medium') => {
    if (!hapticFeedback || disabled) return;
    
    if ('vibrate' in navigator) {
      const patterns = {
        light: [5],
        medium: [10],
        heavy: [15, 10, 15]
      };
      navigator.vibrate(patterns[type]);
    }
  }, [hapticFeedback, disabled]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    setPressState('pressing');
    triggerHaptic('light');

    if (onLongPress) {
      pressTimerRef.current = setTimeout(() => {
        setPressState('long-press');
        triggerHaptic('heavy');
        onLongPress();
      }, 500);
    }
  }, [disabled, onLongPress, triggerHaptic]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (disabled || !touchStartRef.current) return;

    const touch = e.changedTouches[0];
    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
    
    // Check if touch moved too much (likely a swipe)
    if (deltaX > 10 || deltaY > 10) {
      setPressState('idle');
      if (pressTimerRef.current) {
        clearTimeout(pressTimerRef.current);
        pressTimerRef.current = null;
      }
      return;
    }

    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }

    if (pressState === 'pressing') {
      const now = Date.now();
      const timeSinceLastTap = now - lastTapRef.current;
      
      if (timeSinceLastTap < 300 && onDoubleTap) {
        // Double tap
        triggerHaptic('heavy');
        onDoubleTap();
        lastTapRef.current = 0; // Reset to prevent triple tap
      } else if (onTap) {
        // Single tap
        triggerHaptic('medium');
        onTap();
        lastTapRef.current = now;
      }
    }

    setPressState('idle');
    touchStartRef.current = null;
  }, [disabled, pressState, onTap, onDoubleTap, triggerHaptic]);

  const handleTouchCancel = useCallback(() => {
    setPressState('idle');
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    touchStartRef.current = null;
  }, []);

  return (
    <div
      role={role}
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      className={`
        inline-flex items-center justify-center
        touch-manipulation select-none
        transition-all duration-150 ease-out
        ${pressState === 'pressing' ? 'scale-95 opacity-90' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      style={{
        minWidth: `${minSize}px`,
        minHeight: `${minSize}px`,
        WebkitTapHighlightColor: 'transparent',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none'
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onTap && !disabled) {
          e.preventDefault();
          onTap();
        }
      }}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Gesture Recognition
// ============================================================================

export function useAccessibleGestures() {
  const [gestureState, setGestureState] = useState<{
    isSwipeEnabled: boolean;
    isPinchEnabled: boolean;
    swipeThreshold: number;
    pinchThreshold: number;
  }>({
    isSwipeEnabled: true,
    isPinchEnabled: true,
    swipeThreshold: 50,
    pinchThreshold: 0.2
  });

  const createSwipeHandler = useCallback((
    onSwipeLeft?: () => void,
    onSwipeRight?: () => void,
    onSwipeUp?: () => void,
    onSwipeDown?: () => void
  ) => {
    let touchStart: { x: number; y: number } | null = null;

    return {
      onTouchStart: (e: React.TouchEvent) => {
        if (!gestureState.isSwipeEnabled) return;
        const touch = e.touches[0];
        touchStart = { x: touch.clientX, y: touch.clientY };
      },
      onTouchEnd: (e: React.TouchEvent) => {
        if (!gestureState.isSwipeEnabled || !touchStart) return;
        
        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - touchStart.x;
        const deltaY = touch.clientY - touchStart.y;
        
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        
        if (absX > gestureState.swipeThreshold || absY > gestureState.swipeThreshold) {
          if (absX > absY) {
            // Horizontal swipe
            if (deltaX > 0 && onSwipeRight) onSwipeRight();
            if (deltaX < 0 && onSwipeLeft) onSwipeLeft();
          } else {
            // Vertical swipe
            if (deltaY > 0 && onSwipeDown) onSwipeDown();
            if (deltaY < 0 && onSwipeUp) onSwipeUp();
          }
        }
        
        touchStart = null;
      }
    };
  }, [gestureState]);

  const createPinchHandler = useCallback((
    onPinchIn?: (scale: number) => void,
    onPinchOut?: (scale: number) => void
  ) => {
    let initialDistance: number | null = null;

    return {
      onTouchStart: (e: React.TouchEvent) => {
        if (!gestureState.isPinchEnabled || e.touches.length !== 2) return;
        
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        initialDistance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
      },
      onTouchMove: (e: React.TouchEvent) => {
        if (!gestureState.isPinchEnabled || e.touches.length !== 2 || !initialDistance) return;
        
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        
        const scale = currentDistance / initialDistance;
        
        if (scale < (1 - gestureState.pinchThreshold) && onPinchIn) {
          onPinchIn(scale);
        } else if (scale > (1 + gestureState.pinchThreshold) && onPinchOut) {
          onPinchOut(scale);
        }
      },
      onTouchEnd: () => {
        initialDistance = null;
      }
    };
  }, [gestureState]);

  return {
    gestureState,
    setGestureState,
    createSwipeHandler,
    createPinchHandler
  };
}

// ============================================================================
// Mobile Screen Reader Navigation
// ============================================================================

export function MobileScreenReaderNavigation({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentFocus, setCurrentFocus] = useState<number>(0);
  const [focusableElements, setFocusableElements] = useState<HTMLElement[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateFocusableElements = () => {
      const container = containerRef.current!;
      const elements = Array.from(container.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [role="button"]:not([aria-disabled="true"])'
      )) as HTMLElement[];
      
      setFocusableElements(elements);
    };

    updateFocusableElements();
    
    // Update when DOM changes
    const observer = new MutationObserver(updateFocusableElements);
    observer.observe(containerRef.current, { 
      childList: true, 
      subtree: true, 
      attributes: true,
      attributeFilter: ['disabled', 'tabindex', 'aria-disabled']
    });

    return () => observer.disconnect();
  }, []);

  const navigateToNext = useCallback(() => {
    if (focusableElements.length === 0) return;
    
    const nextIndex = (currentFocus + 1) % focusableElements.length;
    setCurrentFocus(nextIndex);
    focusableElements[nextIndex]?.focus();
    
    // Announce navigation
    const element = focusableElements[nextIndex];
    if (element) {
      const text = element.textContent || element.getAttribute('aria-label') || 'Interactive element';
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(`Focused on ${text}`);
        utterance.volume = 0.3;
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [currentFocus, focusableElements]);

  const navigateToPrevious = useCallback(() => {
    if (focusableElements.length === 0) return;
    
    const prevIndex = currentFocus === 0 ? focusableElements.length - 1 : currentFocus - 1;
    setCurrentFocus(prevIndex);
    focusableElements[prevIndex]?.focus();
    
    // Announce navigation
    const element = focusableElements[prevIndex];
    if (element) {
      const text = element.textContent || element.getAttribute('aria-label') || 'Interactive element';
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(`Focused on ${text}`);
        utterance.volume = 0.3;
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [currentFocus, focusableElements]);

  const activateCurrent = useCallback(() => {
    const element = focusableElements[currentFocus];
    if (element) {
      if (element.tagName === 'BUTTON' || element.getAttribute('role') === 'button') {
        element.click();
      } else if (element.tagName === 'A') {
        element.click();
      }
    }
  }, [currentFocus, focusableElements]);

  // Voice commands for navigation
  const voiceCommands: VoiceCommand[] = [
    {
      command: 'next element',
      aliases: ['next', 'forward'],
      action: navigateToNext,
      description: 'Navigate to next focusable element'
    },
    {
      command: 'previous element',
      aliases: ['previous', 'back'],
      action: navigateToPrevious,
      description: 'Navigate to previous focusable element'
    },
    {
      command: 'activate',
      aliases: ['click', 'select', 'choose'],
      action: activateCurrent,
      description: 'Activate current element'
    }
  ];

  useVoiceControl(voiceCommands);

  return (
    <div
      ref={containerRef}
      className="mobile-sr-navigation"
      role="application"
      aria-label="Mobile screen reader navigation enabled"
    >
      {children}
      
      {/* Mobile navigation hints */}
      <div className="sr-only">
        <p>
          Mobile screen reader navigation is active. 
          Swipe left or right to navigate between elements.
          Double tap to activate.
          Voice commands: "next", "previous", "activate".
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Mobile Accessibility Provider
// ============================================================================

interface MobileAccessibilityContextType {
  isVoiceControlEnabled: boolean;
  isHapticEnabled: boolean;
  isGestureNavigationEnabled: boolean;
  preferredInputMethod: 'touch' | 'voice' | 'switch';
  toggleVoiceControl: () => void;
  toggleHaptic: () => void;
  toggleGestureNavigation: () => void;
  setPreferredInputMethod: (method: 'touch' | 'voice' | 'switch') => void;
}

const MobileAccessibilityContext = React.createContext<MobileAccessibilityContextType>({
  isVoiceControlEnabled: false,
  isHapticEnabled: true,
  isGestureNavigationEnabled: true,
  preferredInputMethod: 'touch',
  toggleVoiceControl: () => {},
  toggleHaptic: () => {},
  toggleGestureNavigation: () => {},
  setPreferredInputMethod: () => {}
});

export function MobileAccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [isVoiceControlEnabled, setIsVoiceControlEnabled] = useState(false);
  const [isHapticEnabled, setIsHapticEnabled] = useState(true);
  const [isGestureNavigationEnabled, setIsGestureNavigationEnabled] = useState(true);
  const [preferredInputMethod, setPreferredInputMethod] = useState<'touch' | 'voice' | 'switch'>('touch');

  // Load preferences from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('mobile-accessibility-preferences');
      if (saved) {
        const prefs = JSON.parse(saved);
        setIsVoiceControlEnabled(prefs.isVoiceControlEnabled ?? false);
        setIsHapticEnabled(prefs.isHapticEnabled ?? true);
        setIsGestureNavigationEnabled(prefs.isGestureNavigationEnabled ?? true);
        setPreferredInputMethod(prefs.preferredInputMethod ?? 'touch');
      }
    } catch (error) {
      console.warn('Failed to load mobile accessibility preferences:', error);
    }
  }, []);

  // Save preferences to localStorage
  useEffect(() => {
    const prefs = {
      isVoiceControlEnabled,
      isHapticEnabled,
      isGestureNavigationEnabled,
      preferredInputMethod
    };
    
    try {
      localStorage.setItem('mobile-accessibility-preferences', JSON.stringify(prefs));
    } catch (error) {
      console.warn('Failed to save mobile accessibility preferences:', error);
    }
  }, [isVoiceControlEnabled, isHapticEnabled, isGestureNavigationEnabled, preferredInputMethod]);

  const toggleVoiceControl = useCallback(() => {
    setIsVoiceControlEnabled(prev => !prev);
  }, []);

  const toggleHaptic = useCallback(() => {
    setIsHapticEnabled(prev => !prev);
  }, []);

  const toggleGestureNavigation = useCallback(() => {
    setIsGestureNavigationEnabled(prev => !prev);
  }, []);

  return (
    <MobileAccessibilityContext.Provider value={{
      isVoiceControlEnabled,
      isHapticEnabled,
      isGestureNavigationEnabled,
      preferredInputMethod,
      toggleVoiceControl,
      toggleHaptic,
      toggleGestureNavigation,
      setPreferredInputMethod
    }}>
      {children}
    </MobileAccessibilityContext.Provider>
  );
}

export function useMobileAccessibility() {
  return React.useContext(MobileAccessibilityContext);
}