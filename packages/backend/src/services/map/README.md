# Map Service

This directory contains the map service implementation for Mile Quest, providing vendor-agnostic mapping functionality following the external service abstraction pattern.

## Overview

The map service provides:
- **Address search** (geocoding)
- **Reverse geocoding** (coordinates to address)
- **Route calculation** between waypoints
- **Route optimization** for efficient waypoint ordering
- **Distance calculations** and utilities
- **Polyline encoding/decoding** for efficient storage

## Architecture

```
┌─────────────────────────────────────────────────┐
│             Application Code                     │
│         (Uses MapService interface)              │
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

## Usage

### Basic Usage

```typescript
import { createMapService } from '@/services/map';

// Create service instance (uses environment configuration)
const mapService = createMapService();

// Search for addresses
const results = await mapService.searchAddress('Central Park', {
  limit: 5,
  proximity: { lat: 40.7128, lng: -74.0060 }
});

// Calculate route
const waypoints = [
  { id: '1', position: { lat: 40.7128, lng: -74.0060 }, order: 1 },
  { id: '2', position: { lat: 40.7580, lng: -73.9855 }, order: 2 }
];
const route = await mapService.calculateRoute(waypoints);
```

### Distance Utilities

```typescript
import { 
  metersToMiles, 
  formatDistance, 
  calculateProgressStats 
} from '@/services/map';

// Convert distances
const miles = metersToMiles(5000); // 3.1 miles

// Format for display
const display = formatDistance(5000); // "3.1 mi"
const displayMetric = formatDistance(5000, true); // "5.0 km"

// Track progress
const stats = calculateProgressStats(
  10000,  // target distance (meters)
  2500,   // completed distance
  1800    // elapsed time (seconds)
);
```

## Configuration

### Environment Variables

```bash
# Map provider selection
MAP_PROVIDER=mapbox  # Options: mapbox, mock

# Mapbox configuration
MAPBOX_ACCESS_TOKEN=pk.your_token_here

# Default settings
MAP_DEFAULT_PROFILE=walking  # walking, cycling, driving
MAP_MAX_WAYPOINTS=20
```

### Provider-Specific Configuration

```typescript
// Create with custom configuration
const mapService = createMapService({
  defaultProfile: 'cycling',
  maxWaypoints: 10,
  language: 'es',
  country: 'MX'
});
```

## API Reference

### MapService Interface

#### searchAddress(query, options?)
Search for addresses matching a query string.

```typescript
const results = await mapService.searchAddress('Times Square', {
  limit: 3,
  proximity: { lat: 40.7128, lng: -74.0060 },
  types: ['address', 'poi']
});
```

#### reverseGeocode(position)
Get address from coordinates.

```typescript
const address = await mapService.reverseGeocode({
  lat: 40.7128,
  lng: -74.0060
});
```

#### calculateRoute(waypoints, options?)
Calculate route between waypoints.

```typescript
const route = await mapService.calculateRoute(waypoints, {
  profile: 'walking',
  alternatives: false
});
```

#### optimizeWaypoints(waypoints)
Optimize waypoint order for shortest route.

```typescript
const optimized = await mapService.optimizeWaypoints(waypoints);
```

### Distance Utilities

#### Unit Conversions
- `metersToMiles(meters)`
- `milesToMeters(miles)`
- `metersToKilometers(meters)`
- `kilometersToMeters(kilometers)`

#### Formatting
- `formatDistance(meters, useMetric?, decimals?)`
- `formatDuration(seconds)`
- `calculatePace(meters, seconds, useMetric?)`
- `calculateSpeed(meters, seconds, useMetric?)`

#### Progress Tracking
- `calculateProgressStats(target, completed, elapsed)`
- `getDistanceAchievementLevel(meters)`

## Error Handling

```typescript
import { MapServiceError, MapErrorCode } from '@/services/map';

try {
  const route = await mapService.calculateRoute(waypoints);
} catch (error) {
  if (error instanceof MapServiceError) {
    switch (error.code) {
      case MapErrorCode.INVALID_TOKEN:
        console.error('Check your API token');
        break;
      case MapErrorCode.NO_ROUTE_FOUND:
        console.error('No route between waypoints');
        break;
      case MapErrorCode.RATE_LIMIT_EXCEEDED:
        console.error('Too many requests');
        break;
    }
  }
}
```

## Testing

### Using Mock Provider

```typescript
import { createMapServiceWithProvider } from '@/services/map';

// For testing
const mockService = createMapServiceWithProvider('mock');

// Mock service provides realistic responses
const route = await mockService.calculateRoute(waypoints);
```

### Running Tests

```bash
# Run all map service tests
npm test -- src/services/map/__tests__/

# Run specific test suite
npm test -- mapbox.provider.test.ts

# Run with coverage
npm test -- --coverage src/services/map/
```

## Migration Guide

### Switching Providers

1. **Google Maps** (future)
   ```bash
   MAP_PROVIDER=google
   GOOGLE_MAPS_API_KEY=your_key_here
   ```

2. **OpenStreetMap** (future)
   ```bash
   MAP_PROVIDER=osm
   # No API key required
   ```

### Custom Provider Implementation

```typescript
import { MapService, MapConfig } from './types';

export class CustomMapService implements MapService {
  constructor(config: MapConfig) {
    // Initialize your provider
  }

  async searchAddress(query: string, options?: SearchOptions) {
    // Implement search
  }

  // Implement all interface methods
}

// Register in factory
// map.factory.ts
case 'custom':
  return new CustomMapService(mapConfig);
```

## Performance Considerations

1. **Caching**: Consider implementing caching for geocoding results
2. **Rate Limiting**: Respect provider rate limits
3. **Batch Operations**: Optimize multiple waypoint operations
4. **Error Retries**: Implement exponential backoff for transient errors

## Security

1. **API Keys**: Never expose API keys in client code
2. **Input Validation**: Validate coordinates and user input
3. **Rate Limiting**: Implement application-level rate limiting
4. **Access Control**: Restrict map operations based on user permissions

## Future Enhancements

- [ ] Offline map support
- [ ] Turn-by-turn navigation
- [ ] Elevation profiles
- [ ] Alternative route suggestions
- [ ] Traffic/weather integration
- [ ] Custom map styles
- [ ] Geofencing capabilities