/**
 * Pusher connection manager types and interfaces
 */

export interface PusherConnection {
  id: string;
  socketId: string;
  userId?: string;
  teamId?: string;
  connectedAt: Date;
  lastActivity: Date;
  status: ConnectionStatus;
  channels: Set<string>;
  metadata?: Record<string, any>;
}

export enum ConnectionStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

export interface ConnectionConfig {
  maxConnections: number;
  connectionTimeout: number;
  heartbeatInterval: number;
  reconnectAttempts: number;
  reconnectDelay: number;
  maxReconnectDelay: number;
  backoffMultiplier: number;
  enableConnectionPooling: boolean;
  enableHealthMonitoring: boolean;
}

export interface ChannelSubscription {
  channel: string;
  socketId: string;
  userId?: string;
  teamId?: string;
  subscribedAt: Date;
  lastActivity: Date;
  permissions: ChannelPermissions;
}

export interface ChannelPermissions {
  canRead: boolean;
  canWrite: boolean;
  canInvite: boolean;
  canModerate: boolean;
}

export interface RateLimitConfig {
  messagesPerSecond: number;
  messagesPerMinute: number;
  subscriptionsPerConnection: number;
  burstLimit: number;
  windowSize: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

export interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  totalChannels: number;
  activeChannels: number;
  messagesPerSecond: number;
  averageLatency: number;
  errorRate: number;
  uptime: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  connections: ConnectionMetrics;
  errors: ErrorMetrics;
  performance: PerformanceMetrics;
  lastCheck: Date;
}

export interface ErrorMetrics {
  connectionErrors: number;
  authenticationErrors: number;
  messageErrors: number;
  rateLimitHits: number;
  totalErrors: number;
  errorRate: number;
}

export interface PerformanceMetrics {
  averageConnectionTime: number;
  averageMessageLatency: number;
  throughput: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface AuthenticationRequest {
  socketId: string;
  channel: string;
  userId?: string;
  teamId?: string;
  token?: string;
  userData?: Record<string, any>;
}

export interface AuthenticationResult {
  success: boolean;
  auth?: string;
  channelData?: any;
  permissions?: ChannelPermissions;
  error?: string;
  errorCode?: string;
}

export interface ChannelAuthorizationRule {
  pattern: string;
  requiredRoles?: string[];
  requiredTeamMembership?: boolean;
  customValidator?: (request: AuthenticationRequest) => Promise<boolean>;
}

export interface PusherEvent {
  eventId: string;
  channel: string;
  event: string;
  data: any;
  userId?: string;
  socketId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface EventDeliveryResult {
  success: boolean;
  deliveredTo: number;
  errors: EventDeliveryError[];
  latency: number;
}

export interface EventDeliveryError {
  socketId: string;
  error: string;
  errorCode: string;
}

export class PusherConnectionError extends Error {
  constructor(
    message: string,
    public code: PusherErrorCode,
    public connectionId?: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'PusherConnectionError';
  }
}

export enum PusherErrorCode {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  RATE_LIMITED = 'RATE_LIMITED',
  CHANNEL_SUBSCRIPTION_FAILED = 'CHANNEL_SUBSCRIPTION_FAILED',
  MESSAGE_DELIVERY_FAILED = 'MESSAGE_DELIVERY_FAILED',
  INVALID_CHANNEL = 'INVALID_CHANNEL',
  INVALID_EVENT = 'INVALID_EVENT',
  CONNECTION_POOL_EXHAUSTED = 'CONNECTION_POOL_EXHAUSTED',
  HEALTH_CHECK_FAILED = 'HEALTH_CHECK_FAILED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}