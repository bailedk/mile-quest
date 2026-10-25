import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LogWalkSchema } from '@mile-quest/shared';
import { readApiError, resolveApiUrl } from './config.ts';

describe('API address', () => {
  it('joins the default host with an /api path once', () => {
    assert.equal(
      resolveApiUrl('https://mile-quest.vercel.app', '/api/auth/login'),
      'https://mile-quest.vercel.app/api/auth/login',
    );
    assert.equal(
      resolveApiUrl('https://mile-quest.vercel.app/', '/api/auth/login'),
      'https://mile-quest.vercel.app/api/auth/login',
    );
    assert.equal(
      resolveApiUrl('https://mile-quest.vercel.app/api', '/api/activities'),
      'https://mile-quest.vercel.app/api/activities',
    );
    assert.equal(
      resolveApiUrl('https://mile-quest.vercel.app', '/dashboard'),
      'https://mile-quest.vercel.app/api/dashboard',
    );
  });

  it('rejects a blank or non-http address', () => {
    assert.throws(() => resolveApiUrl('   ', '/api/auth/login'), /server address/);
    assert.throws(() => resolveApiUrl('mile-quest.vercel.app', '/api/auth/login'), /https/);
  });

  it('reads both auth and API error shapes', () => {
    assert.equal(readApiError({ error: 'Invalid email or password' }, 'Failed'), 'Invalid email or password');
    assert.equal(
      readApiError({ error: { message: 'Distance must be a positive number of meters up to 100 km', code: 'VALIDATION' } }, 'Failed'),
      'Distance must be a positive number of meters up to 100 km',
    );
    assert.equal(readApiError(null, 'Failed'), 'Failed');
  });
});

describe('shared walk schema', () => {
  it('accepts a manual walk and a health import', () => {
    const manual = LogWalkSchema.safeParse({
      distance: 1609.344,
      duration: 1200,
      timestamp: '2026-10-25T15:00:00.000Z',
      source: 'MANUAL',
      isPrivate: false,
    });
    assert.equal(manual.success, true);

    const health = LogWalkSchema.safeParse({
      distance: 800,
      duration: 600,
      timestamp: '2026-10-25T15:00:00.000Z',
      source: 'HEALTH_CONNECT',
      externalId: 'distance:abc',
    });
    assert.equal(health.success, true);

    const missingId = LogWalkSchema.safeParse({
      distance: 800,
      duration: 600,
      timestamp: '2026-10-25T15:00:00.000Z',
      source: 'APPLE_HEALTH',
      externalId: '',
    });
    assert.equal(missingId.success, false);
  });
});
