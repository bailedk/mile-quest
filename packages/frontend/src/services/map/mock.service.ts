import { Waypoint, RouteData, RouteSegment } from '@mile-quest/shared';
import { MapService, MapSearchResult } from './mapService.interface';

// Mock locations for testing - including long distance options
const mockLocations: MapSearchResult[] = [
  {
    id: 'mock-1',
    name: 'Times Square',
    address: 'Times Square, New York, NY 10036, USA',
    coordinates: { lat: 40.7580, lng: -73.9855 },
  },
  {
    id: 'mock-2',
    name: 'Central Park',
    address: 'Central Park, New York, NY, USA',
    coordinates: { lat: 40.7829, lng: -73.9654 },
  },
  {
    id: 'mock-3',
    name: 'Statue of Liberty',
    address: 'Statue of Liberty, New York, NY 10004, USA',
    coordinates: { lat: 40.6892, lng: -74.0445 },
  },
  {
    id: 'mock-4',
    name: 'Golden Gate Bridge',
    address: 'Golden Gate Bridge, San Francisco, CA, USA',
    coordinates: { lat: 37.8199, lng: -122.4783 },
  },
  {
    id: 'mock-5',
    name: 'Yosemite National Park',
    address: 'Yosemite National Park, California, USA',
    coordinates: { lat: 37.8651, lng: -119.5383 },
  },
  {
    id: 'mock-6',
    name: 'Chicago',
    address: 'Chicago, IL, USA',
    coordinates: { lat: 41.8781, lng: -87.6298 },
  },
  {
    id: 'mock-7',
    name: 'Mumbai',
    address: 'Mumbai, Maharashtra, India',
    coordinates: { lat: 19.0760, lng: 72.8777 },
  },
  {
    id: 'mock-8',
    name: 'New Delhi',
    address: 'New Delhi, India',
    coordinates: { lat: 28.6139, lng: 77.2090 },
  },
];

class MockMapService implements MapService {
  async searchLocation(query: string): Promise<MapSearchResult[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Simple search simulation
    const lowerQuery = query.toLowerCase();
    return mockLocations.filter(location => 
      location.name.toLowerCase().includes(lowerQuery) ||
      location.address.toLowerCase().includes(lowerQuery)
    );
  }

  async calculateRoute(waypoints: Waypoint[]): Promise<RouteData> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    if (waypoints.length < 2) {
      throw new Error('At least 2 waypoints are required');
    }

    // Create mock segments with proper great circle distance calculation
    const segments: RouteSegment[] = [];
    let totalDistance = 0;
    
    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i].coordinates;
      const to = waypoints[i + 1].coordinates;
      
      // Use Haversine formula for accurate distance calculation
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
        distance: Math.max(1, distance), // Minimum 1 mile
        duration,
      });
      
      totalDistance += distance;
    }

    return {
      waypoints,
      segments,
      totalDistance,
      totalDuration: segments.reduce((sum, seg) => sum + (seg.duration || 0), 0),
    };
  }

  async reverseGeocode(lat: number, lng: number): Promise<string> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Find closest mock location
    let closest = mockLocations[0];
    let minDistance = Infinity;
    
    for (const location of mockLocations) {
      const distance = Math.sqrt(
        Math.pow(location.coordinates.lat - lat, 2) +
        Math.pow(location.coordinates.lng - lng, 2)
      );
      if (distance < minDistance) {
        minDistance = distance;
        closest = location;
      }
    }
    
    // If very close to a known location, return it
    if (minDistance < 0.01) {
      return closest.address;
    }
    
    // Otherwise return generic location
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

export const mockMapService = new MockMapService();