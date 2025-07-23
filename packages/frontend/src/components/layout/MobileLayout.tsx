'use client';

import React from 'react';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { BottomNavigation, defaultNavItems, useBottomNavigation } from '@/components/mobile/BottomNavigation';
import { useAuthStore } from '@/store/auth.store';
import { useHydrated } from '@/hooks/useHydrated';
import { useMediaQuery } from '@/utils/hydration';

interface MobileLayoutProps {
  children: React.ReactNode;
  title?: string;
  showHeader?: boolean;
  showBottomNav?: boolean;
  showBack?: boolean;
  headerActions?: React.ReactNode;
  className?: string;
}

export function MobileLayout({ 
  children, 
  title,
  showHeader = true,
  showBottomNav = true,
  showBack = false,
  headerActions,
  className = ''
}: MobileLayoutProps) {
  const hydrated = useHydrated();
  const { isAuthenticated } = useAuthStore();
  const { shouldShow: shouldShowBottomNav } = useBottomNavigation();
  
  // Only show bottom navigation after hydration to avoid mismatch
  const showBottomNavigation = hydrated && showBottomNav && shouldShowBottomNav && isAuthenticated;

  return (
    <div className={`mobile-viewport flex flex-col ${className}`}>
      {/* Mobile Header */}
      {showHeader && (
        <MobileHeader 
          title={title}
          showBack={showBack}
          actions={headerActions}
        />
      )}
      
      {/* Main Content */}
      <main className={`
        flex-1 overflow-auto momentum-scroll px-4
        ${showBottomNavigation ? 'pb-16' : ''}
        ${showHeader ? '' : 'pt-safe'}
      `}>
        {children}
      </main>
      
      {/* Bottom Navigation */}
      {showBottomNavigation && (
        <BottomNavigation items={defaultNavItems} />
      )}
    </div>
  );
}

// Hook to determine if we should use mobile layout
export function useMobileLayout() {
  // Use hydration-safe media query hook
  const isMobile = useMediaQuery('(max-width: 767px)');
  return { isMobile };
}