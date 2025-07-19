export interface WebSocketService {
  // Connection management
  connect(): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
  
  // Channel subscription
  subscribe(channel: string, callback: (data: any) => void): () => void;
  unsubscribe(channel: string): void;
  
  // Events
  on(event: string, callback: (data: any) => void): () => void;
  off(event: string, callback?: (data: any) => void): void;
  
  // Send messages (if supported)
  send?(channel: string, event: string, data: any): void;
}

export interface WebSocketConfig {
  key?: string;
  cluster?: string;
  authEndpoint?: string;
  auth?: {
    headers?: Record<string, string>;
  };
}

export type WebSocketProvider = 'pusher' | 'mock' | 'websocket';