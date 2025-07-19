'use client';

import React from 'react';
import { WebSocketConnectionState } from '@/services/websocket';

interface ConnectionStatusProps {
  connectionState: WebSocketConnectionState;
  error?: Error | null;
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ConnectionStatus({ 
  connectionState, 
  error, 
  className = '',
  showText = false,
  size = 'md'
}: ConnectionStatusProps) {
  const getStatusConfig = () => {
    switch (connectionState) {
      case WebSocketConnectionState.CONNECTED:
        return {
          color: 'bg-green-500',
          text: 'Connected',
          icon: '●',
          pulse: false,
        };
      case WebSocketConnectionState.CONNECTING:
        return {
          color: 'bg-yellow-500',
          text: 'Connecting...',
          icon: '●',
          pulse: true,
        };
      case WebSocketConnectionState.RECONNECTING:
        return {
          color: 'bg-orange-500',
          text: 'Reconnecting...',
          icon: '●',
          pulse: true,
        };
      case WebSocketConnectionState.FAILED:
        return {
          color: 'bg-red-500',
          text: 'Connection Failed',
          icon: '●',
          pulse: false,
        };
      case WebSocketConnectionState.DISCONNECTED:
      default:
        return {
          color: 'bg-gray-400',
          text: 'Disconnected',
          icon: '●',
          pulse: false,
        };
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          dot: 'w-2 h-2',
          text: 'text-xs',
          container: 'gap-1',
        };
      case 'lg':
        return {
          dot: 'w-4 h-4',
          text: 'text-base',
          container: 'gap-3',
        };
      case 'md':
      default:
        return {
          dot: 'w-3 h-3',
          text: 'text-sm',
          container: 'gap-2',
        };
    }
  };

  const status = getStatusConfig();
  const sizeClasses = getSizeClasses();
  const title = error ? `${status.text}: ${error.message}` : status.text;

  return (
    <div 
      className={`flex items-center ${sizeClasses.container} ${className}`}
      title={title}
    >
      <div 
        className={`
          ${sizeClasses.dot} 
          ${status.color} 
          rounded-full 
          ${status.pulse ? 'animate-pulse' : ''}
        `}
        aria-label={status.text}
      />
      {showText && (
        <span className={`${sizeClasses.text} text-gray-600 dark:text-gray-300`}>
          {status.text}
        </span>
      )}
    </div>
  );
}

interface ConnectionStatusBannerProps {
  connectionState: WebSocketConnectionState;
  error?: Error | null;
  onRetry?: () => void;
  className?: string;
}

export function ConnectionStatusBanner({ 
  connectionState, 
  error, 
  onRetry,
  className = ''
}: ConnectionStatusBannerProps) {
  // Only show banner for error states or when explicitly disconnected
  if (connectionState === WebSocketConnectionState.CONNECTED || 
      connectionState === WebSocketConnectionState.CONNECTING) {
    return null;
  }

  const getBannerConfig = () => {
    switch (connectionState) {
      case WebSocketConnectionState.RECONNECTING:
        return {
          bgColor: 'bg-orange-50 dark:bg-orange-950',
          borderColor: 'border-orange-200 dark:border-orange-800',
          textColor: 'text-orange-800 dark:text-orange-200',
          iconColor: 'text-orange-500',
          message: 'Reconnecting to live updates...',
          showRetry: false,
        };
      case WebSocketConnectionState.FAILED:
        return {
          bgColor: 'bg-red-50 dark:bg-red-950',
          borderColor: 'border-red-200 dark:border-red-800',
          textColor: 'text-red-800 dark:text-red-200',
          iconColor: 'text-red-500',
          message: error?.message || 'Connection failed. Live updates are unavailable.',
          showRetry: true,
        };
      case WebSocketConnectionState.DISCONNECTED:
      default:
        return {
          bgColor: 'bg-gray-50 dark:bg-gray-900',
          borderColor: 'border-gray-200 dark:border-gray-700',
          textColor: 'text-gray-800 dark:text-gray-200',
          iconColor: 'text-gray-500',
          message: 'Live updates are disabled.',
          showRetry: true,
        };
    }
  };

  const config = getBannerConfig();

  return (
    <div 
      className={`
        ${config.bgColor} 
        ${config.borderColor} 
        ${config.textColor}
        border rounded-lg p-3 mb-4 
        ${className}
      `}
      role="alert"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div 
            className={`
              w-2 h-2 
              ${connectionState === WebSocketConnectionState.RECONNECTING ? 'bg-orange-500 animate-pulse' : config.iconColor}
              rounded-full
            `}
          />
          <span className="text-sm font-medium">
            {config.message}
          </span>
        </div>
        
        {config.showRetry && onRetry && (
          <button
            onClick={onRetry}
            className={`
              text-sm font-medium underline hover:no-underline
              ${config.textColor}
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
            `}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}