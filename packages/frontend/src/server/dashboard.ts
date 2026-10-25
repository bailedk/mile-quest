import { json } from './errors';
import { paceMinutesPerMile, summarizeStamps } from './activities';
import { requireUser } from './session';
import type { ActivityRecord, Store } from './store';

function goalMetrics(current: number, target: number, start: Date, end: Date) {
  const percentComplete = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const now = Date.now();
  const daysRemaining = Math.max(0, Math.ceil((end.getTime() - now) / 86400000));
  const span = Math.max(0, end.getTime() - start.getTime());
  const elapsed = Math.min(Math.max(0, now - start.getTime()), span);
  const expected = span > 0 ? target * (elapsed / span) : target;
  return {
    percentComplete,
    daysRemaining,
    isOnTrack: current + 0.0001 >= expected || percentComplete >= 100,
  };
}

async function recentForTeam(store: Store, teamId: string, teamName: string, userId: string, memberIds: string[]) {
  const others = memberIds.filter((id) => id !== userId);
  const [own, pub] = await Promise.all([
    store.queryActivities({ userIds: [userId], limit: 10 }),
    others.length ? store.queryActivities({ userIds: others, isPrivate: false, limit: 10 }) : Promise.resolve([]),
  ]);
  return [...own, ...pub].map((activity) => ({ activity, teamName, teamId }));
}

function activityCard(activity: ActivityRecord, teamName: string, viewerId: string) {
  return {
    id: activity.id,
    userId: activity.userId,
    distance: activity.distance,
    duration: activity.duration,
    pace: paceMinutesPerMile(activity.distance, activity.duration),
    timestamp: activity.timestamp.toISOString(),
    createdAt: activity.timestamp.toISOString(),
    note: activity.notes,
    notes: activity.notes,
    teamName,
    userName: activity.userName || 'Walker',
    isOwn: activity.userId === viewerId,
  };
}

export async function dashboard(request: Request, store: Store): Promise<Response> {
  const user = await requireUser(request, store);
  const memberships = await store.listMemberships(user.id);
  const stamps = await store.listActivityStamps(user.id);
  const summary = summarizeStamps(stamps);
  const weekStart = startOfUtcWeek(new Date());
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const weekStamps = stamps.filter((stamp) => stamp.timestamp >= weekStart);
  const monthStamps = stamps.filter((stamp) => stamp.timestamp >= monthStart);

  const teams = [];
  const teamLeaderboards = [];
  const recent: Array<{ activity: ActivityRecord; teamName: string }> = [];

  for (const membership of memberships) {
    const members = await store.listActiveMembers(membership.team.id);
    const memberIds = members.map((member) => member.userId);
    const goals = await store.listGoals(membership.team.id);
    const active = goals.find((goal) => goal.status === 'ACTIVE') ?? null;
    const window = active
      ? { start: active.startDate, end: active.endDate }
      : {};
    const total = await store.aggregateActivities({ userIds: memberIds, ...window });
    const metrics = active
      ? goalMetrics(total.distance, active.targetDistance, active.startDate, active.endDate)
      : null;

    teams.push({
      id: membership.team.id,
      name: membership.team.name,
      description: membership.team.description,
      avatarUrl: membership.team.avatarUrl,
      memberCount: membership.memberCount,
      role: membership.member.role === 'ADMIN' ? 'admin' : 'member',
      progress: active && metrics ? {
        goalId: active.id,
        goalName: active.name,
        currentDistance: total.distance,
        targetDistance: active.targetDistance,
        percentComplete: metrics.percentComplete,
        daysRemaining: metrics.daysRemaining,
        isOnTrack: metrics.isOnTrack,
        startDate: active.startDate.toISOString(),
        endDate: active.endDate.toISOString(),
        status: active.status,
      } : null,
    });

    const leaderboardMembers = [];
    for (const member of members) {
      const aggregate = await store.aggregateActivities({
        userIds: [member.userId],
        ...window,
        ...(member.userId === user.id ? {} : { isPrivate: false }),
      });
      leaderboardMembers.push({
        userId: member.userId,
        name: member.user.name,
        avatarUrl: member.user.avatarUrl,
        distance: aggregate.distance,
        percentage: active && active.targetDistance > 0
          ? (aggregate.distance / active.targetDistance) * 100
          : 0,
      });
    }
    leaderboardMembers.sort((left, right) => right.distance - left.distance);
    teamLeaderboards.push({
      teamId: membership.team.id,
      teamName: membership.team.name,
      members: leaderboardMembers,
    });

    const cards = await recentForTeam(store, membership.team.id, membership.team.name, user.id, memberIds);
    recent.push(...cards.map((card) => ({ activity: card.activity, teamName: card.teamName })));
  }

  const seen = new Set<string>();
  const recentActivities = recent
    .sort((left, right) => right.activity.timestamp.getTime() - left.activity.timestamp.getTime())
    .filter((item) => {
      if (seen.has(item.activity.id)) return false;
      seen.add(item.activity.id);
      return true;
    })
    .slice(0, 10)
    .map((item) => activityCard(item.activity, item.teamName, user.id));

  return json({
    teams,
    recentActivities,
    personalStats: {
      totalDistance: summary.totalDistance,
      totalActivities: summary.totalActivities,
      currentStreak: summary.currentStreak,
      bestDay: {
        date: summary.bestDay.date,
        distance: summary.bestDay.distance,
      },
      thisWeek: {
        distance: weekStamps.reduce((sum, stamp) => sum + stamp.distance, 0),
        activities: weekStamps.length,
      },
      thisMonth: {
        distance: monthStamps.reduce((sum, stamp) => sum + stamp.distance, 0),
        activities: monthStamps.length,
      },
    },
    teamLeaderboards,
  });
}

function startOfUtcWeek(date: Date): Date {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = start.getUTCDay();
  const delta = weekday === 0 ? 6 : weekday - 1;
  start.setUTCDate(start.getUTCDate() - delta);
  return start;
}
