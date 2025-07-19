'use client';

import React from 'react';
import { useOfflineActivity } from '@/hooks/useOfflineActivity';

interface OfflineStatusProps {
  className?: string;
  compact?: boolean;
}

export function OfflineStatus({ className = '', compact = false }: OfflineStatusProps) {
  const {
    isOnline,
    offlineActivities,
    syncStatus,
    hasPendingActivities,
    hasFailedActivities,
    syncOfflineActivities,
    retryFailedActivities,
    clearOfflineActivities,
  } = useOfflineActivity();

  const pendingCount = offlineActivities.filter(a => a.status === 'pending').length;
  const failedCount = offlineActivities.filter(a => a.status === 'failed').length;
  const syncingCount = offlineActivities.filter(a => a.status === 'syncing').length;

  if (compact) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        {/* Connection indicator */}
        <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-yellow-500'}`} />
        
        {/* Status text */}
        <span className="text-sm text-gray-600">
          {isOnline ? 'Online' : 'Offline'}
          {hasPendingActivities && ` (${pendingCount} pending)`}
        </span>
        
        {/* Sync indicator */}
        {syncStatus === 'syncing' && (
          <svg className="animate-spin h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Sync Status</h3>
        
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-yellow-500'}`} />
          <span className="text-sm font-medium text-gray-700">
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>
      
      {/* Sync status indicators */}
      <div className="space-y-3">
        {/* Pending activities */}
        {pendingCount > 0 && (
          <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-yellow-200 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-yellow-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-yellow-800">
                  {pendingCount} activities waiting to sync
                </p>
                <p className="text-sm text-yellow-600">
                  Will sync automatically when online
                </p>
              </div>
            </div>
            
            {isOnline && (
              <button
                onClick={syncOfflineActivities}
                disabled={syncStatus === 'syncing'}
                className="bg-yellow-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-yellow-700 disabled:opacity-50"
              >
                {syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}
              </button>
            )}
          </div>
        )}
        
        {/* Syncing activities */}
        {syncingCount > 0 && (
          <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
            <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center">
              <svg className="animate-spin w-4 h-4 text-blue-700" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <div>
              <p className="font-medium text-blue-800">
                Syncing {syncingCount} activities...
              </p>
              <p className="text-sm text-blue-600">Please wait</p>
            </div>
          </div>
        )}
        
        {/* Failed activities */}
        {failedCount > 0 && (
          <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-red-200 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-red-800">
                  {failedCount} activities failed to sync
                </p>
                <p className="text-sm text-red-600">
                  Check your connection and try again
                </p>
              </div>
            </div>
            
            <button
              onClick={retryFailedActivities}
              disabled={!isOnline || syncStatus === 'syncing'}
              className="bg-red-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              Retry
            </button>
          </div>
        )}
        
        {/* Success state */}
        {syncStatus === 'success' && (
          <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
            <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-green-800">All activities synced</p>
              <p className="text-sm text-green-600">Your data is up to date</p>
            </div>
          </div>
        )}
        
        {/* All synced state */}
        {!hasPendingActivities && !hasFailedActivities && syncStatus === 'idle' && isOnline && (
          <div className="text-center py-6 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="font-medium">Everything is synced</p>
            <p className="text-sm">All your activities are up to date</p>
          </div>
        )}
        
        {/* Offline state */}
        {!isOnline && !hasPendingActivities && !hasFailedActivities && (
          <div className="text-center py-6 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
            <p className="font-medium">You're offline</p>
            <p className="text-sm">Activities will sync when you're back online</p>
          </div>
        )}
      </div>
      
      {/* Actions */}
      {(hasPendingActivities || hasFailedActivities) && (
        <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={clearOfflineActivities}
            className="text-gray-500 text-sm font-medium hover:text-gray-700"
          >
            Clear All
          </button>
          
          {isOnline && (
            <button
              onClick={syncOfflineActivities}
              disabled={syncStatus === 'syncing'}
              className="bg-emerald-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {syncStatus === 'syncing' ? 'Syncing...' : 'Sync All'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default OfflineStatus;