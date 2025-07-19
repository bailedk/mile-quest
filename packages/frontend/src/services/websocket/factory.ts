import { WebSocketService, WebSocketConfig, WebSocketProvider } from './types';
import { PusherWebSocketService } from './pusher.service';
import { MockWebSocketService } from './mock.service';

export function createWebSocketService(
  config?: Partial<WebSocketConfig>
): WebSocketService {
  const provider = (process.env.NEXT_PUBLIC_WEBSOCKET_PROVIDER || 'mock') as WebSocketProvider;
  
  const fullConfig: WebSocketConfig = {
    key: process.env.NEXT_PUBLIC_PUSHER_KEY,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2',
    authEndpoint: '/api/pusher/auth',
    ...config,
  };

  switch (provider) {
    case 'pusher':
      if (!fullConfig.key) {
        throw new Error('Pusher key is required');
      }
      return new PusherWebSocketService(fullConfig);
    
    case 'mock':
      return new MockWebSocketService(fullConfig);
    
    default:
      throw new Error(`Unknown WebSocket provider: ${provider}`);
  }
}