import { 
  RegisterResponse, 
  LoginResponse, 
  RefreshResponse, 
  VerifyEmailResponse,
  LogoutResponse 
} from '@mile-quest/shared';

// Simple API client for auth endpoints (no auth headers needed)
const AUTH_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class AuthApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${AUTH_API_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async post<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}

const authApiClient = new AuthApiClient();

export const authApi = {
  register: async (data: {
    email: string;
    password: string;
    name: string;
    preferredUnits?: 'miles' | 'kilometers';
    timezone?: string;
  }): Promise<RegisterResponse> => {
    return authApiClient.post<RegisterResponse>('/auth/register', data);
  },

  login: async (data: {
    email: string;
    password: string;
  }): Promise<LoginResponse> => {
    return authApiClient.post<LoginResponse>('/auth/login', data);
  },

  refresh: async (refreshToken: string): Promise<RefreshResponse> => {
    return authApiClient.post<RefreshResponse>('/auth/refresh', { refreshToken });
  },

  logout: async (): Promise<LogoutResponse> => {
    return authApiClient.post<LogoutResponse>('/auth/logout');
  },

  verifyEmail: async (data: {
    email: string;
    code: string;
  }): Promise<VerifyEmailResponse> => {
    return authApiClient.post<VerifyEmailResponse>('/auth/verify-email', data);
  },
};