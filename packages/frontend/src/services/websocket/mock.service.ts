import { WebSocketService, WebSocketConfig, WebSocketConnectionState } from './types';

export class MockWebSocketService implements WebSocketService {
  private connectionState = WebSocketConnectionState.DISCONNECTED;
  private subscriptions = new Map<string, Set<(data: any) => void>>();
  private eventListeners = new Map<string, Set<(data: any) => void>>();
  private stateChangeCallbacks: ((state: WebSocketConnectionState) => void)[] = [];
  private errorCallbacks: ((error: Error) => void)[] = [];

  constructor(config?: WebSocketConfig) {
    // Mock service doesn't need config
  }

  async connect(): Promise<void> {
    this.setConnectionState(WebSocketConnectionState.CONNECTING);
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 100));
    this.setConnectionState(WebSocketConnectionState.CONNECTED);
  }

  disconnect(): void {
    this.setConnectionState(WebSocketConnectionState.DISCONNECTED);
    this.subscriptions.clear();
    this.eventListeners.clear();
  }

  isConnected(): boolean {
    return this.connectionState === WebSocketConnectionState.CONNECTED;
  }

  getConnectionState(): WebSocketConnectionState {
    return this.connectionState;
  }

  getSocketId(): string | null {
    return this.isConnected() ? 'mock-socket-id' : null;
  }

  private setConnectionState(state: WebSocketConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.stateChangeCallbacks.forEach(callback => {
        try {
          callback(state);
        } catch (error) {
          console.error('Error in connection state callback:', error);
        }
      });
    }
  }

  subscribe(channel: string, callback: (data: any) => void): () => void {
    if (!this.isConnected()) {
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
    if (!this.isConnected()) {
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

  onConnectionStateChange(callback: (state: WebSocketConnectionState) => void): () => void {
    this.stateChangeCallbacks.push(callback);
    
    return () => {
      const index = this.stateChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.stateChangeCallbacks.splice(index, 1);
      }
    };
  }

  onError(callback: (error: Error) => void): () => void {
    this.errorCallbacks.push(callback);
    
    return () => {
      const index = this.errorCallbacks.indexOf(callback);
      if (index > -1) {
        this.errorCallbacks.splice(index, 1);
      }
    };
  }

  // Test helper methods
  simulateMessage(channel: string, event: string, data: any): void {
    const callbacks = this.subscriptions.get(channel);
    if (callbacks) {
      callbacks.forEach(callback => {
        callback({ event, data, timestamp: Date.now() });
      });
    }
  }

  simulateEvent(event: string, data: any): void {
    const callbacks = this.eventListeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  simulateConnectionError(error: Error): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (callbackError) {
        console.error('Error in error callback:', callbackError);
      }
    });
  }

  simulateStateChange(state: WebSocketConnectionState): void {
    this.setConnectionState(state);
  }
}