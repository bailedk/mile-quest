import { AuthUser, AuthTokens } from '@mile-quest/shared';

export interface AuthService {
  // Authentication
  signUp(email: string, password: string, name: string, metadata?: Record<string, string>): Promise<void>;
  signIn(email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  
  // Session management
  getCurrentUser(): Promise<AuthUser | null>;
  getSession(): Promise<AuthSession | null>;
  refreshSession(): Promise<AuthTokens>;
  
  // Email verification
  verifyEmail(email: string, code: string): Promise<void>;
  resendVerificationCode(email: string): Promise<void>;
  
  // Password management
  forgotPassword(email: string): Promise<void>;
  confirmPassword(email: string, code: string, newPassword: string): Promise<void>;
  changePassword(oldPassword: string, newPassword: string): Promise<void>;
  
  // Token management
  getAccessToken(): Promise<string | null>;
  getIdToken(): Promise<string | null>;
  isAuthenticated(): Promise<boolean>;
}

export interface AuthResult {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface AuthSession {
  user: AuthUser;
  tokens: AuthTokens;
  expiresAt: Date;
}

export interface AuthError extends Error {
  code: string;
  statusCode?: number;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: AuthError | null;
}