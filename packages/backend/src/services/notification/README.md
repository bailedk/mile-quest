# Notification Service

Real-time notification system for Mile Quest with multi-channel delivery, templates, user preferences, and scheduling capabilities.

## Overview

The Notification Service provides a comprehensive solution for delivering notifications to users across multiple channels (real-time WebSocket, email, push notifications). It includes features like:

- **Multi-channel delivery**: Real-time WebSocket, email, and push notifications
- **Template system**: Reusable notification templates with variable substitution
- **User preferences**: Channel preferences, quiet hours, and category settings
- **Scheduled notifications**: Send notifications at specific times
- **Batch notifications**: Send the same notification to multiple users
- **Rate limiting**: Prevent notification spam
- **Retry logic**: Automatic retry with exponential backoff
- **Analytics**: Delivery metrics and performance tracking

## Architecture

```
NotificationService
├── Core Service (notification.service.ts)
├── Types & Interfaces (types.ts)
├── Templates (templates.ts)
├── Usage Examples (usage-examples.ts)
├── Helper Classes
│   ├── ActivityNotificationHelper
│   ├── TeamNotificationHelper
│   ├── AchievementNotificationHelper
│   └── SystemNotificationHelper
└── Tests (__tests__/)
```

## Database Schema

The service adds the following tables to the database:

- `notification_templates`: Reusable notification templates
- `notifications`: Individual notification records
- `notification_preferences`: User notification preferences
- `notification_batches`: Batch notification tracking

## Usage

### Basic Setup

```typescript
import { createNotificationService } from './services/notification';
import { createWebSocketService } from './services/websocket/factory';

const prisma = new PrismaClient();
const websocketService = createWebSocketService();

const notificationService = createNotificationService(prisma, {
  websocketService,
  enableRealtime: true,
  enableEmail: true,
  rateLimitEnabled: true,
});
```

### Sending Notifications

#### Basic Notification

```typescript
const notification = await notificationService.createNotification({
  userId: 'user123',
  type: 'ACTIVITY_CREATED',
  category: 'ACTIVITY',
  priority: 'LOW',
  title: 'Activity Logged',
  content: 'You logged 5.2km of activity',
  channels: ['REALTIME'],
});
```

#### Using Templates

```typescript
// Create a template
await notificationService.createTemplate({
  key: 'activity_logged',
  name: 'Activity Logged',
  category: 'ACTIVITY',
  subject: 'Activity Logged',
  content: 'You logged {{distance}}km of activity',
  variables: ['distance'],
});

// Use the template
await notificationService.createNotification({
  userId: 'user123',
  type: 'ACTIVITY_CREATED',
  category: 'ACTIVITY',
  templateId: 'template-id',
  templateVariables: {
    distance: '5.2',
  },
  channels: ['REALTIME'],
});
```

#### Scheduled Notifications

```typescript
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);

await notificationService.createNotification({
  userId: 'user123',
  type: 'REMINDER_ACTIVITY',
  category: 'REMINDER',
  title: 'Daily Reminder',
  content: 'Don\'t forget to log your activity!',
  scheduledFor: tomorrow,
  channels: ['REALTIME'],
});
```

#### Batch Notifications

```typescript
const teamMemberIds = ['user1', 'user2', 'user3'];

const batch = await notificationService.createBatchNotification({
  userIds: teamMemberIds,
  type: 'TEAM_GOAL_COMPLETED',
  category: 'TEAM',
  title: 'Goal Completed! 🎉',
  content: 'Your team has completed the goal!',
  channels: ['REALTIME', 'EMAIL'],
  batchName: 'Goal Completion Notification',
});
```

### Helper Classes

The service includes helper classes for common notification patterns:

#### Activity Notifications

```typescript
import { ActivityNotificationHelper } from './services/notification';

const activityHelper = new ActivityNotificationHelper(notificationService);

// Notify when user logs activity
await activityHelper.notifyActivityCreated('user123', {
  activityId: 'activity456',
  distance: 5200,
  duration: 1800,
  teamName: 'Morning Runners',
});

// Notify when user reaches milestone
await activityHelper.notifyActivityMilestone('user123', {
  activityId: 'activity456',
  distance: 5200,
  duration: 1800,
  milestone: {
    type: 'distance',
    value: 100, // 100km total
  },
});
```

#### Team Notifications

```typescript
import { TeamNotificationHelper } from './services/notification';

const teamHelper = new TeamNotificationHelper(notificationService);

// Notify when new member joins
await teamHelper.notifyTeamMemberJoined(teamUserIds, {
  teamId: 'team789',
  teamName: 'Morning Runners',
  memberName: 'Sarah Johnson',
});

// Notify when goal is completed
await teamHelper.notifyTeamGoalCompleted(teamUserIds, {
  teamId: 'team789',
  teamName: 'Morning Runners',
  goalName: 'London to Paris Challenge',
  progress: {
    percentage: 100,
    currentDistance: 344000,
    targetDistance: 344000,
  },
});
```

#### Achievement Notifications

```typescript
import { AchievementNotificationHelper } from './services/notification';

const achievementHelper = new AchievementNotificationHelper(notificationService);

await achievementHelper.notifyAchievementEarned('user123', {
  achievementId: 'achievement456',
  achievementName: 'First Steps',
  achievementCategory: 'DISTANCE',
  points: 10,
});
```

### User Preferences

```typescript
// Set user notification preferences
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
    category: 'SYSTEM',
    channels: ['EMAIL'],
    isEnabled: true,
  },
]);

// Get user preferences
const preferences = await notificationService.getUserPreferences('user123');
```

### Managing Notifications

```typescript
// Get user's notifications
const notifications = await notificationService.getUserNotifications('user123', {
  limit: 20,
  unreadOnly: true,
});

// Mark notifications as read
const unreadIds = notifications.items.map(n => n.id);
await notificationService.markAsRead(unreadIds, 'user123');

// Get notification statistics
const stats = await notificationService.getNotificationStats('user123');
console.log(`Total: ${stats.total}, Unread: ${stats.unread}`);
```

## Background Jobs

The service includes methods for background processing:

```typescript
// Process scheduled notifications (run every minute)
const processedCount = await notificationService.processScheduledNotifications();

// Clean up expired notifications (run daily)
const cleanedCount = await notificationService.cleanupExpiredNotifications();
```

## Integration with WebSocket Service

The notification service integrates with the existing WebSocket service for real-time delivery:

```typescript
// Real-time notifications are automatically sent to:
const channel = `private-user-${userId}`;
const event = 'notification';

// Data format:
{
  id: 'notification123',
  type: 'ACTIVITY_CREATED',
  category: 'ACTIVITY',
  priority: 'LOW',
  title: 'Activity Logged',
  content: 'You logged 5.2km of activity',
  data: { activityId: 'activity456' },
  createdAt: '2024-01-15T10:30:00Z'
}
```

## Integration with Email Service

When email notifications are enabled, the service uses the existing email service:

```typescript
// Email content can be customized in templates
emailContent: `
  <h2>{{title}}</h2>
  <p>{{content}}</p>
  <hr>
  <p>View in Mile Quest app</p>
`
```

## Error Handling

The service includes comprehensive error handling:

```typescript
import { NotificationError, NotificationErrorCode } from './services/notification';

try {
  await notificationService.createNotification(input);
} catch (error) {
  if (error instanceof NotificationError) {
    switch (error.code) {
      case NotificationErrorCode.INVALID_USER:
        // Handle invalid user
        break;
      case NotificationErrorCode.RATE_LIMITED:
        // Handle rate limiting
        break;
      case NotificationErrorCode.TEMPLATE_NOT_FOUND:
        // Handle missing template
        break;
    }
  }
}
```

## Configuration

The service supports extensive configuration:

```typescript
const config = {
  maxBatchSize: 1000,
  defaultRetryCount: 3,
  retryDelayMs: 5000,
  enableRealtime: true,
  enableEmail: true,
  enablePush: false,
  quietHoursEnabled: true,
  rateLimitEnabled: true,
  rateLimit: {
    maxNotificationsPerUser: 100,
    windowMs: 60000, // 1 minute
  },
  defaultExpirationHours: 168, // 7 days
  enableMetrics: true,
  enableScheduling: true,
};
```

## Testing

The service includes comprehensive tests:

```bash
npm test -- notification.service.test.ts
```

Test coverage includes:
- Creating notifications with various configurations
- Template rendering and variable substitution
- User preference filtering
- Scheduled notification processing
- Batch notification handling
- Error scenarios and edge cases
- Helper class functionality

## Performance Considerations

- **Caching**: User preferences and notification stats are cached
- **Rate Limiting**: Prevents notification spam
- **Batch Processing**: Efficient handling of multiple notifications
- **Lazy Loading**: Templates and preferences loaded on demand
- **Background Jobs**: Scheduled and expired notification processing

## Security

- **User Isolation**: Users can only access their own notifications
- **Input Validation**: All inputs are validated before processing
- **Rate Limiting**: Prevents abuse and spam
- **Template Sandboxing**: Template variables are safely substituted

## Monitoring

The service provides metrics and monitoring:

```typescript
const metrics = await notificationService.getMetrics({
  createdAfter: lastWeek,
});

console.log({
  deliveryRate: metrics.deliveryRate,
  failureRate: metrics.failureRate,
  readRate: metrics.readRate,
  channelPerformance: metrics.channelPerformance,
});
```

## Default Templates

The service includes pre-built templates for common scenarios:

- Activity creation and milestones
- Team member joins and goal completion
- Achievement unlocks
- System announcements and maintenance
- Reminders and deadline notifications
- Social invitations and interactions

See `templates.ts` for the complete list of default templates.

## Migration

To add the notification system to an existing database:

1. Update your Prisma schema with the notification models
2. Run the Prisma migration: `npx prisma migrate dev`
3. Seed default templates: `node -e "require('./services/notification/templates').seedNotificationTemplates()"`

## Future Enhancements

Planned features for future versions:

- Push notification support (iOS/Android)
- Rich content notifications with images and buttons
- Notification grouping and threading
- Advanced template engine with conditional logic
- A/B testing for notification content
- Integration with external notification services
- Advanced analytics and conversion tracking