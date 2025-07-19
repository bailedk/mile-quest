/**
 * Type declarations for Mapbox SDK modules
 */

declare module '@mapbox/mapbox-sdk' {
  interface MapboxClient {
    // Client instance
  }
  
  interface ClientConfig {
    accessToken: string;
  }
  
  function createClient(config: ClientConfig): MapboxClient;
  export default createClient;
}

declare module '@mapbox/mapbox-sdk/services/geocoding' {
  interface GeocodingService {
    forwardGeocode(request: ForwardGeocodeRequest): GeocodeRequest;
    reverseGeocode(request: ReverseGeocodeRequest): GeocodeRequest;
  }
  
  interface ForwardGeocodeRequest {
    query: string;
    limit?: number;
    proximity?: [number, number];
    countries?: string[];
    types?: string[];
    language?: string[];
    autocomplete?: boolean;
  }
  
  interface ReverseGeocodeRequest {
    query: [number, number];
    limit?: number;
    language?: string[];
  }
  
  interface GeocodeRequest {
    send(): Promise<GeocodeResponse>;
  }
  
  interface GeocodeResponse {
    body: {
      features: Array<{
        id: string;
        place_name: string;
        center: [number, number];
        relevance: number;
        place_type: string[];
      }>;
    };
  }
  
  function createService(client: any): GeocodingService;
  export default createService;
}

declare module '@mapbox/mapbox-sdk/services/directions' {
  interface DirectionsService {
    getDirections(request: DirectionsRequest): DirectionsRequestObject;
  }
  
  interface DirectionsRequest {
    profile: string;
    waypoints: Array<{
      coordinates: [number, number];
      approach?: string;
    }>;
    geometries?: string;
    overview?: string;
    steps?: boolean;
    alternatives?: boolean;
    continue_straight?: boolean;
    waypoints_per_route?: boolean;
    language?: string;
  }
  
  interface DirectionsRequestObject {
    send(): Promise<DirectionsResponse>;
  }
  
  interface DirectionsResponse {
    body: {
      routes: Array<{
        distance: number;
        duration: number;
        geometry: {
          coordinates: Array<[number, number]>;
        };
        legs: Array<{
          distance: number;
          duration: number;
          geometry: {
            coordinates: Array<[number, number]>;
          };
        }>;
      }>;
    };
  }
  
  function createService(client: any): DirectionsService;
  export default createService;
}

declare module '@mapbox/mapbox-sdk/services/optimization' {
  interface OptimizationService {
    getOptimization(request: OptimizationRequest): OptimizationRequestObject;
  }
  
  interface OptimizationRequest {
    profile: string;
    coordinates: Array<[number, number]>;
    source?: string;
    destination?: string;
    roundtrip?: boolean;
    geometries?: string;
    overview?: string;
  }
  
  interface OptimizationRequestObject {
    send(): Promise<OptimizationResponse>;
  }
  
  interface OptimizationResponse {
    body: {
      trips: Array<{
        distance: number;
        duration: number;
      }>;
      waypoints: Array<{
        waypoint_index: number;
      }>;
    };
  }
  
  function createService(client: any): OptimizationService;
  export default createService;
}

declare module '@mapbox/polyline' {
  export function encode(coordinates: Array<[number, number]>): string;
  export function decode(str: string): Array<[number, number]>;
}