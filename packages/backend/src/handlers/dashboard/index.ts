/**
 * Dashboard Lambda handler - BE-017
 */

import { createHandler } from '../../utils/lambda-handler';
import { createRouter } from '../../utils/router';
import { validateEnvironment } from '../../config/environment';
import { isAuthError } from '../../utils/auth/jwt.utils';
import { getUserFromEvent } from '../../utils/auth/auth-helpers';
import { prisma } from '../../lib/database';
import { TeamService } from '../../services/team/team.service';
import { ActivityService } from '../../services/activity/activity.service';
import { ProgressService } from '../../services/progress/progress.service';
import { MaterializedViewsService } from '../../services/materialized-views/materialized-views.service';
import { cache, cacheKeys, cacheTTL } from '../../utils/cache';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Validate environment on cold start
validateEnvironment();

// Initialize services - MapBox config is now working
const teamService = new TeamService(prisma);
const activityService = new ActivityService(prisma);
const progressService = new ProgressService(prisma);
const materializedViewsService = new MaterializedViewsService(prisma);

// Create router
const router = createRouter();


// Dashboard data types
interface DashboardTeam {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  memberCount: number;
  role: string;
  progress: {
    goalId: string;
    goalName: string;
    currentDistance: number;
    targetDistance: number;
    percentComplete: number;
    daysRemaining: number | null;
    isOnTrack: boolean | null;
    startDate: Date | null;
    endDate: Date | null;
    status: string;
  } | null;
}

interface DashboardActivity {
  id: string;
  distance: number;
  duration: number;
  pace: number;
  timestamp: Date;
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
    console.log('Dashboard: Starting request');
    const user = getUserFromEvent(event);
    console.log('Dashboard: User authenticated:', { userId: user.id, email: user.email });
    
    // Skip cache for debugging
    const cacheKey = `dashboard:${user.id}`;
    // const cached = cache.get<DashboardResponse>(cacheKey);
    // if (cached) {
    //   console.log('Dashboard: Returning cached data');
    //   return {
    //     statusCode: 200,
    //     body: cached,
    //   };
    // }

    // Get user's teams with progress data
    console.log('Dashboard: Getting user teams');
    const userTeams = await teamService.getUserTeams(user.id);
    console.log('Dashboard: Found teams:', userTeams.length);
    
    // Get team progress for each team
    const teamsWithProgress: DashboardTeam[] = await Promise.all(
      userTeams.map(async (team) => {
        try {
          // Get current active goal for the team (or any goal if none active)
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
          
          // If no active goal, check if there's any goal at all for debugging
          if (!activeGoal) {
            const anyGoal = await prisma.teamGoal.findFirst({
              where: {
                teamId: team.id,
              },
              orderBy: {
                createdAt: 'desc',
              },
            });
            console.log(`Team ${team.id} has no ACTIVE goal. Any goal found:`, anyGoal ? `Yes - Status: ${anyGoal.status}` : 'No');
          }

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
              startDate: activeGoal.startDate,
              endDate: activeGoal.endDate,
              status: activeGoal.status,
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
          console.error('Error getting team progress:', error);
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
    console.log('Dashboard: Getting recent activities');
    const teamIds = userTeams.map(t => t.id);
    const recentActivities: DashboardActivity[] = teamIds.length > 0 
      ? await getRecentActivitiesForDashboard(user.id, teamIds)
      : [];
    console.log('Dashboard: Found activities:', recentActivities.length);

    // Get user's personal stats
    console.log('Dashboard: Getting personal stats for userId:', user.id);
    const personalStats = await getUserPersonalStats(user.id);
    console.log('Dashboard: Personal stats result:', JSON.stringify(personalStats, null, 2));

    // Get team leaderboards (top 5 members per team)
    console.log('Dashboard: Getting team leaderboards');
    const teamLeaderboards = teamIds.length > 0 
      ? await getTeamLeaderboards(teamIds)
      : [];
    console.log('Dashboard: Found leaderboards:', teamLeaderboards.length);

    const dashboardData: DashboardResponse = {
      teams: teamsWithProgress,
      recentActivities,
      personalStats,
      teamLeaderboards,
    };

    console.log('Dashboard: Assembled dashboard data successfully');
    
    // Skip caching for debugging
    // cache.set(cacheKey, dashboardData, cacheTTL.userStats);

    console.log('Dashboard: Returning response');
    return {
      statusCode: 200,
      body: dashboardData,
    };
  } catch (error) {
    if (isAuthError(error)) {
      return {
        statusCode: 401,
        body: {
          error: 'Authentication required',
          details: 'Please provide a valid authentication token',
        },
      };
    }
    
    console.error('Dashboard error - Full details:', error);
    console.error('Dashboard error - Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    return {
      statusCode: 500,
      body: {
        error: 'Failed to load dashboard data',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : null) : undefined,
      },
    };
  }
});

// Helper function to get recent activities for dashboard
async function getRecentActivitiesForDashboard(userId: string, teamIds: string[]): Promise<DashboardActivity[]> {
  // Get all team members for the user's teams
  const teamMembers = await prisma.teamMember.findMany({
    where: {
      teamId: { in: teamIds },
      leftAt: null,
    },
    select: {
      userId: true,
      teamId: true,
      team: {
        select: {
          name: true,
        },
      },
    },
  });

  // Create a map of userId to team names for quick lookup
  const userTeamMap = new Map<string, { teamId: string; teamName: string }>();
  teamMembers.forEach((member) => {
    userTeamMap.set(member.userId, {
      teamId: member.teamId,
      teamName: member.team.name,
    });
  });

  // Get member IDs
  const memberIds = teamMembers.map((m) => m.userId);

  // Get recent activities from team members
  const activities = await prisma.activity.findMany({
    where: {
      userId: { in: memberIds },
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
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
  });

  return activities.map((activity) => {
    const teamInfo = userTeamMap.get(activity.userId);
    return {
      id: activity.id,
      distance: activity.distance,
      duration: activity.duration,
      pace: calculatePace(activity.distance, activity.duration),
      timestamp: activity.timestamp,
      note: activity.notes,
      teamName: teamInfo?.teamName || 'Unknown Team',
      userName: activity.user.name,
      isOwn: activity.userId === userId,
    };
  });
}

// Helper function to get user's personal stats with direct queries
async function getUserPersonalStats(userId: string): Promise<PersonalStats> {
  console.log('getUserPersonalStats: Starting for user:', userId);
  
  // Direct queries to activities table for accurate real-time stats
  try {
    // Debug: Check if there are any activities at all
    const allActivities = await prisma.activity.findMany({
      where: { userId },
      select: {
        id: true,
        distance: true,
        timestamp: true,
        userId: true,
      },
    });
    console.log('getUserPersonalStats: All activities for user:', allActivities);
    // Get total stats
    const totalStats = await prisma.activity.aggregate({
      where: { userId },
      _sum: { distance: true },
      _count: true,
    });
    
    console.log('getUserPersonalStats: Total stats:', {
      distance: totalStats._sum.distance,
      count: totalStats._count
    });
    
    // Get best day
    const bestDayActivity = await prisma.activity.findFirst({
      where: { userId },
      orderBy: { distance: 'desc' },
      select: {
        distance: true,
        timestamp: true,
      },
    });
    
    console.log('getUserPersonalStats: Best day:', bestDayActivity);
    
    // Get this week's stats (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const weekStats = await prisma.activity.aggregate({
      where: {
        userId,
        timestamp: { gte: weekAgo },
      },
      _sum: { distance: true },
      _count: true,
    });
    
    console.log('getUserPersonalStats: Week stats:', {
      distance: weekStats._sum.distance,
      count: weekStats._count
    });
    
    // Get this month's stats (last 30 days)
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    
    const monthStats = await prisma.activity.aggregate({
      where: {
        userId,
        timestamp: { gte: monthAgo },
      },
      _sum: { distance: true },
      _count: true,
    });
    
    console.log('getUserPersonalStats: Month stats:', {
      distance: monthStats._sum.distance,
      count: monthStats._count
    });
    
    // Calculate current streak
    const currentStreak = await calculateCurrentStreak(userId);
    
    const result: PersonalStats = {
      totalDistance: totalStats._sum.distance || 0,
      totalActivities: totalStats._count || 0,
      currentStreak: currentStreak,
      bestDay: {
        date: bestDayActivity?.timestamp || null,
        distance: bestDayActivity?.distance || 0,
      },
      thisWeek: {
        distance: weekStats._sum.distance || 0,
        activities: weekStats._count || 0,
      },
      thisMonth: {
        distance: monthStats._sum.distance || 0,
        activities: monthStats._count || 0,
      },
    };
    
    console.log('getUserPersonalStats: Final result:', result);
    return result;
    
  } catch (error) {
    console.error('getUserPersonalStats: Error getting stats:', error);
    // Return empty stats on error
    return {
      totalDistance: 0,
      totalActivities: 0,
      currentStreak: 0,
      bestDay: {
        date: null,
        distance: 0,
      },
      thisWeek: {
        distance: 0,
        activities: 0,
      },
      thisMonth: {
        distance: 0,
        activities: 0,
      },
    };
  }
}

// Helper function to calculate current streak
async function calculateCurrentStreak(userId: string): Promise<number> {
  try {
    // Get all activities ordered by date
    const activities = await prisma.activity.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    });
    
    if (activities.length === 0) return 0;
    
    // Group by date and check consecutive days
    const dates = new Set(
      activities.map(a => a.timestamp.toISOString().split('T')[0])
    );
    
    const sortedDates = Array.from(dates).sort().reverse();
    const today = new Date().toISOString().split('T')[0];
    
    // If no activity today or yesterday, streak is broken
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    if (!dates.has(today) && !dates.has(yesterdayStr)) {
      return 0;
    }
    
    // Count consecutive days
    let streak = 0;
    let currentDate = new Date();
    
    for (let i = 0; i < sortedDates.length && i < 365; i++) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (dates.has(dateStr)) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else if (i > 0) {
        // Allow one day gap only for today
        break;
      } else {
        currentDate.setDate(currentDate.getDate() - 1);
      }
    }
    
    return streak;
  } catch (error) {
    console.error('calculateCurrentStreak: Error:', error);
    return 0;
  }
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