#!/usr/bin/env ts-node

/**
 * Test script to validate Mapbox configuration and functionality
 * Run with: npm run test:mapbox
 */

import { mapboxConfig, validateMapboxConfiguration } from '../src/config/mapbox.config';
import { createMapService } from '../src/services/map';
import { MapService, SearchOptions, RouteOptions, Waypoint } from '../src/services/map/types';

// Test data
const TEST_LOCATIONS = {
  newYork: { lat: 40.7128, lng: -74.0060 },
  sanFrancisco: { lat: 37.7749, lng: -122.4194 },
  chicago: { lat: 41.8781, lng: -87.6298 },
};

async function testConfiguration() {
  console.log('\n🔧 Testing Mapbox Configuration...\n');
  
  try {
    // Validate configuration
    const isValid = validateMapboxConfiguration();
    console.log('✅ Configuration valid:', isValid);
    
    // Check token (without exposing it)
    const token = mapboxConfig.getAccessToken();
    console.log('✅ Token loaded:', token.substring(0, 10) + '...');
    console.log('✅ Token type:', token.startsWith('pk.') ? 'Public' : 'Secret');
    
    // Check settings
    console.log('✅ Rate limits:', mapboxConfig.getRateLimits());
    console.log('✅ Allowed domains:', mapboxConfig.getAllowedDomains());
    console.log('✅ Has required scopes:', mapboxConfig.hasRequiredScopes());
    
  } catch (error) {
    console.error('❌ Configuration error:', error);
    return false;
  }
  
  return true;
}

async function testGeocoding(mapService: MapService) {
  console.log('\n📍 Testing Geocoding...\n');
  
  try {
    // Test forward geocoding
    const searchResults = await mapService.searchAddress('Times Square, New York', {
      limit: 3,
    });
    
    console.log('✅ Forward geocoding results:', searchResults.length);
    searchResults.forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.address}`);
      console.log(`      Position: ${result.position.lat}, ${result.position.lng}`);
      console.log(`      Relevance: ${result.relevance}`);
    });
    
    // Test reverse geocoding
    const address = await mapService.reverseGeocode(TEST_LOCATIONS.newYork);
    console.log('\n✅ Reverse geocoding result:');
    console.log(`   Address: ${address}`);
    
  } catch (error) {
    console.error('❌ Geocoding error:', error);
    return false;
  }
  
  return true;
}

async function testRouting(mapService: MapService) {
  console.log('\n🗺️  Testing Route Calculation...\n');
  
  try {
    // Create waypoints
    const waypoints: Waypoint[] = [
      {
        id: 'start',
        position: TEST_LOCATIONS.newYork,
        order: 1,
        address: 'New York, NY',
      },
      {
        id: 'middle',
        position: TEST_LOCATIONS.chicago,
        order: 2,
        address: 'Chicago, IL',
      },
      {
        id: 'end',
        position: TEST_LOCATIONS.sanFrancisco,
        order: 3,
        address: 'San Francisco, CA',
      },
    ];
    
    // Calculate route
    const route = await mapService.calculateRoute(waypoints, {
      profile: 'walking',
    });
    
    console.log('✅ Route calculated:');
    console.log(`   Total distance: ${(route.totalDistance / 1000).toFixed(2)} km`);
    console.log(`   Total duration: ${(route.totalDuration / 3600).toFixed(2)} hours`);
    console.log(`   Segments: ${route.segments.length}`);
    
    route.segments.forEach((segment, index) => {
      console.log(`\n   Segment ${index + 1}:`);
      console.log(`   From: ${segment.startWaypoint.address}`);
      console.log(`   To: ${segment.endWaypoint.address}`);
      console.log(`   Distance: ${(segment.distance / 1000).toFixed(2)} km`);
      console.log(`   Duration: ${(segment.duration / 3600).toFixed(2)} hours`);
    });
    
  } catch (error) {
    console.error('❌ Routing error:', error);
    return false;
  }
  
  return true;
}

async function testOptimization(mapService: MapService) {
  console.log('\n🔄 Testing Waypoint Optimization...\n');
  
  try {
    // Create unoptimized waypoints
    const waypoints: Waypoint[] = [
      {
        id: 'A',
        position: TEST_LOCATIONS.newYork,
        order: 1,
        isLocked: true, // Start point locked
      },
      {
        id: 'B',
        position: TEST_LOCATIONS.sanFrancisco,
        order: 2,
      },
      {
        id: 'C',
        position: TEST_LOCATIONS.chicago,
        order: 3,
      },
      {
        id: 'D',
        position: { lat: 39.7392, lng: -104.9903 }, // Denver
        order: 4,
        isLocked: true, // End point locked
      },
    ];
    
    console.log('Original order:', waypoints.map(w => w.id).join(' → '));
    
    // Optimize waypoints
    const optimized = await mapService.optimizeWaypoints(waypoints);
    
    console.log('✅ Optimized order:', optimized.map(w => w.id).join(' → '));
    
    // Calculate distance savings
    const originalDistance = mapService.calculateRouteDistance(
      waypoints.map(w => w.position)
    );
    const optimizedDistance = mapService.calculateRouteDistance(
      optimized.map(w => w.position)
    );
    
    const savings = originalDistance - optimizedDistance;
    const savingsPercent = (savings / originalDistance) * 100;
    
    console.log(`\n✅ Distance savings: ${(savings / 1000).toFixed(2)} km (${savingsPercent.toFixed(1)}%)`);
    
  } catch (error) {
    console.error('❌ Optimization error:', error);
    return false;
  }
  
  return true;
}

async function testUtilities(mapService: MapService) {
  console.log('\n🛠️  Testing Utilities...\n');
  
  try {
    // Test distance calculation
    const distance = mapService.calculateDistance(
      TEST_LOCATIONS.newYork,
      TEST_LOCATIONS.chicago
    );
    console.log(`✅ Distance NY to Chicago: ${(distance / 1000).toFixed(2)} km`);
    
    // Test bounds calculation
    const positions = Object.values(TEST_LOCATIONS);
    const bounds = mapService.getBounds(positions);
    console.log('\n✅ Bounds for all test locations:');
    console.log(`   Southwest: ${bounds.southwest.lat}, ${bounds.southwest.lng}`);
    console.log(`   Northeast: ${bounds.northeast.lat}, ${bounds.northeast.lng}`);
    
    // Test polyline encoding/decoding
    const encoded = mapService.encodePolyline(positions);
    console.log('\n✅ Encoded polyline:', encoded.substring(0, 50) + '...');
    
    const decoded = mapService.decodePolyline(encoded);
    console.log('✅ Decoded positions:', decoded.length);
    
  } catch (error) {
    console.error('❌ Utilities error:', error);
    return false;
  }
  
  return true;
}

async function main() {
  console.log('🗺️  Mile Quest Mapbox Test Suite');
  console.log('================================\n');
  
  // Test configuration
  const configOk = await testConfiguration();
  if (!configOk) {
    console.error('\n❌ Configuration test failed. Please check your environment variables.');
    process.exit(1);
  }
  
  // Create map service
  console.log('\n📦 Creating Map Service...');
  const mapService = createMapService();
  console.log('✅ Map service created with provider:', process.env.MAP_PROVIDER || 'mock');
  
  // Run tests
  const tests = [
    { name: 'Geocoding', fn: () => testGeocoding(mapService) },
    { name: 'Routing', fn: () => testRouting(mapService) },
    { name: 'Optimization', fn: () => testOptimization(mapService) },
    { name: 'Utilities', fn: () => testUtilities(mapService) },
  ];
  
  let allPassed = true;
  
  for (const test of tests) {
    try {
      const passed = await test.fn();
      if (!passed) {
        allPassed = false;
      }
    } catch (error) {
      console.error(`\n❌ ${test.name} test failed:`, error);
      allPassed = false;
    }
  }
  
  // Summary
  console.log('\n================================');
  if (allPassed) {
    console.log('✅ All tests passed!');
    console.log('\nYour Mapbox integration is ready to use.');
  } else {
    console.log('❌ Some tests failed.');
    console.log('\nPlease check the errors above and your configuration.');
    process.exit(1);
  }
}

// Run tests
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});