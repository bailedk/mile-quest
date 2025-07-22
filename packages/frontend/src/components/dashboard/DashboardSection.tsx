/**
 * DashboardSection - A wrapper component for dashboard sections
 * Provides consistent spacing between dashboard sections
 */

'use client';

import React from 'react';

interface DashboardSectionProps {
  children: React.ReactNode;
  className?: string;
  spacing?: 'sm' | 'md' | 'lg';
}

export function DashboardSection({
  children,
  className = '',
  spacing = 'md',
}: DashboardSectionProps) {
  const spacingClasses = {
    sm: 'mb-4',
    md: 'mb-6',
    lg: 'mb-8',
  };

  return (
    <div className={`${spacingClasses[spacing]} ${className}`}>
      {children}
    </div>
  );
}