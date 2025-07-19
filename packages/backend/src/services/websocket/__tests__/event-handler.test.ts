/**
 * WebSocket Event Handler Tests
 * Tests for real-time event handling wrapper
 */

import { WebSocketEventHandler, EventMiddleware } from '../event-handler';
import { MockWebSocketService } from '../mock.service';

describe('WebSocketEventHandler', () => {
  let mockWebSocketService: MockWebSocketService;
  let eventHandler: WebSocketEventHandler;

  beforeEach(() => {
    mockWebSocketService = new MockWebSocketService();
    eventHandler = new WebSocketEventHandler(mockWebSocketService);
  });

  afterEach(() => {
    eventHandler.destroy();
    mockWebSocketService.destroy();
  });

  describe('Event Registration', () => {
    it('should register and execute event handlers', async () => {
      const handler = jest.fn();
      
      eventHandler.on('test-event', handler);
      
      await eventHandler.processWebhookEvent('test-event', { data: 'test' }, {
        channel: 'test-channel',
        event: 'test-event',
        timestamp: new Date(),
      });
      
      expect(handler).toHaveBeenCalledWith(
        { data: 'test' },
        expect.objectContaining({
          channel: 'test-channel',
          event: 'test-event',
        })
      );
    });

    it('should remove event handlers', async () => {
      const handler = jest.fn();
      
      eventHandler.on('test-event', handler);
      eventHandler.off('test-event', handler);
      
      await eventHandler.processWebhookEvent('test-event', { data: 'test' }, {
        channel: 'test-channel',
        event: 'test-event',
        timestamp: new Date(),
      });
      
      expect(handler).not.toHaveBeenCalled();
    });

    it('should remove all handlers for an event', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      eventHandler.on('test-event', handler1);
      eventHandler.on('test-event', handler2);
      eventHandler.off('test-event'); // Remove all
      
      await eventHandler.processWebhookEvent('test-event', { data: 'test' }, {
        channel: 'test-channel',
        event: 'test-event',
        timestamp: new Date(),
      });
      
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });

    it('should handle multiple handlers for same event', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      eventHandler.on('test-event', handler1);
      eventHandler.on('test-event', handler2);
      
      await eventHandler.processWebhookEvent('test-event', { data: 'test' }, {
        channel: 'test-channel',
        event: 'test-event',
        timestamp: new Date(),
      });
      
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Middleware', () => {
    it('should execute middleware before handlers', async () => {
      const middleware = jest.fn().mockResolvedValue(true);
      const handler = jest.fn();
      
      eventHandler.use(middleware);
      eventHandler.on('test-event', handler);
      
      await eventHandler.processWebhookEvent('test-event', { data: 'test' }, {
        channel: 'test-channel',
        event: 'test-event',
        timestamp: new Date(),
      });
      
      expect(middleware).toHaveBeenCalledBefore(handler as jest.Mock);
    });

    it('should block handler execution if middleware returns false', async () => {
      const middleware = jest.fn().mockResolvedValue(false);
      const handler = jest.fn();
      
      eventHandler.use(middleware);
      eventHandler.on('test-event', handler);
      
      await eventHandler.processWebhookEvent('test-event', { data: 'test' }, {
        channel: 'test-channel',
        event: 'test-event',
        timestamp: new Date(),
      });
      
      expect(middleware).toHaveBeenCalledTimes(1);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should continue with multiple middleware', async () => {
      const middleware1 = jest.fn().mockResolvedValue(true);
      const middleware2 = jest.fn().mockResolvedValue(true);
      const handler = jest.fn();
      
      eventHandler.use(middleware1);
      eventHandler.use(middleware2);
      eventHandler.on('test-event', handler);
      
      await eventHandler.processWebhookEvent('test-event', { data: 'test' }, {
        channel: 'test-channel',
        event: 'test-event',
        timestamp: new Date(),
      });
      
      expect(middleware1).toHaveBeenCalledTimes(1);
      expect(middleware2).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Team Broadcasting', () => {
    it('should broadcast to team channels', async () => {
      await eventHandler.broadcastToTeam('team-update', { message: 'hello' }, {
        teamId: 'team-123',
      });
      
      const messages = mockWebSocketService.getTriggeredMessages();
      expect(messages).toHaveLength(2); // private and presence channels
      
      expect(messages[0].channel).toBe('private-team-team-123');
      expect(messages[0].event).toBe('team-update');
      expect(messages[0].data.message).toBe('hello');
    });

    it('should exclude private channels when requested', async () => {
      await eventHandler.broadcastToTeam('team-update', { message: 'hello' }, {
        teamId: 'team-123',
        includePrivateChannels: false,
      });
      
      const messages = mockWebSocketService.getTriggeredMessages();
      expect(messages).toHaveLength(1); // only main team channel
      expect(messages[0].channel).toBe('private-team-team-123');
    });

    it('should include metadata in team broadcasts', async () => {
      await eventHandler.broadcastToTeam('team-update', { message: 'hello' }, {
        teamId: 'team-123',
        metadata: { source: 'test' },
      });
      
      const messages = mockWebSocketService.getTriggeredMessages();
      expect(messages[0].data.metadata).toMatchObject({
        source: 'test',
        priority: 'normal',
        timestamp: expect.any(String),
      });
    });
  });

  describe('User Broadcasting', () => {
    it('should broadcast to user channels', async () => {
      await eventHandler.broadcastToUser('user-notification', { message: 'hello' }, {
        userId: 'user-123',
      });
      
      const messages = mockWebSocketService.getTriggeredMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].channel).toBe('private-user-user-123');
      expect(messages[0].event).toBe('user-notification');
    });

    it('should support priority levels', async () => {
      await eventHandler.broadcastToUser('urgent-notification', { message: 'urgent' }, {
        userId: 'user-123',
        priority: 'high',
      });
      
      const messages = mockWebSocketService.getTriggeredMessages();
      expect(messages[0].data.metadata.priority).toBe('high');
    });
  });

  describe('Global Broadcasting', () => {
    it('should broadcast to public channels', async () => {
      await eventHandler.broadcastGlobal('announcement', { message: 'global' });
      
      const messages = mockWebSocketService.getTriggeredMessages();
      expect(messages.length).toBeGreaterThan(0);
      
      const channelNames = messages.map(m => m.channel);
      expect(channelNames).toContain('public-announcements');
      expect(channelNames).toContain('public-global');
    });
  });

  describe('Activity Broadcasting', () => {
    it('should broadcast activity to team channel', async () => {
      await eventHandler.broadcastActivity({
        userId: 'user-123',
        teamId: 'team-456',
        distance: 5.2,
        duration: 1800,
        isPrivate: false,
      });
      
      const messages = mockWebSocketService.getTriggeredMessages();
      
      // Should broadcast to both team and global channels (not private)
      const teamMessages = messages.filter(m => m.channel.includes('team-456'));
      const globalMessages = messages.filter(m => m.channel.includes('public'));
      
      expect(teamMessages.length).toBeGreaterThan(0);
      expect(globalMessages.length).toBeGreaterThan(0);
    });

    it('should not broadcast private activities globally', async () => {
      await eventHandler.broadcastActivity({
        userId: 'user-123',
        teamId: 'team-456',
        distance: 5.2,
        duration: 1800,
        isPrivate: true,
      });
      
      const messages = mockWebSocketService.getTriggeredMessages();
      
      // Should only broadcast to team channels, not global
      const teamMessages = messages.filter(m => m.channel.includes('team-456'));
      const globalMessages = messages.filter(m => m.channel.includes('public'));
      
      expect(teamMessages.length).toBeGreaterThan(0);
      expect(globalMessages).toHaveLength(0);
    });

    it('should broadcast milestone events', async () => {
      await eventHandler.broadcastActivity({
        userId: 'user-123',
        teamId: 'team-456',
        distance: 5.2,
        duration: 1800,
        isPrivate: false,
      }, {
        newTotalDistance: 100,
        newPercentComplete: 50,
        milestoneReached: true,
      });
      
      const messages = mockWebSocketService.getTriggeredMessages();
      
      // Should include milestone event
      const milestoneMessages = messages.filter(m => m.event === 'milestone-reached');
      expect(milestoneMessages.length).toBeGreaterThan(0);
    });
  });

  describe('Achievement Broadcasting', () => {
    it('should broadcast achievement to user and teams', async () => {
      await eventHandler.broadcastAchievement({
        userId: 'user-123',
        achievementId: 'first-mile',
        achievementName: 'First Mile',
        description: 'Complete your first mile',
        type: 'distance',
      }, ['team-456', 'team-789']);
      
      const messages = mockWebSocketService.getTriggeredMessages();
      
      // Should send to user channel
      const userMessages = messages.filter(m => m.channel === 'private-user-user-123');
      expect(userMessages).toHaveLength(1);
      expect(userMessages[0].event).toBe('achievement-unlocked');
      
      // Should send to team channels
      const teamMessages = messages.filter(m => m.event === 'team-member-achievement');
      expect(teamMessages).toHaveLength(2); // Two teams
    });

    it('should exclude achiever from team notifications', async () => {
      await eventHandler.broadcastAchievement({
        userId: 'user-123',
        achievementId: 'first-mile',
        achievementName: 'First Mile',
        description: 'Complete your first mile',
        type: 'distance',
      }, ['team-456']);
      
      const messages = mockWebSocketService.getTriggeredMessages();
      const teamMessages = messages.filter(m => m.event === 'team-member-achievement');
      
      expect(teamMessages[0].userId).toBe('user-123'); // Should be marked to exclude
    });
  });

  describe('Presence Broadcasting', () => {
    it('should broadcast presence changes to team channels', async () => {
      await eventHandler.broadcastPresence('user-123', 'online', ['team-456', 'team-789'], {
        name: 'John Doe',
      });
      
      const messages = mockWebSocketService.getTriggeredMessages();
      expect(messages).toHaveLength(2);
      
      expect(messages[0].channel).toBe('presence-team-team-456');
      expect(messages[1].channel).toBe('presence-team-team-789');
      
      expect(messages[0].data.userId).toBe('user-123');
      expect(messages[0].data.status).toBe('online');
      expect(messages[0].data.userInfo.name).toBe('John Doe');
    });
  });

  describe('Error Handling', () => {
    it('should handle handler errors gracefully', async () => {
      const errorHandler = jest.fn().mockRejectedValue(new Error('Handler error'));
      const successHandler = jest.fn();
      
      eventHandler.on('test-event', errorHandler);
      eventHandler.on('test-event', successHandler);
      
      // Should not throw even if one handler fails
      await expect(eventHandler.processWebhookEvent('test-event', { data: 'test' }, {
        channel: 'test-channel',
        event: 'test-event',
        timestamp: new Date(),
      })).resolves.not.toThrow();
      
      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(successHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle middleware errors gracefully', async () => {
      const errorMiddleware = jest.fn().mockRejectedValue(new Error('Middleware error'));
      const handler = jest.fn();
      
      eventHandler.use(errorMiddleware);
      eventHandler.on('test-event', handler);
      
      // Should not throw and should not execute handler
      await expect(eventHandler.processWebhookEvent('test-event', { data: 'test' }, {
        channel: 'test-channel',
        event: 'test-event',
        timestamp: new Date(),
      })).resolves.not.toThrow();
      
      expect(errorMiddleware).toHaveBeenCalledTimes(1);
      expect(handler).not.toHaveBeenCalled(); // Should not execute after middleware error
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', () => {
      const handler = jest.fn();
      const middleware = jest.fn();
      
      eventHandler.on('test-event', handler);
      eventHandler.use(middleware);
      
      eventHandler.destroy();
      
      // After destroy, should not have any handlers or middleware
      expect(() => eventHandler.processWebhookEvent('test-event', {}, {
        channel: 'test',
        event: 'test',
        timestamp: new Date(),
      })).not.toThrow();
    });
  });
});

describe('EventMiddleware', () => {
  let eventHandler: WebSocketEventHandler;
  let mockWebSocketService: MockWebSocketService;

  beforeEach(() => {
    mockWebSocketService = new MockWebSocketService();
    eventHandler = new WebSocketEventHandler(mockWebSocketService);
  });

  afterEach(() => {
    eventHandler.destroy();
    mockWebSocketService.destroy();
  });

  describe('Logger Middleware', () => {
    it('should log events with custom prefix', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      eventHandler.use(EventMiddleware.logger('TEST'));
      
      await eventHandler.processWebhookEvent('test-event', { data: 'test' }, {
        channel: 'test-channel',
        event: 'test-event',
        timestamp: new Date(),
        userId: 'user-123',
      });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[TEST] test-event on test-channel',
        expect.objectContaining({
          event: 'test-event',
          channel: 'test-channel',
          userId: 'user-123',
        })
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Rate Limit Middleware', () => {
    it('should allow events within limits', async () => {
      const rateLimiter = EventMiddleware.rateLimit({
        'test-event': { maxPerMinute: 5, maxPerHour: 60 },
      });
      
      eventHandler.use(rateLimiter);
      
      const handler = jest.fn();
      eventHandler.on('test-event', handler);
      
      // Send 3 events (within limit)
      for (let i = 0; i < 3; i++) {
        await eventHandler.processWebhookEvent('test-event', {}, {
          channel: 'test',
          event: 'test-event',
          timestamp: new Date(),
          userId: 'user-123',
        });
      }
      
      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('should block events exceeding limits', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const rateLimiter = EventMiddleware.rateLimit({
        'test-event': { maxPerMinute: 2, maxPerHour: 60 },
      });
      
      eventHandler.use(rateLimiter);
      
      const handler = jest.fn();
      eventHandler.on('test-event', handler);
      
      // Send 3 events (exceeding minute limit)
      for (let i = 0; i < 3; i++) {
        await eventHandler.processWebhookEvent('test-event', {}, {
          channel: 'test',
          event: 'test-event',
          timestamp: new Date(),
          userId: 'user-123',
        });
      }
      
      expect(handler).toHaveBeenCalledTimes(2); // Only first 2 should pass
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit exceeded')
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle events without configured limits', async () => {
      const rateLimiter = EventMiddleware.rateLimit({
        'other-event': { maxPerMinute: 1, maxPerHour: 10 },
      });
      
      eventHandler.use(rateLimiter);
      
      const handler = jest.fn();
      eventHandler.on('test-event', handler);
      
      await eventHandler.processWebhookEvent('test-event', {}, {
        channel: 'test',
        event: 'test-event',
        timestamp: new Date(),
        userId: 'user-123',
      });
      
      expect(handler).toHaveBeenCalledTimes(1); // Should pass through
    });
  });

  describe('Auth Middleware', () => {
    it('should allow authenticated requests', async () => {
      eventHandler.use(EventMiddleware.requireAuth());
      
      const handler = jest.fn();
      eventHandler.on('test-event', handler);
      
      await eventHandler.processWebhookEvent('test-event', {}, {
        channel: 'test',
        event: 'test-event',
        timestamp: new Date(),
        userId: 'user-123', // Authenticated
      });
      
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should block unauthenticated requests', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      eventHandler.use(EventMiddleware.requireAuth());
      
      const handler = jest.fn();
      eventHandler.on('test-event', handler);
      
      await eventHandler.processWebhookEvent('test-event', {}, {
        channel: 'test',
        event: 'test-event',
        timestamp: new Date(),
        // No userId - unauthenticated
      });
      
      expect(handler).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unauthorized event')
      );
      
      consoleSpy.mockRestore();
    });
  });
});