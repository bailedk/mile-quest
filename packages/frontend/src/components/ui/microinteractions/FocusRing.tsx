'use client';

import { motion } from 'framer-motion';
import { ReactElement, ReactNode, cloneElement, useState } from 'react';

interface FocusRingProps {
  children: ReactElement;
  color?: string;
  width?: number;
  offset?: number;
  duration?: number;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
}

export function FocusRing({
  children,
  color = 'rgb(var(--primary))',
  width = 2,
  offset = 2,
  duration = 0.2,
  rounded = 'md'
}: FocusRingProps) {
  const [isFocused, setIsFocused] = useState(false);

  const roundedClasses = {
    none: '0',
    sm: '0.125rem',
    md: '0.375rem',
    lg: '0.5rem',
    full: '9999px'
  };

  const enhancedChild = cloneElement(children, {
    onFocus: (e: React.FocusEvent) => {
      setIsFocused(true);
      children.props.onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent) => {
      setIsFocused(false);
      children.props.onBlur?.(e);
    },
    className: `${children.props.className || ''} focus:outline-none relative`
  });

  return (
    <div className="relative inline-block">
      {enhancedChild}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: roundedClasses[rounded],
          boxShadow: `0 0 0 ${offset}px transparent, 0 0 0 ${offset + width}px ${color}`,
        }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{
          opacity: isFocused ? 1 : 0,
          scale: isFocused ? 1 : 0.95,
        }}
        transition={{ duration }}
      />
    </div>
  );
}

interface AnimatedFocusProps {
  children: ReactElement;
  variant?: 'ring' | 'glow' | 'border' | 'scale';
  color?: string;
}

export function AnimatedFocus({
  children,
  variant = 'ring',
  color = 'rgb(var(--primary))'
}: AnimatedFocusProps) {
  const [isFocused, setIsFocused] = useState(false);

  const enhancedChild = cloneElement(children, {
    onFocus: (e: React.FocusEvent) => {
      setIsFocused(true);
      children.props.onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent) => {
      setIsFocused(false);
      children.props.onBlur?.(e);
    },
    className: `${children.props.className || ''} focus:outline-none relative transition-all duration-200`
  });

  if (variant === 'glow') {
    return (
      <div className="relative inline-block">
        {enhancedChild}
        <motion.div
          className="pointer-events-none absolute -inset-1 rounded-lg opacity-0"
          style={{
            background: `radial-gradient(circle, ${color}40 0%, transparent 70%)`,
            filter: 'blur(8px)',
          }}
          animate={{
            opacity: isFocused ? 1 : 0,
          }}
          transition={{ duration: 0.3 }}
        />
      </div>
    );
  }

  if (variant === 'border') {
    return (
      <motion.div
        className="relative inline-block"
        animate={{
          borderColor: isFocused ? color : 'transparent',
        }}
        transition={{ duration: 0.2 }}
        style={{
          borderWidth: 2,
          borderRadius: '0.375rem',
          padding: 2,
        }}
      >
        {enhancedChild}
      </motion.div>
    );
  }

  if (variant === 'scale') {
    return (
      <motion.div
        className="relative inline-block"
        animate={{
          scale: isFocused ? 1.02 : 1,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        {enhancedChild}
      </motion.div>
    );
  }

  // Default ring variant
  return <FocusRing color={color}>{children}</FocusRing>;
}

interface FocusGroupProps {
  children: ReactElement[];
  highlightActive?: boolean;
}

export function FocusGroup({
  children,
  highlightActive = true
}: FocusGroupProps) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {children.map((child, index) => {
        const isActive = focusedIndex === index;
        const enhancedChild = cloneElement(child, {
          onFocus: (e: React.FocusEvent) => {
            setFocusedIndex(index);
            child.props.onFocus?.(e);
          },
          onBlur: (e: React.FocusEvent) => {
            setFocusedIndex(null);
            child.props.onBlur?.(e);
          },
          className: `${child.props.className || ''} transition-all duration-200`
        });

        return (
          <motion.div
            key={index}
            animate={{
              x: highlightActive && isActive ? 4 : 0,
              opacity: focusedIndex !== null && !isActive ? 0.7 : 1,
            }}
            transition={{ duration: 0.2 }}
          >
            <AnimatedFocus variant="ring">
              {enhancedChild}
            </AnimatedFocus>
          </motion.div>
        );
      })}
    </div>
  );
}

// Accessible skip link component
export function SkipLink({
  href = '#main',
  children = 'Skip to main content'
}: {
  href?: string;
  children?: ReactNode;
}) {
  return (
    <motion.a
      href={href}
      className="fixed left-4 top-4 z-50 rounded-md bg-background px-4 py-2 text-sm font-medium text-foreground shadow-lg focus:outline-none"
      initial={{ y: '-100%', opacity: 0 }}
      whileFocus={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.a>
  );
}