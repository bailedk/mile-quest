export enum WebSocketConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed',
}

export interface WebSocketConnectionOptions {
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
  maxReconnectInterval?: number;
  reconnectBackoffMultiplier?: number;
}

export interface WebSocketMessage {
  event: string;
  data: any;
  channel?: string;
  timestamp?: number;
}

export interface WebSocketAuthHeaders {
  authorization?: string;
  [key: string]: string | undefined;
}

export interface WebSocketService {
  // Connection management
  connect(): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
  getConnectionState(): WebSocketConnectionState;
  
  // Channel subscription
  subscribe(channel: string, callback: (data: any) => void): () => void;
  unsubscribe(channel: string): void;
  
  // Events
  on(event: string, callback: (data: any) => void): () => void;
  off(event: string, callback?: (data: any) => void): void;
  
  // Connection state events
  onConnectionStateChange(callback: (state: WebSocketConnectionState) => void): () => void;
  onError(callback: (error: Error) => void): () => void;
  
  // Send messages (if supported)
  send?(channel: string, event: string, data: any): void;
  
  // Connection info
  getSocketId(): string | null;
}

export interface WebSocketConfig {
  key?: string;
  cluster?: string;
  authEndpoint?: string;
  auth?: {
    headers?: WebSocketAuthHeaders;
    params?: Record<string, string>;
  };
  connectionOptions?: WebSocketConnectionOptions;
}

export type WebSocketProvider = 'pusher' | 'mock' | 'websocket';

export interface WebSocketError {
  code: string;
  message: string;
  originalError?: any;
}