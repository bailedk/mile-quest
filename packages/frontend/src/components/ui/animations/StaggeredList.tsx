'use client';

import { motion } from 'framer-motion';
import { ReactNode, useEffect, useRef, useState } from 'react';

interface StaggeredListProps {
  children: ReactNode[];
  staggerDelay?: number;
  animationDelay?: number;
  className?: string;
  itemClassName?: string;
  variant?: 'fadeUp' | 'fadeIn' | 'slideIn' | 'scale';
}

const itemVariants = {
  fadeUp: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  },
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 }
  },
  slideIn: {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 }
  },
  scale: {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1 }
  }
};

export function StaggeredList({
  children,
  staggerDelay = 0.1,
  animationDelay = 0,
  className = '',
  itemClassName = '',
  variant = 'fadeUp'
}: StaggeredListProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: animationDelay
          }
        }
      }}
    >
      {children.map((child, index) => (
        <motion.div
          key={index}
          className={itemClassName}
          variants={itemVariants[variant]}
          transition={{
            duration: 0.5,
            ease: 'easeOut'
          }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

interface StaggeredGridProps {
  children: ReactNode[];
  columns?: number;
  staggerDelay?: number;
  className?: string;
  itemClassName?: string;
}

export function StaggeredGrid({
  children,
  columns = 3,
  staggerDelay = 0.05,
  className = '',
  itemClassName = ''
}: StaggeredGridProps) {
  return (
    <motion.div
      className={`grid grid-cols-${columns} gap-4 ${className}`}
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: staggerDelay
          }
        }
      }}
    >
      {children.map((child, index) => (
        <motion.div
          key={index}
          className={itemClassName}
          variants={{
            hidden: { opacity: 0, scale: 0.8 },
            visible: { opacity: 1, scale: 1 }
          }}
          transition={{
            duration: 0.4,
            ease: 'easeOut'
          }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

interface AnimatedListItemProps {
  children: ReactNode;
  index: number;
  isVisible?: boolean;
  className?: string;
}

export function AnimatedListItem({
  children,
  index,
  isVisible = true,
  className = ''
}: AnimatedListItemProps) {
  return (
    <motion.li
      className={className}
      initial={{ opacity: 0, x: -20 }}
      animate={{
        opacity: isVisible ? 1 : 0,
        x: isVisible ? 0 : -20
      }}
      exit={{ opacity: 0, x: 20 }}
      transition={{
        duration: 0.3,
        delay: index * 0.05,
        ease: 'easeOut'
      }}
    >
      {children}
    </motion.li>
  );
}

interface RevealOnScrollProps {
  children: ReactNode;
  className?: string;
  threshold?: number;
  once?: boolean;
  delay?: number;
}

export function RevealOnScroll({
  children,
  className = '',
  threshold = 0.1,
  once = true,
  delay = 0
}: RevealOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && (!hasAnimated || !once)) {
          setTimeout(() => {
            setIsVisible(true);
            setHasAnimated(true);
          }, delay * 1000);
        } else if (!entry.isIntersecting && !once) {
          setIsVisible(false);
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [threshold, once, hasAnimated, delay]);

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 50 }}
      animate={{
        opacity: isVisible ? 1 : 0,
        y: isVisible ? 0 : 50
      }}
      transition={{
        duration: 0.6,
        ease: 'easeOut'
      }}
    >
      {children}
    </motion.div>
  );
}

interface TypewriterTextProps {
  text: string;
  className?: string;
  speed?: number;
  delay?: number;
  cursor?: boolean;
}

export function TypewriterText({
  text,
  className = '',
  speed = 50,
  delay = 0,
  cursor = true
}: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsTyping(true);
      let index = 0;
      
      const interval = setInterval(() => {
        if (index < text.length) {
          setDisplayedText(text.slice(0, index + 1));
          index++;
        } else {
          setIsTyping(false);
          clearInterval(interval);
        }
      }, speed);

      return () => clearInterval(interval);
    }, delay * 1000);

    return () => clearTimeout(timeout);
  }, [text, speed, delay]);

  return (
    <span className={className}>
      {displayedText}
      {cursor && (
        <motion.span
          animate={{
            opacity: isTyping ? [1, 0] : 1
          }}
          transition={{
            duration: 0.8,
            repeat: isTyping ? Infinity : 0,
            ease: 'linear'
          }}
        >
          |
        </motion.span>
      )}
    </span>
  );
}