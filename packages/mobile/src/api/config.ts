export const DEFAULT_API_BASE_URL = 'https://mile-quest.vercel.app';

export function resolveApiUrl(baseUrl: string, path: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (!trimmed) {
    throw new Error('Enter the API server address.');
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Enter a full server address, including https://.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('The server address must start with https:// or http://.');
  }
  const suffix = path.startsWith('/') ? path : `/${path}`;
  const origin = trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
  const apiPath = suffix.startsWith('/api/') || suffix === '/api' ? suffix : `/api${suffix}`;
  return `${origin}${apiPath}`;
}

export function readApiError(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const record = body as { error?: unknown; message?: unknown };
  if (typeof record.error === 'string' && record.error.trim()) return record.error;
  if (record.error && typeof record.error === 'object' && 'message' in record.error) {
    const message = (record.error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  if (typeof record.message === 'string' && record.message.trim()) return record.message;
  return fallback;
}
