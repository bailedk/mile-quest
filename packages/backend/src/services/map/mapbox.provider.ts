/**
 * Mapbox implementation of MapService
 */

/// <reference path="../../types/mapbox.d.ts" />

import MapboxClient from '@mapbox/mapbox-sdk';
import MapboxGeocoding from '@mapbox/mapbox-sdk/services/geocoding';
import MapboxDirections from '@mapbox/mapbox-sdk/services/directions';
import MapboxOptimization from '@mapbox/mapbox-sdk/services/optimization';
import * as polyline from '@mapbox/polyline';
import * as turf from '@turf/turf';
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

export class MapboxService implements MapService {
  private client: any;
  private geocoding: any;
  private directions: any;
  private optimization: any;
  private config: MapConfig;

  constructor(config: MapConfig) {
    if (!config.accessToken) {
      throw new MapServiceError(
        'Mapbox access token is required',
        MapErrorCode.INVALID_TOKEN
      );
    }

    this.config = {
      defaultProfile: 'walking',
      maxWaypoints: 20,
      ...config,
    };

    // Initialize Mapbox SDK
    this.client = MapboxClient({ accessToken: config.accessToken });
    this.geocoding = MapboxGeocoding(this.client);
    this.directions = MapboxDirections(this.client);
    this.optimization = MapboxOptimization(this.client);
  }

  async searchAddress(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    try {
      const request = this.geocoding.forwardGeocode({
        query,
        limit: options?.limit || 5,
        proximity: options?.proximity
          ? [options.proximity.lng, options.proximity.lat]
          : undefined,
        countries: options?.country ? [options.country] : undefined,
        types: options?.types || ['address', 'place', 'poi'],
        language: [this.config.language || 'en'],
        autocomplete: true,
      });

      const response = await request.send();

      return response.body.features.map((feature: any) => ({
        id: feature.id,
        address: feature.place_name,
        position: {
          lat: feature.center[1],
          lng: feature.center[0],
        },
        relevance: feature.relevance,
        type: feature.place_type[0],
      }));
    } catch (error) {
      throw this.handleError(error, 'Address search failed');
    }
  }

  async reverseGeocode(position: Position): Promise<string> {
    try {
      const request = this.geocoding.reverseGeocode({
        query: [position.lng, position.lat],
        limit: 1,
        language: [this.config.language || 'en'],
      });

      const response = await request.send();

      if (response.body.features.length === 0) {
        throw new MapServiceError(
          'No address found for coordinates',
          MapErrorCode.ADDRESS_NOT_FOUND
        );
      }

      return response.body.features[0].place_name;
    } catch (error) {
      throw this.handleError(error, 'Reverse geocoding failed');
    }
  }

  async calculateRoute(waypoints: Waypoint[], options?: RouteOptions): Promise<Route> {
    if (waypoints.length < 2) {
      throw new MapServiceError(
        'At least 2 waypoints are required',
        MapErrorCode.INVALID_WAYPOINTS
      );
    }

    if (waypoints.length > (this.config.maxWaypoints || 20)) {
      throw new MapServiceError(
        `Maximum ${this.config.maxWaypoints} waypoints allowed`,
        MapErrorCode.TOO_MANY_WAYPOINTS
      );
    }

    try {
      const coordinates = waypoints.map(w => [w.position.lng, w.position.lat]);

      const request = this.directions.getDirections({
        profile: options?.profile || this.config.defaultProfile || 'walking',
        waypoints: coordinates.map((coord, index) => ({
          coordinates: coord,
          approach: 'unrestricted',
        })),
        geometries: 'geojson',
        overview: 'full',
        steps: options?.steps || false,
        alternatives: options?.alternatives || false,
        continue_straight: false,
        waypoints_per_route: true,
        language: this.config.language || 'en',
      });

      const response = await request.send();

      if (!response.body.routes || response.body.routes.length === 0) {
        throw new MapServiceError(
          'No route found between waypoints',
          MapErrorCode.NO_ROUTE_FOUND
        );
      }

      return this.transformMapboxRoute(response.body.routes[0], waypoints);
    } catch (error) {
      throw this.handleError(error, 'Route calculation failed');
    }
  }

  async optimizeWaypoints(waypoints: Waypoint[]): Promise<Waypoint[]> {
    if (waypoints.length < 3) {
      return waypoints; // No optimization needed
    }

    // Separate locked and unlocked waypoints
    const lockedIndices: number[] = [];
    const unlockedWaypoints: Waypoint[] = [];
    
    waypoints.forEach((wp, index) => {
      if (wp.isLocked) {
        lockedIndices.push(index);
      } else {
        unlockedWaypoints.push(wp);
      }
    });

    if (unlockedWaypoints.length < 2) {
      return waypoints; // Not enough waypoints to optimize
    }

    try {
      const coordinates = waypoints.map(w => [w.position.lng, w.position.lat]);

      const request = this.optimization.getOptimization({
        profile: this.config.defaultProfile || 'walking',
        coordinates,
        source: lockedIndices.includes(0) ? 'first' : 'any',
        destination: lockedIndices.includes(waypoints.length - 1) ? 'last' : 'any',
        roundtrip: false,
        geometries: 'geojson',
        overview: 'simplified',
      });

      const response = await request.send();

      if (!response.body.trips || response.body.trips.length === 0) {
        throw new MapServiceError(
          'Route optimization failed',
          MapErrorCode.NO_ROUTE_FOUND
        );
      }

      // Reorder waypoints based on optimization result
      const optimizedOrder = response.body.waypoints.map((wp: any) => wp.waypoint_index);
      const optimizedWaypoints = optimizedOrder.map((index: number, newOrder: number) => ({
        ...waypoints[index],
        order: newOrder + 1,
      }));

      return optimizedWaypoints;
    } catch (error) {
      throw this.handleError(error, 'Route optimization failed');
    }
  }

  calculateDistance(from: Position, to: Position): number {
    const point1 = turf.point([from.lng, from.lat]);
    const point2 = turf.point([to.lng, to.lat]);
    return turf.distance(point1, point2, { units: 'meters' });
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

    const coordinates = positions.map(p => [p.lng, p.lat]);
    const multiPoint = turf.multiPoint(coordinates);
    const bbox = turf.bbox(multiPoint);

    return {
      southwest: { lng: bbox[0], lat: bbox[1] },
      northeast: { lng: bbox[2], lat: bbox[3] },
    };
  }

  encodePolyline(positions: Position[]): string {
    const coordinates: [number, number][] = positions.map(p => [p.lat, p.lng] as [number, number]);
    return polyline.encode(coordinates);
  }

  decodePolyline(encoded: string): Position[] {
    const coordinates = polyline.decode(encoded);
    return coordinates.map(([lat, lng]: [number, number]) => ({ lat, lng }));
  }

  private transformMapboxRoute(mapboxRoute: any, waypoints: Waypoint[]): Route {
    const segments: RouteSegment[] = [];

    // Process each leg of the route
    for (let i = 0; i < mapboxRoute.legs.length; i++) {
      const leg = mapboxRoute.legs[i];
      const coordinates = leg.geometry.coordinates.map(([lng, lat]: number[]) => ({
        lat,
        lng,
      }));

      segments.push({
        startWaypoint: waypoints[i],
        endWaypoint: waypoints[i + 1],
        distance: leg.distance,
        duration: leg.duration,
        polyline: this.encodePolyline(coordinates),
        coordinates,
      });
    }

    // Calculate bounds for the entire route
    const allCoordinates = mapboxRoute.geometry.coordinates.map(([lng, lat]: number[]) => ({
      lat,
      lng,
    }));
    const bounds = this.getBounds(allCoordinates);

    return {
      id: `route-${Date.now()}`,
      waypoints,
      segments,
      totalDistance: mapboxRoute.distance,
      totalDuration: mapboxRoute.duration,
      bounds,
      encodedPolyline: this.encodePolyline(allCoordinates),
    };
  }

  private handleError(error: any, context: string): never {
    console.error(`Map Service Error - ${context}:`, error);

    // Handle Mapbox-specific errors
    if (error.statusCode === 401) {
      throw new MapServiceError(
        'Invalid Mapbox access token',
        MapErrorCode.INVALID_TOKEN,
        error
      );
    }

    if (error.statusCode === 429) {
      throw new MapServiceError(
        'Rate limit exceeded',
        MapErrorCode.RATE_LIMIT_EXCEEDED,
        error
      );
    }

    if (error.statusCode === 503) {
      throw new MapServiceError(
        'Mapbox service temporarily unavailable',
        MapErrorCode.SERVICE_UNAVAILABLE,
        error
      );
    }

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new MapServiceError(
        'Network connection failed',
        MapErrorCode.NETWORK_ERROR,
        error
      );
    }

    if (error.code === 'ETIMEDOUT') {
      throw new MapServiceError(
        'Request timed out',
        MapErrorCode.TIMEOUT_ERROR,
        error
      );
    }

    // Re-throw if already a MapServiceError
    if (error instanceof MapServiceError) {
      throw error;
    }

    // Default error
    throw new MapServiceError(
      `${context}: ${error.message || 'Unknown error'}`,
      MapErrorCode.UNKNOWN_ERROR,
      error
    );
  }
}