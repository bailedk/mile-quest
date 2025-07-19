import { 
  RegisterResponse, 
  LoginResponse, 
  RefreshResponse, 
  VerifyEmailResponse,
  LogoutResponse 
} from '@mile-quest/shared';
import { apiClient } from '@/lib/api-client';

export const authApi = {
  register: async (data: {
    email: string;
    password: string;
    name: string;
    preferredUnits?: 'miles' | 'kilometers';
    timezone?: string;
  }): Promise<RegisterResponse> => {
    return apiClient.post<RegisterResponse>('/auth/register', data, { includeAuth: false });
  },

  login: async (data: {
    email: string;
    password: string;
  }): Promise<LoginResponse> => {
    return apiClient.post<LoginResponse>('/auth/login', data, { includeAuth: false });
  },

  refresh: async (refreshToken: string): Promise<RefreshResponse> => {
    return apiClient.post<RefreshResponse>('/auth/refresh', { refreshToken }, { includeAuth: false });
  },

  logout: async (): Promise<LogoutResponse> => {
    return apiClient.post<LogoutResponse>('/auth/logout');
  },

  verifyEmail: async (data: {
    email: string;
    code: string;
  }): Promise<VerifyEmailResponse> => {
    return apiClient.post<VerifyEmailResponse>('/auth/verify-email', data, { includeAuth: false });
  },
};