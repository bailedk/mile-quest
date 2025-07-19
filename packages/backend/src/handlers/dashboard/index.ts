/**
 * Dashboard Lambda handler - BE-017
 */

import { createHandler } from '../../utils/lambda-handler';
import { createRouter } from '../../utils/router';
import { validateEnvironment } from '../../config/environment';
import { verifyToken } from '../../utils/auth/jwt.utils';
import { prisma } from '../../lib/database';
import { TeamService } from '../../services/team/team.service';
import { ActivityService } from '../../services/activity/activity.service';
import { ProgressService } from '../../services/progress/progress.service';
import { MaterializedViewsService } from '../../services/materialized-views/materialized-views.service';
import { cache, cacheKeys, cacheTTL } from '../../utils/cache';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Validate environment on cold start
validateEnvironment();

// Initialize services
const teamService = new TeamService(prisma);
const activityService = new ActivityService(prisma);
const progressService = new ProgressService(prisma);
const materializedViewsService = new MaterializedViewsService(prisma);

// Create router
const router = createRouter();

// Helper to extract user from token
const getUserFromEvent = (event: APIGatewayProxyEvent) => {
  const authHeader = event.headers.Authorization || event.headers.authorization;
  const token = authHeader?.split(' ')[1];
  
  if (!token) {
    throw new Error('No token provided');
  }
  
  return verifyToken(token);
};

// Dashboard data types
interface DashboardTeam {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  memberCount: number;
  role: string;
  progress: {
    goalId: string | null;
    goalName: string | null;
    currentDistance: number;
    targetDistance: number;
    percentComplete: number;
    daysRemaining: number | null;
    isOnTrack: boolean | null;
  } | null;
}

interface DashboardActivity {
  id: string;
  distance: number;
  duration: number;
  pace: number;
  activityDate: Date;
  note: string | null;
  teamName: string;
  userName: string;
  isOwn: boolean;
}

interface PersonalStats {
  totalDistance: number;
  totalActivities: number;
  currentStreak: number;
  bestDay: {
    date: Date | null;
    distance: number;
  };
  thisWeek: {
    distance: number;
    activities: number;
  };
  thisMonth: {
    distance: number;
    activities: number;
  };
}

interface TeamLeaderboard {
  teamId: string;
  teamName: string;
  members: {
    userId: string;
    name: string;
    avatarUrl: string | null;
    distance: number;
    percentage: number;
  }[];
}

interface DashboardResponse {
  teams: DashboardTeam[];
  recentActivities: DashboardActivity[];
  personalStats: PersonalStats;
  teamLeaderboards: TeamLeaderboard[];
}

// Get dashboard data (BE-017)
router.get('/', async (event, context, params) => {
  try {
    const user = getUserFromEvent(event);
    
    // Check cache first
    const cacheKey = `dashboard:${user.sub}`;
    const cached = cache.get<DashboardResponse>(cacheKey);
    if (cached) {
      return {
        statusCode: 200,
        body: cached,
      };
    }

    // Get user's teams with progress data
    const userTeams = await teamService.getUserTeams(user.sub);
    
    // Get team progress for each team
    const teamsWithProgress: DashboardTeam[] = await Promise.all(
      userTeams.map(async (team) => {
        try {
          // Get current active goal for the team
          const activeGoal = await prisma.teamGoal.findFirst({
            where: {
              teamId: team.id,
              status: 'ACTIVE',
            },
            include: {
              progress: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          });

          let progress = null;
          if (activeGoal) {
            const progressData = await progressService.calculateTeamProgress(activeGoal.id);
            progress = {
              goalId: activeGoal.id,
              goalName: activeGoal.name,
              currentDistance: progressData.totalDistance,
              targetDistance: progressData.targetDistance,
              percentComplete: progressData.percentComplete,
              daysRemaining: progressData.daysRemaining || null,
              isOnTrack: progressData.isOnTrack || null,
            };
          }

          return {
            id: team.id,
            name: team.name,
            description: team.description,
            avatarUrl: team.avatarUrl,
            memberCount: team.memberCount,
            role: team.role,
            progress,
          };
        } catch (error) {
          // If we can't get progress for a team, return without progress
          return {
            id: team.id,
            name: team.name,
            description: team.description,
            avatarUrl: team.avatarUrl,
            memberCount: team.memberCount,
            role: team.role,
            progress: null,
          };
        }
      })
    );

    // Get recent activities across all user's teams (last 10)
    const recentActivities: DashboardActivity[] = await getRecentActivitiesForDashboard(user.sub, userTeams.map(t => t.id));

    // Get user's personal stats
    const personalStats = await getUserPersonalStats(user.sub);

    // Get team leaderboards (top 5 members per team)
    const teamLeaderboards = await getTeamLeaderboards(userTeams.map(t => t.id));

    const dashboardData: DashboardResponse = {
      teams: teamsWithProgress,
      recentActivities,
      personalStats,
      teamLeaderboards,
    };

    // Cache the result for 5 minutes
    cache.set(cacheKey, dashboardData, cacheTTL.userStats);

    return {
      statusCode: 200,
      body: dashboardData,
    };
  } catch (error) {
    console.error('Dashboard error:', error);
    return {
      statusCode: 500,
      body: {
        error: 'Failed to load dashboard data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
});

// Helper function to get recent activities for dashboard
async function getRecentActivitiesForDashboard(userId: string, teamIds: string[]): Promise<DashboardActivity[]> {
  const activities = await prisma.activity.findMany({
    where: {
      teamId: { in: teamIds },
      // Include both public activities and user's own private activities
      OR: [
        { isPrivate: false },
        { userId: userId },
      ],
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
      team: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
  });

  return activities.map((activity) => ({
    id: activity.id,
    distance: activity.distance,
    duration: activity.duration,
    pace: calculatePace(activity.distance, activity.duration),
    activityDate: activity.startTime,
    note: activity.notes,
    teamName: activity.team.name,
    userName: activity.user.name,
    isOwn: activity.userId === userId,
  }));
}

// Helper function to get user's personal stats (optimized with materialized views)
async function getUserPersonalStats(userId: string): Promise<PersonalStats> {
  // Try to get optimized stats from materialized view first
  try {
    const mvStats = await materializedViewsService.getUserActivityStats(userId);
    
    if (mvStats) {
      return {
        totalDistance: Number(mvStats.total_distance),
        totalActivities: Number(mvStats.total_activities),
        currentStreak: 0, // Will be calculated separately if needed
        bestDay: {
          date: mvStats.last_activity_date,
          distance: Number(mvStats.best_distance),
        },
        thisWeek: {
          distance: Number(mvStats.week_distance),
          activities: Number(mvStats.week_activities),
        },
        thisMonth: {
          distance: Number(mvStats.month_distance),
          activities: Number(mvStats.month_activities),
        },
      };
    }
  } catch (error) {
    console.warn('Failed to get stats from materialized view, falling back to original method:', error);
  }

  // Fallback to original method if materialized view fails
  const userStats = await activityService.getUserStats(userId);
  
  // Get best day distance
  const bestDayActivity = await prisma.activity.findFirst({
    where: { userId },
    orderBy: { distance: 'desc' },
    select: {
      distance: true,
      startTime: true,
    },
  });

  return {
    totalDistance: userStats.totalDistance,
    totalActivities: userStats.totalActivities,
    currentStreak: userStats.currentStreak,
    bestDay: {
      date: bestDayActivity?.startTime || null,
      distance: bestDayActivity?.distance || 0,
    },
    thisWeek: {
      distance: userStats.weeklyStats.distance,
      activities: userStats.weeklyStats.activities,
    },
    thisMonth: {
      distance: userStats.monthlyStats.distance,
      activities: userStats.monthlyStats.activities,
    },
  };
}

// Helper function to get team leaderboards (optimized with materialized views)
async function getTeamLeaderboards(teamIds: string[]): Promise<TeamLeaderboard[]> {
  const leaderboards = await Promise.all(
    teamIds.map(async (teamId) => {
      try {
        // Try to get optimized leaderboard from materialized view first
        try {
          const mvLeaderboard = await materializedViewsService.getTeamLeaderboard(teamId, 5);
          
          if (mvLeaderboard && mvLeaderboard.length > 0) {
            // Calculate total team distance for percentages
            const totalTeamDistance = mvLeaderboard.reduce((sum, member) => sum + Number(member.total_distance), 0);
            
            const topMembers = mvLeaderboard.map((member) => ({
              userId: member.user_id,
              name: member.user_name,
              avatarUrl: member.user_avatar,
              distance: Number(member.total_distance),
              percentage: totalTeamDistance > 0 ? (Number(member.total_distance) / totalTeamDistance) * 100 : 0,
            }));

            return {
              teamId,
              teamName: mvLeaderboard[0]?.team_id ? (await prisma.team.findUnique({
                where: { id: teamId },
                select: { name: true },
              }))?.name || 'Unknown Team' : 'Unknown Team',
              members: topMembers,
            };
          }
        } catch (mvError) {
          console.warn(`Failed to get team leaderboard from materialized view for team ${teamId}, falling back:`, mvError);
        }

        // Fallback to original method
        const team = await prisma.team.findUnique({
          where: { id: teamId },
          select: { name: true },
        });

        if (!team) {
          return null;
        }

        // Get team members with their activity totals
        const members = await prisma.teamMember.findMany({
          where: {
            teamId,
            leftAt: null,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        });

        // Calculate distances for each member
        const memberStats = await Promise.all(
          members.map(async (member) => {
            const totalDistance = await prisma.activity.aggregate({
              where: {
                userId: member.userId,
                teamId,
                // Include both public and private activities for team totals
              },
              _sum: {
                distance: true,
              },
            });

            return {
              userId: member.user.id,
              name: member.user.name,
              avatarUrl: member.user.avatarUrl,
              distance: totalDistance._sum.distance || 0,
            };
          })
        );

        // Calculate total team distance for percentages
        const totalTeamDistance = memberStats.reduce((sum, member) => sum + member.distance, 0);

        // Sort by distance and take top 5
        const topMembers = memberStats
          .map((member) => ({
            ...member,
            percentage: totalTeamDistance > 0 ? (member.distance / totalTeamDistance) * 100 : 0,
          }))
          .sort((a, b) => b.distance - a.distance)
          .slice(0, 5);

        return {
          teamId,
          teamName: team.name,
          members: topMembers,
        };
      } catch (error) {
        console.error(`Error getting leaderboard for team ${teamId}:`, error);
        return null;
      }
    })
  );

  // Filter out null results and return
  return leaderboards.filter((board): board is TeamLeaderboard => board !== null);
}

// Helper function to calculate pace (min/km)
function calculatePace(distanceMeters: number, durationSeconds: number): number {
  if (distanceMeters === 0) return 0;
  const distanceKm = distanceMeters / 1000;
  const durationMinutes = durationSeconds / 60;
  return durationMinutes / distanceKm;
}

// Dashboard handler
async function dashboardHandler(event: APIGatewayProxyEvent, context: Context) {
  return router.handle(event, context);
}

// Export handler
export const handler = createHandler(dashboardHandler);