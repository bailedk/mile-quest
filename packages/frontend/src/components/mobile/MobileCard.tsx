/**
 * MobileCard - Combines TouchCard interactions with consistent Card styling
 * This component provides the best of both worlds:
 * - Touch interactions and haptic feedback from TouchCard
 * - Consistent visual styling from Card pattern
 */

'use client';

import React from 'react';
import { TouchCard } from './TouchInteractions';

interface MobileCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  onLongPress?: () => void;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'flat' | 'elevated';
  disabled?: boolean;
  hapticFeedback?: 'light' | 'medium' | 'heavy' | boolean;
}

export function MobileCard({
  children,
  className = '',
  onClick,
  onLongPress,
  padding = 'md',
  variant = 'default',
  disabled = false,
  hapticFeedback = true,
}: MobileCardProps) {
  // Base styling that matches Card pattern
  const baseClasses = 'bg-white rounded-lg';
  
  // Variant styles
  const variantClasses = {
    default: 'border border-gray-200 shadow-sm',
    flat: 'border border-gray-100',
    elevated: 'shadow-md',
  };

  // Padding classes matching Card pattern
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6', 
    lg: 'p-8',
  };

  return (
    <TouchCard
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${paddingClasses[padding]}
        ${className}
      `}
      onClick={onClick}
      onLongPress={onLongPress}
      disabled={disabled}
      hapticFeedback={hapticFeedback}
      pressEffect={true}
    >
      {children}
    </TouchCard>
  );
}

// Compact variant for stat cards
export function MobileStatCard({
  label,
  value,
  onClick,
  className = '',
}: {
  label: string;
  value: string | React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <MobileCard
      padding="sm"
      onClick={onClick}
      className={`text-center ${className}`}
    >
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <p className="text-xl font-semibold text-gray-900">{value}</p>
    </MobileCard>
  );
}