'use client';

import React, { useState, useEffect } from 'react';
import { pwaService } from '@/services/pwa.service';

interface NotificationPermissionProps {
  className?: string;
  onGranted?: () => void;
  onDenied?: () => void;
  autoRequest?: boolean;
}

export function NotificationPermission({ 
  className = '', 
  onGranted, 
  onDenied,
  autoRequest = false 
}: NotificationPermissionProps) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isRequesting, setIsRequesting] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check current permission status
    const currentPermission = pwaService.getNotificationPermission();
    setPermission(currentPermission);
    
    // Show prompt if permission is default and component should auto-request
    if (currentPermission === 'default' && !autoRequest) {
      const hasSeenPrompt = localStorage.getItem('notification-prompt-dismissed');
      if (!hasSeenPrompt) {
        setShowPrompt(true);
      }
    } else if (currentPermission === 'default' && autoRequest) {
      // Auto-request permission
      handleRequestPermission();
    }
  }, [autoRequest]);

  const handleRequestPermission = async () => {
    if (!pwaService.isNotificationSupported()) {
      console.warn('Notifications not supported on this device');
      return;
    }

    setIsRequesting(true);
    
    try {
      const result = await pwaService.requestNotificationPermission();
      setPermission(result);
      
      if (result === 'granted') {
        setShowPrompt(false);
        onGranted?.();
        
        // Subscribe to push notifications
        await pwaService.subscribeToPush();
      } else {
        onDenied?.();
        if (result === 'denied') {
          localStorage.setItem('notification-prompt-dismissed', 'true');
        }
      }
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      onDenied?.();
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('notification-prompt-dismissed', 'true');
    onDenied?.();
  };

  const handleEnableNotifications = () => {
    if (permission === 'denied') {
      // Show instructions to manually enable notifications
      alert('To enable notifications, please go to your browser settings and allow notifications for this site.');
    } else {
      handleRequestPermission();
    }
  };

  if (!pwaService.isNotificationSupported()) {
    return null;
  }

  // Don't show if permission is already granted
  if (permission === 'granted') {
    return null;
  }

  // Show manual enable button for denied permissions
  if (permission === 'denied') {
    return (
      <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-yellow-800 mb-1">
              Notifications Blocked
            </h3>
            <p className="text-sm text-yellow-700 mb-3">
              You've blocked notifications for this site. To get updates about your team's progress and achievements, please enable notifications in your browser settings.
            </p>
            <button
              onClick={handleEnableNotifications}
              className="text-sm font-medium text-yellow-800 hover:text-yellow-900 underline"
            >
              Learn how to enable notifications
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show prompt for default permission
  if (!showPrompt && !autoRequest) {
    return null;
  }

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-5 5-5-5h5v-5a7.5 7.5 0 00-15 0v5h5l-5 5-5-5h5v-5z"
              />
            </svg>
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Stay Updated with Notifications
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Get notified about your team's progress, achievements, and important updates from Mile Quest.
          </p>
          
          <div className="space-y-2 mb-4">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Team milestone achievements</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Personal achievements and streaks</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Goal deadlines and reminders</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={handleRequestPermission}
              disabled={isRequesting}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isRequesting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Requesting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5-5h5v-5a7.5 7.5 0 00-15 0v5h5l-5 5-5-5h5v-5z" />
                  </svg>
                  Enable Notifications
                </>
              )}
            </button>
            
            {!autoRequest && (
              <button
                onClick={handleDismiss}
                className="text-gray-400 hover:text-gray-600 text-sm font-medium"
              >
                Not now
              </button>
            )}
          </div>
        </div>
        
        {!autoRequest && (
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default NotificationPermission;