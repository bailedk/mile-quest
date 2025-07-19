# Activity Notifications System

A comprehensive real-time notification system for Mile Quest that provides toast-style notifications for team activities, achievements, and milestones.

## Features

- 🔔 **Real-time notifications** for team activities and achievements
- 🎯 **Toast-style UI** with auto-dismiss and manual controls
- 📱 **Mobile-first responsive design** 
- 🔊 **Optional sound notifications** for high-priority events
- 📚 **Notification history** with persistent storage
- ⚙️ **Flexible configuration** and positioning options
- 🚀 **TypeScript support** with full type safety
- 🎨 **Customizable styling** and themes
- ♿ **Accessible** with proper ARIA labels and keyboard navigation

## Components

### `ActivityNotifications`

Main notification container component that manages the display and lifecycle of notifications.

```tsx
import { ActivityNotifications } from '@/components/notifications';

function App() {
  return (
    <div>
      {/* Your app content */}
      
      <ActivityNotifications
        maxVisible={3}
        position="top-right"
        enableSound={true}
        enableHistory={true}
        autoHideDuration={5000}
      />
    </div>
  );
}
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `maxVisible` | `number` | `3` | Maximum number of visible notifications |
| `position` | `'top-right' \| 'top-left' \| 'bottom-right' \| 'bottom-left'` | `'top-right'` | Screen position for notifications |
| `enableSound` | `boolean` | `true` | Enable sound for high-priority notifications |
| `enableHistory` | `boolean` | `true` | Keep notification history |
| `autoHideDuration` | `number` | `5000` | Auto-hide duration in milliseconds |
| `className` | `string` | `''` | Additional CSS classes |

### `NotificationToast`

Individual notification component with entrance/exit animations and user interactions.

```tsx
import { NotificationToast } from '@/components/notifications';

function CustomNotificationContainer() {
  return (
    <NotificationToast
      notification={notification}
      onDismiss={() => removeNotification(notification.id)}
      onMarkRead={() => markAsRead(notification.id)}
      index={0}
    />
  );
}
```

## Hooks

### `useActivityNotifications`

Main hook for managing notification state and interactions.

```tsx
import { useActivityNotifications } from '@/components/notifications';

function MyComponent() {
  const {
    notifications,
    history,
    soundEnabled,
    addNotification,
    removeNotification,
    markAsRead,
    clearAll,
    clearHistory,
    toggleSound,
    unreadCount,
    historyCount
  } = useActivityNotifications({
    maxVisible: 3,
    enableSound: true,
    enableHistory: true,
    autoHideDuration: 5000,
    onNotification: (notification) => {
      console.log('New notification:', notification);
    },
    onAchievement: (achievement) => {
      console.log('Achievement earned:', achievement);
    }
  });

  // Use the hook methods...
}
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxVisible` | `number` | `3` | Maximum visible notifications |
| `enableSound` | `boolean` | `true` | Enable sound notifications |
| `enableHistory` | `boolean` | `true` | Keep notification history |
| `autoHideDuration` | `number` | `5000` | Auto-hide duration (ms) |
| `filter` | `(notification) => boolean` | - | Filter function for notifications |
| `onNotification` | `(notification) => void` | - | Handler for new notifications |
| `onAchievement` | `(achievement) => void` | - | Handler for achievement notifications |
| `onTeamMilestone` | `(milestone) => void` | - | Handler for team milestone notifications |
| `enableLogging` | `boolean` | `false` | Enable debug logging |

#### Return Values

| Property | Type | Description |
|----------|------|-------------|
| `notifications` | `ActivityNotification[]` | Currently visible notifications |
| `history` | `ActivityNotification[]` | Notification history |
| `soundEnabled` | `boolean` | Current sound setting |
| `isConnected` | `boolean` | WebSocket connection status |
| `addNotification` | `Function` | Add a new notification |
| `removeNotification` | `Function` | Remove a notification by ID |
| `markAsRead` | `Function` | Mark a notification as read |
| `clearAll` | `Function` | Clear all notifications |
| `clearHistory` | `Function` | Clear notification history |
| `toggleSound` | `Function` | Toggle sound on/off |
| `unreadCount` | `number` | Number of unread notifications |
| `totalCount` | `number` | Total active notifications |
| `historyCount` | `number` | Total history items |

## Notification Types

The system supports different types of notifications:

```typescript
type NotificationType = 
  | 'activity:created'     // New team member activity
  | 'activity:achievement' // Personal achievement earned
  | 'team:milestone'       // Team milestone reached
  | 'team:goal_progress'   // Team goal progress update
  | 'personal:achievement' // Personal achievement
```

### Custom Notifications

You can create custom notifications:

```tsx
const { addNotification } = useActivityNotifications();

// Add a custom notification
addNotification({
  type: 'team:milestone',
  title: 'Team Milestone!',
  message: 'Your team reached 50% of the goal to San Francisco!',
  icon: '🎯',
  priority: 'high',
  autoHide: true
});
```

## Integration with WebSocket

The notification system automatically integrates with the existing WebSocket context:

```tsx
import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { ActivityNotifications } from '@/components/notifications';

function App() {
  return (
    <WebSocketProvider enableActivityFeed={true}>
      <YourAppContent />
      <ActivityNotifications />
    </WebSocketProvider>
  );
}
```

The system will automatically:
- Subscribe to activity feed updates
- Create notifications for new team activities
- Handle real-time achievement notifications
- Manage notification state and lifecycle

## Styling and Theming

The notifications use Tailwind CSS classes and can be customized:

### Priority-based Colors

- **High Priority**: Red gradient (`from-red-500 to-red-600`)
- **Medium Priority**: Blue gradient (`from-blue-500 to-blue-600`)
- **Low Priority**: Gray gradient (`from-gray-500 to-gray-600`)

### Custom Styling

You can override styles by providing custom CSS classes:

```tsx
<ActivityNotifications 
  className="custom-notifications"
  // ... other props
/>
```

## Accessibility

The notification system includes accessibility features:

- **ARIA labels** for screen readers
- **Keyboard navigation** support
- **High contrast** color combinations
- **Reduced motion** respect for user preferences
- **Focus management** for interactive elements

## Browser Notifications

When users grant notification permissions, the system will also show native browser notifications for high-priority events:

```tsx
import { pwaService } from '@/services/pwa.service';

// Check permission status
const permission = pwaService.getNotificationPermission();

// Request permission
await pwaService.requestNotificationPermission();
```

## Performance Considerations

- **Automatic cleanup** of old notifications
- **Memory management** for notification history
- **Debounced updates** to prevent excessive re-renders
- **Efficient WebSocket** subscription management
- **Lazy loading** of notification components

## Testing

Use the demo component for testing:

```tsx
import { ActivityNotificationsDemo } from '@/components/notifications';

function TestPage() {
  return <ActivityNotificationsDemo />;
}
```

The demo includes:
- Interactive controls for all settings
- Sample notification generators
- Real-time statistics
- Usage examples

## Migration Guide

If migrating from existing notification systems:

1. **Replace existing notification components** with `ActivityNotifications`
2. **Update WebSocket handlers** to use the new activity feed system
3. **Migrate custom notification logic** to use `useActivityNotifications` hook
4. **Update styling** to match the new design system

## Support

For issues or questions:
- Check the TypeScript types for component interfaces
- Use the demo component for testing and examples
- Enable `enableLogging: true` for debugging
- Review WebSocket integration in the context provider

## Changelog

### v1.0.0 (2025-01-17)
- Initial implementation
- Real-time activity notifications
- Achievement and milestone support
- Mobile-responsive design
- Sound notifications
- Notification history
- TypeScript support
- Accessibility features