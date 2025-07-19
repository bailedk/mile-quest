/**
 * Network-aware sync hook with adaptive behavior based on connection quality
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useOnlineStatus } from './useOnlineStatus';

interface NetworkInfo {
  type: 'wifi' | 'cellular' | 'ethernet' | 'none' | 'unknown';
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g' | 'unknown';
  downlink: number; // Mbps
  rtt: number; // Round-trip time in ms
  saveData: boolean;
}

interface UseNetworkAwareSyncReturn {
  networkInfo: NetworkInfo;
  isMetered: boolean;
  canSync: boolean;
  canDownloadLargeFiles: boolean;
  shouldReduceDataUsage: boolean;
  syncStrategy: 'aggressive' | 'normal' | 'conservative' | 'offline';
  adaptiveSyncInterval: number; // in milliseconds
  dataSaverMode: boolean;
  toggleDataSaverMode: () => void;
}

export function useNetworkAwareSync(): UseNetworkAwareSyncReturn {
  const { isOnline } = useOnlineStatus();
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>({
    type: 'unknown',
    effectiveType: 'unknown',
    downlink: 0,
    rtt: 0,
    saveData: false,
  });
  const [dataSaverMode, setDataSaverMode] = useState(false);
  const connectionRef = useRef<any>(null);

  useEffect(() => {
    // Load data saver preference
    const savedDataSaverMode = localStorage.getItem('dataSaverMode') === 'true';
    setDataSaverMode(savedDataSaverMode);

    if ('connection' in navigator || 'mozConnection' in navigator || 'webkitConnection' in navigator) {
      connectionRef.current = (navigator as any).connection || 
                             (navigator as any).mozConnection || 
                             (navigator as any).webkitConnection;

      const updateNetworkInfo = () => {
        if (!connectionRef.current) return;

        const connection = connectionRef.current;
        setNetworkInfo({
          type: connection.type || 'unknown',
          effectiveType: connection.effectiveType || 'unknown',
          downlink: connection.downlink || 0,
          rtt: connection.rtt || 0,
          saveData: connection.saveData || false,
        });
      };

      // Initial update
      updateNetworkInfo();

      // Listen for changes
      connectionRef.current.addEventListener('change', updateNetworkInfo);

      return () => {
        if (connectionRef.current) {
          connectionRef.current.removeEventListener('change', updateNetworkInfo);
        }
      };
    }
  }, []);

  const toggleDataSaverMode = useCallback(() => {
    const newMode = !dataSaverMode;
    setDataSaverMode(newMode);
    localStorage.setItem('dataSaverMode', newMode.toString());
  }, [dataSaverMode]);

  // Determine if connection is metered (cellular or potentially costly)
  const isMetered = networkInfo.type === 'cellular' || networkInfo.saveData;

  // Determine sync strategy based on network conditions
  const getSyncStrategy = (): 'aggressive' | 'normal' | 'conservative' | 'offline' => {
    if (!isOnline) return 'offline';
    if (dataSaverMode || networkInfo.saveData) return 'conservative';
    
    if (networkInfo.effectiveType === '4g' && networkInfo.rtt < 100) {
      return 'aggressive';
    } else if (networkInfo.effectiveType === '3g' || 
               (networkInfo.effectiveType === '4g' && networkInfo.rtt >= 100)) {
      return 'normal';
    } else {
      return 'conservative';
    }
  };

  const syncStrategy = getSyncStrategy();

  // Calculate adaptive sync interval based on network conditions
  const getAdaptiveSyncInterval = (): number => {
    const baseInterval = 5 * 60 * 1000; // 5 minutes base

    switch (syncStrategy) {
      case 'aggressive':
        return baseInterval; // 5 minutes
      case 'normal':
        return baseInterval * 2; // 10 minutes
      case 'conservative':
        return baseInterval * 6; // 30 minutes
      case 'offline':
      default:
        return Infinity; // No automatic sync
    }
  };

  // Determine if we can sync based on current conditions
  const canSync = isOnline && 
                  !dataSaverMode && 
                  (networkInfo.effectiveType !== 'slow-2g' && networkInfo.effectiveType !== '2g');

  // Determine if we can download large files (like images, maps)
  const canDownloadLargeFiles = isOnline && 
                                !isMetered && 
                                !dataSaverMode &&
                                networkInfo.effectiveType === '4g' &&
                                networkInfo.downlink > 1;

  // Should reduce data usage based on conditions
  const shouldReduceDataUsage = dataSaverMode || 
                               isMetered || 
                               networkInfo.saveData ||
                               networkInfo.effectiveType === '2g' ||
                               networkInfo.effectiveType === 'slow-2g';

  return {
    networkInfo,
    isMetered,
    canSync,
    canDownloadLargeFiles,
    shouldReduceDataUsage,
    syncStrategy,
    adaptiveSyncInterval: getAdaptiveSyncInterval(),
    dataSaverMode,
    toggleDataSaverMode,
  };
}

export default useNetworkAwareSync;