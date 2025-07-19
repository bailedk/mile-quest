'use client';

import React, { createContext, useContext, useCallback, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { WebSocketConnectionState } from '@/services/websocket';

interface WebSocketContextValue {
  isConnected: boolean;
  connectionState: WebSocketConnectionState;
  error: Error | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  isOnline: boolean;
  wasOffline: boolean;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const { isOnline, wasOffline } = useOnlineStatus();
  const { 
    service, 
    isConnected, 
    connectionState, 
    connect, 
    disconnect, 
    error 
  } = useWebSocket({
    autoConnect: true,
    reconnectOnAuthChange: true,
  });

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
    isConnected,
    connectionState,
    error,
    connect,
    disconnect,
    isOnline,
    wasOffline,
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
  const { isConnected, connectionState, error, isOnline, wasOffline } = useWebSocketContext();

  return {
    isConnected,
    connectionState,
    error,
    isOnline,
    wasOffline,
    // Derived states
    isOffline: !isOnline,
    isReconnecting: connectionState === WebSocketConnectionState.RECONNECTING,
    isFailed: connectionState === WebSocketConnectionState.FAILED,
    hasError: !!error,
  };
}