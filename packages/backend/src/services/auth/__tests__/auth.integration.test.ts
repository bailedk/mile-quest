/**
 * Integration tests for the complete auth service abstraction
 */

import { AuthService, AuthError, AuthErrorCode } from '../types';
import { MockAuthService } from '../mock.service';
import { 
  createAuthService, 
  createAuthServiceWithProvider, 
  setAuthServiceFactory,
  resetAuthServiceFactory,
  getSupportedProviders,
  isProviderSupported
} from '../factory';

describe('Auth Service Integration', () => {
  let authService: AuthService;

  beforeEach(() => {
    // Reset factory to default state
    resetAuthServiceFactory();
    authService = createAuthServiceWithProvider('mock');
  });

  afterEach(() => {
    resetAuthServiceFactory();
  });

  describe('Factory Integration', () => {
    it('should create mock service for test environment', () => {
      process.env.NODE_ENV = 'test';
      const service = createAuthService();
      expect(service).toBeInstanceOf(MockAuthService);
    });

    it('should support provider validation', () => {
      expect(isProviderSupported('mock')).toBe(true);
      expect(isProviderSupported('cognito')).toBe(true);
      expect(isProviderSupported('invalid')).toBe(false);
    });

    it('should list supported providers', () => {
      const providers = getSupportedProviders();
      expect(providers).toContain('mock');
      expect(providers).toContain('cognito');
      expect(providers).toContain('auth0');
      expect(providers).toContain('supabase');
    });
  });

  describe('Complete Authentication Flow', () => {
    const testUser = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    };

    it('should complete full user registration and confirmation flow', async () => {
      // 1. Sign up user
      const user = await authService.signUp({
        email: testUser.email,
        password: testUser.password,
        name: testUser.name,
        attributes: { role: 'user' },
      });

      expect(user.email).toBe(testUser.email);
      expect(user.name).toBe(testUser.name);
      expect(user.emailVerified).toBe(false);

      // 2. Confirm signup
      await authService.confirmSignUp({
        email: testUser.email,
        code: '123456', // Mock service uses this code
      });

      // 3. Sign in after confirmation
      const session = await authService.signIn({
        email: testUser.email,
        password: testUser.password,
      });

      expect(session.user.email).toBe(testUser.email);
      expect(session.idToken).toBeDefined();
      expect(session.accessToken).toBeDefined();
      expect(session.refreshToken).toBeDefined();
    });

    it('should handle password reset flow', async () => {
      // 1. Request password reset
      await authService.forgotPassword({ email: testUser.email });

      // 2. Reset password with code
      await authService.resetPassword({
        email: testUser.email,
        code: '789012', // Mock service uses this code
        newPassword: 'newpassword123',
      });

      // 3. Sign in with new password
      const session = await authService.signIn({
        email: testUser.email,
        password: 'newpassword123',
      });

      expect(session.user.email).toBe(testUser.email);
    });

    it('should handle session management and token refresh', async () => {
      // 1. Sign in to get initial session
      const session = await authService.signIn({
        email: testUser.email,
        password: testUser.password,
      });

      // 2. Verify token works
      const user = await authService.verifyToken(session.idToken);
      expect(user.email).toBe(testUser.email);

      // 3. Get current session
      const currentSession = await authService.getSession();
      expect(currentSession?.user.email).toBe(testUser.email);

      // 4. Refresh session
      const refreshedSession = await authService.refreshSession();
      expect(refreshedSession.user.email).toBe(testUser.email);
      expect(refreshedSession.idToken).not.toBe(session.idToken); // Should be different token

      // 5. Auto-refresh
      const autoRefreshed = await authService.autoRefreshToken();
      expect(autoRefreshed?.user.email).toBe(testUser.email);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle authentication errors consistently', async () => {
      // Test invalid credentials
      await expect(authService.signIn({
        email: 'test@example.com',
        password: 'wrongpassword',
      })).rejects.toThrow(AuthError);

      // Test user not found
      await expect(authService.signIn({
        email: 'nonexistent@example.com',
        password: 'password123',
      })).rejects.toThrow(AuthError);
    });

    it('should handle token validation errors', async () => {
      // Test invalid token
      await expect(authService.verifyToken('invalid-token'))
        .rejects.toThrow(AuthError);

      // Test expired token
      const mockService = authService as MockAuthService;
      const session = await authService.signIn({
        email: 'test@example.com',
        password: 'password123',
      });

      // Simulate expired token by checking after expiry
      const expiredToken = `mock-id-token-${Date.now() - 7200000}`; // 2 hours ago
      await expect(authService.verifyToken(expiredToken))
        .rejects.toThrow(AuthError);
    });
  });

  describe('User Management Integration', () => {
    it('should handle user attribute updates', async () => {
      const session = await authService.signIn({
        email: 'test@example.com',
        password: 'password123',
      });

      await authService.updateUserAttributes({
        attributes: {
          phone_number: '+1234567890',
          preferred_username: 'testuser',
        },
      });

      const currentUser = await authService.getCurrentUser();
      expect(currentUser?.attributes?.phone_number).toBe('+1234567890');
    });

    it('should handle user disable/enable operations', async () => {
      const userId = 'test-user-1';

      // Disable user
      await authService.disableUser(userId);

      // Verify disabled user cannot sign in
      await expect(authService.signIn({
        email: 'test@example.com',
        password: 'password123',
      })).rejects.toThrow(AuthError);

      // Re-enable user
      await authService.enableUser(userId);

      // Verify user can sign in again
      const session = await authService.signIn({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(session.user.email).toBe('test@example.com');
    });
  });

  describe('Admin Operations Integration', () => {
    it('should handle admin user management', async () => {
      // Create admin user
      const adminUser = await authService.adminCreateUser({
        email: 'admin@example.com',
        password: 'adminpass123',
        name: 'Admin User',
        attributes: { role: 'admin' },
      });

      expect(adminUser.email).toBe('admin@example.com');
      expect(adminUser.emailVerified).toBe(true);

      // Get admin user
      const retrievedUser = await authService.adminGetUser(adminUser.id);
      expect(retrievedUser.email).toBe('admin@example.com');

      // Update admin user attributes
      await authService.adminUpdateUserAttributes(adminUser.id, {
        department: 'IT',
        access_level: 'high',
      });

      // List users
      const usersList = await authService.adminListUsers(10);
      expect(usersList.users.length).toBeGreaterThan(0);
      expect(usersList.users.some(u => u.email === 'admin@example.com')).toBe(true);

      // Reset admin password
      await authService.adminResetUserPassword(adminUser.id, 'newadminpass123');

      // Delete admin user
      await authService.adminDeleteUser(adminUser.id);

      // Verify user is deleted
      await expect(authService.adminGetUser(adminUser.id))
        .rejects.toThrow(AuthError);
    });
  });

  describe('Mock Service Testing Features', () => {
    let mockService: MockAuthService;

    beforeEach(() => {
      mockService = authService as MockAuthService;
    });

    it('should track method calls for testing', async () => {
      mockService.clearCallHistory();

      await authService.signIn({
        email: 'test@example.com',
        password: 'password123',
      });

      const history = mockService.getCallHistory();
      expect(history).toHaveLength(1);
      expect(history[0].method).toBe('signIn');
      expect(history[0].params.email).toBe('test@example.com');
    });

    it('should simulate errors for testing', async () => {
      const error = new AuthError('Simulated error', AuthErrorCode.SERVICE_ERROR);
      mockService.simulateError('signIn', error);

      await expect(authService.signIn({
        email: 'test@example.com',
        password: 'password123',
      })).rejects.toThrow('Simulated error');

      mockService.clearErrorSimulation('signIn');

      // Should work normally after clearing error simulation
      const session = await authService.signIn({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(session.user.email).toBe('test@example.com');
    });

    it('should simulate network delays for testing', async () => {
      mockService.setMockDelay(100);

      const start = Date.now();
      await authService.signIn({
        email: 'test@example.com',
        password: 'password123',
      });
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThan(90); // Allow some tolerance

      mockService.setMockDelay(0);
    });

    it('should handle auto-refresh configuration', async () => {
      mockService.setAutoRefresh(false);
      mockService.setRefreshThreshold(60); // 1 minute

      const session = await authService.signIn({
        email: 'test@example.com',
        password: 'password123',
      });

      // Auto-refresh should return null when disabled
      const autoRefreshed = await authService.autoRefreshToken();
      expect(autoRefreshed).toBeNull();

      mockService.setAutoRefresh(true);
      const autoRefreshedEnabled = await authService.autoRefreshToken();
      expect(autoRefreshedEnabled).not.toBeNull();
    });
  });

  describe('Service Registry Integration', () => {
    it('should work with custom factory for testing', () => {
      const customFactory = {
        create: jest.fn().mockReturnValue(new MockAuthService()),
        createWithDefaultConfig: jest.fn().mockReturnValue(new MockAuthService()),
        getSupportedProviders: jest.fn().mockReturnValue(['mock']),
        validateProvider: jest.fn().mockReturnValue(true),
      };

      setAuthServiceFactory(customFactory);

      const service = createAuthService();
      expect(customFactory.create).toHaveBeenCalled();
      expect(service).toBeInstanceOf(MockAuthService);

      resetAuthServiceFactory();
    });
  });
});