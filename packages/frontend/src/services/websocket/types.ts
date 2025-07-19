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

// Real-time event types for type safety
export type WebSocketEventType = 
  // Activity events
  | 'activity:created'
  | 'activity:updated' 
  | 'activity:deleted'
  | 'activity:achievement'
  // Presence events
  | 'presence:member_online'
  | 'presence:member_offline'
  | 'presence:initial_state'
  // Team events
  | 'team:updated'
  | 'team:member_joined'
  | 'team:member_left'
  // Goal events
  | 'goal:updated'
  | 'goal:completed'
  | 'goal:milestone_reached'
  // Leaderboard events
  | 'leaderboard:updated'
  | 'leaderboard:rank_changed'
  // Stats events
  | 'stats:updated'
  // Achievement events
  | 'achievement:earned'
  | 'achievement:progress_updated';

// Channel types for type safety
export type WebSocketChannelType =
  // Team-specific channels
  | `team-${string}`              // team-{teamId}
  | `presence-${string}`          // presence-{teamId}
  | `feed-team-${string}`         // feed-team-{teamId}
  // User-specific channels
  | 'feed-personal'               // User's personal activity feed
  | 'feed-teams'                  // All teams the user belongs to
  | 'achievements'                // User's achievement notifications
  // Global channels
  | 'feed-global'                 // Global activity feed (if enabled)
  | 'announcements';              // System announcements

// Enhanced message interface with stronger typing
export interface TypedWebSocketMessage<TData = any> {
  event: WebSocketEventType;
  data: TData;
  channel?: WebSocketChannelType;
  timestamp?: number;
  userId?: string;
  teamId?: string;
}

// Presence-specific types
export interface PresenceEventData {
  userId: string;
  socketId?: string;
  timestamp?: number;
}

export interface PresenceInitialStateData {
  members: Array<{
    userId: string;
    isOnline: boolean;
    lastSeen: number;
    socketId?: string;
  }>;
}

// Activity feed event data
export interface ActivityEventData {
  id: string;
  userId: string;
  userName: string;
  teamId: string;
  teamName: string;
  type: string;
  distance: number;
  duration?: number;
  date: string;
  isPrivate: boolean;
  [key: string]: any;
}

// Achievement event data
export interface AchievementEventData {
  id: string;
  name: string;
  description: string;
  icon?: string;
  earnedAt: string;
  userId: string;
  teamId?: string;
  activity?: ActivityEventData;
}

// Team event data
export interface TeamEventData {
  id: string;
  name: string;
  memberCount: number;
  isPublic: boolean;
  updatedAt: string;
}

// Goal event data
export interface GoalEventData {
  id: string;
  teamId: string;
  name: string;
  targetDistance: number;
  currentDistance: number;
  progressPercentage: number;
  deadline?: string;
  completedAt?: string;
}

// Leaderboard event data
export interface LeaderboardEventData {
  teamId: string;
  period: 'week' | 'month' | 'all';
  rankings: Array<{
    rank: number;
    userId: string;
    userName: string;
    distance: number;
    previousRank?: number;
  }>;
}

// Stats event data
export interface StatsEventData {
  userId?: string;
  teamId?: string;
  totalDistance: number;
  activitiesCount: number;
  currentStreak: number;
  bestDay?: {
    date: string;
    distance: number;
  };
  updatedAt: string;
}

// Connection state with additional metadata
export interface WebSocketConnectionInfo {
  state: WebSocketConnectionState;
  socketId: string | null;
  connectedAt: number | null;
  reconnectAttempts: number;
  lastError: WebSocketError | null;
  isOnline: boolean;
  latency?: number;
}