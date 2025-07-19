import React from 'react';
import Link from 'next/link';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-emerald-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">You're Offline</h1>
          <p className="text-gray-600">
            No internet connection detected, but Mile Quest still works offline!
          </p>
        </div>

        <div className="bg-emerald-50 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold text-emerald-800 mb-3">
            Available Offline Features:
          </h2>
          <ul className="text-left space-y-2 text-sm text-emerald-700">
            <li className="flex items-center">
              <svg className="w-4 h-4 mr-2 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              View cached activities and progress
            </li>
            <li className="flex items-center">
              <svg className="w-4 h-4 mr-2 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Log new activities (syncs when online)
            </li>
            <li className="flex items-center">
              <svg className="w-4 h-4 mr-2 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Check your personal statistics
            </li>
            <li className="flex items-center">
              <svg className="w-4 h-4 mr-2 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Browse team information
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <Link
            href="/dashboard"
            className="w-full bg-emerald-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-emerald-700 transition-colors duration-200 block"
          >
            Go to Dashboard
          </Link>
          
          <Link
            href="/activities/new"
            className="w-full bg-white text-emerald-600 py-3 px-4 rounded-lg font-medium border-2 border-emerald-600 hover:bg-emerald-50 transition-colors duration-200 block"
          >
            Log Activity
          </Link>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Your data will automatically sync when you're back online
          </p>
        </div>
      </div>
    </div>
  );
}