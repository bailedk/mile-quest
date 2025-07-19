/**
 * AWS Cognito implementation of the AuthService interface
 */

import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  AdminSetUserPasswordCommand,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  ChangePasswordCommand,
  ResendConfirmationCodeCommand,
  GetUserCommand,
  DeleteUserCommand,
  UpdateUserAttributesCommand,
  AdminInitiateAuthCommand,
  AttributeType,
} from '@aws-sdk/client-cognito-identity-provider';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { RetryHandler, RetryConfigs } from '../aws/retry-handler';
import { BaseAWSService, ServiceConfig, ServiceMetrics } from '../aws/base-service';
import {
  AuthService,
  AuthUser,
  AuthSession,
  SignUpParams,
  ConfirmSignUpParams,
  SignInParams,
  ForgotPasswordParams,
  ResetPasswordParams,
  ChangePasswordParams,
  UpdateUserAttributesParams,
  AuthConfig,
  AuthError,
  AuthErrorCode,
} from './types';

export class CognitoAuthService extends BaseAWSService implements AuthService {
  private client: CognitoIdentityProviderClient;
  private userPoolId: string;
  private clientId: string;
  private jwtVerifier: any;
  private currentSession: AuthSession | null = null;
  private retryHandler: RetryHandler;

  constructor(config?: AuthConfig & ServiceConfig, metrics?: ServiceMetrics) {
    super('CognitoAuth', config, metrics);
    
    this.userPoolId = config?.userPoolId || this.getEnvVar('COGNITO_USER_POOL_ID');
    this.clientId = config?.clientId || this.getEnvVar('COGNITO_CLIENT_ID');
    
    this.client = new CognitoIdentityProviderClient({
      region: this.config.region,
      endpoint: this.config.endpoint,
      credentials: this.config.credentials,
    });

    // Initialize JWT verifier
    this.jwtVerifier = CognitoJwtVerifier.create({
      userPoolId: this.userPoolId,
      tokenUse: 'id',
      clientId: this.clientId,
    });

    // Initialize retry handler with auth-specific configuration
    this.retryHandler = new RetryHandler({
      ...RetryConfigs.auth,
      ...(config?.retryConfig || {}),
    });

    this.validateConfig();
  }

  async signIn({ email, password }: SignInParams): Promise<AuthSession> {
    return this.executeWithMetrics('signIn', async () => {
      return this.retryHandler.execute(async () => {
        const response = await this.client.send(
          new InitiateAuthCommand({
            ClientId: this.clientId,
            AuthFlow: 'USER_PASSWORD_AUTH',
            AuthParameters: {
              USERNAME: email,
              PASSWORD: password,
            },
          })
        );

        if (!response.AuthenticationResult) {
          throw new AuthError('Authentication failed', AuthErrorCode.INVALID_CREDENTIALS);
        }

        return this.createSessionFromTokens(response.AuthenticationResult);
      });
    });
  }

  async signInWithGoogle(): Promise<AuthSession> {
    // This would typically redirect to Cognito's hosted UI
    // Implementation depends on frontend integration
    throw new Error('Google sign-in must be initiated from the frontend');
  }

  async signOut(): Promise<void> {
    return this.executeWithMetrics('signOut', async () => {
      this.currentSession = null;
      // Additional cleanup if needed
    });
  }

  async signUp({ email, password, name, attributes }: SignUpParams): Promise<AuthUser> {
    return this.executeWithMetrics('signUp', async () => {
      return this.retryHandler.execute(async () => {
        const userAttributes: AttributeType[] = [
          { Name: 'email', Value: email },
          { Name: 'name', Value: name },
        ];

        if (attributes) {
          Object.entries(attributes).forEach(([key, value]) => {
            userAttributes.push({ Name: key, Value: String(value) });
          });
        }

        const response = await this.client.send(
          new SignUpCommand({
            ClientId: this.clientId,
            Username: email,
            Password: password,
            UserAttributes: userAttributes,
          })
        );

        return {
          id: response.UserSub!,
          email,
          name,
          emailVerified: false,
          createdAt: new Date(),
          attributes,
        };
      });
    });
  }

  async confirmSignUp({ email, code }: ConfirmSignUpParams): Promise<void> {
    return this.executeWithMetrics('confirmSignUp', async () => {
      return this.retryHandler.execute(async () => {
        await this.client.send(
          new ConfirmSignUpCommand({
            ClientId: this.clientId,
            Username: email,
            ConfirmationCode: code,
          })
        );
      });
    });
  }

  async resendConfirmationCode(email: string): Promise<void> {
    return this.executeWithMetrics('resendConfirmationCode', async () => {
      return this.retryHandler.execute(async () => {
        await this.client.send(
          new ResendConfirmationCodeCommand({
            ClientId: this.clientId,
            Username: email,
          })
        );
      });
    });
  }

  async forgotPassword({ email }: ForgotPasswordParams): Promise<void> {
    return this.executeWithMetrics('forgotPassword', async () => {
      return this.retryHandler.execute(async () => {
        await this.client.send(
          new ForgotPasswordCommand({
            ClientId: this.clientId,
            Username: email,
          })
        );
      });
    });
  }

  async resetPassword({ email, code, newPassword }: ResetPasswordParams): Promise<void> {
    return this.executeWithMetrics('resetPassword', async () => {
      return this.retryHandler.execute(async () => {
        await this.client.send(
          new ConfirmForgotPasswordCommand({
            ClientId: this.clientId,
            Username: email,
            ConfirmationCode: code,
            Password: newPassword,
          })
        );
      });
    });
  }

  async changePassword({ oldPassword, newPassword }: ChangePasswordParams): Promise<void> {
    return this.executeWithMetrics('changePassword', async () => {
      const accessToken = await this.getAccessToken();
      
      return this.retryHandler.execute(async () => {
        await this.client.send(
          new ChangePasswordCommand({
            AccessToken: accessToken,
            PreviousPassword: oldPassword,
            ProposedPassword: newPassword,
          })
        );
      });
    });
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    return this.executeWithMetrics('getCurrentUser', async () => {
      if (!this.currentSession) {
        return null;
      }

      try {
        const response = await this.client.send(
          new GetUserCommand({
            AccessToken: this.currentSession.accessToken,
          })
        );

        return this.mapCognitoUser(response);
      } catch (error) {
        if (this.isTokenExpiredError(error)) {
          this.currentSession = null;
          return null;
        }
        throw this.mapError(error);
      }
    });
  }

  async getSession(): Promise<AuthSession | null> {
    return this.currentSession;
  }

  async refreshSession(): Promise<AuthSession> {
    return this.executeWithMetrics('refreshSession', async () => {
      if (!this.currentSession?.refreshToken) {
        throw new AuthError('No refresh token available', AuthErrorCode.SESSION_EXPIRED);
      }

      return this.retryHandler.execute(async () => {
        const response = await this.client.send(
          new InitiateAuthCommand({
            ClientId: this.clientId,
            AuthFlow: 'REFRESH_TOKEN_AUTH',
            AuthParameters: {
              REFRESH_TOKEN: this.currentSession!.refreshToken!,
            },
          })
        );

        if (!response.AuthenticationResult) {
          throw new AuthError('Failed to refresh session', AuthErrorCode.SESSION_EXPIRED);
        }

        this.currentSession = await this.createSessionFromTokens(response.AuthenticationResult);
        return this.currentSession;
      });
    });
  }

  async verifyToken(token: string): Promise<AuthUser> {
    return this.executeWithMetrics('verifyToken', async () => {
      try {
        const payload = await this.jwtVerifier.verify(token);
        
        return {
          id: payload.sub,
          email: payload.email,
          name: payload.name || payload['cognito:username'],
          emailVerified: payload.email_verified,
          createdAt: new Date(payload.auth_time * 1000),
        };
      } catch (error) {
        throw new AuthError('Invalid token', AuthErrorCode.INVALID_TOKEN, error);
      }
    });
  }

  async getIdToken(): Promise<string> {
    if (!this.currentSession) {
      throw new AuthError('No active session', AuthErrorCode.SESSION_EXPIRED);
    }
    return this.currentSession.idToken;
  }

  async getAccessToken(): Promise<string> {
    if (!this.currentSession) {
      throw new AuthError('No active session', AuthErrorCode.SESSION_EXPIRED);
    }
    return this.currentSession.accessToken;
  }

  async updateUserAttributes({ attributes }: UpdateUserAttributesParams): Promise<void> {
    return this.executeWithMetrics('updateUserAttributes', async () => {
      const accessToken = await this.getAccessToken();
      
      const userAttributes: AttributeType[] = Object.entries(attributes).map(
        ([key, value]) => ({ Name: key, Value: String(value) })
      );

      try {
        await this.client.send(
          new UpdateUserAttributesCommand({
            AccessToken: accessToken,
            UserAttributes: userAttributes,
          })
        );
      } catch (error) {
        throw this.mapError(error);
      }
    });
  }

  async deleteUser(): Promise<void> {
    return this.executeWithMetrics('deleteUser', async () => {
      const accessToken = await this.getAccessToken();
      
      try {
        await this.client.send(
          new DeleteUserCommand({
            AccessToken: accessToken,
          })
        );
        this.currentSession = null;
      } catch (error) {
        throw this.mapError(error);
      }
    });
  }

  // Admin operations
  async adminGetUser(userId: string): Promise<AuthUser> {
    return this.executeWithMetrics('adminGetUser', async () => {
      try {
        const response = await this.client.send(
          new AdminGetUserCommand({
            UserPoolId: this.userPoolId,
            Username: userId,
          })
        );

        return this.mapCognitoUser(response);
      } catch (error) {
        throw this.mapError(error);
      }
    });
  }

  async adminCreateUser(params: SignUpParams): Promise<AuthUser> {
    return this.executeWithMetrics('adminCreateUser', async () => {
      try {
        const response = await this.client.send(
          new AdminCreateUserCommand({
            UserPoolId: this.userPoolId,
            Username: params.email,
            UserAttributes: [
              { Name: 'email', Value: params.email },
              { Name: 'name', Value: params.name },
              { Name: 'email_verified', Value: 'true' },
            ],
            TemporaryPassword: params.password,
            MessageAction: 'SUPPRESS',
          })
        );

        return {
          id: response.User!.Username!,
          email: params.email,
          name: params.name,
          emailVerified: true,
          createdAt: response.User!.UserCreateDate || new Date(),
          attributes: params.attributes,
        };
      } catch (error) {
        throw this.mapError(error);
      }
    });
  }

  async adminDeleteUser(userId: string): Promise<void> {
    return this.executeWithMetrics('adminDeleteUser', async () => {
      try {
        await this.client.send(
          new AdminDeleteUserCommand({
            UserPoolId: this.userPoolId,
            Username: userId,
          })
        );
      } catch (error) {
        throw this.mapError(error);
      }
    });
  }

  async adminUpdateUserAttributes(
    userId: string,
    attributes: Record<string, any>
  ): Promise<void> {
    return this.executeWithMetrics('adminUpdateUserAttributes', async () => {
      const userAttributes: AttributeType[] = Object.entries(attributes).map(
        ([key, value]) => ({ Name: key, Value: String(value) })
      );

      try {
        await this.client.send(
          new AdminUpdateUserAttributesCommand({
            UserPoolId: this.userPoolId,
            Username: userId,
            UserAttributes: userAttributes,
          })
        );
      } catch (error) {
        throw this.mapError(error);
      }
    });
  }

  async adminResetUserPassword(userId: string, password: string): Promise<void> {
    return this.executeWithMetrics('adminResetUserPassword', async () => {
      try {
        await this.client.send(
          new AdminSetUserPasswordCommand({
            UserPoolId: this.userPoolId,
            Username: userId,
            Password: password,
            Permanent: true,
          })
        );
      } catch (error) {
        throw this.mapError(error);
      }
    });
  }

  protected async performHealthCheck(): Promise<void> {
    // Try to verify the user pool exists
    try {
      await this.client.send(
        new AdminGetUserCommand({
          UserPoolId: this.userPoolId,
          Username: 'health-check-user-does-not-exist',
        })
      );
    } catch (error: any) {
      // We expect UserNotFoundException, which means the pool is accessible
      if (error.name !== 'UserNotFoundException') {
        throw error;
      }
    }
  }

  protected mapError(error: any): Error {
    if (error instanceof AuthError) {
      return error;
    }

    const errorCode = error.name || error.code || 'UNKNOWN_ERROR';
    const errorMessage = error.message || 'An unknown error occurred';

    switch (errorCode) {
      case 'NotAuthorizedException':
        return new AuthError(errorMessage, AuthErrorCode.INVALID_CREDENTIALS, error);
      case 'UserNotFoundException':
        return new AuthError('User not found', AuthErrorCode.USER_NOT_FOUND, error);
      case 'UserNotConfirmedException':
        return new AuthError('User not confirmed', AuthErrorCode.USER_NOT_CONFIRMED, error);
      case 'InvalidPasswordException':
        return new AuthError('Invalid password', AuthErrorCode.INVALID_PASSWORD, error);
      case 'UsernameExistsException':
        return new AuthError('User already exists', AuthErrorCode.USER_EXISTS, error);
      case 'CodeMismatchException':
        return new AuthError('Invalid verification code', AuthErrorCode.INVALID_CODE, error);
      case 'ExpiredCodeException':
        return new AuthError('Verification code expired', AuthErrorCode.CODE_EXPIRED, error);
      case 'LimitExceededException':
        return new AuthError('Too many attempts', AuthErrorCode.LIMIT_EXCEEDED, error);
      case 'NetworkError':
        return new AuthError('Network error', AuthErrorCode.NETWORK_ERROR, error);
      default:
        return new AuthError(errorMessage, AuthErrorCode.UNKNOWN_ERROR, error);
    }
  }

  private async createSessionFromTokens(tokens: any): Promise<AuthSession> {
    const decoded = await this.jwtVerifier.verify(tokens.IdToken);
    
    const session: AuthSession = {
      user: {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name || decoded['cognito:username'],
        emailVerified: decoded.email_verified,
        createdAt: new Date(decoded.auth_time * 1000),
      },
      idToken: tokens.IdToken,
      accessToken: tokens.AccessToken,
      refreshToken: tokens.RefreshToken,
      expiresAt: new Date(decoded.exp * 1000),
    };

    this.currentSession = session;
    this.setupRefreshTimer();
    return session;
  }

  private mapCognitoUser(response: any): AuthUser {
    const attributes: Record<string, string> = {};
    response.UserAttributes?.forEach((attr: AttributeType) => {
      if (attr.Name && attr.Value) {
        attributes[attr.Name] = attr.Value;
      }
    });

    return {
      id: response.Username || attributes.sub,
      email: attributes.email,
      name: attributes.name,
      emailVerified: attributes.email_verified === 'true',
      createdAt: response.UserCreateDate || new Date(),
      attributes,
    };
  }

  private isTokenExpiredError(error: any): boolean {
    return error.name === 'NotAuthorizedException' && 
           error.message?.includes('expired');
  }

  private mapCognitoUserType(user: UserType): AuthUser {
    const attributes: Record<string, string> = {};
    user.Attributes?.forEach((attr: AttributeType) => {
      if (attr.Name && attr.Value) {
        attributes[attr.Name] = attr.Value;
      }
    });

    return {
      id: user.Username || attributes.sub,
      email: attributes.email,
      name: attributes.name,
      emailVerified: attributes.email_verified === 'true',
      createdAt: user.UserCreateDate || new Date(),
      attributes,
    };
  }

  private async shouldRefreshToken(): Promise<boolean> {
    if (!this.currentSession) {
      return false;
    }

    const now = new Date();
    const expiryTime = new Date(this.currentSession.expiresAt.getTime() - (this.refreshThreshold * 1000));
    
    return now >= expiryTime;
  }

  private setupRefreshTimer(): void {
    if (!this.currentSession || !this.autoRefresh) {
      return;
    }

    this.clearRefreshTimer();

    const refreshTime = this.currentSession.expiresAt.getTime() - (this.refreshThreshold * 1000) - Date.now();
    
    if (refreshTime > 0) {
      this.refreshTimer = setTimeout(async () => {
        try {
          await this.autoRefreshToken();
        } catch (error) {
          console.error('Auto-refresh failed:', error);
        }
      }, refreshTime);
    }
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }
}