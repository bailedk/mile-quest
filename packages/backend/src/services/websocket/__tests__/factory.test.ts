/**
 * WebSocket Service Factory Tests
 * Tests for enhanced factory functionality and configuration
 */

import {
  createWebSocketService,
  createWebSocketServiceWithProvider,
  createProductionWebSocketService,
  createTestWebSocketService,
  setWebSocketServiceFactory,
  resetWebSocketServiceFactory,
} from '../factory';
import { PusherWebSocketService } from '../pusher.service';
import { MockWebSocketService } from '../mock.service';

// Mock the services to avoid actual network calls
jest.mock('../pusher.service');
jest.mock('../mock.service');

describe('WebSocket Service Factory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetWebSocketServiceFactory();
    
    // Clear environment variables
    delete process.env.WEBSOCKET_PROVIDER;
    delete process.env.NODE_ENV;
  });

  describe('Provider Selection', () => {
    it('should create Pusher service by default', () => {
      const service = createWebSocketService();
      
      expect(PusherWebSocketService).toHaveBeenCalledTimes(1);
      expect(service).toBeDefined();
    });

    it('should create service based on environment variable', () => {
      process.env.WEBSOCKET_PROVIDER = 'mock';
      
      const service = createWebSocketService();
      
      expect(MockWebSocketService).toHaveBeenCalledTimes(1);
      expect(service).toBeDefined();
    });

    it('should create service with specific provider', () => {
      const service = createWebSocketServiceWithProvider('mock');
      
      expect(MockWebSocketService).toHaveBeenCalledTimes(1);
      expect(service).toBeDefined();
    });

    it('should throw error for unsupported provider', () => {
      expect(() => createWebSocketServiceWithProvider('apigateway' as any))
        .toThrow('API Gateway WebSocket provider not yet implemented');
    });

    it('should throw error for unknown provider', () => {
      expect(() => createWebSocketServiceWithProvider('unknown' as any))
        .toThrow('Unknown WebSocket provider: unknown');
    });
  });

  describe('Configuration Defaults', () => {
    it('should apply production defaults in production environment', () => {
      process.env.NODE_ENV = 'production';
      
      const service = createWebSocketService();
      
      expect(PusherWebSocketService).toHaveBeenCalledWith(
        expect.objectContaining({
          enableRetries: true,
          maxRetries: 5,
          heartbeatInterval: 60000,
          enableConnectionMonitoring: true,
        }),
        undefined
      );
    });

    it('should apply development defaults in development environment', () => {
      process.env.NODE_ENV = 'development';
      
      const service = createWebSocketService();
      
      expect(PusherWebSocketService).toHaveBeenCalledWith(
        expect.objectContaining({
          enableRetries: false,
          maxRetries: 3,
          heartbeatInterval: 30000,
        }),
        undefined
      );
    });

    it('should apply test defaults in test environment', () => {
      process.env.NODE_ENV = 'test';
      
      const service = createWebSocketService();
      
      expect(PusherWebSocketService).toHaveBeenCalledWith(
        expect.objectContaining({
          enableConnectionMonitoring: false,
          enableMetrics: false,
          enableSimulatedLatency: true,
          maxLatency: 100,
        }),
        undefined
      );
    });

    it('should override defaults with provided config', () => {
      const config = {
        enableRetries: false,
        maxRetries: 10,
        heartbeatInterval: 5000,
      };
      
      const service = createWebSocketService(config);
      
      expect(PusherWebSocketService).toHaveBeenCalledWith(
        expect.objectContaining(config),
        undefined
      );
    });
  });

  describe('Mock Service Configuration', () => {
    it('should pass mock-specific configuration to MockWebSocketService', () => {
      const service = createWebSocketServiceWithProvider('mock', {
        enableSimulatedLatency: true,
        failureRate: 0.1,
        maxLatency: 500,
      });
      
      expect(MockWebSocketService).toHaveBeenCalledWith({
        enableSimulatedLatency: true,
        enableConnectionSimulation: true,
        enableRandomFailures: false,
        failureRate: 0.1,
        maxLatency: 500,
        enableMetrics: true,
      });
    });

    it('should disable retries for mock service by default', () => {
      const service = createWebSocketServiceWithProvider('mock');
      
      // First argument should contain config with enableRetries: false
      const [mockConfig] = (MockWebSocketService as jest.Mock).mock.calls[0];
      expect(mockConfig).toBeDefined();
    });
  });

  describe('Production Service Factory', () => {
    it('should create production-optimized service', () => {
      const service = createProductionWebSocketService();
      
      expect(PusherWebSocketService).toHaveBeenCalledWith(
        expect.objectContaining({
          enableRetries: true,
          maxRetries: 5,
          retryBaseDelay: 1000,
          connectionTimeout: 30000,
          heartbeatInterval: 60000,
          enableConnectionMonitoring: true,
          batchSize: 10,
          encrypted: true,
        }),
        undefined
      );
    });

    it('should allow overriding production defaults', () => {
      const overrides = {
        maxRetries: 10,
        heartbeatInterval: 120000,
      };
      
      const service = createProductionWebSocketService('pusher', overrides);
      
      expect(PusherWebSocketService).toHaveBeenCalledWith(
        expect.objectContaining(overrides),
        undefined
      );
    });

    it('should create production service with different provider', () => {
      const service = createProductionWebSocketService('mock');
      
      expect(MockWebSocketService).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test Service Factory', () => {
    it('should create test-optimized mock service', () => {
      const service = createTestWebSocketService();
      
      expect(MockWebSocketService).toHaveBeenCalledWith({
        enableSimulatedLatency: true,
        enableConnectionSimulation: true,
        enableRandomFailures: false,
        failureRate: 0,
        maxLatency: 50,
        enableMetrics: true,
      });
    });

    it('should allow overriding test defaults', () => {
      const overrides = {
        enableRandomFailures: true,
        failureRate: 0.2,
        maxLatency: 100,
      };
      
      const service = createTestWebSocketService(overrides);
      
      expect(MockWebSocketService).toHaveBeenCalledWith(
        expect.objectContaining(overrides)
      );
    });
  });

  describe('Custom Factory', () => {
    it('should allow setting custom factory', () => {
      const customFactory = {
        create: jest.fn().mockReturnValue(new MockWebSocketService()),
      };
      
      setWebSocketServiceFactory(customFactory);
      
      const service = createWebSocketService();
      
      expect(customFactory.create).toHaveBeenCalledTimes(1);
      expect(PusherWebSocketService).not.toHaveBeenCalled();
    });

    it('should reset to default factory', () => {
      const customFactory = {
        create: jest.fn().mockReturnValue(new MockWebSocketService()),
      };
      
      setWebSocketServiceFactory(customFactory);
      resetWebSocketServiceFactory();
      
      const service = createWebSocketService();
      
      expect(customFactory.create).not.toHaveBeenCalled();
      expect(PusherWebSocketService).toHaveBeenCalledTimes(1);
    });
  });

  describe('Metrics Integration', () => {
    it('should pass metrics instance to service', () => {
      const metrics = {
        recordSuccess: jest.fn(),
        recordError: jest.fn(),
        recordMetric: jest.fn(),
      };
      
      const service = createWebSocketService({}, metrics);
      
      expect(PusherWebSocketService).toHaveBeenCalledWith(
        expect.any(Object),
        metrics
      );
    });

    it('should pass metrics to production service', () => {
      const metrics = {
        recordSuccess: jest.fn(),
        recordError: jest.fn(),
        recordMetric: jest.fn(),
      };
      
      const service = createProductionWebSocketService('pusher', {}, metrics);
      
      expect(PusherWebSocketService).toHaveBeenCalledWith(
        expect.any(Object),
        metrics
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle missing environment configuration gracefully', () => {
      // Clear all environment variables
      delete process.env.WEBSOCKET_PROVIDER;
      delete process.env.NODE_ENV;
      
      const service = createWebSocketService();
      
      // Should still create a service with defaults
      expect(PusherWebSocketService).toHaveBeenCalledTimes(1);
    });

    it('should handle invalid environment provider gracefully', () => {
      process.env.WEBSOCKET_PROVIDER = 'invalid';
      
      expect(() => createWebSocketService())
        .toThrow('Unknown WebSocket provider: invalid');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate configuration object structure', () => {
      const config = {
        enableRetries: true,
        maxRetries: 5,
        connectionTimeout: 30000,
        // WebSocket specific
        appId: 'test-app',
        key: 'test-key',
        secret: 'test-secret',
        cluster: 'us2',
        // AWS service config
        region: 'us-east-1',
      };
      
      const service = createWebSocketService(config);
      
      expect(PusherWebSocketService).toHaveBeenCalledWith(
        expect.objectContaining(config),
        undefined
      );
    });

    it('should handle partial configuration objects', () => {
      const config = {
        enableRetries: true,
        // Missing other optional fields
      };
      
      const service = createWebSocketService(config);
      
      expect(PusherWebSocketService).toHaveBeenCalledWith(
        expect.objectContaining({
          enableRetries: true,
          // Should include defaults for missing fields
          maxRetries: expect.any(Number),
          connectionTimeout: expect.any(Number),
        }),
        undefined
      );
    });
  });
});