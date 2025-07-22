'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { AriaBanner, AriaNavigation, SkipLinks } from '@/components/accessibility/AriaComponents';
import { FocusTrap, useKeyboardNavigation } from '@/components/accessibility/KeyboardNavigation';
import { AccessibleTouchTarget } from '@/components/accessibility/MobileAccessibility';
import { useHydrated } from '@/hooks/useHydrated';

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const { isAuthenticated, user, signOut } = useAuthStore();
  const { isKeyboardUser } = useKeyboardNavigation();
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();
  
  // Use non-authenticated state during SSR and initial hydration to prevent mismatch
  const showAuthenticatedNav = hydrated && isAuthenticated;
  
  const handleSignOut = async () => {
    try {
      await signOut();
      // Use replace instead of push to prevent back navigation
      router.replace('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleMobileMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  // Close mobile menu on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        handleMobileMenuClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isMobileMenuOpen]);
  
  return (
    <>
      <SkipLinks />
      <AriaBanner className="bg-white border-b border-gray-200" label="Site header">
        <AriaNavigation 
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
          label="Main navigation"
        >
          <div className="flex h-16 justify-between items-center">
            {/* Logo */}
            <div className="flex items-center">
              <Link 
                href="/" 
                className="flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md p-1"
                aria-label="Mile Quest home page"
              >
                <span className="text-2xl" role="img" aria-label="Walking person">🚶</span>
                <span className="text-xl font-semibold text-gray-900">Mile Quest</span>
              </Link>
            </div>
          
            {/* Desktop Navigation */}
            <div className="hidden sm:flex sm:items-center sm:space-x-8" role="list">
              {showAuthenticatedNav ? (
                <>
                  <Link 
                    href="/dashboard" 
                    className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md transition-colors"
                    role="listitem"
                  >
                    Dashboard
                  </Link>
                  <Link 
                    href="/teams" 
                    className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md transition-colors"
                    role="listitem"
                  >
                    Teams
                  </Link>
                  <Link 
                    href="/activities" 
                    className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md transition-colors"
                    role="listitem"
                  >
                    Activities
                  </Link>
                  <Link 
                    href="/profile" 
                    className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md transition-colors"
                    role="listitem"
                  >
                    Profile
                  </Link>
                  <button 
                    onClick={handleSignOut}
                    className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md transition-colors min-h-[44px]"
                    aria-label="Sign out of your account"
                    role="listitem"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link 
                    href="/about" 
                    className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md transition-colors"
                    role="listitem"
                  >
                    About
                  </Link>
                  <Link 
                    href="/signin" 
                    className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md transition-colors"
                    role="listitem"
                  >
                    Sign In
                  </Link>
                  <Link 
                    href="/signup" 
                    className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors min-h-[44px] inline-flex items-center"
                    role="listitem"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
            
            {/* Mobile menu button */}
            <div className="flex sm:hidden">
              <AccessibleTouchTarget
                onTap={handleMobileMenuToggle}
                minSize={44}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                ariaLabel={isMobileMenuOpen ? "Close main menu" : "Open main menu"}
                role="button"
              >
                <span className="sr-only">{isMobileMenuOpen ? "Close main menu" : "Open main menu"}</span>
                {/* Hamburger icon */}
                <svg 
                  className="h-6 w-6" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  {isMobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </AccessibleTouchTarget>
            </div>
        </div>
        
        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <FocusTrap
            enabled={isMobileMenuOpen}
            onEscape={handleMobileMenuClose}
            className="sm:hidden"
          >
            <div 
              ref={mobileMenuRef}
              className="space-y-1 pb-3 pt-2"
              role="menu"
              aria-label="Mobile navigation menu"
              aria-expanded={isMobileMenuOpen}
            >
              {showAuthenticatedNav ? (
                <>
                  <Link 
                    href="/dashboard" 
                    className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-colors min-h-[48px] flex items-center"
                    role="menuitem"
                    onClick={handleMobileMenuClose}
                  >
                    Dashboard
                  </Link>
                  <Link 
                    href="/teams" 
                    className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-colors min-h-[48px] flex items-center"
                    role="menuitem"
                    onClick={handleMobileMenuClose}
                  >
                    Teams
                  </Link>
                  <Link 
                    href="/activities" 
                    className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-colors min-h-[48px] flex items-center"
                    role="menuitem"
                    onClick={handleMobileMenuClose}
                  >
                    Activities
                  </Link>
                  <Link 
                    href="/profile" 
                    className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-colors min-h-[48px] flex items-center"
                    role="menuitem"
                    onClick={handleMobileMenuClose}
                  >
                    Profile
                  </Link>
                  <button 
                    onClick={() => {
                      handleSignOut();
                      handleMobileMenuClose();
                    }}
                    className="block w-full text-left px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-colors min-h-[48px] flex items-center"
                    aria-label="Sign out of your account"
                    role="menuitem"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link 
                    href="/about" 
                    className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-colors min-h-[48px] flex items-center"
                    role="menuitem"
                    onClick={handleMobileMenuClose}
                  >
                    About
                  </Link>
                  <Link 
                    href="/signin" 
                    className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-colors min-h-[48px] flex items-center"
                    role="menuitem"
                    onClick={handleMobileMenuClose}
                  >
                    Sign In
                  </Link>
                  <Link 
                    href="/signup" 
                    className="block px-3 py-2 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-colors min-h-[48px] flex items-center rounded-md mx-3"
                    role="menuitem"
                    onClick={handleMobileMenuClose}
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </FocusTrap>
        )}
        </AriaNavigation>
      </AriaBanner>
    </>
  );
}