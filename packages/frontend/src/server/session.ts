import {
  ACCESS_TOKEN_EXPIRES_IN,
  hashPassword,
  randomToken,
  readAccessToken,
  refreshExpiry,
  sha256,
  signAccessToken,
  verifyPassword,
} from './crypto';
import { HttpError } from './errors';
import type { Store, UserRecord } from './store';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  preferredUnits: 'miles' | 'kilometers';
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export function publicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    preferredUnits: user.preferredUnits === 'kilometers' ? 'kilometers' : 'miles',
    timezone: user.timezone,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function issueTokens(store: Store, user: UserRecord): Promise<IssuedTokens> {
  const accessToken = await signAccessToken(user);
  const refreshToken = randomToken();
  await store.saveRefreshToken({
    userId: user.id,
    tokenHash: sha256(refreshToken),
    expiresAt: refreshExpiry(),
  });
  return {
    accessToken,
    refreshToken,
    idToken: accessToken,
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    tokenType: 'Bearer',
  };
}

export async function authenticate(request: Request, store: Store): Promise<UserRecord | null> {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    const payload = await readAccessToken(match[1].trim());
    const user = await store.findUserById(payload.sub);
    if (!user || user.deletedAt) return null;
    return user;
  } catch {
    return null;
  }
}

export async function requireUser(request: Request, store: Store): Promise<UserRecord> {
  const user = await authenticate(request, store);
  if (!user) {
    throw new HttpError(401, 'Authentication required', 'UNAUTHORIZED');
  }
  return user;
}

export async function checkPassword(user: UserRecord | null, password: string): Promise<UserRecord> {
  if (!user?.passwordHash || user.deletedAt) {
    throw new HttpError(401, 'Invalid email or password', 'UNAUTHORIZED', 'auth');
  }
  const matches = await verifyPassword(password, user.passwordHash);
  if (!matches) {
    throw new HttpError(401, 'Invalid email or password', 'UNAUTHORIZED', 'auth');
  }
  return user;
}

export { hashPassword };
