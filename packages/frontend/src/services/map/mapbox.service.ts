import { Waypoint, RouteData, RouteSegment } from '@mile-quest/shared';
import { MapService, MapSearchResult } from './mapService.interface';

/**
 * Mapbox service implementation
 * - Uses Mapbox Geocoding API for location search (requires API key)
 * - Uses local Haversine formula for distance calculations (no API calls)
 * - Provides straight-line distances between waypoints
 */
class MapboxService implements MapService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
    if (!this.apiKey) {
      console.warn('Mapbox API key not found. Location search will be unavailable.');
    }
  }

  async searchLocation(query: string): Promise<MapSearchResult[]> {
    if (!this.apiKey) {
      throw new Error('Mapbox API key is not configured');
    }

    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${this.apiKey}&limit=5`
    );

    if (!response.ok) {
      throw new Error('Failed to search location');
    }

    const data = await response.json();
    
    return data.features.map((feature: any) => ({
      id: feature.id,
      name: feature.text,
      address: feature.place_name,
      coordinates: {
        lat: feature.center[1],
        lng: feature.center[0],
      },
    }));
  }

  async calculateRoute(waypoints: Waypoint[]): Promise<RouteData> {
    if (waypoints.length < 2) {
      throw new Error('At least 2 waypoints are required');
    }

    // Always use local calculation with Haversine formula
    return this.calculateGreatCircleRoute(waypoints);
  }

  // Calculate distance using Haversine formula for great circle distance
  private calculateGreatCircleRoute(waypoints: Waypoint[]): RouteData {
    const segments: RouteSegment[] = [];
    let totalDistance = 0;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i].coordinates;
      const to = waypoints[i + 1].coordinates;
      
      // Haversine formula
      const R = 3959; // Earth's radius in miles
      const dLat = this.toRad(to.lat - from.lat);
      const dLon = this.toRad(to.lng - from.lng);
      const lat1 = this.toRad(from.lat);
      const lat2 = this.toRad(to.lat);

      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;

      const walkingSpeed = 3; // mph
      const duration = (distance / walkingSpeed) * 3600; // Convert to seconds

      segments.push({
        from: i,
        to: i + 1,
        distance,
        duration,
      });

      totalDistance += distance;
    }

    const totalDuration = segments.reduce((sum, seg) => sum + (seg.duration || 0), 0);

    return {
      waypoints,
      segments,
      totalDistance,
      totalDuration,
      // No geometry for great circle calculation
    };
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  async reverseGeocode(lat: number, lng: number): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Mapbox API key is not configured');
    }

    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${this.apiKey}&limit=1`
    );

    if (!response.ok) {
      throw new Error('Failed to reverse geocode');
    }

    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      return data.features[0].place_name;
    }
    
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
}

export const mapboxService = new MapboxService();