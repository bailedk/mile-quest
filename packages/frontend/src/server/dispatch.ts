import { login, logout, refresh, register, verifyEmail } from './auth';
import {
  activitySummary,
  createActivity,
  deleteActivity,
  getActivity,
  listMyActivities,
  listTeamActivities,
  myStats,
  teamStats,
  updateActivity,
} from './activities';
import { dashboard } from './dashboard';
import { HttpError } from './errors';
import {
  createGoal,
  deleteGoal,
  getGoal,
  goalProgress,
  listGoals,
  updateGoal,
} from './goals';
import type { Store } from './store';
import {
  createTeam,
  deleteTeam,
  getTeam,
  joinTeam,
  leaveTeam,
  listMyTeams,
  removeMember,
  updateMemberRole,
  updateTeam,
} from './teams';

export async function dispatch(request: Request, store: Store): Promise<Response> {
  try {
    return await route(request, store);
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.shape === 'auth') {
        return Response.json({ error: error.message }, { status: error.status });
      }
      return Response.json(
        { error: { message: error.message, code: error.code } },
        { status: error.status },
      );
    }
    console.error(error);
    return Response.json(
      { error: { message: 'Internal server error', code: 'INTERNAL' } },
      { status: 500 },
    );
  }
}

async function route(request: Request, store: Store): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] !== 'api') {
    return Response.json({ error: { message: 'Not found', code: 'NOT_FOUND' } }, { status: 404 });
  }
  const [root, second, third, fourth, fifth] = parts.slice(1);
  const method = request.method.toUpperCase();

  if (root === 'auth' && second === 'register' && method === 'POST') return register(request, store);
  if (root === 'auth' && second === 'login' && method === 'POST') return login(request, store);
  if (root === 'auth' && second === 'refresh' && method === 'POST') return refresh(request, store);
  if (root === 'auth' && second === 'logout' && method === 'POST') return logout(request, store);
  if (root === 'auth' && second === 'verify-email' && method === 'POST') return verifyEmail(request, store);

  if (root === 'users' && second === 'me' && third === 'teams' && method === 'GET') return listMyTeams(request, store);
  if (root === 'users' && second === 'me' && third === 'activities' && method === 'GET') return listMyActivities(request, store);
  if (root === 'users' && second === 'me' && third === 'stats' && method === 'GET') return myStats(request, store);

  if (root === 'dashboard' && method === 'GET') return dashboard(request, store);

  if (root === 'activities' && second === 'summary' && method === 'GET') return activitySummary(request, store);
  if (root === 'activities' && !second && method === 'POST') return createActivity(request, store);
  if (root === 'activities' && second && !third && method === 'GET') return getActivity(request, store, second);
  if (root === 'activities' && second && !third && method === 'PATCH') return updateActivity(request, store, second);
  if (root === 'activities' && second && !third && method === 'DELETE') return deleteActivity(request, store, second);

  if (root === 'teams' && !second && method === 'POST') return createTeam(request, store);
  if (root === 'teams' && second === 'join' && method === 'POST') return joinTeam(request, store);
  if (root === 'teams' && second && !third && method === 'GET') return getTeam(request, store, second);
  if (root === 'teams' && second && !third && method === 'PATCH') return updateTeam(request, store, second);
  if (root === 'teams' && second && !third && method === 'DELETE') return deleteTeam(request, store, second);

  if (root === 'teams' && third === 'members' && fourth === 'me' && method === 'DELETE') {
    return leaveTeam(request, store, second);
  }
  if (root === 'teams' && third === 'members' && fourth && method === 'DELETE') {
    return removeMember(request, store, second, fourth);
  }
  if (root === 'teams' && third === 'members' && fourth && method === 'PATCH') {
    return updateMemberRole(request, store, second, fourth);
  }

  if (root === 'teams' && third === 'goals' && !fourth && method === 'GET') return listGoals(request, store, second);
  if (root === 'teams' && third === 'goals' && !fourth && method === 'POST') return createGoal(request, store, second);
  if (root === 'teams' && third === 'goals' && fourth && fifth === 'progress' && method === 'GET') {
    return goalProgress(request, store, second, fourth);
  }
  if (root === 'teams' && third === 'goals' && fourth && !fifth && method === 'GET') return getGoal(request, store, second, fourth);
  if (root === 'teams' && third === 'goals' && fourth && !fifth && method === 'PUT') return updateGoal(request, store, second, fourth);
  if (root === 'teams' && third === 'goals' && fourth && !fifth && method === 'DELETE') return deleteGoal(request, store, second, fourth);

  if (root === 'teams' && third === 'activities' && method === 'GET') return listTeamActivities(request, store, second);
  if (root === 'teams' && third === 'stats' && method === 'GET') return teamStats(request, store, second);

  return Response.json({ error: { message: 'Not found', code: 'NOT_FOUND' } }, { status: 404 });
}
