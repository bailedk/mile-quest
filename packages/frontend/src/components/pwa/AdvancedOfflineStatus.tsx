/**
 * Advanced offline status component with sync management and conflict resolution
 */

'use client';

import React, { useState } from 'react';
import { 
  CloudArrowDownIcon as CloudOffIcon, 
  ArrowPathIcon as RefreshIcon, 
  WifiIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  CircleStackIcon as DatabaseIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useAdvancedOfflineSync } from '@/hooks/useAdvancedOfflineSync';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export default function AdvancedOfflineStatus() {
  const { isOnline } = useOnlineStatus();
  const {
    pendingActivities,
    failedActivities,
    conflictedActivities,
    syncStatus,
    lastSyncTime,
    networkQuality,
    storageUsage,
    syncNow,
    resolveConflict,
    clearFailedActivities,
    retryFailedActivity,
    hasPendingSync,
    hasConflicts,
    canSync,
  } = useAdvancedOfflineSync();

  const [showDetails, setShowDetails] = useState(false);
  const [showConflicts, setShowConflicts] = useState(false);

  if (!hasPendingSync && !hasConflicts && isOnline && syncStatus === 'idle') {
    return null; // Don't show when everything is synced
  }

  const getNetworkIcon = () => {
    if (!isOnline) return <CloudOffIcon className="h-5 w-5 text-gray-500" />;
    
    switch (networkQuality) {
      case 'good':
        return <WifiIcon className="h-5 w-5 text-green-500" />;
      case 'fair':
        return <WifiIcon className="h-5 w-5 text-yellow-500" />;
      case 'poor':
        return <WifiIcon className="h-5 w-5 text-red-500" />;
      default:
        return <WifiIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getSyncStatusIcon = () => {
    switch (syncStatus) {
      case 'syncing':
        return <RefreshIcon className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <DatabaseIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const formatLastSyncTime = () => {
    if (!lastSyncTime) return 'Never';
    
    const now = Date.now();
    const diff = now - lastSyncTime;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const formatStorageUsage = () => {
    if (!storageUsage) return 'Unknown';
    
    const usedMB = (storageUsage.used / 1024 / 1024).toFixed(1);
    const quotaMB = (storageUsage.quota / 1024 / 1024).toFixed(0);
    
    return `${usedMB} / ${quotaMB} MB (${storageUsage.percentage.toFixed(1)}%)`;
  };

  return (
    <>
      {/* Main status bar */}
      <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 z-50">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {getNetworkIcon()}
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {isOnline ? 'Online' : 'Offline'}
                {isOnline && ` (${networkQuality} connection)`}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Last sync: {formatLastSyncTime()}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {getSyncStatusIcon()}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {showDetails ? 'Hide' : 'Details'}
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            {pendingActivities.length > 0 && (
              <span className="text-yellow-600 dark:text-yellow-400">
                {pendingActivities.length} pending
              </span>
            )}
            {failedActivities.length > 0 && (
              <span className="text-red-600 dark:text-red-400">
                {failedActivities.length} failed
              </span>
            )}
            {conflictedActivities.length > 0 && (
              <button
                onClick={() => setShowConflicts(!showConflicts)}
                className="text-orange-600 dark:text-orange-400 hover:underline"
              >
                {conflictedActivities.length} conflicts
              </button>
            )}
          </div>

          {canSync && hasPendingSync && (
            <button
              onClick={() => syncNow()}
              className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Sync Now
            </button>
          )}
        </div>

        {/* Details panel */}
        {showDetails && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
            {/* Storage usage */}
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Storage Usage</p>
              <div className="flex items-center justify-between">
                <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${storageUsage?.percentage || 0}%` }}
                  />
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {formatStorageUsage()}
                </span>
              </div>
            </div>

            {/* Failed activities */}
            {failedActivities.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Failed Activities
                  </p>
                  <button
                    onClick={clearFailedActivities}
                    className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Clear All
                  </button>
                </div>
                <div className="space-y-2">
                  {failedActivities.slice(0, 3).map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 p-2 rounded"
                    >
                      <div className="flex-1">
                        <p className="text-xs text-gray-700 dark:text-gray-300">
                          {activity.data.distance} miles • {new Date(activity.timestamp).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400">
                          {activity.syncAttempts} attempts
                        </p>
                      </div>
                      <button
                        onClick={() => retryFailedActivity(activity.id)}
                        className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Retry
                      </button>
                    </div>
                  ))}
                  {failedActivities.length > 3 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      +{failedActivities.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Conflicts modal */}
      {showConflicts && conflictedActivities.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Resolve Conflicts
                </h3>
                <button
                  onClick={() => setShowConflicts(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {conflictedActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="border border-orange-200 dark:border-orange-800 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <ExclamationTriangleIcon className="h-5 w-5 text-orange-500 inline mr-2" />
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        Activity Conflict
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Local Version</p>
                      <p className="text-gray-700 dark:text-gray-300">
                        {activity.data.distance} miles • {new Date(activity.timestamp).toLocaleDateString()}
                      </p>
                    </div>

                    {activity.conflictData && (
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Server Version</p>
                        <p className="text-gray-700 dark:text-gray-300">
                          {activity.conflictData.distance} miles • {new Date(activity.conflictData.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => {
                        resolveConflict(activity.id, 'local');
                        setShowConflicts(false);
                      }}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                    >
                      Keep Local
                    </button>
                    <button
                      onClick={() => {
                        resolveConflict(activity.id, 'remote');
                        setShowConflicts(false);
                      }}
                      className="flex-1 px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
                    >
                      Use Server
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}