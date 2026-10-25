import { createHash, randomBytes, randomInt } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

const ACCESS_TTL_SECONDS = 60 * 15;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function randomToken(): string {
  return randomBytes(32).toString('hex');
}

export function verificationCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function refreshExpiry(): Date {
  return new Date(Date.now() + REFRESH_TTL_MS);
}

export function verificationExpiry(): Date {
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

function bcryptRounds(): number {
  const parsed = Number(process.env.BCRYPT_ROUNDS || 10);
  if (!Number.isFinite(parsed) || parsed < 4) return 10;
  return Math.floor(parsed);
}

export function hashPassword(password: string): Promise<string> {
  return hash(password, bcryptRounds());
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return compare(password, passwordHash);
}

function jwtSecret(): Uint8Array {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 16) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set to a string of at least 16 characters');
    }
    return new TextEncoder().encode('dev-only-mile-quest-secret');
  }
  return new TextEncoder().encode(value);
}

export async function signAccessToken(user: { id: string; email: string }): Promise<string> {
  return new SignJWT({ email: user.email, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(jwtSecret());
}

export async function readAccessToken(token: string): Promise<{ sub: string; email: string }> {
  const { payload } = await jwtVerify(token, jwtSecret());
  if (payload.type !== 'access' || typeof payload.sub !== 'string') {
    throw new Error('Invalid access token');
  }
  return { sub: payload.sub, email: typeof payload.email === 'string' ? payload.email : '' };
}

export const ACCESS_TOKEN_EXPIRES_IN = ACCESS_TTL_SECONDS;
