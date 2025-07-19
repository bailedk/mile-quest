/**
 * Tests for the Notification Service
 * Comprehensive test suite for notification functionality
 */

import { PrismaClient } from '@prisma/client';
import { NotificationServiceImpl, ActivityNotificationHelper } from '../notification.service';
import { createTestWebSocketService } from '../../websocket/factory';
import { NotificationError, NotificationErrorCode } from '../types';

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  notification: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  notificationTemplate: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  notificationPreference: {
    create: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  notificationBatch: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
} as unknown as PrismaClient;

describe('NotificationService', () => {
  let notificationService: NotificationServiceImpl;
  let mockWebSocketService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWebSocketService = createTestWebSocketService();
    
    notificationService = new NotificationServiceImpl(mockPrisma, {
      websocketService: mockWebSocketService,
      enableRealtime: true,
      enableEmail: false,
      rateLimitEnabled: false,
      quietHoursEnabled: false,
    });
  });

  describe('createNotification', () => {
    it('should create a notification successfully', async () => {
      const mockUser = {
        id: 'user123',
        name: 'John Doe',
        email: 'john@example.com',
      };

      const mockNotification = {
        id: 'notification123',
        userId: 'user123',
        type: 'ACTIVITY_CREATED',
        category: 'ACTIVITY',
        priority: 'LOW',
        title: 'Activity Logged',
        content: 'You logged 5.2km of activity',
        data: { distance: 5200 },
        channels: ['REALTIME'],
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
        user: mockUser,
        template: null,
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (mockPrisma.notification.create as jest.Mock).mockResolvedValue(mockNotification);

      const result = await notificationService.createNotification({
        userId: 'user123',
        type: 'ACTIVITY_CREATED',
        category: 'ACTIVITY',
        title: 'Activity Logged',
        content: 'You logged 5.2km of activity',
        data: { distance: 5200 },
        channels: ['REALTIME'],
      });

      expect(result.id).toBe('notification123');
      expect(result.title).toBe('Activity Logged');
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user123',
            type: 'ACTIVITY_CREATED',
            category: 'ACTIVITY',
            title: 'Activity Logged',
            content: 'You logged 5.2km of activity',
          }),
        })
      );
    });

    it('should throw error for non-existent user', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        notificationService.createNotification({
          userId: 'nonexistent',
          type: 'ACTIVITY_CREATED',
          category: 'ACTIVITY',
          title: 'Test',
          content: 'Test content',
        })
      ).rejects.toThrow(NotificationError);
    });

    it('should apply user preferences to channels', async () => {
      const mockUser = { id: 'user123', name: 'John', email: 'john@example.com' };
      const mockPreferences = [
        {
          id: 'pref1',
          userId: 'user123',
          category: 'ACTIVITY',
          channels: ['REALTIME'],
          isEnabled: true,
        },
      ];

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (mockPrisma.notificationPreference.findMany as jest.Mock).mockResolvedValue(mockPreferences);
      (mockPrisma.notification.create as jest.Mock).mockResolvedValue({
        id: 'notification123',
        channels: ['REALTIME'],
        user: mockUser,
      });

      await notificationService.createNotification({
        userId: 'user123',
        type: 'ACTIVITY_CREATED',
        category: 'ACTIVITY',
        title: 'Test',
        content: 'Test content',
        channels: ['REALTIME', 'EMAIL'], // User only has REALTIME enabled
      });

      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channels: ['REALTIME'], // Should be filtered based on preferences
          }),
        })
      );
    });
  });

  describe('sendNotification', () => {
    it('should send realtime notification successfully', async () => {
      const mockNotification = {
        id: 'notification123',
        userId: 'user123',
        type: 'ACTIVITY_CREATED',
        category: 'ACTIVITY',
        title: 'Activity Logged',
        content: 'Test content',
        channels: ['REALTIME'],
        status: 'PENDING',
        retryCount: 0,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        user: { id: 'user123', name: 'John', email: 'john@example.com' },
      };

      (mockPrisma.notification.findUnique as jest.Mock).mockResolvedValue(mockNotification);
      (mockPrisma.notification.update as jest.Mock).mockResolvedValue({
        ...mockNotification,
        status: 'SENT',
      });

      const results = await notificationService.sendNotification('notification123');

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].channel).toBe('REALTIME');
      expect(mockWebSocketService.trigger).toHaveBeenCalledWith(
        'private-user-user123',
        'notification',
        expect.objectContaining({
          id: 'notification123',
          title: 'Activity Logged',
        })
      );
    });

    it('should handle expired notifications', async () => {
      const expiredNotification = {
        id: 'notification123',
        expiresAt: new Date(Date.now() - 1000), // Expired
      };

      (mockPrisma.notification.findUnique as jest.Mock).mockResolvedValue(expiredNotification);
      (mockPrisma.notification.update as jest.Mock).mockResolvedValue({
        ...expiredNotification,
        status: 'EXPIRED',
      });

      await expect(
        notificationService.sendNotification('notification123')
      ).rejects.toThrow(NotificationError);

      expect(mockPrisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'EXPIRED',
          }),
        })
      );
    });
  });

  describe('getUserNotifications', () => {
    it('should return paginated user notifications', async () => {
      const mockNotifications = [
        {
          id: 'notification1',
          userId: 'user123',
          title: 'Notification 1',
          createdAt: new Date(),
          user: { id: 'user123', name: 'John', email: 'john@example.com' },
        },
        {
          id: 'notification2',
          userId: 'user123',
          title: 'Notification 2',
          createdAt: new Date(),
          user: { id: 'user123', name: 'John', email: 'john@example.com' },
        },
      ];

      (mockPrisma.notification.findMany as jest.Mock).mockResolvedValue(mockNotifications);

      const result = await notificationService.getUserNotifications('user123', {
        limit: 20,
        unreadOnly: true,
      });

      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(false);
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user123',
            readAt: null,
          }),
        })
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark notifications as read', async () => {
      (mockPrisma.notification.updateMany as jest.Mock).mockResolvedValue({ count: 2 });

      await notificationService.markAsRead(['notif1', 'notif2'], 'user123');

      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['notif1', 'notif2'] },
          userId: 'user123',
          readAt: null,
        },
        data: {
          readAt: expect.any(Date),
          status: 'READ',
        },
      });
    });
  });

  describe('getNotificationStats', () => {
    it('should return notification statistics', async () => {
      (mockPrisma.notification.count as jest.Mock)
        .mockResolvedValueOnce(50) // total
        .mockResolvedValueOnce(10); // unread

      (mockPrisma.notification.groupBy as jest.Mock)
        .mockResolvedValueOnce([ // by category
          { category: 'ACTIVITY', _count: 20 },
          { category: 'TEAM', _count: 15 },
        ])
        .mockResolvedValueOnce([ // by priority
          { priority: 'LOW', _count: 30 },
          { priority: 'HIGH', _count: 20 },
        ])
        .mockResolvedValueOnce([ // by status
          { status: 'READ', _count: 40 },
          { status: 'PENDING', _count: 10 },
        ]);

      const stats = await notificationService.getNotificationStats('user123');

      expect(stats.total).toBe(50);
      expect(stats.unread).toBe(10);
      expect(stats.byCategory.ACTIVITY).toBe(20);
      expect(stats.byCategory.TEAM).toBe(15);
    });
  });

  describe('processScheduledNotifications', () => {
    it('should process scheduled notifications', async () => {
      const scheduledNotifications = [
        {
          id: 'notification1',
          status: 'SCHEDULED',
          scheduledFor: new Date(Date.now() - 1000),
          retryCount: 0,
          maxRetries: 3,
          channels: ['REALTIME'],
          userId: 'user123',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          user: { id: 'user123', name: 'John', email: 'john@example.com' },
        },
      ];

      (mockPrisma.notification.findMany as jest.Mock).mockResolvedValue(scheduledNotifications);
      (mockPrisma.notification.findUnique as jest.Mock).mockResolvedValue(scheduledNotifications[0]);
      (mockPrisma.notification.update as jest.Mock).mockResolvedValue({
        ...scheduledNotifications[0],
        status: 'SENT',
      });

      const processedCount = await notificationService.processScheduledNotifications();

      expect(processedCount).toBe(1);
      expect(mockWebSocketService.trigger).toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredNotifications', () => {
    it('should clean up expired notifications', async () => {
      (mockPrisma.notification.deleteMany as jest.Mock).mockResolvedValue({ count: 5 });

      const cleanedCount = await notificationService.cleanupExpiredNotifications();

      expect(cleanedCount).toBe(5);
      expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) },
          status: { in: ['PENDING', 'SCHEDULED', 'FAILED'] },
        },
      });
    });
  });
});

describe('ActivityNotificationHelper', () => {
  let activityHelper: ActivityNotificationHelper;
  let mockNotificationService: any;

  beforeEach(() => {
    mockNotificationService = {
      createNotification: jest.fn(),
    };
    activityHelper = new ActivityNotificationHelper(mockNotificationService);
  });

  describe('notifyActivityCreated', () => {
    it('should create activity notification with correct data', async () => {
      const mockNotification = { id: 'notification123' };
      mockNotificationService.createNotification.mockResolvedValue(mockNotification);

      const result = await activityHelper.notifyActivityCreated('user123', {
        activityId: 'activity456',
        distance: 5200,
        duration: 1800,
        teamId: 'team789',
        teamName: 'Morning Runners',
      });

      expect(mockNotificationService.createNotification).toHaveBeenCalledWith({
        userId: 'user123',
        type: 'ACTIVITY_CREATED',
        category: 'ACTIVITY',
        priority: 'LOW',
        title: 'Activity Logged',
        content: 'You logged 5.2km of activity',
        data: expect.objectContaining({
          activityId: 'activity456',
          distance: 5200,
          duration: 1800,
          teamId: 'team789',
          teamName: 'Morning Runners',
        }),
        channels: ['REALTIME'],
      });

      expect(result).toBe(mockNotification);
    });
  });

  describe('notifyActivityMilestone', () => {
    it('should create distance milestone notification', async () => {
      const mockNotification = { id: 'notification123' };
      mockNotificationService.createNotification.mockResolvedValue(mockNotification);

      await activityHelper.notifyActivityMilestone('user123', {
        activityId: 'activity456',
        distance: 5200,
        duration: 1800,
        milestone: {
          type: 'distance',
          value: 100,
        },
      });

      expect(mockNotificationService.createNotification).toHaveBeenCalledWith({
        userId: 'user123',
        type: 'ACTIVITY_MILESTONE',
        category: 'ACTIVITY',
        priority: 'HIGH',
        title: 'Distance Milestone!',
        content: 'Amazing! You\'ve reached 100km total distance!',
        data: expect.objectContaining({
          milestone: {
            type: 'distance',
            value: 100,
          },
        }),
        channels: ['REALTIME', 'EMAIL'],
      });
    });

    it('should create streak milestone notification', async () => {
      const mockNotification = { id: 'notification123' };
      mockNotificationService.createNotification.mockResolvedValue(mockNotification);

      await activityHelper.notifyActivityMilestone('user123', {
        activityId: 'activity456',
        distance: 5200,
        duration: 1800,
        milestone: {
          type: 'streak',
          value: 7,
        },
      });

      expect(mockNotificationService.createNotification).toHaveBeenCalledWith({
        userId: 'user123',
        type: 'ACTIVITY_MILESTONE',
        category: 'ACTIVITY',
        priority: 'HIGH',
        title: 'Streak Milestone!',
        content: 'Incredible! You\'re on a 7 day streak!',
        data: expect.objectContaining({
          milestone: {
            type: 'streak',
            value: 7,
          },
        }),
        channels: ['REALTIME', 'EMAIL'],
      });
    });
  });
});

describe('NotificationError', () => {
  it('should create error with correct properties', () => {
    const error = new NotificationError(
      'Test error message',
      NotificationErrorCode.INVALID_USER,
      new Error('Original error')
    );

    expect(error.message).toBe('Test error message');
    expect(error.code).toBe(NotificationErrorCode.INVALID_USER);
    expect(error.name).toBe('NotificationError');
    expect(error.originalError).toBeInstanceOf(Error);
  });
});