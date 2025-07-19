/**
 * Map service interface and types
 * Provider-agnostic mapping abstraction
 */

export interface Position {
  lat: number;
  lng: number;
}

export interface Waypoint {
  id: string;
  position: Position;
  address?: string;
  order: number;
  isLocked?: boolean; // Prevents reordering
}

export interface Route {
  id: string;
  waypoints: Waypoint[];
  segments: RouteSegment[];
  totalDistance: number; // meters
  totalDuration: number; // seconds
  bounds: MapBounds;
  encodedPolyline: string;
}

export interface RouteSegment {
  startWaypoint: Waypoint;
  endWaypoint: Waypoint;
  distance: number; // meters
  duration: number; // seconds
  polyline: string;
  coordinates: Position[];
}

export interface MapBounds {
  southwest: Position;
  northeast: Position;
}

export interface SearchOptions {
  limit?: number;
  proximity?: Position;
  country?: string;
  types?: string[];
}

export interface SearchResult {
  id: string;
  address: string;
  position: Position;
  relevance: number;
  type: string;
}

export interface RouteOptions {
  profile?: 'walking' | 'cycling' | 'driving';
  alternatives?: boolean;
  steps?: boolean;
  avoidHighways?: boolean;
  avoidTolls?: boolean;
}

export interface MapService {
  // Geocoding Operations
  searchAddress(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  reverseGeocode(position: Position): Promise<string>;
  
  // Route Calculation
  calculateRoute(waypoints: Waypoint[], options?: RouteOptions): Promise<Route>;
  optimizeWaypoints(waypoints: Waypoint[]): Promise<Waypoint[]>;
  
  // Distance Calculations
  calculateDistance(from: Position, to: Position): number;
  calculateRouteDistance(positions: Position[]): number;
  
  // Utilities
  getBounds(positions: Position[]): MapBounds;
  encodePolyline(positions: Position[]): string;
  decodePolyline(encoded: string): Position[];
}

export interface MapConfig {
  accessToken?: string;
  defaultProfile?: 'walking' | 'cycling' | 'driving';
  language?: string;
  country?: string;
  maxWaypoints?: number;
}

export class MapServiceError extends Error {
  constructor(
    message: string,
    public code: MapErrorCode,
    public originalError?: any
  ) {
    super(message);
    this.name = 'MapServiceError';
  }
}

export enum MapErrorCode {
  // Service errors
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  
  // Request errors
  INVALID_COORDINATES = 'INVALID_COORDINATES',
  INVALID_WAYPOINTS = 'INVALID_WAYPOINTS',
  TOO_MANY_WAYPOINTS = 'TOO_MANY_WAYPOINTS',
  NO_ROUTE_FOUND = 'NO_ROUTE_FOUND',
  
  // Geocoding errors
  ADDRESS_NOT_FOUND = 'ADDRESS_NOT_FOUND',
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  
  // Other errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
}