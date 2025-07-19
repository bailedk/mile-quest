import { useCallback, useEffect, useRef, useState } from 'react';
import { useWebSocketContext } from '@/contexts/WebSocketContext';
import { ActivityFeedUpdate } from './useActivityFeed';
import { Achievement } from './useRealtimeUpdates';
import { ActivityNotification, NotificationType } from '@/components/notifications/ActivityNotifications';

export interface UseActivityNotificationsOptions {
  /**
   * Maximum number of visible notifications at once
   */
  maxVisible?: number;
  
  /**
   * Enable sound notifications
   */
  enableSound?: boolean;
  
  /**
   * Keep notification history
   */
  enableHistory?: boolean;
  
  /**
   * Auto-hide duration in milliseconds
   */
  autoHideDuration?: number;
  
  /**
   * Filter function for notifications
   */
  filter?: (notification: ActivityNotification) => boolean;
  
  /**
   * Custom handlers for specific notification types
   */
  onNotification?: (notification: ActivityNotification) => void;
  onAchievement?: (achievement: Achievement) => void;
  onTeamMilestone?: (milestone: any) => void;
  
  /**
   * Enable logging for debugging
   */
  enableLogging?: boolean;
}

export interface UseActivityNotificationsReturn {
  // State
  notifications: ActivityNotification[];
  history: ActivityNotification[];
  soundEnabled: boolean;
  isConnected: boolean;
  
  // Actions
  addNotification: (notification: Partial<ActivityNotification>) => void;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;
  clearHistory: () => void;
  toggleSound: () => void;
  
  // Helpers
  createActivityNotification: (activity: any) => ActivityNotification;
  createAchievementNotification: (achievement: Achievement) => ActivityNotification;
  createTeamMilestoneNotification: (milestone: any) => ActivityNotification;
  
  // Stats
  unreadCount: number;
  totalCount: number;
  historyCount: number;
}

export function useActivityNotifications(
  options: UseActivityNotificationsOptions = {}
): UseActivityNotificationsReturn {
  const {
    maxVisible = 3,
    enableSound = true,
    enableHistory = true,
    autoHideDuration = 5000,
    filter,
    onNotification,
    onAchievement,
    onTeamMilestone,
    enableLogging = false
  } = options;

  const { 
    activityFeed, 
    feedNewCount, 
    isConnected,
    clearNewActivityFlags 
  } = useWebSocketContext();

  const [notifications, setNotifications] = useState<ActivityNotification[]>([]);
  const [history, setHistory] = useState<ActivityNotification[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(enableSound);
  
  const processedActivityIds = useRef<Set<string>>(new Set());
  const notificationTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const log = useCallback((message: string, data?: any) => {
    if (enableLogging) {
      console.log(`[ActivityNotifications] ${message}`, data);
    }
  }, [enableLogging]);

  // Create notification from activity data
  const createActivityNotification = useCallback((activity: any): ActivityNotification => {
    const notificationId = `activity-${activity.id}-${Date.now()}`;
    
    return {
      id: notificationId,
      type: 'activity:created' as NotificationType,
      title: 'New Team Activity',
      message: `${activity.userName || 'Team member'} completed a ${formatDistance(activity.distance)} ${getActivityType(activity)}`,
      icon: getActivityIcon(activity.source || 'MANUAL'),
      timestamp: Date.now(),
      data: activity,
      isRead: false,
      autoHide: true,
      priority: 'medium'
    };
  }, []);

  // Create notification from achievement
  const createAchievementNotification = useCallback((achievement: Achievement): ActivityNotification => {
    const notificationId = `achievement-${achievement.id}-${Date.now()}`;
    
    return {
      id: notificationId,
      type: 'activity:achievement' as NotificationType,
      title: 'Achievement Earned!',
      message: achievement.name,
      icon: achievement.icon || '🏆',
      timestamp: Date.now(),
      data: achievement,
      isRead: false,
      autoHide: true,
      priority: 'high'
    };
  }, []);

  // Create notification from team milestone
  const createTeamMilestoneNotification = useCallback((milestone: any): ActivityNotification => {
    const notificationId = `milestone-${milestone.id || Date.now()}`;
    
    return {
      id: notificationId,
      type: 'team:milestone' as NotificationType,
      title: 'Team Milestone Reached!',
      message: milestone.message || `Your team reached ${milestone.name}`,
      icon: '🎯',
      timestamp: Date.now(),
      data: milestone,
      isRead: false,
      autoHide: true,
      priority: 'high'
    };
  }, []);

  // Add a notification
  const addNotification = useCallback((notificationData: Partial<ActivityNotification>) => {
    const notification: ActivityNotification = {
      id: notificationData.id || `notification-${Date.now()}`,
      type: notificationData.type || 'activity:created',
      title: notificationData.title || 'Notification',
      message: notificationData.message || '',
      icon: notificationData.icon || '📱',
      timestamp: notificationData.timestamp || Date.now(),
      data: notificationData.data,
      isRead: notificationData.isRead || false,
      autoHide: notificationData.autoHide !== false,
      priority: notificationData.priority || 'medium'
    };

    // Apply filter if provided
    if (filter && !filter(notification)) {
      log('Notification filtered out', notification);
      return;
    }

    log('Adding notification', notification);

    setNotifications(prev => {
      // Remove oldest if we exceed max visible
      const updated = [notification, ...prev].slice(0, maxVisible);
      return updated;
    });

    // Add to history if enabled
    if (enableHistory) {
      setHistory(prev => [notification, ...prev].slice(0, 100)); // Keep last 100
    }

    // Play sound if enabled and high priority
    if (soundEnabled && notification.priority === 'high') {
      playNotificationSound();
    }

    // Call custom handler
    if (onNotification) {
      try {
        onNotification(notification);
      } catch (error) {
        console.error('Error in notification handler:', error);
      }
    }

    // Handle specific notification types
    if (notification.type === 'activity:achievement' && onAchievement && notification.data) {
      try {
        onAchievement(notification.data);
      } catch (error) {
        console.error('Error in achievement handler:', error);
      }
    }

    if (notification.type === 'team:milestone' && onTeamMilestone && notification.data) {
      try {
        onTeamMilestone(notification.data);
      } catch (error) {
        console.error('Error in team milestone handler:', error);
      }
    }

    // Auto-hide if enabled
    if (notification.autoHide) {
      const timeout = setTimeout(() => {
        removeNotification(notification.id);
      }, autoHideDuration);
      
      notificationTimeouts.current.set(notification.id, timeout);
    }
  }, [
    maxVisible, 
    enableHistory, 
    soundEnabled, 
    autoHideDuration, 
    filter, 
    onNotification, 
    onAchievement, 
    onTeamMilestone,
    log
  ]);

  // Remove a notification
  const removeNotification = useCallback((id: string) => {
    log('Removing notification', id);
    
    setNotifications(prev => prev.filter(n => n.id !== id));
    
    // Clear timeout if exists
    const timeout = notificationTimeouts.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      notificationTimeouts.current.delete(id);
    }
  }, [log]);

  // Mark notification as read
  const markAsRead = useCallback((id: string) => {
    log('Marking notification as read', id);
    
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
    setHistory(prev => 
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
  }, [log]);

  // Clear all notifications
  const clearAll = useCallback(() => {
    log('Clearing all notifications');
    
    // Clear all timeouts
    notificationTimeouts.current.forEach(timeout => clearTimeout(timeout));
    notificationTimeouts.current.clear();
    
    setNotifications([]);
  }, [log]);

  // Clear history
  const clearHistory = useCallback(() => {
    log('Clearing notification history');
    setHistory([]);
  }, [log]);

  // Toggle sound
  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => !prev);
  }, []);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    try {
      // Create a simple notification sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      // Fallback to simple beep if Web Audio API fails
      console.warn('Audio notification failed:', error);
    }
  }, []);

  // Process new activities from WebSocket feed
  useEffect(() => {
    if (!isConnected || feedNewCount === 0) return;

    const newActivities = activityFeed.filter(activity => 
      activity.isNew && !processedActivityIds.current.has(activity.id)
    );

    newActivities.forEach(activity => {
      processedActivityIds.current.add(activity.id);
      const notification = createActivityNotification(activity);
      addNotification(notification);
    });

    // Clear the new flags after processing
    if (newActivities.length > 0) {
      setTimeout(() => {
        clearNewActivityFlags();
      }, 1000);
    }
  }, [feedNewCount, activityFeed, isConnected, createActivityNotification, addNotification, clearNewActivityFlags]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      notificationTimeouts.current.forEach(timeout => clearTimeout(timeout));
      notificationTimeouts.current.clear();
    };
  }, []);

  // Calculate stats
  const unreadCount = notifications.filter(n => !n.isRead).length;
  const totalCount = notifications.length;
  const historyCount = history.length;

  return {
    // State
    notifications,
    history,
    soundEnabled,
    isConnected,
    
    // Actions
    addNotification,
    removeNotification,
    markAsRead,
    clearAll,
    clearHistory,
    toggleSound,
    
    // Helpers
    createActivityNotification,
    createAchievementNotification,
    createTeamMilestoneNotification,
    
    // Stats
    unreadCount,
    totalCount,
    historyCount
  };
}

// Helper functions
function formatDistance(meters: number): string {
  if (!meters || meters < 0) return '0m';
  
  const km = meters / 1000;
  return km >= 1 ? `${km.toFixed(1)}km` : `${meters}m`;
}

function getActivityType(activity: any): string {
  // Extract activity type from activity data
  if (activity.activityType) {
    return activity.activityType.toLowerCase();
  }
  if (activity.type) {
    return activity.type.toLowerCase();
  }
  // Default based on distance/duration
  if (activity.distance && activity.duration) {
    const speed = activity.distance / (activity.duration / 3600); // km/h
    if (speed > 8) return 'run';
    if (speed > 5) return 'jog';
  }
  return 'walk';
}

function getActivityIcon(source: string): string {
  switch (source?.toUpperCase()) {
    case 'STRAVA': return '🏃';
    case 'APPLE_HEALTH': return '⌚';
    case 'GOOGLE_FIT': return '📱';
    case 'GARMIN': return '⌚';
    case 'FITBIT': return '⌚';
    case 'MANUAL': return '✏️';
    default: return '🚶';
  }
}

export default useActivityNotifications;