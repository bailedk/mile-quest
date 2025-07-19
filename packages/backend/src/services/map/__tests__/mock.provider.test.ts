/**
 * Tests for Mock Map Service Provider
 */

import { MockMapService } from '../mock.provider';
import {
  MapServiceError,
  MapErrorCode,
  Waypoint,
  Position,
  SearchOptions,
  RouteOptions,
} from '../types';

describe('MockMapService', () => {
  let service: MockMapService;

  beforeEach(() => {
    service = new MockMapService();
  });

  describe('searchAddress', () => {
    it('should return mock search results', async () => {
      const results = await service.searchAddress('Main Street');

      expect(results).toHaveLength(3);
      expect(results[0]).toMatchObject({
        id: 'mock-1',
        address: expect.stringContaining('Main Street'),
        position: expect.objectContaining({
          lat: expect.any(Number),
          lng: expect.any(Number),
        }),
        relevance: expect.any(Number),
        type: 'address',
      });
    });

    it('should respect limit option', async () => {
      const options: SearchOptions = { limit: 2 };
      const results = await service.searchAddress('Test', options);

      expect(results).toHaveLength(2);
    });

    it('should include query in results', async () => {
      const query = 'Broadway';
      const results = await service.searchAddress(query);

      results.forEach(result => {
        expect(result.address).toContain(query);
      });
    });
  });

  describe('reverseGeocode', () => {
    it('should return address for known coordinates', async () => {
      const position: Position = { lat: 40.7128, lng: -74.0060 };
      const address = await service.reverseGeocode(position);

      expect(address).toBe('123 Main Street, New York, NY 10001');
    });

    it('should return generic address for unknown coordinates', async () => {
      const position: Position = { lat: 51.5074, lng: -0.1278 };
      const address = await service.reverseGeocode(position);

      expect(address).toMatch(/Near 51\.5074°N, -?0\.1278°W/);
    });
  });

  describe('calculateRoute', () => {
    it('should calculate route between waypoints', async () => {
      const waypoints: Waypoint[] = [
        { id: '1', position: { lat: 40.7128, lng: -74.0060 }, order: 1 },
        { id: '2', position: { lat: 40.7580, lng: -73.9855 }, order: 2 },
      ];

      const route = await service.calculateRoute(waypoints);

      expect(route).toMatchObject({
        id: expect.stringMatching(/^mock-route-\d+$/),
        waypoints,
        totalDistance: expect.any(Number),
        totalDuration: expect.any(Number),
        segments: expect.arrayContaining([
          expect.objectContaining({
            startWaypoint: waypoints[0],
            endWaypoint: waypoints[1],
            distance: expect.any(Number),
            duration: expect.any(Number),
          }),
        ]),
        bounds: expect.objectContaining({
          southwest: expect.any(Object),
          northeast: expect.any(Object),
        }),
      });
    });

    it('should calculate multi-segment route', async () => {
      const waypoints: Waypoint[] = [
        { id: '1', position: { lat: 40.7128, lng: -74.0060 }, order: 1 },
        { id: '2', position: { lat: 40.7300, lng: -74.0000 }, order: 2 },
        { id: '3', position: { lat: 40.7580, lng: -73.9855 }, order: 3 },
      ];

      const route = await service.calculateRoute(waypoints);

      expect(route.segments).toHaveLength(2);
      expect(route.segments[0].startWaypoint.id).toBe('1');
      expect(route.segments[0].endWaypoint.id).toBe('2');
      expect(route.segments[1].startWaypoint.id).toBe('2');
      expect(route.segments[1].endWaypoint.id).toBe('3');
    });

    it('should throw error with less than 2 waypoints', async () => {
      const waypoints: Waypoint[] = [
        { id: '1', position: { lat: 40.7128, lng: -74.0060 }, order: 1 },
      ];

      await expect(service.calculateRoute(waypoints)).rejects.toThrow(MapServiceError);
      await expect(service.calculateRoute(waypoints)).rejects.toThrow('At least 2 waypoints are required');
    });

    it('should handle different route profiles', async () => {
      const waypoints: Waypoint[] = [
        { id: '1', position: { lat: 40.7128, lng: -74.0060 }, order: 1 },
        { id: '2', position: { lat: 40.7580, lng: -73.9855 }, order: 2 },
      ];

      const walkingRoute = await service.calculateRoute(waypoints, { profile: 'walking' });
      const cyclingRoute = await service.calculateRoute(waypoints, { profile: 'cycling' });
      const drivingRoute = await service.calculateRoute(waypoints, { profile: 'driving' });

      // Cycling should be faster than walking
      expect(cyclingRoute.totalDuration).toBeLessThan(walkingRoute.totalDuration);
      // Driving should be faster than cycling
      expect(drivingRoute.totalDuration).toBeLessThan(cyclingRoute.totalDuration);
      // Distance should be the same
      expect(walkingRoute.totalDistance).toBeCloseTo(cyclingRoute.totalDistance, 0);
    });
  });

  describe('optimizeWaypoints', () => {
    it('should optimize waypoint order', async () => {
      const waypoints: Waypoint[] = [
        { id: '1', position: { lat: 40.7128, lng: -74.0060 }, order: 1 },
        { id: '2', position: { lat: 40.7580, lng: -73.9855 }, order: 2 },
        { id: '3', position: { lat: 40.7300, lng: -74.0000 }, order: 3 },
        { id: '4', position: { lat: 40.7400, lng: -73.9900 }, order: 4 },
      ];

      const optimized = await service.optimizeWaypoints(waypoints);

      expect(optimized).toHaveLength(4);
      // First and last should remain the same
      expect(optimized[0].id).toBe('1');
      expect(optimized[3].id).toBe('4');
      // Middle waypoints should be reordered
      expect(optimized[1].order).toBe(2);
      expect(optimized[2].order).toBe(3);
    });

    it('should not optimize less than 3 waypoints', async () => {
      const waypoints: Waypoint[] = [
        { id: '1', position: { lat: 40.7128, lng: -74.0060 }, order: 1 },
        { id: '2', position: { lat: 40.7580, lng: -73.9855 }, order: 2 },
      ];

      const result = await service.optimizeWaypoints(waypoints);
      expect(result).toEqual(waypoints);
    });
  });

  describe('distance calculations', () => {
    it('should calculate distance between two points', () => {
      const from: Position = { lat: 40.7128, lng: -74.0060 };
      const to: Position = { lat: 40.7580, lng: -73.9855 };

      const distance = service.calculateDistance(from, to);

      // Should calculate reasonable distance
      expect(distance).toBeGreaterThan(5000); // > 5km
      expect(distance).toBeLessThan(6000);    // < 6km
    });

    it('should return 0 for same position', () => {
      const position: Position = { lat: 40.7128, lng: -74.0060 };
      const distance = service.calculateDistance(position, position);

      expect(distance).toBe(0);
    });

    it('should calculate route distance', () => {
      const positions: Position[] = [
        { lat: 40.7128, lng: -74.0060 },
        { lat: 40.7300, lng: -74.0000 },
        { lat: 40.7580, lng: -73.9855 },
      ];

      const distance = service.calculateRouteDistance(positions);

      expect(distance).toBeGreaterThan(0);
      // Total should be greater than direct distance
      expect(distance).toBeGreaterThan(
        service.calculateDistance(positions[0], positions[2])
      );
    });

    it('should return 0 for empty or single position', () => {
      expect(service.calculateRouteDistance([])).toBe(0);
      expect(service.calculateRouteDistance([{ lat: 40, lng: -74 }])).toBe(0);
    });
  });

  describe('getBounds', () => {
    it('should calculate bounds for positions', () => {
      const positions: Position[] = [
        { lat: 40.7128, lng: -74.0060 },
        { lat: 40.7580, lng: -73.9855 },
        { lat: 40.7300, lng: -74.0200 },
      ];

      const bounds = service.getBounds(positions);

      expect(bounds.southwest.lat).toBe(40.7128);
      expect(bounds.southwest.lng).toBe(-74.0200);
      expect(bounds.northeast.lat).toBe(40.7580);
      expect(bounds.northeast.lng).toBe(-73.9855);
    });

    it('should handle single position', () => {
      const positions: Position[] = [{ lat: 40.7128, lng: -74.0060 }];
      const bounds = service.getBounds(positions);

      expect(bounds.southwest).toEqual(positions[0]);
      expect(bounds.northeast).toEqual(positions[0]);
    });

    it('should throw error for empty positions', () => {
      expect(() => service.getBounds([])).toThrow(MapServiceError);
      expect(() => service.getBounds([])).toThrow('No positions provided for bounds calculation');
    });
  });

  describe('polyline encoding/decoding', () => {
    it('should encode and decode positions', () => {
      const positions: Position[] = [
        { lat: 40.7128, lng: -74.0060 },
        { lat: 40.7580, lng: -73.9855 },
        { lat: 40.7300, lng: -74.0000 },
      ];

      const encoded = service.encodePolyline(positions);
      expect(encoded).toBeDefined();
      expect(typeof encoded).toBe('string');

      const decoded = service.decodePolyline(encoded);
      expect(decoded).toEqual(positions);
    });

    it('should handle empty positions', () => {
      const encoded = service.encodePolyline([]);
      const decoded = service.decodePolyline(encoded);
      expect(decoded).toEqual([]);
    });

    it('should handle invalid encoded string', () => {
      const decoded = service.decodePolyline('invalid-base64');
      expect(decoded).toEqual([]);
    });
  });

  describe('mock behavior', () => {
    it('should simulate API delay', async () => {
      const start = Date.now();
      await service.searchAddress('test');
      const duration = Date.now() - start;

      // Should have some delay (at least 50ms)
      expect(duration).toBeGreaterThanOrEqual(50);
    });

    it('should generate realistic route coordinates', async () => {
      const waypoints: Waypoint[] = [
        { id: '1', position: { lat: 40.7128, lng: -74.0060 }, order: 1 },
        { id: '2', position: { lat: 40.7580, lng: -73.9855 }, order: 2 },
      ];

      const route = await service.calculateRoute(waypoints);
      const coords = route.segments[0].coordinates;

      // Should have multiple intermediate points
      expect(coords.length).toBeGreaterThan(2);
      // First and last should match waypoints
      expect(coords[0]).toEqual(waypoints[0].position);
      expect(coords[coords.length - 1]).toEqual(waypoints[1].position);
    });
  });
});