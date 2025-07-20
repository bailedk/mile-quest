/**
 * PWA Service - Handles service worker registration, push notifications, and installation
 */

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface NotificationData {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
}

export interface PWAInstallInfo {
  isInstallable: boolean;
  isInstalled: boolean;
  platform: string;
  canPrompt: boolean;
}

export interface CacheInfo {
  [cacheName: string]: number;
}

class PWAService {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private swRegistration: ServiceWorkerRegistration | null = null;
  private isServiceWorkerSupported = false;
  private notificationSupported = false;
  private installPromptShown = false;

  constructor() {
    // Only initialize browser APIs if we're in a browser environment
    if (typeof window !== 'undefined') {
      this.isServiceWorkerSupported = 'serviceWorker' in navigator;
      this.notificationSupported = 'Notification' in window;
      this.setupInstallPromptListener();
      this.setupAppInstalledListener();
    } else {
      // Server-side safe defaults
      this.isServiceWorkerSupported = false;
      this.notificationSupported = false;
    }
  }

  /**
   * Initialize the PWA service
   */
  async init(): Promise<void> {
    if (!this.isServiceWorkerSupported) {
      console.warn('[PWA] Service Worker not supported');
      return;
    }

    try {
      await this.registerServiceWorker();
      await this.setupUpdateListener();
      console.log('[PWA] Service initialized successfully');
    } catch (error) {
      console.error('[PWA] Failed to initialize service:', error);
    }
  }

  /**
   * Register the service worker
   */
  private async registerServiceWorker(): Promise<void> {
    try {
      this.swRegistration = await navigator.serviceWorker.register('/sw.js');
      
      console.log('[PWA] Service Worker registered:', this.swRegistration.scope);
      
      // Listen for service worker updates
      this.swRegistration.addEventListener('updatefound', () => {
        console.log('[PWA] Service Worker update found');
        this.handleServiceWorkerUpdate();
      });

    } catch (error) {
      console.error('[PWA] Service Worker registration failed:', error);
      throw error;
    }
  }

  /**
   * Handle service worker updates
   */
  private handleServiceWorkerUpdate(): void {
    if (!this.swRegistration) return;

    const newWorker = this.swRegistration.installing;
    if (!newWorker) return;

    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        // New content available
        this.notifyAppUpdate();
      }
    });
  }

  /**
   * Setup update listener for immediate updates
   */
  private async setupUpdateListener(): Promise<void> {
    if (!navigator.serviceWorker.controller) return;

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data.type === 'UPDATE_AVAILABLE') {
        this.notifyAppUpdate();
      }
    });
  }

  /**
   * Notify user about app update
   */
  private notifyAppUpdate(): void {
    // Emit custom event for app to handle
    window.dispatchEvent(new CustomEvent('pwa-update-available', {
      detail: { updateAvailable: true }
    }));
  }

  /**
   * Apply pending update
   */
  async applyUpdate(): Promise<void> {
    if (!this.swRegistration) return;

    const waitingWorker = this.swRegistration.waiting;
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  }

  /**
   * Setup install prompt listener
   */
  private setupInstallPromptListener(): void {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferredPrompt = event as BeforeInstallPromptEvent;
      
      // Emit custom event for app to handle
      window.dispatchEvent(new CustomEvent('pwa-install-available', {
        detail: { installable: true }
      }));
    });
  }

  /**
   * Setup app installed listener
   */
  private setupAppInstalledListener(): void {
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed successfully');
      this.deferredPrompt = null;
      
      // Emit custom event for app to handle
      window.dispatchEvent(new CustomEvent('pwa-installed', {
        detail: { installed: true }
      }));
    });
  }

  /**
   * Get PWA installation info
   */
  getInstallInfo(): PWAInstallInfo {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isAppleStandalone = (window.navigator as any).standalone;
    const isInstalled = isStandalone || isAppleStandalone;

    return {
      isInstallable: !!this.deferredPrompt && !this.installPromptShown,
      isInstalled,
      platform: this.detectPlatform(),
      canPrompt: !!this.deferredPrompt,
    };
  }

  /**
   * Detect platform
   */
  private detectPlatform(): string {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('android')) return 'android';
    if (userAgent.includes('iphone') || userAgent.includes('ipad')) return 'ios';
    if (userAgent.includes('mac')) return 'macos';
    if (userAgent.includes('win')) return 'windows';
    if (userAgent.includes('linux')) return 'linux';
    
    return 'unknown';
  }

  /**
   * Show install prompt
   */
  async showInstallPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!this.deferredPrompt) {
      console.warn('[PWA] Install prompt not available');
      return 'unavailable';
    }

    try {
      this.installPromptShown = true;
      await this.deferredPrompt.prompt();
      
      const choiceResult = await this.deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] User accepted the install prompt');
      } else {
        console.log('[PWA] User dismissed the install prompt');
      }
      
      this.deferredPrompt = null;
      return choiceResult.outcome;
      
    } catch (error) {
      console.error('[PWA] Error showing install prompt:', error);
      return 'dismissed';
    }
  }

  /**
   * Request notification permission
   */
  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!this.notificationSupported) {
      console.warn('[PWA] Notifications not supported');
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      console.log('[PWA] Notification permission:', permission);
      return permission;
    } catch (error) {
      console.error('[PWA] Error requesting notification permission:', error);
      return 'denied';
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribeToPush(): Promise<PushSubscription | null> {
    if (!this.swRegistration) {
      console.error('[PWA] Service Worker not registered');
      return null;
    }

    try {
      const permission = await this.requestNotificationPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // Get existing subscription
      let subscription = await this.swRegistration.pushManager.getSubscription();
      
      if (!subscription) {
        // Create new subscription
        subscription = await this.swRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
          ),
        });
      }

      console.log('[PWA] Push subscription created:', subscription);
      
      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);
      
      return subscription;
      
    } catch (error) {
      console.error('[PWA] Failed to subscribe to push notifications:', error);
      return null;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribeFromPush(): Promise<boolean> {
    if (!this.swRegistration) {
      return false;
    }

    try {
      const subscription = await this.swRegistration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        console.log('[PWA] Unsubscribed from push notifications');
        return true;
      }
      return false;
    } catch (error) {
      console.error('[PWA] Failed to unsubscribe from push notifications:', error);
      return false;
    }
  }

  /**
   * Show local notification
   */
  async showNotification(data: NotificationData): Promise<void> {
    if (!this.swRegistration) {
      console.error('[PWA] Service Worker not registered');
      return;
    }

    const permission = await this.requestNotificationPermission();
    if (permission !== 'granted') {
      throw new Error('Notification permission denied');
    }

    try {
      await this.swRegistration.showNotification(data.title, {
        body: data.body,
        icon: data.icon || '/icons/icon.svg',
        badge: data.badge || '/icons/icon.svg',
        tag: data.tag,
        data: data.data,
        actions: data.actions,
        requireInteraction: data.requireInteraction,
        silent: data.silent,
        vibrate: data.vibrate,
      });
      
      console.log('[PWA] Notification shown:', data.title);
    } catch (error) {
      console.error('[PWA] Failed to show notification:', error);
    }
  }

  /**
   * Cache activity for offline sync
   */
  async cacheActivityForOffline(activityData: any): Promise<void> {
    if (!this.swRegistration || !this.swRegistration.active) {
      console.warn('[PWA] Service Worker not active, cannot cache activity');
      return;
    }

    this.swRegistration.active.postMessage({
      type: 'CACHE_ACTIVITY',
      payload: activityData,
    });
  }

  /**
   * Get cache information
   */
  async getCacheInfo(): Promise<CacheInfo> {
    if (!this.swRegistration || !this.swRegistration.active) {
      return {};
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data);
      };
      
      this.swRegistration!.active!.postMessage(
        { type: 'GET_CACHE_INFO' },
        [messageChannel.port2]
      );
    });
  }

  /**
   * Send subscription to server
   */
  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription),
      });
    } catch (error) {
      console.error('[PWA] Failed to send subscription to server:', error);
    }
  }

  /**
   * Convert VAPID key
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Check if app is running in standalone mode
   */
  isStandaloneMode(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone ||
           document.referrer.includes('android-app://');
  }

  /**
   * Get notification permission status
   */
  getNotificationPermission(): NotificationPermission {
    return this.notificationSupported ? Notification.permission : 'denied';
  }

  /**
   * Check if service worker is supported
   */
  isServiceWorkerSupported(): boolean {
    return this.isServiceWorkerSupported;
  }

  /**
   * Check if notifications are supported
   */
  isNotificationSupported(): boolean {
    return this.notificationSupported;
  }
}

// Singleton instance
export const pwaService = new PWAService();

// Auto-initialize on client side
if (typeof window !== 'undefined') {
  pwaService.init().catch(console.error);
}