/**
 * Mock implementation of MapService for testing
 */

import {
  MapService,
  MapConfig,
  MapServiceError,
  MapErrorCode,
  Position,
  Waypoint,
  Route,
  RouteSegment,
  MapBounds,
  SearchOptions,
  SearchResult,
  RouteOptions,
} from './types';

export class MockMapService implements MapService {
  private mockDelay = 100; // Simulate API latency
  
  constructor(config?: MapConfig) {
    // Mock service doesn't need configuration
  }

  async searchAddress(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    await this.simulateDelay();
    
    // Mock search results
    const mockResults: SearchResult[] = [
      {
        id: 'mock-1',
        address: `123 ${query} Street, New York, NY 10001`,
        position: { lat: 40.7128, lng: -74.0060 },
        relevance: 0.95,
        type: 'address',
      },
      {
        id: 'mock-2',
        address: `456 ${query} Avenue, Brooklyn, NY 11201`,
        position: { lat: 40.6782, lng: -73.9442 },
        relevance: 0.85,
        type: 'address',
      },
      {
        id: 'mock-3',
        address: `${query} Park, Manhattan, NY`,
        position: { lat: 40.7829, lng: -73.9654 },
        relevance: 0.75,
        type: 'poi',
      },
    ];

    const limit = options?.limit || 5;
    return mockResults.slice(0, limit);
  }

  async reverseGeocode(position: Position): Promise<string> {
    await this.simulateDelay();
    
    // Generate a mock address based on coordinates
    const lat = position.lat.toFixed(4);
    const lng = position.lng.toFixed(4);
    
    if (Math.abs(position.lat - 40.7128) < 0.1 && Math.abs(position.lng + 74.0060) < 0.1) {
      return '123 Main Street, New York, NY 10001';
    }
    
    return `Near ${lat}°N, ${lng}°W`;
  }

  async calculateRoute(waypoints: Waypoint[], options?: RouteOptions): Promise<Route> {
    await this.simulateDelay();
    
    if (waypoints.length < 2) {
      throw new MapServiceError(
        'At least 2 waypoints are required',
        MapErrorCode.INVALID_WAYPOINTS
      );
    }

    // Generate mock route segments
    const segments: RouteSegment[] = [];
    let totalDistance = 0;
    let totalDuration = 0;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const start = waypoints[i];
      const end = waypoints[i + 1];
      
      // Calculate straight-line distance
      const distance = this.calculateDistance(start.position, end.position);
      const duration = this.estimateDuration(distance, options?.profile || 'walking');
      
      // Generate intermediate points for a realistic route
      const coordinates = this.generateRouteCoordinates(start.position, end.position, 10);
      
      segments.push({
        startWaypoint: start,
        endWaypoint: end,
        distance,
        duration,
        polyline: this.encodePolyline(coordinates),
        coordinates,
      });
      
      totalDistance += distance;
      totalDuration += duration;
    }

    // Calculate bounds
    const allPositions = waypoints.map(w => w.position);
    const bounds = this.getBounds(allPositions);

    return {
      id: `mock-route-${Date.now()}`,
      waypoints,
      segments,
      totalDistance,
      totalDuration,
      bounds,
      encodedPolyline: this.encodePolyline(allPositions),
    };
  }

  async optimizeWaypoints(waypoints: Waypoint[]): Promise<Waypoint[]> {
    await this.simulateDelay();
    
    if (waypoints.length < 3) {
      return waypoints;
    }

    // Simple mock optimization: reverse middle waypoints
    const optimized = [...waypoints];
    const middleSection = optimized.slice(1, -1);
    middleSection.reverse();
    
    return [
      optimized[0],
      ...middleSection,
      optimized[optimized.length - 1],
    ].map((wp, index) => ({
      ...wp,
      order: index + 1,
    }));
  }

  calculateDistance(from: Position, to: Position): number {
    // Haversine formula for distance calculation
    const R = 6371000; // Earth's radius in meters
    const φ1 = from.lat * Math.PI / 180;
    const φ2 = to.lat * Math.PI / 180;
    const Δφ = (to.lat - from.lat) * Math.PI / 180;
    const Δλ = (to.lng - from.lng) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  calculateRouteDistance(positions: Position[]): number {
    if (positions.length < 2) {
      return 0;
    }

    let totalDistance = 0;
    for (let i = 0; i < positions.length - 1; i++) {
      totalDistance += this.calculateDistance(positions[i], positions[i + 1]);
    }

    return totalDistance;
  }

  getBounds(positions: Position[]): MapBounds {
    if (positions.length === 0) {
      throw new MapServiceError(
        'No positions provided for bounds calculation',
        MapErrorCode.INVALID_COORDINATES
      );
    }

    let minLat = positions[0].lat;
    let maxLat = positions[0].lat;
    let minLng = positions[0].lng;
    let maxLng = positions[0].lng;

    for (const pos of positions) {
      minLat = Math.min(minLat, pos.lat);
      maxLat = Math.max(maxLat, pos.lat);
      minLng = Math.min(minLng, pos.lng);
      maxLng = Math.max(maxLng, pos.lng);
    }

    return {
      southwest: { lat: minLat, lng: minLng },
      northeast: { lat: maxLat, lng: maxLng },
    };
  }

  encodePolyline(positions: Position[]): string {
    // Simple mock encoding - just stringify the positions
    return Buffer.from(JSON.stringify(positions)).toString('base64');
  }

  decodePolyline(encoded: string): Position[] {
    // Simple mock decoding
    try {
      return JSON.parse(Buffer.from(encoded, 'base64').toString());
    } catch {
      return [];
    }
  }

  private async simulateDelay(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.mockDelay));
  }

  private estimateDuration(distance: number, profile: string): number {
    // Estimate duration based on average speeds
    const speeds: Record<string, number> = {
      walking: 5000 / 3600,  // 5 km/h in m/s
      cycling: 15000 / 3600, // 15 km/h in m/s
      driving: 50000 / 3600, // 50 km/h in m/s
    };

    const speed = speeds[profile] || speeds.walking;
    return Math.round(distance / speed);
  }

  private generateRouteCoordinates(start: Position, end: Position, points: number): Position[] {
    const coordinates: Position[] = [start];
    
    // Generate intermediate points along a slightly curved path
    for (let i = 1; i < points - 1; i++) {
      const t = i / (points - 1);
      const curve = Math.sin(t * Math.PI) * 0.001; // Small curve factor
      
      coordinates.push({
        lat: start.lat + (end.lat - start.lat) * t + curve,
        lng: start.lng + (end.lng - start.lng) * t + curve,
      });
    }
    
    coordinates.push(end);
    return coordinates;
  }
}