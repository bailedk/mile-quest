import { WebSocketService, WebSocketConfig } from './types';

export class MockWebSocketService implements WebSocketService {
  private connected = false;
  private subscriptions = new Map<string, Set<(data: any) => void>>();
  private eventListeners = new Map<string, Set<(data: any) => void>>();

  constructor(config?: WebSocketConfig) {
    // Mock service doesn't need config
  }

  async connect(): Promise<void> {
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 100));
    this.connected = true;
  }

  disconnect(): void {
    this.connected = false;
    this.subscriptions.clear();
    this.eventListeners.clear();
  }

  isConnected(): boolean {
    return this.connected;
  }

  subscribe(channel: string, callback: (data: any) => void): () => void {
    if (!this.connected) {
      throw new Error('WebSocket not connected');
    }

    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }

    this.subscriptions.get(channel)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(channel);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(channel);
        }
      }
    };
  }

  unsubscribe(channel: string): void {
    this.subscriptions.delete(channel);
  }

  on(event: string, callback: (data: any) => void): () => void {
    if (!this.connected) {
      throw new Error('WebSocket not connected');
    }

    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }

    this.eventListeners.get(event)!.add(callback);

    return () => {
      const callbacks = this.eventListeners.get(event);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.eventListeners.delete(event);
        }
      }
    };
  }

  off(event: string, callback?: (data: any) => void): void {
    if (callback) {
      const callbacks = this.eventListeners.get(event);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.eventListeners.delete(event);
        }
      }
    } else {
      this.eventListeners.delete(event);
    }
  }

  // Test helper methods
  simulateMessage(channel: string, event: string, data: any): void {
    const callbacks = this.subscriptions.get(channel);
    if (callbacks) {
      callbacks.forEach(callback => {
        callback({ event, data });
      });
    }
  }

  simulateEvent(event: string, data: any): void {
    const callbacks = this.eventListeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }
}