/**
 * Real-time hooks index - exports all real-time WebSocket hooks
 * This file provides a convenient way to import all real-time features
 */

// Core WebSocket hook with enhanced features
export { 
  useWebSocket,
  type WebSocketMetrics 
} from './useWebSocket';

// Presence tracking for team members
export { 
  usePresence,
  type TeamMember,
  type PresenceInfo,
  type TeamPresence,
  type UsePresenceOptions 
} from './usePresence';

// Activity feed for live updates
export { 
  useActivityFeed,
  type ActivityFeedItem,
  type ActivityFeedUpdate,
  type UseActivityFeedOptions 
} from './useActivityFeed';

// General real-time updates (existing)
export { 
  useRealtimeUpdates,
  type RealtimeUpdate,
  type Achievement,
  type UseRealtimeUpdatesOptions 
} from './useRealtimeUpdates';

// Specific real-time features (existing)
export { useRealtimeActivities } from './useRealtimeActivities';
export { useRealtimeLeaderboard } from './useRealtimeLeaderboard';
export { useRealtimeTeamProgress } from './useRealtimeTeamProgress';

// Mobile optimization (existing)
export { useMobileRealtimeOptimization } from './useMobileRealtimeOptimization';

// WebSocket context and status hooks
export { 
  useWebSocketContext,
  useWebSocketStatus,
  WebSocketProvider 
} from '../contexts/WebSocketContext';

// WebSocket types
export type {
  WebSocketEventType,
  WebSocketChannelType,
  TypedWebSocketMessage,
  PresenceEventData,
  PresenceInitialStateData,
  ActivityEventData,
  AchievementEventData,
  TeamEventData,
  GoalEventData,
  LeaderboardEventData,
  StatsEventData,
  WebSocketConnectionInfo,
  WebSocketConnectionState,
  WebSocketService,
  WebSocketConfig,
  WebSocketError
} from '../services/websocket/types';