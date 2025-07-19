/**
 * Notification service interface and types
 * Real-time notification system with multi-channel delivery
 */

import { 
  NotificationType, 
  NotificationCategory, 
  NotificationPriority, 
  NotificationChannel, 
  NotificationStatus,
  NotificationBatchStatus,
  Prisma 
} from '@prisma/client';

export interface NotificationData {
  [key: string]: any;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  category: NotificationCategory;
  priority?: NotificationPriority;
  title: string;
  content: string;
  data?: NotificationData;
  channels?: NotificationChannel[];
  scheduledFor?: Date;
  expiresAt?: Date;
  templateId?: string;
  templateVariables?: Record<string, any>;
}

export interface CreateBatchNotificationInput {
  userIds: string[];
  type: NotificationType;
  category: NotificationCategory;
  priority?: NotificationPriority;
  title: string;
  content: string;
  data?: NotificationData;
  channels?: NotificationChannel[];
  scheduledFor?: Date;
  expiresAt?: Date;
  templateId?: string;
  templateVariables?: Record<string, any>;
  batchName?: string;
  batchDescription?: string;
}

export interface UpdateNotificationInput {
  status?: NotificationStatus;
  readAt?: Date;
  clickedAt?: Date;
}

export interface NotificationTemplate {
  id: string;
  key: string;
  name: string;
  description?: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  subject: string;
  content: string;
  emailContent?: string;
  variables: string[];
  isActive: boolean;
}

export interface NotificationPreferences {
  id: string;
  userId: string;
  category: NotificationCategory;
  channels: NotificationChannel[];
  isEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone?: string;
}

export interface NotificationWithRelations {
  id: string;
  userId: string;
  templateId?: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  content: string;
  data?: NotificationData;
  channels: NotificationChannel[];
  status: NotificationStatus;
  scheduledFor?: Date;
  sentAt?: Date;
  readAt?: Date;
  clickedAt?: Date;
  expiresAt?: Date;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
  template?: NotificationTemplate;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
}

export interface NotificationBatch {
  id: string;
  name?: string;
  description?: string;
  type: NotificationType;
  category: NotificationCategory;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  status: NotificationBatchStatus;
  scheduledFor?: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationListOptions {
  cursor?: string;
  limit?: number;
  status?: NotificationStatus;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  unreadOnly?: boolean;
  startDate?: Date;
  endDate?: Date;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byCategory: Record<NotificationCategory, number>;
  byPriority: Record<NotificationPriority, number>;
  byStatus: Record<NotificationStatus, number>;
}

export interface CreateTemplateInput {
  key: string;
  name: string;
  description?: string;
  category: NotificationCategory;
  priority?: NotificationPriority;
  subject: string;
  content: string;
  emailContent?: string;
  variables?: string[];
  isActive?: boolean;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  priority?: NotificationPriority;
  subject?: string;
  content?: string;
  emailContent?: string;
  variables?: string[];
  isActive?: boolean;
}

export interface NotificationPreferenceInput {
  category: NotificationCategory;
  channels: NotificationChannel[];
  isEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone?: string;
}

export interface NotificationDeliveryResult {
  notificationId: string;
  success: boolean;
  channel: NotificationChannel;
  deliveredAt?: Date;
  error?: string;
}

export interface BatchDeliveryResult {
  batchId: string;
  totalNotifications: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  results: NotificationDeliveryResult[];
}

export interface NotificationMetrics {
  deliveryRate: number;
  averageDeliveryTime: number;
  failureRate: number;
  readRate: number;
  clickRate: number;
  channelPerformance: Record<NotificationChannel, {
    deliveryRate: number;
    failureRate: number;
    averageDeliveryTime: number;
  }>;
}

export interface NotificationFilter {
  userId?: string;
  type?: NotificationType;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  status?: NotificationStatus;
  channel?: NotificationChannel;
  scheduledAfter?: Date;
  scheduledBefore?: Date;
  createdAfter?: Date;
  createdBefore?: Date;
  templateId?: string;
}

export interface ScheduledNotificationJob {
  id: string;
  notificationId: string;
  scheduledFor: Date;
  retryCount: number;
  maxRetries: number;
  lastAttempt?: Date;
  nextAttempt?: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

// Activity-specific notification types
export interface ActivityNotificationData extends NotificationData {
  activityId: string;
  distance: number;
  duration: number;
  teamId?: string;
  teamName?: string;
  milestone?: {
    type: 'distance' | 'streak' | 'goal_progress';
    value: number;
    target?: number;
  };
}

// Team-specific notification types
export interface TeamNotificationData extends NotificationData {
  teamId: string;
  teamName: string;
  goalId?: string;
  goalName?: string;
  memberName?: string;
  progress?: {
    percentage: number;
    currentDistance: number;
    targetDistance: number;
  };
}

// Achievement-specific notification types
export interface AchievementNotificationData extends NotificationData {
  achievementId: string;
  achievementName: string;
  achievementCategory: string;
  points: number;
  streak?: number;
  badgeUrl?: string;
}

// System notification types
export interface SystemNotificationData extends NotificationData {
  alertLevel?: 'info' | 'warning' | 'error';
  actionRequired?: boolean;
  actionUrl?: string;
  maintenanceWindow?: {
    startTime: Date;
    endTime: Date;
    description: string;
  };
}

export class NotificationError extends Error {
  constructor(
    message: string,
    public code: NotificationErrorCode,
    public originalError?: any
  ) {
    super(message);
    this.name = 'NotificationError';
  }
}

export enum NotificationErrorCode {
  // Validation errors
  INVALID_USER = 'INVALID_USER',
  INVALID_TEMPLATE = 'INVALID_TEMPLATE',
  INVALID_CHANNEL = 'INVALID_CHANNEL',
  INVALID_SCHEDULE = 'INVALID_SCHEDULE',
  
  // Delivery errors
  DELIVERY_FAILED = 'DELIVERY_FAILED',
  CHANNEL_UNAVAILABLE = 'CHANNEL_UNAVAILABLE',
  USER_PREFERENCES_BLOCKED = 'USER_PREFERENCES_BLOCKED',
  QUIET_HOURS_ACTIVE = 'QUIET_HOURS_ACTIVE',
  
  // Template errors
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND',
  TEMPLATE_RENDER_FAILED = 'TEMPLATE_RENDER_FAILED',
  MISSING_VARIABLES = 'MISSING_VARIABLES',
  
  // Rate limiting
  RATE_LIMITED = 'RATE_LIMITED',
  BATCH_TOO_LARGE = 'BATCH_TOO_LARGE',
  
  // Service errors
  WEBSOCKET_ERROR = 'WEBSOCKET_ERROR',
  EMAIL_SERVICE_ERROR = 'EMAIL_SERVICE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  
  // Other
  NOTIFICATION_EXPIRED = 'NOTIFICATION_EXPIRED',
  BATCH_CANCELLED = 'BATCH_CANCELLED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface NotificationServiceConfig {
  maxBatchSize?: number;
  defaultRetryCount?: number;
  retryDelayMs?: number;
  enableRealtime?: boolean;
  enableEmail?: boolean;
  enablePush?: boolean;
  quietHoursEnabled?: boolean;
  rateLimitEnabled?: boolean;
  rateLimit?: {
    maxNotificationsPerUser: number;
    windowMs: number;
  };
  defaultExpirationHours?: number;
  enableMetrics?: boolean;
  enableScheduling?: boolean;
}

export interface NotificationService {
  // Core notification operations
  createNotification(input: CreateNotificationInput): Promise<NotificationWithRelations>;
  createBatchNotification(input: CreateBatchNotificationInput): Promise<NotificationBatch>;
  updateNotification(id: string, input: UpdateNotificationInput): Promise<NotificationWithRelations>;
  deleteNotification(id: string): Promise<void>;
  
  // Delivery operations
  sendNotification(notificationId: string): Promise<NotificationDeliveryResult[]>;
  sendBatchNotifications(batchId: string): Promise<BatchDeliveryResult>;
  scheduleNotification(notificationId: string, scheduledFor: Date): Promise<void>;
  
  // Querying operations
  getNotification(id: string): Promise<NotificationWithRelations | null>;
  getUserNotifications(userId: string, options?: NotificationListOptions): Promise<{
    items: NotificationWithRelations[];
    nextCursor: string | null;
    hasMore: boolean;
  }>;
  getNotificationStats(userId: string): Promise<NotificationStats>;
  
  // Template operations
  createTemplate(input: CreateTemplateInput): Promise<NotificationTemplate>;
  updateTemplate(id: string, input: UpdateTemplateInput): Promise<NotificationTemplate>;
  getTemplate(key: string): Promise<NotificationTemplate | null>;
  listTemplates(category?: NotificationCategory): Promise<NotificationTemplate[]>;
  
  // Preference operations
  updateUserPreferences(userId: string, preferences: NotificationPreferenceInput[]): Promise<NotificationPreferences[]>;
  getUserPreferences(userId: string): Promise<NotificationPreferences[]>;
  
  // Batch operations
  getBatch(id: string): Promise<NotificationBatch | null>;
  cancelBatch(id: string): Promise<void>;
  
  // Analytics and metrics
  getMetrics(filter?: NotificationFilter): Promise<NotificationMetrics>;
  
  // Utility operations
  markAsRead(notificationIds: string[], userId: string): Promise<void>;
  markAllAsRead(userId: string, category?: NotificationCategory): Promise<void>;
  cleanupExpiredNotifications(): Promise<number>;
  processScheduledNotifications(): Promise<number>;
}