/**
 * Tests for PusherConnectionManager
 */

import { PusherConnectionManager } from '../connection-manager';
import { ConnectionStatus, PusherErrorCode } from '../types';

// Mock Pusher
jest.mock('pusher', () => {
  return jest.fn().mockImplementation(() => ({
    trigger: jest.fn().mockResolvedValue({}),
    triggerBatch: jest.fn().mockResolvedValue({}),
    get: jest.fn().mockResolvedValue({ data: { channels: {} } })
  }));
});

// Mock environment variables
process.env.PUSHER_APP_ID = 'test-app-id';
process.env.NEXT_PUBLIC_PUSHER_KEY = 'test-key';
process.env.PUSHER_SECRET = 'test-secret';
process.env.PUSHER_CLUSTER = 'us2';

describe('PusherConnectionManager', () => {
  let manager: PusherConnectionManager;

  beforeEach(() => {
    manager = new PusherConnectionManager(
      {
        maxConnections: 10,
        connectionTimeout: 5000,
        enableHealthMonitoring: false // Disable for tests
      },
      {
        messagesPerSecond: 5,
        subscriptionsPerConnection: 10
      }
    );
  });

  afterEach(async () => {
    await manager.destroy();
  });

  describe('Connection Management', () => {
    it('should register a new connection', async () => {
      const connection = await manager.registerConnection('socket-123', 'user-1', 'team-1');

      expect(connection).toBeDefined();
      expect(connection.socketId).toBe('socket-123');
      expect(connection.userId).toBe('user-1');
      expect(connection.teamId).toBe('team-1');
      expect(connection.status).toBe(ConnectionStatus.CONNECTED);
    });

    it('should remove a connection', async () => {
      const connection = await manager.registerConnection('socket-123', 'user-1');
      const connectionId = connection.id;

      await manager.removeConnection(connectionId);

      expect(manager.getConnection(connectionId)).toBeUndefined();
    });

    it('should enforce connection limits', async () => {
      // Register maximum connections
      for (let i = 0; i < 10; i++) {
        await manager.registerConnection(`socket-${i}`, `user-${i}`);
      }

      // Try to register one more
      await expect(
        manager.registerConnection('socket-overflow', 'user-overflow')
      ).rejects.toThrow('Connection pool exhausted');
    });

    it('should get user connections', async () => {
      await manager.registerConnection('socket-1', 'user-1');
      await manager.registerConnection('socket-2', 'user-1');
      await manager.registerConnection('socket-3', 'user-2');

      const user1Connections = manager.getUserConnections('user-1');
      expect(user1Connections).toHaveLength(2);
    });

    it('should get team connections', async () => {
      await manager.registerConnection('socket-1', 'user-1', 'team-1');
      await manager.registerConnection('socket-2', 'user-2', 'team-1');
      await manager.registerConnection('socket-3', 'user-3', 'team-2');

      const team1Connections = manager.getTeamConnections('team-1');
      expect(team1Connections).toHaveLength(2);
    });
  });

  describe('Channel Subscriptions', () => {
    let connectionId: string;

    beforeEach(async () => {
      const connection = await manager.registerConnection('socket-123', 'user-1', 'team-1');
      connectionId = connection.id;
    });

    it('should subscribe to a public channel', async () => {
      await expect(
        manager.subscribeToChannel(connectionId, 'public-announcements')
      ).resolves.not.toThrow();

      const subscriptions = manager.getChannelSubscriptions('public-announcements');
      expect(subscriptions).toHaveLength(1);
    });

    it('should require authentication for private channels', async () => {
      await expect(
        manager.subscribeToChannel(connectionId, 'private-team-1')
      ).rejects.toThrow('Authentication required');
    });

    it('should unsubscribe from a channel', async () => {
      await manager.subscribeToChannel(connectionId, 'public-announcements');
      await manager.unsubscribeFromChannel(connectionId, 'public-announcements');

      const subscriptions = manager.getChannelSubscriptions('public-announcements');
      expect(subscriptions).toHaveLength(0);
    });
  });

  describe('Event Delivery', () => {
    let connectionId: string;

    beforeEach(async () => {
      const connection = await manager.registerConnection('socket-123', 'user-1');
      connectionId = connection.id;
      await manager.subscribeToChannel(connectionId, 'public-test');
    });

    it('should send an event successfully', async () => {
      const event = {
        eventId: 'event-1',
        channel: 'public-test',
        event: 'test-event',
        data: { message: 'Hello World' },
        userId: 'user-1',
        timestamp: new Date()
      };

      const result = await manager.sendEvent(event);

      expect(result.success).toBe(true);
      expect(result.deliveredTo).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle batch events', async () => {
      const events = [
        {
          eventId: 'event-1',
          channel: 'public-test',
          event: 'test-event-1',
          data: { message: 'Hello 1' },
          userId: 'user-1',
          timestamp: new Date()
        },
        {
          eventId: 'event-2',
          channel: 'public-test',
          event: 'test-event-2',
          data: { message: 'Hello 2' },
          userId: 'user-1',
          timestamp: new Date()
        }
      ];

      const results = await manager.sendEventBatch(events);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    let connectionId: string;

    beforeEach(async () => {
      const connection = await manager.registerConnection('socket-123', 'user-1');
      connectionId = connection.id;
      await manager.subscribeToChannel(connectionId, 'public-test');
    });

    it('should enforce message rate limits', async () => {
      const event = {
        eventId: 'event-1',
        channel: 'public-test',
        event: 'test-event',
        data: { message: 'Hello' },
        userId: 'user-1',
        timestamp: new Date()
      };

      // Send messages up to the limit
      for (let i = 0; i < 5; i++) {
        await manager.sendEvent({ ...event, eventId: `event-${i}` });
      }

      // Next message should be rate limited
      await expect(
        manager.sendEvent({ ...event, eventId: 'event-overflow' })
      ).rejects.toThrow('rate limit exceeded');
    });

    it('should enforce subscription rate limits', async () => {
      // Subscribe to channels up to the limit
      for (let i = 0; i < 10; i++) {
        await manager.subscribeToChannel(connectionId, `public-channel-${i}`);
      }

      // Next subscription should be rate limited
      await expect(
        manager.subscribeToChannel(connectionId, 'public-channel-overflow')
      ).rejects.toThrow('rate limit exceeded');
    });
  });

  describe('Health Monitoring', () => {
    it('should provide health status', () => {
      const health = manager.getHealthStatus();

      expect(health).toBeDefined();
      expect(health.status).toMatch(/healthy|degraded|unhealthy/);
      expect(health.connections).toBeDefined();
      expect(health.errors).toBeDefined();
      expect(health.performance).toBeDefined();
    });
  });
});