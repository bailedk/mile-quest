'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  color?: 'primary' | 'white' | 'gray' | 'success' | 'warning' | 'error' | 'muted';
  variant?: 'spinner' | 'dots' | 'bars' | 'pulse' | 'orbit' | 'wave';
  className?: string;
  label?: string;
  speed?: 'slow' | 'normal' | 'fast';
}

export function LoadingSpinner({ 
  size = 'md', 
  color = 'primary',
  variant = 'spinner',
  className = '',
  label = 'Loading',
  speed = 'normal'
}: LoadingSpinnerProps) {
  const sizeClasses = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
    '2xl': 'h-20 w-20'
  };

  const colorClasses = {
    primary: 'text-blue-600',
    white: 'text-white',
    gray: 'text-gray-400',
    muted: 'text-gray-300',
    success: 'text-green-600',
    warning: 'text-yellow-600',
    error: 'text-red-600'
  };

  const speedClasses = {
    slow: 'duration-2000',
    normal: 'duration-1000',
    fast: 'duration-500'
  };

  const baseClasses = `${sizeClasses[size]} ${colorClasses[color]} ${className}`;

  if (variant === 'dots') {
    return (
      <div className={`flex space-x-1 ${baseClasses}`} aria-label={label} role="status">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-current rounded-full"
            animate={{
              y: [0, -8, 0],
              opacity: [0.6, 1, 0.6]
            }}
            transition={{
              duration: speed === 'fast' ? 0.6 : speed === 'slow' ? 1.2 : 0.8,
              repeat: Infinity,
              delay: i * 0.1
            }}
          />
        ))}
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  if (variant === 'bars') {
    return (
      <div className={`flex space-x-1 ${baseClasses}`} aria-label={label} role="status">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="w-1 bg-current rounded-full"
            style={{ height: '100%' }}
            animate={{
              scaleY: [1, 2, 1],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{
              duration: speed === 'fast' ? 0.5 : speed === 'slow' ? 1.0 : 0.7,
              repeat: Infinity,
              delay: i * 0.1
            }}
          />
        ))}
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <motion.div
        className={`${baseClasses} bg-current rounded-full`}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.7, 1, 0.7]
        }}
        transition={{
          duration: speed === 'fast' ? 0.8 : speed === 'slow' ? 1.6 : 1.2,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
        aria-label={label}
        role="status"
      >
        <span className="sr-only">{label}</span>
      </motion.div>
    );
  }

  if (variant === 'orbit') {
    const orbitSize = size === 'xs' ? 16 : size === 'sm' ? 20 : size === 'md' ? 32 : size === 'lg' ? 48 : size === 'xl' ? 64 : 80;
    
    return (
      <div className={`relative ${baseClasses}`} aria-label={label} role="status">
        <motion.div
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{
            duration: speed === 'fast' ? 0.8 : speed === 'slow' ? 2.0 : 1.2,
            repeat: Infinity,
            ease: 'linear'
          }}
        >
          <div 
            className="absolute w-2 h-2 bg-current rounded-full top-0 left-1/2 transform -translate-x-1/2"
            style={{ width: orbitSize * 0.15, height: orbitSize * 0.15 }}
          />
          <div 
            className="absolute w-1 h-1 bg-current rounded-full opacity-60"
            style={{ 
              width: orbitSize * 0.1, 
              height: orbitSize * 0.1,
              top: '25%',
              right: '15%'
            }}
          />
        </motion.div>
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  if (variant === 'wave') {
    return (
      <div className={`flex items-end space-x-1 ${baseClasses}`} aria-label={label} role="status">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            className="w-1 bg-current rounded-full"
            style={{ height: size === 'xs' ? '8px' : size === 'sm' ? '12px' : size === 'md' ? '16px' : size === 'lg' ? '24px' : '32px' }}
            animate={{
              height: [
                size === 'xs' ? '4px' : size === 'sm' ? '6px' : size === 'md' ? '8px' : size === 'lg' ? '12px' : '16px',
                size === 'xs' ? '12px' : size === 'sm' ? '16px' : size === 'md' ? '24px' : size === 'lg' ? '36px' : '48px',
                size === 'xs' ? '4px' : size === 'sm' ? '6px' : size === 'md' ? '8px' : size === 'lg' ? '12px' : '16px'
              ]
            }}
            transition={{
              duration: speed === 'fast' ? 0.6 : speed === 'slow' ? 1.2 : 0.8,
              repeat: Infinity,
              delay: i * 0.1,
              ease: 'easeInOut'
            }}
          />
        ))}
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  // Default spinner variant
  return (
    <svg
      className={`animate-spin ${baseClasses} ${speedClasses[speed]}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-label={label}
      role="status"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
      <span className="sr-only">{label}</span>
    </svg>
  );
}

interface LoadingOverlayProps {
  message?: string;
  isVisible?: boolean;
  backdrop?: 'light' | 'dark' | 'blur' | 'none';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'spinner' | 'dots' | 'bars' | 'pulse';
  position?: 'fixed' | 'absolute';
}

export function LoadingOverlay({ 
  message = 'Loading...', 
  isVisible = true,
  backdrop = 'dark',
  className = '',
  size = 'lg',
  variant = 'spinner',
  position = 'fixed'
}: LoadingOverlayProps) {
  if (!isVisible) return null;

  const backdropClasses = {
    light: 'bg-white bg-opacity-75',
    dark: 'bg-gray-900 bg-opacity-50',
    blur: 'bg-white bg-opacity-75 backdrop-blur-sm',
    none: ''
  };

  const positionClasses = position === 'fixed' ? 'fixed inset-0' : 'absolute inset-0';

  return (
    <motion.div 
      className={`${positionClasses} ${backdropClasses[backdrop]} flex items-center justify-center z-50 ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div 
        className="bg-white rounded-lg p-6 flex flex-col items-center space-y-4 shadow-lg max-w-sm mx-4"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.2, delay: 0.1 }}
      >
        <LoadingSpinner size={size} variant={variant} />
        <p className="text-gray-700 font-medium text-center">{message}</p>
      </motion.div>
    </motion.div>
  );
}

interface InlineLoadingProps {
  size?: 'xs' | 'sm' | 'md';
  variant?: 'spinner' | 'dots' | 'pulse';
  className?: string;
  label?: string;
  text?: string;
  position?: 'left' | 'right' | 'top' | 'bottom';
}

export function InlineLoading({ 
  size = 'sm', 
  variant = 'spinner',
  className = '',
  label = 'Loading',
  text,
  position = 'left'
}: InlineLoadingProps) {
  const positionClasses = {
    left: 'flex-row',
    right: 'flex-row-reverse',
    top: 'flex-col',
    bottom: 'flex-col-reverse'
  };

  const spacingClasses = {
    left: 'mr-2',
    right: 'ml-2',
    top: 'mb-2',
    bottom: 'mt-2'
  };

  return (
    <span className={`inline-flex items-center ${positionClasses[position]} ${className}`}>
      <LoadingSpinner 
        size={size} 
        variant={variant}
        className={spacingClasses[position]} 
        label={label} 
      />
      {text && (
        <span className="text-sm text-gray-600">{text}</span>
      )}
      <span className="sr-only">{label}</span>
    </span>
  );
}

interface LoadingButtonProps {
  isLoading?: boolean;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  loadingText?: string;
  variant?: 'spinner' | 'dots';
  size?: 'xs' | 'sm' | 'md';
  onClick?: () => void;
}

export function LoadingButton({
  isLoading = false,
  children,
  className = '',
  disabled = false,
  loadingText = 'Loading...',
  variant = 'spinner',
  size = 'sm',
  onClick
}: LoadingButtonProps) {
  return (
    <button
      className={`relative inline-flex items-center justify-center ${className}`}
      disabled={disabled || isLoading}
      onClick={onClick}
    >
      <span className={`${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}>
        {children}
      </span>
      {isLoading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <InlineLoading
            size={size}
            variant={variant}
            text={loadingText}
            label="Processing"
          />
        </span>
      )}
    </button>
  );
}