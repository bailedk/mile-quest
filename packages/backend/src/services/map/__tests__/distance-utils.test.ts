/**
 * Tests for distance calculation utilities
 */

import {
  metersToMiles,
  milesToMeters,
  metersToKilometers,
  kilometersToMeters,
  formatDistance,
  formatDuration,
  estimateWalkingTime,
  calculatePace,
  calculateSpeed,
  isPositionInBounds,
  calculateCenter,
  calculateBearing,
  bearingToCompass,
  calculateProgressStats,
  getDistanceAchievementLevel,
} from '../distance-utils';
import { Position } from '../types';

describe('Distance Utilities', () => {
  describe('unit conversions', () => {
    it('should convert meters to miles', () => {
      expect(metersToMiles(1609.344)).toBeCloseTo(1, 5);
      expect(metersToMiles(5000)).toBeCloseTo(3.10686, 4);
      expect(metersToMiles(0)).toBe(0);
    });

    it('should convert miles to meters', () => {
      expect(milesToMeters(1)).toBeCloseTo(1609.344, 3);
      expect(milesToMeters(3.10686)).toBeCloseTo(5000, 0);
      expect(milesToMeters(0)).toBe(0);
    });

    it('should convert meters to kilometers', () => {
      expect(metersToKilometers(1000)).toBe(1);
      expect(metersToKilometers(5500)).toBe(5.5);
      expect(metersToKilometers(0)).toBe(0);
    });

    it('should convert kilometers to meters', () => {
      expect(kilometersToMeters(1)).toBe(1000);
      expect(kilometersToMeters(5.5)).toBe(5500);
      expect(kilometersToMeters(0)).toBe(0);
    });
  });

  describe('formatDistance', () => {
    it('should format distance in miles', () => {
      expect(formatDistance(1609.344)).toBe('1.0 mi');
      expect(formatDistance(5000)).toBe('3.1 mi');
      expect(formatDistance(100)).toBe('328 ft');
      expect(formatDistance(50)).toBe('164 ft');
    });

    it('should format distance in metric', () => {
      expect(formatDistance(1000, true)).toBe('1.0 km');
      expect(formatDistance(5500, true)).toBe('5.5 km');
      expect(formatDistance(500, true)).toBe('500 m');
      expect(formatDistance(50, true)).toBe('50 m');
    });

    it('should respect decimal places', () => {
      expect(formatDistance(5678, false, 2)).toBe('3.53 mi');
      expect(formatDistance(5678, true, 2)).toBe('5.68 km');
      expect(formatDistance(5678, false, 0)).toBe('4 mi');
    });
  });

  describe('formatDuration', () => {
    it('should format duration', () => {
      expect(formatDuration(0)).toBe('0 min');
      expect(formatDuration(59)).toBe('0 min');
      expect(formatDuration(60)).toBe('1 min');
      expect(formatDuration(150)).toBe('2 min');
      expect(formatDuration(3600)).toBe('1h 0m');
      expect(formatDuration(3750)).toBe('1h 2m');
      expect(formatDuration(7200)).toBe('2h 0m');
    });
  });

  describe('estimateWalkingTime', () => {
    it('should estimate walking time at default speed', () => {
      // 5 km/h default speed
      expect(estimateWalkingTime(5000)).toBe(3600); // 1 hour
      expect(estimateWalkingTime(2500)).toBe(1800); // 30 minutes
      expect(estimateWalkingTime(10000)).toBe(7200); // 2 hours
    });

    it('should estimate walking time at custom speed', () => {
      expect(estimateWalkingTime(6000, 6)).toBe(3600); // 1 hour at 6 km/h
      expect(estimateWalkingTime(4000, 4)).toBe(3600); // 1 hour at 4 km/h
    });
  });

  describe('calculatePace', () => {
    it('should calculate pace in minutes per mile', () => {
      const meters = milesToMeters(1);
      expect(calculatePace(meters, 600)).toBe('10:00'); // 10 min/mile
      expect(calculatePace(meters, 450)).toBe('7:30'); // 7:30 min/mile
      expect(calculatePace(meters, 360)).toBe('6:00'); // 6 min/mile
    });

    it('should calculate pace in minutes per kilometer', () => {
      expect(calculatePace(1000, 300, true)).toBe('5:00'); // 5 min/km
      expect(calculatePace(1000, 240, true)).toBe('4:00'); // 4 min/km
      expect(calculatePace(2000, 600, true)).toBe('5:00'); // 5 min/km
    });

    it('should handle edge cases', () => {
      expect(calculatePace(0, 100)).toBe('0:00');
      expect(calculatePace(100, 0)).toBe('0:00');
      expect(calculatePace(milesToMeters(1), 59)).toBe('0:59'); // Less than 1 minute per mile
    });
  });

  describe('calculateSpeed', () => {
    it('should calculate speed in mph', () => {
      const meters = milesToMeters(10);
      const seconds = 3600; // 1 hour
      expect(calculateSpeed(meters, seconds)).toBeCloseTo(10, 1); // 10 mph
      
      const meters2 = milesToMeters(5);
      const seconds2 = 1800; // 30 minutes
      expect(calculateSpeed(meters2, seconds2)).toBeCloseTo(10, 1); // 10 mph
    });

    it('should calculate speed in km/h', () => {
      expect(calculateSpeed(10000, 3600, true)).toBe(10); // 10 km/h
      expect(calculateSpeed(5000, 1800, true)).toBe(10); // 10 km/h
      expect(calculateSpeed(5000, 3600, true)).toBeCloseTo(5, 1); // 5 km/h
    });

    it('should handle zero time', () => {
      expect(calculateSpeed(100, 0)).toBe(0);
      expect(calculateSpeed(100, 0, true)).toBe(0);
    });
  });

  describe('isPositionInBounds', () => {
    it('should check if position is within bounds', () => {
      const southwest: Position = { lat: 40.7000, lng: -74.0100 };
      const northeast: Position = { lat: 40.8000, lng: -73.9000 };

      expect(isPositionInBounds({ lat: 40.7500, lng: -73.9500 }, southwest, northeast)).toBe(true);
      expect(isPositionInBounds({ lat: 40.7000, lng: -74.0100 }, southwest, northeast)).toBe(true);
      expect(isPositionInBounds({ lat: 40.8000, lng: -73.9000 }, southwest, northeast)).toBe(true);
      
      expect(isPositionInBounds({ lat: 40.6999, lng: -73.9500 }, southwest, northeast)).toBe(false);
      expect(isPositionInBounds({ lat: 40.8001, lng: -73.9500 }, southwest, northeast)).toBe(false);
      expect(isPositionInBounds({ lat: 40.7500, lng: -74.0101 }, southwest, northeast)).toBe(false);
      expect(isPositionInBounds({ lat: 40.7500, lng: -73.8999 }, southwest, northeast)).toBe(false);
    });
  });

  describe('calculateCenter', () => {
    it('should calculate center of positions', () => {
      const positions: Position[] = [
        { lat: 40.7000, lng: -74.0000 },
        { lat: 40.8000, lng: -74.0000 },
      ];
      
      const center = calculateCenter(positions);
      expect(center).toEqual({ lat: 40.7500, lng: -74.0000 });
    });

    it('should handle multiple positions', () => {
      const positions: Position[] = [
        { lat: 40.7000, lng: -74.0000 },
        { lat: 40.8000, lng: -74.0000 },
        { lat: 40.7000, lng: -73.9000 },
        { lat: 40.8000, lng: -73.9000 },
      ];
      
      const center = calculateCenter(positions);
      expect(center?.lat).toBeCloseTo(40.7500, 4);
      expect(center?.lng).toBeCloseTo(-73.9500, 4);
    });

    it('should handle empty array', () => {
      expect(calculateCenter([])).toBeNull();
    });

    it('should handle single position', () => {
      const position: Position = { lat: 40.7128, lng: -74.0060 };
      expect(calculateCenter([position])).toEqual(position);
    });
  });

  describe('calculateBearing', () => {
    it('should calculate bearing between positions', () => {
      const from: Position = { lat: 40.7128, lng: -74.0060 };
      const to: Position = { lat: 40.7580, lng: -73.9855 };
      
      const bearing = calculateBearing(from, to);
      expect(bearing).toBeGreaterThan(0);
      expect(bearing).toBeLessThan(90); // Northeast direction
    });

    it('should calculate cardinal directions', () => {
      const center: Position = { lat: 40.7128, lng: -74.0060 };
      
      // North
      const north: Position = { lat: 40.7228, lng: -74.0060 };
      expect(calculateBearing(center, north)).toBeCloseTo(0, 0);
      
      // East
      const east: Position = { lat: 40.7128, lng: -73.9960 };
      expect(calculateBearing(center, east)).toBeCloseTo(90, 0);
      
      // South
      const south: Position = { lat: 40.7028, lng: -74.0060 };
      expect(calculateBearing(center, south)).toBeCloseTo(180, 0);
      
      // West
      const west: Position = { lat: 40.7128, lng: -74.0160 };
      expect(calculateBearing(center, west)).toBeCloseTo(270, 0);
    });
  });

  describe('bearingToCompass', () => {
    it('should convert bearing to compass direction', () => {
      expect(bearingToCompass(0)).toBe('N');
      expect(bearingToCompass(22.5)).toBe('NNE');
      expect(bearingToCompass(45)).toBe('NE');
      expect(bearingToCompass(90)).toBe('E');
      expect(bearingToCompass(135)).toBe('SE');
      expect(bearingToCompass(180)).toBe('S');
      expect(bearingToCompass(225)).toBe('SW');
      expect(bearingToCompass(270)).toBe('W');
      expect(bearingToCompass(315)).toBe('NW');
      expect(bearingToCompass(337.5)).toBe('NNW');
      expect(bearingToCompass(360)).toBe('N');
    });
  });

  describe('calculateProgressStats', () => {
    it('should calculate progress statistics', () => {
      const stats = calculateProgressStats(10000, 2500, 1800); // 10km goal, 2.5km done, 30 min
      
      expect(stats.distanceCompleted).toBe(2500);
      expect(stats.distanceRemaining).toBe(7500);
      expect(stats.percentComplete).toBe(25);
      expect(stats.averageSpeed).toBeCloseTo(5, 1); // 5 km/h
      expect(stats.currentPace).toBeCloseTo(1.39, 1); // meters/second
      expect(stats.estimatedTimeRemaining).toBeCloseTo(5400, -2); // ~90 minutes
    });

    it('should handle completed goals', () => {
      const stats = calculateProgressStats(10000, 10000, 3600);
      
      expect(stats.distanceRemaining).toBe(0);
      expect(stats.percentComplete).toBe(100);
      expect(stats.estimatedTimeRemaining).toBe(0);
    });

    it('should handle over-achievement', () => {
      const stats = calculateProgressStats(10000, 12000, 3600);
      
      expect(stats.distanceRemaining).toBe(0);
      expect(stats.percentComplete).toBe(100);
    });

    it('should handle zero elapsed time', () => {
      const stats = calculateProgressStats(10000, 0, 0);
      
      expect(stats.currentPace).toBe(0);
      expect(stats.averageSpeed).toBe(0);
      expect(stats.estimatedTimeRemaining).toBe(0);
    });
  });

  describe('getDistanceAchievementLevel', () => {
    it('should return correct achievement levels', () => {
      expect(getDistanceAchievementLevel(milesToMeters(5))).toMatchObject({
        label: 'Starter',
        emoji: '🚶',
      });
      
      expect(getDistanceAchievementLevel(milesToMeters(25))).toMatchObject({
        label: 'Walker',
        emoji: '🥾',
      });
      
      expect(getDistanceAchievementLevel(milesToMeters(75))).toMatchObject({
        label: 'Hiker',
        emoji: '🥥',
      });
      
      expect(getDistanceAchievementLevel(milesToMeters(250))).toMatchObject({
        label: 'Trekker',
        emoji: '⛰️',
      });
      
      expect(getDistanceAchievementLevel(milesToMeters(750))).toMatchObject({
        label: 'Explorer',
        emoji: '🗺️',
      });
      
      expect(getDistanceAchievementLevel(milesToMeters(1500))).toMatchObject({
        label: 'Legend',
        emoji: '🏆',
      });
    });
  });
});