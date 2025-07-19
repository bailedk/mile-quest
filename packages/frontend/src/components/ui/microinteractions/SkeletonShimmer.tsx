'use client';

import { motion } from 'framer-motion';
import { CSSProperties } from 'react';

interface SkeletonShimmerProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  variant?: 'default' | 'pulse' | 'wave';
}

export function SkeletonShimmer({
  className = '',
  width = '100%',
  height = '1rem',
  rounded = 'md',
  variant = 'default'
}: SkeletonShimmerProps) {
  const roundedClasses = {
    none: '',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full'
  };

  const baseClasses = `relative overflow-hidden bg-muted ${roundedClasses[rounded]} ${className}`;

  const style: CSSProperties = {
    width,
    height,
  };

  if (variant === 'pulse') {
    return (
      <motion.div
        className={baseClasses}
        style={style}
        animate={{
          opacity: [0.5, 1, 0.5]
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
      />
    );
  }

  if (variant === 'wave') {
    return (
      <div className={baseClasses} style={style}>
        <motion.div
          className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
          animate={{
            translateX: ['0%', '200%']
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'linear'
          }}
        />
      </div>
    );
  }

  // Default shimmer effect
  return (
    <div className={`${baseClasses} animate-shimmer`} style={style}>
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}

interface SkeletonTextProps {
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}

export function SkeletonText({
  lines = 3,
  className = '',
  lastLineWidth = '60%'
}: SkeletonTextProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonShimmer
          key={index}
          height="0.875rem"
          width={index === lines - 1 ? lastLineWidth : '100%'}
        />
      ))}
    </div>
  );
}

interface SkeletonCardProps {
  showImage?: boolean;
  showTitle?: boolean;
  showText?: boolean;
  className?: string;
}

export function SkeletonCard({
  showImage = true,
  showTitle = true,
  showText = true,
  className = ''
}: SkeletonCardProps) {
  return (
    <div className={`rounded-lg border bg-card p-4 ${className}`}>
      {showImage && (
        <SkeletonShimmer
          height="12rem"
          className="mb-4"
          rounded="lg"
        />
      )}
      {showTitle && (
        <SkeletonShimmer
          height="1.5rem"
          width="70%"
          className="mb-2"
        />
      )}
      {showText && (
        <SkeletonText lines={2} />
      )}
    </div>
  );
}

interface SkeletonAvatarProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function SkeletonAvatar({
  size = 'md',
  className = ''
}: SkeletonAvatarProps) {
  const sizes = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12'
  };

  return (
    <SkeletonShimmer
      className={`${sizes[size]} ${className}`}
      rounded="full"
    />
  );
}

interface SkeletonListProps {
  items?: number;
  className?: string;
  showAvatar?: boolean;
}

export function SkeletonList({
  items = 5,
  className = '',
  showAvatar = true
}: SkeletonListProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="flex items-center space-x-4">
          {showAvatar && <SkeletonAvatar />}
          <div className="flex-1 space-y-2">
            <SkeletonShimmer height="1rem" width="40%" />
            <SkeletonShimmer height="0.875rem" width="80%" />
          </div>
        </div>
      ))}
    </div>
  );
}