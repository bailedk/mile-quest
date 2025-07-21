/**
 * Debug script for Mapbox configuration issues
 */

// Load environment variables from env.json BEFORE importing any modules
const fs = require('fs');
const path = require('path');

try {
  const envJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'env.json'), 'utf8'));
  const dashboardEnv = envJson.DashboardFunction;
  
  // Set environment variables for testing BEFORE any imports
  Object.assign(process.env, dashboardEnv);
  console.log('Loaded environment from env.json:', Object.keys(dashboardEnv));
} catch (error) {
  console.warn('Could not load env.json:', error);
  process.exit(1);
}

// Now import modules after environment is set
import { config } from '../src/config/environment';

console.log('=== Mapbox Configuration Debug ===');

// Check environment variables
console.log('\n1. Environment Variables:');
console.log('STAGE:', process.env.STAGE);
console.log('MAPBOX_ACCESS_TOKEN:', process.env.MAPBOX_ACCESS_TOKEN ? 'SET' : 'NOT SET');
console.log('NODE_ENV:', process.env.NODE_ENV);

// Check config object
console.log('\n2. Config Object:');
console.log('config.STAGE:', config.STAGE);
console.log('config.MAPBOX_ACCESS_TOKEN:', config.MAPBOX_ACCESS_TOKEN ? 'SET' : 'NOT SET');
console.log('Actual config.MAPBOX_ACCESS_TOKEN value:', config.MAPBOX_ACCESS_TOKEN ? config.MAPBOX_ACCESS_TOKEN.substring(0, 10) + '...' : 'undefined');

// Force reload config to see if it picks up the environment variables
console.log('\n2.1. Forcing config reload:');
delete require.cache[require.resolve('../src/config/environment')];
const { getEnvironmentConfig } = require('../src/config/environment');
const reloadedConfig = getEnvironmentConfig();
console.log('reloadedConfig.MAPBOX_ACCESS_TOKEN:', reloadedConfig.MAPBOX_ACCESS_TOKEN ? 'SET' : 'NOT SET');
console.log('Actual reloaded value:', reloadedConfig.MAPBOX_ACCESS_TOKEN ? reloadedConfig.MAPBOX_ACCESS_TOKEN.substring(0, 10) + '...' : 'undefined');

// Test MapboxConfiguration initialization
console.log('\n3. Testing MapboxConfiguration:');
try {
  const { MapboxConfiguration } = require('../src/config/mapbox.config');
  console.log('MapboxConfiguration imported successfully');
  
  try {
    const mapboxConfig = MapboxConfiguration.getInstance();
    console.log('MapboxConfiguration instance created successfully');
    
    try {
      const token = mapboxConfig.getAccessToken();
      console.log('Access token retrieved successfully:', token.substring(0, 10) + '...');
    } catch (error: any) {
      console.error('Error getting access token:', error.message);
    }
  } catch (error: any) {
    console.error('Error creating MapboxConfiguration instance:', error.message);
    console.error('Stack trace:', error.stack);
  }
} catch (error: any) {
  console.error('Error importing MapboxConfiguration:', error.message);
}

// Test map service factory
console.log('\n4. Testing Map Service Factory:');
try {
  const { createMapService } = require('../src/services/map/map.factory');
  console.log('Map service factory imported successfully');
  
  try {
    const mapService = createMapService();
    console.log('Map service created successfully:', mapService.constructor.name);
  } catch (error: any) {
    console.error('Error creating map service:', error.message);
    console.error('Stack trace:', error.stack);
  }
} catch (error: any) {
  console.error('Error importing map service factory:', error.message);
}

// Test goal service initialization
console.log('\n5. Testing Goal Service:');
try {
  const { GoalService } = require('../src/services/goal/goal.service');
  console.log('GoalService imported successfully');
  
  try {
    // Mock prisma for testing
    const mockPrisma = {} as any;
    const goalService = new GoalService(mockPrisma);
    console.log('GoalService created successfully');
  } catch (error: any) {
    console.error('Error creating GoalService:', error.message);
    console.error('Stack trace:', error.stack);
  }
} catch (error: any) {
  console.error('Error importing GoalService:', error.message);
}

console.log('\n=== Debug Complete ===');