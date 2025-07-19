/**
 * Tests for Map Service Factory
 */

// Mock Mapbox SDK before imports
jest.mock('@mapbox/mapbox-sdk', () => ({
  __esModule: true,
  default: jest.fn(() => ({})),
}));

jest.mock('@mapbox/mapbox-sdk/services/geocoding', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    forwardGeocode: jest.fn(),
    reverseGeocode: jest.fn(),
  })),
}));

jest.mock('@mapbox/mapbox-sdk/services/directions', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    getDirections: jest.fn(),
  })),
}));

jest.mock('@mapbox/mapbox-sdk/services/optimization', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    getOptimization: jest.fn(),
  })),
}));

import { 
  createMapService,
  createMapServiceWithProvider,
  setMapServiceFactory,
  resetMapServiceFactory,
  MapProvider,
} from '../map.factory';
import { MapService, MapConfig } from '../types';
import { MockMapService } from '../mock.provider';
import { MapboxService } from '../mapbox.provider';

describe('MapServiceFactory', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
    resetMapServiceFactory();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('createMapService', () => {
    it('should create mock service by default', () => {
      delete process.env.MAP_PROVIDER;
      const service = createMapService();
      expect(service).toBeInstanceOf(MockMapService);
    });

    it('should create mock service when explicitly configured', () => {
      process.env.MAP_PROVIDER = 'mock';
      const service = createMapService();
      expect(service).toBeInstanceOf(MockMapService);
    });

    it('should create mapbox service when configured', () => {
      process.env.MAP_PROVIDER = 'mapbox';
      process.env.MAPBOX_ACCESS_TOKEN = 'pk.test-token-1234567890abcdef1234567890abcdef';
      const service = createMapService();
      expect(service).toBeInstanceOf(MapboxService);
    });

    it('should throw error for mapbox without token', () => {
      process.env.MAP_PROVIDER = 'mapbox';
      delete process.env.MAPBOX_ACCESS_TOKEN;
      expect(() => createMapService()).toThrow('Mapbox access token is required');
    });

    it('should pass config to service', () => {
      const config: MapConfig = {
        defaultProfile: 'cycling',
        maxWaypoints: 10,
      };
      const service = createMapService(config);
      expect(service).toBeDefined();
    });
  });

  describe('createMapServiceWithProvider', () => {
    it('should create specified provider', () => {
      const service = createMapServiceWithProvider('mock');
      expect(service).toBeInstanceOf(MockMapService);
    });

    it('should throw error for unsupported provider', () => {
      expect(() => createMapServiceWithProvider('unsupported' as MapProvider))
        .toThrow('Unknown map provider: unsupported');
    });

    it('should throw error for unimplemented google provider', () => {
      expect(() => createMapServiceWithProvider('google'))
        .toThrow('Google Maps provider not yet implemented');
    });
  });

  describe('custom factory', () => {
    it('should use custom factory when set', () => {
      const mockService = new MockMapService();
      const customFactory = {
        create: jest.fn(() => mockService),
      };

      setMapServiceFactory(customFactory);
      const service = createMapService();

      expect(customFactory.create).toHaveBeenCalled();
      expect(service).toBe(mockService);
    });

    it('should reset to default factory', () => {
      const customFactory = {
        create: jest.fn(() => new MockMapService()),
      };

      setMapServiceFactory(customFactory);
      resetMapServiceFactory();
      
      const service = createMapService();
      expect(customFactory.create).not.toHaveBeenCalled();
      expect(service).toBeInstanceOf(MockMapService);
    });
  });
});