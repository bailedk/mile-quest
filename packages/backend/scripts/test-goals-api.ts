/**
 * Test script for enhanced goals API endpoints
 * INT-1.2: Test Goal Creation API with Maps
 */

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const USER_ID = 'test-user-' + uuidv4();

// Test authentication token (mock for local development)
const getAuthToken = () => {
  // In local development, the mock auth service will accept any token
  return 'mock-jwt-token';
};

// Test data
const testLocations = {
  newYork: { lat: 40.7128, lng: -74.0060, address: 'New York, NY' },
  philadelphia: { lat: 39.9526, lng: -75.1652, address: 'Philadelphia, PA' },
  washington: { lat: 38.9072, lng: -77.0369, address: 'Washington, DC' },
  boston: { lat: 42.3601, lng: -71.0589, address: 'Boston, MA' },
  baltimore: { lat: 39.2904, lng: -76.6122, address: 'Baltimore, MD' },
};

async function createTestTeam() {
  console.log('🏃 Creating test team...');
  
  try {
    const response = await axios.post(
      `${API_URL}/teams`,
      {
        name: `Test Goal Team ${Date.now()}`,
        description: 'Team for testing goal API',
        isPublic: true,
      },
      {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    console.log('✅ Team created:', response.data.id);
    return response.data.id;
  } catch (error: any) {
    console.error('❌ Failed to create team:', error.response?.data || error.message);
    throw error;
  }
}

async function testSearchLocation() {
  console.log('\n🔍 Testing location search...');
  
  try {
    const response = await axios.get(
      `${API_URL}/goals/search-location`,
      {
        params: {
          q: 'Times Square New York',
          limit: 5,
        },
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      }
    );
    
    console.log('✅ Location search results:', response.data.data.length);
    if (response.data.data.length > 0) {
      console.log('  First result:', response.data.data[0]);
    }
    
    return response.data.data;
  } catch (error: any) {
    console.error('❌ Location search failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testValidateRoute() {
  console.log('\n🗺️  Testing route validation...');
  
  try {
    const response = await axios.post(
      `${API_URL}/goals/validate-route`,
      {
        startLocation: testLocations.newYork,
        endLocation: testLocations.philadelphia,
        waypoints: [
          {
            position: testLocations.baltimore,
            address: testLocations.baltimore.address,
          }
        ],
      },
      {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    console.log('✅ Route validated:');
    console.log('  Total distance:', (response.data.data.totalDistance / 1000).toFixed(2), 'km');
    console.log('  Total duration:', (response.data.data.totalDuration / 3600).toFixed(2), 'hours');
    console.log('  Segments:', response.data.data.segments.length);
    console.log('  Bounds:', response.data.data.bounds);
    
    return response.data.data;
  } catch (error: any) {
    console.error('❌ Route validation failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testOptimizeWaypoints() {
  console.log('\n🎯 Testing waypoint optimization...');
  
  try {
    const waypoints = [
      { position: testLocations.newYork, address: testLocations.newYork.address },
      { position: testLocations.baltimore, address: testLocations.baltimore.address },
      { position: testLocations.washington, address: testLocations.washington.address },
      { position: testLocations.philadelphia, address: testLocations.philadelphia.address },
      { position: testLocations.boston, address: testLocations.boston.address },
    ];
    
    const response = await axios.post(
      `${API_URL}/goals/optimize-waypoints`,
      { waypoints },
      {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    console.log('✅ Waypoints optimized:');
    response.data.data.waypoints.forEach((wp: any, index: number) => {
      console.log(`  ${index + 1}. ${wp.address || 'Unknown'}`);
    });
    
    return response.data.data.waypoints;
  } catch (error: any) {
    console.error('❌ Waypoint optimization failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testCreateGoal(teamId: string) {
  console.log('\n🎯 Testing goal creation with maps...');
  
  try {
    const response = await axios.post(
      `${API_URL}/goals`,
      {
        teamId,
        name: 'East Coast Walking Challenge',
        description: 'Walk from NYC to Philly via Baltimore',
        startLocation: testLocations.newYork,
        endLocation: testLocations.philadelphia,
        waypoints: [
          {
            position: testLocations.baltimore,
            address: testLocations.baltimore.address,
          }
        ],
        targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
        status: 'ACTIVE',
      },
      {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    console.log('✅ Goal created:', response.data.data.id);
    console.log('  Target distance:', (response.data.data.targetDistance / 1000).toFixed(2), 'km');
    console.log('  Status:', response.data.data.status);
    
    return response.data.data.id;
  } catch (error: any) {
    console.error('❌ Goal creation failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testGetGoal(goalId: string) {
  console.log('\n📊 Testing get goal with visualization data...');
  
  try {
    const response = await axios.get(
      `${API_URL}/goals/${goalId}?includeProgress=true`,
      {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      }
    );
    
    console.log('✅ Goal retrieved with visualization data:');
    console.log('  Goal name:', response.data.data.goalName);
    console.log('  Polyline length:', response.data.data.routeVisualization.polyline.length);
    console.log('  Waypoints:', response.data.data.routeVisualization.waypoints.length);
    console.log('  Progress:', response.data.data.progress?.percentage || 0, '%');
    
    return response.data.data;
  } catch (error: any) {
    console.error('❌ Get goal failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testGetElevation(goalId: string) {
  console.log('\n📈 Testing elevation profile...');
  
  try {
    const response = await axios.get(
      `${API_URL}/goals/${goalId}/elevation`,
      {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        },
      }
    );
    
    console.log('✅ Elevation profile retrieved:');
    console.log('  Min elevation:', response.data.data.minElevation, 'm');
    console.log('  Max elevation:', response.data.data.maxElevation, 'm');
    console.log('  Total ascent:', response.data.data.totalAscent, 'm');
    console.log('  Total descent:', response.data.data.totalDescent, 'm');
    console.log('  Data points:', response.data.data.points.length);
    
    return response.data.data;
  } catch (error: any) {
    console.error('❌ Get elevation failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testErrorHandling() {
  console.log('\n⚠️  Testing error handling...');
  
  // Test invalid coordinates
  try {
    console.log('  Testing invalid coordinates...');
    await axios.post(
      `${API_URL}/goals/validate-route`,
      {
        startLocation: { lat: 200, lng: -74.0060 }, // Invalid latitude
        endLocation: testLocations.philadelphia,
      },
      {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('❌ Should have failed with invalid coordinates');
  } catch (error: any) {
    console.log('✅ Correctly rejected invalid coordinates:', error.response?.data.error.message);
  }
  
  // Test too many waypoints
  try {
    console.log('  Testing too many waypoints...');
    const manyWaypoints = Array(10).fill(null).map((_, i) => ({
      position: { lat: 40 + i * 0.1, lng: -74 + i * 0.1 },
      address: `Waypoint ${i + 1}`,
    }));
    
    await axios.post(
      `${API_URL}/goals`,
      {
        teamId: 'test-team-id',
        name: 'Too Many Waypoints',
        startLocation: testLocations.newYork,
        endLocation: testLocations.boston,
        waypoints: manyWaypoints,
      },
      {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('❌ Should have failed with too many waypoints');
  } catch (error: any) {
    console.log('✅ Correctly rejected too many waypoints:', error.response?.data.error.message);
  }
}

async function runAllTests() {
  console.log('🚀 Starting Goals API tests...\n');
  
  try {
    // Test location search
    await testSearchLocation();
    
    // Test route validation
    await testValidateRoute();
    
    // Test waypoint optimization
    await testOptimizeWaypoints();
    
    // Create team and goal
    const teamId = await createTestTeam();
    const goalId = await testCreateGoal(teamId);
    
    // Test goal retrieval
    await testGetGoal(goalId);
    
    // Test elevation profile
    await testGetElevation(goalId);
    
    // Test error handling
    await testErrorHandling();
    
    console.log('\n✅ All tests completed successfully!');
  } catch (error: any) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run tests
runAllTests();