import { calculatePace, calculateProgress, formatDistance, formatDuration, formatRelativeTime } from '@mile-quest/shared';

export const METERS_PER_MILE = 1609.344;

export type DistanceUnits = 'miles' | 'kilometers';

export function preferredUnits(units: string | undefined): DistanceUnits {
  return units === 'kilometers' ? 'kilometers' : 'miles';
}

export function distanceToMeters(value: number, units: DistanceUnits): number {
  if (units === 'kilometers') return value * 1000;
  return value * METERS_PER_MILE;
}

export function formatMeters(meters: number, units: DistanceUnits): string {
  if (units === 'kilometers') {
    if (!Number.isFinite(meters) || meters <= 0) return '0 m';
    if (meters < 100) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return formatDistance(meters / METERS_PER_MILE);
}

export function formatPaceFromMeters(meters: number, seconds: number, units: DistanceUnits): string {
  if (units === 'kilometers') {
    const pace = calculatePace(meters / 1000, seconds);
    return pace === '--' ? pace : pace.replace('/mi', '/km');
  }
  return calculatePace(meters / METERS_PER_MILE, seconds);
}

export function formatWalkDuration(seconds: number): string {
  return formatDuration(seconds);
}

export function formatWhen(timestamp: string): string {
  return formatRelativeTime(timestamp);
}

export function progressPercent(currentMeters: number, targetMeters: number): number {
  return calculateProgress(currentMeters, targetMeters);
}

export function combineLocalDateTime(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const parsed = new Date(`${date}T${time}:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function todayDateInput(now = new Date()): string {
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function nowTimeInput(now = new Date()): string {
  return `${`${now.getHours()}`.padStart(2, '0')}:${`${now.getMinutes()}`.padStart(2, '0')}`;
}

export function sourceLabel(source: string): string {
  switch (source) {
    case 'APPLE_HEALTH':
      return 'Apple Health';
    case 'HEALTH_CONNECT':
      return 'Health Connect';
    case 'GOOGLE_FIT':
      return 'Google Fit';
    case 'STRAVA':
      return 'Strava';
    default:
      return 'Manual';
  }
}
