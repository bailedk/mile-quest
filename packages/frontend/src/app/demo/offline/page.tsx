'use client';

import React, { useState } from 'react';
import { OfflineTeamManager, AdvancedOfflineStatus } from '@/components/pwa';
import { useAdvancedOfflineSync } from '@/hooks/useAdvancedOfflineSync';
import { useNetworkAwareSync } from '@/hooks/useNetworkAwareSync';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { 
  WifiIcon, 
  CloudArrowDownIcon,
  CpuChipIcon,
  SignalIcon,
  BoltIcon,
  DatabaseIcon,
} from '@heroicons/react/24/outline';

export default function OfflineDemoPage() {
  const { isOnline } = useOnlineStatus();
  const {
    pendingActivities,
    failedActivities,
    conflictedActivities,
    syncStatus,
    lastSyncTime,
    storageUsage,
    syncNow,
    hasPendingSync,
    hasConflicts,
    canSync,
    logOfflineAnalytics,
  } = useAdvancedOfflineSync();

  const {
    networkInfo,
    isMetered,
    canDownloadLargeFiles,
    shouldReduceDataUsage,
    syncStrategy,
    adaptiveSyncInterval,
    dataSaverMode,
    toggleDataSaverMode,
  } = useNetworkAwareSync();

  const [analyticsLogged, setAnalyticsLogged] = useState(false);

  const handleLogAnalytics = async () => {
    await logOfflineAnalytics('demo_event', {
      page: 'offline-demo',
      timestamp: Date.now(),
      offline: !isOnline,
    });
    setAnalyticsLogged(true);
    setTimeout(() => setAnalyticsLogged(false), 2000);
  };

  const formatSyncInterval = (ms: number) => {
    if (ms === Infinity) return 'Never (offline)';
    const minutes = Math.floor(ms / 60000);
    return `${minutes} minutes`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">
          Advanced Offline Capabilities Demo
        </h1>

        {/* Network Status Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Network Status
              </h2>
              <WifiIcon className={`h-6 w-6 ${isOnline ? 'text-green-500' : 'text-red-500'}`} />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
                <span className={`text-sm font-medium ${isOnline ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Type</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {networkInfo.type}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Quality</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {networkInfo.effectiveType}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Downlink</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {networkInfo.downlink} Mbps
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">RTT</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {networkInfo.rtt} ms
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Sync Status
              </h2>
              <CloudArrowDownIcon className="h-6 w-6 text-blue-500" />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
                <span className={`text-sm font-medium ${
                  syncStatus === 'syncing' ? 'text-blue-600 dark:text-blue-400' :
                  syncStatus === 'success' ? 'text-green-600 dark:text-green-400' :
                  syncStatus === 'error' ? 'text-red-600 dark:text-red-400' :
                  'text-gray-600 dark:text-gray-400'
                }`}>
                  {syncStatus}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Pending</span>
                <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                  {pendingActivities.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Failed</span>
                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                  {failedActivities.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Conflicts</span>
                <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
                  {conflictedActivities.length}
                </span>
              </div>
              <button
                onClick={() => syncNow()}
                disabled={!canSync}
                className={`w-full mt-3 px-4 py-2 rounded-md text-sm font-medium ${
                  canSync
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                }`}
              >
                Sync Now
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Storage Usage
              </h2>
              <DatabaseIcon className="h-6 w-6 text-purple-500" />
            </div>
            
            <div className="space-y-2">
              {storageUsage && (
                <>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Used</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatBytes(storageUsage.used)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Quota</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatBytes(storageUsage.quota)}
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Usage</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {storageUsage.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full"
                        style={{ width: `${storageUsage.percentage}%` }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Network Aware Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Network-Aware Sync Settings
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  <SignalIcon className="h-4 w-4 inline mr-1" />
                  Sync Strategy
                </span>
                <span className={`text-sm font-medium px-2 py-1 rounded ${
                  syncStrategy === 'aggressive' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                  syncStrategy === 'normal' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' :
                  syncStrategy === 'conservative' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                  'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                }`}>
                  {syncStrategy}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  <BoltIcon className="h-4 w-4 inline mr-1" />
                  Sync Interval
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {formatSyncInterval(adaptiveSyncInterval)}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Metered Connection
                </span>
                <span className={`text-sm font-medium ${
                  isMetered ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'
                }`}>
                  {isMetered ? 'Yes' : 'No'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Can Download Large Files
                </span>
                <span className={`text-sm font-medium ${
                  canDownloadLargeFiles ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {canDownloadLargeFiles ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Data Saver Mode
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Reduce data usage and sync frequency
                  </p>
                </div>
                <button
                  onClick={toggleDataSaverMode}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                    dataSaverMode ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      dataSaverMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              
              <button
                onClick={handleLogAnalytics}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm font-medium"
              >
                {analyticsLogged ? 'Analytics Logged!' : 'Log Offline Analytics Event'}
              </button>
            </div>
          </div>
        </div>

        {/* Offline Team Manager */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Offline Team Management
          </h2>
          <OfflineTeamManager />
        </div>

        {/* Advanced Offline Status (shows at bottom) */}
        <AdvancedOfflineStatus />
      </div>
    </div>
  );
}