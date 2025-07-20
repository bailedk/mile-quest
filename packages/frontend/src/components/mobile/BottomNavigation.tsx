'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface BottomNavigationProps {
  items: NavItem[];
  className?: string;
}

export function BottomNavigation({ items, className = '' }: BottomNavigationProps) {
  const pathname = usePathname();

  return (
    <nav className={`
      fixed bottom-0 left-0 right-0 z-50 
      bg-white border-t border-gray-200 
      pb-safe 
      ${className}
    `}>
      <div className="flex items-center justify-around h-16 px-2">
        {items.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/' && pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                relative flex flex-col items-center justify-center
                min-w-0 flex-1 px-2 py-1
                text-xs font-medium
                transition-colors duration-200
                min-h-[44px] touch-manipulation
                ${isActive 
                  ? 'text-blue-500' 
                  : 'text-gray-500 hover:text-gray-700'
                }
              `}
            >
              <div className={`
                relative flex items-center justify-center
                w-6 h-6 mb-1
                ${isActive ? 'scale-110' : ''}
                transition-transform duration-200
              `}>
                {item.icon}
                {item.badge && item.badge > 0 && (
                  <div className="
                    absolute -top-1 -right-1
                    min-w-[16px] h-4 px-1
                    bg-red-500 text-white text-xs
                    rounded-full flex items-center justify-center
                    font-medium
                  ">
                    {item.badge > 99 ? '99+' : item.badge}
                  </div>
                )}
              </div>
              
              <span className={`
                truncate max-w-full
                ${isActive ? 'font-semibold' : ''}
              `}>
                {item.label}
              </span>
              
              {/* Active indicator */}
              {isActive && (
                <div className="
                  absolute bottom-0 left-1/2 transform -translate-x-1/2
                  w-1 h-1 bg-blue-500 rounded-full
                " />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// Default navigation items for authenticated users
export const defaultNavItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5v4M16 5v4" />
      </svg>
    ),
  },
  {
    href: '/teams',
    label: 'Teams',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    href: '/activities',
    label: 'Activities',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    href: '/activities/new',
    label: 'Add Walk',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

// Hook to manage bottom navigation visibility
export function useBottomNavigation() {
  const pathname = usePathname();
  
  // Hide bottom navigation on certain pages
  const hideOnPages = ['/signin', '/signup', '/onboarding'];
  const shouldHide = hideOnPages.some(page => pathname.startsWith(page));
  
  return {
    shouldShow: !shouldHide,
    currentPath: pathname,
  };
}