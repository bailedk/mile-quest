import { HttpError, json, noContent, readJson } from './errors';
import { measureRoute, type LatLng } from './geo';
import { requireUser } from './session';
import type { GoalRecord, LocationJson, Store, StoredWaypoint } from './store';
import { assertTeamAdmin, assertTeamMember } from './teams';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readLocation(value: unknown, label: string): LocationJson {
  if (!isRecord(value) || typeof value.lat !== 'number' || typeof value.lng !== 'number') {
    throw new HttpError(400, `${label} must include lat and lng`, 'VALIDATION');
  }
  if (value.lat < -90 || value.lat > 90 || value.lng < -180 || value.lng > 180) {
    throw new HttpError(400, `${label} coordinates are out of range`, 'VALIDATION');
  }
  return {
    lat: value.lat,
    lng: value.lng,
    address: typeof value.address === 'string' ? value.address : undefined,
  };
}

function readWaypoints(value: unknown): StoredWaypoint[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'Waypoints must be an array', 'VALIDATION');
  }
  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new HttpError(400, 'Each waypoint must be an object', 'VALIDATION');
    }
    const position = isRecord(item.position) ? item.position : item;
    if (typeof position.lat !== 'number' || typeof position.lng !== 'number') {
      throw new HttpError(400, 'Each waypoint needs lat and lng', 'VALIDATION');
    }
    return {
      id: typeof item.id === 'string' ? item.id : `waypoint-${index + 1}`,
      position: { lat: position.lat, lng: position.lng },
      address: typeof item.address === 'string' ? item.address : undefined,
      order: typeof item.order === 'number' ? item.order : index + 1,
      isLocked: item.isLocked === true,
    };
  });
}

function waypointResponse(location: { lat: number; lng: number; address?: string }, order: number) {
  return {
    name: location.address || `Point ${order + 1}`,
    address: location.address || '',
    coordinates: { lat: location.lat, lng: location.lng },
    order,
  };
}

async function currentDistance(store: Store, goal: GoalRecord): Promise<number> {
  const members = await store.listActiveMembers(goal.teamId);
  const aggregate = await store.aggregateActivities({
    userIds: members.map((member) => member.userId),
    start: goal.startDate,
    end: goal.endDate,
  });
  return aggregate.distance;
}

export async function goalResponse(store: Store, goal: GoalRecord) {
  const intermediates = goal.waypoints.map((waypoint, index) => {
    const lat = waypoint.position?.lat ?? waypoint.lat ?? 0;
    const lng = waypoint.position?.lng ?? waypoint.lng ?? 0;
    return waypointResponse({ lat, lng, address: waypoint.address }, waypoint.order ?? index + 1);
  });
  return {
    id: goal.id,
    teamId: goal.teamId,
    name: goal.name,
    description: goal.description,
    targetDate: goal.targetDate ? goal.targetDate.toISOString() : goal.endDate.toISOString(),
    startDate: goal.startDate.toISOString(),
    endDate: goal.endDate.toISOString(),
    status: goal.status,
    waypoints: [
      waypointResponse(goal.startLocation, 0),
      ...intermediates,
      waypointResponse(goal.endLocation, intermediates.length + 1),
    ],
    routeData: goal.routeData,
    totalDistance: goal.targetDistance,
    currentDistance: await currentDistance(store, goal),
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
  };
}

async function buildGoalRoute(start: LocationJson, end: LocationJson, waypoints: StoredWaypoint[]) {
  const points: LatLng[] = [
    start,
    ...waypoints.map((waypoint) => ({
      lat: waypoint.position?.lat ?? waypoint.lat ?? start.lat,
      lng: waypoint.position?.lng ?? waypoint.lng ?? start.lng,
    })),
    end,
  ];
  const measured = await measureRoute(points);
  return {
    targetDistance: measured.meters,
    routePolyline: measured.polyline,
    routeData: {
      waypoints: points.map((point, order) => ({
        name: order === 0 ? (start.address || 'Start') : order === points.length - 1 ? (end.address || 'End') : `Point ${order + 1}`,
        address: '',
        coordinates: point,
        order,
      })),
      segments: measured.segments,
      totalDistance: measured.meters,
      totalDuration: measured.totalDuration,
    },
  };
}

function readTargetDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' && !(value instanceof Date)) {
    throw new HttpError(400, 'Target date is invalid', 'VALIDATION');
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, 'Target date is invalid', 'VALIDATION');
  }
  return date;
}

export async function createGoal(request: Request, store: Store, teamId: string): Promise<Response> {
  const user = await requireUser(request, store);
  await assertTeamMember(store, teamId, user);
  const body = await readJson(request) as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) throw new HttpError(400, 'Goal name is required', 'VALIDATION');
  const start = readLocation(body.startLocation, 'Start location');
  const end = readLocation(body.endLocation, 'End location');
  const waypoints = readWaypoints(body.waypoints);
  const targetDate = readTargetDate(body.targetDate);
  const startDate = new Date();
  const endDate = targetDate ?? new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (endDate.getTime() <= startDate.getTime()) {
    throw new HttpError(400, 'Target date must be in the future', 'VALIDATION');
  }
  const route = await buildGoalRoute(start, end, waypoints);
  const goal = await store.createGoal({
    teamId,
    name,
    description: typeof body.description === 'string' ? body.description : null,
    targetDate,
    startDate,
    endDate,
    startLocation: start,
    endLocation: end,
    waypoints,
    createdById: user.id,
    ...route,
  });
  await store.upsertProgress(goal.id, {
    totalDistance: 0,
    totalActivities: 0,
    totalDuration: 0,
    lastActivityAt: null,
  });
  return json(await goalResponse(store, goal), 201);
}

export async function listGoals(request: Request, store: Store, teamId: string): Promise<Response> {
  const user = await requireUser(request, store);
  await assertTeamMember(store, teamId, user);
  const goals = await store.listGoals(teamId);
  return json(await Promise.all(goals.map((goal) => goalResponse(store, goal))));
}

export async function getGoal(request: Request, store: Store, teamId: string, goalId: string): Promise<Response> {
  const user = await requireUser(request, store);
  await assertTeamMember(store, teamId, user);
  const goal = await store.findGoal(teamId, goalId);
  if (!goal) throw new HttpError(404, 'Goal not found', 'NOT_FOUND');
  return json(await goalResponse(store, goal));
}

export async function updateGoal(request: Request, store: Store, teamId: string, goalId: string): Promise<Response> {
  const user = await requireUser(request, store);
  await assertTeamAdmin(store, teamId, user);
  const existing = await store.findGoal(teamId, goalId);
  if (!existing) throw new HttpError(404, 'Goal not found', 'NOT_FOUND');
  const body = await readJson(request) as Record<string, unknown>;
  const patch: Partial<GoalRecord> = {};
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim();
  if (body.description !== undefined) {
    patch.description = typeof body.description === 'string' ? body.description : null;
  }
  if (body.status !== undefined) {
    if (body.status !== 'ACTIVE' && body.status !== 'PASSED' && body.status !== 'FAILED') {
      throw new HttpError(400, 'Status must be ACTIVE, PASSED, or FAILED', 'VALIDATION');
    }
    patch.status = body.status;
    patch.completedAt = body.status === 'ACTIVE' ? null : new Date();
  }
  if (body.targetDate !== undefined) {
    const targetDate = readTargetDate(body.targetDate);
    patch.targetDate = targetDate;
    if (targetDate) patch.endDate = targetDate;
  }
  if (body.startLocation !== undefined || body.endLocation !== undefined || body.waypoints !== undefined) {
    const start = body.startLocation !== undefined ? readLocation(body.startLocation, 'Start location') : existing.startLocation;
    const end = body.endLocation !== undefined ? readLocation(body.endLocation, 'End location') : existing.endLocation;
    const waypoints = body.waypoints !== undefined ? readWaypoints(body.waypoints) : existing.waypoints;
    const route = await buildGoalRoute(start, end, waypoints);
    Object.assign(patch, route, { startLocation: start, endLocation: end, waypoints });
  }
  const goal = await store.updateGoal(existing.id, patch);
  return json(await goalResponse(store, goal));
}

export async function deleteGoal(request: Request, store: Store, teamId: string, goalId: string): Promise<Response> {
  const user = await requireUser(request, store);
  await assertTeamAdmin(store, teamId, user);
  const goal = await store.findGoal(teamId, goalId);
  if (!goal) throw new HttpError(404, 'Goal not found', 'NOT_FOUND');
  await store.deleteGoal(goal.id);
  return noContent();
}

export async function goalProgress(request: Request, store: Store, teamId: string, goalId: string): Promise<Response> {
  const user = await requireUser(request, store);
  await assertTeamMember(store, teamId, user);
  const goal = await store.findGoal(teamId, goalId);
  if (!goal) throw new HttpError(404, 'Goal not found', 'NOT_FOUND');
  const distance = await currentDistance(store, goal);
  const now = Date.now();
  const elapsedDays = Math.max(1, (now - goal.startDate.getTime()) / 86400000);
  const daysRemaining = Math.max(0, Math.ceil((goal.endDate.getTime() - now) / 86400000));
  const percentageComplete = goal.targetDistance > 0
    ? Math.min(100, (distance / goal.targetDistance) * 100)
    : 0;
  const span = goal.endDate.getTime() - goal.startDate.getTime();
  const expected = span > 0
    ? goal.targetDistance * (Math.min(Math.max(0, now - goal.startDate.getTime()), span) / span)
    : goal.targetDistance;
  return json({
    totalDistance: distance,
    targetDistance: goal.targetDistance,
    percentageComplete,
    remainingDistance: Math.max(0, goal.targetDistance - distance),
    averageDailyDistance: distance / elapsedDays,
    daysRemaining,
    onTrack: distance + 0.0001 >= expected || percentageComplete >= 100,
  });
}
