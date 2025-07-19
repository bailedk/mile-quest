/**
 * Distance calculation utilities
 * 
 * Common functions for distance conversions and calculations
 * used throughout the Mile Quest application.
 */

import { Position } from './types';

/**
 * Convert meters to miles
 */
export function metersToMiles(meters: number): number {
  return meters * 0.000621371;
}

/**
 * Convert miles to meters
 */
export function milesToMeters(miles: number): number {
  return miles * 1609.344;
}

/**
 * Convert meters to kilometers
 */
export function metersToKilometers(meters: number): number {
  return meters / 1000;
}

/**
 * Convert kilometers to meters
 */
export function kilometersToMeters(kilometers: number): number {
  return kilometers * 1000;
}

/**
 * Format distance for display with appropriate units
 * @param meters Distance in meters
 * @param useMetric Whether to use metric units (default: false for miles)
 * @param decimals Number of decimal places (default: 1)
 */
export function formatDistance(
  meters: number,
  useMetric: boolean = false,
  decimals: number = 1
): string {
  if (useMetric) {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${metersToKilometers(meters).toFixed(decimals)} km`;
  } else {
    const miles = metersToMiles(meters);
    if (miles < 0.1) {
      return `${Math.round(meters * 3.28084)} ft`;
    }
    return `${miles.toFixed(decimals)} mi`;
  }
}

/**
 * Format duration for display
 * @param seconds Duration in seconds
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} min`;
}

/**
 * Calculate walking time estimate based on distance
 * @param meters Distance in meters
 * @param speedKmh Walking speed in km/h (default: 5 km/h)
 */
export function estimateWalkingTime(
  meters: number,
  speedKmh: number = 5
): number {
  const kilometers = metersToKilometers(meters);
  const hours = kilometers / speedKmh;
  return Math.round(hours * 3600); // Return seconds
}

/**
 * Calculate pace (time per distance unit)
 * @param meters Distance in meters
 * @param seconds Time in seconds
 * @param useMetric Whether to calculate min/km (true) or min/mile (false)
 */
export function calculatePace(
  meters: number,
  seconds: number,
  useMetric: boolean = false
): string {
  if (meters === 0 || seconds === 0) return '0:00';
  
  let timePerUnit: number;
  
  if (useMetric) {
    // Minutes per kilometer
    const kilometers = metersToKilometers(meters);
    timePerUnit = (seconds / 60) / kilometers;
  } else {
    // Minutes per mile
    const miles = metersToMiles(meters);
    timePerUnit = (seconds / 60) / miles;
  }
  
  const minutes = Math.floor(timePerUnit);
  const remainingSeconds = Math.round((timePerUnit - minutes) * 60);
  
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Calculate average speed
 * @param meters Distance in meters
 * @param seconds Time in seconds
 * @param useMetric Whether to return km/h (true) or mph (false)
 */
export function calculateSpeed(
  meters: number,
  seconds: number,
  useMetric: boolean = false
): number {
  if (seconds === 0) return 0;
  
  const hours = seconds / 3600;
  
  if (useMetric) {
    const kilometers = metersToKilometers(meters);
    return kilometers / hours;
  } else {
    const miles = metersToMiles(meters);
    return miles / hours;
  }
}

/**
 * Check if a position is within a bounding box
 */
export function isPositionInBounds(
  position: Position,
  southwest: Position,
  northeast: Position
): boolean {
  return (
    position.lat >= southwest.lat &&
    position.lat <= northeast.lat &&
    position.lng >= southwest.lng &&
    position.lng <= northeast.lng
  );
}

/**
 * Calculate the center point of multiple positions
 */
export function calculateCenter(positions: Position[]): Position | null {
  if (positions.length === 0) return null;
  
  const sum = positions.reduce(
    (acc, pos) => ({
      lat: acc.lat + pos.lat,
      lng: acc.lng + pos.lng,
    }),
    { lat: 0, lng: 0 }
  );
  
  return {
    lat: sum.lat / positions.length,
    lng: sum.lng / positions.length,
  };
}

/**
 * Calculate bearing between two positions
 * @returns Bearing in degrees (0-360)
 */
export function calculateBearing(from: Position, to: Position): number {
  const dLng = (to.lng - from.lng) * Math.PI / 180;
  const lat1 = from.lat * Math.PI / 180;
  const lat2 = to.lat * Math.PI / 180;
  
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  
  return (bearing + 360) % 360;
}

/**
 * Get compass direction from bearing
 */
export function bearingToCompass(bearing: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(bearing / 22.5) % 16;
  return directions[index];
}

/**
 * Progress tracking utilities
 */
export interface ProgressStats {
  distanceCompleted: number;
  distanceRemaining: number;
  percentComplete: number;
  estimatedTimeRemaining: number;
  currentPace: number;
  averageSpeed: number;
}

/**
 * Calculate progress statistics for a team goal
 */
export function calculateProgressStats(
  targetDistance: number,
  completedDistance: number,
  elapsedTime: number
): ProgressStats {
  const distanceRemaining = Math.max(0, targetDistance - completedDistance);
  const percentComplete = targetDistance > 0 
    ? Math.min(100, (completedDistance / targetDistance) * 100)
    : 0;
  
  const averageSpeed = calculateSpeed(completedDistance, elapsedTime, true);
  const currentPace = elapsedTime > 0 ? completedDistance / elapsedTime : 0;
  
  const estimatedTimeRemaining = currentPace > 0
    ? distanceRemaining / currentPace
    : 0;
  
  return {
    distanceCompleted: completedDistance,
    distanceRemaining,
    percentComplete,
    estimatedTimeRemaining,
    currentPace,
    averageSpeed,
  };
}

/**
 * Group distance utilities for leaderboards
 */
export interface DistanceRange {
  min: number;
  max: number;
  label: string;
  emoji: string;
}

/**
 * Get achievement level based on distance
 */
export function getDistanceAchievementLevel(meters: number): DistanceRange {
  const miles = metersToMiles(meters);
  
  if (miles < 10) {
    return { min: 0, max: 10, label: 'Starter', emoji: '🚶' };
  } else if (miles < 50) {
    return { min: 10, max: 50, label: 'Walker', emoji: '🥾' };
  } else if (miles < 100) {
    return { min: 50, max: 100, label: 'Hiker', emoji: '🥥' };
  } else if (miles < 500) {
    return { min: 100, max: 500, label: 'Trekker', emoji: '⛰️' };
  } else if (miles < 1000) {
    return { min: 500, max: 1000, label: 'Explorer', emoji: '🗺️' };
  } else {
    return { min: 1000, max: Infinity, label: 'Legend', emoji: '🏆' };
  }
}