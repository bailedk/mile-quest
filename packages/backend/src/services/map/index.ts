/**
 * Map service exports
 */

export * from './types';
export * from './map.factory';
export * from './distance-utils';

// Re-export convenience functions
export {
  createMapService,
  createMapServiceWithProvider,
  setMapServiceFactory,
  resetMapServiceFactory,
} from './map.factory';

// Export providers for direct usage (testing)
export { MapboxService } from './mapbox.provider';
export { MockMapService } from './mock.provider';