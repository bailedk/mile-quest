import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthUser, AuthTokens } from '@mile-quest/shared';
import { AuthState, AuthError } from '@/services/auth';
import { authApi } from '@/services/auth.api';

interface AuthStore extends AuthState {
  // State
  tokens: AuthTokens | null;
  
  // Actions
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, metadata?: Record<string, string>) => Promise<void>;
  signOut: () => Promise<void>;
  checkAuth: () => Promise<void>;
  refreshSession: () => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  confirmPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  clearError: () => void;
  setTokens: (tokens: AuthTokens | null) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
      signIn: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.login({ email, password });
          set({ 
            user: response.user, 
            tokens: response.tokens,
            isAuthenticated: true, 
            isLoading: false 
          });
        } catch (error) {
          set({ error: error as AuthError, isLoading: false });
          throw error;
        }
      },

      signUp: async (email: string, password: string, name: string, metadata?: Record<string, string>) => {
        set({ isLoading: true, error: null });
        try {
          await authApi.register({
            email,
            password,
            name,
            preferredUnits: metadata?.preferredUnits as 'miles' | 'kilometers',
            timezone: metadata?.timezone,
          });
          set({ isLoading: false });
        } catch (error) {
          set({ error: error as AuthError, isLoading: false });
          throw error;
        }
      },

      signOut: async () => {
        set({ isLoading: true, error: null });
        try {
          await authApi.logout();
          set({ 
            user: null, 
            tokens: null,
            isAuthenticated: false, 
            isLoading: false 
          });
        } catch (error) {
          set({ error: error as AuthError, isLoading: false });
          throw error;
        }
      },

      checkAuth: async () => {
        set({ isLoading: true });
        const state = get();
        
        // If we have a user and tokens, consider authenticated
        if (state.user && state.tokens) {
          set({ isLoading: false });
          return;
        }
        
        // Otherwise, not authenticated
        set({ 
          user: null, 
          tokens: null,
          isAuthenticated: false, 
          isLoading: false 
        });
      },

      refreshSession: async () => {
        const state = get();
        if (!state.tokens?.refreshToken) {
          throw new Error('No refresh token available');
        }
        
        try {
          const response = await authApi.refresh(state.tokens.refreshToken);
          set({ tokens: response.tokens });
        } catch (error) {
          // If refresh fails, user needs to sign in again
          set({ 
            user: null, 
            tokens: null,
            isAuthenticated: false, 
            error: error as AuthError 
          });
          throw error;
        }
      },

      verifyEmail: async (email: string, code: string) => {
        set({ isLoading: true, error: null });
        try {
          await authApi.verifyEmail({ email, code });
          set({ isLoading: false });
        } catch (error) {
          set({ error: error as AuthError, isLoading: false });
          throw error;
        }
      },

      forgotPassword: async (email: string) => {
        set({ isLoading: true, error: null });
        try {
          // TODO: Implement forgot password API endpoint
          throw new Error('Forgot password not implemented yet');
        } catch (error) {
          set({ error: error as AuthError, isLoading: false });
          throw error;
        }
      },

      confirmPassword: async (email: string, code: string, newPassword: string) => {
        set({ isLoading: true, error: null });
        try {
          // TODO: Implement confirm password API endpoint
          throw new Error('Confirm password not implemented yet');
        } catch (error) {
          set({ error: error as AuthError, isLoading: false });
          throw error;
        }
      },

      clearError: () => {
        set({ error: null });
      },
      
      setTokens: (tokens: AuthTokens | null) => {
        set({ tokens });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);