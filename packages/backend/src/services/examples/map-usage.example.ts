/**
 * Example usage of the Map Service
 * 
 * This demonstrates how to use the map service abstraction
 * for various mapping operations in Mile Quest.
 */

import { 
  createMapService, 
  createMapServiceWithProvider,
  MapService,
  Waypoint,
  Position,
  SearchOptions,
  RouteOptions,
  MapServiceError,
  MapErrorCode,
} from '../map';

async function exampleUsage() {
  // 1. Create a map service instance (uses environment configuration)
  const mapService = createMapService();

  // Or create with specific provider
  // const mapService = createMapServiceWithProvider('mapbox', {
  //   accessToken: process.env.MAPBOX_ACCESS_TOKEN,
  //   defaultProfile: 'walking',
  // });

  try {
    // 2. Search for addresses
    console.log('=== Address Search ===');
    const searchResults = await mapService.searchAddress('Central Park', {
      limit: 3,
      proximity: { lat: 40.7128, lng: -74.0060 }, // Near NYC
    });

    searchResults.forEach(result => {
      console.log(`${result.address} (relevance: ${result.relevance})`);
      console.log(`  Position: ${result.position.lat}, ${result.position.lng}`);
    });

    // 3. Reverse geocoding (get address from coordinates)
    console.log('\n=== Reverse Geocoding ===');
    const address = await mapService.reverseGeocode({
      lat: 40.748817,
      lng: -73.985428,
    });
    console.log(`Address at coordinates: ${address}`);

    // 4. Create waypoints for a route
    const waypoints: Waypoint[] = [
      {
        id: 'start',
        position: { lat: 40.7614, lng: -73.9776 }, // MoMA
        address: 'Museum of Modern Art, New York, NY',
        order: 1,
      },
      {
        id: 'stop1',
        position: { lat: 40.7794, lng: -73.9632 }, // Met Museum
        address: 'Metropolitan Museum of Art, New York, NY',
        order: 2,
      },
      {
        id: 'stop2',
        position: { lat: 40.7829, lng: -73.9654 }, // Central Park
        address: 'Central Park, New York, NY',
        order: 3,
      },
      {
        id: 'end',
        position: { lat: 40.7589, lng: -73.9851 }, // Times Square
        address: 'Times Square, New York, NY',
        order: 4,
      },
    ];

    // 5. Calculate route
    console.log('\n=== Route Calculation ===');
    const route = await mapService.calculateRoute(waypoints, {
      profile: 'walking',
      alternatives: false,
    });

    console.log(`Route ID: ${route.id}`);
    console.log(`Total Distance: ${(route.totalDistance / 1000).toFixed(2)} km`);
    console.log(`Total Duration: ${Math.round(route.totalDuration / 60)} minutes`);
    console.log('\nSegments:');
    
    route.segments.forEach((segment, i) => {
      console.log(`  ${i + 1}. ${segment.startWaypoint.address || 'Waypoint'} → ${segment.endWaypoint.address || 'Waypoint'}`);
      console.log(`     Distance: ${(segment.distance / 1000).toFixed(2)} km`);
      console.log(`     Duration: ${Math.round(segment.duration / 60)} minutes`);
    });

    // 6. Optimize waypoint order
    console.log('\n=== Route Optimization ===');
    const optimizedWaypoints = await mapService.optimizeWaypoints(waypoints);
    
    console.log('Optimized order:');
    optimizedWaypoints.forEach(wp => {
      console.log(`  ${wp.order}. ${wp.address || `Waypoint ${wp.id}`}`);
    });

    // 7. Calculate distances
    console.log('\n=== Distance Calculations ===');
    const directDistance = mapService.calculateDistance(
      waypoints[0].position,
      waypoints[waypoints.length - 1].position
    );
    console.log(`Direct distance (start to end): ${(directDistance / 1000).toFixed(2)} km`);

    const routeDistance = mapService.calculateRouteDistance(
      waypoints.map(w => w.position)
    );
    console.log(`Route distance (through all waypoints): ${(routeDistance / 1000).toFixed(2)} km`);

    // 8. Get bounds for map display
    console.log('\n=== Map Bounds ===');
    const bounds = mapService.getBounds(waypoints.map(w => w.position));
    console.log(`Southwest: ${bounds.southwest.lat}, ${bounds.southwest.lng}`);
    console.log(`Northeast: ${bounds.northeast.lat}, ${bounds.northeast.lng}`);

    // 9. Polyline encoding (for storage/transmission)
    console.log('\n=== Polyline Encoding ===');
    const encoded = mapService.encodePolyline(route.segments[0].coordinates);
    console.log(`Encoded polyline (first segment): ${encoded.substring(0, 50)}...`);
    
    const decoded = mapService.decodePolyline(encoded);
    console.log(`Decoded ${decoded.length} coordinates`);

  } catch (error) {
    // Handle specific map service errors
    if (error instanceof MapServiceError) {
      console.error(`Map Service Error: ${error.message}`);
      console.error(`Error Code: ${error.code}`);
      
      switch (error.code) {
        case MapErrorCode.INVALID_TOKEN:
          console.error('Please check your API token configuration');
          break;
        case MapErrorCode.RATE_LIMIT_EXCEEDED:
          console.error('Too many requests. Please try again later.');
          break;
        case MapErrorCode.NO_ROUTE_FOUND:
          console.error('No route could be found between the waypoints');
          break;
        case MapErrorCode.SERVICE_UNAVAILABLE:
          console.error('The mapping service is temporarily unavailable');
          break;
        default:
          console.error('An unexpected error occurred');
      }
    } else {
      console.error('Unknown error:', error);
    }
  }
}

// Example: Creating a team goal with route
async function createTeamGoalWithRoute() {
  const mapService = createMapService();

  // User searches for locations to build their route
  const startSearch = await mapService.searchAddress('Golden Gate Bridge', {
    limit: 1,
  });
  
  const endSearch = await mapService.searchAddress('Fishermans Wharf San Francisco', {
    limit: 1,
  });

  if (startSearch.length === 0 || endSearch.length === 0) {
    throw new Error('Could not find locations');
  }

  // Create waypoints from search results
  const waypoints: Waypoint[] = [
    {
      id: 'start',
      position: startSearch[0].position,
      address: startSearch[0].address,
      order: 1,
      isLocked: true, // Start point is fixed
    },
    {
      id: 'end',
      position: endSearch[0].position,
      address: endSearch[0].address,
      order: 2,
      isLocked: true, // End point is fixed
    },
  ];

  // Calculate the route
  const route = await mapService.calculateRoute(waypoints);

  // Create team goal with the route
  const teamGoal = {
    name: 'Walk the Golden Gate to Fishermans Wharf',
    description: 'A scenic walk from the Golden Gate Bridge to Fishermans Wharf',
    targetDistance: route.totalDistance,
    estimatedDuration: route.totalDuration,
    route: {
      waypoints: route.waypoints,
      encodedPolyline: route.encodedPolyline,
      bounds: route.bounds,
    },
  };

  console.log('\n=== Team Goal Created ===');
  console.log(`Goal: ${teamGoal.name}`);
  console.log(`Distance: ${(teamGoal.targetDistance / 1000).toFixed(2)} km`);
  console.log(`Estimated walking time: ${Math.round(teamGoal.estimatedDuration / 60)} minutes`);

  return teamGoal;
}

// Example: Validating user-submitted activity location
async function validateActivityLocation(position: Position) {
  const mapService = createMapService();

  try {
    // Get the address for the submitted coordinates
    const address = await mapService.reverseGeocode(position);
    
    // Could add additional validation here
    // e.g., check if it's within expected geographic bounds
    
    return {
      valid: true,
      address,
      position,
    };
  } catch (error) {
    if (error instanceof MapServiceError && error.code === MapErrorCode.ADDRESS_NOT_FOUND) {
      return {
        valid: false,
        reason: 'Could not verify location',
      };
    }
    throw error;
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  console.log('Running Map Service Examples...\n');
  
  exampleUsage()
    .then(() => createTeamGoalWithRoute())
    .then(() => {
      console.log('\nExamples completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\nExample failed:', error);
      process.exit(1);
    });
}

export {
  exampleUsage,
  createTeamGoalWithRoute,
  validateActivityLocation,
};