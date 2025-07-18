/**
 * Pusher implementation of the WebSocketService interface
 */

import Pusher from 'pusher';
import crypto from 'crypto';
import { BaseAWSService, ServiceConfig, ServiceMetrics } from '../aws/base-service';
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

export class PusherWebSocketService extends BaseAWSService implements WebSocketService {
  private pusher: Pusher;
  private appId: string;
  private key: string;
  private secret: string;

  constructor(config?: WebSocketConfig & ServiceConfig, metrics?: ServiceMetrics) {
    super('PusherWebSocket', config, metrics);
    
    this.appId = config?.appId || this.getEnvVar('PUSHER_APP_ID');
    this.key = config?.key || this.getEnvVar('NEXT_PUBLIC_PUSHER_KEY');
    this.secret = config?.secret || this.getEnvVar('PUSHER_SECRET');
    
    const cluster = config?.cluster || this.getEnvVar('PUSHER_CLUSTER', 'us2');
    
    this.pusher = new Pusher({
      appId: this.appId,
      key: this.key,
      secret: this.secret,
      cluster: cluster,
      useTLS: config?.encrypted !== false,
    });

    this.validateConfig();
  }

  async trigger(channel: string, event: string, data: any): Promise<void> {
    return this.executeWithMetrics('trigger', async () => {
      try {
        await this.pusher.trigger(channel, event, data);
      } catch (error) {
        throw this.mapError(error);
      }
    });
  }

  async triggerBatch(messages: WebSocketMessage[]): Promise<void> {
    return this.executeWithMetrics('triggerBatch', async () => {
      try {
        const batch = messages.map(msg => ({
          channel: msg.channel || 'default',
          name: msg.event,
          data: msg.data,
        }));
        
        await this.pusher.triggerBatch(batch);
      } catch (error) {
        throw this.mapError(error);
      }
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
        return {
          occupied: data.occupied || false,
          subscriptionCount: data.subscription_count,
          userCount: data.user_count,
        };
      } catch (error) {
        throw this.mapError(error);
      }
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

      try {
        const response = await this.pusher.get({
          path: `/channels/${channel}/users`,
        });

        return response.data.users.map((user: any) => ({
          userId: user.id,
          userInfo: user.info || {},
        }));
      } catch (error) {
        throw this.mapError(error);
      }
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
    } catch (error) {
      throw new Error('Unable to reach Pusher API');
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
}