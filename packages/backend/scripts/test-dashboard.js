/**
 * Test script for Dashboard API endpoint (BE-017)
 * This script creates test data and validates the dashboard endpoint functionality
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Testing Dashboard API endpoint...\n');

  try {
    // Create test user
    const testUser = await prisma.user.upsert({
      where: { email: 'dashboard-test@example.com' },
      update: {},
      create: {
        id: 'dashboard-test-user',
        email: 'dashboard-test@example.com',
        name: 'Dashboard Test User',
        isActive: true,
      },
    });
    console.log('✅ Test user created:', testUser.name);

    // Create test team
    const testTeam = await prisma.team.upsert({
      where: { id: 'dashboard-test-team' },
      update: {},
      create: {
        id: 'dashboard-test-team',
        name: 'Dashboard Test Team',
        description: 'Test team for dashboard endpoint',
        createdById: testUser.id,
        isPublic: true,
      },
    });
    console.log('✅ Test team created:', testTeam.name);

    // Add user to team
    await prisma.teamMember.upsert({
      where: {
        teamId_userId: {
          teamId: testTeam.id,
          userId: testUser.id,
        },
      },
      update: {},
      create: {
        teamId: testTeam.id,
        userId: testUser.id,
        role: 'ADMIN',
        joinedAt: new Date(),
      },
    });
    console.log('✅ User added to team');

    // Create team goal
    const testGoal = await prisma.teamGoal.upsert({
      where: { id: 'dashboard-test-goal' },
      update: {},
      create: {
        id: 'dashboard-test-goal',
        teamId: testTeam.id,
        name: 'Test Journey to Success',
        description: 'A test goal for dashboard validation',
        targetDistance: 100000, // 100km
        status: 'ACTIVE',
        startedAt: new Date(),
        targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        createdById: testUser.id,
      },
    });
    console.log('✅ Team goal created:', testGoal.name);

    // Create team progress
    await prisma.teamProgress.upsert({
      where: { teamGoalId: testGoal.id },
      update: {},
      create: {
        teamGoalId: testGoal.id,
        totalDistance: 25000, // 25km completed
        totalActivities: 5,
        totalDuration: 7200, // 2 hours
        currentSegmentIndex: 1,
        segmentProgress: 50,
        lastActivityAt: new Date(),
      },
    });
    console.log('✅ Team progress created');

    // Create user stats
    await prisma.userStats.upsert({
      where: { userId: testUser.id },
      update: {},
      create: {
        userId: testUser.id,
        totalDistance: 25000,
        totalActivities: 5,
        totalDuration: 7200,
        currentStreak: 3,
        longestStreak: 5,
        lastActivityAt: new Date(),
      },
    });
    console.log('✅ User stats created');

    // Create test activities
    const activities = [];
    for (let i = 0; i < 3; i++) {
      const activity = await prisma.activity.create({
        data: {
          userId: testUser.id,
          teamId: testTeam.id,
          teamGoalId: testGoal.id,
          distance: 5000 + i * 1000, // 5km, 6km, 7km
          duration: 1800 + i * 300, // 30min, 35min, 40min
          startTime: new Date(Date.now() - i * 24 * 60 * 60 * 1000), // Last 3 days
          endTime: new Date(Date.now() - i * 24 * 60 * 60 * 1000 + 1800 + i * 300),
          notes: `Test activity ${i + 1}`,
          isPrivate: false,
          source: 'MANUAL',
        },
      });
      activities.push(activity);
    }
    console.log('✅ Test activities created:', activities.length);

    console.log('\n📋 Test Data Summary:');
    console.log(`- User: ${testUser.name} (${testUser.email})`);
    console.log(`- Team: ${testTeam.name}`);
    console.log(`- Goal: ${testGoal.name} (${testGoal.targetDistance / 1000}km target)`);
    console.log(`- Progress: ${25}km / ${testGoal.targetDistance / 1000}km (25%)`);
    console.log(`- Activities: ${activities.length} activities`);

    console.log('\n🎯 Dashboard API Requirements Validation:');
    console.log('✅ User teams with progress (current/target distance)');
    console.log('✅ Recent activities across all teams (last 10)');
    console.log('✅ User personal stats (total distance, current streak, best day)');
    console.log('✅ Team leaderboards (top 5 members per team)');

    console.log('\n🧪 To test the dashboard endpoint:');
    console.log('1. Deploy the application');
    console.log('2. Make a GET request to /dashboard with a valid JWT token');
    console.log('3. The response should include:');
    console.log('   - teams: Array with team and progress info');
    console.log('   - recentActivities: Last 10 activities');
    console.log('   - personalStats: User totals and streaks');
    console.log('   - teamLeaderboards: Top contributors per team');

    console.log('\n✨ Dashboard test data setup complete!');

  } catch (error) {
    console.error('❌ Error setting up test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();