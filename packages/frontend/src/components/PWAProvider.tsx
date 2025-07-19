'use client';

import React, { useEffect, useState } from 'react';
import { InstallPrompt, UpdateNotification, NotificationPermission } from '@/components/pwa';
import { pwaService } from '@/services/pwa.service';

interface PWAProviderProps {
  children: React.ReactNode;
}

export function PWAProvider({ children }: PWAProviderProps) {
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  useEffect(() => {
    // Initialize PWA service when component mounts
    const initializePWA = async () => {
      try {
        await pwaService.init();
        console.log('[PWA] Provider initialized');
        
        // Check if we should show notification prompt on dashboard
        const currentPath = window.location.pathname;
        if (currentPath === '/dashboard') {
          const permission = pwaService.getNotificationPermission();
          if (permission === 'default') {
            // Delay showing notification prompt to not overwhelm user
            setTimeout(() => {
              setShowNotificationPrompt(true);
            }, 3000);
          }
        }
      } catch (error) {
        console.error('[PWA] Failed to initialize:', error);
      }
    };

    initializePWA();

    // Listen for PWA events
    const handleInstallAvailable = () => {
      setShowInstallPrompt(true);
    };

    const handleUpdateAvailable = () => {
      setShowUpdateNotification(true);
    };

    const handleInstalled = () => {
      setShowInstallPrompt(false);
      
      // Show success notification
      if (pwaService.getNotificationPermission() === 'granted') {
        pwaService.showNotification({
          title: 'Mile Quest Installed!',
          body: 'You can now access Mile Quest from your home screen.',
          tag: 'installation-success',
        });
      }
    };

    window.addEventListener('pwa-install-available', handleInstallAvailable);
    window.addEventListener('pwa-update-available', handleUpdateAvailable);
    window.addEventListener('pwa-installed', handleInstalled);

    // Listen for online/offline events
    const handleOnline = () => {
      console.log('[PWA] Back online');
      // Trigger background sync when coming back online
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((registration) => {
          if ('sync' in registration) {
            registration.sync.register('sync-activities');
            registration.sync.register('sync-team-progress');
          }
        });
      }
    };

    const handleOffline = () => {
      console.log('[PWA] Gone offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup
    return () => {
      window.removeEventListener('pwa-install-available', handleInstallAvailable);
      window.removeEventListener('pwa-update-available', handleUpdateAvailable);
      window.removeEventListener('pwa-installed', handleInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstallSuccess = () => {
    setShowInstallPrompt(false);
    console.log('[PWA] App installed successfully');
  };

  const handleInstallDismiss = () => {
    setShowInstallPrompt(false);
    console.log('[PWA] Install prompt dismissed');
  };

  const handleUpdateSuccess = () => {
    setShowUpdateNotification(false);
    console.log('[PWA] App updated successfully');
  };

  const handleUpdateDismiss = () => {
    setShowUpdateNotification(false);
    console.log('[PWA] Update notification dismissed');
  };

  const handleNotificationGranted = () => {
    setShowNotificationPrompt(false);
    console.log('[PWA] Notifications enabled');
  };

  const handleNotificationDenied = () => {
    setShowNotificationPrompt(false);
    console.log('[PWA] Notifications denied');
  };

  return (
    <>
      {children}
      
      {/* PWA Install Prompt */}
      {showInstallPrompt && (
        <div className="fixed top-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96">
          <InstallPrompt
            onInstall={handleInstallSuccess}
            onDismiss={handleInstallDismiss}
          />
        </div>
      )}
      
      {/* App Update Notification */}
      {showUpdateNotification && (
        <UpdateNotification
          onUpdate={handleUpdateSuccess}
          onDismiss={handleUpdateDismiss}
        />
      )}
      
      {/* Notification Permission Prompt */}
      {showNotificationPrompt && (
        <div className="fixed bottom-4 left-4 right-4 z-40 md:left-auto md:w-96">
          <NotificationPermission
            onGranted={handleNotificationGranted}
            onDenied={handleNotificationDenied}
          />
        </div>
      )}
    </>
  );
}

export default PWAProvider;