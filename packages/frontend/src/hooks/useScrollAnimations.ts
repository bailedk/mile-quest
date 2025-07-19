'use client';

import { useEffect, useRef, useState, useCallback, MutableRefObject } from 'react';

interface ScrollAnimationOptions {
  threshold?: number | number[];
  rootMargin?: string;
  triggerOnce?: boolean;
  delay?: number;
}

interface ScrollAnimationResult {
  ref: MutableRefObject<any>;
  isVisible: boolean;
  hasAnimated: boolean;
}

/**
 * Hook for triggering animations when elements come into view
 */
export function useScrollAnimation({
  threshold = 0.1,
  rootMargin = '0px',
  triggerOnce = true,
  delay = 0
}: ScrollAnimationOptions = {}): ScrollAnimationResult {
  const ref = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const shouldAnimate = entry.isIntersecting && (!hasAnimated || !triggerOnce);
        
        if (shouldAnimate) {
          if (delay > 0) {
            setTimeout(() => {
              setIsVisible(true);
              setHasAnimated(true);
            }, delay);
          } else {
            setIsVisible(true);
            setHasAnimated(true);
          }
        } else if (!triggerOnce) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [threshold, rootMargin, triggerOnce, hasAnimated, delay]);

  return { ref, isVisible, hasAnimated };
}

interface ParallaxOptions {
  speed?: number;
  offset?: number;
  minValue?: number;
  maxValue?: number;
}

interface ParallaxResult {
  ref: MutableRefObject<any>;
  transform: string;
  progress: number;
}

/**
 * Hook for creating parallax scroll effects
 */
export function useParallax({
  speed = 0.5,
  offset = 0,
  minValue = -100,
  maxValue = 100
}: ParallaxOptions = {}): ParallaxResult {
  const ref = useRef<HTMLElement>(null);
  const [transform, setTransform] = useState('translateY(0px)');
  const [progress, setProgress] = useState(0);

  const handleScroll = useCallback(() => {
    if (!ref.current) return;

    const element = ref.current;
    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const elementHeight = rect.height;
    
    // Calculate element's position relative to viewport
    const elementTop = rect.top;
    const elementBottom = rect.bottom;
    
    // Element is in view
    if (elementBottom >= 0 && elementTop <= windowHeight) {
      // Calculate progress (0 to 1)
      const totalDistance = windowHeight + elementHeight;
      const traveled = windowHeight - elementTop;
      const progress = traveled / totalDistance;
      
      // Calculate parallax offset
      let yPos = -(progress * 100 - 50) * speed + offset;
      yPos = Math.max(minValue, Math.min(maxValue, yPos));
      
      setTransform(`translateY(${yPos}px)`);
      setProgress(progress);
    }
  }, [speed, offset, minValue, maxValue]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial calculation
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  return { ref, transform, progress };
}

interface ScrollProgressOptions {
  container?: HTMLElement | null;
  offset?: number;
}

/**
 * Hook for tracking scroll progress
 */
export function useScrollProgress({
  container = null,
  offset = 0
}: ScrollProgressOptions = {}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const element = container || document.documentElement;
    
    const handleScroll = () => {
      const scrollTop = element.scrollTop;
      const scrollHeight = element.scrollHeight - element.clientHeight;
      const scrollProgress = Math.min(Math.max((scrollTop - offset) / (scrollHeight - offset), 0), 1);
      
      setProgress(scrollProgress);
    };

    const scrollElement = container || window;
    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial calculation
    
    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
    };
  }, [container, offset]);

  return progress;
}

interface StickyHeaderOptions {
  threshold?: number;
  onSticky?: () => void;
  onUnsticky?: () => void;
}

/**
 * Hook for creating sticky header effects
 */
export function useStickyHeader({
  threshold = 100,
  onSticky,
  onUnsticky
}: StickyHeaderOptions = {}) {
  const [isSticky, setIsSticky] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrollY(currentScrollY);
      
      if (currentScrollY > threshold && !isSticky) {
        setIsSticky(true);
        onSticky?.();
      } else if (currentScrollY <= threshold && isSticky) {
        setIsSticky(false);
        onUnsticky?.();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [threshold, isSticky, onSticky, onUnsticky]);

  return { isSticky, scrollY };
}

interface ScrollDirectionOptions {
  threshold?: number;
  initialDirection?: 'up' | 'down';
}

/**
 * Hook for detecting scroll direction
 */
export function useScrollDirection({
  threshold = 5,
  initialDirection = 'up'
}: ScrollDirectionOptions = {}) {
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down'>(initialDirection);
  const [prevScrollY, setPrevScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (Math.abs(currentScrollY - prevScrollY) < threshold) {
        return;
      }
      
      if (currentScrollY > prevScrollY) {
        setScrollDirection('down');
      } else {
        setScrollDirection('up');
      }
      
      setPrevScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [prevScrollY, threshold]);

  return scrollDirection;
}

/**
 * Hook for creating fade-in animations on scroll
 */
export function useFadeInOnScroll(options?: ScrollAnimationOptions) {
  const { ref, isVisible } = useScrollAnimation(options);
  
  const style = {
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
    transition: 'opacity 0.6s ease, transform 0.6s ease'
  };
  
  return { ref, style, isVisible };
}

/**
 * Hook for creating scale-in animations on scroll
 */
export function useScaleInOnScroll(options?: ScrollAnimationOptions) {
  const { ref, isVisible } = useScrollAnimation(options);
  
  const style = {
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? 'scale(1)' : 'scale(0.9)',
    transition: 'opacity 0.6s ease, transform 0.6s ease'
  };
  
  return { ref, style, isVisible };
}

/**
 * Hook for creating slide-in animations on scroll
 */
export function useSlideInOnScroll(
  direction: 'left' | 'right' | 'up' | 'down' = 'up',
  options?: ScrollAnimationOptions
) {
  const { ref, isVisible } = useScrollAnimation(options);
  
  const getTransform = () => {
    if (isVisible) return 'translate(0, 0)';
    
    switch (direction) {
      case 'left':
        return 'translateX(-50px)';
      case 'right':
        return 'translateX(50px)';
      case 'up':
        return 'translateY(50px)';
      case 'down':
        return 'translateY(-50px)';
    }
  };
  
  const style = {
    opacity: isVisible ? 1 : 0,
    transform: getTransform(),
    transition: 'opacity 0.6s ease, transform 0.6s ease'
  };
  
  return { ref, style, isVisible };
}