/**
 * Notification Service Exports
 * Real-time notification system for Mile Quest
 */

export * from './types';
export {
  NotificationServiceImpl,
  ActivityNotificationHelper,
  TeamNotificationHelper,
  AchievementNotificationHelper,
  SystemNotificationHelper,
} from './notification.service';

// Factory function for creating notification service instances
import { PrismaClient } from '@prisma/client';
import { ServiceConfig, ServiceMetrics } from '../aws/base-service';
import { WebSocketService } from '../websocket/types';
import { EmailService } from '../email/types';
import { NotificationServiceImpl } from './notification.service';
import { NotificationServiceConfig } from './types';

interface NotificationServiceFactoryConfig extends NotificationServiceConfig, ServiceConfig {
  websocketService?: WebSocketService;
  emailService?: EmailService;
}

export function createNotificationService(
  prisma: PrismaClient,
  config?: NotificationServiceFactoryConfig,
  metrics?: ServiceMetrics
): NotificationServiceImpl {
  return new NotificationServiceImpl(prisma, config, metrics);
}

export function createProductionNotificationService(
  prisma: PrismaClient,
  websocketService: WebSocketService,
  emailService: EmailService,
  overrides?: Partial<NotificationServiceFactoryConfig>,
  metrics?: ServiceMetrics
): NotificationServiceImpl {
  const productionConfig: NotificationServiceFactoryConfig = {
    maxBatchSize: 1000,
    defaultRetryCount: 5,
    retryDelayMs: 5000,
    enableRealtime: true,
    enableEmail: true,
    enablePush: false,
    quietHoursEnabled: true,
    rateLimitEnabled: true,
    rateLimit: {
      maxNotificationsPerUser: 100,
      windowMs: 60000,
    },
    defaultExpirationHours: 168, // 7 days
    enableMetrics: true,
    enableScheduling: true,
    websocketService,
    emailService,
    ...overrides,
  };

  return new NotificationServiceImpl(prisma, productionConfig, metrics);
}

export function createTestNotificationService(
  prisma: PrismaClient,
  overrides?: Partial<NotificationServiceFactoryConfig>
): NotificationServiceImpl {
  const testConfig: NotificationServiceFactoryConfig = {
    maxBatchSize: 100,
    defaultRetryCount: 1,
    retryDelayMs: 100,
    enableRealtime: true,
    enableEmail: false,
    enablePush: false,
    quietHoursEnabled: false,
    rateLimitEnabled: false,
    defaultExpirationHours: 24,
    enableMetrics: false,
    enableScheduling: false,
    ...overrides,
  };

  return new NotificationServiceImpl(prisma, testConfig);
}