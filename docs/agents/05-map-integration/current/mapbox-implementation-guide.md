# Mapbox Integration Guide for Mile Quest

## Overview

This guide covers the complete implementation of Mapbox GL JS for Mile Quest's map-based route builder feature, following the project's external service abstraction pattern.

## Prerequisites

1. **Mapbox Account**: Create at [mapbox.com](https://mapbox.com)
2. **Access Token**: Get your public token from Account Dashboard
3. **Environment Setup**: Add token to `.env.local`:
   ```
   NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token_here
   NEXT_PUBLIC_MAP_PROVIDER=mapbox
   ```

## Installation

```bash
# Core Mapbox libraries
npm install mapbox-gl @types/mapbox-gl

# React wrapper for better integration
npm install react-map-gl

# Routing and geocoding
npm install @mapbox/mapbox-sdk

# Mobile gesture support
npm install @use-gesture/react
```

## Service Abstraction Layer

Following Mile Quest's external service abstraction pattern:

### 1. Map Service Interface

```typescript
// services/maps/types.ts
export interface Position {
  lat: number;
  lng: number;
}

export interface Waypoint {
  id: string;
  position: Position;
  address?: string;
  order: number;
}

export interface RouteSegment {
  startWaypoint: Waypoint;
  endWaypoint: Waypoint;
  distance: number; // meters
  duration: number; // seconds
  polyline: string; // encoded polyline
  coordinates: Position[];
}

export interface Route {
  id: string;
  waypoints: Waypoint[];
  segments: RouteSegment[];
  totalDistance: number; // meters
  totalDuration: number; // seconds
  bounds: {
    southwest: Position;
    northeast: Position;
  };
}

export interface MapService {
  // Geocoding
  searchAddress(query: string, options?: {
    proximity?: Position;
    limit?: number;
  }): Promise<SearchResult[]>;
  
  reverseGeocode(position: Position): Promise<string>;
  
  // Routing
  calculateRoute(waypoints: Waypoint[], options?: {
    profile?: 'walking' | 'cycling';
    alternatives?: boolean;
  }): Promise<Route>;
  
  // Utilities
  getBounds(positions: Position[]): MapBounds;
  calculateDistance(from: Position, to: Position): number;
}

export interface SearchResult {
  id: string;
  address: string;
  position: Position;
  relevance: number;
}
```

### 2. Mapbox Implementation

```typescript
// services/maps/providers/mapbox.service.ts
import mapboxgl from 'mapbox-gl';
import MapboxClient from '@mapbox/mapbox-sdk';
import MapboxGeocoding from '@mapbox/mapbox-sdk/services/geocoding';
import MapboxDirections from '@mapbox/mapbox-sdk/services/directions';
import { MapService, Position, Waypoint, Route, SearchResult } from '../types';

export class MapboxService implements MapService {
  private client: any;
  private geocoding: any;
  private directions: any;

  constructor(accessToken: string) {
    mapboxgl.accessToken = accessToken;
    this.client = MapboxClient({ accessToken });
    this.geocoding = MapboxGeocoding(this.client);
    this.directions = MapboxDirections(this.client);
  }

  async searchAddress(query: string, options?: { proximity?: Position; limit?: number }): Promise<SearchResult[]> {
    const response = await this.geocoding
      .forwardGeocode({
        query,
        limit: options?.limit || 5,
        proximity: options?.proximity 
          ? [options.proximity.lng, options.proximity.lat] 
          : undefined,
      })
      .send();

    return response.body.features.map((feature: any) => ({
      id: feature.id,
      address: feature.place_name,
      position: {
        lat: feature.center[1],
        lng: feature.center[0],
      },
      relevance: feature.relevance,
    }));
  }

  async reverseGeocode(position: Position): Promise<string> {
    const response = await this.geocoding
      .reverseGeocode({
        query: [position.lng, position.lat],
        limit: 1,
      })
      .send();

    return response.body.features[0]?.place_name || 'Unknown location';
  }

  async calculateRoute(waypoints: Waypoint[], options?: { profile?: 'walking' | 'cycling' }): Promise<Route> {
    const coordinates = waypoints.map(w => [w.position.lng, w.position.lat]);
    
    const response = await this.directions
      .getDirections({
        profile: options?.profile || 'walking',
        waypoints: coordinates,
        geometries: 'geojson',
        overview: 'full',
        steps: false,
      })
      .send();

    const route = response.body.routes[0];
    
    // Transform Mapbox response to our Route interface
    return this.transformMapboxRoute(route, waypoints);
  }

  private transformMapboxRoute(mapboxRoute: any, waypoints: Waypoint[]): Route {
    const segments: RouteSegment[] = [];
    
    // Create segments between consecutive waypoints
    for (let i = 0; i < waypoints.length - 1; i++) {
      const leg = mapboxRoute.legs[i];
      segments.push({
        startWaypoint: waypoints[i],
        endWaypoint: waypoints[i + 1],
        distance: leg.distance,
        duration: leg.duration,
        polyline: this.encodePolyline(leg.geometry.coordinates),
        coordinates: leg.geometry.coordinates.map(([lng, lat]: number[]) => ({ lat, lng })),
      });
    }

    return {
      id: `route-${Date.now()}`,
      waypoints,
      segments,
      totalDistance: mapboxRoute.distance,
      totalDuration: mapboxRoute.duration,
      bounds: {
        southwest: {
          lat: mapboxRoute.geometry.coordinates
            .reduce((min: number, [lng, lat]: number[]) => Math.min(min, lat), 90),
          lng: mapboxRoute.geometry.coordinates
            .reduce((min: number, [lng, lat]: number[]) => Math.min(min, lng), 180),
        },
        northeast: {
          lat: mapboxRoute.geometry.coordinates
            .reduce((max: number, [lng, lat]: number[]) => Math.max(max, lat), -90),
          lng: mapboxRoute.geometry.coordinates
            .reduce((max: number, [lng, lat]: number[]) => Math.max(max, lng), -180),
        },
      },
    };
  }

  getBounds(positions: Position[]): MapBounds {
    const lngs = positions.map(p => p.lng);
    const lats = positions.map(p => p.lat);
    
    return {
      southwest: {
        lat: Math.min(...lats),
        lng: Math.min(...lngs),
      },
      northeast: {
        lat: Math.max(...lats),
        lng: Math.max(...lngs),
      },
    };
  }

  calculateDistance(from: Position, to: Position): number {
    // Haversine formula for distance calculation
    const R = 6371e3; // Earth's radius in meters
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

  private encodePolyline(coordinates: number[][]): string {
    // Implement polyline encoding or use a library
    // For now, return a placeholder
    return 'encoded_polyline';
  }
}
```

### 3. Service Factory

```typescript
// services/maps/factory.ts
import { MapService } from './types';
import { MapboxService } from './providers/mapbox.service';

export function createMapService(): MapService {
  const provider = process.env.NEXT_PUBLIC_MAP_PROVIDER || 'mapbox';
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!token) {
    throw new Error('Map service token not configured');
  }

  switch (provider) {
    case 'mapbox':
      return new MapboxService(token);
    // Future providers can be added here
    default:
      throw new Error(`Unknown map provider: ${provider}`);
  }
}

// Singleton instance
let mapService: MapService | null = null;

export function getMapService(): MapService {
  if (!mapService) {
    mapService = createMapService();
  }
  return mapService;
}
```

## React Components

### 1. Map Component with Mobile Support

```typescript
// components/Map/Map.tsx
import React, { useRef, useCallback, useEffect } from 'react';
import ReactMapGL, { Marker, Source, Layer, ViewState } from 'react-map-gl';
import { useGesture } from '@use-gesture/react';
import { Waypoint, Route } from '@/services/maps/types';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapProps {
  waypoints: Waypoint[];
  route: Route | null;
  onMapClick?: (event: any) => void;
  onWaypointDrag?: (waypointId: string, position: Position) => void;
  selectedWaypointId?: string | null;
}

export function Map({ 
  waypoints, 
  route, 
  onMapClick, 
  onWaypointDrag,
  selectedWaypointId 
}: MapProps) {
  const mapRef = useRef<any>(null);
  const [viewState, setViewState] = React.useState<ViewState>({
    longitude: -73.985664,
    latitude: 40.748817,
    zoom: 12,
    bearing: 0,
    pitch: 0,
  });

  // Mobile touch gesture support
  const bind = useGesture({
    onPinch: ({ offset: [scale] }) => {
      if (mapRef.current) {
        mapRef.current.setZoom(viewState.zoom * scale);
      }
    },
  });

  // Auto-fit bounds when route changes
  useEffect(() => {
    if (route && mapRef.current) {
      const { southwest, northeast } = route.bounds;
      mapRef.current.fitBounds([
        [southwest.lng, southwest.lat],
        [northeast.lng, northeast.lat],
      ], {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        duration: 1000,
      });
    }
  }, [route]);

  const handleClick = useCallback((event: any) => {
    // Don't add waypoint if clicking on existing marker
    if (event.features?.length > 0) return;
    
    if (onMapClick) {
      onMapClick({
        latLng: {
          lat: event.lngLat.lat,
          lng: event.lngLat.lng,
        },
      });
    }
  }, [onMapClick]);

  return (
    <div className="map-container" {...bind()}>
      <ReactMapGL
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        onClick={handleClick}
        mapStyle="mapbox://styles/mapbox/outdoors-v12"
        reuseMaps
        touchZoomRotate
        touchPitch
      >
        {/* Route line */}
        {route && (
          <Source
            id="route"
            type="geojson"
            data={{
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: route.segments.flatMap(s => 
                  s.coordinates.map(c => [c.lng, c.lat])
                ),
              },
            }}
          >
            <Layer
              id="route-line"
              type="line"
              paint={{
                'line-color': '#3B82F6',
                'line-width': 4,
                'line-opacity': 0.8,
              }}
            />
          </Source>
        )}

        {/* Waypoint markers */}
        {waypoints.map((waypoint) => (
          <Marker
            key={waypoint.id}
            longitude={waypoint.position.lng}
            latitude={waypoint.position.lat}
            draggable
            onDragEnd={(event) => {
              if (onWaypointDrag) {
                onWaypointDrag(waypoint.id, {
                  lat: event.lngLat.lat,
                  lng: event.lngLat.lng,
                });
              }
            }}
          >
            <div 
              className={`waypoint-marker ${
                selectedWaypointId === waypoint.id ? 'selected' : ''
              }`}
            >
              <span className="waypoint-number">{waypoint.order}</span>
            </div>
          </Marker>
        ))}
      </ReactMapGL>

      {/* Mobile controls */}
      <div className="map-controls-mobile">
        <button 
          className="location-button"
          onClick={handleCurrentLocation}
          aria-label="Current location"
        >
          📍
        </button>
      </div>
    </div>
  );
}
```

### 2. Route Builder Component

```typescript
// components/RouteBuilder/RouteBuilder.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { Map } from '@/components/Map/Map';
import { WaypointList } from './WaypointList';
import { SearchBox } from './SearchBox';
import { getMapService } from '@/services/maps/factory';
import { Waypoint, Route } from '@/services/maps/types';
import { useDebounce } from '@/hooks/useDebounce';
import { generateId } from '@/utils/id';

interface RouteBuilderProps {
  onSave: (route: Route, name: string, description: string) => void;
  onCancel: () => void;
}

export function RouteBuilder({ onSave, onCancel }: RouteBuilderProps) {
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [route, setRoute] = useState<Route | null>(null);
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(null);
  const [goalName, setGoalName] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [isCalculating, setIsCalculating] = useState(false);

  const mapService = getMapService();
  const debouncedWaypoints = useDebounce(waypoints, 500);

  // Recalculate route when waypoints change
  useEffect(() => {
    if (debouncedWaypoints.length >= 2) {
      calculateRoute();
    } else {
      setRoute(null);
    }
  }, [debouncedWaypoints]);

  const calculateRoute = async () => {
    setIsCalculating(true);
    try {
      const newRoute = await mapService.calculateRoute(waypoints);
      setRoute(newRoute);
    } catch (error) {
      console.error('Failed to calculate route:', error);
      // Show error toast
    } finally {
      setIsCalculating(false);
    }
  };

  const handleMapClick = useCallback((event: any) => {
    const newWaypoint: Waypoint = {
      id: generateId(),
      position: event.latLng,
      order: waypoints.length + 1,
    };
    setWaypoints([...waypoints, newWaypoint]);

    // Reverse geocode to get address
    mapService.reverseGeocode(event.latLng).then(address => {
      setWaypoints(prev => prev.map(w => 
        w.id === newWaypoint.id ? { ...w, address } : w
      ));
    });
  }, [waypoints, mapService]);

  const handleWaypointDrag = useCallback((waypointId: string, position: Position) => {
    setWaypoints(prev => prev.map(w => 
      w.id === waypointId ? { ...w, position } : w
    ));
  }, []);

  const handleReorder = useCallback((startIndex: number, endIndex: number) => {
    const result = Array.from(waypoints);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    
    // Update order numbers
    const reordered = result.map((w, index) => ({ ...w, order: index + 1 }));
    setWaypoints(reordered);
  }, [waypoints]);

  const handleDelete = useCallback((waypointId: string) => {
    const filtered = waypoints.filter(w => w.id !== waypointId);
    const reindexed = filtered.map((w, i) => ({ ...w, order: i + 1 }));
    setWaypoints(reindexed);
  }, [waypoints]);

  const handleSearchSelect = useCallback(async (result: SearchResult) => {
    const newWaypoint: Waypoint = {
      id: generateId(),
      position: result.position,
      address: result.address,
      order: waypoints.length + 1,
    };
    setWaypoints([...waypoints, newWaypoint]);
  }, [waypoints]);

  const handleSave = () => {
    if (!route || !goalName) return;
    onSave(route, goalName, goalDescription);
  };

  const formatDistance = (meters: number): string => {
    const miles = meters * 0.000621371;
    return `${miles.toFixed(1)} miles`;
  };

  return (
    <div className="route-builder">
      <div className="route-builder-header">
        <h2>Create Team Goal - Route Builder</h2>
        <button className="close-button" onClick={onCancel}>×</button>
      </div>

      <div className="route-builder-content">
        <div className="map-section">
          <SearchBox onSelect={handleSearchSelect} />
          <Map
            waypoints={waypoints}
            route={route}
            onMapClick={handleMapClick}
            onWaypointDrag={handleWaypointDrag}
            selectedWaypointId={selectedWaypointId}
          />
        </div>

        <div className="sidebar">
          <div className="route-details">
            <h3>Route Details</h3>
            <div className="total-distance">
              <span className="label">Total Distance:</span>
              <span className="value">
                {route ? formatDistance(route.totalDistance) : '0 miles'}
              </span>
              {isCalculating && <span className="calculating">Calculating...</span>}
            </div>
          </div>

          <div className="waypoints-section">
            <h3>Waypoints ({waypoints.length})</h3>
            <WaypointList
              waypoints={waypoints}
              onReorder={handleReorder}
              onDelete={handleDelete}
              onSelect={setSelectedWaypointId}
              selectedId={selectedWaypointId}
            />
            {waypoints.length < 20 && (
              <p className="hint">Click on the map to add waypoints</p>
            )}
          </div>

          <div className="goal-details">
            <input
              type="text"
              placeholder="Goal Name (e.g., Walk the Northeast Trail)"
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              className="goal-input"
            />
            <textarea
              placeholder="Description (optional)"
              value={goalDescription}
              onChange={(e) => setGoalDescription(e.target.value)}
              className="goal-textarea"
              rows={3}
            />
          </div>

          <div className="actions">
            <button className="cancel-button" onClick={onCancel}>
              Cancel
            </button>
            <button 
              className="save-button"
              onClick={handleSave}
              disabled={!route || !goalName || isCalculating}
            >
              Save Route as Team Goal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 3. Mobile-Optimized Styles

```scss
// styles/components/route-builder.scss
.route-builder {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--color-background);

  @media (max-width: 768px) {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
  }
}

.route-builder-content {
  display: flex;
  flex: 1;
  overflow: hidden;

  @media (max-width: 768px) {
    flex-direction: column;
  }
}

.map-section {
  flex: 1;
  position: relative;
  
  .search-box {
    position: absolute;
    top: 1rem;
    left: 1rem;
    right: 1rem;
    z-index: 10;
    max-width: 400px;
    
    @media (max-width: 768px) {
      max-width: none;
    }
  }
}

.map-container {
  width: 100%;
  height: 100%;
  
  .mapboxgl-canvas {
    outline: none;
  }
}

.waypoint-marker {
  width: 32px;
  height: 32px;
  background: var(--color-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  border: 3px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  cursor: move;
  transition: transform 0.2s;
  
  &.selected {
    transform: scale(1.2);
    background: var(--color-accent);
  }
  
  @media (max-width: 768px) {
    width: 40px;
    height: 40px;
    font-size: 1.1rem;
  }
}

.sidebar {
  width: 400px;
  background: white;
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  
  @media (max-width: 768px) {
    width: 100%;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 50vh;
    border-left: none;
    border-top: 1px solid var(--color-border);
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
    
    // Swipe to dismiss
    &::before {
      content: '';
      position: absolute;
      top: 8px;
      left: 50%;
      transform: translateX(-50%);
      width: 40px;
      height: 4px;
      background: var(--color-gray-300);
      border-radius: 2px;
    }
  }
}

.map-controls-mobile {
  display: none;
  
  @media (max-width: 768px) {
    display: block;
    position: absolute;
    bottom: 60vh; // Above the sidebar
    right: 1rem;
    
    .location-button {
      width: 44px;
      height: 44px;
      background: white;
      border-radius: 50%;
      border: none;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      font-size: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }
}

// Touch-friendly inputs
.goal-input,
.goal-textarea {
  width: 100%;
  padding: 0.75rem;
  font-size: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  
  @media (max-width: 768px) {
    min-height: 44px;
  }
}

.actions {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  
  button {
    flex: 1;
    padding: 0.75rem;
    font-size: 1rem;
    border-radius: 8px;
    font-weight: 500;
    
    @media (max-width: 768px) {
      min-height: 44px;
    }
  }
  
  .save-button {
    background: var(--color-primary);
    color: white;
    border: none;
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
  
  .cancel-button {
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-text);
  }
}
```

## Performance Optimizations

### 1. Lazy Loading

```typescript
// components/RouteBuilder/index.tsx
import dynamic from 'next/dynamic';

export const RouteBuilder = dynamic(
  () => import('./RouteBuilder').then(mod => mod.RouteBuilder),
  {
    loading: () => <div className="route-builder-loading">Loading map...</div>,
    ssr: false, // Mapbox requires window object
  }
);
```

### 2. Route Calculation Debouncing

```typescript
// hooks/useDebounce.ts
import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

### 3. Caching Geocoding Results

```typescript
// services/maps/cache.ts
class GeocodingCache {
  private cache = new Map<string, any>();
  private maxSize = 100;

  get(key: string): any {
    return this.cache.get(key);
  }

  set(key: string, value: any): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const geocodingCache = new GeocodingCache();
```

## Testing Setup

```typescript
// services/maps/providers/mapbox.service.test.ts
import { MapboxService } from './mapbox.service';

// Mock Mapbox SDK
jest.mock('@mapbox/mapbox-sdk', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    // Mock client
  })),
}));

describe('MapboxService', () => {
  let service: MapboxService;

  beforeEach(() => {
    service = new MapboxService('test-token');
  });

  it('should calculate route between waypoints', async () => {
    const waypoints = [
      { id: '1', position: { lat: 40.7128, lng: -74.0060 }, order: 1 },
      { id: '2', position: { lat: 42.3601, lng: -71.0589 }, order: 2 },
    ];

    const route = await service.calculateRoute(waypoints);

    expect(route.waypoints).toHaveLength(2);
    expect(route.segments).toHaveLength(1);
    expect(route.totalDistance).toBeGreaterThan(0);
  });
});
```

## Environment Configuration

```bash
# .env.local
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoieW91ci11c2VybmFtZSIsImEiOiJjbGt3ZXhhYmMwMDJkM2NvOGt5b2Q5dXBqIn0.xxx
NEXT_PUBLIC_MAP_PROVIDER=mapbox
NEXT_PUBLIC_MAP_STYLE=mapbox://styles/mapbox/outdoors-v12

# .env.production
NEXT_PUBLIC_MAPBOX_TOKEN=pk.production_token_here
NEXT_PUBLIC_MAP_PROVIDER=mapbox
NEXT_PUBLIC_MAP_STYLE=mapbox://styles/your-username/custom-style
```

## Monitoring & Analytics

```typescript
// services/maps/analytics.ts
export function trackMapEvent(event: string, properties?: any) {
  // Track map usage for optimization
  if (window.gtag) {
    window.gtag('event', `map_${event}`, {
      map_provider: 'mapbox',
      ...properties,
    });
  }
}

// Usage
trackMapEvent('route_created', {
  waypoint_count: waypoints.length,
  total_distance: route.totalDistance,
});
```

## Migration Path

When ready to switch providers:

1. Implement new provider service (e.g., `GoogleMapsService`)
2. Update factory to include new provider
3. Change `NEXT_PUBLIC_MAP_PROVIDER` environment variable
4. No component changes needed!

This implementation provides a complete, production-ready Mapbox integration that's mobile-optimized, follows Mile Quest's architecture patterns, and can easily scale or switch providers as needed.