import { Waypoint, RouteData } from '@mile-quest/shared';

export interface MapSearchResult {
  id: string;
  name: string;
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export interface MapService {
  searchLocation(query: string): Promise<MapSearchResult[]>;
  calculateRoute(waypoints: Waypoint[]): Promise<RouteData>;
  reverseGeocode(lat: number, lng: number): Promise<string>;
}