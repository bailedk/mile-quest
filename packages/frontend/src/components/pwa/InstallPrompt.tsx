'use client';

import React, { useState, useEffect } from 'react';
import { pwaService, PWAInstallInfo } from '@/services/pwa.service';

interface InstallPromptProps {
  className?: string;
  onInstall?: () => void;
  onDismiss?: () => void;
}

export function InstallPrompt({ className = '', onInstall, onDismiss }: InstallPromptProps) {
  const [installInfo, setInstallInfo] = useState<PWAInstallInfo>({
    isInstallable: false,
    isInstalled: false,
    platform: 'unknown',
    canPrompt: false,
  });
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Check install status
    const checkInstallStatus = () => {
      const info = pwaService.getInstallInfo();
      setInstallInfo(info);
      
      // Show prompt if installable and not already shown
      if (info.isInstallable && !info.isInstalled) {
        const hasSeenPrompt = localStorage.getItem('pwa-install-prompt-dismissed');
        if (!hasSeenPrompt) {
          setIsVisible(true);
        }
      }
    };

    checkInstallStatus();

    // Listen for PWA events
    const handleInstallAvailable = () => {
      checkInstallStatus();
    };

    const handleInstalled = () => {
      setIsVisible(false);
      setInstallInfo(prev => ({ ...prev, isInstalled: true, isInstallable: false }));
      onInstall?.();
    };

    window.addEventListener('pwa-install-available', handleInstallAvailable);
    window.addEventListener('pwa-installed', handleInstalled);

    return () => {
      window.removeEventListener('pwa-install-available', handleInstallAvailable);
      window.removeEventListener('pwa-installed', handleInstalled);
    };
  }, [onInstall]);

  const handleInstall = async () => {
    setIsInstalling(true);
    
    try {
      const result = await pwaService.showInstallPrompt();
      
      if (result === 'accepted') {
        setIsVisible(false);
        onInstall?.();
      } else if (result === 'dismissed') {
        handleDismiss();
      }
    } catch (error) {
      console.error('Install failed:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('pwa-install-prompt-dismissed', 'true');
    onDismiss?.();
  };

  const getPlatformInstructions = () => {
    switch (installInfo.platform) {
      case 'ios':
        return (
          <div className="text-sm text-gray-600">
            <p>To install on iOS:</p>
            <ol className="list-decimal list-inside mt-2 space-y-1">
              <li>Tap the share button in Safari</li>
              <li>Select "Add to Home Screen"</li>
              <li>Tap "Add" to install</li>
            </ol>
          </div>
        );
      case 'android':
        return (
          <div className="text-sm text-gray-600">
            <p>Install Mile Quest as an app for quick access and offline features.</p>
          </div>
        );
      default:
        return (
          <div className="text-sm text-gray-600">
            <p>Install Mile Quest as an app for quick access and offline features.</p>
          </div>
        );
    }
  };

  if (!isVisible || installInfo.isInstalled) {
    return null;
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-lg p-4 ${className}`}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
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
                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Install Mile Quest App
          </h3>
          
          {getPlatformInstructions()}
          
          <div className="flex items-center space-x-3 mt-4">
            {installInfo.canPrompt && installInfo.platform !== 'ios' ? (
              <button
                onClick={handleInstall}
                disabled={isInstalling}
                className="bg-emerald-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isInstalling ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Installing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Install App
                  </>
                )}
              </button>
            ) : (
              <span className="text-sm text-gray-500">
                Follow the instructions above to install
              </span>
            )}
            
            <button
              onClick={handleDismiss}
              className="text-gray-400 hover:text-gray-600 text-sm font-medium"
            >
              Dismiss
            </button>
          </div>
        </div>
        
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default InstallPrompt;