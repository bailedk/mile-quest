'use client';

import React, { createContext, useContext, useCallback, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { usePresence } from '@/hooks/usePresence';
import { useActivityFeed } from '@/hooks/useActivityFeed';
import { WebSocketConnectionState, WebSocketConnectionInfo } from '@/services/websocket';
import type { WebSocketMetrics } from '@/hooks/useWebSocket';
import type { TeamPresence } from '@/hooks/usePresence';
import type { ActivityFeedItem } from '@/hooks/useActivityFeed';

interface WebSocketContextValue {
  // Connection state
  isConnected: boolean;
  connectionState: WebSocketConnectionState;
  connectionInfo: WebSocketConnectionInfo;
  metrics: WebSocketMetrics;
  error: Error | null;
  
  // Connection controls
  connect: () => Promise<void>;
  disconnect: () => void;
  retry: () => Promise<void>;
  
  // Network state
  isOnline: boolean;
  wasOffline: boolean;
  
  // Presence features
  teamPresence: TeamPresence | null;
  isPresenceLoading: boolean;
  
  // Activity feed features
  activityFeed: ActivityFeedItem[];
  feedNewCount: number;
  isFeedLoading: boolean;
  clearActivityFeed: () => void;
  clearNewActivityFlags: () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

interface WebSocketProviderProps {
  children: React.ReactNode;
  currentTeamId?: string | null;
  enablePresence?: boolean;
  enableActivityFeed?: boolean;
  enableMetrics?: boolean;
}

export function WebSocketProvider({ 
  children, 
  currentTeamId = null,
  enablePresence = true,
  enableActivityFeed = true,
  enableMetrics = false
}: WebSocketProviderProps) {
  const { isOnline, wasOffline } = useOnlineStatus();
  const { 
    service, 
    isConnected, 
    connectionState, 
    connectionInfo,
    metrics,
    connect, 
    disconnect, 
    retry,
    error 
  } = useWebSocket({
    autoConnect: true,
    reconnectOnAuthChange: true,
    enableMetrics,
  });

  // Presence hook
  const {
    presence: teamPresence,
    isLoading: isPresenceLoading,
  } = usePresence(
    enablePresence ? currentTeamId : null,
    {
      enableLogging: process.env.NODE_ENV === 'development',
    }
  );

  // Activity feed hook
  const {
    activities: activityFeed,
    newCount: feedNewCount,
    isLoading: isFeedLoading,
    clearFeed: clearActivityFeed,
    clearNewFlags: clearNewActivityFlags,
  } = useActivityFeed(
    enableActivityFeed ? {
      feedTypes: ['teams'],
      maxItems: 50,
      enableLogging: process.env.NODE_ENV === 'development',
    } : { feedTypes: [] }
  );

  // Auto-reconnect when coming back online
  useEffect(() => {
    if (isOnline && wasOffline && !isConnected && !error) {
      console.log('Auto-reconnecting WebSocket after coming back online');
      connect().catch((err) => {
        console.error('Auto-reconnect failed:', err);
      });
    }
  }, [isOnline, wasOffline, isConnected, error, connect]);

  // Disconnect when going offline (to clean up resources)
  useEffect(() => {
    if (!isOnline && isConnected) {
      console.log('Disconnecting WebSocket due to offline state');
      disconnect();
    }
  }, [isOnline, isConnected, disconnect]);

  const contextValue: WebSocketContextValue = {
    // Connection state
    isConnected,
    connectionState,
    connectionInfo,
    metrics,
    error,
    
    // Connection controls
    connect,
    disconnect,
    retry,
    
    // Network state
    isOnline,
    wasOffline,
    
    // Presence features
    teamPresence,
    isPresenceLoading,
    
    // Activity feed features
    activityFeed,
    feedNewCount,
    isFeedLoading,
    clearActivityFeed,
    clearNewActivityFlags,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext(): WebSocketContextValue {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
}

// Hook for components that want to show WebSocket status
export function useWebSocketStatus() {
  const { 
    isConnected, 
    connectionState, 
    connectionInfo, 
    metrics, 
    error, 
    isOnline, 
    wasOffline,
    retry 
  } = useWebSocketContext();

  // Pre-calculate derived states to avoid reference issues
  const isReconnecting = connectionState === WebSocketConnectionState.RECONNECTING;
  const isFailed = connectionState === WebSocketConnectionState.FAILED;
  const hasError = !!error;
  const isOffline = !isOnline;

  return {
    // Basic state
    isConnected,
    connectionState,
    error,
    isOnline,
    wasOffline,
    
    // Extended state
    connectionInfo,
    metrics,
    
    // Actions
    retry,
    
    // Derived states
    isOffline,
    isReconnecting,
    isFailed,
    hasError,
    canRetry: !isConnected && !isReconnecting,
    
    // Connection quality indicators
    isStable: isConnected && metrics.reconnectAttempts < 3,
    hasFrequentReconnects: metrics.reconnectAttempts > 5,
    connectionQuality: getConnectionQuality(metrics, connectionInfo),
  };
}

// Helper function to determine connection quality
function getConnectionQuality(
  metrics: WebSocketMetrics, 
  connectionInfo: WebSocketConnectionInfo
): 'excellent' | 'good' | 'poor' | 'disconnected' {
  if (!connectionInfo.isOnline || connectionInfo.state !== WebSocketConnectionState.CONNECTED) {
    return 'disconnected';
  }
  
  if (metrics.reconnectAttempts === 0 && connectionInfo.latency && connectionInfo.latency < 100) {
    return 'excellent';
  }
  
  if (metrics.reconnectAttempts < 3 && (!connectionInfo.latency || connectionInfo.latency < 500)) {
    return 'good';
  }
  
  return 'poor';
}