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
  enabled: boolean;
  resetCode?: string;
  confirmationCode?: string;
  mfaEnabled?: boolean;
  temporaryPassword?: boolean;
}

export class MockAuthService implements AuthService {
  private users: Map<string, MockUser> = new Map();
  private sessions: Map<string, AuthSession> = new Map();
  private currentSession: AuthSession | null = null;
  private mockDelay: number = 0;
  private autoRefresh: boolean = true;
  private refreshThreshold: number = 300;
  private errorSimulation: Map<string, Error> = new Map();
  private callHistory: Array<{ method: string; params: any; timestamp: Date }> = [];

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
      enabled: true,
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

  simulateError(method: string, error: Error): void {
    this.errorSimulation.set(method, error);
  }

  clearErrorSimulation(method?: string): void {
    if (method) {
      this.errorSimulation.delete(method);
    } else {
      this.errorSimulation.clear();
    }
  }

  getCallHistory(): Array<{ method: string; params: any; timestamp: Date }> {
    return [...this.callHistory];
  }

  clearCallHistory(): void {
    this.callHistory = [];
  }

  setAutoRefresh(enabled: boolean): void {
    this.autoRefresh = enabled;
  }

  setRefreshThreshold(seconds: number): void {
    this.refreshThreshold = seconds;
  }

  // AuthService implementation
  async signIn({ email, password }: SignInParams): Promise<AuthSession> {
    this.recordCall('signIn', { email });
    await this.delay();
    this.checkErrorSimulation('signIn');
    
    const mockUser = this.users.get(email);
    if (!mockUser) {
      throw new AuthError('User not found', AuthErrorCode.USER_NOT_FOUND);
    }

    if (!mockUser.enabled) {
      throw new AuthError('User account is disabled', AuthErrorCode.USER_DISABLED);
    }

    if (mockUser.password !== password) {
      throw new AuthError('Invalid credentials', AuthErrorCode.INVALID_CREDENTIALS);
    }

    if (!mockUser.confirmed) {
      throw new AuthError('User not confirmed', AuthErrorCode.USER_NOT_CONFIRMED);
    }

    if (mockUser.temporaryPassword) {
      throw new AuthError('Temporary password must be changed', AuthErrorCode.TEMPORARY_PASSWORD);
    }

    if (mockUser.mfaEnabled) {
      throw new AuthError('MFA required', AuthErrorCode.MFA_REQUIRED);
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
      enabled: true,
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
    this.recordCall('signUp', { email, name });
    await this.delay();
    this.checkErrorSimulation('signUp');
    
    if (this.users.has(email)) {
      throw new AuthError('User already exists', AuthErrorCode.USER_EXISTS);
    }

    // Simple password validation
    if (password.length < 8) {
      throw new AuthError('Password must be at least 8 characters', AuthErrorCode.INVALID_PASSWORD);
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
      enabled: true,
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
      enabled: true,
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
    this.recordCall('adminResetUserPassword', { userId });
    await this.delay();
    this.checkErrorSimulation('adminResetUserPassword');
    
    const mockUser = this.users.get(userId);
    if (!mockUser) {
      throw new AuthError('User not found', AuthErrorCode.USER_NOT_FOUND);
    }

    mockUser.password = password;
    mockUser.temporaryPassword = true; // Require password change on next login
  }

  async getRefreshToken(): Promise<string> {
    if (!this.currentSession?.refreshToken) {
      throw new AuthError('No refresh token available', AuthErrorCode.SESSION_EXPIRED);
    }
    return this.currentSession.refreshToken;
  }

  async isTokenExpired(token?: string): Promise<boolean> {
    const tokenToCheck = token || this.currentSession?.idToken;
    if (!tokenToCheck) {
      return true;
    }

    const session = this.sessions.get(tokenToCheck);
    if (!session) {
      return true;
    }

    return new Date() > session.expiresAt;
  }

  async autoRefreshToken(): Promise<AuthSession | null> {
    if (!this.currentSession || !this.autoRefresh) {
      return null;
    }

    if (await this.shouldRefreshToken()) {
      try {
        return await this.refreshSession();
      } catch (error) {
        this.currentSession = null;
        throw error;
      }
    }

    return this.currentSession;
  }

  async enableUser(userId: string): Promise<void> {
    this.recordCall('enableUser', { userId });
    await this.delay();
    this.checkErrorSimulation('enableUser');
    
    const mockUser = this.users.get(userId);
    if (!mockUser) {
      throw new AuthError('User not found', AuthErrorCode.USER_NOT_FOUND);
    }

    mockUser.enabled = true;
  }

  async disableUser(userId: string): Promise<void> {
    this.recordCall('disableUser', { userId });
    await this.delay();
    this.checkErrorSimulation('disableUser');
    
    const mockUser = this.users.get(userId);
    if (!mockUser) {
      throw new AuthError('User not found', AuthErrorCode.USER_NOT_FOUND);
    }

    mockUser.enabled = false;
  }

  async adminEnableUser(userId: string): Promise<void> {
    return this.enableUser(userId);
  }

  async adminDisableUser(userId: string): Promise<void> {
    return this.disableUser(userId);
  }

  async adminListUsers(limit: number = 60, paginationToken?: string): Promise<{ users: AuthUser[]; nextToken?: string }> {
    this.recordCall('adminListUsers', { limit, paginationToken });
    await this.delay();
    this.checkErrorSimulation('adminListUsers');
    
    const allUsers = Array.from(this.users.values())
      .filter(mockUser => mockUser.user.id.startsWith('user-') || mockUser.user.id.startsWith('admin-'))
      .map(mockUser => mockUser.user);
    
    const startIndex = paginationToken ? parseInt(paginationToken, 10) : 0;
    const endIndex = Math.min(startIndex + limit, allUsers.length);
    const users = allUsers.slice(startIndex, endIndex);
    
    const nextToken = endIndex < allUsers.length ? endIndex.toString() : undefined;
    
    return { users, nextToken };
  }

  // Helper methods
  private async delay(): Promise<void> {
    if (this.mockDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.mockDelay));
    }
  }

  private async shouldRefreshToken(): Promise<boolean> {
    if (!this.currentSession) {
      return false;
    }

    const now = new Date();
    const expiryTime = new Date(this.currentSession.expiresAt.getTime() - (this.refreshThreshold * 1000));
    
    return now >= expiryTime;
  }

  private recordCall(method: string, params: any): void {
    this.callHistory.push({
      method,
      params,
      timestamp: new Date(),
    });
  }

  private checkErrorSimulation(method: string): void {
    const error = this.errorSimulation.get(method);
    if (error) {
      throw error;
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