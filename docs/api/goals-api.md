# Goals API Documentation

## Overview

The Goals API provides enhanced endpoints for creating and managing team goals with integrated map functionality. This includes route calculation, waypoint optimization, location search, and visualization data for frontend map integration.

## Authentication

All endpoints require JWT authentication via the `Authorization: Bearer <token>` header.

## Endpoints

### 1. Create Goal

Creates a new team goal with automatic route calculation.

**Endpoint**: `POST /goals`

**Request Body**:
```json
{
  "teamId": "string",
  "name": "string",
  "description": "string (optional)",
  "startLocation": {
    "lat": number,
    "lng": number,
    "address": "string (optional)"
  },
  "endLocation": {
    "lat": number,
    "lng": number,
    "address": "string (optional)"
  },
  "waypoints": [
    {
      "position": {
        "lat": number,
        "lng": number
      },
      "address": "string (optional)",
      "isLocked": boolean (optional)
    }
  ],
  "targetDate": "ISO 8601 date (optional)",
  "status": "DRAFT | ACTIVE (optional, defaults to DRAFT)"
}
```

**Response**: `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "string",
    "teamId": "string",
    "name": "string",
    "description": "string",
    "targetDistance": number,
    "targetDate": "ISO 8601 date",
    "startLocation": {...},
    "endLocation": {...},
    "waypoints": [...],
    "routePolyline": "string",
    "routeData": {...},
    "status": "DRAFT | ACTIVE",
    "createdAt": "ISO 8601 date",
    "updatedAt": "ISO 8601 date"
  }
}
```

**Error Responses**:
- `400 Bad Request` - Invalid input, coordinates, or waypoint count
- `403 Forbidden` - User is not a member of the team
- `404 Not Found` - Team not found
- `422 Unprocessable Entity` - Route calculation failed

### 2. Validate Route

Validates and calculates a route without creating a goal.

**Endpoint**: `POST /goals/validate-route`

**Request Body**:
```json
{
  "startLocation": {
    "lat": number,
    "lng": number,
    "address": "string (optional)"
  },
  "endLocation": {
    "lat": number,
    "lng": number,
    "address": "string (optional)"
  },
  "waypoints": [...] (optional)
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "totalDistance": number,
    "totalDuration": number,
    "encodedPolyline": "string",
    "bounds": {
      "southwest": { "lat": number, "lng": number },
      "northeast": { "lat": number, "lng": number }
    },
    "waypoints": [...],
    "segments": [
      {
        "distance": number,
        "duration": number,
        "startWaypoint": {...},
        "endWaypoint": {...}
      }
    ]
  }
}
```

### 3. Search Location

Search for addresses or places to use as waypoints.

**Endpoint**: `GET /goals/search-location`

**Query Parameters**:
- `q` (required) - Search query
- `limit` (optional) - Number of results (default: 5)
- `lat` (optional) - Proximity latitude
- `lng` (optional) - Proximity longitude

**Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "address": "string",
      "position": {
        "lat": number,
        "lng": number
      },
      "relevance": number,
      "type": "string"
    }
  ]
}
```

### 4. Optimize Waypoints

Optimizes waypoint order for the shortest route.

**Endpoint**: `POST /goals/optimize-waypoints`

**Request Body**:
```json
{
  "waypoints": [
    {
      "position": {
        "lat": number,
        "lng": number
      },
      "address": "string (optional)",
      "isLocked": boolean (optional)
    }
  ]
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "waypoints": [...] // Optimized order
  }
}
```

### 5. Get Goal with Visualization Data

Retrieves a goal with enhanced route visualization data.

**Endpoint**: `GET /goals/{goalId}`

**Query Parameters**:
- `includeProgress` (optional) - Include progress information

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "goalId": "string",
    "teamId": "string",
    "goalName": "string",
    "description": "string",
    "startLocation": {...},
    "endLocation": {...},
    "waypoints": [...],
    "totalDistance": number,
    "targetDate": "ISO 8601 date",
    "status": "string",
    "routeVisualization": {
      "polyline": "string",
      "bounds": {...},
      "waypoints": [...],
      "segments": [...]
    },
    "progress": {
      "percentage": number,
      "distanceCovered": number,
      "distanceRemaining": number,
      "currentSegment": number,
      "segmentProgress": number,
      "lastActivity": "ISO 8601 date"
    }
  }
}
```

### 6. Get Elevation Profile

Retrieves elevation data for a goal route (currently returns mock data).

**Endpoint**: `GET /goals/{goalId}/elevation`

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "minElevation": number,
    "maxElevation": number,
    "totalAscent": number,
    "totalDescent": number,
    "points": [
      {
        "distance": number,
        "elevation": number
      }
    ]
  }
}
```

## Error Codes

The API uses specific error codes for different scenarios:

- `INVALID_NAME` - Goal name is invalid or empty
- `INVALID_COORDINATES` - Latitude/longitude values are out of range
- `TOO_FEW_WAYPOINTS` - Less than 2 waypoints (start + end)
- `TOO_MANY_WAYPOINTS` - More than 10 waypoints total
- `DUPLICATE_WAYPOINT` - Multiple waypoints have the same coordinates
- `DISTANCE_TOO_LONG` - Route exceeds 50,000 km
- `INVALID_TARGET_DATE` - Target date is in the past
- `INVALID_STATUS` - Invalid goal status value
- `USER_NOT_MEMBER` - User is not a member of the team
- `ROUTE_CALCULATION_FAILED` - Map service failed to calculate route
- `NO_ROUTE_FOUND` - No walking route exists between waypoints

## Validation Rules

1. **Waypoints**: 
   - Minimum: 2 (start + end)
   - Maximum: 10 (including start + end)
   - Up to 8 intermediate waypoints allowed

2. **Coordinates**:
   - Latitude: -90 to 90
   - Longitude: -180 to 180

3. **Distance**:
   - Maximum: 50,000 km

4. **Goal Status**:
   - New goals can only be `DRAFT` or `ACTIVE`
   - Draft goals allow more flexible validation

## Integration Guide

### Frontend Map Integration

1. **Location Search Flow**:
   ```javascript
   // Search for locations
   const results = await fetch('/goals/search-location?q=Times Square');
   
   // User selects a location
   const selectedLocation = results[0];
   ```

2. **Route Validation Before Creation**:
   ```javascript
   // Validate route as user adds waypoints
   const validation = await fetch('/goals/validate-route', {
     method: 'POST',
     body: JSON.stringify({
       startLocation,
       endLocation,
       waypoints
     })
   });
   
   // Show distance and polyline on map
   map.showRoute(validation.data.encodedPolyline);
   ```

3. **Waypoint Optimization**:
   ```javascript
   // Optimize waypoint order
   const optimized = await fetch('/goals/optimize-waypoints', {
     method: 'POST',
     body: JSON.stringify({ waypoints })
   });
   
   // Update map with optimized order
   updateWaypointOrder(optimized.data.waypoints);
   ```

### Map Visualization

The API returns encoded polylines using the Google Polyline encoding format. These can be decoded and displayed on various map providers:

- **Mapbox**: Use `polyline.decode()` from `@mapbox/polyline`
- **Google Maps**: Use `google.maps.geometry.encoding.decodePath()`
- **Leaflet**: Use the `Leaflet.encoded` plugin

### Real-time Updates

Goals integrate with the WebSocket system for real-time progress updates:

```javascript
// Subscribe to goal progress updates
websocket.subscribe(`goal.${goalId}.progress`, (data) => {
  updateProgressVisualization(data);
});
```

## Best Practices

1. **Validate Before Creating**: Always use `/goals/validate-route` before creating a goal to provide immediate feedback on distance and route feasibility.

2. **Address Geocoding**: Use `/goals/search-location` to convert user-entered addresses to coordinates for accuracy.

3. **Waypoint Management**: Allow users to drag waypoints on the map and use `/goals/optimize-waypoints` to suggest optimal ordering.

4. **Progress Visualization**: Use the `includeProgress=true` parameter to get real-time progress data for map visualization.

5. **Error Handling**: Display user-friendly messages based on the specific error codes returned.

## Example: Complete Goal Creation Flow

```javascript
// 1. Search for start location
const startSearch = await fetch('/goals/search-location?q=Central Park NYC');
const startLocation = startSearch.data[0].position;

// 2. Search for end location  
const endSearch = await fetch('/goals/search-location?q=Liberty Bell Philadelphia');
const endLocation = endSearch.data[0].position;

// 3. Validate route
const validation = await fetch('/goals/validate-route', {
  method: 'POST',
  body: JSON.stringify({ startLocation, endLocation })
});

// 4. Show route on map
displayRoute(validation.data);

// 5. Create goal
const goal = await fetch('/goals', {
  method: 'POST',
  body: JSON.stringify({
    teamId: 'team-123',
    name: 'NYC to Philly Walk',
    startLocation,
    endLocation,
    targetDate: '2024-12-31',
    status: 'ACTIVE'
  })
});

// 6. Subscribe to progress updates
subscribeToGoalProgress(goal.data.id);
```