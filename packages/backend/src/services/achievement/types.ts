import { Achievement, UserAchievement, AchievementCategory } from '@prisma/client';

export interface AchievementDefinition {
  key: string;
  name: string;
  description: string;
  iconUrl: string;
  category: AchievementCategory;
  points: number;
  criteria: AchievementCriteria;
}

export interface AchievementCriteria {
  type: 'distance' | 'streak' | 'team' | 'time' | 'count';
  condition: {
    operator: 'gte' | 'eq' | 'lt' | 'gt';
    value: number;
    unit?: 'meters' | 'days' | 'count' | 'hour';
  };
  // Additional conditions for complex achievements
  additionalConditions?: {
    field: string;
    operator: 'gte' | 'eq' | 'lt' | 'gt' | 'between';
    value: number | [number, number];
  }[];
}

export interface AchievementWithUser extends UserAchievement {
  achievement: Achievement;
}

export interface AchievementCheckResult {
  newAchievements: AchievementWithUser[];
  checkedAchievements: string[];
}

export interface UserAchievementProgress {
  achievement: Achievement;
  earned: boolean;
  earnedAt?: Date;
  progress?: {
    current: number;
    target: number;
    percentage: number;
  };
}

// Predefined achievements
export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // Distance achievements
  {
    key: 'first_walk',
    name: 'First Walk',
    description: 'Complete your first walking activity',
    iconUrl: '/achievements/first-walk.png',
    category: 'DISTANCE',
    points: 10,
    criteria: {
      type: 'count',
      condition: {
        operator: 'gte',
        value: 1,
        unit: 'count',
      },
    },
  },
  {
    key: '10_mile_club',
    name: '10 Mile Club',
    description: 'Walk a total of 10 miles',
    iconUrl: '/achievements/10-mile.png',
    category: 'DISTANCE',
    points: 20,
    criteria: {
      type: 'distance',
      condition: {
        operator: 'gte',
        value: 16093.44, // 10 miles in meters
        unit: 'meters',
      },
    },
  },
  {
    key: '100_mile_hero',
    name: '100 Mile Hero',
    description: 'Walk a total of 100 miles',
    iconUrl: '/achievements/100-mile.png',
    category: 'DISTANCE',
    points: 100,
    criteria: {
      type: 'distance',
      condition: {
        operator: 'gte',
        value: 160934.4, // 100 miles in meters
        unit: 'meters',
      },
    },
  },
  // Streak achievements
  {
    key: '7_day_streak',
    name: '7-Day Streak',
    description: 'Walk every day for 7 consecutive days',
    iconUrl: '/achievements/7-day-streak.png',
    category: 'STREAK',
    points: 30,
    criteria: {
      type: 'streak',
      condition: {
        operator: 'gte',
        value: 7,
        unit: 'days',
      },
    },
  },
  {
    key: '30_day_streak',
    name: '30-Day Streak',
    description: 'Walk every day for 30 consecutive days',
    iconUrl: '/achievements/30-day-streak.png',
    category: 'STREAK',
    points: 100,
    criteria: {
      type: 'streak',
      condition: {
        operator: 'gte',
        value: 30,
        unit: 'days',
      },
    },
  },
  // Team achievements
  {
    key: 'team_player',
    name: 'Team Player',
    description: 'Join your first team',
    iconUrl: '/achievements/team-player.png',
    category: 'TEAM',
    points: 10,
    criteria: {
      type: 'team',
      condition: {
        operator: 'gte',
        value: 1,
        unit: 'count',
      },
    },
  },
  // Special achievements
  {
    key: 'early_bird',
    name: 'Early Bird',
    description: 'Complete an activity before 7 AM',
    iconUrl: '/achievements/early-bird.png',
    category: 'SPECIAL',
    points: 15,
    criteria: {
      type: 'time',
      condition: {
        operator: 'lt',
        value: 7,
        unit: 'hour',
      },
    },
  },
];