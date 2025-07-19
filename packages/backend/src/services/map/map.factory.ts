/**
 * Factory for creating MapService instances based on configuration
 */

import { MapService, MapConfig } from './types';
import { MapboxService } from './mapbox.provider';
import { MockMapService } from './mock.provider';

export type MapProvider = 'mapbox' | 'google' | 'mock';

export interface MapServiceFactory {
  create(
    provider?: MapProvider,
    config?: MapConfig
  ): MapService;
}

class DefaultMapServiceFactory implements MapServiceFactory {
  create(
    provider?: MapProvider,
    config?: MapConfig
  ): MapService {
    const mapProvider = provider || (process.env.MAP_PROVIDER as MapProvider) || 'mock';
    const mapConfig: MapConfig = {
      accessToken: process.env.MAPBOX_ACCESS_TOKEN,
      defaultProfile: 'walking',
      language: 'en',
      country: 'US',
      maxWaypoints: 20,
      ...config,
    };

    switch (mapProvider) {
      case 'mapbox':
        return new MapboxService(mapConfig);
      
      case 'google':
        // Placeholder for future Google Maps implementation
        throw new Error('Google Maps provider not yet implemented');
      
      case 'mock':
        return new MockMapService(mapConfig);
      
      default:
        throw new Error(`Unknown map provider: ${mapProvider}`);
    }
  }
}

// Singleton instance
let factory: MapServiceFactory = new DefaultMapServiceFactory();

/**
 * Create a MapService instance based on environment configuration
 */
export function createMapService(config?: MapConfig): MapService {
  return factory.create(undefined, config);
}

/**
 * Create a MapService instance with a specific provider
 */
export function createMapServiceWithProvider(
  provider: MapProvider,
  config?: MapConfig
): MapService {
  return factory.create(provider, config);
}

/**
 * Set a custom factory implementation (useful for testing)
 */
export function setMapServiceFactory(customFactory: MapServiceFactory): void {
  factory = customFactory;
}

/**
 * Reset to the default factory
 */
export function resetMapServiceFactory(): void {
  factory = new DefaultMapServiceFactory();
}