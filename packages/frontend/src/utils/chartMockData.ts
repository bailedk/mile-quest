import { subDays, format } from 'date-fns';

// Mock data generator for charts
export interface DailyProgressData {
  date: string;
  distance: number;
  cumulative: number;
}

export interface ActivityBreakdownData {
  day: string;
  distance: number;
  activities: number;
}

export interface GoalProgressData {
  period: string;
  progress: number;
  target: number;
  percentage: number;
}

// Generate daily progress data for the last 30 days
export function generateDailyProgressData(): DailyProgressData[] {
  const data: DailyProgressData[] = [];
  let cumulative = 0;
  
  for (let i = 29; i >= 0; i--) {
    const date = subDays(new Date(), i);
    // Simulate varying daily distances (0-8km with some rest days)
    const dailyDistance = Math.random() > 0.3 ? Math.floor(Math.random() * 8000) + 1000 : 0;
    cumulative += dailyDistance;
    
    data.push({
      date: format(date, 'MMM dd'),
      distance: dailyDistance,
      cumulative,
    });
  }
  
  return data;
}

// Generate weekly progress data for the last 8 weeks
export function generateWeeklyProgressData(): DailyProgressData[] {
  const data: DailyProgressData[] = [];
  let cumulative = 0;
  
  for (let i = 7; i >= 0; i--) {
    const weekStart = subDays(new Date(), i * 7);
    // Simulate weekly distances (10-50km per week)
    const weeklyDistance = Math.floor(Math.random() * 40000) + 10000;
    cumulative += weeklyDistance;
    
    data.push({
      date: format(weekStart, 'MMM dd'),
      distance: weeklyDistance,
      cumulative,
    });
  }
  
  return data;
}

// Generate activity breakdown for the last 7 days
export function generateActivityBreakdownData(): ActivityBreakdownData[] {
  const data: ActivityBreakdownData[] = [];
  
  for (let i = 6; i >= 0; i--) {
    const date = subDays(new Date(), i);
    const numActivities = Math.random() > 0.3 ? Math.floor(Math.random() * 3) + 1 : 0;
    const distance = numActivities > 0 ? Math.floor(Math.random() * 6000) + 1000 : 0;
    
    data.push({
      day: format(date, 'EEE'), // Mon, Tue, etc.
      distance,
      activities: numActivities,
    });
  }
  
  return data;
}

// Generate goal progress data
export function generateGoalProgressData(currentDistance: number, targetDistance: number): GoalProgressData[] {
  const daysInMonth = 30;
  const daysElapsed = 18; // Simulate 18 days into the month
  const expectedProgress = (targetDistance / daysInMonth) * daysElapsed;
  
  return [
    {
      period: 'Expected',
      progress: expectedProgress,
      target: targetDistance,
      percentage: (expectedProgress / targetDistance) * 100,
    },
    {
      period: 'Actual',
      progress: currentDistance,
      target: targetDistance,
      percentage: (currentDistance / targetDistance) * 100,
    },
  ];
}

// Team comparison data
export interface TeamComparisonData {
  teamName: string;
  distance: number;
  percentage: number;
}

export function generateTeamComparisonData(): TeamComparisonData[] {
  return [
    { teamName: 'Walking Warriors', distance: 32000, percentage: 32 },
    { teamName: 'Morning Strollers', distance: 45000, percentage: 90 },
    { teamName: 'Fitness Friends', distance: 28000, percentage: 56 },
    { teamName: 'Step Squad', distance: 38000, percentage: 76 },
  ];
}