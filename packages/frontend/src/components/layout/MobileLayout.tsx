'use client';

import React from 'react';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { BottomNavigation, defaultNavItems, useBottomNavigation } from '@/components/mobile/BottomNavigation';
import { useAuthStore } from '@/store/auth.store';

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
  const { isAuthenticated } = useAuthStore();
  const { shouldShow: shouldShowBottomNav } = useBottomNavigation();
  
  const showBottomNavigation = showBottomNav && shouldShowBottomNav && isAuthenticated;

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
        flex-1 overflow-auto momentum-scroll
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
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return { isMobile };
}