# Map Integration Implementation Guide

**Version**: 2.0  
**Date**: 2025-01-19  
**Agent**: 05-map-integration  
**Status**: Ready for Implementation

## Overview

This guide provides comprehensive implementation instructions for integrating mapping functionality into Mile Quest, including route building, distance calculation, waypoint management, and map visualization. The implementation follows Mile Quest's external service abstraction pattern to ensure vendor flexibility.

## Architecture Overview

### Service Abstraction Layer

```
┌─────────────────────────────────────────────────┐
│             React Components                     │
│  (RouteBuilder, Map, WaypointList, SearchBox)  │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│            Map Service Interface                 │
│     (Vendor-agnostic business interface)        │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│            Map Service Factory                   │
│    (Environment-based provider selection)        │
└─────────┬───────────────────────┬───────────────┘
          │                       │
┌─────────▼──────────┐  ┌────────▼────────────┐
│  Mapbox Provider   │  │  Mock Provider      │
│  Implementation    │  │  (For Testing)      │
└────────────────────┘  └─────────────────────┘
```

### Data Flow

1. **User Interaction** → React Component
2. **Component** → Map Service Interface
3. **Service Factory** → Selected Provider
4. **Provider** → External API (Mapbox)
5. **Response** → Normalized to Interface
6. **Component** → UI Update

## Core Components

### 1. Map Service Interface

The service interface defines all mapping operations in vendor-agnostic terms:

```typescript
// services/maps/types.ts
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
```

### 2. Data Types

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
  distance: number;
  duration: number;
  polyline: string;
  coordinates: Position[];
}
```

## Implementation Steps

### Step 1: Set Up Service Structure

```bash
# Create directory structure
mkdir -p services/maps/{providers,__tests__}
touch services/maps/{types.ts,factory.ts,index.ts}
touch services/maps/providers/{mapbox.service.ts,mock.service.ts}
```

### Step 2: Install Dependencies

```bash
# Core dependencies
npm install mapbox-gl @types/mapbox-gl react-map-gl
npm install @mapbox/mapbox-sdk

# Mobile optimization
npm install @use-gesture/react

# Utilities
npm install polyline geolib
```

### Step 3: Implement Mapbox Provider

```typescript
// services/maps/providers/mapbox.service.ts
import mapboxgl from 'mapbox-gl';
import MapboxClient from '@mapbox/mapbox-sdk';
import MapboxGeocoding from '@mapbox/mapbox-sdk/services/geocoding';
import MapboxDirections from '@mapbox/mapbox-sdk/services/directions';
import { encode, decode } from 'polyline';
import { MapService, Position, Waypoint, Route } from '../types';

export class MapboxService implements MapService {
  private client: any;
  private geocoding: any;
  private directions: any;
  
  constructor(accessToken: string) {
    // Initialize Mapbox
    mapboxgl.accessToken = accessToken;
    this.client = MapboxClient({ accessToken });
    this.geocoding = MapboxGeocoding(this.client);
    this.directions = MapboxDirections(this.client);
  }
  
  async searchAddress(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    try {
      const response = await this.geocoding
        .forwardGeocode({
          query,
          limit: options?.limit || 5,
          proximity: options?.proximity 
            ? [options.proximity.lng, options.proximity.lat] 
            : undefined,
          types: ['address', 'place', 'poi'],
          autocomplete: true,
        })
        .send();
      
      return response.body.features.map(this.mapFeatureToSearchResult);
    } catch (error) {
      throw new MapServiceError('Address search failed', error);
    }
  }
  
  async calculateRoute(waypoints: Waypoint[], options?: RouteOptions): Promise<Route> {
    if (waypoints.length < 2) {
      throw new MapServiceError('At least 2 waypoints required');
    }
    
    const coordinates = waypoints.map(w => [w.position.lng, w.position.lat]);
    
    try {
      const response = await this.directions
        .getDirections({
          profile: options?.profile || 'walking',
          waypoints: coordinates,
          geometries: 'geojson',
          overview: 'full',
          steps: false,
          alternatives: false,
        })
        .send();
      
      return this.transformMapboxRoute(response.body.routes[0], waypoints);
    } catch (error) {
      throw new MapServiceError('Route calculation failed', error);
    }
  }
  
  private transformMapboxRoute(mapboxRoute: any, waypoints: Waypoint[]): Route {
    const segments: RouteSegment[] = [];
    
    // Process each leg of the route
    for (let i = 0; i < mapboxRoute.legs.length; i++) {
      const leg = mapboxRoute.legs[i];
      segments.push({
        startWaypoint: waypoints[i],
        endWaypoint: waypoints[i + 1],
        distance: leg.distance,
        duration: leg.duration,
        polyline: encode(leg.geometry.coordinates),
        coordinates: leg.geometry.coordinates.map(([lng, lat]: number[]) => ({ 
          lat, 
          lng 
        })),
      });
    }
    
    // Calculate bounds
    const allCoordinates = mapboxRoute.geometry.coordinates;
    const bounds = this.calculateBounds(allCoordinates);
    
    return {
      id: `route-${Date.now()}`,
      waypoints,
      segments,
      totalDistance: mapboxRoute.distance,
      totalDuration: mapboxRoute.duration,
      bounds,
      encodedPolyline: encode(allCoordinates),
    };
  }
}
```

### Step 4: Implement React Components

#### Map Component

```typescript
// components/Map/Map.tsx
import React, { useRef, useCallback, useEffect, useState } from 'react';
import ReactMapGL, { Marker, Source, Layer, ViewState } from 'react-map-gl';
import { useGesture } from '@use-gesture/react';
import { Waypoint, Route, Position } from '@/services/maps/types';
import { MapControls } from './MapControls';
import { WaypointMarker } from './WaypointMarker';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapProps {
  waypoints: Waypoint[];
  route: Route | null;
  onMapClick?: (position: Position) => void;
  onWaypointDrag?: (waypointId: string, position: Position) => void;
  onWaypointClick?: (waypointId: string) => void;
  selectedWaypointId?: string | null;
  isLoading?: boolean;
}

export function Map({ 
  waypoints, 
  route, 
  onMapClick, 
  onWaypointDrag,
  onWaypointClick,
  selectedWaypointId,
  isLoading 
}: MapProps) {
  const mapRef = useRef<any>(null);
  const [viewState, setViewState] = useState<ViewState>({
    longitude: -73.985664,
    latitude: 40.748817,
    zoom: 12,
    bearing: 0,
    pitch: 0,
  });
  
  // Auto-fit bounds when route changes
  useEffect(() => {
    if (route && mapRef.current) {
      const { southwest, northeast } = route.bounds;
      mapRef.current.fitBounds([
        [southwest.lng, southwest.lat],
        [northeast.lng, northeast.lat],
      ], {
        padding: { top: 80, bottom: 80, left: 80, right: 80 },
        duration: 1000,
      });
    }
  }, [route]);
  
  // Handle map clicks
  const handleClick = useCallback((event: any) => {
    // Don't add waypoint if clicking on existing features
    const features = event.features || [];
    const clickedOnMarker = features.some((f: any) => 
      f.layer?.id?.includes('waypoint')
    );
    
    if (!clickedOnMarker && onMapClick) {
      onMapClick({
        lat: event.lngLat.lat,
        lng: event.lngLat.lng,
      });
    }
  }, [onMapClick]);
  
  // Mobile gesture support
  const bind = useGesture({
    onPinch: ({ offset: [scale] }) => {
      if (mapRef.current) {
        const currentZoom = mapRef.current.getZoom();
        mapRef.current.setZoom(currentZoom * scale);
      }
    },
  });
  
  return (
    <div className="map-container" {...bind()}>
      <ReactMapGL
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        onClick={handleClick}
        mapStyle={process.env.NEXT_PUBLIC_MAP_STYLE || "mapbox://styles/mapbox/outdoors-v12"}
        reuseMaps
        touchZoomRotate
        touchPitch
        attributionControl={false}
      >
        {/* Route visualization */}
        {route && (
          <>
            {/* Route line shadow for better visibility */}
            <Source
              id="route-shadow"
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
                id="route-line-shadow"
                type="line"
                paint={{
                  'line-color': '#000000',
                  'line-width': 6,
                  'line-opacity': 0.2,
                  'line-blur': 3,
                }}
              />
            </Source>
            
            {/* Main route line */}
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
                  'line-opacity': 0.9,
                }}
              />
            </Source>
          </>
        )}
        
        {/* Waypoint markers */}
        {waypoints.map((waypoint) => (
          <WaypointMarker
            key={waypoint.id}
            waypoint={waypoint}
            isSelected={selectedWaypointId === waypoint.id}
            onDrag={onWaypointDrag}
            onClick={onWaypointClick}
          />
        ))}
      </ReactMapGL>
      
      {/* Map controls */}
      <MapControls 
        mapRef={mapRef}
        onLocationFound={(position) => {
          setViewState(prev => ({
            ...prev,
            longitude: position.lng,
            latitude: position.lat,
            zoom: 15,
          }));
        }}
      />
      
      {/* Loading overlay */}
      {isLoading && (
        <div className="map-loading-overlay">
          <div className="loading-spinner" />
          <span>Calculating route...</span>
        </div>
      )}
    </div>
  );
}
```

#### Route Builder Component

```typescript
// components/RouteBuilder/RouteBuilder.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { Map } from '@/components/Map/Map';
import { WaypointList } from './WaypointList';
import { SearchBox } from './SearchBox';
import { RouteDetails } from './RouteDetails';
import { getMapService } from '@/services/maps';
import { Waypoint, Route, Position } from '@/services/maps/types';
import { useDebounce } from '@/hooks/useDebounce';
import { generateId } from '@/utils/id';
import { toast } from '@/components/Toast';

interface RouteBuilderProps {
  onSave: (route: Route, name: string, description: string) => Promise<void>;
  onCancel: () => void;
  initialRoute?: Route;
}

export function RouteBuilder({ onSave, onCancel, initialRoute }: RouteBuilderProps) {
  const [waypoints, setWaypoints] = useState<Waypoint[]>(
    initialRoute?.waypoints || []
  );
  const [route, setRoute] = useState<Route | null>(initialRoute || null);
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(null);
  const [goalName, setGoalName] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
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
      toast.error('Failed to calculate route. Please try again.');
    } finally {
      setIsCalculating(false);
    }
  };
  
  const handleMapClick = useCallback(async (position: Position) => {
    const newWaypoint: Waypoint = {
      id: generateId(),
      position,
      order: waypoints.length + 1,
    };
    
    setWaypoints([...waypoints, newWaypoint]);
    
    // Reverse geocode in background
    try {
      const address = await mapService.reverseGeocode(position);
      setWaypoints(prev => prev.map(w => 
        w.id === newWaypoint.id ? { ...w, address } : w
      ));
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
    }
  }, [waypoints, mapService]);
  
  const handleWaypointDrag = useCallback(async (waypointId: string, position: Position) => {
    setWaypoints(prev => prev.map(w => 
      w.id === waypointId ? { ...w, position } : w
    ));
    
    // Update address in background
    try {
      const address = await mapService.reverseGeocode(position);
      setWaypoints(prev => prev.map(w => 
        w.id === waypointId ? { ...w, address } : w
      ));
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
    }
  }, [mapService]);
  
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
    
    if (selectedWaypointId === waypointId) {
      setSelectedWaypointId(null);
    }
  }, [waypoints, selectedWaypointId]);
  
  const handleSearchSelect = useCallback(async (result: SearchResult) => {
    const newWaypoint: Waypoint = {
      id: generateId(),
      position: result.position,
      address: result.address,
      order: waypoints.length + 1,
    };
    setWaypoints([...waypoints, newWaypoint]);
  }, [waypoints]);
  
  const handleOptimizeRoute = useCallback(async () => {
    if (waypoints.length < 3) {
      toast.info('Need at least 3 waypoints to optimize');
      return;
    }
    
    setIsCalculating(true);
    try {
      const optimized = await mapService.optimizeWaypoints(waypoints);
      setWaypoints(optimized);
      toast.success('Route optimized!');
    } catch (error) {
      console.error('Route optimization failed:', error);
      toast.error('Failed to optimize route');
    } finally {
      setIsCalculating(false);
    }
  }, [waypoints, mapService]);
  
  const handleSave = async () => {
    if (!route || !goalName.trim()) {
      toast.error('Please add a route name');
      return;
    }
    
    if (waypoints.length < 2) {
      toast.error('Please add at least 2 waypoints');
      return;
    }
    
    setIsSaving(true);
    try {
      await onSave(route, goalName.trim(), goalDescription.trim());
      toast.success('Route saved successfully!');
    } catch (error) {
      console.error('Failed to save route:', error);
      toast.error('Failed to save route. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  const canSave = route && goalName.trim() && !isCalculating && !isSaving;
  
  return (
    <div className="route-builder">
      <div className="route-builder-header">
        <h2>Create Team Goal - Route Builder</h2>
        <button 
          className="close-button" 
          onClick={onCancel}
          disabled={isSaving}
        >
          ×
        </button>
      </div>
      
      <div className="route-builder-content">
        <div className="map-section">
          <SearchBox 
            onSelect={handleSearchSelect}
            placeholder="Search for a location..."
          />
          <Map
            waypoints={waypoints}
            route={route}
            onMapClick={handleMapClick}
            onWaypointDrag={handleWaypointDrag}
            onWaypointClick={setSelectedWaypointId}
            selectedWaypointId={selectedWaypointId}
            isLoading={isCalculating}
          />
        </div>
        
        <div className="sidebar">
          <RouteDetails
            route={route}
            isCalculating={isCalculating}
          />
          
          <div className="waypoints-section">
            <div className="section-header">
              <h3>Waypoints ({waypoints.length})</h3>
              {waypoints.length >= 3 && (
                <button
                  className="optimize-button"
                  onClick={handleOptimizeRoute}
                  disabled={isCalculating}
                >
                  Optimize Order
                </button>
              )}
            </div>
            
            <WaypointList
              waypoints={waypoints}
              onReorder={handleReorder}
              onDelete={handleDelete}
              onSelect={setSelectedWaypointId}
              selectedId={selectedWaypointId}
            />
            
            {waypoints.length === 0 && (
              <p className="hint">Click on the map to add waypoints</p>
            )}
            {waypoints.length === 1 && (
              <p className="hint">Add at least one more waypoint to create a route</p>
            )}
            {waypoints.length >= 20 && (
              <p className="hint warning">Maximum 20 waypoints allowed</p>
            )}
          </div>
          
          <div className="goal-details">
            <input
              type="text"
              placeholder="Goal Name (e.g., Walk the Northeast Trail)"
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              className="goal-input"
              maxLength={100}
              disabled={isSaving}
            />
            <textarea
              placeholder="Description (optional)"
              value={goalDescription}
              onChange={(e) => setGoalDescription(e.target.value)}
              className="goal-textarea"
              rows={3}
              maxLength={500}
              disabled={isSaving}
            />
          </div>
          
          <div className="actions">
            <button 
              className="cancel-button" 
              onClick={onCancel}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button 
              className="save-button"
              onClick={handleSave}
              disabled={!canSave}
            >
              {isSaving ? 'Saving...' : 'Save Route as Team Goal'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Step 5: Mobile Optimization

#### Touch Gestures and Responsive Design

```scss
// styles/components/map.scss
.map-container {
  width: 100%;
  height: 100%;
  position: relative;
  
  // Prevent default touch behaviors
  touch-action: none;
  
  .mapboxgl-canvas {
    outline: none;
  }
  
  // Disable rotation on mobile by default
  @media (max-width: 768px) {
    .mapboxgl-ctrl-compass {
      display: none;
    }
  }
}

.waypoint-marker {
  width: 36px;
  height: 36px;
  background: var(--color-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  border: 3px solid white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  cursor: move;
  transition: all 0.2s ease;
  user-select: none;
  
  &.selected {
    transform: scale(1.15);
    background: var(--color-accent);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  
  &:hover {
    transform: scale(1.1);
  }
  
  // Larger touch targets on mobile
  @media (max-width: 768px) {
    width: 44px;
    height: 44px;
    font-size: 1.1rem;
  }
  
  .waypoint-number {
    font-size: 14px;
    
    @media (max-width: 768px) {
      font-size: 16px;
    }
  }
}

// Mobile-optimized route builder
.route-builder {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--color-background);
  
  @media (max-width: 768px) {
    position: fixed;
    inset: 0;
    z-index: 1000;
  }
}

.route-builder-content {
  display: grid;
  grid-template-columns: 1fr 400px;
  flex: 1;
  overflow: hidden;
  
  @media (max-width: 1024px) {
    grid-template-columns: 1fr 350px;
  }
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr auto;
  }
}

.map-section {
  position: relative;
  min-height: 400px;
  
  @media (max-width: 768px) {
    min-height: 50vh;
  }
}

.sidebar {
  background: white;
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  
  @media (max-width: 768px) {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 50vh;
    max-height: 70vh;
    border-left: none;
    border-top: 1px solid var(--color-border);
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -2px 20px rgba(0, 0, 0, 0.1);
    
    // Drag handle
    &::before {
      content: '';
      position: absolute;
      top: 8px;
      left: 50%;
      transform: translateX(-50%);
      width: 36px;
      height: 4px;
      background: var(--color-gray-300);
      border-radius: 2px;
    }
  }
}
```

### Step 6: Performance Optimizations

#### Lazy Loading and Code Splitting

```typescript
// components/RouteBuilder/index.ts
import dynamic from 'next/dynamic';
import { RouteBuilderSkeleton } from './RouteBuilderSkeleton';

export const RouteBuilder = dynamic(
  () => import('./RouteBuilder').then(mod => mod.RouteBuilder),
  {
    loading: () => <RouteBuilderSkeleton />,
    ssr: false, // Mapbox requires window object
  }
);

// RouteBuilderSkeleton.tsx
export function RouteBuilderSkeleton() {
  return (
    <div className="route-builder-skeleton">
      <div className="header-skeleton" />
      <div className="content-skeleton">
        <div className="map-skeleton" />
        <div className="sidebar-skeleton" />
      </div>
    </div>
  );
}
```

#### Caching Strategy

```typescript
// services/maps/cache.ts
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class MapCache {
  private cache = new Map<string, CacheEntry<any>>();
  
  set<T>(key: string, data: T, ttl: number = 300000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
    
    // Cleanup old entries
    this.cleanup();
  }
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

export const mapCache = new MapCache();

// Usage in service
async searchAddress(query: string, options?: SearchOptions): Promise<SearchResult[]> {
  const cacheKey = `search:${query}:${JSON.stringify(options)}`;
  const cached = mapCache.get<SearchResult[]>(cacheKey);
  
  if (cached) return cached;
  
  const results = await this.performSearch(query, options);
  mapCache.set(cacheKey, results);
  
  return results;
}
```

### Step 7: Testing Implementation

```typescript
// services/maps/__tests__/mapbox.service.test.ts
import { MapboxService } from '../providers/mapbox.service';
import { Waypoint } from '../types';

// Mock Mapbox SDK
jest.mock('@mapbox/mapbox-sdk');

describe('MapboxService', () => {
  let service: MapboxService;
  
  beforeEach(() => {
    service = new MapboxService('test-token');
  });
  
  describe('calculateRoute', () => {
    it('should calculate route between waypoints', async () => {
      const waypoints: Waypoint[] = [
        { id: '1', position: { lat: 40.7128, lng: -74.0060 }, order: 1 },
        { id: '2', position: { lat: 40.7580, lng: -73.9855 }, order: 2 },
      ];
      
      const route = await service.calculateRoute(waypoints);
      
      expect(route).toMatchObject({
        waypoints: expect.arrayContaining(waypoints),
        segments: expect.arrayContaining([
          expect.objectContaining({
            startWaypoint: waypoints[0],
            endWaypoint: waypoints[1],
            distance: expect.any(Number),
          }),
        ]),
        totalDistance: expect.any(Number),
      });
    });
    
    it('should throw error with less than 2 waypoints', async () => {
      const waypoints: Waypoint[] = [
        { id: '1', position: { lat: 40.7128, lng: -74.0060 }, order: 1 },
      ];
      
      await expect(service.calculateRoute(waypoints))
        .rejects.toThrow('At least 2 waypoints required');
    });
  });
  
  describe('geocoding', () => {
    it('should search addresses', async () => {
      const results = await service.searchAddress('Times Square');
      
      expect(results).toHaveLength(5);
      expect(results[0]).toMatchObject({
        address: expect.stringContaining('Times Square'),
        position: expect.objectContaining({
          lat: expect.any(Number),
          lng: expect.any(Number),
        }),
      });
    });
    
    it('should reverse geocode position', async () => {
      const address = await service.reverseGeocode({
        lat: 40.7128,
        lng: -74.0060,
      });
      
      expect(address).toContain('New York');
    });
  });
});
```

## API Integration

### Team Goal Creation with Route

```typescript
// api/teams/create-with-route.ts
export async function createTeamWithRoute(
  route: Route,
  name: string,
  description: string
): Promise<Team> {
  const response = await fetch('/api/v1/teams', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify({
      name,
      description,
      goalDistance: route.totalDistance,
      startDate: new Date().toISOString(),
      endDate: calculateEndDate(route.totalDistance),
      routeData: {
        waypoints: route.waypoints,
        encodedPolyline: route.encodedPolyline,
        bounds: route.bounds,
      },
    }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to create team');
  }
  
  return response.json();
}
```

## Environment Configuration

```bash
# .env.local
NEXT_PUBLIC_MAP_PROVIDER=mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoieW91ci11c2VybmFtZSIsImEiOiJjbGt3ZXhhYmMwMDJkM2NvOGt5b2Q5dXBqIn0.xxx
NEXT_PUBLIC_MAP_STYLE=mapbox://styles/mapbox/outdoors-v12

# .env.production
NEXT_PUBLIC_MAP_PROVIDER=mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=pk.production_token_here
NEXT_PUBLIC_MAP_STYLE=mapbox://styles/your-username/custom-style
```

## Deployment Checklist

- [ ] Mapbox account created and configured
- [ ] Access tokens set in environment variables
- [ ] Custom map style created (optional)
- [ ] Usage limits configured in Mapbox dashboard
- [ ] API request monitoring set up
- [ ] Error tracking configured
- [ ] Performance monitoring enabled
- [ ] Mobile testing completed

## Migration Strategy

When switching map providers:

1. **Implement new provider adapter** following the same interface
2. **Test thoroughly** in development environment
3. **Feature flag rollout** to test with subset of users
4. **Monitor performance** and error rates
5. **Gradual migration** based on metrics
6. **Update documentation** and configuration

## Performance Targets

- Route calculation: < 2 seconds for 20 waypoints
- Address search: < 500ms response time
- Map initial load: < 3 seconds on 3G
- Smooth pan/zoom: 60 FPS on mobile devices

## Next Steps

1. Implement the map service abstraction layer
2. Create React components for route building
3. Add mobile gesture support
4. Implement caching strategy
5. Set up performance monitoring
6. Create comprehensive test suite
7. Document API usage patterns

This implementation guide provides a complete foundation for integrating mapping functionality into Mile Quest while maintaining flexibility for future provider changes.