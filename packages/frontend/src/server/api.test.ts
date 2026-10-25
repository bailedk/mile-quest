// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { dispatch } from './dispatch';
import { haversineMeters } from './geo';
import { MemoryStore } from './memory-store';
import type { Store } from './store';

process.env.JWT_SECRET = 'test-secret-value-please-change';
process.env.BCRYPT_ROUNDS = '4';
process.env.NODE_ENV = 'test';
delete process.env.MAPBOX_ACCESS_TOKEN;

let store: MemoryStore;

beforeEach(() => {
  store = new MemoryStore();
});

function call(method: string, path: string, body?: unknown, token?: string): Promise<Response> {
  return dispatch(new Request(`http://localhost${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), store as Store);
}

async function registerAndLogin(email = 'ada@example.com', name = 'Ada') {
  const registered = await call('POST', '/api/auth/register', {
    email,
    password: 'password123',
    name,
  });
  expect(registered.status).toBe(201);
  const loggedIn = await call('POST', '/api/auth/login', { email, password: 'password123' });
  expect(loggedIn.status).toBe(200);
  const payload = await loggedIn.json() as {
    user: { id: string; email: string };
    tokens: { accessToken: string; refreshToken: string; tokenType: string };
  };
  return payload;
}

describe('core API routes', () => {
  it('measures great-circle distance without PostGIS', () => {
    const meters = haversineMeters({ lat: 37.77, lng: -122.42 }, { lat: 37.78, lng: -122.42 });
    expect(meters).toBeGreaterThan(1000);
    expect(meters).toBeLessThan(1200);
  });

  it('registers, logs in, and rejects a bad password', async () => {
    const session = await registerAndLogin();
    expect(session.user.email).toBe('ada@example.com');
    expect(session.tokens.tokenType).toBe('Bearer');

    const duplicate = await call('POST', '/api/auth/register', {
      email: 'ada@example.com',
      password: 'password123',
      name: 'Ada',
    });
    expect(duplicate.status).toBe(409);

    const invalid = await call('POST', '/api/auth/login', {
      email: 'ada@example.com',
      password: 'wrong-password',
    });
    expect(invalid.status).toBe(401);
    expect(await invalid.json()).toEqual({ error: 'Invalid email or password' });
  });

  it('rotates refresh tokens and keeps protected routes closed', async () => {
    const session = await registerAndLogin();
    const missing = await call('GET', '/api/users/me/teams');
    expect(missing.status).toBe(401);

    const refreshed = await call('POST', '/api/auth/refresh', {
      refreshToken: session.tokens.refreshToken,
    });
    expect(refreshed.status).toBe(200);
    const next = await refreshed.json() as { tokens: { accessToken: string; refreshToken: string } };
    expect(next.tokens.accessToken).toBeTruthy();

    const reused = await call('POST', '/api/auth/refresh', {
      refreshToken: session.tokens.refreshToken,
    });
    expect(reused.status).toBe(401);

    const teams = await call('GET', '/api/users/me/teams', undefined, next.tokens.accessToken);
    expect(teams.status).toBe(200);
    expect(await teams.json()).toEqual([]);
  });

  it('creates a team goal from coordinates and counts private walks toward the team', async () => {
    const ada = await registerAndLogin('ada@example.com', 'Ada');
    const grace = await registerAndLogin('grace@example.com', 'Grace');

    const created = await call('POST', '/api/teams', { name: 'Harbor Walkers' }, ada.tokens.accessToken);
    expect(created.status).toBe(201);
    const team = await created.json() as { id: string; members: Array<{ role: string }> };
    expect(team.members[0].role).toBe('ADMIN');

    const joined = await call('POST', '/api/teams/join', { teamId: team.id }, grace.tokens.accessToken);
    expect(joined.status).toBe(200);

    const goalResponse = await call('POST', `/api/teams/${team.id}/goals`, {
      name: 'Across town',
      targetDate: new Date(Date.now() + 10 * 86400000).toISOString(),
      startLocation: { lat: 37.77, lng: -122.42, address: 'Start' },
      endLocation: { lat: 37.78, lng: -122.42, address: 'End' },
      waypoints: [],
    }, ada.tokens.accessToken);
    expect(goalResponse.status).toBe(201);
    const goal = await goalResponse.json() as { id: string; totalDistance: number; currentDistance: number };
    expect(goal.totalDistance).toBeGreaterThan(1000);
    expect(goal.totalDistance).toBeLessThan(1200);
    expect(goal.currentDistance).toBe(0);

    const logged = await call('POST', '/api/activities', {
      distance: 5000,
      duration: 3600,
      timestamp: new Date().toISOString(),
      notes: 'Quiet loop',
      isPrivate: true,
    }, ada.tokens.accessToken);
    expect(logged.status).toBe(201);
    expect(await logged.json()).toMatchObject({ source: 'MANUAL', externalId: null, isPrivate: true });

    const board = await call('GET', '/api/dashboard', undefined, grace.tokens.accessToken);
    expect(board.status).toBe(200);
    const graceView = await board.json() as {
      teams: Array<{ progress: { currentDistance: number; percentComplete: number } | null }>;
      teamLeaderboards: Array<{ members: Array<{ userId: string; distance: number }> }>;
    };
    expect(graceView.teams[0].progress?.currentDistance).toBe(5000);
    expect(graceView.teams[0].progress?.percentComplete).toBe(100);
    const adaOnGraceBoard = graceView.teamLeaderboards[0].members.find((member) => member.userId === ada.user.id);
    expect(adaOnGraceBoard?.distance).toBe(0);

    const adaBoard = await call('GET', '/api/dashboard', undefined, ada.tokens.accessToken);
    const adaView = await adaBoard.json() as {
      teamLeaderboards: Array<{ members: Array<{ userId: string; distance: number }> }>;
      personalStats: { totalDistance: number };
      recentActivities: Array<{ notes?: string; isOwn: boolean }>;
    };
    const adaRow = adaView.teamLeaderboards[0].members.find((member) => member.userId === ada.user.id);
    expect(adaRow?.distance).toBe(5000);
    expect(adaView.personalStats.totalDistance).toBe(5000);
    expect(adaView.recentActivities[0].isOwn).toBe(true);

    const teamFeed = await call('GET', `/api/teams/${team.id}/activities`, undefined, grace.tokens.accessToken);
    expect(await teamFeed.json()).toEqual([]);

    const ownFeed = await call('GET', '/api/users/me/activities', undefined, ada.tokens.accessToken);
    const own = await ownFeed.json() as { items: Array<{ isPrivate: boolean }>; hasMore: boolean };
    expect(own.items).toHaveLength(1);
    expect(own.items[0].isPrivate).toBe(true);
    expect(own.hasMore).toBe(false);
  });

  it('dedupes a health import for the same user and lets another user import that sample', async () => {
    const ada = await registerAndLogin('ada@example.com', 'Ada');
    const walk = {
      distance: 1600,
      duration: 1200,
      timestamp: new Date().toISOString(),
      source: 'APPLE_HEALTH',
      externalId: 'workout:abc',
    };
    const first = await call('POST', '/api/activities', walk, ada.tokens.accessToken);
    expect(first.status).toBe(201);
    const created = await first.json() as { id: string; source: string; externalId: string };
    expect(created.source).toBe('APPLE_HEALTH');
    expect(created.externalId).toBe('workout:abc');

    const second = await call('POST', '/api/activities', walk, ada.tokens.accessToken);
    expect(second.status).toBe(200);
    const deduped = await second.json() as { id: string; deduped: boolean };
    expect(deduped).toMatchObject({ id: created.id, deduped: true });

    const stats = await call('GET', '/api/users/me/stats', undefined, ada.tokens.accessToken);
    expect(await stats.json()).toMatchObject({ totalActivities: 1, totalDistance: 1600 });

    const listed = await call('GET', '/api/users/me/activities?source=APPLE_HEALTH', undefined, ada.tokens.accessToken);
    const page = await listed.json() as { items: Array<{ externalId: string | null }> };
    expect(page.items[0]?.externalId).toBe('workout:abc');

    const grace = await registerAndLogin('grace@example.com', 'Grace');
    const other = await call('POST', '/api/activities', walk, grace.tokens.accessToken);
    expect(other.status).toBe(201);

    const invalid = await call('POST', '/api/activities', { ...walk, source: 'NOT_A_SOURCE' }, ada.tokens.accessToken);
    expect(invalid.status).toBe(400);

    const connect = await call('POST', '/api/activities', {
      ...walk,
      source: 'HEALTH_CONNECT',
      externalId: 'distance:1',
    }, ada.tokens.accessToken);
    expect(connect.status).toBe(201);
  });

  it('lets an admin remove a member and blocks the last admin from being demoted', async () => {
    const ada = await registerAndLogin('ada@example.com', 'Ada');
    const grace = await registerAndLogin('grace@example.com', 'Grace');
    const created = await call('POST', '/api/teams', { name: 'Harbor Walkers', isPublic: false }, ada.tokens.accessToken);
    const team = await created.json() as { id: string };
    store.addInvite({
      id: 'invite-1',
      teamId: team.id,
      code: 'WALK-TOGETHER',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 86400000),
      email: 'grace@example.com',
    });

    const joined = await call('POST', '/api/teams/join', { inviteCode: 'WALK-TOGETHER' }, grace.tokens.accessToken);
    expect(joined.status).toBe(200);

    const demote = await call('PATCH', `/api/teams/${team.id}/members/${ada.user.id}`, { role: 'MEMBER' }, ada.tokens.accessToken);
    expect(demote.status).toBe(400);

    const removed = await call('DELETE', `/api/teams/${team.id}/members/${grace.user.id}`, undefined, ada.tokens.accessToken);
    expect(removed.status).toBe(204);

    const outsider = await call('GET', `/api/teams/${team.id}`, undefined, grace.tokens.accessToken);
    expect(outsider.status).toBe(404);
  });
});
