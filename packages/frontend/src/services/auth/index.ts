import { AuthService } from './types';
import { CognitoAuthService } from './cognito.service';
import { MockAuthService } from './mock.service';

let authService: AuthService | null = null;

export function getAuthService(): AuthService {
  if (!authService) {
    // Use mock service in development if no Cognito config is provided
    const useMock = process.env.NODE_ENV === 'development' && (
      !process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ||
      !process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID
    );
    
    if (useMock) {
      console.log('Using mock auth service for local development');
      authService = new MockAuthService();
    } else {
      authService = new CognitoAuthService();
    }
  }
  return authService;
}

export * from './types';
export { CognitoAuthService } from './cognito.service';
export { MockAuthService } from './mock.service';