/**
 * Auth service exports
 */

import { createAuthService as factoryCreateAuthService } from './factory';

export * from './types';
export * from './factory';
export { MockAuthService } from './mock.service';

// Convenience function for creating auth service instances
export function getAuthService() {
  return factoryCreateAuthService();
}