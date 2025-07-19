/**
 * Usage examples for the Notification Service
 * Demonstrates common notification patterns in Mile Quest
 */

import { PrismaClient } from '@prisma/client';
import { 
  createNotificationService,
  ActivityNotificationHelper,
  TeamNotificationHelper,
  AchievementNotificationHelper,
  SystemNotificationHelper,
} from './index';
import { createWebSocketService } from '../websocket/factory';

// Example usage patterns for the notification service

export async function setupNotificationService() {
  const prisma = new PrismaClient();
  const websocketService = createWebSocketService();
  
  const notificationService = createNotificationService(prisma, {
    websocketService,
    enableRealtime: true,
    enableEmail: false, // Email service not configured in this example
    rateLimitEnabled: true,
    quietHoursEnabled: true,
  });

  return notificationService;
}

export async function exampleActivityNotifications() {
  const notificationService = await setupNotificationService();
  const activityHelper = new ActivityNotificationHelper(notificationService);

  // Example 1: Notify when user logs an activity
  await activityHelper.notifyActivityCreated('user123', {
    activityId: 'activity456',
    distance: 5200, // 5.2km in meters
    duration: 1800, // 30 minutes
    teamId: 'team789',
    teamName: 'Morning Runners',
  });

  // Example 2: Notify when user reaches a distance milestone
  await activityHelper.notifyActivityMilestone('user123', {
    activityId: 'activity456',
    distance: 5200,
    duration: 1800,
    milestone: {
      type: 'distance',
      value: 100, // 100km total
    },
  });

  // Example 3: Notify when user reaches a streak milestone
  await activityHelper.notifyActivityMilestone('user123', {
    activityId: 'activity456',
    distance: 5200,
    duration: 1800,
    milestone: {
      type: 'streak',
      value: 7, // 7 day streak
    },
  });
}

export async function exampleTeamNotifications() {
  const notificationService = await setupNotificationService();
  const teamHelper = new TeamNotificationHelper(notificationService);

  // Example 1: Notify team when new member joins
  const teamMemberIds = ['user1', 'user2', 'user3', 'user4'];
  await teamHelper.notifyTeamMemberJoined(teamMemberIds, {
    teamId: 'team789',
    teamName: 'Morning Runners',
    memberName: 'Sarah Johnson',
  });

  // Example 2: Notify team when goal is completed
  await teamHelper.notifyTeamGoalCompleted(teamMemberIds, {
    teamId: 'team789',
    teamName: 'Morning Runners',
    goalId: 'goal123',
    goalName: 'London to Paris Virtual Challenge',
    progress: {
      percentage: 100,
      currentDistance: 344000, // 344km
      targetDistance: 344000,
    },
  });
}

export async function exampleAchievementNotifications() {
  const notificationService = await setupNotificationService();
  const achievementHelper = new AchievementNotificationHelper(notificationService);

  // Example: Notify user when they earn an achievement
  await achievementHelper.notifyAchievementEarned('user123', {
    achievementId: 'achievement456',
    achievementName: 'First Steps',
    achievementCategory: 'DISTANCE',
    points: 10,
    badgeUrl: 'https://example.com/badges/first-steps.png',
  });
}

export async function exampleSystemNotifications() {
  const notificationService = await setupNotificationService();
  const systemHelper = new SystemNotificationHelper(notificationService);

  // Example: Notify all users about maintenance
  const allUserIds = ['user1', 'user2', 'user3', 'user4', 'user5'];
  await systemHelper.notifySystemMaintenance(allUserIds, {
    alertLevel: 'warning',
    maintenanceWindow: {
      startTime: new Date('2024-01-20T02:00:00Z'),
      endTime: new Date('2024-01-20T04:00:00Z'),
      description: 'Database optimization and feature updates',
    },
  });
}

export async function exampleNotificationPreferences() {
  const notificationService = await setupNotificationService();

  // Example: Set user notification preferences
  await notificationService.updateUserPreferences('user123', [
    {
      category: 'ACTIVITY',
      channels: ['REALTIME'],
      isEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      timezone: 'America/New_York',
    },
    {
      category: 'TEAM',
      channels: ['REALTIME', 'EMAIL'],
      isEnabled: true,
    },
    {
      category: 'ACHIEVEMENT',
      channels: ['REALTIME', 'EMAIL'],
      isEnabled: true,
    },
    {
      category: 'SYSTEM',
      channels: ['EMAIL'],
      isEnabled: true,
    },
    {
      category: 'REMINDER',
      channels: ['REALTIME'],
      isEnabled: false, // User doesn't want reminders
    },
  ]);
}

export async function exampleScheduledNotifications() {
  const notificationService = await setupNotificationService();

  // Example 1: Schedule a reminder for tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0); // 9 AM tomorrow

  const notification = await notificationService.createNotification({
    userId: 'user123',
    type: 'REMINDER_ACTIVITY',
    category: 'REMINDER',
    priority: 'LOW',
    title: 'Daily Activity Reminder',
    content: 'Don\'t forget to log your activity today!',
    channels: ['REALTIME'],
    scheduledFor: tomorrow,
  });

  // Example 2: Schedule a goal deadline reminder
  const goalDeadline = new Date('2024-01-25T00:00:00Z');
  const reminderTime = new Date(goalDeadline.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days before

  await notificationService.createNotification({
    userId: 'user123',
    type: 'REMINDER_GOAL_DEADLINE',
    category: 'REMINDER',
    priority: 'HIGH',
    title: 'Goal Deadline Approaching',
    content: 'Your team goal ends in 3 days. Current progress: 75%',
    data: {
      goalId: 'goal123',
      daysRemaining: 3,
      currentProgress: 75,
    },
    channels: ['REALTIME', 'EMAIL'],
    scheduledFor: reminderTime,
  });
}

export async function exampleBatchNotifications() {
  const notificationService = await setupNotificationService();

  // Example: Send weekly summary to all team members
  const teamMemberIds = ['user1', 'user2', 'user3', 'user4', 'user5'];

  const batch = await notificationService.createBatchNotification({
    userIds: teamMemberIds,
    type: 'SYSTEM_ANNOUNCEMENT',
    category: 'SYSTEM',
    priority: 'MEDIUM',
    title: 'Weekly Team Summary',
    content: 'Check out your team\'s progress this week!',
    data: {
      weeklyDistance: 125.5,
      weeklyActivities: 28,
      topContributor: 'Alice Smith',
    },
    channels: ['REALTIME', 'EMAIL'],
    batchName: 'Weekly Team Summary - January 15, 2024',
    batchDescription: 'Weekly progress update for all team members',
  });

  console.log(`Created batch notification: ${batch.id}`);
}

export async function exampleNotificationManagement() {
  const notificationService = await setupNotificationService();

  // Example 1: Get user's notifications
  const userNotifications = await notificationService.getUserNotifications('user123', {
    limit: 20,
    unreadOnly: true,
  });

  console.log(`User has ${userNotifications.items.length} unread notifications`);

  // Example 2: Mark notifications as read
  const unreadIds = userNotifications.items.map(n => n.id);
  if (unreadIds.length > 0) {
    await notificationService.markAsRead(unreadIds, 'user123');
  }

  // Example 3: Get notification statistics
  const stats = await notificationService.getNotificationStats('user123');
  console.log('Notification stats:', {
    total: stats.total,
    unread: stats.unread,
    categories: stats.byCategory,
  });

  // Example 4: Clean up expired notifications (background job)
  const cleanedCount = await notificationService.cleanupExpiredNotifications();
  console.log(`Cleaned up ${cleanedCount} expired notifications`);

  // Example 5: Process scheduled notifications (background job)
  const processedCount = await notificationService.processScheduledNotifications();
  console.log(`Processed ${processedCount} scheduled notifications`);
}

export async function exampleTemplateUsage() {
  const notificationService = await setupNotificationService();

  // Example 1: Create a custom template
  const template = await notificationService.createTemplate({
    key: 'custom_celebration',
    name: 'Custom Celebration',
    description: 'Custom notification for special celebrations',
    category: 'ACHIEVEMENT',
    priority: 'HIGH',
    subject: 'Special Achievement: {{achievementName}}',
    content: 'Congratulations {{userName}}! You\'ve achieved {{achievementName}}!',
    emailContent: `
      <h2>🎉 Special Achievement!</h2>
      <p>Congratulations <strong>{{userName}}</strong>!</p>
      <p>You've achieved: <strong>{{achievementName}}</strong></p>
      <p>{{description}}</p>
      <hr>
      <p>Keep up the amazing work!</p>
    `,
    variables: ['userName', 'achievementName', 'description'],
  });

  // Example 2: Use the template to create a notification
  await notificationService.createNotification({
    userId: 'user123',
    type: 'ACHIEVEMENT_EARNED',
    category: 'ACHIEVEMENT',
    templateId: template.id,
    templateVariables: {
      userName: 'John Doe',
      achievementName: 'Marathon Master',
      description: 'Completed your first virtual marathon!',
    },
    channels: ['REALTIME', 'EMAIL'],
  });
}

// Integration with existing services
export async function integrateWithActivityService() {
  const notificationService = await setupNotificationService();
  const activityHelper = new ActivityNotificationHelper(notificationService);

  // This would be called from the ActivityService when a new activity is created
  const handleNewActivity = async (activityData: any) => {
    // Send basic activity notification
    await activityHelper.notifyActivityCreated(activityData.userId, {
      activityId: activityData.id,
      distance: activityData.distance,
      duration: activityData.duration,
      teamId: activityData.teamId,
      teamName: activityData.team?.name,
    });

    // Check for milestones and send additional notifications
    if (activityData.milestones) {
      for (const milestone of activityData.milestones) {
        await activityHelper.notifyActivityMilestone(activityData.userId, {
          activityId: activityData.id,
          distance: activityData.distance,
          duration: activityData.duration,
          milestone: {
            type: milestone.type,
            value: milestone.value,
            target: milestone.target,
          },
        });
      }
    }
  };

  return { handleNewActivity };
}