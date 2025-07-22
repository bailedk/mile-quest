# Map Integration Guide for Mile Quest

## Overview

This guide explains how to integrate the enhanced Goals API with map functionality in the Mile Quest frontend. It covers location search, route visualization, waypoint management, and progress tracking on maps.

## Prerequisites

- Mapbox account with TWO separate tokens:
  - **Backend token** (secret) - Used server-side for API calls, stored in backend environment
  - **Frontend token** (public) - Used client-side for map display, restricted by domain
- React with TypeScript
- Map library (Mapbox GL JS recommended)

**Security Note**: Never expose your backend Mapbox token to the frontend. The backend handles all API calls to Mapbox and returns only the processed data.

## Key Features

1. **Location Search** - Search for addresses and places
2. **Route Visualization** - Display walking routes on the map
3. **Waypoint Management** - Add, remove, and reorder waypoints
4. **Route Optimization** - Optimize waypoint order for shortest path
5. **Progress Tracking** - Show team progress along the route
6. **Elevation Profile** - Display elevation changes (future enhancement)

## Implementation Steps

### 1. Map Service Setup

Create a map service abstraction for the frontend:

```typescript
// services/map.service.ts
import mapboxgl from 'mapbox-gl';
import polyline from '@mapbox/polyline';

export class MapService {
  private map: mapboxgl.Map;
  
  constructor(container: string, accessToken: string) {
    mapboxgl.accessToken = accessToken;
    this.map = new mapboxgl.Map({
      container,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [-74.0060, 40.7128], // NYC
      zoom: 10
    });
  }
  
  // Decode and display route polyline
  displayRoute(encodedPolyline: string) {
    const coordinates = polyline.decode(encodedPolyline);
    const geojson = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coordinates.map(([lat, lng]) => [lng, lat])
      }
    };
    
    // Add route layer
    this.map.addSource('route', {
      type: 'geojson',
      data: geojson
    });
    
    this.map.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#2563EB',
        'line-width': 4
      }
    });
  }
  
  // Add waypoint markers
  addWaypoint(position: { lat: number; lng: number }, type: 'start' | 'end' | 'waypoint') {
    const marker = new mapboxgl.Marker({
      color: type === 'start' ? '#10B981' : type === 'end' ? '#EF4444' : '#F59E0B',
      draggable: true
    })
    .setLngLat([position.lng, position.lat])
    .addTo(this.map);
    
    return marker;
  }
  
  // Fit map to route bounds
  fitToBounds(bounds: { southwest: Position; northeast: Position }) {
    this.map.fitBounds([
      [bounds.southwest.lng, bounds.southwest.lat],
      [bounds.northeast.lng, bounds.northeast.lat]
    ], { padding: 50 });
  }
}
```

### 2. Goal Creation Component

```typescript
// components/CreateGoal.tsx
import React, { useState, useEffect } from 'react';
import { MapService } from '../services/map.service';
import { goalsApi } from '../api/goals';

interface Waypoint {
  position: { lat: number; lng: number };
  address?: string;
  marker?: mapboxgl.Marker;
}

export const CreateGoal: React.FC<{ teamId: string }> = ({ teamId }) => {
  const [mapService, setMapService] = useState<MapService>();
  const [startLocation, setStartLocation] = useState<Waypoint>();
  const [endLocation, setEndLocation] = useState<Waypoint>();
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [routeInfo, setRouteInfo] = useState<any>();
  
  useEffect(() => {
    const service = new MapService('map-container', process.env.REACT_APP_MAPBOX_TOKEN!);
    setMapService(service);
  }, []);
  
  // Search for location
  const searchLocation = async (query: string) => {
    const results = await goalsApi.searchLocation(query);
    return results;
  };
  
  // Validate route when waypoints change
  const validateRoute = async () => {
    if (!startLocation || !endLocation) return;
    
    try {
      const validation = await goalsApi.validateRoute({
        startLocation: startLocation.position,
        endLocation: endLocation.position,
        waypoints: waypoints.map(wp => ({
          position: wp.position,
          address: wp.address
        }))
      });
      
      setRouteInfo(validation);
      mapService?.displayRoute(validation.encodedPolyline);
      mapService?.fitToBounds(validation.bounds);
    } catch (error) {
      console.error('Route validation failed:', error);
    }
  };
  
  // Optimize waypoint order
  const optimizeWaypoints = async () => {
    const allWaypoints = [
      startLocation!,
      ...waypoints,
      endLocation!
    ];
    
    const optimized = await goalsApi.optimizeWaypoints(allWaypoints);
    
    // Update waypoints based on optimized order
    setStartLocation(optimized[0]);
    setWaypoints(optimized.slice(1, -1));
    setEndLocation(optimized[optimized.length - 1]);
    
    // Revalidate route
    await validateRoute();
  };
  
  // Create the goal
  const createGoal = async (name: string, description: string) => {
    if (!startLocation || !endLocation || !routeInfo) return;
    
    try {
      const goal = await goalsApi.createGoal({
        teamId,
        name,
        description,
        startLocation: startLocation.position,
        endLocation: endLocation.position,
        waypoints: waypoints.map(wp => ({
          position: wp.position,
          address: wp.address
        })),
        targetDate: calculateTargetDate(),
        status: 'ACTIVE'
      });
      
      // Navigate to goal detail page
      navigate(`/goals/${goal.id}`);
    } catch (error) {
      console.error('Goal creation failed:', error);
    }
  };
  
  return (
    <div className="create-goal-container">
      <div className="map-controls">
        <LocationSearch 
          placeholder="Start location"
          onSelect={setStartLocation}
          onSearch={searchLocation}
        />
        
        <WaypointList
          waypoints={waypoints}
          onAdd={(wp) => setWaypoints([...waypoints, wp])}
          onRemove={(index) => setWaypoints(waypoints.filter((_, i) => i !== index))}
          onReorder={(newOrder) => setWaypoints(newOrder)}
        />
        
        <LocationSearch
          placeholder="End location"
          onSelect={setEndLocation}
          onSearch={searchLocation}
        />
        
        <button onClick={optimizeWaypoints}>
          Optimize Route
        </button>
      </div>
      
      <div id="map-container" className="map-container" />
      
      {routeInfo && (
        <RouteInfo
          distance={routeInfo.totalDistance}
          duration={routeInfo.totalDuration}
          segments={routeInfo.segments}
        />
      )}
      
      <GoalDetailsForm
        onSubmit={createGoal}
        disabled={!routeInfo}
      />
    </div>
  );
};
```

### 3. Goal Progress Visualization

```typescript
// components/GoalProgress.tsx
import React, { useEffect, useState } from 'react';
import { MapService } from '../services/map.service';
import { goalsApi } from '../api/goals';
import { useWebSocket } from '../hooks/useWebSocket';

export const GoalProgress: React.FC<{ goalId: string }> = ({ goalId }) => {
  const [goal, setGoal] = useState<any>();
  const [mapService, setMapService] = useState<MapService>();
  const { subscribe } = useWebSocket();
  
  useEffect(() => {
    loadGoal();
    
    // Subscribe to real-time progress updates
    const unsubscribe = subscribe(`goal.${goalId}.progress`, (data) => {
      updateProgressVisualization(data);
    });
    
    return unsubscribe;
  }, [goalId]);
  
  const loadGoal = async () => {
    const goalData = await goalsApi.getGoal(goalId, true);
    setGoal(goalData);
    
    // Initialize map
    const service = new MapService('progress-map', process.env.REACT_APP_MAPBOX_TOKEN!);
    setMapService(service);
    
    // Display route
    service.displayRoute(goalData.routeVisualization.polyline);
    service.fitToBounds(goalData.routeVisualization.bounds);
    
    // Show progress
    displayProgress(goalData.progress);
  };
  
  const displayProgress = (progress: any) => {
    if (!mapService || !goal) return;
    
    // Calculate position along route based on progress
    const progressPosition = calculateProgressPosition(
      goal.routeVisualization.segments,
      progress.distanceCovered
    );
    
    // Add progress marker
    mapService.addProgressMarker(progressPosition, progress.percentage);
    
    // Highlight completed segments
    highlightCompletedSegments(progress.currentSegment);
  };
  
  const calculateProgressPosition = (segments: any[], distanceCovered: number) => {
    let cumulativeDistance = 0;
    
    for (const segment of segments) {
      if (distanceCovered <= cumulativeDistance + segment.distance) {
        // Progress is within this segment
        const segmentProgress = (distanceCovered - cumulativeDistance) / segment.distance;
        return interpolatePosition(
          segment.startWaypoint.position,
          segment.endWaypoint.position,
          segmentProgress
        );
      }
      cumulativeDistance += segment.distance;
    }
    
    // If we're here, progress exceeds total distance (shouldn't happen)
    return segments[segments.length - 1].endWaypoint.position;
  };
  
  return (
    <div className="goal-progress">
      <div id="progress-map" className="map-container" />
      
      {goal && (
        <>
          <ProgressStats
            percentage={goal.progress.percentage}
            distanceCovered={goal.progress.distanceCovered}
            distanceRemaining={goal.progress.distanceRemaining}
            lastActivity={goal.progress.lastActivity}
          />
          
          <SegmentProgress
            segments={goal.routeVisualization.segments}
            currentSegment={goal.progress.currentSegment}
            segmentProgress={goal.progress.segmentProgress}
          />
        </>
      )}
    </div>
  );
};
```

### 4. API Integration Layer

```typescript
// api/goals.ts
import { apiClient } from './client';

export const goalsApi = {
  // Search for locations
  searchLocation: async (query: string, proximity?: { lat: number; lng: number }) => {
    const params = new URLSearchParams({ q: query, limit: '5' });
    if (proximity) {
      params.append('lat', proximity.lat.toString());
      params.append('lng', proximity.lng.toString());
    }
    
    const response = await apiClient.get(`/goals/search-location?${params}`);
    return response.data.data;
  },
  
  // Validate route
  validateRoute: async (route: {
    startLocation: Position;
    endLocation: Position;
    waypoints?: Waypoint[];
  }) => {
    const response = await apiClient.post('/goals/validate-route', route);
    return response.data.data;
  },
  
  // Optimize waypoints
  optimizeWaypoints: async (waypoints: Waypoint[]) => {
    const response = await apiClient.post('/goals/optimize-waypoints', { waypoints });
    return response.data.data.waypoints;
  },
  
  // Create goal
  createGoal: async (goalData: CreateGoalInput) => {
    const response = await apiClient.post('/goals', goalData);
    return response.data.data;
  },
  
  // Get goal with progress
  getGoal: async (goalId: string, includeProgress = false) => {
    const response = await apiClient.get(
      `/goals/${goalId}${includeProgress ? '?includeProgress=true' : ''}`
    );
    return response.data.data;
  },
  
  // Get elevation profile
  getElevation: async (goalId: string) => {
    const response = await apiClient.get(`/goals/${goalId}/elevation`);
    return response.data.data;
  }
};
```

### 5. Mobile Considerations

```typescript
// components/MobileGoalCreation.tsx
import React from 'react';
import { useGeolocation } from '../hooks/useGeolocation';

export const MobileGoalCreation: React.FC = () => {
  const { position, error } = useGeolocation();
  
  // Use current location for proximity search
  const searchNearby = async (query: string) => {
    if (!position) return;
    
    const results = await goalsApi.searchLocation(query, {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    });
    
    return results;
  };
  
  // Touch-friendly waypoint management
  const handleWaypointDrag = (e: TouchEvent) => {
    // Handle touch drag for waypoint reordering
    e.preventDefault();
    // Implementation details...
  };
  
  return (
    <div className="mobile-goal-creation">
      {/* Touch-optimized UI */}
    </div>
  );
};
```

## Best Practices

### 1. Performance Optimization

- **Debounce location searches** to avoid excessive API calls
- **Cache route validations** for identical waypoint sets
- **Use progressive rendering** for long polylines
- **Implement virtual scrolling** for waypoint lists

### 2. User Experience

- **Auto-save draft goals** as users build routes
- **Show distance/time estimates** in real-time
- **Provide undo/redo** for waypoint changes
- **Support drag-and-drop** waypoint reordering

### 3. Error Handling

```typescript
// Handle specific error codes
const handleGoalError = (error: any) => {
  switch (error.response?.data?.error?.code) {
    case 'TOO_MANY_WAYPOINTS':
      showError('Maximum 8 waypoints allowed between start and end');
      break;
    case 'DISTANCE_TOO_LONG':
      showError('Route exceeds maximum distance of 50,000 km');
      break;
    case 'NO_ROUTE_FOUND':
      showError('No walking route found. Try adjusting waypoints');
      break;
    default:
      showError('Failed to create goal. Please try again');
  }
};
```

### 4. Accessibility

- **Provide text alternatives** for map interactions
- **Support keyboard navigation** for waypoint management
- **Include ARIA labels** for map controls
- **Offer list view** alternative to map view

## Testing

```typescript
// __tests__/goalCreation.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react';
import { CreateGoal } from '../components/CreateGoal';
import { goalsApi } from '../api/goals';

jest.mock('../api/goals');

describe('Goal Creation', () => {
  it('validates route when waypoints change', async () => {
    const mockValidation = {
      totalDistance: 150000,
      encodedPolyline: 'mock_polyline',
      bounds: { /* ... */ }
    };
    
    (goalsApi.validateRoute as jest.Mock).mockResolvedValue(mockValidation);
    
    const { getByPlaceholderText, getByText } = render(
      <CreateGoal teamId="team-123" />
    );
    
    // Add start location
    const startInput = getByPlaceholderText('Start location');
    fireEvent.change(startInput, { target: { value: 'New York' } });
    
    // Add end location
    const endInput = getByPlaceholderText('End location');
    fireEvent.change(endInput, { target: { value: 'Philadelphia' } });
    
    await waitFor(() => {
      expect(goalsApi.validateRoute).toHaveBeenCalled();
      expect(getByText('150 km')).toBeInTheDocument();
    });
  });
});
```

## Troubleshooting

### Common Issues

1. **Map not loading**
   - Check Mapbox token configuration
   - Verify CORS settings for map tiles
   - Ensure container has defined dimensions

2. **Route calculation failing**
   - Validate coordinates are within valid ranges
   - Check for network connectivity
   - Verify API rate limits

3. **Performance issues**
   - Reduce polyline precision for long routes
   - Implement clustering for many waypoints
   - Use web workers for heavy calculations

## Future Enhancements

1. **Elevation Integration**
   - Real elevation data from terrain APIs
   - Elevation profile charts
   - Difficulty ratings based on elevation gain

2. **Weather Integration**
   - Weather conditions along route
   - Best time to walk predictions
   - Weather-based notifications

3. **Points of Interest**
   - Show attractions along route
   - Rest stop suggestions
   - Photo opportunities

4. **Social Features**
   - Share routes with other teams
   - Public goal gallery
   - Route recommendations