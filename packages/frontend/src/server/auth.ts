import { LoginSchema, RefreshTokenSchema, RegisterSchema, VerifyEmailSchema } from '@mile-quest/shared';
import {
  hashPassword,
  sha256,
  verificationCode,
  verificationExpiry,
} from './crypto';
import { HttpError, json, readJson } from './errors';
import { checkPassword, issueTokens, publicUser, requireUser } from './session';
import type { Store } from './store';

function authError(error: unknown): never {
  if (error instanceof HttpError) {
    throw new HttpError(error.status, error.message, error.code, 'auth');
  }
  throw error;
}

async function authBody(request: Request): Promise<unknown> {
  try {
    return await readJson(request);
  } catch (error) {
    authError(error);
  }
}

export async function register(request: Request, store: Store): Promise<Response> {
  const body = await authBody(request);
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, 'Invalid request data', 'VALIDATION', 'auth');
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await store.findUserByEmail(email);
  if (existing) {
    throw new HttpError(409, 'User with this email already exists', 'CONFLICT', 'auth');
  }

  const user = await store.createUser({
    email,
    name: parsed.data.name,
    passwordHash: await hashPassword(parsed.data.password),
    preferredUnits: parsed.data.preferredUnits || 'miles',
    timezone: parsed.data.timezone || 'UTC',
    verificationCodeHash: sha256(verificationCode()),
    verificationCodeExpiresAt: verificationExpiry(),
  });

  return json({
    user: publicUser(user),
    message: 'Registration successful. Please check your email for verification.',
  }, 201);
}

export async function login(request: Request, store: Store): Promise<Response> {
  const body = await authBody(request);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, 'Invalid request data', 'VALIDATION', 'auth');
  }

  const user = await checkPassword(
    await store.findUserByEmail(parsed.data.email.toLowerCase()),
    parsed.data.password,
  );
  return json({
    user: publicUser(user),
    tokens: await issueTokens(store, user),
  });
}

export async function refresh(request: Request, store: Store): Promise<Response> {
  const body = await authBody(request);
  const parsed = RefreshTokenSchema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, 'Invalid request data', 'VALIDATION', 'auth');
  }

  const token = parsed.data.refreshToken;
  if (!token) {
    throw new HttpError(401, 'Invalid refresh token', 'UNAUTHORIZED', 'auth');
  }
  const stored = await store.findRefreshToken(sha256(token));
  if (!stored || stored.revokedAt || stored.expiresAt.getTime() <= Date.now()) {
    throw new HttpError(401, 'Invalid refresh token', 'UNAUTHORIZED', 'auth');
  }

  const user = await store.findUserById(stored.userId);
  if (!user || user.deletedAt) {
    throw new HttpError(401, 'Invalid refresh token', 'UNAUTHORIZED', 'auth');
  }

  await store.revokeRefreshToken(stored.id);
  return json({ tokens: await issueTokens(store, user) });
}

export async function logout(request: Request, store: Store): Promise<Response> {
  try {
    const user = await requireUser(request, store);
    await store.revokeRefreshTokens(user.id);
  } catch (error) {
    if (!(error instanceof HttpError) || error.status !== 401) throw error;
  }
  return json({ message: 'Logged out' });
}

export async function verifyEmail(request: Request, store: Store): Promise<Response> {
  const body = await authBody(request);
  const parsed = VerifyEmailSchema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, 'Invalid request data', 'VALIDATION', 'auth');
  }

  const user = await store.findUserByEmail(parsed.data.email.toLowerCase());
  if (!user) {
    throw new HttpError(400, 'Invalid verification code', 'VALIDATION', 'auth');
  }
  if (user.emailVerified) {
    return json({ message: 'Email already verified' });
  }
  const expired = user.verificationCodeExpiresAt && user.verificationCodeExpiresAt.getTime() <= Date.now();
  if (expired || !user.verificationCodeHash || user.verificationCodeHash !== sha256(parsed.data.code)) {
    throw new HttpError(400, 'Invalid verification code', 'VALIDATION', 'auth');
  }

  await store.updateUser(user.id, {
    emailVerified: true,
    verificationCodeHash: null,
    verificationCodeExpiresAt: null,
  });
  return json({ message: 'Email verified' });
}
