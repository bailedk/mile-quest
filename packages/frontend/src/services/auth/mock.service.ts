import { AuthUser, AuthTokens } from '@mile-quest/shared';
import { AuthService, AuthResult, AuthSession, AuthError } from './types';

// Mock users for local development
const mockUsers = [
  {
    id: '1',
    email: 'admin@mile-quest.com',
    name: 'Admin User',
    password: 'password123',
    emailVerified: true,
    preferredUnits: 'miles' as const,
    timezone: 'UTC',
  },
  {
    id: '2', 
    email: 'user@mile-quest.com',
    name: 'Test User',
    password: 'password123',
    emailVerified: true,
    preferredUnits: 'kilometers' as const,
    timezone: 'UTC',
  },
];

export class MockAuthService implements AuthService {
  private currentUser: AuthUser | null = null;
  private currentTokens: AuthTokens | null = null;

  async signUp(email: string, password: string, name: string, metadata?: Record<string, string>): Promise<void> {
    // Simulate signup - in mock mode, users are auto-verified
    console.log('Mock SignUp:', { email, name, metadata });
    
    // Check if user already exists
    const existingUser = mockUsers.find(u => u.email === email);
    if (existingUser) {
      throw this.createAuthError('USER_EXISTS', 'User with this email already exists', 409);
    }
    
    // In real implementation, this would create the user
    // For mock, we'll just log it
    console.log('User would be created:', { email, name });
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    console.log('Mock SignIn:', { email });
    
    const mockUser = mockUsers.find(u => u.email === email && u.password === password);
    if (!mockUser) {
      throw this.createAuthError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    const user: AuthUser = {
      id: mockUser.id,
      email: mockUser.email,
      name: mockUser.name,
      emailVerified: mockUser.emailVerified,
      preferredUnits: mockUser.preferredUnits,
      timezone: mockUser.timezone,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const tokens: AuthTokens = this.generateMockTokens(user);
    
    this.currentUser = user;
    this.currentTokens = tokens;
    
    return { user, tokens };
  }

  async signOut(): Promise<void> {
    console.log('Mock SignOut');
    this.currentUser = null;
    this.currentTokens = null;
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    return this.currentUser;
  }

  async getSession(): Promise<AuthSession | null> {
    if (!this.currentUser || !this.currentTokens) {
      return null;
    }

    return {
      user: this.currentUser,
      tokens: this.currentTokens,
      expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    };
  }

  async refreshSession(): Promise<AuthTokens> {
    if (!this.currentUser) {
      throw this.createAuthError('NO_USER', 'No authenticated user', 401);
    }

    const tokens = this.generateMockTokens(this.currentUser);
    this.currentTokens = tokens;
    return tokens;
  }

  async verifyEmail(email: string, code: string): Promise<void> {
    console.log('Mock VerifyEmail:', { email, code });
    // In mock mode, all emails are auto-verified
  }

  async resendVerificationCode(email: string): Promise<void> {
    console.log('Mock ResendVerificationCode:', { email });
    // Mock implementation
  }

  async forgotPassword(email: string): Promise<void> {
    console.log('Mock ForgotPassword:', { email });
    // Mock implementation
  }

  async confirmPassword(email: string, code: string, newPassword: string): Promise<void> {
    console.log('Mock ConfirmPassword:', { email, code });
    // Mock implementation
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    console.log('Mock ChangePassword');
    // Mock implementation
  }

  async getAccessToken(): Promise<string | null> {
    return this.currentTokens?.accessToken || null;
  }

  async getIdToken(): Promise<string | null> {
    return this.currentTokens?.idToken || null;
  }

  async isAuthenticated(): Promise<boolean> {
    return this.currentUser !== null;
  }

  private generateMockTokens(user: AuthUser): AuthTokens {
    // Generate mock JWT-like tokens
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      sub: user.id,
      email: user.email,
      name: user.name,
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      iat: Math.floor(Date.now() / 1000),
    }));
    const signature = 'mock-signature';
    
    const token = `${header}.${payload}.${signature}`;

    return {
      accessToken: token,
      idToken: token,
      refreshToken: 'mock-refresh-token',
      expiresIn: 3600,
      tokenType: 'Bearer',
    };
  }

  private createAuthError(code: string, message: string, statusCode = 400): AuthError {
    const error: AuthError = new Error(message) as AuthError;
    error.code = code;
    error.statusCode = statusCode;
    error.name = 'AuthError';
    return error;
  }
}