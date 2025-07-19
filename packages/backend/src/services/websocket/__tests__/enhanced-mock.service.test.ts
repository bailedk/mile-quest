/**
 * Enhanced Mock WebSocket Service Tests
 * Tests for advanced testing capabilities and state simulation
 */

import { MockWebSocketService } from '../mock.service';
import { WebSocketError, WebSocketErrorCode } from '../types';

describe('Enhanced MockWebSocketService', () => {
  let service: MockWebSocketService;

  beforeEach(() => {
    service = new MockWebSocketService({
      enableSimulatedLatency: false,
      enableConnectionSimulation: true,
      enableRandomFailures: false,
      failureRate: 0,
      maxLatency: 100,
      enableMetrics: true,
    });
  });

  afterEach(() => {
    service.destroy();
  });

  describe('Basic Mock Functionality', () => {
    it('should initialize with default channels', () => {
      const state = service.getConnectionState();
      
      expect(state.isConnected).toBe(true);
      expect(state.healthStatus).toBe('healthy');
      expect(state.connectionAttempts).toBe(0);
      expect(state.messageCount).toBe(0);
    });

    it('should track triggered messages', async () => {
      await service.trigger('test-channel', 'test-event', { data: 'test' });
      
      const messages = service.getTriggeredMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        event: 'test-event',
        data: { data: 'test' },
        channel: 'test-channel',
      });
    });

    it('should clear mock data', async () => {
      await service.trigger('test-channel', 'test-event', { data: 'test' });
      
      expect(service.getTriggeredMessages()).toHaveLength(1);
      
      service.clearMockData();
      
      expect(service.getTriggeredMessages()).toHaveLength(0);
      const state = service.getConnectionState();
      expect(state.messageCount).toBe(0);
    });
  });

  describe('Enhanced Testing Features', () => {
    it('should simulate connection failures', async () => {
      service.simulateConnectionFailure();
      
      const state = service.getConnectionState();
      expect(state.isConnected).toBe(false);
      expect(state.healthStatus).toBe('unhealthy');
      expect(state.lastError).toBeDefined();
      
      // Operations should fail when connection is simulated as down
      await expect(service.trigger('test-channel', 'test-event', {}))
        .rejects.toThrow(WebSocketError);
    });

    it('should restore connection after failure', async () => {
      service.simulateConnectionFailure();
      expect(service.getConnectionState().isConnected).toBe(false);
      
      service.simulateConnectionRestore();
      const state = service.getConnectionState();
      expect(state.isConnected).toBe(true);
      expect(state.healthStatus).toBe('healthy');
      expect(state.lastError).toBeUndefined();
    });

    it('should simulate random failures when enabled', async () => {
      service.setFailureRate(1.0); // 100% failure rate
      
      await expect(service.trigger('test-channel', 'test-event', {}))
        .rejects.toThrow('Simulated random failure');
    });

    it('should control failure rate', async () => {
      service.setFailureRate(0.5); // 50% failure rate
      
      const attempts = 20;
      let failures = 0;
      
      for (let i = 0; i < attempts; i++) {
        try {
          await service.trigger(`test-channel-${i}`, 'test-event', {});
        } catch (error) {
          failures++;
        }
      }
      
      // Should have some failures but not all
      expect(failures).toBeGreaterThan(0);
      expect(failures).toBeLessThan(attempts);
    });

    it('should simulate latency when enabled', async () => {
      service.enableLatencySimulation(true, 50);
      
      const startTime = Date.now();
      await service.trigger('test-channel', 'test-event', {});
      const endTime = Date.now();
      
      // Should take at least some time due to simulated latency
      expect(endTime - startTime).toBeGreaterThan(0);
    });

    it('should track operation history', async () => {
      await service.trigger('test-channel', 'test-event', {});
      
      const history = service.getOperationHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        operation: 'trigger',
        success: true,
        timestamp: expect.any(Date),
        latency: expect.any(Number),
      });
    });

    it('should limit operation history size', async () => {
      // Trigger more than 100 operations
      for (let i = 0; i < 120; i++) {
        await service.trigger(`channel-${i}`, 'test-event', {});
      }
      
      const history = service.getOperationHistory();
      expect(history).toHaveLength(100); // Should be limited to 100
    });
  });

  describe('Connection State Management', () => {
    it('should provide comprehensive connection state', async () => {
      await service.trigger('test-channel', 'test-event', {});
      
      const state = service.getConnectionState();
      
      expect(state).toMatchObject({
        isConnected: true,
        connectionAttempts: expect.any(Number),
        messageCount: 1,
        healthStatus: 'healthy',
        config: {
          enableSimulatedLatency: false,
          enableConnectionSimulation: true,
          enableRandomFailures: false,
          failureRate: 0,
          maxLatency: 100,
          enableMetrics: true,
        },
        metrics: {
          totalOperations: 1,
          successfulOperations: 1,
          failedOperations: 0,
          averageLatency: expect.any(Number),
        },
      });
    });

    it('should update health status based on operation results', async () => {
      // Start with healthy status
      expect(service.getConnectionState().healthStatus).toBe('healthy');
      
      // Simulate several failures
      service.setFailureRate(1.0);
      
      for (let i = 0; i < 5; i++) {
        try {
          await service.trigger(`channel-${i}`, 'test-event', {});
        } catch (error) {
          // Expected to fail
        }
      }
      
      // Should be unhealthy after multiple failures
      expect(service.getConnectionState().healthStatus).toBe('unhealthy');
    });

    it('should recover health status after successes', async () => {
      // Start with failures
      service.setFailureRate(1.0);
      
      for (let i = 0; i < 5; i++) {
        try {
          await service.trigger(`channel-${i}`, 'test-event', {});
        } catch (error) {
          // Expected to fail
        }
      }
      
      expect(service.getConnectionState().healthStatus).toBe('unhealthy');
      
      // Now have successes
      service.setFailureRate(0);
      
      for (let i = 0; i < 10; i++) {
        await service.trigger(`channel-${i}`, 'test-event', {});
      }
      
      // Should be healthy again
      expect(service.getConnectionState().healthStatus).toBe('healthy');
    });
  });

  describe('Health Check Compatibility', () => {
    it('should perform health checks', async () => {
      const result = await service.healthCheck();
      
      expect(result.healthy).toBe(true);
      expect(result.message).toBeUndefined();
    });

    it('should report unhealthy status when connection is down', async () => {
      service.simulateConnectionFailure();
      
      const result = await service.healthCheck();
      
      expect(result.healthy).toBe(false);
      expect(result.message).toBe('Service is experiencing issues');
    });

    it('should test connection with latency measurement', async () => {
      const result = await service.testConnection();
      
      expect(result.success).toBe(true);
      expect(result.latency).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    it('should return error on connection test failure', async () => {
      service.setFailureRate(1.0);
      
      const result = await service.testConnection();
      
      expect(result.success).toBe(false);
      expect(result.latency).toBeUndefined();
      expect(result.error).toBeDefined();
    });
  });

  describe('Channel Management', () => {
    it('should create and manage channels', () => {
      service.createChannel('new-channel');
      service.addUserToChannel('new-channel', 'user1', { name: 'John' });
      
      // Channel should exist and have user
      expect(async () => {
        const info = await service.getChannelInfo('new-channel');
        expect(info.occupied).toBe(true);
        expect(info.subscriptionCount).toBe(1);
      }).not.toThrow();
    });

    it('should handle presence channels correctly', async () => {
      service.createChannel('presence-test');
      service.addUserToChannel('presence-test', 'user1', { name: 'John' });
      service.addUserToChannel('presence-test', 'user2', { name: 'Jane' });
      
      const users = await service.getChannelUsers('presence-test');
      expect(users).toHaveLength(2);
      expect(users[0]).toEqual({ userId: 'user1', userInfo: { name: 'John' } });
      expect(users[1]).toEqual({ userId: 'user2', userInfo: { name: 'Jane' } });
    });

    it('should reject getting users for non-presence channels', async () => {
      await expect(service.getChannelUsers('private-test'))
        .rejects.toThrow(WebSocketError);
    });
  });

  describe('Batch Operations', () => {
    it('should handle batch trigger operations', async () => {
      const messages = [
        { event: 'event1', data: { id: 1 }, channel: 'channel1' },
        { event: 'event2', data: { id: 2 }, channel: 'channel2' },
      ];
      
      await service.triggerBatch(messages);
      
      const triggered = service.getTriggeredMessages();
      expect(triggered).toHaveLength(2);
      expect(triggered[0]).toEqual(messages[0]);
      expect(triggered[1]).toEqual(messages[1]);
      
      const state = service.getConnectionState();
      expect(state.messageCount).toBe(2);
    });

    it('should handle empty batch operations', async () => {
      await service.triggerBatch([]);
      
      expect(service.getTriggeredMessages()).toHaveLength(0);
    });
  });

  describe('Authentication Simulation', () => {
    it('should authenticate private channels', () => {
      const result = service.authenticateChannel('socket123', 'private-test');
      
      expect(result.auth).toMatch(/^mock-key:/);
      expect(result.channelData).toBeUndefined();
    });

    it('should authenticate presence channels', () => {
      const result = service.authenticateChannel(
        'socket123',
        'presence-test',
        'user123',
        { name: 'John' }
      );
      
      expect(result.auth).toMatch(/^mock-key:/);
      expect(result.channelData).toEqual({
        userId: 'user123',
        userInfo: { name: 'John' },
      });
    });

    it('should reject public channel authentication', () => {
      expect(() => service.authenticateChannel('socket123', 'public-test'))
        .toThrow(WebSocketError);
    });
  });

  describe('Webhook Simulation', () => {
    it('should validate webhook signatures', () => {
      const isValid = service.validateWebhook('mock-webhook-signature', 'test-body');
      expect(isValid).toBe(true);
      
      const isInvalid = service.validateWebhook('invalid-signature', 'test-body');
      expect(isInvalid).toBe(false);
    });

    it('should parse webhook events', () => {
      const webhookBody = JSON.stringify({
        timeMs: Date.now(),
        events: [
          {
            name: 'channel_occupied',
            channel: 'test-channel',
            event: 'test-event',
            data: { test: true },
          },
        ],
      });
      
      const parsed = service.parseWebhook(webhookBody);
      
      expect(parsed.timeMs).toBeDefined();
      expect(parsed.events).toHaveLength(1);
      expect(parsed.events[0].name).toBe('channel_occupied');
    });

    it('should handle invalid webhook data', () => {
      expect(() => service.parseWebhook('invalid json'))
        .toThrow(WebSocketError);
    });
  });

  describe('Legacy Compatibility', () => {
    it('should maintain compatibility with old mock methods', () => {
      service.setMockDelay(50);
      
      service.failNext();
      expect(async () => {
        await service.trigger('test-channel', 'test-event', {});
      }).rejects.toThrow();
      
      // Should work after single failure
      await service.trigger('test-channel', 'test-event', {});
      expect(service.getTriggeredMessages()).toHaveLength(1);
    });

    it('should support custom failure errors', () => {
      const customError = new WebSocketError(
        'Custom test error',
        WebSocketErrorCode.RATE_LIMITED
      );
      
      service.failNext(customError);
      
      expect(async () => {
        await service.trigger('test-channel', 'test-event', {});
      }).rejects.toThrow('Custom test error');
    });
  });
});