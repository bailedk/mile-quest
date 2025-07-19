'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface ProgressPulseProps {
  progress: number;
  className?: string;
  color?: string;
  pulseIntensity?: number;
  showPercentage?: boolean;
}

export function ProgressPulse({
  progress,
  className = '',
  color = 'rgb(var(--primary))',
  pulseIntensity = 1.1,
  showPercentage = true
}: ProgressPulseProps) {
  const isActive = progress > 0 && progress < 100;

  return (
    <div className={`relative ${className}`}>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        />
        {isActive && (
          <motion.div
            className="absolute top-0 h-full rounded-full"
            style={{ 
              backgroundColor: color,
              width: `${progress}%`,
              filter: 'brightness(1.2)'
            }}
            animate={{
              scale: [1, pulseIntensity, 1],
              opacity: [0.5, 0, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
      </div>
      {showPercentage && (
        <motion.span
          className="absolute -top-6 text-sm font-medium"
          style={{ left: `${progress}%` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {progress}%
        </motion.span>
      )}
    </div>
  );
}

interface CircularProgressProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
  children?: ReactNode;
  animate?: boolean;
}

export function CircularProgress({
  progress,
  size = 120,
  strokeWidth = 8,
  color = 'rgb(var(--primary))',
  backgroundColor = 'rgb(var(--secondary))',
  children,
  animate = true
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: animate ? 1 : 0, ease: 'easeInOut' }}
          style={{
            strokeDasharray: circumference,
          }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}

interface ActivityPulseProps {
  isActive: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
}

export function ActivityPulse({
  isActive,
  size = 'md',
  color = 'rgb(var(--success))',
  className = ''
}: ActivityPulseProps) {
  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4'
  };

  if (!isActive) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-full bg-muted ${className}`}
      />
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div
        className={`${sizeClasses[size]} rounded-full`}
        style={{ backgroundColor: color }}
      />
      <motion.div
        className={`absolute inset-0 ${sizeClasses[size]} rounded-full`}
        style={{ backgroundColor: color }}
        animate={{
          scale: [1, 1.8, 1],
          opacity: [0.7, 0, 0.7],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
}

interface HeartbeatProps {
  className?: string;
  color?: string;
  size?: number;
}

export function Heartbeat({
  className = '',
  color = 'rgb(var(--destructive))',
  size = 24
}: HeartbeatProps) {
  return (
    <motion.div
      className={`inline-block ${className}`}
      animate={{
        scale: [1, 1.1, 1, 1.3, 1],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={color}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </motion.div>
  );
}

interface StreamingProgressProps {
  isStreaming: boolean;
  className?: string;
  color?: string;
}

export function StreamingProgress({
  isStreaming,
  className = '',
  color = 'rgb(var(--primary))'
}: StreamingProgressProps) {
  if (!isStreaming) return null;

  return (
    <div className={`h-1 w-full overflow-hidden bg-secondary ${className}`}>
      <motion.div
        className="h-full w-1/3"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`
        }}
        animate={{
          x: ['-100%', '400%'],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    </div>
  );
}