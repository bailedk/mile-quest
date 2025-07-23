'use client';

import React, { Suspense, ComponentType } from 'react';

interface SuspenseBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function SuspenseBoundary({ children, fallback }: SuspenseBoundaryProps) {
  return (
    <Suspense fallback={fallback || <div className="animate-pulse">Loading...</div>}>
      {children}
    </Suspense>
  );
}

export function withSuspense<P extends object>(
  Component: ComponentType<P>,
  fallback?: React.ReactNode
) {
  return function WrappedComponent(props: P) {
    return (
      <SuspenseBoundary fallback={fallback}>
        <Component {...props} />
      </SuspenseBoundary>
    );
  };
}