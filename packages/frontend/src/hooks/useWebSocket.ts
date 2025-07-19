import { useEffect, useRef, useState, useCallback } from 'react';
import { createWebSocketService, WebSocketService, WebSocketConnectionState, WebSocketConnectionInfo } from '@/services/websocket';
import { useAuth } from './useAuth';

interface UseWebSocketOptions {
  autoConnect?: boolean;
  reconnectOnAuthChange?: boolean;
  enableMetrics?: boolean;
  onConnectionChange?: (info: WebSocketConnectionInfo) => void;
  onError?: (error: Error) => void;
}

export interface WebSocketMetrics {
  connectionAttempts: number;
  reconnectAttempts: number;
  totalDowntime: number;
  lastConnectionTime: number | null;
  averageLatency: number | null;
}

interface UseWebSocketReturn {
  service: WebSocketService | null;
  isConnected: boolean;
  connectionState: WebSocketConnectionState;
  connect: () => Promise<void>;
  disconnect: () => void;
  error: Error | null;
  connectionInfo: WebSocketConnectionInfo;
  metrics: WebSocketMetrics;
  retry: () => Promise<void>;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const { 
    autoConnect = true, 
    reconnectOnAuthChange = true, 
    enableMetrics = false,
    onConnectionChange,
    onError 
  } = options;
  const { user, token } = useAuth();
  
  const [service, setService] = useState<WebSocketService | null>(null);
  const [connectionState, setConnectionState] = useState<WebSocketConnectionState>(
    WebSocketConnectionState.DISCONNECTED
  );
  const [error, setError] = useState<Error | null>(null);
  const [connectionInfo, setConnectionInfo] = useState<WebSocketConnectionInfo>({
    state: WebSocketConnectionState.DISCONNECTED,
    socketId: null,
    connectedAt: null,
    reconnectAttempts: 0,
    lastError: null,
    isOnline: navigator.onLine,
  });
  const [metrics, setMetrics] = useState<WebSocketMetrics>({
    connectionAttempts: 0,
    reconnectAttempts: 0,
    totalDowntime: 0,
    lastConnectionTime: null,
    averageLatency: null,
  });
  
  const serviceRef = useRef<WebSocketService | null>(null);
  const cleanupFunctions = useRef<(() => void)[]>([]);
  const disconnectedAtRef = useRef<number | null>(null);

  // Create WebSocket service
  const createService = useCallback(() => {
    try {
      const authHeaders: Record<string, string> = {};
      if (token) {
        authHeaders.authorization = `Bearer ${token}`;
      }

      const newService = createWebSocketService({
        auth: {
          headers: authHeaders,
        },
        connectionOptions: {
          autoReconnect: true,
          maxReconnectAttempts: 5,
          reconnectInterval: 1000,
          maxReconnectInterval: 30000,
          reconnectBackoffMultiplier: 1.5,
        },
      });

      // Set up event listeners
      const stateChangeCleanup = newService.onConnectionStateChange((state) => {
        const now = Date.now();
        setConnectionState(state);
        
        // Update connection info
        const newConnectionInfo: WebSocketConnectionInfo = {
          state,
          socketId: newService.getSocketId(),
          connectedAt: state === WebSocketConnectionState.CONNECTED ? now : connectionInfo.connectedAt,
          reconnectAttempts: state === WebSocketConnectionState.RECONNECTING 
            ? connectionInfo.reconnectAttempts + 1 
            : connectionInfo.reconnectAttempts,
          lastError: error,
          isOnline: navigator.onLine,
        };
        setConnectionInfo(newConnectionInfo);
        
        // Update metrics if enabled
        if (enableMetrics) {
          setMetrics(prev => {
            const updates: Partial<WebSocketMetrics> = {};
            
            if (state === WebSocketConnectionState.CONNECTED) {
              updates.lastConnectionTime = now;
              if (disconnectedAtRef.current) {
                updates.totalDowntime = prev.totalDowntime + (now - disconnectedAtRef.current);
                disconnectedAtRef.current = null;
              }
            } else if (state === WebSocketConnectionState.DISCONNECTED || state === WebSocketConnectionState.FAILED) {
              if (!disconnectedAtRef.current) {
                disconnectedAtRef.current = now;
              }
            }
            
            if (state === WebSocketConnectionState.RECONNECTING) {
              updates.reconnectAttempts = prev.reconnectAttempts + 1;
            }
            
            return { ...prev, ...updates };
          });
        }
        
        // Call connection change callback
        if (onConnectionChange) {
          onConnectionChange(newConnectionInfo);
        }
      });

      const errorCleanup = newService.onError((err) => {
        setError(err);
        console.error('WebSocket error:', err);
        
        // Update connection info with error
        setConnectionInfo(prev => ({
          ...prev,
          lastError: {
            code: 'connection_error',
            message: err.message,
            originalError: err,
          }
        }));
        
        // Call error callback
        if (onError) {
          onError(err);
        }
      });

      cleanupFunctions.current = [stateChangeCleanup, errorCleanup];
      serviceRef.current = newService;
      setService(newService);
      setError(null);

      return newService;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create WebSocket service');
      setError(error);
      console.error('Failed to create WebSocket service:', error);
      return null;
    }
  }, [token]);

  // Connect function
  const connect = useCallback(async () => {
    if (!serviceRef.current) {
      const newService = createService();
      if (!newService) return;
    }

    try {
      setError(null);
      
      // Update metrics
      if (enableMetrics) {
        setMetrics(prev => ({
          ...prev,
          connectionAttempts: prev.connectionAttempts + 1
        }));
      }
      
      await serviceRef.current!.connect();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Connection failed');
      setError(error);
      
      // Update connection info with error
      setConnectionInfo(prev => ({
        ...prev,
        lastError: {
          code: 'connection_failed',
          message: error.message,
          originalError: error,
        }
      }));
      
      throw error;
    }
  }, [createService, enableMetrics]);

  // Disconnect function
  const disconnect = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.disconnect();
    }
    
    // Clean up event listeners
    cleanupFunctions.current.forEach(cleanup => cleanup());
    cleanupFunctions.current = [];
  }, []);

  // Retry function - force reconnection
  const retry = useCallback(async () => {
    // Disconnect first if connected
    if (serviceRef.current) {
      disconnect();
    }
    
    // Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Attempt to reconnect
    return connect();
  }, [disconnect, connect]);

  // Initialize service on mount or when auth changes
  useEffect(() => {
    if (!user && reconnectOnAuthChange) {
      // User logged out, disconnect
      disconnect();
      return;
    }

    // Create new service when user logs in or auth changes
    const newService = createService();
    
    if (newService && autoConnect && user) {
      connect().catch((err) => {
        console.error('Auto-connect failed:', err);
      });
    }

    return () => {
      // Cleanup on unmount or dependency change
      disconnect();
    };
  }, [user, token, reconnectOnAuthChange, autoConnect, createService, connect, disconnect]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      if (serviceRef.current && user && autoConnect) {
        connect().catch((err) => {
          console.error('Reconnect on online failed:', err);
        });
      }
    };

    const handleOffline = () => {
      if (serviceRef.current) {
        disconnect();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, [user, autoConnect, connect, disconnect]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined') {
        if (document.visibilityState === 'visible' && serviceRef.current && user && autoConnect) {
          // Page became visible, ensure we're connected
          if (connectionState === WebSocketConnectionState.DISCONNECTED) {
            connect().catch((err) => {
              console.error('Reconnect on visibility change failed:', err);
            });
          }
        }
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [user, autoConnect, connectionState, connect]);

  return {
    service,
    isConnected: connectionState === WebSocketConnectionState.CONNECTED,
    connectionState,
    connect,
    disconnect,
    error,
    connectionInfo,
    metrics,
    retry,
  };
}