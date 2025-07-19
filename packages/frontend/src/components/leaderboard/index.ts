/**
 * Live Leaderboard Components - FE-505
 * 
 * Comprehensive real-time leaderboard system with:
 * - Live position updates via WebSocket
 * - Multiple view types (team, individual, goals)
 * - Time period filtering
 * - Smooth rank change animations
 * - Goal progress tracking
 * - Recent activity highlights
 */

// Main components
export { 
  LiveLeaderboard,
  TeamLeaderboard,
  IndividualLeaderboard,
  GoalLeaderboard,
  type LiveLeaderboardProps,
  type LeaderboardMember,
  type LeaderboardData,
} from './LiveLeaderboard';

export { 
  LeaderboardEntry,
} from './LeaderboardEntry';

export { 
  LeaderboardFilters,
  CompactLeaderboardFilters,
  type FilterOptions,
} from './LeaderboardFilters';

// Hook
export { 
  useLiveLeaderboard,
  type UseLiveLeaderboardOptions,
  type PositionChange,
  type LiveLeaderboardUpdate,
} from './useLiveLeaderboard';

// Re-exports for backward compatibility
export { 
  RealtimeLeaderboard,
  GracefulRealtimeLeaderboard,
} from '../dashboard/RealtimeLeaderboard';

export {
  useRealtimeLeaderboard,
  type LeaderboardEntry as RealtimeLeaderboardEntry,
  type LeaderboardUpdate as RealtimeLeaderboardUpdate,
} from '../../hooks/useRealtimeLeaderboard';