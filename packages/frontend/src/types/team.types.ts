import { TeamRole } from '@mile-quest/shared';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: keyof typeof TeamRole;
  joinedAt: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  isPublic: boolean;
  maxMembers: number;
  createdById: string;
  createdAt: string;
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