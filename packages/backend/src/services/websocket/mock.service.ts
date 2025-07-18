/**
 * Mock implementation of WebSocketService for testing
 */

import crypto from 'crypto';
import {
  WebSocketService,
  WebSocketMessage,
  WebSocketPresenceData,
  WebSocketAuthResponse,
  WebSocketWebhookEvent,
  WebSocketError,
  WebSocketErrorCode,
} from './types';

interface MockChannel {
  name: string;
  users: Map<string, WebSocketPresenceData>;
  messages: WebSocketMessage[];
}

export class MockWebSocketService implements WebSocketService {
  private channels: Map<string, MockChannel> = new Map();
  private triggeredMessages: WebSocketMessage[] = [];
  private mockDelay: number = 0;
  private shouldFailNext: boolean = false;
  private nextFailureError: WebSocketError | null = null;

  constructor() {
    // Initialize with some default channels
    this.createChannel('public-channel');
    this.createChannel('private-channel');
    this.createChannel('presence-channel');
  }

  // Helper methods for testing
  setMockDelay(ms: number): void {
    this.mockDelay = ms;
  }

  failNext(error?: WebSocketError): void {
    this.shouldFailNext = true;
    this.nextFailureError = error || new WebSocketError(
      'Mock failure',
      WebSocketErrorCode.SERVICE_ERROR
    );
  }

  getTriggeredMessages(): WebSocketMessage[] {
    return [...this.triggeredMessages];
  }

  clearMockData(): void {
    this.channels.clear();
    this.triggeredMessages = [];
    this.shouldFailNext = false;
    this.nextFailureError = null;
  }

  createChannel(name: string): void {
    if (!this.channels.has(name)) {
      this.channels.set(name, {
        name,
        users: new Map(),
        messages: [],
      });
    }
  }

  addUserToChannel(channel: string, userId: string, userInfo?: Record<string, any>): void {
    const ch = this.channels.get(channel);
    if (ch) {
      ch.users.set(userId, { userId, userInfo });
    }
  }

  // WebSocketService implementation
  async trigger(channel: string, event: string, data: any): Promise<void> {
    await this.delay();
    
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      throw this.nextFailureError!;
    }

    const message: WebSocketMessage = {
      event,
      data,
      channel,
    };

    this.triggeredMessages.push(message);
    
    const ch = this.channels.get(channel);
    if (ch) {
      ch.messages.push(message);
    }
  }

  async triggerBatch(messages: WebSocketMessage[]): Promise<void> {
    await this.delay();
    
    if (this.shouldFailNext) {
      this.shouldFailNext = false;
      throw this.nextFailureError!;
    }

    for (const message of messages) {
      this.triggeredMessages.push(message);
      
      const ch = this.channels.get(message.channel || 'default');
      if (ch) {
        ch.messages.push(message);
      }
    }
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

    this.createChannel(channel);

    if (this.isPresenceChannel(channel) && userId) {
      this.addUserToChannel(channel, userId, userInfo);
    }

    const mockAuth = this.generateMockAuth(socketId, channel, userId);
    
    return {
      auth: mockAuth,
      channelData: this.isPresenceChannel(channel) && userId
        ? { userId, userInfo: userInfo || {} }
        : undefined,
    };
  }

  async getChannelInfo(channel: string): Promise<{
    occupied: boolean;
    subscriptionCount?: number;
    userCount?: number;
  }> {
    await this.delay();
    
    const ch = this.channels.get(channel);
    if (!ch) {
      return { occupied: false };
    }

    return {
      occupied: ch.users.size > 0 || ch.messages.length > 0,
      subscriptionCount: ch.users.size,
      userCount: this.isPresenceChannel(channel) ? ch.users.size : undefined,
    };
  }

  async getChannelUsers(channel: string): Promise<WebSocketPresenceData[]> {
    await this.delay();
    
    if (!this.isPresenceChannel(channel)) {
      throw new WebSocketError(
        'Channel users can only be retrieved for presence channels',
        WebSocketErrorCode.INVALID_CHANNEL
      );
    }

    const ch = this.channels.get(channel);
    if (!ch) {
      return [];
    }

    return Array.from(ch.users.values());
  }

  validateWebhook(
    signature: string,
    body: string | Buffer,
    headers?: Record<string, string>
  ): boolean {
    // Simple mock validation
    return signature === 'mock-webhook-signature';
  }

  parseWebhook(body: string | Buffer): WebSocketWebhookEvent {
    try {
      const bodyString = typeof body === 'string' ? body : body.toString();
      const parsed = JSON.parse(bodyString);
      
      return {
        timeMs: parsed.timeMs || Date.now(),
        events: parsed.events || [],
      };
    } catch (error) {
      throw new WebSocketError(
        'Invalid webhook body',
        WebSocketErrorCode.SERVICE_ERROR,
        error
      );
    }
  }

  // Helper methods
  private async delay(): Promise<void> {
    if (this.mockDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.mockDelay));
    }
  }

  private generateMockAuth(
    socketId: string,
    channel: string,
    userId?: string
  ): string {
    const data = { socketId, channel, userId, timestamp: Date.now() };
    return `mock-key:${Buffer.from(JSON.stringify(data)).toString('base64')}`;
  }

  private isValidChannel(channel: string): boolean {
    return /^[\w\-=@,.;]+$/.test(channel) && channel.length <= 200;
  }

  private isPrivateChannel(channel: string): boolean {
    return channel.startsWith('private-');
  }

  private isPresenceChannel(channel: string): boolean {
    return channel.startsWith('presence-');
  }
}