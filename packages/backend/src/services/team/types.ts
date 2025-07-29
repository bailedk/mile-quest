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
  goal?: {
    name: string;
    description?: string;
    startLocation: {
      lat: number;
      lng: number;
      address?: string;
    };
    endLocation: {
      lat: number;
      lng: number;
      address?: string;
    };
    waypoints?: Array<{
      id: string;
      position: {
        lat: number;
        lng: number;
      };
      address?: string;
      order: number;
      isLocked?: boolean;
    }>;
    targetDate?: Date;
  };
}

export interface UpdateTeamInput {
  name?: string;
  description?: string;
  avatarUrl?: string;
  isPublic?: boolean;
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