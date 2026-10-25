import { HttpError, json, noContent, readJson } from './errors';
import { requireUser } from './session';
import { ACTIVITY_SOURCES, UniqueActivityError } from './store';
import type { ActivityRecord, ActivitySourceName, Store, UserActivityStamp, UserRecord } from './store';
import { assertTeamMember } from './teams';

const METERS_PER_MILE = 1609.344;
const MAX_DISTANCE_METERS = 100_000;
const MAX_DURATION_SECONDS = 86_400;

export function paceMinutesPerMile(distanceMeters: number, durationSeconds: number): number {
  const miles = distanceMeters / METERS_PER_MILE;
  if (miles <= 0 || durationSeconds < 0) return 0;
  return (durationSeconds / 60) / miles;
}

function activityResponse(activity: ActivityRecord) {
  return {
    id: activity.id,
    userId: activity.userId,
    distance: activity.distance,
    duration: activity.duration,
    timestamp: activity.timestamp.toISOString(),
    notes: activity.notes,
    source: activity.source,
    externalId: activity.externalId,
    isPrivate: activity.isPrivate,
    createdAt: activity.createdAt.toISOString(),
    updatedAt: activity.updatedAt.toISOString(),
  };
}

function listItem(activity: ActivityRecord) {
  return {
    id: activity.id,
    distance: activity.distance,
    duration: activity.duration,
    pace: paceMinutesPerMile(activity.distance, activity.duration),
    timestamp: activity.timestamp.toISOString(),
    notes: activity.notes,
    isPrivate: activity.isPrivate,
    source: activity.source,
    externalId: activity.externalId,
    createdAt: activity.createdAt.toISOString(),
  };
}

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, 'Invalid date', 'VALIDATION');
  }
  return date;
}

function readActivityInput(body: Record<string, unknown>) {
  const distance = body.distance;
  const duration = body.duration;
  const timestampValue = body.timestamp;
  if (typeof distance !== 'number' || !Number.isFinite(distance) || distance <= 0 || distance > MAX_DISTANCE_METERS) {
    throw new HttpError(400, 'Distance must be a positive number of meters up to 100 km', 'VALIDATION');
  }
  if (typeof duration !== 'number' || !Number.isInteger(duration) || duration <= 0 || duration > MAX_DURATION_SECONDS) {
    throw new HttpError(400, 'Duration must be a positive whole number of seconds up to 24 hours', 'VALIDATION');
  }
  if (typeof timestampValue !== 'string') {
    throw new HttpError(400, 'Timestamp is required', 'VALIDATION');
  }
  const timestamp = new Date(timestampValue);
  if (Number.isNaN(timestamp.getTime())) {
    throw new HttpError(400, 'Timestamp is invalid', 'VALIDATION');
  }
  if (timestamp.getTime() > Date.now() + 5 * 60 * 1000) {
    throw new HttpError(400, 'Cannot log future activities', 'VALIDATION');
  }
  const notes = typeof body.notes === 'string' ? body.notes.slice(0, 2000) : null;
  return {
    distance,
    duration,
    timestamp,
    notes: notes && notes.length > 0 ? notes : null,
    isPrivate: body.isPrivate === true,
    source: readSource(body.source),
    externalId: readExternalId(body.externalId),
  };
}

function readSource(value: unknown): ActivitySourceName {
  if (value === undefined || value === null || value === '') return 'MANUAL';
  if (typeof value === 'string' && (ACTIVITY_SOURCES as readonly string[]).includes(value)) {
    return value as ActivitySourceName;
  }
  throw new HttpError(400, 'Invalid activity source', 'VALIDATION');
}

function readExternalId(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 200) {
    throw new HttpError(400, 'External id must be a string up to 200 characters', 'VALIDATION');
  }
  return value;
}

export function summarizeStamps(stamps: UserActivityStamp[]) {
  const days = new Map<string, number>();
  let totalDistance = 0;
  let totalDuration = 0;
  let lastActivityAt: Date | null = null;
  for (const stamp of stamps) {
    totalDistance += stamp.distance;
    totalDuration += stamp.duration;
    if (!lastActivityAt || stamp.timestamp > lastActivityAt) lastActivityAt = stamp.timestamp;
    const key = stamp.timestamp.toISOString().slice(0, 10);
    days.set(key, (days.get(key) || 0) + stamp.distance);
  }

  const sortedDays = [...days.keys()].sort();
  let longestStreak = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of sortedDays) {
    run = previous && nextUtcDay(previous) === day ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    previous = day;
  }

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let cursor = days.has(today) ? today : days.has(yesterday) ? yesterday : null;
  let currentStreak = 0;
  while (cursor && days.has(cursor)) {
    currentStreak += 1;
    cursor = previousUtcDay(cursor);
  }

  let bestDay = { date: null as string | null, distance: 0 };
  for (const [date, distance] of days) {
    if (distance > bestDay.distance) bestDay = { date, distance };
  }

  return {
    totalDistance,
    totalActivities: stamps.length,
    totalDuration,
    currentStreak,
    longestStreak,
    lastActivityAt,
    bestDay,
  };
}

function nextUtcDay(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function previousUtcDay(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export async function syncUserAggregates(store: Store, userId: string): Promise<void> {
  const stamps = await store.listActivityStamps(userId);
  const summary = summarizeStamps(stamps);
  await store.upsertUserStats(userId, {
    totalDistance: summary.totalDistance,
    totalActivities: summary.totalActivities,
    totalDuration: summary.totalDuration,
    currentStreak: summary.currentStreak,
    longestStreak: summary.longestStreak,
    lastActivityAt: summary.lastActivityAt,
  });

  const memberships = await store.listMemberships(userId);
  for (const membership of memberships) {
    const members = await store.listActiveMembers(membership.team.id);
    const userIds = members.map((member) => member.userId);
    const goals = await store.listGoals(membership.team.id);
    for (const goal of goals) {
      const aggregate = await store.aggregateActivities({
        userIds,
        start: goal.startDate,
        end: goal.endDate,
      });
      await store.upsertProgress(goal.id, {
        totalDistance: aggregate.distance,
        totalActivities: aggregate.count,
        totalDuration: aggregate.duration,
        lastActivityAt: aggregate.lastTimestamp,
      });
    }
  }
}

async function sharesTeam(store: Store, leftUserId: string, rightUserId: string): Promise<boolean> {
  const memberships = await store.listMemberships(leftUserId);
  for (const membership of memberships) {
    const member = await store.findActiveMember(membership.team.id, rightUserId);
    if (member) return true;
  }
  return false;
}

export async function createActivity(request: Request, store: Store): Promise<Response> {
  const user = await requireUser(request, store);
  const body = await readJson(request) as Record<string, unknown>;
  const input = readActivityInput(body);
  if (input.externalId) {
    const existing = await store.findActivityByExternal(user.id, input.source, input.externalId);
    if (existing) return json({ ...activityResponse(existing), deduped: true });
  }
  try {
    const activity = await store.createActivity({ userId: user.id, ...input });
    await syncUserAggregates(store, user.id);
    return json(activityResponse(activity), 201);
  } catch (error) {
    if (input.externalId && error instanceof UniqueActivityError) {
      const existing = await store.findActivityByExternal(user.id, input.source, input.externalId);
      if (existing) return json({ ...activityResponse(existing), deduped: true });
    }
    throw error;
  }
}

function filtersFromUrl(url: URL) {
  const source = url.searchParams.get('source');
  const allowed: readonly ActivitySourceName[] = ACTIVITY_SOURCES;
  const isPrivate = url.searchParams.get('isPrivate');
  const minDistance = url.searchParams.get('minDistance');
  const maxDistance = url.searchParams.get('maxDistance');
  const limit = Number(url.searchParams.get('limit') || 20);
  return {
    source: source && allowed.includes(source as ActivitySourceName) ? source as ActivitySourceName : undefined,
    isPrivate: isPrivate === 'true' ? true : isPrivate === 'false' ? false : undefined,
    start: parseDate(url.searchParams.get('startDate')),
    end: parseDate(url.searchParams.get('endDate')),
    minDistance: minDistance ? Number(minDistance) : undefined,
    maxDistance: maxDistance ? Number(maxDistance) : undefined,
    limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 20,
  };
}

export async function listMyActivities(request: Request, store: Store): Promise<Response> {
  const user = await requireUser(request, store);
  const url = new URL(request.url);
  const filters = filtersFromUrl(url);
  const cursor = url.searchParams.get('cursor');
  let before: { timestamp: Date; id: string } | undefined;
  if (cursor) {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const separator = decoded.lastIndexOf('|');
    const timestamp = new Date(decoded.slice(0, separator));
    const id = decoded.slice(separator + 1);
    if (Number.isNaN(timestamp.getTime()) || !id) {
      throw new HttpError(400, 'Invalid cursor', 'VALIDATION');
    }
    before = { timestamp, id };
  }
  const rows = await store.queryActivities({
    userIds: [user.id],
    ...filters,
    before,
    limit: filters.limit + 1,
  });
  const hasMore = rows.length > filters.limit;
  const page = hasMore ? rows.slice(0, filters.limit) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last
    ? Buffer.from(`${last.timestamp.toISOString()}|${last.id}`).toString('base64url')
    : null;
  return json({
    items: page.map(listItem),
    nextCursor,
    hasMore,
  });
}

export async function listTeamActivities(request: Request, store: Store, teamId: string): Promise<Response> {
  const user = await requireUser(request, store);
  await assertTeamMember(store, teamId, user);
  const members = await store.listActiveMembers(teamId);
  const otherIds = members.map((member) => member.userId).filter((id) => id !== user.id);
  const filters = filtersFromUrl(new URL(request.url));
  const [own, others] = await Promise.all([
    store.queryActivities({ userIds: [user.id], ...filters, limit: undefined }),
    otherIds.length
      ? store.queryActivities({ userIds: otherIds, ...filters, isPrivate: false, limit: undefined })
      : Promise.resolve([]),
  ]);
  const merged = [...own, ...others].sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime());
  return json(merged.map(listItem));
}

export async function getActivity(request: Request, store: Store, activityId: string): Promise<Response> {
  const user = await requireUser(request, store);
  const activity = await visibleActivity(store, user, activityId);
  return json(activityResponse(activity));
}

async function visibleActivity(store: Store, user: UserRecord, activityId: string): Promise<ActivityRecord> {
  const activity = await store.findActivity(activityId);
  if (!activity) throw new HttpError(404, 'Activity not found', 'NOT_FOUND');
  if (activity.userId === user.id) return activity;
  if (activity.isPrivate || !(await sharesTeam(store, user.id, activity.userId))) {
    throw new HttpError(404, 'Activity not found', 'NOT_FOUND');
  }
  return activity;
}

export async function updateActivity(request: Request, store: Store, activityId: string): Promise<Response> {
  const user = await requireUser(request, store);
  const activity = await store.findActivity(activityId);
  if (!activity || activity.userId !== user.id) {
    throw new HttpError(404, 'Activity not found', 'NOT_FOUND');
  }
  const body = await readJson(request) as Record<string, unknown>;
  const patch: { notes?: string | null; isPrivate?: boolean } = {};
  if (body.notes !== undefined) {
    patch.notes = typeof body.notes === 'string' && body.notes.length > 0 ? body.notes.slice(0, 2000) : null;
  }
  if (typeof body.isPrivate === 'boolean') patch.isPrivate = body.isPrivate;
  const updated = await store.updateActivity(activity.id, patch);
  await syncUserAggregates(store, user.id);
  return json(activityResponse(updated));
}

export async function deleteActivity(request: Request, store: Store, activityId: string): Promise<Response> {
  const user = await requireUser(request, store);
  const activity = await store.findActivity(activityId);
  if (!activity || activity.userId !== user.id) {
    throw new HttpError(404, 'Activity not found', 'NOT_FOUND');
  }
  await store.deleteActivity(activity.id);
  await syncUserAggregates(store, user.id);
  return noContent();
}

function statsResponse(summary: ReturnType<typeof summarizeStamps>, week: { distance: number; duration: number; count: number }, month: { distance: number; duration: number; count: number }) {
  return {
    totalDistance: summary.totalDistance,
    totalActivities: summary.totalActivities,
    totalDuration: summary.totalDuration,
    averageDistance: summary.totalActivities > 0 ? summary.totalDistance / summary.totalActivities : 0,
    averagePace: paceMinutesPerMile(summary.totalDistance, summary.totalDuration),
    currentStreak: summary.currentStreak,
    longestStreak: summary.longestStreak,
    lastActivityDate: summary.lastActivityAt ? summary.lastActivityAt.toISOString() : null,
    weeklyStats: {
      distance: week.distance,
      duration: week.duration,
      activities: week.count,
    },
    monthlyStats: {
      distance: month.distance,
      duration: month.duration,
      activities: month.count,
    },
  };
}

function startOfUtcWeek(date: Date): Date {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = start.getUTCDay();
  const delta = weekday === 0 ? 6 : weekday - 1;
  start.setUTCDate(start.getUTCDate() - delta);
  return start;
}

export async function myStats(request: Request, store: Store): Promise<Response> {
  const user = await requireUser(request, store);
  const stamps = await store.listActivityStamps(user.id);
  const summary = summarizeStamps(stamps);
  const weekStart = startOfUtcWeek(new Date());
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const [week, month] = await Promise.all([
    store.aggregateActivities({ userIds: [user.id], start: weekStart }),
    store.aggregateActivities({ userIds: [user.id], start: monthStart }),
  ]);
  return json(statsResponse(summary, week, month));
}

export async function teamStats(request: Request, store: Store, teamId: string): Promise<Response> {
  const user = await requireUser(request, store);
  await assertTeamMember(store, teamId, user);
  const members = await store.listActiveMembers(teamId);
  const userIds = members.map((member) => member.userId);
  const weekStart = startOfUtcWeek(new Date());
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const [all, week, month] = await Promise.all([
    store.aggregateActivities({ userIds }),
    store.aggregateActivities({ userIds, start: weekStart }),
    store.aggregateActivities({ userIds, start: monthStart }),
  ]);
  return json(statsResponse({
    totalDistance: all.distance,
    totalActivities: all.count,
    totalDuration: all.duration,
    currentStreak: 0,
    longestStreak: 0,
    lastActivityAt: all.lastTimestamp,
    bestDay: { date: null, distance: 0 },
  }, week, month));
}

function startOfBucket(date: Date, period: 'daily' | 'weekly' | 'monthly'): Date {
  if (period === 'weekly') return startOfUtcWeek(date);
  if (period === 'monthly') return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addBucket(date: Date, period: 'daily' | 'weekly' | 'monthly'): Date {
  const next = new Date(date);
  if (period === 'weekly') next.setUTCDate(next.getUTCDate() + 7);
  else if (period === 'monthly') next.setUTCMonth(next.getUTCMonth() + 1);
  else next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

export async function activitySummary(request: Request, store: Store): Promise<Response> {
  const user = await requireUser(request, store);
  const url = new URL(request.url);
  const periodParam = url.searchParams.get('period');
  const period = periodParam === 'weekly' || periodParam === 'monthly' ? periodParam : 'daily';
  const end = parseDate(url.searchParams.get('endDate')) ?? new Date();
  const start = parseDate(url.searchParams.get('startDate')) ?? new Date(end.getTime() - 29 * 86400000);
  const limit = Math.min(Number(url.searchParams.get('limit') || 60), 120);
  const teamId = url.searchParams.get('teamId');

  let userIds = [user.id];
  if (teamId) {
    await assertTeamMember(store, teamId, user);
    userIds = (await store.listActiveMembers(teamId)).map((member) => member.userId);
  }
  const rows = await store.queryActivities({ userIds, start, end });
  const buckets: Date[] = [];
  let cursor = startOfBucket(start, period);
  const last = startOfBucket(end, period);
  while (cursor.getTime() <= last.getTime() && buckets.length < 400) {
    buckets.push(cursor);
    cursor = addBucket(cursor, period);
  }
  const selected = buckets.slice(Math.max(0, buckets.length - (Number.isFinite(limit) ? limit : 60)));
  const summaries = selected.map((bucketStart) => {
    const bucketEnd = addBucket(bucketStart, period);
    const included = rows.filter((row) => row.timestamp >= bucketStart && row.timestamp < bucketEnd);
    const totalDistance = included.reduce((sum, row) => sum + row.distance, 0);
    const totalDuration = included.reduce((sum, row) => sum + row.duration, 0);
    const activeDays = new Set(included.map((row) => row.timestamp.toISOString().slice(0, 10))).size;
    return {
      startDate: bucketStart.toISOString(),
      endDate: new Date(bucketEnd.getTime() - 1).toISOString(),
      totalDistance,
      totalDuration,
      totalActivities: included.length,
      averagePace: paceMinutesPerMile(totalDistance, totalDuration),
      averageDistance: included.length > 0 ? totalDistance / included.length : 0,
      activeDays,
    };
  });
  return json({ summaries });
}
