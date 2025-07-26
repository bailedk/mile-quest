import { GoalFormData } from '@/types/goal.types';
import { TeamGoal } from '@mile-quest/shared';
import { apiClient } from './api-client';

class GoalService {
  async createGoal(teamId: string, data: GoalFormData): Promise<TeamGoal> {
    // Extract start and end locations from waypoints array
    if (!data.waypoints || data.waypoints.length < 2) {
      throw new Error('At least 2 waypoints are required (start and end locations)');
    }

    const startWaypoint = data.waypoints[0];
    const endWaypoint = data.waypoints[data.waypoints.length - 1];
    const intermediateWaypoints = data.waypoints.slice(1, -1);

    const response = await apiClient.post(`/teams/${teamId}/goals`, {
      name: data.name,
      description: data.description,
      targetDate: data.targetDate,
      startLocation: {
        lat: startWaypoint.coordinates.lat,
        lng: startWaypoint.coordinates.lng,
        address: startWaypoint.address,
      },
      endLocation: {
        lat: endWaypoint.coordinates.lat,
        lng: endWaypoint.coordinates.lng,
        address: endWaypoint.address,
      },
      waypoints: intermediateWaypoints.map((wp, index) => ({
        id: `waypoint-${index + 1}`,
        position: {
          lat: wp.coordinates.lat,
          lng: wp.coordinates.lng,
        },
        address: wp.address,
        order: index + 1,
        isLocked: false,
      })),
    });
    return response.data;
  }

  async getTeamGoals(teamId: string): Promise<TeamGoal[]> {
    const url = `/teams/${teamId}/goals`;
    console.log('Making API call to:', url); // Debug log
    const response = await apiClient.get(url);
    console.log('API response:', response); // Debug log
    return response.data;
  }

  async getGoal(teamId: string, goalId: string): Promise<TeamGoal> {
    const response = await apiClient.get(`/teams/${teamId}/goals/${goalId}`);
    return response.data;
  }

  async updateGoal(teamId: string, goalId: string, data: Partial<GoalFormData>): Promise<TeamGoal> {
    const updatePayload: any = {
      name: data.name,
      description: data.description,
      targetDate: data.targetDate,
    };

    // If waypoints are being updated, transform them to the expected format
    if (data.waypoints && data.waypoints.length >= 2) {
      const startWaypoint = data.waypoints[0];
      const endWaypoint = data.waypoints[data.waypoints.length - 1];
      const intermediateWaypoints = data.waypoints.slice(1, -1);

      updatePayload.startLocation = {
        lat: startWaypoint.coordinates.lat,
        lng: startWaypoint.coordinates.lng,
        address: startWaypoint.address,
      };
      updatePayload.endLocation = {
        lat: endWaypoint.coordinates.lat,
        lng: endWaypoint.coordinates.lng,
        address: endWaypoint.address,
      };
      updatePayload.waypoints = intermediateWaypoints.map((wp, index) => ({
        id: `waypoint-${index + 1}`,
        position: {
          lat: wp.coordinates.lat,
          lng: wp.coordinates.lng,
        },
        address: wp.address,
        order: index + 1,
        isLocked: false,
      }));
    }

    const response = await apiClient.put(`/teams/${teamId}/goals/${goalId}`, updatePayload);
    return response.data;
  }

  async deleteGoal(teamId: string, goalId: string): Promise<void> {
    await apiClient.delete(`/teams/${teamId}/goals/${goalId}`);
  }
}

export const goalService = new GoalService();