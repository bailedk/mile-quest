/**
 * Shared authentication helper functions
 * Extracted from handlers to reduce code duplication
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { verifyToken } from './jwt.utils';
import { UnauthorizedError } from '../api-response';
import { AuthUser } from '@mile-quest/shared';

/**
 * Extract and verify user from API Gateway event
 * This is the standard way to get authenticated user info from a request
 */
export function getUserFromEvent(event: APIGatewayProxyEvent): AuthUser {
  const authHeader = event.headers.Authorization || event.headers.authorization;
  const token = authHeader?.split(' ')[1];
  
  if (!token) {
    throw new UnauthorizedError('No token provided');
  }
  
  const tokenPayload = verifyToken(token);
  
  // Convert token payload to AuthUser format
  return {
    id: tokenPayload.sub,
    email: tokenPayload.email,
    name: tokenPayload.name,
    // Add other fields as needed from your token structure
  } as AuthUser;
}

/**
 * Extract user ID from API Gateway event
 * Simpler version that just returns the user ID
 */
export function getUserIdFromEvent(event: APIGatewayProxyEvent): string {
  const user = getUserFromEvent(event);
  return user.id;
}

/**
 * Check if user has a specific role in the token claims
 * Note: This assumes roles are stored in token claims
 */
export function userHasRole(event: APIGatewayProxyEvent, role: string): boolean {
  try {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    const token = authHeader?.split(' ')[1];
    
    if (!token) {
      return false;
    }
    
    // This would need to be extended based on how roles are stored in your tokens
    const tokenPayload = verifyToken(token);
    // Example: check if roles array contains the role
    // return tokenPayload.roles?.includes(role) || false;
    
    // For now, return false as we don't have role implementation
    return false;
  } catch {
    return false;
  }
}

/**
 * Extract optional user from event (doesn't throw if no token)
 * Useful for endpoints that support both authenticated and anonymous access
 */
export function getOptionalUserFromEvent(event: APIGatewayProxyEvent): AuthUser | null {
  try {
    return getUserFromEvent(event);
  } catch {
    return null;
  }
}