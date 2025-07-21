/**
 * Mapbox health check endpoint
 * Validates Mapbox configuration and connectivity
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { validateMapboxConfiguration, getMapboxConfig } from '../../config/mapbox.config';
import { createMapService } from '../../services/map';
import { logger } from '../../services/logger';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Basic configuration validation
    const configValid = validateMapboxConfiguration();
    
    // Get current configuration (without exposing token)
    const mapboxConfig = getMapboxConfig();
    const config = {
      environment: process.env.STAGE || 'dev',
      hasToken: !!mapboxConfig.getAccessToken(),
      tokenType: mapboxConfig.getAccessToken().startsWith('pk.') ? 'public' : 'secret',
      rateLimits: mapboxConfig.getRateLimits(),
      allowedDomains: mapboxConfig.getAllowedDomains(),
      requiredScopes: mapboxConfig.hasRequiredScopes(),
    };
    
    // Test actual API connectivity
    let apiTest = { success: false, error: null as string | null };
    try {
      const mapService = createMapService();
      const testResults = await mapService.searchAddress('New York', { limit: 1 });
      apiTest.success = testResults.length > 0;
    } catch (error) {
      apiTest.error = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Mapbox API test failed', { error });
    }
    
    const isHealthy = configValid && apiTest.success;
    
    return {
      statusCode: isHealthy ? 200 : 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      },
      body: JSON.stringify({
        service: 'mapbox',
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        configuration: config,
        apiTest,
        details: {
          configurationValid: configValid,
          apiConnectivity: apiTest.success,
          provider: process.env.MAP_PROVIDER || 'mock',
        },
      }),
    };
  } catch (error) {
    logger.error('Mapbox health check failed', { error });
    
    return {
      statusCode: 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      },
      body: JSON.stringify({
        service: 'mapbox',
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Health check failed',
      }),
    };
  }
}