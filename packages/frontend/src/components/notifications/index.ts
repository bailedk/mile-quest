/**
 * Activity Notifications Components
 * 
 * Real-time activity notifications system for Mile Quest
 */

export { 
  ActivityNotifications, 
  NotificationToast,
  type ActivityNotification,
  type NotificationType 
} from './ActivityNotifications';

export { 
  useActivityNotifications,
  type UseActivityNotificationsOptions,
  type UseActivityNotificationsReturn 
} from '../../hooks/useActivityNotifications';

export { ActivityNotificationsDemo } from './ActivityNotificationsDemo';

// Re-export for convenience
export { default as ActivityNotifications } from './ActivityNotifications';
export { default as useActivityNotifications } from '../../hooks/useActivityNotifications';