# Mile Quest API Client SDK Design

**Version**: 1.0  
**Date**: 2025-01-16  
**Author**: API Designer Agent  
**Status**: Complete

## Overview

This document defines the structure and implementation of the Mile Quest API client SDK, providing a type-safe, offline-capable client for all API interactions. The SDK is designed for use in both frontend applications and server-side environments.

## SDK Architecture

### Core Structure

```typescript
// SDK Entry Point
packages/shared/src/api/
├── client/
│   ├── MileQuestClient.ts       // Main client class
│   ├── BaseClient.ts            // HTTP client with retry logic
│   ├── AuthInterceptor.ts       // Token management
│   └── OfflineQueue.ts          // Offline request handling
├── services/
│   ├── AuthService.ts           // Authentication operations
│   ├── UserService.ts           // User profile operations
│   ├── TeamService.ts           // Team management
│   ├── ActivityService.ts       // Activity tracking
│   └── DashboardService.ts      // Dashboard data
├── types/
│   └── index.ts                 // Re-export from api-types.ts
├── utils/
│   ├── validators.ts            // Request validation
│   ├── transformers.ts          // Data transformation
│   └── cache.ts                 // Response caching
└── index.ts                     // SDK exports
```

## Client Implementation

### Main Client Class

```typescript
// packages/shared/src/api/client/MileQuestClient.ts
import { BaseClient } from './BaseClient';
import { AuthService } from '../services/AuthService';
import { UserService } from '../services/UserService';
import { TeamService } from '../services/TeamService';
import { ActivityService } from '../services/ActivityService';
import { DashboardService } from '../services/DashboardService';

export interface MileQuestClientConfig {
  baseUrl: string;
  version?: string;
  timeout?: number;
  retries?: number;
  enableOffline?: boolean;
  cacheEnabled?: boolean;
  authStorage?: 'localStorage' | 'sessionStorage' | 'memory';
  onError?: (error: ApiErrorResponse) => void;
  onTokenRefresh?: (tokens: LoginResponse) => void;
  onOfflineSync?: (results: SyncResult) => void;
}

export class MileQuestClient {
  private baseClient: BaseClient;
  
  public readonly auth: AuthService;
  public readonly user: UserService;
  public readonly teams: TeamService;
  public readonly activities: ActivityService;
  public readonly dashboard: DashboardService;

  constructor(config: MileQuestClientConfig) {
    this.baseClient = new BaseClient(config);
    
    // Initialize services with shared client
    this.auth = new AuthService(this.baseClient);
    this.user = new UserService(this.baseClient);
    this.teams = new TeamService(this.baseClient);
    this.activities = new ActivityService(this.baseClient);
    this.dashboard = new DashboardService(this.baseClient);
  }

  // Convenience methods
  async isAuthenticated(): Promise<boolean> {
    return this.auth.isAuthenticated();
  }

  async refreshToken(): Promise<void> {
    return this.auth.refreshToken();
  }

  async syncOfflineData(): Promise<SyncResult> {
    return this.baseClient.syncOfflineQueue();
  }

  // Configuration updates
  updateConfig(config: Partial<MileQuestClientConfig>): void {
    this.baseClient.updateConfig(config);
  }
}
```

### Base HTTP Client

```typescript
// packages/shared/src/api/client/BaseClient.ts
import { AuthInterceptor } from './AuthInterceptor';
import { OfflineQueue } from './OfflineQueue';
import { Cache } from '../utils/cache';

export class BaseClient {
  private config: MileQuestClientConfig;
  private authInterceptor: AuthInterceptor;
  private offlineQueue: OfflineQueue;
  private cache: Cache;

  constructor(config: MileQuestClientConfig) {
    this.config = {
      version: 'v1',
      timeout: 10000,
      retries: 3,
      enableOffline: true,
      cacheEnabled: true,
      authStorage: 'localStorage',
      ...config,
    };

    this.authInterceptor = new AuthInterceptor(this.config);
    this.offlineQueue = new OfflineQueue(this.config);
    this.cache = new Cache(this.config);
  }

  async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    endpoint: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.baseUrl}/api/${this.config.version}${endpoint}`;
    
    try {
      // Check cache for GET requests
      if (method === 'GET' && this.config.cacheEnabled) {
        const cached = this.cache.get<T>(url);
        if (cached) return cached;
      }

      // Prepare request
      const requestConfig = await this.buildRequest(method, url, data, options);
      
      // Make request with retry logic
      const response = await this.executeWithRetry(requestConfig, options?.retries);
      
      // Cache successful GET responses
      if (method === 'GET' && this.config.cacheEnabled && response.success) {
        this.cache.set(url, response);
      }

      return response;
    } catch (error) {
      // Handle offline scenario
      if (this.isOfflineError(error) && this.config.enableOffline) {
        return this.handleOfflineRequest(method, endpoint, data, options);
      }
      
      throw error;
    }
  }

  private async buildRequest(
    method: string,
    url: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<RequestInit> {
    const headers = new Headers({
      'Content-Type': 'application/json',
      'X-Client-Version': '1.0.0',
    });

    // Add authentication headers
    await this.authInterceptor.addAuthHeaders(headers);

    return {
      method,
      url,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      signal: options?.signal,
    };
  }

  private async executeWithRetry<T>(
    config: RequestInit,
    maxRetries?: number
  ): Promise<ApiResponse<T>> {
    const retries = maxRetries ?? this.config.retries ?? 3;
    let lastError: Error;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(config.url!, config);
        
        // Handle authentication errors
        if (response.status === 401) {
          const refreshed = await this.authInterceptor.handleUnauthorized();
          if (refreshed && attempt < retries) {
            // Retry with new token
            await this.authInterceptor.addAuthHeaders(config.headers as Headers);
            continue;
          }
        }

        const result = await response.json();
        
        if (!response.ok) {
          throw new ApiError(response.status, result.error?.message || 'Request failed', result.error?.code);
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < retries && this.shouldRetry(error)) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        break;
      }
    }

    throw lastError!;
  }

  private shouldRetry(error: Error): boolean {
    // Retry on network errors, timeouts, and 5xx status codes
    return (
      error.name === 'NetworkError' ||
      error.name === 'TimeoutError' ||
      (error instanceof ApiError && error.status >= 500)
    );
  }

  private handleOfflineRequest<T>(
    method: string,
    endpoint: string,
    data?: unknown,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    if (['POST', 'PATCH', 'DELETE'].includes(method)) {
      // Queue for later sync
      this.offlineQueue.add({
        method: method as 'POST' | 'PATCH' | 'DELETE',
        endpoint,
        data,
        timestamp: new Date().toISOString(),
      });

      // Return optimistic response for activities
      if (method === 'POST' && endpoint.includes('/activities')) {
        return Promise.resolve({
          success: true,
          data: this.createOptimisticActivity(data),
        } as ApiResponse<T>);
      }
    }

    // Return cached data or error
    const cached = this.cache.get<T>(`${this.config.baseUrl}/api/${this.config.version}${endpoint}`);
    if (cached) {
      return Promise.resolve(cached);
    }

    throw new ApiError(0, 'No network connection and no cached data available', 'OFFLINE_ERROR');
  }

  async syncOfflineQueue(): Promise<SyncResult> {
    return this.offlineQueue.sync();
  }
}
```

### Service Implementations

```typescript
// packages/shared/src/api/services/AuthService.ts
export class AuthService {
  constructor(private client: BaseClient) {}

  async register(data: RegisterRequest): Promise<ApiResponse<RegisterResponse>> {
    return this.client.request('POST', '/auth/register', data);
  }

  async login(data: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    const response = await this.client.request<LoginResponse>('POST', '/auth/login', data);
    
    if (response.success) {
      // Store tokens
      this.storeTokens(response.data);
    }
    
    return response;
  }

  async logout(): Promise<ApiResponse<{}>> {
    const response = await this.client.request('POST', '/auth/logout');
    this.clearTokens();
    return response;
  }

  async refreshToken(): Promise<ApiResponse<RefreshTokenResponse>> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new ApiError(401, 'No refresh token available', 'UNAUTHORIZED');
    }

    const response = await this.client.request<RefreshTokenResponse>('POST', '/auth/refresh', {
      refreshToken,
    });

    if (response.success) {
      this.updateAccessToken(response.data.accessToken);
    }

    return response;
  }

  isAuthenticated(): boolean {
    const token = this.getAccessToken();
    return !!token && !this.isTokenExpired(token);
  }

  private storeTokens(tokens: LoginResponse): void {
    // Implementation depends on storage type
  }

  private getAccessToken(): string | null {
    // Implementation depends on storage type
  }

  private getRefreshToken(): string | null {
    // Implementation depends on storage type
  }
}

// packages/shared/src/api/services/ActivityService.ts
export class ActivityService {
  constructor(private client: BaseClient) {}

  async create(data: CreateActivityRequest): Promise<ApiResponse<CreateActivityResponse>> {
    return this.client.request('POST', '/activities', data);
  }

  async list(params?: ActivitiesQueryParams): Promise<ApiResponse<ActivitiesListResponse>> {
    const queryString = new URLSearchParams();
    
    if (params?.cursor) queryString.set('cursor', params.cursor);
    if (params?.limit) queryString.set('limit', params.limit.toString());
    if (params?.teamId) queryString.set('teamId', params.teamId);
    if (params?.startDate) queryString.set('startDate', params.startDate);
    if (params?.endDate) queryString.set('endDate', params.endDate);

    const endpoint = `/activities${queryString.toString() ? `?${queryString}` : ''}`;
    return this.client.request('GET', endpoint);
  }

  async update(activityId: string, data: UpdateActivityRequest): Promise<ApiResponse<UpdateActivityResponse>> {
    return this.client.request('PATCH', `/activities/${activityId}`, data);
  }

  async delete(activityId: string): Promise<ApiResponse<DeleteActivityResponse>> {
    return this.client.request('DELETE', `/activities/${activityId}`);
  }
}
```

## SDK Configuration Examples

### Frontend Usage (Next.js)

```typescript
// lib/api.ts
import { MileQuestClient } from '@mile-quest/shared/api';

export const apiClient = new MileQuestClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  enableOffline: true,
  cacheEnabled: true,
  authStorage: 'localStorage',
  onError: (error) => {
    console.error('API Error:', error);
    // Show toast notification
  },
  onTokenRefresh: (tokens) => {
    console.log('Tokens refreshed');
  },
  onOfflineSync: (results) => {
    console.log('Offline sync completed:', results);
  },
});

// Usage in components
const { data } = await apiClient.teams.list();
```

### Server-Side Usage (API Routes)

```typescript
// lib/api-server.ts
import { MileQuestClient } from '@mile-quest/shared/api';

export const serverApiClient = new MileQuestClient({
  baseUrl: process.env.INTERNAL_API_URL || 'http://localhost:3001',
  enableOffline: false,
  cacheEnabled: false,
  authStorage: 'memory',
});
```

## Testing Strategy

### Unit Tests

```typescript
// __tests__/api/services/ActivityService.test.ts
import { ActivityService } from '../../../src/api/services/ActivityService';
import { MockBaseClient } from '../../mocks/MockBaseClient';

describe('ActivityService', () => {
  let service: ActivityService;
  let mockClient: MockBaseClient;

  beforeEach(() => {
    mockClient = new MockBaseClient();
    service = new ActivityService(mockClient);
  });

  it('should create activity successfully', async () => {
    const mockResponse = { success: true, data: { id: '123' } };
    mockClient.mockResponse('POST', '/activities', mockResponse);

    const result = await service.create({
      teamIds: ['team1'],
      distance: 5000,
      duration: 1800,
      activityDate: '2025-01-16T10:00:00Z',
      isPrivate: false,
    });

    expect(result).toEqual(mockResponse);
    expect(mockClient.lastRequest).toMatchObject({
      method: 'POST',
      endpoint: '/activities',
    });
  });
});
```

### Integration Tests

```typescript
// __tests__/integration/api-client.test.ts
describe('MileQuestClient Integration', () => {
  let client: MileQuestClient;

  beforeEach(() => {
    client = new MileQuestClient({
      baseUrl: 'http://localhost:3001',
      enableOffline: false,
    });
  });

  it('should authenticate and fetch user profile', async () => {
    // Login
    const loginResponse = await client.auth.login({
      email: 'test@example.com',
      password: 'password',
    });

    expect(loginResponse.success).toBe(true);

    // Fetch profile
    const profileResponse = await client.user.getProfile();
    expect(profileResponse.success).toBe(true);
    expect(profileResponse.data.user.email).toBe('test@example.com');
  });
});
```

## Error Handling

### Error Types

```typescript
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ApiError';
  }

  isNetworkError(): boolean {
    return this.status === 0 || this.code === 'NETWORK_ERROR';
  }

  isAuthError(): boolean {
    return this.status === 401 || this.code === 'UNAUTHORIZED';
  }

  isValidationError(): boolean {
    return this.status === 400 || this.code === 'VALIDATION_ERROR';
  }
}

export class OfflineError extends ApiError {
  constructor(message: string = 'Operation requires network connection') {
    super(0, message, 'OFFLINE_ERROR');
    this.name = 'OfflineError';
  }
}
```

## Performance Optimizations

### Request Deduplication

```typescript
class RequestDeduplicator {
  private pendingRequests = new Map<string, Promise<any>>();

  async deduplicate<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!;
    }

    const promise = requestFn().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }
}
```

### Response Caching

```typescript
class Cache {
  private cache = new Map<string, { data: any; expiry: number }>();

  set<T>(key: string, data: ApiResponse<T>, ttl = 300000): void { // 5 minutes default
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl,
    });
  }

  get<T>(key: string): ApiResponse<T> | null {
    const entry = this.cache.get(key);
    if (!entry || Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }
}
```

## Security Considerations

### Token Storage

```typescript
class TokenStorage {
  private storage: Storage;

  constructor(type: 'localStorage' | 'sessionStorage' | 'memory') {
    if (type === 'memory') {
      this.storage = new MemoryStorage();
    } else {
      this.storage = window[type];
    }
  }

  setTokens(tokens: { accessToken: string; refreshToken: string }): void {
    // Encrypt sensitive data before storage
    const encrypted = this.encrypt(JSON.stringify(tokens));
    this.storage.setItem('auth_tokens', encrypted);
  }

  getTokens(): { accessToken: string; refreshToken: string } | null {
    const encrypted = this.storage.getItem('auth_tokens');
    if (!encrypted) return null;

    try {
      const decrypted = this.decrypt(encrypted);
      return JSON.parse(decrypted);
    } catch {
      this.clearTokens();
      return null;
    }
  }

  private encrypt(data: string): string {
    // Simple encryption for demo - use proper crypto in production
    return btoa(data);
  }

  private decrypt(data: string): string {
    return atob(data);
  }
}
```

## Implementation Checklist

- [x] Design SDK architecture
- [x] Define client configuration interface
- [x] Plan service structure
- [x] Document authentication flow
- [x] Design offline capabilities
- [x] Plan error handling strategy
- [x] Define testing approach
- [x] Consider security requirements
- [ ] Implement core client classes
- [ ] Create service implementations
- [ ] Add offline queue functionality
- [ ] Implement caching layer
- [ ] Add comprehensive tests
- [ ] Create usage documentation

## Dependencies

This SDK design depends on:
- TypeScript API types (api-types.ts)
- API contracts and versioning strategy
- Authentication patterns from Security Agent
- Offline patterns from Mobile Optimization Agent

## Next Steps

1. Implement core SDK classes in shared package
2. Add comprehensive error handling
3. Create offline synchronization logic
4. Add request/response interceptors
5. Implement caching strategies
6. Create extensive test suite
7. Document usage patterns for all agents

---

Last Updated: 2025-01-16  
Status: Complete - Ready for Implementation