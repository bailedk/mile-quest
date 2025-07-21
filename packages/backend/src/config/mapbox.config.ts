/**
 * Mapbox configuration and token management
 * Handles environment-specific access tokens and security settings
 */

import { config } from './environment';

export interface MapboxTokenConfig {
  // Access tokens for different environments
  development?: string;
  staging?: string;
  production?: string;
  
  // Domain restrictions
  allowedDomains?: string[];
  
  // Token scopes
  scopes?: MapboxTokenScope[];
  
  // Rate limiting
  requestsPerMinute?: number;
  requestsPerDay?: number;
}

export enum MapboxTokenScope {
  // Read scopes
  STYLES_READ = 'styles:read',
  TILES_READ = 'tiles:read',
  DATASETS_READ = 'datasets:read',
  
  // Write scopes (not needed for Mile Quest)
  STYLES_WRITE = 'styles:write',
  DATASETS_WRITE = 'datasets:write',
  
  // Service scopes
  GEOCODING = 'geocoding',
  DIRECTIONS = 'directions',
  OPTIMIZATION = 'optimization',
  STATIC_IMAGES = 'static',
}

export class MapboxConfiguration {
  private static instance: MapboxConfiguration;
  private tokenConfig: MapboxTokenConfig;
  
  private constructor() {
    this.tokenConfig = this.loadTokenConfiguration();
    this.validateConfiguration();
  }
  
  static getInstance(): MapboxConfiguration {
    if (!MapboxConfiguration.instance) {
      MapboxConfiguration.instance = new MapboxConfiguration();
    }
    return MapboxConfiguration.instance;
  }
  
  /**
   * Get the access token for the current environment
   */
  getAccessToken(): string {
    const stage = config.STAGE;
    
    // Use environment-specific token
    const token = this.tokenConfig[stage];
    
    if (!token) {
      throw new Error(`No Mapbox access token configured for environment: ${stage}`);
    }
    
    return token;
  }
  
  /**
   * Get domain restrictions for the current environment
   */
  getAllowedDomains(): string[] {
    return this.tokenConfig.allowedDomains || [];
  }
  
  /**
   * Get rate limit configuration
   */
  getRateLimits() {
    return {
      perMinute: this.tokenConfig.requestsPerMinute || 600, // Mapbox default
      perDay: this.tokenConfig.requestsPerDay || 100000, // Mapbox default
    };
  }
  
  /**
   * Validate token has required scopes
   */
  hasRequiredScopes(): boolean {
    const requiredScopes = [
      MapboxTokenScope.GEOCODING,
      MapboxTokenScope.DIRECTIONS,
      MapboxTokenScope.OPTIMIZATION,
      MapboxTokenScope.TILES_READ,
    ];
    
    const configuredScopes = this.tokenConfig.scopes || [];
    
    return requiredScopes.every(scope => 
      configuredScopes.includes(scope)
    );
  }
  
  /**
   * Load token configuration from environment
   */
  private loadTokenConfiguration(): MapboxTokenConfig {
    const stage = config.STAGE;
    
    // Load tokens from environment variables
    const tokenConfig: MapboxTokenConfig = {
      development: process.env.MAPBOX_TOKEN_DEV || config.MAPBOX_ACCESS_TOKEN,
      staging: process.env.MAPBOX_TOKEN_STAGING || config.MAPBOX_ACCESS_TOKEN,
      production: process.env.MAPBOX_TOKEN_PROD || config.MAPBOX_ACCESS_TOKEN,
      scopes: this.parseScopes(process.env.MAPBOX_SCOPES),
      requestsPerMinute: parseInt(process.env.MAPBOX_RATE_LIMIT_PER_MINUTE || '600'),
      requestsPerDay: parseInt(process.env.MAPBOX_RATE_LIMIT_PER_DAY || '100000'),
    };
    
    // Set domain restrictions based on environment
    switch (stage) {
      case 'production':
        tokenConfig.allowedDomains = [
          'https://milequest.app',
          'https://www.milequest.app',
          'https://api.milequest.app',
        ];
        break;
      case 'staging':
        tokenConfig.allowedDomains = [
          'https://staging.milequest.app',
          'https://api-staging.milequest.app',
        ];
        break;
      case 'dev':
      default:
        tokenConfig.allowedDomains = [
          'http://localhost:3000',
          'http://localhost:3001',
          'https://dev.milequest.app',
        ];
        break;
    }
    
    // Override with explicit domain list if provided
    if (process.env.MAPBOX_ALLOWED_DOMAINS) {
      tokenConfig.allowedDomains = process.env.MAPBOX_ALLOWED_DOMAINS.split(',');
    }
    
    return tokenConfig;
  }
  
  /**
   * Parse scope string into enum values
   */
  private parseScopes(scopesString?: string): MapboxTokenScope[] {
    if (!scopesString) {
      // Default scopes for Mile Quest
      return [
        MapboxTokenScope.GEOCODING,
        MapboxTokenScope.DIRECTIONS,
        MapboxTokenScope.OPTIMIZATION,
        MapboxTokenScope.TILES_READ,
        MapboxTokenScope.STYLES_READ,
      ];
    }
    
    return scopesString.split(',').map(scope => 
      scope.trim() as MapboxTokenScope
    );
  }
  
  /**
   * Validate the configuration on startup
   */
  private validateConfiguration(): void {
    const token = this.getAccessToken();
    
    // Basic token format validation
    if (!token.startsWith('pk.') && !token.startsWith('sk.')) {
      throw new Error('Invalid Mapbox token format. Token should start with pk. or sk.');
    }
    
    // Check for public token in production
    if (config.STAGE === 'production' && token.startsWith('pk.')) {
      console.warn(
        'WARNING: Using public Mapbox token in production. ' +
        'Consider using a secret token (sk.) with domain restrictions.'
      );
    }
    
    // Validate scopes
    if (!this.hasRequiredScopes()) {
      console.warn(
        'WARNING: Mapbox token may not have all required scopes. ' +
        'Ensure token has: geocoding, directions, optimization, tiles:read'
      );
    }
    
    // Log configuration (without exposing token)
    console.log('Mapbox configuration loaded:', {
      environment: config.STAGE,
      tokenType: token.startsWith('pk.') ? 'public' : 'secret',
      allowedDomains: this.getAllowedDomains(),
      rateLimits: this.getRateLimits(),
    });
  }
}

// Export singleton instance
export const mapboxConfig = MapboxConfiguration.getInstance();

// Export helper function for easy access
export function getMapboxToken(): string {
  return mapboxConfig.getAccessToken();
}

// Export validation function for health checks
export function validateMapboxConfiguration(): boolean {
  try {
    const config = MapboxConfiguration.getInstance();
    return config.hasRequiredScopes();
  } catch (error) {
    console.error('Mapbox configuration validation failed:', error);
    return false;
  }
}