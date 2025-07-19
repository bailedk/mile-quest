'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // TODO: Replace with actual auth state
  const isAuthenticated = false;
  
  return (
    <header className="bg-white border-b border-gray-200">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-2xl" role="img" aria-label="Walking">🚶</span>
              <span className="text-xl font-semibold text-gray-900">Mile Quest</span>
            </Link>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden sm:flex sm:items-center sm:space-x-8">
            {isAuthenticated ? (
              <>
                <Link href="/dashboard" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium">
                  Dashboard
                </Link>
                <Link href="/teams" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium">
                  Teams
                </Link>
                <Link href="/activities" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium">
                  Activities
                </Link>
                <Link href="/profile" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium">
                  Profile
                </Link>
                <button className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium">
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link href="/about" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium">
                  About
                </Link>
                <Link href="/signin" className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium">
                  Sign In
                </Link>
                <Link href="/signup" className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-md text-sm font-medium">
                  Get Started
                </Link>
              </>
            )}
          </div>
          
          {/* Mobile menu button */}
          <div className="flex sm:hidden">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-100"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-expanded={isMobileMenuOpen}
            >
              <span className="sr-only">Open main menu</span>
              {/* Hamburger icon */}
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
        
        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="sm:hidden">
            <div className="space-y-1 pb-3 pt-2">
              {isAuthenticated ? (
                <>
                  <Link href="/dashboard" className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600">
                    Dashboard
                  </Link>
                  <Link href="/teams" className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600">
                    Teams
                  </Link>
                  <Link href="/activities" className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600">
                    Activities
                  </Link>
                  <Link href="/profile" className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600">
                    Profile
                  </Link>
                  <button className="block w-full text-left px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600">
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/about" className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600">
                    About
                  </Link>
                  <Link href="/signin" className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600">
                    Sign In
                  </Link>
                  <Link href="/signup" className="block px-3 py-2 text-base font-medium text-white bg-blue-600 hover:bg-blue-700">
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}