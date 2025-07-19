import Pusher from 'pusher-js';
import { WebSocketService, WebSocketConfig } from './types';

export class PusherWebSocketService implements WebSocketService {
  private pusher: Pusher | null = null;
  private config: WebSocketConfig;
  private channels: Map<string, any> = new Map();

  constructor(config: WebSocketConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.pusher) return;

    this.pusher = new Pusher(this.config.key || '', {
      cluster: this.config.cluster,
      authEndpoint: this.config.authEndpoint,
      auth: this.config.auth,
    });

    return new Promise((resolve) => {
      this.pusher!.connection.bind('connected', () => {
        resolve();
      });
    });
  }

  disconnect(): void {
    if (this.pusher) {
      this.pusher.disconnect();
      this.pusher = null;
      this.channels.clear();
    }
  }

  isConnected(): boolean {
    return this.pusher?.connection.state === 'connected';
  }

  subscribe(channelName: string, callback: (data: any) => void): () => void {
    if (!this.pusher) {
      throw new Error('WebSocket not connected');
    }

    let channel = this.channels.get(channelName);
    if (!channel) {
      channel = this.pusher.subscribe(channelName);
      this.channels.set(channelName, channel);
    }

    // Bind to all events on the channel
    channel.bind_global((eventName: string, data: any) => {
      callback({ event: eventName, data });
    });

    // Return unsubscribe function
    return () => {
      channel.unbind_global();
    };
  }

  unsubscribe(channelName: string): void {
    if (!this.pusher) return;

    const channel = this.channels.get(channelName);
    if (channel) {
      this.pusher.unsubscribe(channelName);
      this.channels.delete(channelName);
    }
  }

  on(event: string, callback: (data: any) => void): () => void {
    if (!this.pusher) {
      throw new Error('WebSocket not connected');
    }

    this.pusher.bind(event, callback);

    return () => {
      this.pusher?.unbind(event, callback);
    };
  }

  off(event: string, callback?: (data: any) => void): void {
    if (!this.pusher) return;

    if (callback) {
      this.pusher.unbind(event, callback);
    } else {
      this.pusher.unbind(event);
    }
  }
}