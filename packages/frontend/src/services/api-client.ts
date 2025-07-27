import { useAuthStore } from '@/store/auth.store';
import { 
  handleApiResponse, 
  NetworkError, 
  AuthenticationError,
  ApiError,
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
      'Accept': 'application/json',
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
    
    // For SAM Local, we need to handle responses more carefully
    // Check if we have a valid response
    if (!response.ok && response.status !== 200 && response.status !== 201) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          const error = await response.json();
          throw new ApiError(
            error.error?.message || 'Request failed',
            response.status,
            error.error?.code
          );
        } catch (e) {
          // If JSON parsing fails, throw generic error
          throw new ApiError('Request failed', response.status);
        }
      }
      throw new ApiError('Request failed', response.status);
    }
    
    // SAM Local workaround: Handle gzipped responses
    // If the response has gzip encoding but the browser can't decode it,
    // we'll get the response as text and parse it manually
    const contentEncoding = response.headers.get('content-encoding');
    if (contentEncoding === 'gzip' && response.status === 200) {
      try {
        // Try normal JSON parsing first
        return handleApiResponse<T>(response);
      } catch (error: any) {
        // If it fails with a decoding error, try text parsing
        if (error.message && error.message.includes('Failed to fetch')) {
          throw new NetworkError('Failed to decode response from server');
        }
        throw error;
      }
    }
    
    // Use centralized error handling for successful responses
    return handleApiResponse<T>(response);
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
      
      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError('Network connection error');
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