import { useAuthStore } from '@/store/auth.store';
import { 
  handleApiResponse, 
  NetworkError, 
  AuthenticationError,
  retryWithBackoff 
} from '@/utils/error-handling';

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    const { tokens } = useAuthStore.getState();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (tokens?.accessToken) {
      headers['Authorization'] = `Bearer ${tokens.accessToken}`;
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    // Handle 401 errors by refreshing token
    if (response.status === 401) {
      const { refreshSession, signOut } = useAuthStore.getState();
      try {
        await refreshSession();
        // Signal to retry the original request
        throw new Error('retry');
      } catch {
        // Refresh failed, sign out
        signOut();
        throw new AuthenticationError('Session expired. Please sign in again.');
      }
    }
    
    // Use centralized error handling
    return handleApiResponse<T>(response);
  }

  async get<T>(path: string): Promise<{ data: T }> {
    const makeRequest = async () => {
      const headers = await this.getAuthHeaders();
      
      try {
        const response = await fetch(`${this.baseUrl}${path}`, {
          method: 'GET',
          headers,
        });
        
        const data = await this.handleResponse<T>(response);
        return { data };
      } catch (error: any) {
        if (error.message === 'retry') {
          // Retry with new token
          const retryHeaders = await this.getAuthHeaders();
          const response = await fetch(`${this.baseUrl}${path}`, {
            method: 'GET',
            headers: retryHeaders,
          });
          const data = await this.handleResponse<T>(response);
          return { data };
        }
        
        // Handle network errors
        if (error instanceof TypeError && error.message.includes('fetch')) {
          throw new NetworkError();
        }
        
        throw error;
      }
    };

    // Use retry with exponential backoff for network errors
    return retryWithBackoff(makeRequest);
  }

  async post<T>(path: string, body?: any): Promise<{ data: T }> {
    const headers = await this.getAuthHeaders();
    
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      
      const data = await this.handleResponse<T>(response);
      return { data };
    } catch (error: any) {
      if (error.message === 'retry') {
        // Retry with new token
        const retryHeaders = await this.getAuthHeaders();
        const response = await fetch(`${this.baseUrl}${path}`, {
          method: 'POST',
          headers: retryHeaders,
          body: body ? JSON.stringify(body) : undefined,
        });
        const data = await this.handleResponse<T>(response);
        return { data };
      }
      throw error;
    }
  }

  async patch<T>(path: string, body?: any): Promise<{ data: T }> {
    const headers = await this.getAuthHeaders();
    
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'PATCH',
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      
      const data = await this.handleResponse<T>(response);
      return { data };
    } catch (error: any) {
      if (error.message === 'retry') {
        // Retry with new token
        const retryHeaders = await this.getAuthHeaders();
        const response = await fetch(`${this.baseUrl}${path}`, {
          method: 'PATCH',
          headers: retryHeaders,
          body: body ? JSON.stringify(body) : undefined,
        });
        const data = await this.handleResponse<T>(response);
        return { data };
      }
      throw error;
    }
  }

  async put<T>(path: string, body?: any): Promise<{ data: T }> {
    const headers = await this.getAuthHeaders();
    
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'PUT',
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      
      const data = await this.handleResponse<T>(response);
      return { data };
    } catch (error: any) {
      if (error.message === 'retry') {
        // Retry with new token
        const retryHeaders = await this.getAuthHeaders();
        const response = await fetch(`${this.baseUrl}${path}`, {
          method: 'PUT',
          headers: retryHeaders,
          body: body ? JSON.stringify(body) : undefined,
        });
        const data = await this.handleResponse<T>(response);
        return { data };
      }
      throw error;
    }
  }

  async delete<T = void>(path: string): Promise<{ data?: T }> {
    const headers = await this.getAuthHeaders();
    
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'DELETE',
        headers,
      });
      
      if (response.status === 204) {
        return {};
      }
      
      const data = await this.handleResponse<T>(response);
      return { data };
    } catch (error: any) {
      if (error.message === 'retry') {
        // Retry with new token
        const retryHeaders = await this.getAuthHeaders();
        const response = await fetch(`${this.baseUrl}${path}`, {
          method: 'DELETE',
          headers: retryHeaders,
        });
        
        if (response.status === 204) {
          return {};
        }
        
        const data = await this.handleResponse<T>(response);
        return { data };
      }
      throw error;
    }
  }
}

export const apiClient = new ApiClient();