/**
 * WebSocket service interface and types
 * Provider-agnostic real-time communication abstraction
 */

export interface WebSocketChannel {
  name: string;
  isPrivate: boolean;
  isPresence: boolean;
}

export interface WebSocketMessage {
  event: string;
  data: any;
  channel?: string;
  userId?: string;
  socketId?: string;
}

export interface WebSocketPresenceData {
  userId: string;
  userInfo?: Record<string, any>;
}

export interface WebSocketSubscription {
  channel: string;
  unsubscribe(): void;
}

export interface WebSocketAuthResponse {
  auth: string;
  channelData?: {
    userId: string;
    userInfo?: Record<string, any>;
  };
}

export interface WebSocketService {
  // Server-side operations
  trigger(channel: string, event: string, data: any): Promise<void>;
  triggerBatch(messages: WebSocketMessage[]): Promise<void>;
  
  // Authentication
  authenticateChannel(
    socketId: string,
    channel: string,
    userId?: string,
    userInfo?: Record<string, any>
  ): WebSocketAuthResponse;
  
  // Channel management
  getChannelInfo(channel: string): Promise<{
    occupied: boolean;
    subscriptionCount?: number;
    userCount?: number;
  }>;
  
  getChannelUsers(channel: string): Promise<WebSocketPresenceData[]>;
  
  // Webhooks
  validateWebhook(
    signature: string,
    body: string | Buffer,
    headers?: Record<string, string>
  ): boolean;
  
  parseWebhook(body: string | Buffer): WebSocketWebhookEvent;
}

export interface WebSocketClientService {
  // Client-side operations
  connect(): Promise<void>;
  disconnect(): void;
  
  // Subscriptions
  subscribe(channel: string): WebSocketSubscription;
  unsubscribe(channel: string): void;
  
  // Event handling
  on(event: string, handler: (data: any) => void): void;
  off(event: string, handler?: (data: any) => void): void;
  
  // Presence channels
  subscribePresence(
    channel: string,
    presenceData: WebSocketPresenceData
  ): WebSocketSubscription;
  
  // Connection state
  isConnected(): boolean;
  getSocketId(): string | null;
}

export interface WebSocketConfig {
  appId?: string;
  key?: string;
  secret?: string;
  cluster?: string;
  encrypted?: boolean;
  authEndpoint?: string;
  authTransport?: 'ajax' | 'jsonp';
  auth?: {
    headers?: Record<string, string>;
    params?: Record<string, string>;
  };
}

export interface WebSocketWebhookEvent {
  timeMs: number;
  events: Array<{
    name: string;
    channel: string;
    event?: string;
    data?: any;
    userId?: string;
    socketId?: string;
  }>;
}

export class WebSocketError extends Error {
  constructor(
    message: string,
    public code: WebSocketErrorCode,
    public originalError?: any
  ) {
    super(message);
    this.name = 'WebSocketError';
  }
}

export enum WebSocketErrorCode {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  SUBSCRIPTION_FAILED = 'SUBSCRIPTION_FAILED',
  TRIGGER_FAILED = 'TRIGGER_FAILED',
  INVALID_CHANNEL = 'INVALID_CHANNEL',
  INVALID_EVENT = 'INVALID_EVENT',
  RATE_LIMITED = 'RATE_LIMITED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVICE_ERROR = 'SERVICE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}