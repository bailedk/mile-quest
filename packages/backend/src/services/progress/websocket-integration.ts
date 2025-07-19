import { WebSocketService } from '../websocket/types';
import { ProgressService } from './progress.service';
import { TeamProgressData, MilestoneData } from './types';

export class ProgressWebSocketIntegration {
  constructor(
    private progressService: ProgressService,
    private websocketService: WebSocketService
  ) {}

  /**
   * Send real-time progress update to team members
   */
  async broadcastProgressUpdate(
    teamId: string,
    teamGoalId: string,
    progressData: TeamProgressData,
    milestone?: MilestoneData
  ): Promise<void> {
    const channel = `private-team-${teamId}`;
    
    // Send progress update event
    await this.websocketService.trigger(channel, 'progress-update', {
      teamGoalId,
      totalDistance: progressData.totalDistance,
      percentComplete: progressData.percentComplete,
      estimatedCompletionDate: progressData.estimatedCompletionDate,
      isOnTrack: progressData.isOnTrack,
      lastActivityAt: progressData.lastActivityAt,
      topContributors: progressData.topContributors.slice(0, 3), // Top 3 only
    });

    // Send milestone event if reached
    if (milestone) {
      await this.websocketService.trigger(channel, 'milestone-reached', {
        type: milestone.type,
        value: milestone.value,
        message: milestone.message,
        teamGoalId,
        goalName: progressData.goalName,
      });
    }
  }

  /**
   * Send activity added notification with progress impact
   */
  async broadcastActivityAdded(
    teamId: string,
    activityData: {
      userId: string;
      userName: string;
      distance: number;
      duration: number;
    },
    progressUpdate: {
      newTotalDistance: number;
      newPercentComplete: number;
      distanceAdded: number;
    }
  ): Promise<void> {
    const channel = `private-team-${teamId}`;
    
    await this.websocketService.trigger(channel, 'activity-added', {
      user: {
        id: activityData.userId,
        name: activityData.userName,
      },
      activity: {
        distance: activityData.distance,
        duration: activityData.duration,
      },
      progress: progressUpdate,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send daily summary notification
   */
  async broadcastDailySummary(
    teamId: string,
    summary: {
      totalDistance: number;
      totalActivities: number;
      activeUsers: number;
      topContributor?: {
        userId: string;
        name: string;
        distance: number;
      };
      progressToday: number;
      percentComplete: number;
    }
  ): Promise<void> {
    const channel = `private-team-${teamId}`;
    
    await this.websocketService.trigger(channel, 'daily-summary', {
      date: new Date().toISOString().split('T')[0],
      summary,
    });
  }

  /**
   * Send encouragement notification
   */
  async broadcastEncouragement(
    teamId: string,
    data: {
      type: 'INACTIVE' | 'BEHIND_SCHEDULE' | 'ALMOST_THERE';
      message: string;
      daysRemaining?: number;
      percentComplete: number;
      requiredDailyDistance?: number;
    }
  ): Promise<void> {
    const channel = `private-team-${teamId}`;
    
    await this.websocketService.trigger(channel, 'team-encouragement', data);
  }

  /**
   * Send goal completion celebration
   */
  async broadcastGoalCompletion(
    teamId: string,
    completionData: {
      teamGoalId: string;
      goalName: string;
      totalDistance: number;
      totalDuration: number;
      totalActivities: number;
      participantCount: number;
      completionTime: Date;
      topContributors: Array<{
        userId: string;
        name: string;
        distance: number;
      }>;
    }
  ): Promise<void> {
    const channel = `private-team-${teamId}`;
    
    await this.websocketService.trigger(channel, 'goal-completed', {
      ...completionData,
      celebrationType: 'CONFETTI', // UI hint for celebration animation
    });
  }

  /**
   * Subscribe to team channel for receiving updates
   */
  subscribeToTeamProgress(
    teamId: string,
    handlers: {
      onProgressUpdate?: (data: any) => void;
      onMilestoneReached?: (data: any) => void;
      onActivityAdded?: (data: any) => void;
      onDailySummary?: (data: any) => void;
      onEncouragement?: (data: any) => void;
      onGoalCompleted?: (data: any) => void;
    }
  ): { unsubscribe: () => void } {
    const channel = `private-team-${teamId}`;
    
    // This would be used on the client side
    // Server-side doesn't subscribe, only publishes
    console.log(`Subscription handlers registered for team ${teamId}`);
    
    return {
      unsubscribe: () => {
        console.log(`Unsubscribed from team ${teamId}`);
      },
    };
  }
}