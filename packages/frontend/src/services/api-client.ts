import { useAuthStore } from '@/store/auth.store';

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
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'An error occurred' }));
      
      // Handle 401 errors by refreshing token
      if (response.status === 401) {
        const { refreshSession, signOut } = useAuthStore.getState();
        try {
          await refreshSession();
          // Retry the original request
          throw new Error('retry');
        } catch {
          // Refresh failed, sign out
          signOut();
          throw new Error('Session expired. Please sign in again.');
        }
      }
      
      throw new Error(error.message || error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async get<T>(path: string): Promise<{ data: T }> {
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
      throw error;
    }
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