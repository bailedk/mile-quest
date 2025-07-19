/**
 * Mock implementation of WebSocketService for testing
 * Enhanced with advanced testing capabilities and state simulation
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

interface MockConnectionState {
  isConnected: boolean;
  connectionAttempts: number;
  lastError?: Error;
  messageCount: number;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
}

interface MockServiceConfig {
  enableSimulatedLatency?: boolean;
  enableConnectionSimulation?: boolean;
  enableRandomFailures?: boolean;
  failureRate?: number; // 0-1
  maxLatency?: number;
  enableMetrics?: boolean;
}

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
  private connectionState: MockConnectionState;
  private config: MockServiceConfig;
  private operationHistory: Array<{
    operation: string;
    timestamp: Date;
    success: boolean;
    latency?: number;
    error?: string;
  }> = [];

  constructor(config?: MockServiceConfig) {
    this.config = {
      enableSimulatedLatency: false,
      enableConnectionSimulation: true,
      enableRandomFailures: false,
      failureRate: 0.1,
      maxLatency: 1000,
      enableMetrics: true,
      ...config,
    };

    this.connectionState = {
      isConnected: true,
      connectionAttempts: 0,
      messageCount: 0,
      healthStatus: 'healthy',
    };

    // Initialize with some default channels
    this.createChannel('public-channel');
    this.createChannel('private-channel');
    this.createChannel('presence-channel');
  }

  // Enhanced helper methods for testing
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
    this.operationHistory = [];
    this.resetConnectionState();
  }

  // New enhanced testing methods
  simulateConnectionFailure(): void {
    this.connectionState.isConnected = false;
    this.connectionState.healthStatus = 'unhealthy';
    this.connectionState.lastError = new Error('Simulated connection failure');
  }

  simulateConnectionRestore(): void {
    this.connectionState.isConnected = true;
    this.connectionState.healthStatus = 'healthy';
    this.connectionState.lastError = undefined;
  }

  setFailureRate(rate: number): void {
    this.config.failureRate = Math.max(0, Math.min(1, rate));
    this.config.enableRandomFailures = rate > 0;
  }

  enableLatencySimulation(enabled: boolean, maxLatency = 1000): void {
    this.config.enableSimulatedLatency = enabled;
    this.config.maxLatency = maxLatency;
  }

  getOperationHistory(): typeof this.operationHistory {
    return [...this.operationHistory];
  }

  getConnectionState(): MockConnectionState & {
    config: MockServiceConfig;
    metrics: {
      totalOperations: number;
      successfulOperations: number;
      failedOperations: number;
      averageLatency: number;
    };
  } {
    const totalOps = this.operationHistory.length;
    const successfulOps = this.operationHistory.filter(op => op.success).length;
    const averageLatency = totalOps > 0 
      ? this.operationHistory.reduce((sum, op) => sum + (op.latency || 0), 0) / totalOps 
      : 0;

    return {
      ...this.connectionState,
      config: { ...this.config },
      metrics: {
        totalOperations: totalOps,
        successfulOperations: successfulOps,
        failedOperations: totalOps - successfulOps,
        averageLatency,
      },
    };
  }

  resetConnectionState(): void {
    this.connectionState = {
      isConnected: true,
      connectionAttempts: 0,
      messageCount: 0,
      healthStatus: 'healthy',
    };
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
    return this.executeOperation('trigger', async () => {
      await this.delay();
      
      if (this.shouldFailNext) {
        this.shouldFailNext = false;
        throw this.nextFailureError!;
      }

      if (this.shouldSimulateFailure()) {
        throw new WebSocketError(
          'Simulated random failure',
          WebSocketErrorCode.NETWORK_ERROR
        );
      }

      const message: WebSocketMessage = {
        event,
        data,
        channel,
      };

      this.triggeredMessages.push(message);
      this.connectionState.messageCount++;
      
      const ch = this.channels.get(channel);
      if (ch) {
        ch.messages.push(message);
      }
    });
  }

  async triggerBatch(messages: WebSocketMessage[]): Promise<void> {
    return this.executeOperation('triggerBatch', async () => {
      await this.delay();
      
      if (this.shouldFailNext) {
        this.shouldFailNext = false;
        throw this.nextFailureError!;
      }

      if (this.shouldSimulateFailure()) {
        throw new WebSocketError(
          'Simulated batch failure',
          WebSocketErrorCode.NETWORK_ERROR
        );
      }

      for (const message of messages) {
        this.triggeredMessages.push(message);
        this.connectionState.messageCount++;
        
        const ch = this.channels.get(message.channel || 'default');
        if (ch) {
          ch.messages.push(message);
        }
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
    return this.executeOperation('getChannelInfo', async () => {
      await this.delay();
      
      if (this.shouldSimulateFailure()) {
        throw new WebSocketError(
          'Simulated channel info failure',
          WebSocketErrorCode.SERVICE_ERROR
        );
      }
      
      const ch = this.channels.get(channel);
      if (!ch) {
        return { occupied: false };
      }

      return {
        occupied: ch.users.size > 0 || ch.messages.length > 0,
        subscriptionCount: ch.users.size,
        userCount: this.isPresenceChannel(channel) ? ch.users.size : undefined,
      };
    });
  }

  async getChannelUsers(channel: string): Promise<WebSocketPresenceData[]> {
    return this.executeOperation('getChannelUsers', async () => {
      await this.delay();
      
      if (!this.isPresenceChannel(channel)) {
        throw new WebSocketError(
          'Channel users can only be retrieved for presence channels',
          WebSocketErrorCode.INVALID_CHANNEL
        );
      }

      if (this.shouldSimulateFailure()) {
        throw new WebSocketError(
          'Simulated channel users failure',
          WebSocketErrorCode.SERVICE_ERROR
        );
      }

      const ch = this.channels.get(channel);
      if (!ch) {
        return [];
      }

      return Array.from(ch.users.values());
    });
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

  /**
   * Execute operation with enhanced simulation and metrics tracking
   */
  private async executeOperation<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const start = Date.now();
    let success = false;
    let error: string | undefined;

    try {
      // Simulate connection check
      if (this.config.enableConnectionSimulation && !this.connectionState.isConnected) {
        throw new WebSocketError(
          'Connection is not available',
          WebSocketErrorCode.CONNECTION_FAILED
        );
      }

      // Simulate latency if enabled
      if (this.config.enableSimulatedLatency) {
        const latency = Math.random() * (this.config.maxLatency || 1000);
        await new Promise(resolve => setTimeout(resolve, latency));
      }

      const result = await operation();
      success = true;
      return result;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      this.updateConnectionHealth(false);
      throw err;
    } finally {
      const latency = Date.now() - start;
      
      if (success) {
        this.updateConnectionHealth(true);
      }

      if (this.config.enableMetrics) {
        this.operationHistory.push({
          operation: operationName,
          timestamp: new Date(),
          success,
          latency,
          error,
        });

        // Keep only last 100 operations for memory management
        if (this.operationHistory.length > 100) {
          this.operationHistory = this.operationHistory.slice(-100);
        }
      }
    }
  }

  /**
   * Check if random failure should be simulated
   */
  private shouldSimulateFailure(): boolean {
    return this.config.enableRandomFailures && 
           Math.random() < (this.config.failureRate || 0.1);
  }

  /**
   * Update connection health based on operation results
   */
  private updateConnectionHealth(success: boolean): void {
    this.connectionState.connectionAttempts++;
    
    if (success) {
      // Improve health status on success
      if (this.connectionState.healthStatus === 'unhealthy') {
        this.connectionState.healthStatus = 'degraded';
      } else if (this.connectionState.healthStatus === 'degraded') {
        // After several successes, mark as healthy
        const recentOperations = this.operationHistory.slice(-10);
        const recentSuccesses = recentOperations.filter(op => op.success).length;
        if (recentSuccesses >= 8) {
          this.connectionState.healthStatus = 'healthy';
        }
      }
    } else {
      // Degrade health status on failure
      if (this.connectionState.healthStatus === 'healthy') {
        this.connectionState.healthStatus = 'degraded';
      } else if (this.connectionState.healthStatus === 'degraded') {
        // After several failures, mark as unhealthy
        const recentOperations = this.operationHistory.slice(-5);
        const recentFailures = recentOperations.filter(op => !op.success).length;
        if (recentFailures >= 3) {
          this.connectionState.healthStatus = 'unhealthy';
        }
      }
    }
  }

  /**
   * Health check method for compatibility with real service
   */
  public async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    return this.executeOperation('healthCheck', async () => {
      if (this.shouldSimulateFailure()) {
        throw new Error('Simulated health check failure');
      }

      return {
        healthy: this.connectionState.isConnected && this.connectionState.healthStatus !== 'unhealthy',
        message: this.connectionState.healthStatus === 'unhealthy' 
          ? 'Service is experiencing issues'
          : undefined,
      };
    });
  }

  /**
   * Test connection method for compatibility with real service
   */
  public async testConnection(): Promise<{
    success: boolean;
    latency?: number;
    error?: string;
  }> {
    const start = Date.now();
    
    try {
      await this.healthCheck();
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
   * Cleanup method for compatibility with real service
   */
  public destroy(): void {
    this.clearMockData();
  }
}