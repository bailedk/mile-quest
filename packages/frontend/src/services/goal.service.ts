import { GoalFormData } from '@/types/goal.types';
import { TeamGoal } from '@mile-quest/shared';
import { apiClient } from './api-client';

class GoalService {
  async createGoal(teamId: string, data: GoalFormData): Promise<TeamGoal> {
    const response = await apiClient.post(`/teams/${teamId}/goals`, {
      name: data.name,
      description: data.description,
      targetDate: data.targetDate,
      waypoints: data.waypoints,
      routeData: data.routeData,
    });
    return response.data;
  }

  async getTeamGoals(teamId: string): Promise<TeamGoal[]> {
    const response = await apiClient.get(`/teams/${teamId}/goals`);
    return response.data;
  }

  async getGoal(teamId: string, goalId: string): Promise<TeamGoal> {
    const response = await apiClient.get(`/teams/${teamId}/goals/${goalId}`);
    return response.data;
  }

  async updateGoal(teamId: string, goalId: string, data: Partial<GoalFormData>): Promise<TeamGoal> {
    const response = await apiClient.put(`/teams/${teamId}/goals/${goalId}`, data);
    return response.data;
  }

  async deleteGoal(teamId: string, goalId: string): Promise<void> {
    await apiClient.delete(`/teams/${teamId}/goals/${goalId}`);
  }
}

export const goalService = new GoalService();