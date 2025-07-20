/**
 * Database seed script for Mile Quest
 * Creates realistic test data for development
 */

import { PrismaClient, TeamRole, GoalStatus, ActivitySource, InviteStatus, AchievementCategory } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to generate random coordinates within a range
function randomCoordinate(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// Helper to generate random date within last N days
function randomDate(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  return date;
}

// Helper to generate walking distance (in meters)
function randomWalkingDistance(): number {
  // Most walks are 1-5km, some longer
  const distances = [1000, 2000, 3000, 4000, 5000, 7500, 10000];
  return distances[Math.floor(Math.random() * distances.length)] + Math.floor(Math.random() * 500);
}

async function seed() {
  console.log('🌱 Starting database seed...');

  // Clean existing data
  console.log('🧹 Cleaning existing data...');
  await prisma.userAchievement.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.teamProgress.deleteMany();
  await prisma.teamGoal.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.teamInvite.deleteMany();
  await prisma.team.deleteMany();
  await prisma.userStats.deleteMany();
  await prisma.user.deleteMany();

  // Create test users
  console.log('👥 Creating users...');
  const users = await Promise.all([
    // Mock auth test user (matches backend mock service)
    prisma.user.create({
      data: {
        id: 'test-user-1',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=test',
        cognitoId: 'test-user-1',
        emailVerified: true,
        createdAt: randomDate(90),
      },
    }),
    // Additional active users
    prisma.user.create({
      data: {
        id: 'user-1',
        email: 'alice@example.com',
        name: 'Alice Walker',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice',
        cognitoId: 'cognito-user-1',
        emailVerified: true,
        createdAt: randomDate(90),
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-2',
        email: 'bob@example.com',
        name: 'Bob Runner',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob',
        cognitoId: 'cognito-user-2',
        emailVerified: true,
        createdAt: randomDate(85),
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-3',
        email: 'charlie@example.com',
        name: 'Charlie Stride',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=charlie',
        cognitoId: 'cognito-user-3',
        emailVerified: true,
        createdAt: randomDate(80),
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-4',
        email: 'diana@example.com',
        name: 'Diana Pace',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=diana',
        cognitoId: 'cognito-user-4',
        emailVerified: true,
        createdAt: randomDate(75),
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-5',
        email: 'evan@example.com',
        name: 'Evan Miles',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=evan',
        cognitoId: 'cognito-user-5',
        emailVerified: true,
        createdAt: randomDate(70),
      },
    }),
    // Less active users
    prisma.user.create({
      data: {
        id: 'user-6',
        email: 'fiona@example.com',
        name: 'Fiona Step',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=fiona',
        cognitoId: 'cognito-user-6',
        emailVerified: true,
        createdAt: randomDate(60),
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-7',
        email: 'george@example.com',
        name: 'George Hiker',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=george',
        cognitoId: 'cognito-user-7',
        emailVerified: true,
        createdAt: randomDate(50),
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-8',
        email: 'helen@example.com',
        name: 'Helen Trail',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=helen',
        cognitoId: 'cognito-user-8',
        emailVerified: true,
        createdAt: randomDate(40),
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-9',
        email: 'ivan@example.com',
        name: 'Ivan Path',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ivan',
        cognitoId: 'cognito-user-9',
        emailVerified: true,
        createdAt: randomDate(30),
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-10',
        email: 'julia@example.com',
        name: 'Julia Journey',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=julia',
        cognitoId: 'cognito-user-10',
        emailVerified: true,
        createdAt: randomDate(20),
      },
    }),
  ]);

  // Create teams
  console.log('👫 Creating teams...');
  const teams = await Promise.all([
    // Team 1: Active team with goal in progress
    prisma.team.create({
      data: {
        id: 'team-1',
        name: 'Mile Crushers',
        description: 'We crush miles for breakfast! Join us on our journey to walk across America.',
        avatarUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=milecrusher',
        createdById: 'user-1',
        createdAt: randomDate(60),
      },
    }),
    // Team 2: Completed goal team
    prisma.team.create({
      data: {
        id: 'team-2',
        name: 'Coastal Walkers',
        description: 'Walking the beautiful coastlines, one step at a time.',
        avatarUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=coastal',
        createdById: 'user-2',
        createdAt: randomDate(90),
      },
    }),
    // Team 3: New team just starting
    prisma.team.create({
      data: {
        id: 'team-3',
        name: 'Urban Explorers',
        description: 'Discovering our city through daily walks.',
        avatarUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=urban',
        createdById: 'user-3',
        createdAt: randomDate(10),
      },
    }),
    // Team 4: International team
    prisma.team.create({
      data: {
        id: 'team-4',
        name: 'Global Trekkers',
        description: 'Walking around the world, virtually!',
        avatarUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=global',
        createdById: 'user-4',
        createdAt: randomDate(45),
      },
    }),
    // Team 5: Small team
    prisma.team.create({
      data: {
        id: 'team-5',
        name: 'Morning Walkers',
        description: 'Early birds getting our steps in.',
        avatarUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=morning',
        createdById: 'user-8',
        createdAt: randomDate(30),
      },
    }),
  ]);

  // Create team members
  console.log('👥 Creating team memberships...');
  await Promise.all([
    // Team 1 members (5 members)
    prisma.teamMember.create({
      data: { teamId: 'team-1', userId: 'user-1', role: TeamRole.ADMIN, joinedAt: randomDate(60) },
    }),
    prisma.teamMember.create({
      data: { teamId: 'team-1', userId: 'user-2', role: TeamRole.ADMIN, joinedAt: randomDate(55) },
    }),
    prisma.teamMember.create({
      data: { teamId: 'team-1', userId: 'user-3', role: TeamRole.MEMBER, joinedAt: randomDate(50) },
    }),
    prisma.teamMember.create({
      data: { teamId: 'team-1', userId: 'user-4', role: TeamRole.MEMBER, joinedAt: randomDate(45) },
    }),
    prisma.teamMember.create({
      data: { teamId: 'team-1', userId: 'user-5', role: TeamRole.MEMBER, joinedAt: randomDate(40) },
    }),
    
    // Team 2 members (4 members)
    prisma.teamMember.create({
      data: { teamId: 'team-2', userId: 'user-2', role: TeamRole.ADMIN, joinedAt: randomDate(90) },
    }),
    prisma.teamMember.create({
      data: { teamId: 'team-2', userId: 'user-6', role: TeamRole.ADMIN, joinedAt: randomDate(85) },
    }),
    prisma.teamMember.create({
      data: { teamId: 'team-2', userId: 'user-7', role: TeamRole.MEMBER, joinedAt: randomDate(80) },
    }),
    prisma.teamMember.create({
      data: { teamId: 'team-2', userId: 'user-8', role: TeamRole.MEMBER, joinedAt: randomDate(75) },
    }),
    
    // Team 3 members (3 members)
    prisma.teamMember.create({
      data: { teamId: 'team-3', userId: 'user-3', role: TeamRole.ADMIN, joinedAt: randomDate(10) },
    }),
    prisma.teamMember.create({
      data: { teamId: 'team-3', userId: 'user-9', role: TeamRole.MEMBER, joinedAt: randomDate(8) },
    }),
    prisma.teamMember.create({
      data: { teamId: 'team-3', userId: 'user-10', role: TeamRole.MEMBER, joinedAt: randomDate(5) },
    }),
    
    // Team 4 members (6 members - largest team)
    prisma.teamMember.create({
      data: { teamId: 'team-4', userId: 'user-4', role: TeamRole.ADMIN, joinedAt: randomDate(45) },
    }),
    prisma.teamMember.create({
      data: { teamId: 'team-4', userId: 'user-1', role: TeamRole.ADMIN, joinedAt: randomDate(43) },
    }),
    prisma.teamMember.create({
      data: { teamId: 'team-4', userId: 'user-5', role: TeamRole.ADMIN, joinedAt: randomDate(40) },
    }),
    prisma.teamMember.create({
      data: { teamId: 'team-4', userId: 'user-6', role: TeamRole.MEMBER, joinedAt: randomDate(35) },
    }),
    prisma.teamMember.create({
      data: { teamId: 'team-4', userId: 'user-7', role: TeamRole.MEMBER, joinedAt: randomDate(30) },
    }),
    prisma.teamMember.create({
      data: { teamId: 'team-4', userId: 'user-9', role: TeamRole.MEMBER, joinedAt: randomDate(25) },
    }),
    
    // Team 5 members (2 members - smallest team)
    prisma.teamMember.create({
      data: { teamId: 'team-5', userId: 'user-8', role: TeamRole.ADMIN, joinedAt: randomDate(30) },
    }),
    prisma.teamMember.create({
      data: { teamId: 'team-5', userId: 'user-10', role: TeamRole.MEMBER, joinedAt: randomDate(28) },
    }),
  ]);

  // Create team goals
  console.log('🎯 Creating team goals...');
  await Promise.all([
    // Team 1: Active goal - NYC to LA
    prisma.teamGoal.create({
      data: {
        id: 'goal-1',
        teamId: 'team-1',
        name: 'Walk from NYC to LA',
        description: 'Virtual walk across America from New York City to Los Angeles',
        targetDistance: 4489000, // ~4,489 km
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Started 30 days ago
        endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // Ends 60 days from now
        targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
        status: GoalStatus.ACTIVE,
        createdById: 'user-1',
        startLocation: { lat: 40.7128, lng: -74.0060, address: 'New York City, NY' },
        endLocation: { lat: 34.0522, lng: -118.2437, address: 'Los Angeles, CA' },
        waypoints: [],
        routePolyline: 'placeholder_polyline_nyc_to_la',
        routeData: {
          start: { lat: 40.7128, lng: -74.0060, name: 'New York City, NY' },
          end: { lat: 34.0522, lng: -118.2437, name: 'Los Angeles, CA' },
          waypoints: [],
          bounds: {
            northeast: { lat: 40.7128, lng: -74.0060 },
            southwest: { lat: 34.0522, lng: -118.2437 }
          }
        },
        createdAt: randomDate(31),
      },
    }),
    
    // Team 2: Completed goal - Boston to Miami
    prisma.teamGoal.create({
      data: {
        id: 'goal-2',
        teamId: 'team-2',
        name: 'Boston to Miami Beach Walk',
        description: 'Walking the Eastern Seaboard from Boston to Miami',
        targetDistance: 2572000, // ~2,572 km
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Started 90 days ago
        endDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Ended 5 days ago
        targetDate: randomDate(5),
        status: GoalStatus.COMPLETED,
        createdById: 'user-2',
        startLocation: { lat: 42.3601, lng: -71.0589, address: 'Boston, MA' },
        endLocation: { lat: 25.7907, lng: -80.1300, address: 'Miami Beach, FL' },
        waypoints: [],
        routePolyline: 'placeholder_polyline_boston_to_miami',
        routeData: {
          start: { lat: 42.3601, lng: -71.0589, name: 'Boston, MA' },
          end: { lat: 25.7907, lng: -80.1300, name: 'Miami Beach, FL' },
          waypoints: [],
          bounds: {
            northeast: { lat: 42.3601, lng: -71.0589 },
            southwest: { lat: 25.7907, lng: -80.1300 }
          }
        },
        completedAt: randomDate(5),
        createdAt: randomDate(91),
      },
    }),
    
    // Team 3: Just started - Local city challenge
    prisma.teamGoal.create({
      data: {
        id: 'goal-3',
        teamId: 'team-3',
        name: 'Denver City Circuit',
        description: 'Walk 500km around Denver metro area',
        targetDistance: 500000, // 500 km
        startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Started 5 days ago
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Ends 30 days from now
        targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        status: GoalStatus.ACTIVE,
        createdById: 'user-3',
        startLocation: { lat: 39.7392, lng: -104.9903, address: 'Denver, CO' },
        endLocation: { lat: 39.7392, lng: -104.9903, address: 'Denver, CO' },
        waypoints: [],
        routePolyline: 'placeholder_polyline_denver_circuit',
        routeData: {
          start: { lat: 39.7392, lng: -104.9903, name: 'Denver, CO' },
          end: { lat: 39.7392, lng: -104.9903, name: 'Denver, CO' },
          waypoints: [],
          bounds: {
            northeast: { lat: 39.8, lng: -104.8 },
            southwest: { lat: 39.6, lng: -105.1 }
          }
        },
        createdAt: randomDate(6),
      },
    }),
    
    // Team 4: International challenge
    prisma.teamGoal.create({
      data: {
        id: 'goal-4',
        teamId: 'team-4',
        name: 'London to Paris Virtual Walk',
        description: 'Walking from London to Paris through the virtual Chunnel!',
        targetDistance: 461000, // ~461 km
        startDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // Started 20 days ago
        endDate: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000), // Ends 40 days from now
        targetDate: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000), // 40 days from now
        status: GoalStatus.ACTIVE,
        createdById: 'user-4',
        startLocation: { lat: 51.5074, lng: -0.1278, address: 'London, UK' },
        endLocation: { lat: 48.8566, lng: 2.3522, address: 'Paris, France' },
        waypoints: [],
        routePolyline: 'placeholder_polyline_london_to_paris',
        routeData: {
          start: { lat: 51.5074, lng: -0.1278, name: 'London, UK' },
          end: { lat: 48.8566, lng: 2.3522, name: 'Paris, France' },
          waypoints: [],
          bounds: {
            northeast: { lat: 51.5074, lng: 2.3522 },
            southwest: { lat: 48.8566, lng: -0.1278 }
          }
        },
        createdAt: randomDate(21),
      },
    }),
  ]);

  // Create team progress records
  console.log('📊 Creating team progress...');
  await Promise.all([
    // Team 1 progress (60% complete)
    prisma.teamProgress.create({
      data: {
        teamGoalId: 'goal-1',
        totalDistance: 2693400, // 60% of target
        totalActivities: 75,
        totalDuration: 5760000, // seconds
        lastActivityAt: new Date(),
      },
    }),
    
    // Team 2 progress (100% complete)
    prisma.teamProgress.create({
      data: {
        teamGoalId: 'goal-2',
        totalDistance: 2572000, // 100% of target
        totalActivities: 120,
        totalDuration: 8640000, // seconds
        lastActivityAt: randomDate(5),
      },
    }),
    
    // Team 3 progress (just started)
    prisma.teamProgress.create({
      data: {
        teamGoalId: 'goal-3',
        totalDistance: 45000, // 9% of target
        totalActivities: 12,
        totalDuration: 108000, // seconds
        lastActivityAt: new Date(),
      },
    }),
    
    // Team 4 progress (35% complete)
    prisma.teamProgress.create({
      data: {
        teamGoalId: 'goal-4',
        totalDistance: 161350, // 35% of target
        totalActivities: 45,
        totalDuration: 432000, // seconds
        lastActivityAt: new Date(),
      },
    }),
  ]);

  // Create activities (walks)
  console.log('🚶 Creating activities...');
  const activities = [];
  
  // Generate activities for active users
  const activeUsers = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'];
  const teamGoalAssignments = {
    'user-1': { teamId: 'team-1', goalId: 'goal-1' },
    'user-2': { teamId: 'team-1', goalId: 'goal-1' },
    'user-3': { teamId: 'team-3', goalId: 'goal-3' },
    'user-4': { teamId: 'team-4', goalId: 'goal-4' },
    'user-5': { teamId: 'team-1', goalId: 'goal-1' },
  };
  
  for (const userId of activeUsers) {
    const assignment = teamGoalAssignments[userId];
    const activityCount = 15 + Math.floor(Math.random() * 10); // 15-25 activities per user
    
    for (let i = 0; i < activityCount; i++) {
      const date = randomDate(30);
      const distance = randomWalkingDistance();
      const duration = Math.floor(distance / 1.4); // ~1.4 m/s walking speed
      
      activities.push({
        userId,
        distance,
        duration,
        timestamp: date,
        source: ActivitySource.MANUAL,
        notes: i % 5 === 0 ? `Great ${distance > 5000 ? 'long' : 'morning'} walk!` : null,
        isPrivate: Math.random() > 0.9, // 10% private
        createdAt: date,
      });
    }
  }
  
  // Add some activities for less active users
  const lessActiveUsers = ['user-6', 'user-7', 'user-8', 'user-9', 'user-10'];
  const lessActiveGoals = {
    'user-6': { teamId: 'team-2', goalId: 'goal-2' },
    'user-7': { teamId: 'team-2', goalId: 'goal-2' },
    'user-8': { teamId: 'team-2', goalId: 'goal-2' },
    'user-9': { teamId: 'team-3', goalId: 'goal-3' },
    'user-10': { teamId: 'team-3', goalId: 'goal-3' },
  };
  
  for (const userId of lessActiveUsers) {
    const assignment = lessActiveGoals[userId];
    const activityCount = 5 + Math.floor(Math.random() * 5); // 5-10 activities
    
    for (let i = 0; i < activityCount; i++) {
      const date = randomDate(30);
      const distance = randomWalkingDistance();
      const duration = Math.floor(distance / 1.4);
      
      activities.push({
        userId,
        distance,
        duration,
        timestamp: date,
        source: ActivitySource.MANUAL,
        notes: null,
        isPrivate: false,
        createdAt: date,
      });
    }
  }
  
  await prisma.activity.createMany({ data: activities });

  // Create user stats
  console.log('📈 Creating user stats...');
  const userStats = [];
  
  for (const user of users) {
    const userActivities = activities.filter(a => a.userId === user.id);
    const totalDistance = userActivities.reduce((sum, a) => sum + a.distance, 0);
    const totalDuration = userActivities.reduce((sum, a) => sum + a.duration, 0);
    
    userStats.push({
      userId: user.id,
      totalDistance,
      totalDuration,
      totalActivities: userActivities.length,
      currentStreak: Math.floor(Math.random() * 10),
      longestStreak: Math.floor(Math.random() * 30),
      lastActivityAt: userActivities.length > 0 
        ? userActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0].timestamp
        : new Date(),
    });
  }
  
  await prisma.userStats.createMany({ data: userStats });

  // Create achievements
  console.log('🏆 Creating achievements...');
  const achievements = await Promise.all([
    prisma.achievement.create({
      data: {
        key: 'first-walk',
        name: 'First Steps',
        description: 'Complete your first walk',
        iconUrl: '🚶',
        points: 10,
        category: AchievementCategory.DISTANCE,
        criteria: { type: 'first_activity' },
      },
    }),
    prisma.achievement.create({
      data: {
        key: 'team-player',
        name: 'Team Player',
        description: 'Join your first team',
        iconUrl: '👥',
        points: 20,
        category: AchievementCategory.TEAM,
        criteria: { type: 'join_team' },
      },
    }),
    prisma.achievement.create({
      data: {
        key: 'week-streak',
        name: 'Week Warrior',
        description: 'Walk every day for a week',
        iconUrl: '🔥',
        points: 50,
        category: AchievementCategory.STREAK,
        criteria: { type: 'streak', days: 7 },
      },
    }),
    prisma.achievement.create({
      data: {
        key: 'distance-10k',
        name: '10K Club',
        description: 'Walk 10 kilometers in a single activity',
        iconUrl: '🏃',
        points: 30,
        category: AchievementCategory.DISTANCE,
        criteria: { type: 'single_distance', distance: 10000 },
      },
    }),
    prisma.achievement.create({
      data: {
        key: 'total-100k',
        name: 'Century Walker',
        description: 'Walk a total of 100 kilometers',
        iconUrl: '💯',
        points: 100,
        category: AchievementCategory.DISTANCE,
        criteria: { type: 'total_distance', distance: 100000 },
      },
    }),
  ]);

  // Award achievements to users
  console.log('🎖️ Awarding achievements...');
  const userAchievements = [];
  
  // Create a map of achievement keys to IDs
  const achievementMap = {};
  achievements.forEach(a => {
    achievementMap[a.key] = a.id;
  });
  
  // Everyone gets first walk
  for (const user of users) {
    if (activities.filter(a => a.userId === user.id).length > 0) {
      userAchievements.push({
        userId: user.id,
        achievementId: achievementMap['first-walk'],
        earnedAt: randomDate(30),
      });
    }
  }
  
  // Team members get team player
  const teamMembers = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5', 'user-6', 'user-7', 'user-8', 'user-9', 'user-10'];
  for (const userId of teamMembers) {
    userAchievements.push({
      userId,
      achievementId: achievementMap['team-player'],
      earnedAt: randomDate(25),
    });
  }
  
  // Some users get streak achievements
  const streakUsers = ['user-1', 'user-2', 'user-4'];
  for (const userId of streakUsers) {
    userAchievements.push({
      userId,
      achievementId: achievementMap['week-streak'],
      earnedAt: randomDate(15),
    });
  }
  
  // Check for distance achievements
  for (const user of users) {
    const userActivities = activities.filter(a => a.userId === user.id);
    
    // 10K single walk
    if (userActivities.some(a => a.distance >= 10000)) {
      userAchievements.push({
        userId: user.id,
        achievementId: achievementMap['distance-10k'],
        earnedAt: randomDate(20),
      });
    }
    
    // 100K total
    const totalDistance = userActivities.reduce((sum, a) => sum + a.distance, 0);
    if (totalDistance >= 100000) {
      userAchievements.push({
        userId: user.id,
        achievementId: achievementMap['total-100k'],
        earnedAt: randomDate(10),
      });
    }
  }
  
  await prisma.userAchievement.createMany({ data: userAchievements });

  // Create some pending invites
  console.log('✉️ Creating team invites...');
  await Promise.all([
    prisma.teamInvite.create({
      data: {
        teamId: 'team-1',
        email: 'newuser@example.com',
        invitedByUserId: 'user-1',
        status: InviteStatus.PENDING,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        createdAt: randomDate(2),
      },
    }),
    prisma.teamInvite.create({
      data: {
        teamId: 'team-3',
        email: 'friend@example.com',
        invitedByUserId: 'user-3',
        status: InviteStatus.PENDING,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: randomDate(1),
      },
    }),
  ]);

  // Summary
  console.log('\n✅ Seed completed successfully!');
  console.log(`📊 Created:`);
  console.log(`   - ${users.length} users`);
  console.log(`   - ${teams.length} teams`);
  console.log(`   - ${activities.length} activities`);
  console.log(`   - ${achievements.length} achievements`);
  console.log(`   - ${userAchievements.length} user achievements`);
  console.log(`   - 2 pending team invites`);
  
  // Display some interesting stats
  const mostActiveUser = userStats.sort((a, b) => b.totalDistance - a.totalDistance)[0];
  const mostActiveUserData = users.find(u => u.id === mostActiveUser.userId);
  console.log(`\n🏃 Most active user: ${mostActiveUserData?.name} with ${(mostActiveUser.totalDistance / 1000).toFixed(1)}km walked`);
  
  const largestTeam = await prisma.teamMember.groupBy({
    by: ['teamId'],
    _count: { userId: true },
    orderBy: { _count: { userId: 'desc' } },
    take: 1,
  });
  const largestTeamData = teams.find(t => t.id === largestTeam[0].teamId);
  console.log(`👥 Largest team: ${largestTeamData?.name} with ${largestTeam[0]._count.userId} members`);
}

// Run the seed function
seed()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });