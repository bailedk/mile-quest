'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWebSocketContext } from '@/contexts/WebSocketContext';
import { ActivityFeedUpdate } from '@/hooks/useActivityFeed';
import { Achievement } from '@/hooks/useRealtimeUpdates';
import { pwaService } from '@/services/pwa.service';

// Notification Types
export type NotificationType = 
  | 'activity:created'
  | 'activity:achievement' 
  | 'team:milestone'
  | 'team:goal_progress'
  | 'personal:achievement';

export interface ActivityNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  icon: string;
  timestamp: number;
  data?: any;
  isRead?: boolean;
  autoHide?: boolean;
  priority?: 'low' | 'medium' | 'high';
}

interface ActivityNotificationsProps {
  maxVisible?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  enableSound?: boolean;
  enableHistory?: boolean;
  autoHideDuration?: number;
  className?: string;
}

export function ActivityNotifications({
  maxVisible = 3,
  position = 'top-right',
  enableSound = true,
  enableHistory = true,
  autoHideDuration = 5000,
  className = ''
}: ActivityNotificationsProps) {
  const [notifications, setNotifications] = useState<ActivityNotification[]>([]);
  const [history, setHistory] = useState<ActivityNotification[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(enableSound);
  
  const { activityFeed, feedNewCount, isConnected } = useWebSocketContext();

  // Subscribe to activity feed updates
  useEffect(() => {
    if (!isConnected || feedNewCount === 0) return;

    // Get new activities from the feed
    const newActivities = activityFeed.filter(activity => activity.isNew);
    
    newActivities.forEach(activity => {
      const notification = createNotificationFromActivity(activity);
      if (notification) {
        addNotification(notification);
      }
    });
  }, [feedNewCount, activityFeed, isConnected]);

  const createNotificationFromActivity = useCallback((activity: any): ActivityNotification | null => {
    const notification: ActivityNotification = {
      id: `activity-${activity.id}-${Date.now()}`,
      type: 'activity:created',
      title: 'New Team Activity',
      message: `${activity.userName} completed a ${formatDistance(activity.distance)} walk`,
      icon: getActivityIcon(activity.source),
      timestamp: Date.now(),
      data: activity,
      autoHide: true,
      priority: 'medium'
    };

    return notification;
  }, []);

  const createNotificationFromAchievement = useCallback((achievement: Achievement): ActivityNotification => {
    return {
      id: `achievement-${achievement.id}-${Date.now()}`,
      type: 'activity:achievement',
      title: 'Achievement Earned!',
      message: achievement.name,
      icon: achievement.icon || '🏆',
      timestamp: Date.now(),
      data: achievement,
      autoHide: true,
      priority: 'high'
    };
  }, []);

  const addNotification = useCallback((notification: ActivityNotification) => {
    setNotifications(prev => {
      // Remove oldest if we exceed max visible
      const updated = [notification, ...prev].slice(0, maxVisible);
      return updated;
    });

    // Add to history if enabled
    if (enableHistory) {
      setHistory(prev => [notification, ...prev].slice(0, 100)); // Keep last 100
    }

    // Play sound if enabled
    if (soundEnabled && notification.priority === 'high') {
      playNotificationSound();
    }

    // Show browser notification if permission granted
    showBrowserNotification(notification);

    // Auto-hide if enabled
    if (notification.autoHide) {
      setTimeout(() => {
        removeNotification(notification.id);
      }, autoHideDuration);
    }
  }, [maxVisible, enableHistory, soundEnabled, autoHideDuration]);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
    setHistory(prev => 
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      // Use a subtle notification sound
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmgfCjiM0+/JfC0GIm+/8+CVSA0PVqzn77BdGAg+ltryxnkpBSl+zPLaizsIGGS57+OWT');
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Ignore audio errors - browser may not allow autoplay
      });
    } catch (error) {
      // Ignore audio errors
    }
  }, []);

  const showBrowserNotification = useCallback(async (notification: ActivityNotification) => {
    if (!pwaService?.isNotificationSupported() || 
        pwaService.getNotificationPermission() !== 'granted') {
      return;
    }

    try {
      await pwaService.showNotification(notification.title, {
        body: notification.message,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: notification.type,
        renotify: true,
        requireInteraction: notification.priority === 'high',
        data: notification.data
      });
    } catch (error) {
      console.warn('Failed to show browser notification:', error);
    }
  }, []);

  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'top-right':
      default:
        return 'top-4 right-4';
    }
  };

  // Expose methods for external use
  const contextValue = {
    addNotification,
    removeNotification,
    markAsRead,
    clearAll,
    clearHistory,
    createNotificationFromAchievement,
    soundEnabled,
    setSoundEnabled,
    history,
    showHistory,
    setShowHistory
  };

  return (
    <>
      {/* Main notification container */}
      <div className={`fixed ${getPositionClasses()} z-50 space-y-2 max-w-sm w-full ${className}`}>
        {notifications.map((notification, index) => (
          <NotificationToast
            key={notification.id}
            notification={notification}
            onDismiss={() => removeNotification(notification.id)}
            onMarkRead={() => markAsRead(notification.id)}
            index={index}
          />
        ))}
      </div>

      {/* History panel */}
      {enableHistory && showHistory && (
        <NotificationHistory
          notifications={history}
          onClose={() => setShowHistory(false)}
          onClear={clearHistory}
          onMarkRead={markAsRead}
        />
      )}

      {/* Settings control (floating button when notifications are visible) */}
      {notifications.length > 0 && (
        <div className={`fixed ${getPositionClasses().replace('top-4', 'top-20').replace('bottom-4', 'bottom-20')} z-40`}>
          <NotificationControls
            soundEnabled={soundEnabled}
            onToggleSound={() => setSoundEnabled(!soundEnabled)}
            onShowHistory={() => setShowHistory(true)}
            onClearAll={clearAll}
            historyCount={history.length}
            enableHistory={enableHistory}
          />
        </div>
      )}
    </>
  );
}

// Individual notification toast component
interface NotificationToastProps {
  notification: ActivityNotification;
  onDismiss: () => void;
  onMarkRead: () => void;
  index: number;
}

export function NotificationToast({ 
  notification, 
  onDismiss, 
  onMarkRead,
  index 
}: NotificationToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Stagger entrance animations
    const timer = setTimeout(() => setIsVisible(true), index * 100);
    return () => clearTimeout(timer);
  }, [index]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(onDismiss, 300);
  };

  const handleClick = () => {
    onMarkRead();
    // Could navigate to relevant page based on notification data
  };

  const getPriorityColors = () => {
    switch (notification.priority) {
      case 'high':
        return 'from-red-500 to-red-600 border-red-400';
      case 'low':
        return 'from-gray-500 to-gray-600 border-gray-400';
      case 'medium':
      default:
        return 'from-blue-500 to-blue-600 border-blue-400';
    }
  };

  return (
    <div 
      className={`
        transform transition-all duration-300 ease-out
        ${isVisible && !isExiting 
          ? 'translate-x-0 opacity-100 scale-100' 
          : 'translate-x-full opacity-0 scale-95'
        }
      `}
      style={{
        transitionDelay: isExiting ? '0ms' : `${index * 50}ms`
      }}
    >
      <div 
        className={`
          bg-gradient-to-r ${getPriorityColors()}
          rounded-lg shadow-lg border-l-4 overflow-hidden
          cursor-pointer hover:shadow-xl transition-shadow
          ${notification.isRead ? 'opacity-75' : ''}
        `}
        onClick={handleClick}
      >
        <div className="p-4 text-white">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <span className="text-2xl">{notification.icon}</span>
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white mb-1">
                  {notification.title}
                </h3>
                <p className="text-sm text-white opacity-90 line-clamp-2">
                  {notification.message}
                </p>
                <p className="text-xs text-white opacity-70 mt-1">
                  {formatTimeAgo(notification.timestamp)}
                </p>
              </div>
            </div>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss();
              }}
              className="flex-shrink-0 ml-2 text-white opacity-70 hover:opacity-100 transition-opacity"
              aria-label="Dismiss notification"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Auto-hide progress bar */}
        {notification.autoHide && (
          <div className="h-1 bg-white bg-opacity-20">
            <div 
              className="h-full bg-white bg-opacity-60 transition-all ease-linear"
              style={{
                width: '100%',
                animation: 'shrink 5s linear',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Notification history panel
interface NotificationHistoryProps {
  notifications: ActivityNotification[];
  onClose: () => void;
  onClear: () => void;
  onMarkRead: (id: string) => void;
}

function NotificationHistory({ 
  notifications, 
  onClose, 
  onClear, 
  onMarkRead 
}: NotificationHistoryProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-96 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Notification History
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClear}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear All
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No notifications yet
            </p>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`
                  p-3 border rounded-lg cursor-pointer hover:bg-gray-50
                  ${notification.isRead ? 'bg-gray-50 opacity-75' : 'bg-white'}
                `}
                onClick={() => onMarkRead(notification.id)}
              >
                <div className="flex items-start space-x-3">
                  <span className="text-lg">{notification.icon}</span>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900">
                      {notification.title}
                    </h4>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatTimeAgo(notification.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Notification controls
interface NotificationControlsProps {
  soundEnabled: boolean;
  onToggleSound: () => void;
  onShowHistory: () => void;
  onClearAll: () => void;
  historyCount: number;
  enableHistory: boolean;
}

function NotificationControls({
  soundEnabled,
  onToggleSound,
  onShowHistory,
  onClearAll,
  historyCount,
  enableHistory
}: NotificationControlsProps) {
  const [showControls, setShowControls] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setShowControls(!showControls)}
        className="bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full p-2 shadow-lg transition-all"
        aria-label="Notification settings"
      >
        <SettingsIcon className="w-4 h-4 text-gray-600" />
      </button>
      
      {showControls && (
        <div className="absolute bottom-full mb-2 right-0 bg-white rounded-lg shadow-lg border p-2 space-y-1 min-w-40">
          <button
            onClick={onToggleSound}
            className="flex items-center space-x-2 w-full px-2 py-1 text-sm hover:bg-gray-100 rounded"
          >
            {soundEnabled ? (
              <SoundOnIcon className="w-4 h-4" />
            ) : (
              <SoundOffIcon className="w-4 h-4" />
            )}
            <span>{soundEnabled ? 'Mute' : 'Unmute'}</span>
          </button>
          
          {enableHistory && (
            <button
              onClick={onShowHistory}
              className="flex items-center space-x-2 w-full px-2 py-1 text-sm hover:bg-gray-100 rounded"
            >
              <HistoryIcon className="w-4 h-4" />
              <span>History ({historyCount})</span>
            </button>
          )}
          
          <button
            onClick={onClearAll}
            className="flex items-center space-x-2 w-full px-2 py-1 text-sm hover:bg-gray-100 rounded text-red-600"
          >
            <TrashIcon className="w-4 h-4" />
            <span>Clear All</span>
          </button>
        </div>
      )}
    </div>
  );
}

// Helper functions
function formatDistance(meters: number): string {
  const km = meters / 1000;
  return km >= 1 ? `${km.toFixed(1)}km` : `${meters}m`;
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getActivityIcon(source: string): string {
  switch (source) {
    case 'STRAVA': return '🏃';
    case 'APPLE_HEALTH': return '⌚';
    case 'GOOGLE_FIT': return '📱';
    case 'MANUAL': return '✏️';
    default: return '🚶';
  }
}

// Simple SVG icons
const CloseIcon: React.FC<{ className?: string }> = ({ className = "h-4 w-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const SettingsIcon: React.FC<{ className?: string }> = ({ className = "h-4 w-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const SoundOnIcon: React.FC<{ className?: string }> = ({ className = "h-4 w-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M9 9h1.586l4.707-4.707C16.923 2.663 19 3.79 19 6.207v11.586c0 2.417-2.077 3.544-3.707 1.914L11 15H9c-1.657 0-3-1.343-3-3v-2c0-1.657 1.343-3 3-3z" />
  </svg>
);

const SoundOffIcon: React.FC<{ className?: string }> = ({ className = "h-4 w-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C11.923 2.663 14 3.79 14 6.207v2.5m0 5.793c0 .38-.126.74-.354 1.036l-4.707 4.707A2.5 2.5 0 017 19.207V15h1.586l-1.414-1.414M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
  </svg>
);

const HistoryIcon: React.FC<{ className?: string }> = ({ className = "h-4 w-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const TrashIcon: React.FC<{ className?: string }> = ({ className = "h-4 w-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

// CSS for animations
const styles = `
  @keyframes shrink {
    from { width: 100%; }
    to { width: 0%; }
  }
  
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}

export default ActivityNotifications;