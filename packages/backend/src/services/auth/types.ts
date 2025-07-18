/**
 * Authentication service interface and types
 * Provider-agnostic authentication abstraction
 */

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: Date;
  attributes?: Record<string, any>;
}

export interface AuthSession {
  user: AuthUser;
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}

export interface SignUpParams {
  email: string;
  password: string;
  name: string;
  attributes?: Record<string, any>;
}

export interface ConfirmSignUpParams {
  email: string;
  code: string;
}

export interface SignInParams {
  email: string;
  password: string;
}

export interface ForgotPasswordParams {
  email: string;
}

export interface ResetPasswordParams {
  email: string;
  code: string;
  newPassword: string;
}

export interface ChangePasswordParams {
  oldPassword: string;
  newPassword: string;
}

export interface UpdateUserAttributesParams {
  attributes: Record<string, any>;
}

export interface AuthService {
  // Authentication
  signIn(params: SignInParams): Promise<AuthSession>;
  signInWithGoogle(): Promise<AuthSession>;
  signOut(): Promise<void>;
  
  // Registration
  signUp(params: SignUpParams): Promise<AuthUser>;
  confirmSignUp(params: ConfirmSignUpParams): Promise<void>;
  resendConfirmationCode(email: string): Promise<void>;
  
  // Password Management
  forgotPassword(params: ForgotPasswordParams): Promise<void>;
  resetPassword(params: ResetPasswordParams): Promise<void>;
  changePassword(params: ChangePasswordParams): Promise<void>;
  
  // Session Management
  getCurrentUser(): Promise<AuthUser | null>;
  getSession(): Promise<AuthSession | null>;
  refreshSession(): Promise<AuthSession>;
  
  // Token Management
  verifyToken(token: string): Promise<AuthUser>;
  getIdToken(): Promise<string>;
  getAccessToken(): Promise<string>;
  
  // User Management
  updateUserAttributes(params: UpdateUserAttributesParams): Promise<void>;
  deleteUser(): Promise<void>;
  
  // Admin Operations (for backend services)
  adminGetUser(userId: string): Promise<AuthUser>;
  adminCreateUser(params: SignUpParams): Promise<AuthUser>;
  adminDeleteUser(userId: string): Promise<void>;
  adminUpdateUserAttributes(userId: string, attributes: Record<string, any>): Promise<void>;
  adminResetUserPassword(userId: string, password: string): Promise<void>;
}

export interface AuthConfig {
  region?: string;
  userPoolId?: string;
  clientId?: string;
  identityPoolId?: string;
  domain?: string;
  redirectSignIn?: string;
  redirectSignOut?: string;
  oauth?: {
    domain: string;
    scope: string[];
    redirectSignIn: string;
    redirectSignOut: string;
    responseType: string;
  };
}

export class AuthError extends Error {
  constructor(
    message: string,
    public code: AuthErrorCode,
    public originalError?: any
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export enum AuthErrorCode {
  // Authentication errors
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_NOT_CONFIRMED = 'USER_NOT_CONFIRMED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // Registration errors
  USER_EXISTS = 'USER_EXISTS',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  INVALID_EMAIL = 'INVALID_EMAIL',
  
  // Verification errors
  INVALID_CODE = 'INVALID_CODE',
  CODE_EXPIRED = 'CODE_EXPIRED',
  
  // Token errors
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVICE_ERROR = 'SERVICE_ERROR',
  
  // Other errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  NOT_AUTHORIZED = 'NOT_AUTHORIZED',
  LIMIT_EXCEEDED = 'LIMIT_EXCEEDED',
}