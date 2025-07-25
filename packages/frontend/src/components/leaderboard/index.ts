/**
 * Leaderboard Components
 * 
 * Leaderboard system with:
 * - Multiple view types (team, individual, goals)
 * - Time period filtering
 * - Goal progress tracking
 */

// Main components
export { LeaderboardEntry } from './LeaderboardEntry';
export { LeaderboardFilters, CompactLeaderboardFilters, type FilterOptions } from './LeaderboardFilters';

// Types
export interface LeaderboardMember {
  id: string;
  name: string;
  distance: number;
  activities: number;
  lastActivityAt?: string;
  rank?: number;
  avatar?: string;
}

export interface LeaderboardData {
  id: string;
  name: string;
  members: LeaderboardMember[];
  totalDistance: number;
  totalActivities: number;
  period: 'daily' | 'weekly' | 'monthly' | 'all-time';
}