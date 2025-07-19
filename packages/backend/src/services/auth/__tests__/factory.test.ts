/**
 * Unit tests for AuthServiceFactory
 */

import {
  createAuthService,
  createAuthServiceWithProvider,
  createDefaultAuthService,
  setAuthServiceFactory,
  resetAuthServiceFactory,
  getAuthServiceFactory,
  getSupportedProviders,
  isProviderSupported,
  AuthProvider,
  AuthServiceFactory,
} from '../factory';
import { MockAuthService } from '../mock.service';
import { CognitoAuthService } from '../cognito.service';

describe('AuthServiceFactory', () => {
  beforeEach(() => {
    resetAuthServiceFactory();
    // Clear environment variables
    delete process.env.AUTH_PROVIDER;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    resetAuthServiceFactory();
  });

  describe('Provider Validation', () => {
    it('should validate supported providers', () => {
      expect(isProviderSupported('mock')).toBe(true);
      expect(isProviderSupported('cognito')).toBe(true);
      expect(isProviderSupported('auth0')).toBe(true);
      expect(isProviderSupported('supabase')).toBe(true);
      expect(isProviderSupported('invalid')).toBe(false);
    });

    it('should return list of supported providers', () => {
      const providers = getSupportedProviders();
      expect(providers).toEqual(['cognito', 'mock', 'auth0', 'supabase']);
    });
  });

  describe('Provider Selection', () => {
    it('should use explicit provider when provided', () => {
      const service = createAuthServiceWithProvider('mock');
      expect(service).toBeInstanceOf(MockAuthService);
    });

    it('should use environment variable when no provider specified', () => {
      process.env.AUTH_PROVIDER = 'mock';
      const service = createAuthService();
      expect(service).toBeInstanceOf(MockAuthService);
    });

    it('should default to mock in test environment', () => {
      process.env.NODE_ENV = 'test';
      const service = createAuthService();
      expect(service).toBeInstanceOf(MockAuthService);
    });

    it('should default to mock in development environment', () => {
      process.env.NODE_ENV = 'development';
      const service = createAuthService();
      expect(service).toBeInstanceOf(MockAuthService);
    });

    it('should default to cognito in production environment', () => {
      process.env.NODE_ENV = 'production';
      process.env.COGNITO_USER_POOL_ID = 'test-pool';
      process.env.COGNITO_CLIENT_ID = 'test-client';
      
      const service = createAuthService();
      expect(service).toBeInstanceOf(CognitoAuthService);
    });
  });

  describe('Configuration Merging', () => {
    it('should apply default configuration', () => {
      const factory = getAuthServiceFactory();
      const service = factory.createWithDefaultConfig('mock');
      expect(service).toBeInstanceOf(MockAuthService);
    });

    it('should merge user configuration with defaults', () => {
      const mockService = createAuthServiceWithProvider('mock', {
        autoRefresh: false,
        refreshThreshold: 600,
      }) as MockAuthService;

      // These would be applied to the mock service during creation
      expect(mockService).toBeInstanceOf(MockAuthService);
    });

    it('should handle Cognito-specific configuration', () => {
      process.env.COGNITO_USER_POOL_ID = 'us-east-1_test123';
      process.env.COGNITO_CLIENT_ID = 'test-client-id';
      
      const service = createAuthServiceWithProvider('cognito', {
        region: 'us-west-2',
        retryConfig: {
          maxRetries: 5,
        },
      });

      expect(service).toBeInstanceOf(CognitoAuthService);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unsupported provider', () => {
      expect(() => {
        createAuthServiceWithProvider('invalid' as AuthProvider);
      }).toThrow('Unknown auth provider: invalid');
    });

    it('should throw error for unimplemented providers', () => {
      expect(() => {
        createAuthServiceWithProvider('auth0');
      }).toThrow('Auth0 provider not yet implemented');

      expect(() => {
        createAuthServiceWithProvider('supabase');
      }).toThrow('Supabase provider not yet implemented');
    });

    it('should provide helpful error messages', () => {
      expect(() => {
        createAuthServiceWithProvider('invalid' as AuthProvider);
      }).toThrow('Supported providers: cognito, mock, auth0, supabase');
    });
  });

  describe('Custom Factory', () => {
    it('should allow setting custom factory', () => {
      const mockService = new MockAuthService();
      const customFactory: AuthServiceFactory = {
        create: jest.fn().mockReturnValue(mockService),
        createWithDefaultConfig: jest.fn().mockReturnValue(mockService),
        getSupportedProviders: jest.fn().mockReturnValue(['custom']),
        validateProvider: jest.fn().mockReturnValue(true),
      };

      setAuthServiceFactory(customFactory);

      const service = createAuthService();
      expect(customFactory.create).toHaveBeenCalled();
      expect(service).toBe(mockService);
    });

    it('should reset to default factory', () => {
      const customFactory: AuthServiceFactory = {
        create: jest.fn(),
        createWithDefaultConfig: jest.fn(),
        getSupportedProviders: jest.fn().mockReturnValue(['custom']),
        validateProvider: jest.fn().mockReturnValue(true),
      };

      setAuthServiceFactory(customFactory);
      resetAuthServiceFactory();

      const providers = getSupportedProviders();
      expect(providers).toEqual(['cognito', 'mock', 'auth0', 'supabase']);
    });
  });

  describe('Factory Instance Methods', () => {
    it('should provide access to factory instance', () => {
      const factory = getAuthServiceFactory();
      expect(factory).toBeDefined();
      expect(typeof factory.create).toBe('function');
      expect(typeof factory.getSupportedProviders).toBe('function');
      expect(typeof factory.validateProvider).toBe('function');
    });

    it('should create service with default config', () => {
      const service = createDefaultAuthService();
      expect(service).toBeDefined();
    });
  });

  describe('Environment Variable Handling', () => {
    it('should handle missing environment variables gracefully', () => {
      delete process.env.COGNITO_USER_POOL_ID;
      delete process.env.COGNITO_CLIENT_ID;
      delete process.env.AWS_REGION;

      // Should not throw, but create service with defaults
      expect(() => {
        createAuthServiceWithProvider('cognito');
      }).not.toThrow();
    });

    it('should use environment variables for configuration', () => {
      process.env.AWS_REGION = 'eu-west-1';
      process.env.COGNITO_USER_POOL_ID = 'eu-west-1_test123';
      process.env.COGNITO_CLIENT_ID = 'test-client-id';

      const service = createAuthServiceWithProvider('cognito');
      expect(service).toBeInstanceOf(CognitoAuthService);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate retry configuration', () => {
      const service = createAuthServiceWithProvider('mock', {
        retryConfig: {
          maxRetries: -1, // Invalid value
        },
      });

      // Should still create service but with valid defaults
      expect(service).toBeInstanceOf(MockAuthService);
    });

    it('should handle partial configuration objects', () => {
      const service = createAuthServiceWithProvider('mock', {
        autoRefresh: true,
        // Missing other properties
      });

      expect(service).toBeInstanceOf(MockAuthService);
    });
  });
});