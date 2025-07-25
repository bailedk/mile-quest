'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  maxNotifications?: number;
  autoHideDuration?: number;
  onNotificationClick?: (notification: ActivityNotification) => void;
  enablePushNotifications?: boolean;
  className?: string;
}

export function ActivityNotifications({
  maxNotifications = 5,
  autoHideDuration = 5000,
  onNotificationClick,
  enablePushNotifications = false,
  className = '',
}: ActivityNotificationsProps) {
  const [notifications, setNotifications] = useState<ActivityNotification[]>([]);
  const [hiddenNotifications, setHiddenNotifications] = useState<Set<string>>(new Set());

  // Request notification permissions on mount if enabled
  useEffect(() => {
    if (enablePushNotifications && 'Notification' in window) {
      pwaService.requestNotificationPermission();
    }
  }, [enablePushNotifications]);

  // Auto-hide notifications after duration
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    notifications.forEach(notification => {
      if (notification.autoHide !== false && !hiddenNotifications.has(notification.id)) {
        const timer = setTimeout(() => {
          handleHideNotification(notification.id);
        }, autoHideDuration);
        timers.push(timer);
      }
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [notifications, autoHideDuration, hiddenNotifications]);

  // Hide notification
  const handleHideNotification = useCallback((notificationId: string) => {
    setHiddenNotifications(prev => new Set(prev).add(notificationId));
    
    // Remove from list after animation
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setHiddenNotifications(prev => {
        const next = new Set(prev);
        next.delete(notificationId);
        return next;
      });
    }, 300);
  }, []);

  // Handle notification click
  const handleNotificationClick = useCallback((notification: ActivityNotification) => {
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
    handleHideNotification(notification.id);
  }, [onNotificationClick, handleHideNotification]);

  // Get visible notifications
  const visibleNotifications = notifications
    .filter(n => !hiddenNotifications.has(n.id))
    .slice(0, maxNotifications);

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <div className={`fixed top-4 right-4 z-50 space-y-2 ${className}`}>
      {visibleNotifications.map(notification => (
        <div
          key={notification.id}
          className={`
            bg-white rounded-lg shadow-lg p-4 cursor-pointer
            transform transition-all duration-300 ease-out
            ${hiddenNotifications.has(notification.id) ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
            hover:shadow-xl
          `}
          onClick={() => handleNotificationClick(notification)}
        >
          <div className="flex items-start">
            <div className="flex-shrink-0 text-2xl mr-3">
              {notification.icon}
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-gray-900">
                {notification.title}
              </h4>
              <p className="text-sm text-gray-600 mt-1">
                {notification.message}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleHideNotification(notification.id);
              }}
              className="ml-3 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Hook to use notifications from other components
export function useActivityNotifications() {
  const [notifications, setNotifications] = useState<ActivityNotification[]>([]);

  const addNotification = useCallback((notification: Omit<ActivityNotification, 'id' | 'timestamp'>) => {
    const newNotification: ActivityNotification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: Date.now(),
    };
    
    setNotifications(prev => [newNotification, ...prev]);
    
    // Show push notification if enabled
    if ('Notification' in window && Notification.permission === 'granted') {
      pwaService.showNotification(notification.title, {
        body: notification.message,
        icon: '/icon-192x192.png',
        badge: '/icon-72x72.png',
      });
    }
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    addNotification,
    clearNotifications,
  };
}