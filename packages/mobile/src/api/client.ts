import { readApiError, resolveApiUrl } from './config';
import type {
  ActivityListPage,
  CreateActivityInput,
  CreatedActivity,
  DashboardResponse,
  LoginResult,
  RefreshResult,
} from './types';

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  auth?: 'bearer' | 'none';
  retry?: boolean;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export class MileQuestClient {
  constructor(private readonly options: {
    getBaseUrl: () => string;
    getAccessToken: () => Promise<string | null>;
    refresh: () => Promise<string | null>;
  }) {}

  login(email: string, password: string): Promise<LoginResult> {
    return this.request<LoginResult>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: 'none',
    });
  }

  exchangeRefreshToken(refreshToken: string): Promise<RefreshResult['tokens']> {
    return this.request<RefreshResult>('/api/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      auth: 'none',
    }).then((result) => result.tokens);
  }

  dashboard(): Promise<DashboardResponse> {
    return this.request<DashboardResponse>('/api/dashboard');
  }

  async listActivities(options: { source?: string; cursor?: string; startDate?: string; limit?: number } = {}): Promise<ActivityListPage> {
    const params = new URLSearchParams();
    params.set('limit', String(options.limit ?? 30));
    if (options.source) params.set('source', options.source);
    if (options.cursor) params.set('cursor', options.cursor);
    if (options.startDate) params.set('startDate', options.startDate);
    return this.request<ActivityListPage>(`/api/users/me/activities?${params.toString()}`);
  }

  async listActivitiesForSync(source: string, startDate: string): Promise<Array<{ source: string; externalId: string | null }>> {
    const known: Array<{ source: string; externalId: string | null }> = [];
    let cursor: string | null = null;
    for (let page = 0; page < 40; page += 1) {
      const result = await this.listActivities({
        source,
        startDate,
        cursor: cursor ?? undefined,
        limit: 50,
      });
      known.push(...result.items.map((item) => ({ source: item.source, externalId: item.externalId })));
      if (!result.hasMore || !result.nextCursor) break;
      cursor = result.nextCursor;
    }
    return known;
  }

  async createActivity(input: CreateActivityInput): Promise<{ deduped: boolean; id: string }> {
    const { status, body } = await this.requestRaw('/api/activities', {
      method: 'POST',
      body: input,
    });
    const created = body as CreatedActivity;
    return { deduped: status === 200 && created.deduped === true, id: created.id };
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { body } = await this.requestRaw(path, options);
    return body as T;
  }

  private async requestRaw(path: string, options: RequestOptions = {}): Promise<{ status: number; body: unknown }> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.auth !== 'none') {
      const token = await this.options.getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await fetch(resolveApiUrl(this.options.getBaseUrl(), path), {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch {
      throw new ApiError('Could not reach the Mile Quest server. Check the address and your connection.', 0);
    }

    if (response.status === 401 && options.auth !== 'none' && options.retry !== false) {
      const refreshed = await this.options.refresh();
      if (!refreshed) throw new ApiError('Your session expired. Sign in again.', 401);
      return this.requestRaw(path, { ...options, retry: false });
    }

    const text = await response.text();
    const body: unknown = text ? safeJson(text) : {};
    if (!response.ok && response.status !== 200) {
      throw new ApiError(readApiError(body, 'Request failed'), response.status);
    }
    return { status: response.status, body };
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}
