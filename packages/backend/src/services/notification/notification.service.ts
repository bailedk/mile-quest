/**
 * Real-time Notification Service for Mile Quest
 * Handles multi-channel notification delivery with templates, preferences, and scheduling
 */

import { PrismaClient, Prisma, NotificationStatus, NotificationChannel, NotificationBatchStatus } from '@prisma/client';
import { BaseAWSService, ServiceConfig, ServiceMetrics } from '../aws/base-service';
import { EmailService } from '../email/types';
import { cache, cacheKeys, cacheTTL } from '../../utils/cache';
import {
  NotificationService,
  CreateNotificationInput,
  CreateBatchNotificationInput,
  UpdateNotificationInput,
  NotificationWithRelations,
  NotificationBatch,
  NotificationListOptions,
  NotificationStats,
  CreateTemplateInput,
  UpdateTemplateInput,
  NotificationTemplate,
  NotificationPreferenceInput,
  NotificationPreferences,
  NotificationDeliveryResult,
  BatchDeliveryResult,
  NotificationMetrics,
  NotificationFilter,
  NotificationServiceConfig,
  NotificationError,
  NotificationErrorCode,
  ActivityNotificationData,
  TeamNotificationData,
  AchievementNotificationData,
  SystemNotificationData,
} from './types';

interface InternalNotificationServiceConfig extends NotificationServiceConfig, ServiceConfig {
  emailService?: EmailService;
}

export class NotificationServiceImpl extends BaseAWSService implements NotificationService {
  private emailService?: EmailService;
  private config: Required<NotificationServiceConfig>;
  private rateLimitCache = new Map<string, { count: number; resetTime: number }>();

  constructor(
    private prisma: PrismaClient,
    config?: InternalNotificationServiceConfig,
    metrics?: ServiceMetrics
  ) {
    super('NotificationService', config, metrics);
    
    // Initialize configuration with defaults
    this.config = {
      maxBatchSize: 1000,
      defaultRetryCount: 3,
      retryDelayMs: 5000,
      enableRealtime: true,
      enableEmail: true,
      enablePush: false, // Not implemented yet
      quietHoursEnabled: true,
      rateLimitEnabled: true,
      rateLimit: {
        maxNotificationsPerUser: 100,
        windowMs: 60000, // 1 minute
      },
      defaultExpirationHours: 168, // 7 days
      enableMetrics: true,
      enableScheduling: true,
      ...config,
    };

    // Initialize services
    this.emailService = config?.emailService;
  }

  async createNotification(input: CreateNotificationInput): Promise<NotificationWithRelations> {
    return this.executeWithMetrics('createNotification', async () => {
      // Validate input
      await this.validateNotificationInput(input);
      
      // Check rate limits
      if (this.config.rateLimitEnabled) {
        await this.checkRateLimit(input.userId);
      }

      // Render template if specified
      let title = input.title;
      let content = input.content;
      let emailContent: string | undefined;

      if (input.templateId) {
        const rendered = await this.renderTemplate(input.templateId, input.templateVariables || {});
        title = rendered.title;
        content = rendered.content;
        emailContent = rendered.emailContent;
      }

      // Apply user preferences
      const effectiveChannels = await this.applyUserPreferences(input.userId, input.category, input.channels);

      // Set expiration if not provided
      const expiresAt = input.expiresAt || new Date(Date.now() + this.config.defaultExpirationHours * 60 * 60 * 1000);

      // Create notification in database
      const notification = await this.prisma.notification.create({
        data: {
          userId: input.userId,
          templateId: input.templateId,
          type: input.type,
          category: input.category,
          priority: input.priority || 'MEDIUM',
          title,
          content,
          data: input.data || {},
          channels: effectiveChannels,
          scheduledFor: input.scheduledFor,
          expiresAt,
          maxRetries: this.config.defaultRetryCount,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          template: true,
        },
      });

      // If not scheduled for future, send immediately
      if (!input.scheduledFor || input.scheduledFor <= new Date()) {
        // Send in background (don't await)
        this.sendNotificationBackground(notification.id).catch(error => {
          this.logError('Background notification send failed', error);
        });
      }

      // Clear relevant caches
      this.clearUserNotificationCaches(input.userId);

      return this.mapNotificationToWithRelations(notification);
    });
  }

  async createBatchNotification(input: CreateBatchNotificationInput): Promise<NotificationBatch> {
    return this.executeWithMetrics('createBatchNotification', async () => {
      // Validate batch size
      if (input.userIds.length > this.config.maxBatchSize) {
        throw new NotificationError(
          `Batch size ${input.userIds.length} exceeds maximum ${this.config.maxBatchSize}`,
          NotificationErrorCode.BATCH_TOO_LARGE
        );
      }

      // Create batch record
      const batch = await this.prisma.notificationBatch.create({
        data: {
          name: input.batchName,
          description: input.batchDescription,
          type: input.type,
          category: input.category,
          totalCount: input.userIds.length,
          scheduledFor: input.scheduledFor,
        },
      });

      // Create notifications for each user
      const notifications = await Promise.allSettled(
        input.userIds.map(userId => 
          this.createNotification({
            ...input,
            userId,
          }).catch(error => {
            this.logError(`Failed to create notification for user ${userId}`, error);
            throw error;
          })
        )
      );

      // Count successful creations
      const successCount = notifications.filter(result => result.status === 'fulfilled').length;
      const failedCount = notifications.length - successCount;

      // Update batch with results
      await this.prisma.notificationBatch.update({
        where: { id: batch.id },
        data: {
          sentCount: successCount,
          failedCount,
          status: failedCount > 0 ? 'FAILED' : 'COMPLETED',
          completedAt: new Date(),
        },
      });

      return {
        ...batch,
        sentCount: successCount,
        failedCount,
        status: failedCount > 0 ? 'FAILED' : 'COMPLETED',
        completedAt: new Date(),
      };
    });
  }

  async updateNotification(id: string, input: UpdateNotificationInput): Promise<NotificationWithRelations> {
    return this.executeWithMetrics('updateNotification', async () => {
      const notification = await this.prisma.notification.update({
        where: { id },
        data: input,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          template: true,
        },
      });

      // Clear user notification caches
      this.clearUserNotificationCaches(notification.userId);

      return this.mapNotificationToWithRelations(notification);
    });
  }

  async deleteNotification(id: string): Promise<void> {
    return this.executeWithMetrics('deleteNotification', async () => {
      const notification = await this.prisma.notification.findUnique({
        where: { id },
        select: { userId: true },
      });

      if (!notification) {
        throw new NotificationError('Notification not found', NotificationErrorCode.INVALID_USER);
      }

      await this.prisma.notification.delete({
        where: { id },
      });

      // Clear user notification caches
      this.clearUserNotificationCaches(notification.userId);
    });
  }

  async sendNotification(notificationId: string): Promise<NotificationDeliveryResult[]> {
    return this.executeWithMetrics('sendNotification', async () => {
      const notification = await this.prisma.notification.findUnique({
        where: { id: notificationId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          template: true,
        },
      });

      if (!notification) {
        throw new NotificationError('Notification not found', NotificationErrorCode.INVALID_USER);
      }

      // Check if notification is expired
      if (notification.expiresAt && notification.expiresAt < new Date()) {
        await this.updateNotification(notificationId, { status: 'EXPIRED' });
        throw new NotificationError('Notification has expired', NotificationErrorCode.NOTIFICATION_EXPIRED);
      }

      // Check quiet hours
      if (this.config.quietHoursEnabled && await this.isInQuietHours(notification.userId, notification.category)) {
        // Reschedule for after quiet hours
        const nextDeliveryTime = await this.getNextDeliveryTime(notification.userId, notification.category);
        await this.updateNotification(notificationId, { 
          scheduledFor: nextDeliveryTime,
          status: 'SCHEDULED',
        });
        return [];
      }

      const results: NotificationDeliveryResult[] = [];
      let successfulDeliveries = 0;

      // Send via each enabled channel
      for (const channel of notification.channels) {
        try {
          let success = false;
          let error: string | undefined;

          switch (channel) {
            case 'REALTIME':
              if (this.config.enableRealtime) {
                await this.sendRealtimeNotification(notification);
                success = true;
              }
              break;

            case 'EMAIL':
              if (this.config.enableEmail && this.emailService) {
                await this.sendEmailNotification(notification);
                success = true;
              }
              break;

            case 'PUSH':
              if (this.config.enablePush) {
                // Push notifications not implemented yet
                error = 'Push notifications not yet implemented';
              }
              break;
          }

          results.push({
            notificationId,
            success,
            channel,
            deliveredAt: success ? new Date() : undefined,
            error,
          });

          if (success) {
            successfulDeliveries++;
          }
        } catch (deliveryError) {
          results.push({
            notificationId,
            success: false,
            channel,
            error: deliveryError instanceof Error ? deliveryError.message : 'Unknown error',
          });
        }
      }

      // Update notification status
      const newStatus: NotificationStatus = successfulDeliveries > 0 ? 'SENT' : 'FAILED';
      await this.updateNotification(notificationId, {
        status: newStatus,
        sentAt: successfulDeliveries > 0 ? new Date() : undefined,
        retryCount: notification.retryCount + 1,
        lastError: results.find(r => !r.success)?.error,
      });

      return results;
    });
  }

  async sendBatchNotifications(batchId: string): Promise<BatchDeliveryResult> {
    return this.executeWithMetrics('sendBatchNotifications', async () => {
      const batch = await this.prisma.notificationBatch.findUnique({
        where: { id: batchId },
      });

      if (!batch) {
        throw new NotificationError('Batch not found', NotificationErrorCode.INVALID_USER);
      }

      // Update batch status to processing
      await this.prisma.notificationBatch.update({
        where: { id: batchId },
        data: {
          status: 'PROCESSING',
          startedAt: new Date(),
        },
      });

      // Get all notifications in batch
      const notifications = await this.prisma.notification.findMany({
        where: {
          createdAt: {
            gte: batch.createdAt,
            lte: new Date(batch.createdAt.getTime() + 60000), // Within 1 minute of batch creation
          },
          type: batch.type,
          category: batch.category,
          status: 'PENDING',
        },
      });

      // Send each notification
      const allResults: NotificationDeliveryResult[] = [];
      let successfulDeliveries = 0;

      for (const notification of notifications) {
        try {
          const results = await this.sendNotification(notification.id);
          allResults.push(...results);
          if (results.some(r => r.success)) {
            successfulDeliveries++;
          }
        } catch (error) {
          allResults.push({
            notificationId: notification.id,
            success: false,
            channel: 'REALTIME', // Default channel for error reporting
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Update batch with final results
      const finalStatus: NotificationBatchStatus = successfulDeliveries > 0 ? 'COMPLETED' : 'FAILED';
      await this.prisma.notificationBatch.update({
        where: { id: batchId },
        data: {
          status: finalStatus,
          sentCount: successfulDeliveries,
          failedCount: notifications.length - successfulDeliveries,
          completedAt: new Date(),
        },
      });

      return {
        batchId,
        totalNotifications: notifications.length,
        successfulDeliveries,
        failedDeliveries: notifications.length - successfulDeliveries,
        results: allResults,
      };
    });
  }

  async scheduleNotification(notificationId: string, scheduledFor: Date): Promise<void> {
    return this.executeWithMetrics('scheduleNotification', async () => {
      await this.updateNotification(notificationId, {
        scheduledFor,
        status: 'SCHEDULED',
      });
    });
  }

  async getNotification(id: string): Promise<NotificationWithRelations | null> {
    return this.executeWithMetrics('getNotification', async () => {
      const notification = await this.prisma.notification.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          template: true,
        },
      });

      return notification ? this.mapNotificationToWithRelations(notification) : null;
    });
  }

  async getUserNotifications(
    userId: string, 
    options: NotificationListOptions = {}
  ): Promise<{
    items: NotificationWithRelations[];
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    return this.executeWithMetrics('getUserNotifications', async () => {
      const limit = Math.min(options.limit || 20, 100);
      
      // Build where clause
      const where: Prisma.NotificationWhereInput = {
        userId,
        ...(options.status && { status: options.status }),
        ...(options.category && { category: options.category }),
        ...(options.priority && { priority: options.priority }),
        ...(options.unreadOnly && { readAt: null }),
        ...(options.startDate && { createdAt: { gte: options.startDate } }),
        ...(options.endDate && { createdAt: { lte: options.endDate } }),
      };

      const notifications = await this.prisma.notification.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          template: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit + 1,
        ...(options.cursor && {
          cursor: { id: options.cursor },
          skip: 1,
        }),
      });

      const hasMore = notifications.length > limit;
      if (hasMore) {
        notifications.pop();
      }

      const items = notifications.map(n => this.mapNotificationToWithRelations(n));
      const nextCursor = hasMore ? notifications[notifications.length - 1].id : null;

      return {
        items,
        nextCursor,
        hasMore,
      };
    });
  }

  async getNotificationStats(userId: string): Promise<NotificationStats> {
    return this.executeWithMetrics('getNotificationStats', async () => {
      // Check cache first
      const cacheKey = cacheKeys.userNotificationStats(userId);
      const cached = cache.get<NotificationStats>(cacheKey);
      if (cached) {
        return cached;
      }

      // Aggregate statistics
      const [
        total,
        unread,
        byCategory,
        byPriority,
        byStatus,
      ] = await Promise.all([
        this.prisma.notification.count({ where: { userId } }),
        this.prisma.notification.count({ where: { userId, readAt: null } }),
        this.prisma.notification.groupBy({
          by: ['category'],
          where: { userId },
          _count: true,
        }),
        this.prisma.notification.groupBy({
          by: ['priority'],
          where: { userId },
          _count: true,
        }),
        this.prisma.notification.groupBy({
          by: ['status'],
          where: { userId },
          _count: true,
        }),
      ]);

      const stats: NotificationStats = {
        total,
        unread,
        byCategory: byCategory.reduce((acc, item) => {
          acc[item.category] = item._count;
          return acc;
        }, {} as Record<string, number>) as any,
        byPriority: byPriority.reduce((acc, item) => {
          acc[item.priority] = item._count;
          return acc;
        }, {} as Record<string, number>) as any,
        byStatus: byStatus.reduce((acc, item) => {
          acc[item.status] = item._count;
          return acc;
        }, {} as Record<string, number>) as any,
      };

      // Cache the result
      cache.set(cacheKey, stats, cacheTTL.userStats);

      return stats;
    });
  }

  async createTemplate(input: CreateTemplateInput): Promise<NotificationTemplate> {
    return this.executeWithMetrics('createTemplate', async () => {
      const template = await this.prisma.notificationTemplate.create({
        data: {
          key: input.key,
          name: input.name,
          description: input.description,
          category: input.category,
          priority: input.priority || 'MEDIUM',
          subject: input.subject,
          content: input.content,
          emailContent: input.emailContent,
          variables: input.variables || [],
          isActive: input.isActive !== false,
        },
      });

      return this.mapTemplateToResponse(template);
    });
  }

  async updateTemplate(id: string, input: UpdateTemplateInput): Promise<NotificationTemplate> {
    return this.executeWithMetrics('updateTemplate', async () => {
      const template = await this.prisma.notificationTemplate.update({
        where: { id },
        data: input,
      });

      return this.mapTemplateToResponse(template);
    });
  }

  async getTemplate(key: string): Promise<NotificationTemplate | null> {
    return this.executeWithMetrics('getTemplate', async () => {
      const template = await this.prisma.notificationTemplate.findUnique({
        where: { key },
      });

      return template ? this.mapTemplateToResponse(template) : null;
    });
  }

  async listTemplates(category?: string): Promise<NotificationTemplate[]> {
    return this.executeWithMetrics('listTemplates', async () => {
      const templates = await this.prisma.notificationTemplate.findMany({
        where: {
          isActive: true,
          ...(category && { category }),
        },
        orderBy: {
          name: 'asc',
        },
      });

      return templates.map(t => this.mapTemplateToResponse(t));
    });
  }

  async updateUserPreferences(
    userId: string, 
    preferences: NotificationPreferenceInput[]
  ): Promise<NotificationPreferences[]> {
    return this.executeWithMetrics('updateUserPreferences', async () => {
      // Delete existing preferences
      await this.prisma.notificationPreference.deleteMany({
        where: { userId },
      });

      // Create new preferences
      const createdPreferences = await Promise.all(
        preferences.map(pref =>
          this.prisma.notificationPreference.create({
            data: {
              userId,
              ...pref,
            },
          })
        )
      );

      // Clear cache
      cache.delete(cacheKeys.userNotificationPreferences(userId));

      return createdPreferences.map(p => this.mapPreferenceToResponse(p));
    });
  }

  async getUserPreferences(userId: string): Promise<NotificationPreferences[]> {
    return this.executeWithMetrics('getUserPreferences', async () => {
      // Check cache first
      const cacheKey = cacheKeys.userNotificationPreferences(userId);
      const cached = cache.get<NotificationPreferences[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const preferences = await this.prisma.notificationPreference.findMany({
        where: { userId },
        orderBy: { category: 'asc' },
      });

      const result = preferences.map(p => this.mapPreferenceToResponse(p));

      // Cache the result
      cache.set(cacheKey, result, cacheTTL.userStats);

      return result;
    });
  }

  async getBatch(id: string): Promise<NotificationBatch | null> {
    return this.executeWithMetrics('getBatch', async () => {
      const batch = await this.prisma.notificationBatch.findUnique({
        where: { id },
      });

      return batch;
    });
  }

  async cancelBatch(id: string): Promise<void> {
    return this.executeWithMetrics('cancelBatch', async () => {
      await this.prisma.notificationBatch.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          completedAt: new Date(),
        },
      });
    });
  }

  async getMetrics(filter?: NotificationFilter): Promise<NotificationMetrics> {
    return this.executeWithMetrics('getMetrics', async () => {
      // This is a simplified implementation
      // In production, you'd want to use a separate analytics service
      
      const where: Prisma.NotificationWhereInput = {
        ...(filter?.userId && { userId: filter.userId }),
        ...(filter?.type && { type: filter.type }),
        ...(filter?.category && { category: filter.category }),
        ...(filter?.priority && { priority: filter.priority }),
        ...(filter?.status && { status: filter.status }),
        ...(filter?.createdAfter && { createdAt: { gte: filter.createdAfter } }),
        ...(filter?.createdBefore && { createdAt: { lte: filter.createdBefore } }),
      };

      const [totalSent, totalDelivered, totalFailed, totalRead, totalClicked] = await Promise.all([
        this.prisma.notification.count({ where: { ...where, status: 'SENT' } }),
        this.prisma.notification.count({ where: { ...where, status: 'DELIVERED' } }),
        this.prisma.notification.count({ where: { ...where, status: 'FAILED' } }),
        this.prisma.notification.count({ where: { ...where, readAt: { not: null } } }),
        this.prisma.notification.count({ where: { ...where, clickedAt: { not: null } } }),
      ]);

      const total = totalSent + totalDelivered + totalFailed;

      return {
        deliveryRate: total > 0 ? (totalSent + totalDelivered) / total : 0,
        averageDeliveryTime: 0, // Would need to calculate from sentAt timestamps
        failureRate: total > 0 ? totalFailed / total : 0,
        readRate: totalSent > 0 ? totalRead / totalSent : 0,
        clickRate: totalSent > 0 ? totalClicked / totalSent : 0,
        channelPerformance: {
          REALTIME: { deliveryRate: 0.95, failureRate: 0.05, averageDeliveryTime: 100 },
          EMAIL: { deliveryRate: 0.90, failureRate: 0.10, averageDeliveryTime: 2000 },
          PUSH: { deliveryRate: 0.85, failureRate: 0.15, averageDeliveryTime: 500 },
        },
      };
    });
  }

  async markAsRead(notificationIds: string[], userId: string): Promise<void> {
    return this.executeWithMetrics('markAsRead', async () => {
      await this.prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId,
          readAt: null,
        },
        data: {
          readAt: new Date(),
          status: 'READ',
        },
      });

      // Clear user notification caches
      this.clearUserNotificationCaches(userId);
    });
  }

  async markAllAsRead(userId: string, category?: string): Promise<void> {
    return this.executeWithMetrics('markAllAsRead', async () => {
      await this.prisma.notification.updateMany({
        where: {
          userId,
          readAt: null,
          ...(category && { category }),
        },
        data: {
          readAt: new Date(),
          status: 'READ',
        },
      });

      // Clear user notification caches
      this.clearUserNotificationCaches(userId);
    });
  }

  async cleanupExpiredNotifications(): Promise<number> {
    return this.executeWithMetrics('cleanupExpiredNotifications', async () => {
      const result = await this.prisma.notification.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
          status: {
            in: ['PENDING', 'SCHEDULED', 'FAILED'],
          },
        },
      });

      return result.count;
    });
  }

  async processScheduledNotifications(): Promise<number> {
    return this.executeWithMetrics('processScheduledNotifications', async () => {
      const scheduledNotifications = await this.prisma.notification.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledFor: {
            lte: new Date(),
          },
          expiresAt: {
            gt: new Date(),
          },
        },
        take: 100, // Process in batches
      });

      let processedCount = 0;

      for (const notification of scheduledNotifications) {
        try {
          await this.sendNotification(notification.id);
          processedCount++;
        } catch (error) {
          this.logError(`Failed to send scheduled notification ${notification.id}`, error);
          
          // Update retry count and potentially fail permanently
          const newRetryCount = notification.retryCount + 1;
          if (newRetryCount >= notification.maxRetries) {
            await this.updateNotification(notification.id, {
              status: 'FAILED',
              lastError: error instanceof Error ? error.message : 'Unknown error',
            });
          } else {
            // Reschedule with exponential backoff
            const nextAttempt = new Date(Date.now() + Math.pow(2, newRetryCount) * this.config.retryDelayMs);
            await this.updateNotification(notification.id, {
              scheduledFor: nextAttempt,
              retryCount: newRetryCount,
            });
          }
        }
      }

      return processedCount;
    });
  }

  // Helper methods

  private async sendNotificationBackground(notificationId: string): Promise<void> {
    try {
      await this.sendNotification(notificationId);
    } catch (error) {
      this.logError(`Background notification send failed for ${notificationId}`, error);
    }
  }

  private async validateNotificationInput(input: CreateNotificationInput): Promise<void> {
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
    });

    if (!user) {
      throw new NotificationError('User not found', NotificationErrorCode.INVALID_USER);
    }

    // Verify template exists if specified
    if (input.templateId) {
      const template = await this.prisma.notificationTemplate.findUnique({
        where: { id: input.templateId, isActive: true },
      });

      if (!template) {
        throw new NotificationError('Template not found or inactive', NotificationErrorCode.TEMPLATE_NOT_FOUND);
      }
    }
  }

  private async checkRateLimit(userId: string): Promise<void> {
    const now = Date.now();
    const windowMs = this.config.rateLimit.windowMs;
    const maxRequests = this.config.rateLimit.maxNotificationsPerUser;

    const userLimitKey = `rate_limit_${userId}`;
    let userLimit = this.rateLimitCache.get(userLimitKey);

    if (!userLimit || now > userLimit.resetTime) {
      userLimit = {
        count: 0,
        resetTime: now + windowMs,
      };
    }

    if (userLimit.count >= maxRequests) {
      throw new NotificationError(
        `Rate limit exceeded for user ${userId}`,
        NotificationErrorCode.RATE_LIMITED
      );
    }

    userLimit.count++;
    this.rateLimitCache.set(userLimitKey, userLimit);
  }

  private async renderTemplate(
    templateId: string, 
    variables: Record<string, any>
  ): Promise<{ title: string; content: string; emailContent?: string }> {
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotificationError('Template not found', NotificationErrorCode.TEMPLATE_NOT_FOUND);
    }

    // Simple template rendering (in production, use a proper template engine)
    let title = template.subject;
    let content = template.content;
    let emailContent = template.emailContent;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      title = title.replace(new RegExp(placeholder, 'g'), String(value));
      content = content.replace(new RegExp(placeholder, 'g'), String(value));
      if (emailContent) {
        emailContent = emailContent.replace(new RegExp(placeholder, 'g'), String(value));
      }
    }

    return { title, content, emailContent };
  }

  private async applyUserPreferences(
    userId: string,
    category: string,
    requestedChannels?: NotificationChannel[]
  ): Promise<NotificationChannel[]> {
    const preferences = await this.getUserPreferences(userId);
    const categoryPreference = preferences.find(p => p.category === category);

    if (!categoryPreference || !categoryPreference.isEnabled) {
      return []; // User has disabled this category
    }

    // Intersect requested channels with user's enabled channels
    const userChannels = categoryPreference.channels;
    const effectiveChannels = requestedChannels 
      ? requestedChannels.filter(channel => userChannels.includes(channel))
      : userChannels;

    return effectiveChannels;
  }

  private async isInQuietHours(userId: string, category: string): Promise<boolean> {
    const preferences = await this.getUserPreferences(userId);
    const categoryPreference = preferences.find(p => p.category === category);

    if (!categoryPreference?.quietHoursStart || !categoryPreference?.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const timezone = categoryPreference.timezone || 'UTC';
    
    // This is a simplified implementation
    // In production, you'd use a proper timezone library
    const userTime = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);

    const [currentHour, currentMinute] = userTime.split(':').map(Number);
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = categoryPreference.quietHoursStart.split(':').map(Number);
    const [endHour, endMinute] = categoryPreference.quietHoursEnd.split(':').map(Number);

    const startTimeMinutes = startHour * 60 + startMinute;
    const endTimeMinutes = endHour * 60 + endMinute;

    if (startTimeMinutes <= endTimeMinutes) {
      // Same day (e.g., 9:00 - 17:00)
      return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes;
    } else {
      // Crosses midnight (e.g., 22:00 - 6:00)
      return currentTimeMinutes >= startTimeMinutes || currentTimeMinutes <= endTimeMinutes;
    }
  }

  private async getNextDeliveryTime(userId: string, category: string): Promise<Date> {
    const preferences = await this.getUserPreferences(userId);
    const categoryPreference = preferences.find(p => p.category === category);

    if (!categoryPreference?.quietHoursEnd) {
      return new Date(); // Send immediately if no quiet hours
    }

    const now = new Date();
    const [endHour, endMinute] = categoryPreference.quietHoursEnd.split(':').map(Number);

    const nextDelivery = new Date(now);
    nextDelivery.setHours(endHour, endMinute, 0, 0);

    // If the end time is today but has passed, schedule for tomorrow
    if (nextDelivery <= now) {
      nextDelivery.setDate(nextDelivery.getDate() + 1);
    }

    return nextDelivery;
  }

  private async sendRealtimeNotification(notification: any): Promise<void> {
    // Real-time notifications are disabled - notifications will be fetched via REST API
    this.logger.debug('Real-time notification skipped (WebSocket disabled)', {
      notificationId: notification.id,
      userId: notification.userId,
      type: notification.type,
    });
  }

  private async sendEmailNotification(notification: any): Promise<void> {
    if (!this.emailService) {
      throw new NotificationError('Email service not configured', NotificationErrorCode.EMAIL_SERVICE_ERROR);
    }

    const emailContent = notification.template?.emailContent || notification.content;

    await this.emailService.sendEmail({
      to: notification.user.email,
      subject: notification.title,
      html: emailContent,
      text: notification.content,
    });
  }

  private clearUserNotificationCaches(userId: string): void {
    cache.delete(cacheKeys.userNotificationStats(userId));
    cache.delete(cacheKeys.userNotificationPreferences(userId));
  }

  private mapNotificationToWithRelations(notification: any): NotificationWithRelations {
    return {
      id: notification.id,
      userId: notification.userId,
      templateId: notification.templateId,
      type: notification.type,
      category: notification.category,
      priority: notification.priority,
      title: notification.title,
      content: notification.content,
      data: notification.data,
      channels: notification.channels,
      status: notification.status,
      scheduledFor: notification.scheduledFor,
      sentAt: notification.sentAt,
      readAt: notification.readAt,
      clickedAt: notification.clickedAt,
      expiresAt: notification.expiresAt,
      retryCount: notification.retryCount,
      maxRetries: notification.maxRetries,
      lastError: notification.lastError,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
      template: notification.template ? this.mapTemplateToResponse(notification.template) : undefined,
      user: notification.user,
    };
  }

  private mapTemplateToResponse(template: any): NotificationTemplate {
    return {
      id: template.id,
      key: template.key,
      name: template.name,
      description: template.description,
      category: template.category,
      priority: template.priority,
      subject: template.subject,
      content: template.content,
      emailContent: template.emailContent,
      variables: template.variables,
      isActive: template.isActive,
    };
  }

  private mapPreferenceToResponse(preference: any): NotificationPreferences {
    return {
      id: preference.id,
      userId: preference.userId,
      category: preference.category,
      channels: preference.channels,
      isEnabled: preference.isEnabled,
      quietHoursStart: preference.quietHoursStart,
      quietHoursEnd: preference.quietHoursEnd,
      timezone: preference.timezone,
    };
  }
}

// Activity-specific notification helpers
export class ActivityNotificationHelper {
  constructor(private notificationService: NotificationService) {}

  async notifyActivityCreated(
    userId: string,
    activityData: ActivityNotificationData
  ): Promise<NotificationWithRelations> {
    return this.notificationService.createNotification({
      userId,
      type: 'ACTIVITY_CREATED',
      category: 'ACTIVITY',
      priority: 'LOW',
      title: 'Activity Logged',
      content: `You logged ${(activityData.distance / 1000).toFixed(2)}km of activity`,
      data: activityData,
      channels: ['REALTIME'],
    });
  }

  async notifyActivityMilestone(
    userId: string,
    activityData: ActivityNotificationData
  ): Promise<NotificationWithRelations> {
    const milestoneType = activityData.milestone?.type;
    let title = 'Milestone Reached!';
    let content = 'You\'ve reached a new milestone!';

    if (milestoneType === 'distance') {
      title = 'Distance Milestone!';
      content = `Amazing! You've reached ${activityData.milestone?.value}km total distance!`;
    } else if (milestoneType === 'streak') {
      title = 'Streak Milestone!';
      content = `Incredible! You're on a ${activityData.milestone?.value} day streak!`;
    }

    return this.notificationService.createNotification({
      userId,
      type: 'ACTIVITY_MILESTONE',
      category: 'ACTIVITY',
      priority: 'HIGH',
      title,
      content,
      data: activityData,
      channels: ['REALTIME', 'EMAIL'],
    });
  }
}

// Team-specific notification helpers
export class TeamNotificationHelper {
  constructor(private notificationService: NotificationService) {}

  async notifyTeamMemberJoined(
    teamUserIds: string[],
    teamData: TeamNotificationData
  ): Promise<NotificationBatch> {
    return this.notificationService.createBatchNotification({
      userIds: teamUserIds,
      type: 'TEAM_MEMBER_JOINED',
      category: 'TEAM',
      priority: 'MEDIUM',
      title: 'New Team Member',
      content: `${teamData.memberName} joined ${teamData.teamName}!`,
      data: teamData,
      channels: ['REALTIME'],
      batchName: `Team ${teamData.teamName} - New Member Notification`,
    });
  }

  async notifyTeamGoalCompleted(
    teamUserIds: string[],
    teamData: TeamNotificationData
  ): Promise<NotificationBatch> {
    return this.notificationService.createBatchNotification({
      userIds: teamUserIds,
      type: 'TEAM_GOAL_COMPLETED',
      category: 'TEAM',
      priority: 'HIGH',
      title: 'Goal Completed! 🎉',
      content: `${teamData.teamName} has completed the goal "${teamData.goalName}"!`,
      data: teamData,
      channels: ['REALTIME', 'EMAIL'],
      batchName: `Team ${teamData.teamName} - Goal Completion`,
    });
  }
}

// Achievement-specific notification helpers
export class AchievementNotificationHelper {
  constructor(private notificationService: NotificationService) {}

  async notifyAchievementEarned(
    userId: string,
    achievementData: AchievementNotificationData
  ): Promise<NotificationWithRelations> {
    return this.notificationService.createNotification({
      userId,
      type: 'ACHIEVEMENT_EARNED',
      category: 'ACHIEVEMENT',
      priority: 'HIGH',
      title: 'Achievement Unlocked! 🏆',
      content: `You earned the "${achievementData.achievementName}" achievement!`,
      data: achievementData,
      channels: ['REALTIME', 'EMAIL'],
    });
  }
}

// System notification helpers
export class SystemNotificationHelper {
  constructor(private notificationService: NotificationService) {}

  async notifySystemMaintenance(
    userIds: string[],
    systemData: SystemNotificationData
  ): Promise<NotificationBatch> {
    return this.notificationService.createBatchNotification({
      userIds,
      type: 'SYSTEM_MAINTENANCE',
      category: 'SYSTEM',
      priority: 'URGENT',
      title: 'Scheduled Maintenance',
      content: 'Mile Quest will be undergoing maintenance. Some features may be temporarily unavailable.',
      data: systemData,
      channels: ['REALTIME', 'EMAIL'],
      batchName: 'System Maintenance Notification',
    });
  }
}