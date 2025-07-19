import { AuthService } from './types';
import { CognitoAuthService } from './cognito.service';

let authService: AuthService | null = null;

export function getAuthService(): AuthService {
  if (!authService) {
    authService = new CognitoAuthService();
  }
  return authService;
}

export * from './types';
export { CognitoAuthService } from './cognito.service';