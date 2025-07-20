import { TeamRole } from '@mile-quest/shared';

export interface TeamMember {
  id: string;
  userId: string;
  role: keyof typeof TeamRole;
  /** ISO 8601 date-time string in UTC when member joined the team */
  joinedAt: string;
  /** ISO 8601 date-time string in UTC when member left the team, null if still active */
  leftAt?: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  isPublic: boolean;
  maxMembers: number;
  createdById: string;
  /** ISO 8601 date-time string in UTC when the team was created */
  createdAt: string;
  /** ISO 8601 date-time string in UTC when the team was last updated */
  updatedAt: string;
  members: TeamMember[];
  _count?: {
    members: number;
  };
}

export interface TeamListItem {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  memberCount: number;
  role: keyof typeof TeamRole;
  /** ISO 8601 date-time string in UTC when user joined the team */
  joinedAt: string;
}

export interface CreateTeamInput {
  name: string;
  description?: string;
  avatarUrl?: string;
  isPublic?: boolean;
  maxMembers?: number;
}

export interface UpdateTeamInput {
  name?: string;
  description?: string;
  avatarUrl?: string;
  isPublic?: boolean;
  maxMembers?: number;
}

export interface JoinTeamInput {
  teamId?: string;
  inviteCode?: string;
}