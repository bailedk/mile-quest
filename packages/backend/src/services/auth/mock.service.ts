/**
 * Mock implementation of AuthService for testing
 */

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
  AuthError,
  AuthErrorCode,
} from './types';

interface MockUser {
  user: AuthUser;
  password: string;
  confirmed: boolean;
  resetCode?: string;
  confirmationCode?: string;
}

export class MockAuthService implements AuthService {
  private users: Map<string, MockUser> = new Map();
  private sessions: Map<string, AuthSession> = new Map();
  private currentSession: AuthSession | null = null;
  private mockDelay: number = 0;

  constructor() {
    // Add some default test users
    this.addMockUser({
      user: {
        id: 'test-user-1',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: true,
        createdAt: new Date(),
      },
      password: 'password123',
      confirmed: true,
    });
  }

  // Helper methods for testing
  addMockUser(mockUser: MockUser): void {
    this.users.set(mockUser.user.email, mockUser);
    this.users.set(mockUser.user.id, mockUser);
  }

  setMockDelay(ms: number): void {
    this.mockDelay = ms;
  }

  clearMockData(): void {
    this.users.clear();
    this.sessions.clear();
    this.currentSession = null;
  }

  getMockUsers(): MockUser[] {
    return Array.from(this.users.values());
  }

  // AuthService implementation
  async signIn({ email, password }: SignInParams): Promise<AuthSession> {
    await this.delay();
    
    const mockUser = this.users.get(email);
    if (!mockUser) {
      throw new AuthError('User not found', AuthErrorCode.USER_NOT_FOUND);
    }

    if (mockUser.password !== password) {
      throw new AuthError('Invalid credentials', AuthErrorCode.INVALID_CREDENTIALS);
    }

    if (!mockUser.confirmed) {
      throw new AuthError('User not confirmed', AuthErrorCode.USER_NOT_CONFIRMED);
    }

    const session = this.createMockSession(mockUser.user);
    this.currentSession = session;
    this.sessions.set(session.idToken, session);
    
    return session;
  }

  async signInWithGoogle(): Promise<AuthSession> {
    await this.delay();
    
    const googleUser: AuthUser = {
      id: `google-${Date.now()}`,
      email: 'google.user@example.com',
      name: 'Google User',
      emailVerified: true,
      createdAt: new Date(),
    };

    const mockUser: MockUser = {
      user: googleUser,
      password: 'google-oauth',
      confirmed: true,
    };

    this.addMockUser(mockUser);
    
    const session = this.createMockSession(googleUser);
    this.currentSession = session;
    this.sessions.set(session.idToken, session);
    
    return session;
  }

  async signOut(): Promise<void> {
    await this.delay();
    this.currentSession = null;
  }

  async signUp({ email, password, name, attributes }: SignUpParams): Promise<AuthUser> {
    await this.delay();
    
    if (this.users.has(email)) {
      throw new AuthError('User already exists', AuthErrorCode.USER_EXISTS);
    }

    const user: AuthUser = {
      id: `user-${Date.now()}`,
      email,
      name,
      emailVerified: false,
      createdAt: new Date(),
      attributes,
    };

    const mockUser: MockUser = {
      user,
      password,
      confirmed: false,
      confirmationCode: '123456',
    };

    this.addMockUser(mockUser);
    
    return user;
  }

  async confirmSignUp({ email, code }: ConfirmSignUpParams): Promise<void> {
    await this.delay();
    
    const mockUser = this.users.get(email);
    if (!mockUser) {
      throw new AuthError('User not found', AuthErrorCode.USER_NOT_FOUND);
    }

    if (mockUser.confirmationCode !== code) {
      throw new AuthError('Invalid confirmation code', AuthErrorCode.INVALID_CODE);
    }

    mockUser.confirmed = true;
    mockUser.user.emailVerified = true;
    mockUser.confirmationCode = undefined;
  }

  async resendConfirmationCode(email: string): Promise<void> {
    await this.delay();
    
    const mockUser = this.users.get(email);
    if (!mockUser) {
      throw new AuthError('User not found', AuthErrorCode.USER_NOT_FOUND);
    }

    if (mockUser.confirmed) {
      throw new AuthError('User already confirmed', AuthErrorCode.INVALID_CREDENTIALS);
    }

    mockUser.confirmationCode = '654321';
  }

  async forgotPassword({ email }: ForgotPasswordParams): Promise<void> {
    await this.delay();
    
    const mockUser = this.users.get(email);
    if (!mockUser) {
      // Don't reveal if user exists
      return;
    }

    mockUser.resetCode = '789012';
  }

  async resetPassword({ email, code, newPassword }: ResetPasswordParams): Promise<void> {
    await this.delay();
    
    const mockUser = this.users.get(email);
    if (!mockUser) {
      throw new AuthError('User not found', AuthErrorCode.USER_NOT_FOUND);
    }

    if (mockUser.resetCode !== code) {
      throw new AuthError('Invalid reset code', AuthErrorCode.INVALID_CODE);
    }

    mockUser.password = newPassword;
    mockUser.resetCode = undefined;
  }

  async changePassword({ oldPassword, newPassword }: ChangePasswordParams): Promise<void> {
    await this.delay();
    
    if (!this.currentSession) {
      throw new AuthError('Not authenticated', AuthErrorCode.SESSION_EXPIRED);
    }

    const mockUser = this.users.get(this.currentSession.user.id);
    if (!mockUser) {
      throw new AuthError('User not found', AuthErrorCode.USER_NOT_FOUND);
    }

    if (mockUser.password !== oldPassword) {
      throw new AuthError('Invalid password', AuthErrorCode.INVALID_CREDENTIALS);
    }

    mockUser.password = newPassword;
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    await this.delay();
    return this.currentSession?.user || null;
  }

  async getSession(): Promise<AuthSession | null> {
    await this.delay();
    return this.currentSession;
  }

  async refreshSession(): Promise<AuthSession> {
    await this.delay();
    
    if (!this.currentSession) {
      throw new AuthError('No session to refresh', AuthErrorCode.SESSION_EXPIRED);
    }

    const newSession = this.createMockSession(this.currentSession.user);
    this.currentSession = newSession;
    this.sessions.set(newSession.idToken, newSession);
    
    return newSession;
  }

  async verifyToken(token: string): Promise<AuthUser> {
    await this.delay();
    
    const session = this.sessions.get(token);
    if (!session) {
      throw new AuthError('Invalid token', AuthErrorCode.INVALID_TOKEN);
    }

    if (new Date() > session.expiresAt) {
      throw new AuthError('Token expired', AuthErrorCode.TOKEN_EXPIRED);
    }

    return session.user;
  }

  async getIdToken(): Promise<string> {
    if (!this.currentSession) {
      throw new AuthError('Not authenticated', AuthErrorCode.SESSION_EXPIRED);
    }
    return this.currentSession.idToken;
  }

  async getAccessToken(): Promise<string> {
    if (!this.currentSession) {
      throw new AuthError('Not authenticated', AuthErrorCode.SESSION_EXPIRED);
    }
    return this.currentSession.accessToken;
  }

  async updateUserAttributes({ attributes }: UpdateUserAttributesParams): Promise<void> {
    await this.delay();
    
    if (!this.currentSession) {
      throw new AuthError('Not authenticated', AuthErrorCode.SESSION_EXPIRED);
    }

    const mockUser = this.users.get(this.currentSession.user.id);
    if (!mockUser) {
      throw new AuthError('User not found', AuthErrorCode.USER_NOT_FOUND);
    }

    mockUser.user.attributes = {
      ...mockUser.user.attributes,
      ...attributes,
    };
  }

  async deleteUser(): Promise<void> {
    await this.delay();
    
    if (!this.currentSession) {
      throw new AuthError('Not authenticated', AuthErrorCode.SESSION_EXPIRED);
    }

    const userId = this.currentSession.user.id;
    const email = this.currentSession.user.email;
    
    this.users.delete(userId);
    this.users.delete(email);
    this.currentSession = null;
  }

  // Admin operations
  async adminGetUser(userId: string): Promise<AuthUser> {
    await this.delay();
    
    const mockUser = this.users.get(userId);
    if (!mockUser) {
      throw new AuthError('User not found', AuthErrorCode.USER_NOT_FOUND);
    }

    return mockUser.user;
  }

  async adminCreateUser(params: SignUpParams): Promise<AuthUser> {
    await this.delay();
    
    if (this.users.has(params.email)) {
      throw new AuthError('User already exists', AuthErrorCode.USER_EXISTS);
    }

    const user: AuthUser = {
      id: `admin-user-${Date.now()}`,
      email: params.email,
      name: params.name,
      emailVerified: true,
      createdAt: new Date(),
      attributes: params.attributes,
    };

    const mockUser: MockUser = {
      user,
      password: params.password,
      confirmed: true,
    };

    this.addMockUser(mockUser);
    
    return user;
  }

  async adminDeleteUser(userId: string): Promise<void> {
    await this.delay();
    
    const mockUser = this.users.get(userId);
    if (!mockUser) {
      throw new AuthError('User not found', AuthErrorCode.USER_NOT_FOUND);
    }

    this.users.delete(userId);
    this.users.delete(mockUser.user.email);
  }

  async adminUpdateUserAttributes(
    userId: string,
    attributes: Record<string, any>
  ): Promise<void> {
    await this.delay();
    
    const mockUser = this.users.get(userId);
    if (!mockUser) {
      throw new AuthError('User not found', AuthErrorCode.USER_NOT_FOUND);
    }

    mockUser.user.attributes = {
      ...mockUser.user.attributes,
      ...attributes,
    };
  }

  async adminResetUserPassword(userId: string, password: string): Promise<void> {
    await this.delay();
    
    const mockUser = this.users.get(userId);
    if (!mockUser) {
      throw new AuthError('User not found', AuthErrorCode.USER_NOT_FOUND);
    }

    mockUser.password = password;
  }

  // Helper methods
  private async delay(): Promise<void> {
    if (this.mockDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.mockDelay));
    }
  }

  private createMockSession(user: AuthUser): AuthSession {
    const now = Date.now();
    return {
      user,
      idToken: `mock-id-token-${now}`,
      accessToken: `mock-access-token-${now}`,
      refreshToken: `mock-refresh-token-${now}`,
      expiresAt: new Date(now + 3600 * 1000), // 1 hour
    };
  }
}