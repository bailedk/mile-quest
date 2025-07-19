import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { AuthUser, AuthTokens } from '@mile-quest/shared';
import { AuthService, AuthResult, AuthSession, AuthError } from './types';

const USER_POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!;
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!;

export class CognitoAuthService implements AuthService {
  private userPool: CognitoUserPool;
  private currentUser: CognitoUser | null = null;

  constructor() {
    this.userPool = new CognitoUserPool({
      UserPoolId: USER_POOL_ID,
      ClientId: CLIENT_ID,
    });
    
    // Check for existing user session
    this.currentUser = this.userPool.getCurrentUser();
  }

  async signUp(email: string, password: string, name: string, metadata?: Record<string, string>): Promise<void> {
    const attributes = [
      new CognitoUserAttribute({ Name: 'email', Value: email }),
      new CognitoUserAttribute({ Name: 'name', Value: name }),
    ];

    if (metadata?.preferredUnits) {
      attributes.push(new CognitoUserAttribute({ Name: 'custom:preferred_units', Value: metadata.preferredUnits }));
    }
    if (metadata?.timezone) {
      attributes.push(new CognitoUserAttribute({ Name: 'custom:timezone', Value: metadata.timezone }));
    }

    return new Promise((resolve, reject) => {
      this.userPool.signUp(email, password, attributes, [], (err, result) => {
        if (err) {
          reject(this.mapCognitoError(err));
          return;
        }
        resolve();
      });
    });
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    const authenticationDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: this.userPool,
    });

    return new Promise((resolve, reject) => {
      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: async (session) => {
          this.currentUser = cognitoUser;
          const user = await this.mapCognitoUser(cognitoUser, session);
          const tokens = this.mapCognitoTokens(session);
          resolve({ user, tokens });
        },
        onFailure: (err) => {
          reject(this.mapCognitoError(err));
        },
      });
    });
  }

  async signOut(): Promise<void> {
    if (this.currentUser) {
      this.currentUser.signOut();
      this.currentUser = null;
    }
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    if (!this.currentUser) return null;

    return new Promise((resolve, reject) => {
      this.currentUser!.getSession((err: any, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          resolve(null);
          return;
        }

        this.mapCognitoUser(this.currentUser!, session)
          .then(resolve)
          .catch(reject);
      });
    });
  }

  async getSession(): Promise<AuthSession | null> {
    if (!this.currentUser) return null;

    return new Promise((resolve, reject) => {
      this.currentUser!.getSession((err: any, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          resolve(null);
          return;
        }

        this.mapCognitoUser(this.currentUser!, session)
          .then((user) => {
            const tokens = this.mapCognitoTokens(session);
            const expiresAt = new Date(session.getIdToken().getExpiration() * 1000);
            resolve({ user, tokens, expiresAt });
          })
          .catch(reject);
      });
    });
  }

  async refreshSession(): Promise<AuthTokens> {
    if (!this.currentUser) {
      throw this.createAuthError('NO_USER', 'No authenticated user');
    }

    return new Promise((resolve, reject) => {
      this.currentUser!.getSession((err: any, session: CognitoUserSession | null) => {
        if (err || !session) {
          reject(this.mapCognitoError(err));
          return;
        }

        const refreshToken = session.getRefreshToken();
        this.currentUser!.refreshSession(refreshToken, (err, newSession) => {
          if (err) {
            reject(this.mapCognitoError(err));
            return;
          }
          resolve(this.mapCognitoTokens(newSession));
        });
      });
    });
  }

  async verifyEmail(email: string, code: string): Promise<void> {
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: this.userPool,
    });

    return new Promise((resolve, reject) => {
      cognitoUser.confirmRegistration(code, true, (err) => {
        if (err) {
          reject(this.mapCognitoError(err));
          return;
        }
        resolve();
      });
    });
  }

  async resendVerificationCode(email: string): Promise<void> {
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: this.userPool,
    });

    return new Promise((resolve, reject) => {
      cognitoUser.resendConfirmationCode((err) => {
        if (err) {
          reject(this.mapCognitoError(err));
          return;
        }
        resolve();
      });
    });
  }

  async forgotPassword(email: string): Promise<void> {
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: this.userPool,
    });

    return new Promise((resolve, reject) => {
      cognitoUser.forgotPassword({
        onSuccess: () => resolve(),
        onFailure: (err) => reject(this.mapCognitoError(err)),
      });
    });
  }

  async confirmPassword(email: string, code: string, newPassword: string): Promise<void> {
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: this.userPool,
    });

    return new Promise((resolve, reject) => {
      cognitoUser.confirmPassword(code, newPassword, {
        onSuccess: () => resolve(),
        onFailure: (err) => reject(this.mapCognitoError(err)),
      });
    });
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    if (!this.currentUser) {
      throw this.createAuthError('NO_USER', 'No authenticated user');
    }

    return new Promise((resolve, reject) => {
      this.currentUser!.changePassword(oldPassword, newPassword, (err) => {
        if (err) {
          reject(this.mapCognitoError(err));
          return;
        }
        resolve();
      });
    });
  }

  async getAccessToken(): Promise<string | null> {
    // Import dynamically to avoid circular dependency
    const { useAuthStore } = await import('@/store/auth.store');
    const tokens = useAuthStore.getState().tokens;
    return tokens?.accessToken || null;
  }

  async getIdToken(): Promise<string | null> {
    // Import dynamically to avoid circular dependency
    const { useAuthStore } = await import('@/store/auth.store');
    const tokens = useAuthStore.getState().tokens;
    return tokens?.idToken || null;
  }

  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return session !== null;
  }

  private async mapCognitoUser(cognitoUser: CognitoUser, session: CognitoUserSession): Promise<AuthUser> {
    return new Promise((resolve, reject) => {
      cognitoUser.getUserAttributes((err, attributes) => {
        if (err) {
          reject(this.mapCognitoError(err));
          return;
        }

        const attrMap = attributes?.reduce((acc, attr) => {
          acc[attr.Name] = attr.Value;
          return acc;
        }, {} as Record<string, string>) || {};

        const user: AuthUser = {
          id: attrMap.sub,
          email: attrMap.email,
          name: attrMap.name || '',
          emailVerified: attrMap.email_verified === 'true',
          preferredUnits: (attrMap['custom:preferred_units'] as 'miles' | 'kilometers') || 'miles',
          timezone: attrMap['custom:timezone'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        resolve(user);
      });
    });
  }

  private mapCognitoTokens(session: CognitoUserSession): AuthTokens {
    return {
      accessToken: session.getAccessToken().getJwtToken(),
      refreshToken: session.getRefreshToken().getToken(),
      idToken: session.getIdToken().getJwtToken(),
      expiresIn: session.getIdToken().getExpiration() - Math.floor(Date.now() / 1000),
      tokenType: 'Bearer',
    };
  }

  private mapCognitoError(err: any): AuthError {
    const error: AuthError = new Error(err.message) as AuthError;
    error.code = err.code || 'UNKNOWN_ERROR';
    error.name = 'AuthError';
    
    // Map common Cognito errors to HTTP status codes
    const statusCodeMap: Record<string, number> = {
      'UserNotFoundException': 404,
      'NotAuthorizedException': 401,
      'UserNotConfirmedException': 403,
      'UsernameExistsException': 409,
      'InvalidParameterException': 400,
      'InvalidPasswordException': 400,
      'TooManyRequestsException': 429,
    };
    
    error.statusCode = statusCodeMap[error.code] || 500;
    return error;
  }

  private createAuthError(code: string, message: string, statusCode = 400): AuthError {
    const error: AuthError = new Error(message) as AuthError;
    error.code = code;
    error.statusCode = statusCode;
    error.name = 'AuthError';
    return error;
  }
}