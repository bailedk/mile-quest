import { HttpError, json, noContent, readJson } from './errors';
import { requireUser } from './session';
import type { MemberWithUser, Store, TeamRecord, TeamRoleName, UserRecord } from './store';

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined;
}

function teamResponse(team: TeamRecord, members: MemberWithUser[]) {
  return {
    id: team.id,
    name: team.name,
    description: team.description,
    avatarUrl: team.avatarUrl,
    isPublic: team.isPublic,
    createdById: team.createdById,
    createdAt: team.createdAt.toISOString(),
    updatedAt: team.updatedAt.toISOString(),
    members: members.map((member) => ({
      id: member.id,
      userId: member.userId,
      role: member.role,
      joinedAt: member.joinedAt.toISOString(),
      leftAt: member.leftAt ? member.leftAt.toISOString() : null,
      user: member.user,
    })),
    _count: { members: members.length },
  };
}

async function requireMember(store: Store, teamId: string, userId: string) {
  const team = await store.findTeamById(teamId);
  if (!team || team.deletedAt) {
    throw new HttpError(404, 'Team not found', 'NOT_FOUND');
  }
  const member = await store.findActiveMember(teamId, userId);
  if (!member) {
    throw new HttpError(403, 'You are not a member of this team', 'FORBIDDEN');
  }
  return { team, member };
}

async function requireAdmin(store: Store, teamId: string, userId: string) {
  const access = await requireMember(store, teamId, userId);
  if (access.member.role !== 'ADMIN') {
    throw new HttpError(403, 'Admin access is required', 'FORBIDDEN');
  }
  return access;
}

export async function listMyTeams(request: Request, store: Store): Promise<Response> {
  const user = await requireUser(request, store);
  const memberships = await store.listMemberships(user.id);
  return json(memberships.map(({ member, team, memberCount }) => ({
    id: team.id,
    name: team.name,
    description: team.description,
    avatarUrl: team.avatarUrl,
    memberCount,
    role: member.role,
    joinedAt: member.joinedAt.toISOString(),
  })));
}

export async function createTeam(request: Request, store: Store): Promise<Response> {
  const user = await requireUser(request, store);
  const body = await readJson(request) as Record<string, unknown>;
  const name = asString(body.name);
  if (!name || name.length > 100) {
    throw new HttpError(400, 'Team name is required', 'VALIDATION');
  }
  if (await store.findTeamByName(name)) {
    throw new HttpError(409, 'A team with this name already exists', 'CONFLICT');
  }
  const description = asString(body.description) || null;
  const avatarUrl = asString(body.avatarUrl) || null;
  const isPublic = typeof body.isPublic === 'boolean' ? body.isPublic : true;
  const team = await store.createTeam({
    name,
    description,
    avatarUrl,
    isPublic,
    createdById: user.id,
  });
  await store.addMember({ teamId: team.id, userId: user.id, role: 'ADMIN' });
  const members = await store.listActiveMembers(team.id);
  return json(teamResponse(team, members), 201);
}

export async function getTeam(request: Request, store: Store, teamId: string): Promise<Response> {
  const user = await requireUser(request, store);
  const team = await store.findTeamById(teamId);
  if (!team || team.deletedAt) {
    throw new HttpError(404, 'Team not found', 'NOT_FOUND');
  }
  const member = await store.findActiveMember(teamId, user.id);
  if (!member && !team.isPublic) {
    throw new HttpError(404, 'Team not found', 'NOT_FOUND');
  }
  const members = await store.listActiveMembers(teamId);
  return json(teamResponse(team, members));
}

export async function updateTeam(request: Request, store: Store, teamId: string): Promise<Response> {
  const user = await requireUser(request, store);
  await requireAdmin(store, teamId, user.id);
  const body = await readJson(request) as Record<string, unknown>;
  const patch: { name?: string; description?: string | null; avatarUrl?: string | null; isPublic?: boolean } = {};
  if (body.name !== undefined) {
    const name = asString(body.name);
    if (!name) throw new HttpError(400, 'Team name is required', 'VALIDATION');
    const existing = await store.findTeamByName(name);
    if (existing && existing.id !== teamId) {
      throw new HttpError(409, 'A team with this name already exists', 'CONFLICT');
    }
    patch.name = name;
  }
  if (body.description !== undefined) patch.description = asString(body.description) || null;
  if (body.avatarUrl !== undefined) patch.avatarUrl = asString(body.avatarUrl) || null;
  if (typeof body.isPublic === 'boolean') patch.isPublic = body.isPublic;
  const team = await store.updateTeam(teamId, patch);
  const members = await store.listActiveMembers(teamId);
  return json(teamResponse(team, members));
}

export async function deleteTeam(request: Request, store: Store, teamId: string): Promise<Response> {
  const user = await requireUser(request, store);
  await requireAdmin(store, teamId, user.id);
  await store.softDeleteTeam(teamId);
  return noContent();
}

export async function joinTeam(request: Request, store: Store): Promise<Response> {
  const user = await requireUser(request, store);
  const body = await readJson(request) as Record<string, unknown>;
  const teamId = asString(body.teamId);
  const inviteCode = asString(body.inviteCode);
  if (!teamId && !inviteCode) {
    throw new HttpError(400, 'A team id or invite code is required', 'VALIDATION');
  }

  let resolvedTeamId = teamId;
  if (inviteCode) {
    const invite = await store.findInviteByCode(inviteCode);
    if (!invite || invite.status !== 'PENDING' || invite.expiresAt.getTime() <= Date.now()) {
      throw new HttpError(400, 'Invite code is invalid or expired', 'VALIDATION');
    }
    resolvedTeamId = invite.teamId;
    await store.markInviteAccepted(invite.id, user.id);
  }

  const team = resolvedTeamId ? await store.findTeamById(resolvedTeamId) : null;
  if (!team || team.deletedAt) {
    throw new HttpError(404, 'Team not found', 'NOT_FOUND');
  }
  if (!inviteCode && !team.isPublic) {
    throw new HttpError(403, 'This team is private', 'FORBIDDEN');
  }

  const existing = await store.findActiveMember(team.id, user.id);
  if (!existing) {
    await store.addMember({ teamId: team.id, userId: user.id, role: 'MEMBER' });
  }
  const members = await store.listActiveMembers(team.id);
  return json(teamResponse(team, members));
}

export async function leaveTeam(request: Request, store: Store, teamId: string): Promise<Response> {
  const user = await requireUser(request, store);
  const { member } = await requireMember(store, teamId, user.id);
  const members = await store.listActiveMembers(teamId);
  const remaining = members.filter((item) => item.userId !== user.id);
  await store.markMemberLeft(member.id);
  if (remaining.length === 0) {
    await store.softDeleteTeam(teamId);
    return noContent();
  }
  if (!remaining.some((item) => item.role === 'ADMIN')) {
    const oldest = [...remaining].sort((left, right) => left.joinedAt.getTime() - right.joinedAt.getTime())[0];
    await store.setMemberRole(oldest.id, 'ADMIN');
  }
  return noContent();
}

export async function removeMember(request: Request, store: Store, teamId: string, userId: string): Promise<Response> {
  const user = await requireUser(request, store);
  await requireAdmin(store, teamId, user.id);
  if (userId === user.id) {
    throw new HttpError(400, 'Use the leave endpoint to remove yourself', 'VALIDATION');
  }
  const target = await store.findActiveMember(teamId, userId);
  if (!target) throw new HttpError(404, 'Member not found', 'NOT_FOUND');
  if (target.role === 'ADMIN') {
    const members = await store.listActiveMembers(teamId);
    const otherAdmins = members.filter((item) => item.role === 'ADMIN' && item.userId !== userId);
    if (otherAdmins.length === 0) {
      throw new HttpError(400, 'Promote another admin before removing this member', 'VALIDATION');
    }
  }
  await store.markMemberLeft(target.id);
  return noContent();
}

export async function updateMemberRole(request: Request, store: Store, teamId: string, userId: string): Promise<Response> {
  const user = await requireUser(request, store);
  await requireAdmin(store, teamId, user.id);
  const body = await readJson(request) as Record<string, unknown>;
  const role = body.role === 'ADMIN' || body.role === 'MEMBER' ? body.role : null;
  if (!role) throw new HttpError(400, 'Role must be ADMIN or MEMBER', 'VALIDATION');
  const target = await store.findActiveMember(teamId, userId);
  if (!target) throw new HttpError(404, 'Member not found', 'NOT_FOUND');
  if (target.role === 'ADMIN' && role === 'MEMBER') {
    const members = await store.listActiveMembers(teamId);
    const otherAdmins = members.filter((item) => item.role === 'ADMIN' && item.userId !== userId);
    if (otherAdmins.length === 0) {
      throw new HttpError(400, 'A team must keep at least one admin', 'VALIDATION');
    }
  }
  await store.setMemberRole(target.id, role as TeamRoleName);
  return json({ id: target.id, userId, role });
}

export async function assertTeamMember(store: Store, teamId: string, user: UserRecord) {
  return requireMember(store, teamId, user.id);
}

export async function assertTeamAdmin(store: Store, teamId: string, user: UserRecord) {
  return requireAdmin(store, teamId, user.id);
}
