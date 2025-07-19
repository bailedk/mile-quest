'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';

interface MobileHeaderProps {
  title?: string;
  showBack?: boolean;
  showMenu?: boolean;
  actions?: React.ReactNode;
  className?: string;
}

export function MobileHeader({ 
  title, 
  showBack = false, 
  showMenu = true,
  actions,
  className = '' 
}: MobileHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();
  const { isAuthenticated, user, signOut } = useAuthStore();
  
  const handleSignOut = async () => {
    await signOut();
    setIsMenuOpen(false);
    router.push('/');
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <>
      <header className={`
        sticky top-0 z-40 
        bg-white border-b border-gray-200
        pt-safe
        ${className}
      `}>
        <div className="flex h-16 items-center justify-between px-4">
          {/* Left section */}
          <div className="flex items-center">
            {showBack ? (
              <button
                onClick={handleBack}
                className="
                  -ml-2 mr-2 p-2 
                  text-gray-600 hover:text-gray-900
                  rounded-lg hover:bg-gray-100
                  transition-colors duration-200
                  min-h-[44px] min-w-[44px]
                  touch-manipulation
                "
                aria-label="Go back"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            ) : (
              <Link href="/" className="flex items-center space-x-2">
                <span className="text-2xl" role="img" aria-label="Walking">🚶</span>
                <span className="text-xl font-semibold text-gray-900">
                  {title || 'Mile Quest'}
                </span>
              </Link>
            )}
            
            {showBack && title && (
              <h1 className="text-lg font-semibold text-gray-900 truncate">
                {title}
              </h1>
            )}
          </div>

          {/* Right section */}
          <div className="flex items-center space-x-2">
            {actions}
            
            {showMenu && isAuthenticated && (
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="
                  p-2 text-gray-600 hover:text-gray-900
                  rounded-lg hover:bg-gray-100
                  transition-colors duration-200
                  min-h-[44px] min-w-[44px]
                  touch-manipulation
                "
                aria-label="Open menu"
                aria-expanded={isMenuOpen}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {isMenuOpen && isAuthenticated && (
          <div className="border-t border-gray-200 bg-white">
            <div className="px-4 py-2 space-y-1">
              {/* User info */}
              <div className="flex items-center space-x-3 py-3 border-b border-gray-100">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-medium text-sm">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{user?.name}</p>
                  <p className="text-sm text-gray-500">{user?.email}</p>
                </div>
              </div>

              {/* Navigation links */}
              <Link 
                href="/dashboard" 
                className="
                  block px-3 py-3 text-base font-medium 
                  text-gray-700 hover:bg-gray-50 hover:text-blue-600
                  rounded-lg transition-colors
                  min-h-[44px] flex items-center
                "
                onClick={() => setIsMenuOpen(false)}
              >
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                </svg>
                Dashboard
              </Link>
              
              <Link 
                href="/teams" 
                className="
                  block px-3 py-3 text-base font-medium 
                  text-gray-700 hover:bg-gray-50 hover:text-blue-600
                  rounded-lg transition-colors
                  min-h-[44px] flex items-center
                "
                onClick={() => setIsMenuOpen(false)}
              >
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Teams
              </Link>
              
              <Link 
                href="/activities" 
                className="
                  block px-3 py-3 text-base font-medium 
                  text-gray-700 hover:bg-gray-50 hover:text-blue-600
                  rounded-lg transition-colors
                  min-h-[44px] flex items-center
                "
                onClick={() => setIsMenuOpen(false)}
              >
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Activities
              </Link>
              
              <Link 
                href="/profile" 
                className="
                  block px-3 py-3 text-base font-medium 
                  text-gray-700 hover:bg-gray-50 hover:text-blue-600
                  rounded-lg transition-colors
                  min-h-[44px] flex items-center
                "
                onClick={() => setIsMenuOpen(false)}
              >
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Profile
              </Link>

              {/* Sign out */}
              <button 
                onClick={handleSignOut}
                className="
                  w-full text-left px-3 py-3 text-base font-medium 
                  text-red-600 hover:bg-red-50
                  rounded-lg transition-colors
                  min-h-[44px] flex items-center
                "
              >
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Overlay to close menu when tapping outside */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black bg-opacity-25"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
    </>
  );
}