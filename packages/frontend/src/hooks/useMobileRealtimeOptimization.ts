import { useEffect, useCallback, useRef } from 'react';
import { WebSocketConnectionState } from '@/services/websocket';

interface MobileOptimizationOptions {
  connectionState: WebSocketConnectionState;
  isVisible?: boolean;
  batteryThreshold?: number; // 0-1, below this level optimizations kick in
  dataLimitsEnabled?: boolean;
  aggressivePowerSaving?: boolean;
}

interface BatteryInfo {
  level: number;
  charging: boolean;
  chargingTime?: number;
  dischargingTime?: number;
}

export function useMobileRealtimeOptimization({
  connectionState,
  isVisible = true,
  batteryThreshold = 0.2, // 20%
  dataLimitsEnabled = false,
  aggressivePowerSaving = false,
}: MobileOptimizationOptions) {
  const batteryInfoRef = useRef<BatteryInfo | null>(null);
  const networkInfoRef = useRef<any>(null);
  const visibilityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if we should optimize for battery
  const shouldOptimizeForBattery = useCallback(() => {
    if (!batteryInfoRef.current) return false;
    
    const { level, charging } = batteryInfoRef.current;
    
    if (charging) return false; // No need to optimize when charging
    if (aggressivePowerSaving) return true;
    
    return level < batteryThreshold;
  }, [batteryThreshold, aggressivePowerSaving]);

  // Check if we should optimize for data usage
  const shouldOptimizeForData = useCallback(() => {
    if (!dataLimitsEnabled) return false;
    if (!networkInfoRef.current) return false;
    
    const connection = networkInfoRef.current;
    
    // Optimize on slower connections or when data saver is enabled
    return (
      connection.saveData ||
      connection.effectiveType === 'slow-2g' ||
      connection.effectiveType === '2g'
    );
  }, [dataLimitsEnabled]);

  // Get recommended update frequency based on optimizations
  const getOptimizedUpdateFrequency = useCallback(() => {
    const baseFrequency = 1000; // 1 second for normal updates
    
    let multiplier = 1;
    
    // Battery optimizations
    if (shouldOptimizeForBattery()) {
      const battery = batteryInfoRef.current!;
      if (battery.level < 0.1) {
        multiplier *= 10; // Very low battery: 10 second updates
      } else if (battery.level < batteryThreshold) {
        multiplier *= 5; // Low battery: 5 second updates
      }
    }
    
    // Network optimizations
    if (shouldOptimizeForData()) {
      multiplier *= 3; // Slow network: 3x slower updates
    }
    
    // Visibility optimizations
    if (!isVisible) {
      multiplier *= 5; // Background: much slower updates
    }
    
    // Connection state optimizations
    if (connectionState === WebSocketConnectionState.RECONNECTING) {
      multiplier *= 2; // Reconnecting: slower updates
    } else if (connectionState === WebSocketConnectionState.FAILED) {
      multiplier *= 10; // Failed: very slow retry attempts
    }
    
    return Math.min(baseFrequency * multiplier, 60000); // Max 1 minute
  }, [shouldOptimizeForBattery, shouldOptimizeForData, isVisible, connectionState, batteryThreshold]);

  // Get recommended WebSocket heartbeat interval
  const getOptimizedHeartbeatInterval = useCallback(() => {
    const baseInterval = 30000; // 30 seconds default
    
    if (shouldOptimizeForBattery() || shouldOptimizeForData()) {
      return 60000; // 1 minute when optimizing
    }
    
    if (!isVisible) {
      return 120000; // 2 minutes when not visible
    }
    
    return baseInterval;
  }, [shouldOptimizeForBattery, shouldOptimizeForData, isVisible]);

  // Determine if real-time features should be paused
  const shouldPauseRealtime = useCallback(() => {
    // Pause if battery is critically low
    if (batteryInfoRef.current && batteryInfoRef.current.level < 0.05 && !batteryInfoRef.current.charging) {
      return true;
    }
    
    // Pause if connection has been failed for too long
    if (connectionState === WebSocketConnectionState.FAILED) {
      return true;
    }
    
    return false;
  }, [connectionState]);

  // Initialize battery and network monitoring
  useEffect(() => {
    const initializeMonitoring = async () => {
      // Battery API monitoring
      if ('getBattery' in navigator) {
        try {
          const battery = await (navigator as any).getBattery();
          
          const updateBatteryInfo = () => {
            batteryInfoRef.current = {
              level: battery.level,
              charging: battery.charging,
              chargingTime: battery.chargingTime,
              dischargingTime: battery.dischargingTime,
            };
          };
          
          updateBatteryInfo();
          
          battery.addEventListener('chargingchange', updateBatteryInfo);
          battery.addEventListener('levelchange', updateBatteryInfo);
          
          return () => {
            battery.removeEventListener('chargingchange', updateBatteryInfo);
            battery.removeEventListener('levelchange', updateBatteryInfo);
          };
        } catch (error) {
          console.warn('Battery API not available:', error);
        }
      }
      
      // Network API monitoring
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        networkInfoRef.current = connection;
        
        const updateNetworkInfo = () => {
          networkInfoRef.current = connection;
        };
        
        connection.addEventListener('change', updateNetworkInfo);
        
        return () => {
          connection.removeEventListener('change', updateNetworkInfo);
        };
      }
    };
    
    const cleanup = initializeMonitoring();
    
    return () => {
      cleanup?.then(cleanupFn => cleanupFn?.());
    };
  }, []);

  // Handle visibility changes for power optimization
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page hidden - start gradual optimization
        visibilityTimeoutRef.current = setTimeout(() => {
          // After 30 seconds hidden, enable more aggressive optimizations
        }, 30000);
      } else {
        // Page visible again - clear optimization timeout
        if (visibilityTimeoutRef.current) {
          clearTimeout(visibilityTimeoutRef.current);
          visibilityTimeoutRef.current = null;
        }
      }
    };
    
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        if (visibilityTimeoutRef.current) {
          clearTimeout(visibilityTimeoutRef.current);
        }
      };
    }
  }, []);

  return {
    // Optimization recommendations
    optimizedUpdateFrequency: getOptimizedUpdateFrequency(),
    optimizedHeartbeatInterval: getOptimizedHeartbeatInterval(),
    shouldPauseRealtime: shouldPauseRealtime(),
    
    // Current system status
    batteryInfo: batteryInfoRef.current,
    networkInfo: networkInfoRef.current,
    
    // Optimization flags
    shouldOptimizeForBattery: shouldOptimizeForBattery(),
    shouldOptimizeForData: shouldOptimizeForData(),
    
    // Helper methods
    isLowBattery: batteryInfoRef.current ? batteryInfoRef.current.level < batteryThreshold : false,
    isSlowNetwork: shouldOptimizeForData(),
    isOptimizationActive: shouldOptimizeForBattery() || shouldOptimizeForData() || !isVisible,
  };
}

// Hook for components to easily apply mobile optimizations
export function useOptimizedRealtime(
  hookConfig: any,
  optimizationOptions: Omit<MobileOptimizationOptions, 'connectionState'>
) {
  const optimization = useMobileRealtimeOptimization({
    ...optimizationOptions,
    connectionState: hookConfig.connectionState || WebSocketConnectionState.DISCONNECTED,
  });
  
  // Return modified hook config with optimizations applied
  return {
    ...hookConfig,
    refreshInterval: optimization.optimizedUpdateFrequency,
    enableLogging: !optimization.isOptimizationActive, // Disable logging when optimizing
    pauseUpdates: optimization.shouldPauseRealtime,
    optimization,
  };
}