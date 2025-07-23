'use client';

interface DevOnlyWrapperProps {
  children: React.ReactNode;
}

// This component will be tree-shaken out in production builds
// No need for runtime NODE_ENV checks
const isDevelopment = process.env.NODE_ENV === 'development';

export function DevOnlyWrapper({ children }: DevOnlyWrapperProps) {
  // Return null immediately if not in development
  // This ensures consistent behavior between server and client
  if (!isDevelopment) {
    return null;
  }
  
  return <>{children}</>;
}