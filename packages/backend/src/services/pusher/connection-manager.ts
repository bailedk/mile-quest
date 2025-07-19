/**
 * Enhanced Pusher connection manager with connection pooling, 
 * health monitoring, and advanced features
 */

import Pusher from 'pusher';
import crypto from 'crypto';
import { BaseAWSService, ServiceConfig, ServiceMetrics } from '../aws/base-service';
import {
  PusherConnection,
  ConnectionConfig,
  ConnectionStatus,
  ChannelSubscription,
  PusherEvent,
  EventDeliveryResult,
  EventDeliveryError,
  HealthStatus,
  PusherConnectionError,
  PusherErrorCode,
  AuthenticationRequest,
  AuthenticationResult,
  RateLimitConfig
} from './types';
import { PusherRateLimiter } from './rate-limiter';
import { PusherMonitoring } from './monitoring';
import { PusherAuthHandler } from './auth-handler';

export class PusherConnectionManager extends BaseAWSService {
  private pusher!: Pusher;
  private connections = new Map<string, PusherConnection>();
  private subscriptions = new Map<string, ChannelSubscription[]>();
  private connectionPool: Pusher[] = [];
  private rateLimiter: PusherRateLimiter;
  private monitoring: PusherMonitoring;
  private authHandler: PusherAuthHandler;

  private connectionConfig: ConnectionConfig;
  private appId: string;
  private key: string;
  private secret: string;
  private cluster: string;

  private healthCheckTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    connectionConfig?: Partial<ConnectionConfig>,
    rateLimitConfig?: Partial<RateLimitConfig>,
    serviceConfig?: ServiceConfig,
    metrics?: ServiceMetrics
  ) {
    super('PusherConnectionManager', serviceConfig, metrics);

    // Load Pusher credentials
    this.appId = this.getEnvVar('PUSHER_APP_ID');
    this.key = this.getEnvVar('NEXT_PUBLIC_PUSHER_KEY');
    this.secret = this.getEnvVar('PUSHER_SECRET');
    this.cluster = this.getEnvVar('PUSHER_CLUSTER', 'us2');

    // Setup configuration
    this.connectionConfig = {
      maxConnections: 1000,
      connectionTimeout: 30000,
      heartbeatInterval: 30000,
      reconnectAttempts: 5,
      reconnectDelay: 1000,
      maxReconnectDelay: 30000,
      backoffMultiplier: 2,
      enableConnectionPooling: true,
      enableHealthMonitoring: true,
      ...connectionConfig
    };

    // Initialize components
    this.rateLimiter = new PusherRateLimiter({
      messagesPerSecond: 10,
      messagesPerMinute: 600,
      subscriptionsPerConnection: 100,
      burstLimit: 50,
      windowSize: 60,
      ...rateLimitConfig
    });

    this.monitoring = new PusherMonitoring();
    this.authHandler = new PusherAuthHandler();

    // Initialize Pusher
    this.initializePusher();

    // Start background processes
    this.startHealthChecking();
    this.startCleanupProcess();

    this.logger.info('PusherConnectionManager initialized', {
      config: this.config,
      cluster: this.cluster
    });
  }

  /**
   * Register a new connection
   */
  async registerConnection(
    socketId: string, 
    userId?: string, 
    teamId?: string,
    metadata?: Record<string, any>
  ): Promise<PusherConnection> {
    return this.executeWithMetrics('registerConnection', async () => {
      // Check connection limits
      if (this.connections.size >= this.config.maxConnections) {
        throw new PusherConnectionError(
          'Connection pool exhausted',
          PusherErrorCode.CONNECTION_POOL_EXHAUSTED
        );
      }

      const connectionId = this.generateConnectionId();
      const connection: PusherConnection = {
        id: connectionId,
        socketId,
        userId,
        teamId,
        connectedAt: new Date(),
        lastActivity: new Date(),
        status: ConnectionStatus.CONNECTING,
        channels: new Set(),
        metadata
      };

      this.connections.set(connectionId, connection);
      this.monitoring.registerConnection(connection);

      // Update status to connected
      await this.updateConnectionStatus(connectionId, ConnectionStatus.CONNECTED);

      this.logger.info('Connection registered', {
        connectionId,
        socketId,
        userId,
        teamId
      });

      return connection;
    });
  }

  /**
   * Remove a connection
   */
  async removeConnection(connectionId: string): Promise<void> {
    return this.executeWithMetrics('removeConnection', async () => {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        return;
      }

      // Unsubscribe from all channels
      for (const channel of connection.channels) {
        await this.unsubscribeFromChannel(connectionId, channel);
      }

      this.connections.delete(connectionId);
      this.monitoring.removeConnection(connectionId);

      this.logger.info('Connection removed', {
        connectionId,
        socketId: connection.socketId,
        userId: connection.userId
      });
    });
  }

  /**
   * Subscribe to a channel with authentication and rate limiting
   */
  async subscribeToChannel(
    connectionId: string, 
    channel: string,
    authRequest?: AuthenticationRequest
  ): Promise<void> {
    return this.executeWithMetrics('subscribeToChannel', async () => {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new PusherConnectionError(
          'Connection not found',
          PusherErrorCode.CONNECTION_FAILED,
          connectionId
        );
      }

      // Check rate limits
      if (connection.userId) {
        const rateLimitResult = this.rateLimiter.checkSubscriptionLimit(connection.userId);
        if (!rateLimitResult.allowed) {
          this.monitoring.recordError('rateLimit', connectionId);
          throw new PusherConnectionError(
            'Subscription rate limit exceeded',
            PusherErrorCode.RATE_LIMITED,
            connectionId
          );
        }
      }

      // Authenticate channel if required
      if (this.isPrivateOrPresenceChannel(channel)) {
        if (!authRequest) {
          throw new PusherConnectionError(
            'Authentication required for private/presence channels',
            PusherErrorCode.AUTHENTICATION_FAILED,
            connectionId
          );
        }

        const authResult = await this.authHandler.authenticateChannel(authRequest);
        if (!authResult.success) {
          this.monitoring.recordError('authentication', connectionId);
          throw new PusherConnectionError(
            authResult.error || 'Channel authentication failed',
            PusherErrorCode.AUTHENTICATION_FAILED,
            connectionId
          );
        }
      }

      // Add to connection's channels
      connection.channels.add(channel);
      connection.lastActivity = new Date();

      // Add to subscriptions map
      if (!this.subscriptions.has(channel)) {
        this.subscriptions.set(channel, []);
      }

      const subscription: ChannelSubscription = {
        channel,
        socketId: connection.socketId,
        userId: connection.userId,
        teamId: connection.teamId,
        subscribedAt: new Date(),
        lastActivity: new Date(),
        permissions: await this.getChannelPermissions(channel, connection.userId, connection.teamId)
      };

      this.subscriptions.get(channel)!.push(subscription);

      this.logger.info('Channel subscription added', {
        connectionId,
        channel,
        userId: connection.userId
      });
    });
  }

  /**
   * Unsubscribe from a channel
   */
  async unsubscribeFromChannel(connectionId: string, channel: string): Promise<void> {
    return this.executeWithMetrics('unsubscribeFromChannel', async () => {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        return;
      }

      // Remove from connection's channels
      connection.channels.delete(channel);
      connection.lastActivity = new Date();

      // Remove from subscriptions map
      const channelSubscriptions = this.subscriptions.get(channel);
      if (channelSubscriptions) {
        const filtered = channelSubscriptions.filter(sub => sub.socketId !== connection.socketId);
        if (filtered.length === 0) {
          this.subscriptions.delete(channel);
        } else {
          this.subscriptions.set(channel, filtered);
        }
      }

      this.logger.info('Channel subscription removed', {
        connectionId,
        channel,
        userId: connection.userId
      });
    });
  }

  /**
   * Send an event to a channel with rate limiting and delivery tracking
   */
  async sendEvent(event: PusherEvent): Promise<EventDeliveryResult> {
    return this.executeWithMetrics('sendEvent', async () => {
      const startTime = Date.now();

      // Check rate limits for the sender
      if (event.userId) {
        const rateLimitResult = this.rateLimiter.checkMessageLimit(event.userId);
        if (!rateLimitResult.allowed) {
          this.monitoring.recordError('rateLimit');
          throw new PusherConnectionError(
            'Message rate limit exceeded',
            PusherErrorCode.RATE_LIMITED
          );
        }
      }

      // Get channel subscriptions
      const subscriptions = this.subscriptions.get(event.channel) || [];
      const errors: EventDeliveryError[] = [];

      try {
        // Send via Pusher
        await this.pusher.trigger(event.channel, event.event, event.data);

        // Record metrics
        const latency = Date.now() - startTime;
        this.monitoring.recordMessage(event.socketId || '', latency);

        this.logger.info('Event sent successfully', {
          eventId: event.eventId,
          channel: event.channel,
          event: event.event,
          subscriberCount: subscriptions.length,
          latency
        });

        return {
          success: true,
          deliveredTo: subscriptions.length,
          errors,
          latency
        };

      } catch (error) {
        this.monitoring.recordError('message');
        
        const deliveryError: EventDeliveryError = {
          socketId: event.socketId || 'unknown',
          error: error instanceof Error ? error.message : 'Unknown error',
          errorCode: 'DELIVERY_FAILED'
        };
        errors.push(deliveryError);

        this.logger.error('Event delivery failed', {
          eventId: event.eventId,
          channel: event.channel,
          error: error instanceof Error ? error.message : error
        });

        return {
          success: false,
          deliveredTo: 0,
          errors,
          latency: Date.now() - startTime
        };
      }
    });
  }

  /**
   * Send multiple events in a batch
   */
  async sendEventBatch(events: PusherEvent[]): Promise<EventDeliveryResult[]> {
    return this.executeWithMetrics('sendEventBatch', async () => {
      // Check batch rate limits
      if (events.length > 0 && events[0].userId) {
        const rateLimitResult = this.rateLimiter.checkBurstLimit(events[0].userId, events.length);
        if (!rateLimitResult.allowed) {
          this.monitoring.recordError('rateLimit');
          throw new PusherConnectionError(
            'Batch rate limit exceeded',
            PusherErrorCode.RATE_LIMITED
          );
        }
      }

      const results: EventDeliveryResult[] = [];
      
      // Convert to Pusher batch format
      const batch = events.map(event => ({
        channel: event.channel,
        name: event.event,
        data: event.data
      }));

      try {
        await this.pusher.triggerBatch(batch);
        
        // Create success results for all events
        for (const event of events) {
          const subscriptions = this.subscriptions.get(event.channel) || [];
          results.push({
            success: true,
            deliveredTo: subscriptions.length,
            errors: [],
            latency: 0 // Batch doesn't provide individual latencies
          });
        }

      } catch (error) {
        this.monitoring.recordError('message');
        
        // Create error results for all events
        for (const event of events) {
          results.push({
            success: false,
            deliveredTo: 0,
            errors: [{
              socketId: event.socketId || 'unknown',
              error: error instanceof Error ? error.message : 'Batch delivery failed',
              errorCode: 'BATCH_DELIVERY_FAILED'
            }],
            latency: 0
          });
        }
      }

      return results;
    });
  }

  /**
   * Get health status
   */
  getHealthStatus(): HealthStatus {
    return this.monitoring.getHealthStatus();
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): PusherConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get all connections for a user
   */
  getUserConnections(userId: string): PusherConnection[] {
    return Array.from(this.connections.values())
      .filter(conn => conn.userId === userId);
  }

  /**
   * Get all connections for a team
   */
  getTeamConnections(teamId: string): PusherConnection[] {
    return Array.from(this.connections.values())
      .filter(conn => conn.teamId === teamId);
  }

  /**
   * Get channel subscriptions
   */
  getChannelSubscriptions(channel: string): ChannelSubscription[] {
    return this.subscriptions.get(channel) || [];
  }

  /**
   * Cleanup and destroy the manager
   */
  async destroy(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.rateLimiter.destroy();
    this.monitoring.destroy();

    this.connections.clear();
    this.subscriptions.clear();
    this.connectionPool = [];

    this.logger.info('PusherConnectionManager destroyed');
  }

  private initializePusher(): void {
    this.pusher = new Pusher({
      appId: this.appId,
      key: this.key,
      secret: this.secret,
      cluster: this.cluster,
      useTLS: true,
      host: `api-${this.cluster}.pusherapp.com`,
      port: 443
    });

    // Initialize connection pool if enabled
    if (this.config.enableConnectionPooling) {
      this.initializeConnectionPool();
    }
  }

  private initializeConnectionPool(): void {
    // For now, we'll use a single connection
    // In the future, this could be enhanced with multiple connections
    this.connectionPool.push(this.pusher);
  }

  private async updateConnectionStatus(connectionId: string, status: ConnectionStatus): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.status = status;
      connection.lastActivity = new Date();
      this.monitoring.updateConnectionStatus(connectionId, status);
    }
  }

  private generateConnectionId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private isPrivateOrPresenceChannel(channel: string): boolean {
    return channel.startsWith('private-') || channel.startsWith('presence-');
  }

  private async getChannelPermissions(channel: string, userId?: string, teamId?: string): Promise<any> {
    // This would integrate with the auth handler
    // For now, return default permissions
    return {
      canRead: true,
      canWrite: true,
      canInvite: false,
      canModerate: false
    };
  }

  private startHealthChecking(): void {
    if (!this.config.enableHealthMonitoring) {
      return;
    }

    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        this.logger.error('Health check failed', { error });
        this.monitoring.recordError('healthCheck');
      }
    }, this.config.heartbeatInterval);
  }

  private startCleanupProcess(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupStaleConnections();
    }, 60000); // Cleanup every minute
  }

  private cleanupStaleConnections(): void {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [connectionId, connection] of this.connections.entries()) {
      if (now - connection.lastActivity.getTime() > staleThreshold) {
        this.removeConnection(connectionId);
      }
    }
  }

  protected async performHealthCheck(): Promise<void> {
    try {
      // Test Pusher API connectivity
      await this.pusher.get({ path: '/channels' });
    } catch (error) {
      throw new Error(`Pusher health check failed: ${error}`);
    }
  }
}