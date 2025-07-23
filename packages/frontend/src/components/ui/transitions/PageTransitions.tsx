'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '@/utils/hydration';

interface PageTransitionsProps {
  children: ReactNode;
  mode?: 'slide' | 'fade' | 'scale' | 'slideUp';
  preserveScroll?: boolean;
}

const variants = {
  slide: {
    initial: { x: 300, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -300, opacity: 0 }
  },
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  },
  scale: {
    initial: { scale: 0.9, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 1.1, opacity: 0 }
  },
  slideUp: {
    initial: { y: 50, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -50, opacity: 0 }
  }
};

const transition = {
  type: 'spring',
  stiffness: 260,
  damping: 20,
  duration: 0.3
};

export function PageTransitions({ 
  children, 
  mode = 'fade', 
  preserveScroll = true 
}: PageTransitionsProps) {
  const pathname = usePathname();
  const [scrollPositions, setScrollPositions] = useState<Record<string, number>>({});

  useEffect(() => {
    if (preserveScroll) {
      // Save scroll position before route change
      const handleBeforeUnload = () => {
        setScrollPositions(prev => ({
          ...prev,
          [pathname]: window.scrollY
        }));
      };

      // Restore scroll position after route change
      const savedPosition = scrollPositions[pathname];
      if (savedPosition !== undefined) {
        window.scrollTo(0, savedPosition);
      }

      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [pathname, preserveScroll, scrollPositions]);

  // Check for reduced motion preference using hydration-safe hook
  const prefersReducedMotion = usePrefersReducedMotion();

  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={variants[mode]}
        transition={transition}
        style={{ width: '100%' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// Loading state transition component
interface LoadingTransitionProps {
  isLoading: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}

export function LoadingTransition({ 
  isLoading, 
  children, 
  fallback 
}: LoadingTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {fallback || <LoadingSpinner />}
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Simple loading spinner component
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <motion.div
        className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}

// Route-specific transition wrapper
interface RouteTransitionProps {
  children: ReactNode;
  customVariants?: typeof variants.fade;
}

export function RouteTransition({ 
  children, 
  customVariants 
}: RouteTransitionProps) {
  const pathname = usePathname();
  
  // Different transitions for different route types
  const getTransitionMode = (): keyof typeof variants => {
    if (pathname.includes('/teams')) return 'slide';
    if (pathname.includes('/activities')) return 'slideUp';
    if (pathname.includes('/leaderboard')) return 'scale';
    return 'fade';
  };

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={customVariants || variants[getTransitionMode()]}
      transition={transition}
    >
      {children}
    </motion.div>
  );
}