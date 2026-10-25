import * as SecureStore from 'expo-secure-store';
import type { AuthUser } from '@mile-quest/shared';
import { DEFAULT_API_BASE_URL } from '@/api/config';

const KEYS = {
  accessToken: 'mq.accessToken',
  refreshToken: 'mq.refreshToken',
  expiresAt: 'mq.expiresAt',
  user: 'mq.user',
  apiBaseUrl: 'mq.apiBaseUrl',
  healthOptIn: 'mq.healthOptIn',
  healthSyncedAt: 'mq.healthSyncedAt',
} as const;

export interface TokenBag {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface StoredSession {
  user: AuthUser;
  tokens: TokenBag;
  baseUrl: string;
  healthOptIn: boolean;
}

export async function loadSession(): Promise<StoredSession | null> {
  const [accessToken, refreshToken, expiresAt, userJson, baseUrl, healthOptIn] = await Promise.all([
    SecureStore.getItemAsync(KEYS.accessToken),
    SecureStore.getItemAsync(KEYS.refreshToken),
    SecureStore.getItemAsync(KEYS.expiresAt),
    SecureStore.getItemAsync(KEYS.user),
    SecureStore.getItemAsync(KEYS.apiBaseUrl),
    SecureStore.getItemAsync(KEYS.healthOptIn),
  ]);
  if (!accessToken || !refreshToken || !expiresAt || !userJson) return null;
  try {
    const user = JSON.parse(userJson) as AuthUser;
    if (!user?.id || !user.email) return null;
    return {
      user,
      tokens: { accessToken, refreshToken, expiresAt: Number(expiresAt) },
      baseUrl: baseUrl || DEFAULT_API_BASE_URL,
      healthOptIn: healthOptIn === '1',
    };
  } catch {
    return null;
  }
}

export async function persistSession(session: { user: AuthUser; tokens: TokenBag; baseUrl: string }): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEYS.accessToken, session.tokens.accessToken),
    SecureStore.setItemAsync(KEYS.refreshToken, session.tokens.refreshToken),
    SecureStore.setItemAsync(KEYS.expiresAt, String(session.tokens.expiresAt)),
    SecureStore.setItemAsync(KEYS.user, JSON.stringify(session.user)),
    SecureStore.setItemAsync(KEYS.apiBaseUrl, session.baseUrl),
  ]);
}

export async function saveTokenBag(tokens: TokenBag): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEYS.accessToken, tokens.accessToken),
    SecureStore.setItemAsync(KEYS.refreshToken, tokens.refreshToken),
    SecureStore.setItemAsync(KEYS.expiresAt, String(tokens.expiresAt)),
  ]);
}

export async function clearSession(): Promise<void> {
  await Promise.all(Object.values(KEYS).map((key) => SecureStore.deleteItemAsync(key)));
}

export async function saveHealthOptIn(optedIn: boolean): Promise<void> {
  await SecureStore.setItemAsync(KEYS.healthOptIn, optedIn ? '1' : '0');
}

export async function loadHealthSyncedAt(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.healthSyncedAt);
}

export async function saveHealthSyncedAt(iso: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.healthSyncedAt, iso);
}
