import { Activity, Team, User, ActivitySource } from '@prisma/client';

export interface ActivityWithRelations extends Activity {
  user: Pick<User, 'id' | 'name' | 'avatarUrl'>;
  team: Pick<Team, 'id' | 'name'>;
  teams?: Pick<Team, 'id' | 'name'>[];
}

export interface CreateActivityInput {
  teamIds: string[];
  distance: number; // in meters
  duration: number; // in seconds
  activityDate: string; // ISO date string
  note?: string;
  isPrivate?: boolean;
  source?: ActivitySource;
}

export interface UpdateActivityInput {
  note?: string;
  isPrivate?: boolean;
}

export interface ActivityListItem {
  id: string;
  distance: number;
  duration: number;
  pace: number; // min/km or min/mi based on user preference
  activityDate: Date;
  note: string | null;
  isPrivate: boolean;
  createdAt: Date;
  teams: {
    id: string;
    name: string;
  }[];
}

export interface TeamProgressUpdate {
  teamId: string;
  newTotalDistance: number;
  newPercentComplete: number;
}

export interface CreateActivityResult {
  activity: ActivityWithRelations;
  teamUpdates: TeamProgressUpdate[];
}

export interface DeleteActivityResult {
  deleted: boolean;
  teamUpdates: TeamProgressUpdate[];
}