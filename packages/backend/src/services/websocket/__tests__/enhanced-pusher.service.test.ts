/**
 * Enhanced Pusher WebSocket Service Tests
 * Tests for connection management, retry logic, and health monitoring
 */

import { PusherWebSocketService } from '../pusher.service';
import { WebSocketError, WebSocketErrorCode } from '../types';

// Mock Pusher to control behavior
jest.mock('pusher', () => {
  return jest.fn().mockImplementation(() => ({
    trigger: jest.fn(),
    triggerBatch: jest.fn(),
    get: jest.fn(),
    generateAuthSignature: jest.fn(),
  }));
});

describe('Enhanced PusherWebSocketService', () => {
  let service: PusherWebSocketService;
  let mockPusher: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create service with test configuration
    service = new PusherWebSocketService({
      appId: 'test-app',
      key: 'test-key',
      secret: 'test-secret',
      cluster: 'us2',
      enableRetries: true,
      maxRetries: 3,
      retryBaseDelay: 100,
      connectionTimeout: 5000,
      heartbeatInterval: 1000,
      enableConnectionMonitoring: true,
      batchSize: 5,
    });

    // Get the mocked Pusher instance
    const Pusher = require('pusher');
    mockPusher = new Pusher().constructor.mock.instances[0];
  });

  afterEach(() => {
    service.destroy();
  });

  describe('Connection Management', () => {
    it('should initialize with healthy connection state', () => {
      const state = service.getConnectionState();
      
      expect(state.isConnected).toBe(false); // Not connected until first successful operation
      expect(state.healthStatus).toBe('healthy');
      expect(state.connectionAttempts).toBe(0);
      expect(state.retryCount).toBe(0);
    });

    it('should update connection state on successful operations', async () => {
      mockPusher.trigger.mockResolvedValue(undefined);

      await service.trigger('test-channel', 'test-event', { data: 'test' });

      const state = service.getConnectionState();
      expect(state.isConnected).toBe(true);
      expect(state.healthStatus).toBe('healthy');
      expect(state.lastConnectedAt).toBeDefined();
    });

    it('should update connection state on failures', async () => {
      const error = new Error('Connection failed');
      mockPusher.trigger.mockRejectedValue(error);

      await expect(service.trigger('test-channel', 'test-event', { data: 'test' }))
        .rejects.toThrow();

      const state = service.getConnectionState();
      expect(state.isConnected).toBe(false);
      expect(state.lastError).toBeDefined();
      expect(state.connectionAttempts).toBeGreaterThan(0);
    });

    it('should reset connection state when requested', () => {
      // Trigger a failure first
      const state1 = service.getConnectionState();
      expect(state1.connectionAttempts).toBe(0);

      service.resetConnectionState();

      const state2 = service.getConnectionState();
      expect(state2.isConnected).toBe(false);
      expect(state2.connectionAttempts).toBe(0);
      expect(state2.retryCount).toBe(0);
      expect(state2.healthStatus).toBe('healthy');
      expect(state2.lastError).toBeUndefined();
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed operations when retries are enabled', async () => {
      let attemptCount = 0;
      mockPusher.trigger.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Network error');
        }
        return Promise.resolve();
      });

      await service.trigger('test-channel', 'test-event', { data: 'test' });

      expect(attemptCount).toBe(3);
      expect(mockPusher.trigger).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const error = new Error('Invalid credentials');
      error.name = 'AuthenticationError';
      mockPusher.trigger.mockRejectedValue(error);

      await expect(service.trigger('test-channel', 'test-event', { data: 'test' }))
        .rejects.toThrow();

      expect(mockPusher.trigger).toHaveBeenCalledTimes(1);
    });

    it('should respect maximum retry attempts', async () => {
      mockPusher.trigger.mockRejectedValue(new Error('Network error'));

      await expect(service.trigger('test-channel', 'test-event', { data: 'test' }))
        .rejects.toThrow();

      // Should try initial + 3 retries = 4 total
      expect(mockPusher.trigger).toHaveBeenCalledTimes(4);
    });
  });

  describe('Batch Processing', () => {
    it('should split large batches into smaller chunks', async () => {
      const batchSize = 5;
      const messages = Array.from({ length: 12 }, (_, i) => ({
        event: `event-${i}`,
        data: { id: i },
        channel: `channel-${i}`,
      }));

      mockPusher.triggerBatch.mockResolvedValue(undefined);

      await service.triggerBatch(messages);

      // Should split into 3 batches: 5, 5, 2
      expect(mockPusher.triggerBatch).toHaveBeenCalledTimes(3);
      
      const firstCall = mockPusher.triggerBatch.mock.calls[0][0];
      const secondCall = mockPusher.triggerBatch.mock.calls[1][0];
      const thirdCall = mockPusher.triggerBatch.mock.calls[2][0];
      
      expect(firstCall).toHaveLength(5);
      expect(secondCall).toHaveLength(5);
      expect(thirdCall).toHaveLength(2);
    });

    it('should handle empty batch gracefully', async () => {
      await service.triggerBatch([]);
      
      expect(mockPusher.triggerBatch).not.toHaveBeenCalled();
    });
  });

  describe('Health Monitoring', () => {
    it('should perform health checks', async () => {
      mockPusher.get.mockResolvedValue({ data: {} });

      const result = await service.healthCheck();

      expect(result.healthy).toBe(true);
      expect(mockPusher.get).toHaveBeenCalledWith({ path: '/channels' });
    });

    it('should report unhealthy status on health check failure', async () => {
      mockPusher.get.mockRejectedValue(new Error('Service unavailable'));

      const result = await service.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.message).toContain('Unable to reach Pusher API');
    });

    it('should test connection with latency measurement', async () => {
      mockPusher.get.mockResolvedValue({ data: {} });

      const result = await service.testConnection();

      expect(result.success).toBe(true);
      expect(result.latency).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    it('should return error details on connection test failure', async () => {
      const error = new Error('Connection timeout');
      mockPusher.get.mockRejectedValue(error);

      const result = await service.testConnection();

      expect(result.success).toBe(false);
      expect(result.latency).toBeUndefined();
      expect(result.error).toBe('Connection timeout');
    });
  });

  describe('Channel Information', () => {
    it('should get channel info with retries', async () => {
      const mockResponse = {
        data: {
          occupied: true,
          subscription_count: 5,
          user_count: 3,
        },
      };

      let attemptCount = 0;
      mockPusher.get.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Network error');
        }
        return Promise.resolve(mockResponse);
      });

      const result = await service.getChannelInfo('presence-test');

      expect(result).toEqual({
        occupied: true,
        subscriptionCount: 5,
        userCount: 3,
      });
      expect(attemptCount).toBe(2);
    });

    it('should get channel users for presence channels', async () => {
      const mockResponse = {
        data: {
          users: [
            { id: 'user1', info: { name: 'John' } },
            { id: 'user2', info: { name: 'Jane' } },
          ],
        },
      };

      mockPusher.get.mockResolvedValue(mockResponse);

      const result = await service.getChannelUsers('presence-test');

      expect(result).toEqual([
        { userId: 'user1', userInfo: { name: 'John' } },
        { userId: 'user2', userInfo: { name: 'Jane' } },
      ]);
    });

    it('should reject getting users for non-presence channels', async () => {
      await expect(service.getChannelUsers('private-test'))
        .rejects.toThrow(WebSocketError);
    });
  });

  describe('Authentication', () => {
    it('should authenticate private channels', () => {
      const result = service.authenticateChannel('socket123', 'private-test');

      expect(result.auth).toMatch(/^test-key:/);
      expect(result.channelData).toBeUndefined();
    });

    it('should authenticate presence channels with user data', () => {
      const result = service.authenticateChannel(
        'socket123',
        'presence-test',
        'user123',
        { name: 'John' }
      );

      expect(result.auth).toMatch(/^test-key:/);
      expect(result.channelData).toEqual({
        user_id: 'user123',
        user_info: { name: 'John' },
      });
    });

    it('should reject authentication for public channels', () => {
      expect(() => service.authenticateChannel('socket123', 'public-test'))
        .toThrow(WebSocketError);
    });

    it('should require userId for presence channels', () => {
      expect(() => service.authenticateChannel('socket123', 'presence-test'))
        .toThrow(WebSocketError);
    });
  });

  describe('Error Mapping', () => {
    it('should map known Pusher errors to WebSocket errors', async () => {
      const pusherError = {
        status: 401,
        message: 'Unauthorized',
      };

      mockPusher.trigger.mockRejectedValue(pusherError);

      await expect(service.trigger('test-channel', 'test-event', {}))
        .rejects.toThrow(WebSocketError);
    });

    it('should map rate limit errors correctly', async () => {
      const pusherError = {
        status: 429,
        message: 'Too Many Requests',
      };

      mockPusher.trigger.mockRejectedValue(pusherError);

      try {
        await service.trigger('test-channel', 'test-event', {});
      } catch (error) {
        expect(error).toBeInstanceOf(WebSocketError);
        expect((error as WebSocketError).code).toBe(WebSocketErrorCode.RATE_LIMITED);
      }
    });

    it('should map network errors correctly', async () => {
      const networkError = new Error('Network error');
      networkError.name = 'ECONNREFUSED';

      mockPusher.trigger.mockRejectedValue(networkError);

      try {
        await service.trigger('test-channel', 'test-event', {});
      } catch (error) {
        expect(error).toBeInstanceOf(WebSocketError);
        expect((error as WebSocketError).code).toBe(WebSocketErrorCode.NETWORK_ERROR);
      }
    });
  });

  describe('Configuration', () => {
    it('should use environment variables for configuration', () => {
      process.env.PUSHER_APP_ID = 'env-app-id';
      process.env.NEXT_PUBLIC_PUSHER_KEY = 'env-key';
      process.env.PUSHER_SECRET = 'env-secret';
      process.env.PUSHER_CLUSTER = 'env-cluster';

      const envService = new PusherWebSocketService();
      
      // Should not throw configuration error
      expect(envService).toBeDefined();
      
      // Clean up
      delete process.env.PUSHER_APP_ID;
      delete process.env.NEXT_PUBLIC_PUSHER_KEY;
      delete process.env.PUSHER_SECRET;
      delete process.env.PUSHER_CLUSTER;
      
      envService.destroy();
    });

    it('should validate required configuration', () => {
      expect(() => new PusherWebSocketService({}))
        .toThrow('Missing required environment variable');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources on destroy', () => {
      const stateBefore = service.getConnectionState();
      expect(stateBefore.config.heartbeatInterval).toBeGreaterThan(0);

      service.destroy();

      // Should not throw when destroyed
      expect(() => service.destroy()).not.toThrow();
    });
  });
});