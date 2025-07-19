/**
 * WebSocket service exports
 * Enhanced with comprehensive abstractions and management capabilities
 */

export * from './types';
export * from './factory';
export { PusherWebSocketService } from './pusher.service';
export { MockWebSocketService } from './mock.service';
export { WebSocketEventHandler, EventMiddleware } from './event-handler';

// Re-export key factory functions for convenience
export {
  createWebSocketService,
  createWebSocketServiceWithProvider,
  createProductionWebSocketService,
  createTestWebSocketService,
} from './factory';