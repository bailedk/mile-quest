/**
 * Pusher implementation of the WebSocketService interface
 * Enhanced with connection management, retry logic, and comprehensive error handling
 */

import Pusher from 'pusher';
import crypto from 'crypto';
import { BaseAWSService, ServiceConfig, ServiceMetrics } from '../aws/base-service';
import { RetryHandler, createAWSRetryHandler } from '../aws/retry-handler';
import {
  WebSocketService,
  WebSocketMessage,
  WebSocketPresenceData,
  WebSocketAuthResponse,
  WebSocketConfig,
  WebSocketWebhookEvent,
  WebSocketError,
  WebSocketErrorCode,
} from './types';

interface ConnectionState {
  isConnected: boolean;
  lastConnectedAt?: Date;
  connectionAttempts: number;
  lastError?: Error;
  retryCount: number;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
}

interface PusherServiceConfig extends WebSocketConfig {
  enableRetries?: boolean;
  maxRetries?: number;
  retryBaseDelay?: number;
  connectionTimeout?: number;
  heartbeatInterval?: number;
  enableConnectionMonitoring?: boolean;
  batchSize?: number;
}

export class PusherWebSocketService extends BaseAWSService implements WebSocketService {
  private pusher: Pusher;
  private appId: string;
  private key: string;
  private secret: string;
  private retryHandler: RetryHandler;
  private connectionState: ConnectionState;
  private heartbeatTimer?: NodeJS.Timeout;
  private serviceConfig: PusherServiceConfig;

  constructor(config?: PusherServiceConfig & ServiceConfig, metrics?: ServiceMetrics) {
    super('PusherWebSocket', config, metrics);
    
    // Merge config with defaults
    this.serviceConfig = {
      enableRetries: true,
      maxRetries: 3,
      retryBaseDelay: 1000,
      connectionTimeout: 30000,
      heartbeatInterval: 30000,
      enableConnectionMonitoring: true,
      batchSize: 10,
      ...config,
    };
    
    this.appId = this.serviceConfig.appId || this.getEnvVar('PUSHER_APP_ID');
    this.key = this.serviceConfig.key || this.getEnvVar('NEXT_PUBLIC_PUSHER_KEY');
    this.secret = this.serviceConfig.secret || this.getEnvVar('PUSHER_SECRET');
    
    const cluster = this.serviceConfig.cluster || this.getEnvVar('PUSHER_CLUSTER', 'us2');
    
    // Initialize connection state
    this.connectionState = {
      isConnected: false,
      connectionAttempts: 0,
      retryCount: 0,
      healthStatus: 'healthy',
    };
    
    // Initialize retry handler
    this.retryHandler = createAWSRetryHandler({
      maxRetries: this.serviceConfig.maxRetries,
      baseDelay: this.serviceConfig.retryBaseDelay,
      maxDelay: 30000,
      retryableErrors: [
        'NetworkError',
        'TimeoutError',
        'InternalServerError',
        'ServiceUnavailableException',
        'TooManyRequestsException',
        'ECONNREFUSED',
        'ENOTFOUND',
        'ETIMEDOUT',
      ],
    });
    
    this.pusher = new Pusher({
      appId: this.appId,
      key: this.key,
      secret: this.secret,
      cluster: cluster,
      useTLS: this.serviceConfig.encrypted !== false,
    });

    this.validateConfig();
    this.initializeConnectionMonitoring();
  }

  async trigger(channel: string, event: string, data: any): Promise<void> {
    return this.executeWithMetrics('trigger', async () => {
      const operation = async () => {
        try {
          await this.pusher.trigger(channel, event, data);
          this.updateConnectionState(true);
        } catch (error) {
          this.updateConnectionState(false, error as Error);
          throw this.mapError(error);
        }
      };

      if (this.serviceConfig.enableRetries) {
        return await this.retryHandler.execute(operation);
      }
      
      return await operation();
    });
  }

  async triggerBatch(messages: WebSocketMessage[]): Promise<void> {
    return this.executeWithMetrics('triggerBatch', async () => {
      if (messages.length === 0) {
        return;
      }

      // Split into batches to avoid API limits
      const batchSize = this.serviceConfig.batchSize || 10;
      const batches = this.chunkArray(messages, batchSize);
      
      const operation = async () => {
        try {
          for (const batch of batches) {
            const pusherBatch = batch.map(msg => ({
              channel: msg.channel || 'default',
              name: msg.event,
              data: msg.data,
            }));
            
            await this.pusher.triggerBatch(pusherBatch);
          }
          this.updateConnectionState(true);
        } catch (error) {
          this.updateConnectionState(false, error as Error);
          throw this.mapError(error);
        }
      };

      if (this.serviceConfig.enableRetries) {
        return await this.retryHandler.execute(operation);
      }
      
      return await operation();
    });
  }

  authenticateChannel(
    socketId: string,
    channel: string,
    userId?: string,
    userInfo?: Record<string, any>
  ): WebSocketAuthResponse {
    if (!socketId) {
      throw new WebSocketError(
        'Socket ID is required for authentication',
        WebSocketErrorCode.AUTHENTICATION_FAILED
      );
    }

    if (!this.isValidChannel(channel)) {
      throw new WebSocketError(
        'Invalid channel name',
        WebSocketErrorCode.INVALID_CHANNEL
      );
    }

    // For public channels, no authentication needed
    if (!this.isPrivateChannel(channel) && !this.isPresenceChannel(channel)) {
      throw new WebSocketError(
        'Public channels do not require authentication',
        WebSocketErrorCode.INVALID_CHANNEL
      );
    }

    // For presence channels, userId is required
    if (this.isPresenceChannel(channel) && !userId) {
      throw new WebSocketError(
        'User ID is required for presence channels',
        WebSocketErrorCode.AUTHENTICATION_FAILED
      );
    }

    let auth: string;
    let channelData: any;

    if (this.isPresenceChannel(channel)) {
      const presenceData = {
        user_id: userId!,
        user_info: userInfo || {},
      };
      
      channelData = presenceData;
      const authString = `${socketId}:${channel}:${JSON.stringify(presenceData)}`;
      auth = this.generateAuthSignature(authString);
    } else {
      // Private channel
      const authString = `${socketId}:${channel}`;
      auth = this.generateAuthSignature(authString);
    }

    return {
      auth: `${this.key}:${auth}`,
      channelData,
    };
  }

  async getChannelInfo(channel: string): Promise<{
    occupied: boolean;
    subscriptionCount?: number;
    userCount?: number;
  }> {
    return this.executeWithMetrics('getChannelInfo', async () => {
      const operation = async () => {
        try {
          const response = await this.pusher.get({
            path: `/channels/${channel}`,
            params: {
              info: this.isPresenceChannel(channel) 
                ? 'subscription_count,user_count' 
                : 'subscription_count',
            },
          });

          const data = response.data;
          this.updateConnectionState(true);
          return {
            occupied: data.occupied || false,
            subscriptionCount: data.subscription_count,
            userCount: data.user_count,
          };
        } catch (error) {
          this.updateConnectionState(false, error as Error);
          throw this.mapError(error);
        }
      };

      if (this.serviceConfig.enableRetries) {
        return await this.retryHandler.execute(operation);
      }
      
      return await operation();
    });
  }

  async getChannelUsers(channel: string): Promise<WebSocketPresenceData[]> {
    return this.executeWithMetrics('getChannelUsers', async () => {
      if (!this.isPresenceChannel(channel)) {
        throw new WebSocketError(
          'Channel users can only be retrieved for presence channels',
          WebSocketErrorCode.INVALID_CHANNEL
        );
      }

      const operation = async () => {
        try {
          const response = await this.pusher.get({
            path: `/channels/${channel}/users`,
          });

          this.updateConnectionState(true);
          return response.data.users.map((user: any) => ({
            userId: user.id,
            userInfo: user.info || {},
          }));
        } catch (error) {
          this.updateConnectionState(false, error as Error);
          throw this.mapError(error);
        }
      };

      if (this.serviceConfig.enableRetries) {
        return await this.retryHandler.execute(operation);
      }
      
      return await operation();
    });
  }

  validateWebhook(
    signature: string,
    body: string | Buffer,
    headers?: Record<string, string>
  ): boolean {
    const bodyString = typeof body === 'string' ? body : body.toString();
    const expectedSignature = this.generateWebhookSignature(bodyString);
    
    return signature === expectedSignature;
  }

  parseWebhook(body: string | Buffer): WebSocketWebhookEvent {
    try {
      const bodyString = typeof body === 'string' ? body : body.toString();
      const parsed = JSON.parse(bodyString);
      
      return {
        timeMs: parsed.time_ms,
        events: parsed.events.map((event: any) => ({
          name: event.name,
          channel: event.channel,
          event: event.event,
          data: event.data,
          userId: event.user_id,
          socketId: event.socket_id,
        })),
      };
    } catch (error) {
      throw new WebSocketError(
        'Invalid webhook body',
        WebSocketErrorCode.SERVICE_ERROR,
        error
      );
    }
  }

  protected async performHealthCheck(): Promise<void> {
    try {
      // Check if we can reach Pusher API
      await this.pusher.get({ path: '/channels' });
      this.updateConnectionState(true);
    } catch (error) {
      this.updateConnectionState(false, error as Error);
      throw new Error(`Unable to reach Pusher API: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  protected mapError(error: any): Error {
    if (error instanceof WebSocketError) {
      return error;
    }

    const statusCode = error.status || error.statusCode;
    const errorMessage = error.message || 'An unknown error occurred';

    switch (statusCode) {
      case 400:
        return new WebSocketError(
          'Invalid request parameters',
          WebSocketErrorCode.SERVICE_ERROR,
          error
        );
      case 401:
        return new WebSocketError(
          'Authentication failed',
          WebSocketErrorCode.AUTHENTICATION_FAILED,
          error
        );
      case 403:
        return new WebSocketError(
          'Forbidden - check your credentials',
          WebSocketErrorCode.AUTHENTICATION_FAILED,
          error
        );
      case 413:
        return new WebSocketError(
          'Message too large',
          WebSocketErrorCode.TRIGGER_FAILED,
          error
        );
      case 429:
        return new WebSocketError(
          'Rate limit exceeded',
          WebSocketErrorCode.RATE_LIMITED,
          error
        );
      default:
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          return new WebSocketError(
            'Network error',
            WebSocketErrorCode.NETWORK_ERROR,
            error
          );
        }
        return new WebSocketError(
          errorMessage,
          WebSocketErrorCode.UNKNOWN_ERROR,
          error
        );
    }
  }

  private generateAuthSignature(authString: string): string {
    return crypto
      .createHmac('sha256', this.secret)
      .update(authString)
      .digest('hex');
  }

  private generateWebhookSignature(body: string): string {
    return crypto
      .createHmac('sha256', this.secret)
      .update(body)
      .digest('hex');
  }

  private isValidChannel(channel: string): boolean {
    // Pusher channel name requirements
    return /^[\w\-=@,.;]+$/.test(channel) && channel.length <= 200;
  }

  private isPrivateChannel(channel: string): boolean {
    return channel.startsWith('private-');
  }

  private isPresenceChannel(channel: string): boolean {
    return channel.startsWith('presence-');
  }

  /**
   * Initialize connection monitoring with heartbeat
   */
  private initializeConnectionMonitoring(): void {
    if (!this.serviceConfig.enableConnectionMonitoring) {
      return;
    }

    this.heartbeatTimer = setInterval(() => {
      this.performHeartbeat();
    }, this.serviceConfig.heartbeatInterval || 30000);
  }

  /**
   * Perform heartbeat check to maintain connection health
   */
  private async performHeartbeat(): Promise<void> {
    try {
      await this.performHealthCheck();
    } catch (error) {
      console.warn('WebSocket heartbeat failed:', error);
      this.updateConnectionState(false, error as Error);
    }
  }

  /**
   * Update connection state and health status
   */
  private updateConnectionState(isConnected: boolean, error?: Error): void {
    const previousState = { ...this.connectionState };
    
    this.connectionState.isConnected = isConnected;
    
    if (isConnected) {
      this.connectionState.lastConnectedAt = new Date();
      this.connectionState.retryCount = 0;
      this.connectionState.lastError = undefined;
    } else {
      this.connectionState.connectionAttempts++;
      this.connectionState.retryCount++;
      this.connectionState.lastError = error;
    }

    // Update health status based on connection state
    this.updateHealthStatus();

    // Record metrics if available
    if (this.metrics && isConnected !== previousState.isConnected) {
      this.metrics.recordMetric(
        `${this.serviceName}.connection.state`,
        isConnected ? 1 : 0
      );
    }
  }

  /**
   * Update health status based on current connection state
   */
  private updateHealthStatus(): void {
    const { retryCount, isConnected, lastError } = this.connectionState;
    
    if (isConnected && retryCount === 0) {
      this.connectionState.healthStatus = 'healthy';
    } else if (isConnected && retryCount > 0) {
      this.connectionState.healthStatus = 'degraded';
    } else if (!isConnected && retryCount >= this.serviceConfig.maxRetries!) {
      this.connectionState.healthStatus = 'unhealthy';
    } else {
      this.connectionState.healthStatus = 'degraded';
    }
  }

  /**
   * Get current connection state and health information
   */
  public getConnectionState(): ConnectionState & {
    config: {
      maxRetries: number;
      enableRetries: boolean;
      heartbeatInterval: number;
    };
  } {
    return {
      ...this.connectionState,
      config: {
        maxRetries: this.serviceConfig.maxRetries!,
        enableRetries: this.serviceConfig.enableRetries!,
        heartbeatInterval: this.serviceConfig.heartbeatInterval!,
      },
    };
  }

  /**
   * Reset connection state and retry counters
   */
  public resetConnectionState(): void {
    this.connectionState = {
      isConnected: false,
      connectionAttempts: 0,
      retryCount: 0,
      healthStatus: 'healthy',
    };
  }

  /**
   * Manually trigger a connection test
   */
  public async testConnection(): Promise<{
    success: boolean;
    latency?: number;
    error?: string;
  }> {
    const start = Date.now();
    
    try {
      await this.performHealthCheck();
      const latency = Date.now() - start;
      
      return {
        success: true,
        latency,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Utility method to chunk arrays for batch processing
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Cleanup resources when service is destroyed
   */
  public destroy(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }
}