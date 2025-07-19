import Pusher from 'pusher-js';
import { 
  WebSocketService, 
  WebSocketConfig, 
  WebSocketConnectionState,
  WebSocketConnectionOptions 
} from './types';

const DEFAULT_CONNECTION_OPTIONS: WebSocketConnectionOptions = {
  autoReconnect: true,
  maxReconnectAttempts: 5,
  reconnectInterval: 1000,
  maxReconnectInterval: 30000,
  reconnectBackoffMultiplier: 1.5,
};

export class PusherWebSocketService implements WebSocketService {
  private pusher: Pusher | null = null;
  private config: WebSocketConfig;
  private channels: Map<string, any> = new Map();
  private connectionState: WebSocketConnectionState = WebSocketConnectionState.DISCONNECTED;
  private connectionOptions: WebSocketConnectionOptions;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stateChangeCallbacks: ((state: WebSocketConnectionState) => void)[] = [];
  private errorCallbacks: ((error: Error) => void)[] = [];

  constructor(config: WebSocketConfig) {
    this.config = config;
    this.connectionOptions = { ...DEFAULT_CONNECTION_OPTIONS, ...config.connectionOptions };
  }

  async connect(): Promise<void> {
    if (this.pusher && this.connectionState === WebSocketConnectionState.CONNECTED) {
      return;
    }

    if (this.connectionState === WebSocketConnectionState.CONNECTING) {
      return this.waitForConnection();
    }

    this.setConnectionState(WebSocketConnectionState.CONNECTING);

    try {
      await this.initializePusher();
      this.reconnectAttempts = 0;
    } catch (error) {
      this.setConnectionState(WebSocketConnectionState.FAILED);
      this.handleConnectionError(error as Error);
      throw error;
    }
  }

  private async initializePusher(): Promise<void> {
    if (this.pusher) {
      this.pusher.disconnect();
    }

    // Get auth headers with current JWT token
    const authHeaders = await this.getAuthHeaders();

    this.pusher = new Pusher(this.config.key || '', {
      cluster: this.config.cluster,
      authEndpoint: this.config.authEndpoint,
      auth: {
        headers: authHeaders,
        ...this.config.auth,
      },
    });

    this.setupConnectionEventHandlers();

    return this.waitForConnection();
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    
    // Get JWT token from localStorage or auth store
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token) {
        headers.authorization = `Bearer ${token}`;
      }
    }

    // Merge with any additional auth headers
    if (this.config.auth?.headers) {
      Object.assign(headers, this.config.auth.headers);
    }

    return headers;
  }

  private setupConnectionEventHandlers(): void {
    if (!this.pusher) return;

    this.pusher.connection.bind('connected', () => {
      this.setConnectionState(WebSocketConnectionState.CONNECTED);
    });

    this.pusher.connection.bind('disconnected', () => {
      this.setConnectionState(WebSocketConnectionState.DISCONNECTED);
      this.handleDisconnection();
    });

    this.pusher.connection.bind('error', (error: any) => {
      this.handleConnectionError(new Error(error.message || 'Connection error'));
    });

    this.pusher.connection.bind('state_change', (states: any) => {
      // Handle Pusher-specific state changes
      if (states.current === 'unavailable' || states.current === 'failed') {
        this.setConnectionState(WebSocketConnectionState.FAILED);
      }
    });
  }

  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.pusher) {
        reject(new Error('Pusher not initialized'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      this.pusher.connection.bind('connected', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.pusher.connection.bind('error', (error: any) => {
        clearTimeout(timeout);
        reject(new Error(error.message || 'Connection failed'));
      });
    });
  }

  disconnect(): void {
    this.clearReconnectTimer();
    
    if (this.pusher) {
      this.pusher.disconnect();
      this.pusher = null;
      this.channels.clear();
    }
    
    this.setConnectionState(WebSocketConnectionState.DISCONNECTED);
  }

  isConnected(): boolean {
    return this.connectionState === WebSocketConnectionState.CONNECTED;
  }

  getConnectionState(): WebSocketConnectionState {
    return this.connectionState;
  }

  getSocketId(): string | null {
    return this.pusher?.connection.socket_id || null;
  }

  private setConnectionState(state: WebSocketConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.stateChangeCallbacks.forEach(callback => {
        try {
          callback(state);
        } catch (error) {
          console.error('Error in connection state callback:', error);
        }
      });
    }
  }

  private handleDisconnection(): void {
    if (this.connectionOptions.autoReconnect && 
        this.reconnectAttempts < (this.connectionOptions.maxReconnectAttempts || 5)) {
      this.scheduleReconnect();
    }
  }

  private handleConnectionError(error: Error): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (callbackError) {
        console.error('Error in error callback:', callbackError);
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.setConnectionState(WebSocketConnectionState.RECONNECTING);
    
    const baseInterval = this.connectionOptions.reconnectInterval || 1000;
    const maxInterval = this.connectionOptions.maxReconnectInterval || 30000;
    const multiplier = this.connectionOptions.reconnectBackoffMultiplier || 1.5;
    
    const interval = Math.min(
      baseInterval * Math.pow(multiplier, this.reconnectAttempts),
      maxInterval
    );

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      this.reconnectAttempts++;
      
      try {
        await this.connect();
      } catch (error) {
        console.error('Reconnection attempt failed:', error);
        // Will trigger another reconnect attempt if within limits
        this.handleDisconnection();
      }
    }, interval);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  subscribe(channelName: string, callback: (data: any) => void): () => void {
    if (!this.pusher) {
      throw new Error('WebSocket not connected');
    }

    let channel = this.channels.get(channelName);
    if (!channel) {
      channel = this.pusher.subscribe(channelName);
      this.channels.set(channelName, channel);
    }

    // Bind to all events on the channel
    channel.bind_global((eventName: string, data: any) => {
      callback({ event: eventName, data, timestamp: Date.now() });
    });

    // Return unsubscribe function
    return () => {
      channel.unbind_global();
    };
  }

  unsubscribe(channelName: string): void {
    if (!this.pusher) return;

    const channel = this.channels.get(channelName);
    if (channel) {
      this.pusher.unsubscribe(channelName);
      this.channels.delete(channelName);
    }
  }

  on(event: string, callback: (data: any) => void): () => void {
    if (!this.pusher) {
      throw new Error('WebSocket not connected');
    }

    this.pusher.bind(event, callback);

    return () => {
      this.pusher?.unbind(event, callback);
    };
  }

  off(event: string, callback?: (data: any) => void): void {
    if (!this.pusher) return;

    if (callback) {
      this.pusher.unbind(event, callback);
    } else {
      this.pusher.unbind(event);
    }
  }

  onConnectionStateChange(callback: (state: WebSocketConnectionState) => void): () => void {
    this.stateChangeCallbacks.push(callback);
    
    return () => {
      const index = this.stateChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.stateChangeCallbacks.splice(index, 1);
      }
    };
  }

  onError(callback: (error: Error) => void): () => void {
    this.errorCallbacks.push(callback);
    
    return () => {
      const index = this.errorCallbacks.indexOf(callback);
      if (index > -1) {
        this.errorCallbacks.splice(index, 1);
      }
    };
  }
}