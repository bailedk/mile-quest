import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthTokens, AuthUser } from '@mile-quest/shared';
import { MileQuestClient } from '@/api/client';
import { DEFAULT_API_BASE_URL } from '@/api/config';
import {
  clearSession,
  loadSession,
  persistSession,
  saveHealthOptIn,
  saveTokenBag,
  type TokenBag,
} from '@/auth/storage';

interface SessionMemory {
  baseUrl: string;
  tokens: TokenBag | null;
  refresh: () => Promise<string | null>;
}

interface SessionValue {
  ready: boolean;
  user: AuthUser | null;
  apiBaseUrl: string;
  healthOptIn: boolean;
  client: MileQuestClient;
  signIn: (input: { email: string; password: string; apiBaseUrl: string }) => Promise<void>;
  signOut: () => Promise<void>;
  setHealthOptIn: (optedIn: boolean) => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

function tokenBag(tokens: AuthTokens): TokenBag {
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
  const [healthOptIn, setHealthOptInState] = useState(false);
  const memory = useRef<SessionMemory>({
    baseUrl: DEFAULT_API_BASE_URL,
    tokens: null,
    refresh: async () => null,
  });
  const refreshInFlight = useRef<Promise<string | null> | null>(null);

  const client = useMemo(() => new MileQuestClient({
    getBaseUrl: () => memory.current.baseUrl,
    getAccessToken: async () => {
      const tokens = memory.current.tokens;
      if (!tokens) return null;
      if (tokens.expiresAt - Date.now() < 30_000) return memory.current.refresh();
      return tokens.accessToken;
    },
    refresh: () => memory.current.refresh(),
  }), []);

  useEffect(() => {
    memory.current.refresh = () => {
      if (refreshInFlight.current) return refreshInFlight.current;
      const current = memory.current.tokens;
      if (!current) return Promise.resolve(null);
      const pending = client.exchangeRefreshToken(current.refreshToken)
        .then(async (tokens) => {
          const bag = tokenBag(tokens);
          memory.current.tokens = bag;
          await saveTokenBag(bag);
          return bag.accessToken;
        })
        .catch(async () => {
          memory.current.tokens = null;
          await clearSession();
          setUser(null);
          setHealthOptInState(false);
          return null;
        })
        .finally(() => {
          refreshInFlight.current = null;
        });
      refreshInFlight.current = pending;
      return pending;
    };
  }, [client]);

  useEffect(() => {
    let cancelled = false;
    loadSession()
      .then((stored) => {
        if (cancelled || !stored) return;
        memory.current.baseUrl = stored.baseUrl;
        memory.current.tokens = stored.tokens;
        setApiBaseUrl(stored.baseUrl);
        setUser(stored.user);
        setHealthOptInState(stored.healthOptIn);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (input: { email: string; password: string; apiBaseUrl: string }) => {
    memory.current.baseUrl = input.apiBaseUrl.trim() || DEFAULT_API_BASE_URL;
    const result = await client.login(input.email.trim(), input.password);
    const bag = tokenBag(result.tokens);
    memory.current.tokens = bag;
    await persistSession({ user: result.user, tokens: bag, baseUrl: memory.current.baseUrl });
    setApiBaseUrl(memory.current.baseUrl);
    setUser(result.user);
  }, [client]);

  const signOut = useCallback(async () => {
    memory.current.tokens = null;
    await clearSession();
    setUser(null);
    setHealthOptInState(false);
  }, []);

  const setHealthOptIn = useCallback(async (optedIn: boolean) => {
    await saveHealthOptIn(optedIn);
    setHealthOptInState(optedIn);
  }, []);

  const value = useMemo<SessionValue>(() => ({
    ready,
    user,
    apiBaseUrl,
    healthOptIn,
    client,
    signIn,
    signOut,
    setHealthOptIn,
  }), [ready, user, apiBaseUrl, healthOptIn, client, signIn, signOut, setHealthOptIn]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
