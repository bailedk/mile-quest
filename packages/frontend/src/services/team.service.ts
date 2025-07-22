import { apiClient } from './api-client';
import { 
  Team, 
  TeamListItem, 
  CreateTeamInput, 
  UpdateTeamInput,
  JoinTeamInput 
} from '@/types/team.types';

export const teamService = {
  // Get current user's teams
  async getUserTeams(): Promise<TeamListItem[]> {
    const response = await apiClient.get<TeamListItem[]>('/users/me/teams');
    return response.data;
  },

  // Get team by ID
  async getTeam(teamId: string): Promise<Team> {
    const response = await apiClient.get<Team>(`/teams/${teamId}`);
    return response.data;
  },

  // Create a new team
  async createTeam(input: CreateTeamInput): Promise<Team> {
    const response = await apiClient.post<Team>('/teams', input);
    return response.data;
  },

  // Update team details
  async updateTeam(teamId: string, input: UpdateTeamInput): Promise<Team> {
    const response = await apiClient.patch<Team>(`/teams/${teamId}`, input);
    return response.data;
  },

  // Join a team
  async joinTeam(input: JoinTeamInput): Promise<Team> {
    const response = await apiClient.post<Team>('/teams/join', input);
    return response.data;
  },

  // Leave a team
  async leaveTeam(teamId: string): Promise<void> {
    await apiClient.delete(`/teams/${teamId}/members/me`);
  },

  // Remove a member from team (admin only)
  async removeMember(teamId: string, userId: string): Promise<void> {
    await apiClient.delete(`/teams/${teamId}/members/${userId}`);
  },

  // Update member role (admin only)
  async updateMemberRole(teamId: string, userId: string, role: 'ADMIN' | 'MEMBER'): Promise<void> {
    await apiClient.patch(`/teams/${teamId}/members/${userId}`, { role });
  },

  // Delete a team (admin only)
  async deleteTeam(teamId: string): Promise<void> {
    await apiClient.delete(`/teams/${teamId}`);
  },
};