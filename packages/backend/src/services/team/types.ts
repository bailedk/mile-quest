import { Team, TeamMember, TeamRole, User } from '@prisma/client';

export interface TeamWithMembers extends Team {
  members: (TeamMember & {
    user: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>;
  })[];
  _count?: {
    members: number;
  };
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

export interface TeamMemberWithUser extends TeamMember {
  user: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>;
}

export interface TeamListItem {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  memberCount: number;
  role: TeamRole;
  joinedAt: Date;
}