/**
 * Activity query performance testing script
 * Tests various query patterns with large datasets
 */

import { PrismaClient, ActivitySource } from '@prisma/client';
import { OptimizedActivityService } from '../services/activity/activity.service.optimized';
import { ActivityService } from '../services/activity/activity.service';

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
  ],
});

// Track query times
const queryTimes: { [key: string]: number[] } = {};

prisma.$on('query', (e: any) => {
  const key = e.query.split(' ')[0] + ' ' + e.query.split(' ')[1];
  if (!queryTimes[key]) queryTimes[key] = [];
  queryTimes[key].push(e.duration);
});

async function seedTestData(userCount: number, activitiesPerUser: number) {
  console.log(`🌱 Seeding test data: ${userCount} users with ${activitiesPerUser} activities each...`);
  
  // Create test team
  const team = await prisma.team.upsert({
    where: { name: 'Performance Test Team' },
    update: {},
    create: {
      name: 'Performance Test Team',
      description: 'Team for performance testing',
      isPublic: true,
      createdById: 'test-user-1',
    },
  });

  // Create test goal
  const goal = await prisma.teamGoal.upsert({
    where: { id: 'test-goal-1' },
    update: {},
    create: {
      id: 'test-goal-1',
      teamId: team.id,
      name: 'Performance Test Goal',
      targetDistance: 1000000, // 1000km
      status: 'ACTIVE',
      routeData: {},
      createdById: 'test-user-1',
    },
  });

  // Batch create users
  const users = Array.from({ length: userCount }, (_, i) => ({
    id: `test-user-${i + 1}`,
    email: `testuser${i + 1}@example.com`,
    name: `Test User ${i + 1}`,
    cognitoId: `cognito-test-${i + 1}`,
  }));

  await prisma.user.createMany({
    data: users,
    skipDuplicates: true,
  });

  // Create team memberships
  await prisma.teamMember.createMany({
    data: users.map(user => ({
      userId: user.id,
      teamId: team.id,
      role: 'MEMBER',
    })),
    skipDuplicates: true,
  });

  // Create activities in batches
  const batchSize = 1000;
  const now = new Date();
  let totalCreated = 0;

  for (let userIndex = 0; userIndex < userCount; userIndex++) {
    const activities = [];
    
    for (let actIndex = 0; actIndex < activitiesPerUser; actIndex++) {
      const daysAgo = Math.floor(Math.random() * 365);
      const startTime = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      const duration = 1800 + Math.floor(Math.random() * 3600); // 30-90 minutes
      const distance = 3000 + Math.floor(Math.random() * 7000); // 3-10km
      
      activities.push({
        userId: users[userIndex].id,
        teamId: team.id,
        teamGoalId: goal.id,
        distance,
        duration,
        startTime,
        endTime: new Date(startTime.getTime() + duration * 1000),
        isPrivate: Math.random() > 0.8, // 20% private
        source: ActivitySource.MANUAL,
      });
    }

    // Create activities in batches
    for (let i = 0; i < activities.length; i += batchSize) {
      const batch = activities.slice(i, i + batchSize);
      await prisma.activity.createMany({ data: batch });
      totalCreated += batch.length;
      
      if (totalCreated % 10000 === 0) {
        console.log(`  Created ${totalCreated} activities...`);
      }
    }
  }

  console.log(`✅ Created ${totalCreated} activities total\n`);
}

async function measureQueryPerformance(
  name: string,
  fn: () => Promise<any>,
  iterations: number = 5
): Promise<{ avg: number; min: number; max: number }> {
  const times: number[] = [];
  
  // Warm up
  await fn();
  
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await fn();
    const elapsed = Date.now() - start;
    times.push(elapsed);
  }
  
  return {
    avg: times.reduce((a, b) => a + b, 0) / times.length,
    min: Math.min(...times),
    max: Math.max(...times),
  };
}

async function runPerformanceTests() {
  const originalService = new ActivityService(prisma);
  const optimizedService = new OptimizedActivityService(prisma);
  
  console.log('🏃 Running performance tests...\n');
  
  const testUserId = 'test-user-1';
  const testTeamId = (await prisma.team.findFirst({ where: { name: 'Performance Test Team' } }))?.id!;
  
  // Test 1: User activity list
  console.log('📋 Test 1: User Activity List (20 items)');
  const userListOriginal = await measureQueryPerformance(
    'Original',
    () => originalService.getActivities(testUserId, { limit: 20 })
  );
  const userListOptimized = await measureQueryPerformance(
    'Optimized',
    () => optimizedService.getActivities(testUserId, { limit: 20 })
  );
  
  console.log(`  Original: ${userListOriginal.avg.toFixed(2)}ms (min: ${userListOriginal.min}ms, max: ${userListOriginal.max}ms)`);
  console.log(`  Optimized: ${userListOptimized.avg.toFixed(2)}ms (min: ${userListOptimized.min}ms, max: ${userListOptimized.max}ms)`);
  console.log(`  Improvement: ${((1 - userListOptimized.avg / userListOriginal.avg) * 100).toFixed(1)}%\n`);
  
  // Test 2: Team activity list with aggregates
  console.log('📋 Test 2: Team Activity List with Aggregates');
  const teamListOptimized = await measureQueryPerformance(
    'Optimized',
    () => optimizedService.getTeamActivities(testTeamId, { limit: 50 })
  );
  
  console.log(`  Team activities with aggregates: ${teamListOptimized.avg.toFixed(2)}ms\n`);
  
  // Test 3: Date range filtering
  console.log('📋 Test 3: Date Range Filtering (last 30 days)');
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const dateRangeOriginal = await measureQueryPerformance(
    'Original',
    () => originalService.getActivities(testUserId, {
      startDate: thirtyDaysAgo.toISOString(),
      endDate: new Date().toISOString(),
    })
  );
  const dateRangeOptimized = await measureQueryPerformance(
    'Optimized',
    () => optimizedService.getActivities(testUserId, {
      startDate: thirtyDaysAgo.toISOString(),
      endDate: new Date().toISOString(),
    })
  );
  
  console.log(`  Original: ${dateRangeOriginal.avg.toFixed(2)}ms`);
  console.log(`  Optimized: ${dateRangeOptimized.avg.toFixed(2)}ms`);
  console.log(`  Improvement: ${((1 - dateRangeOptimized.avg / dateRangeOriginal.avg) * 100).toFixed(1)}%\n`);
  
  // Test 4: Leaderboard queries
  console.log('📋 Test 4: Leaderboard Query (top 10)');
  const leaderboardOptimized = await measureQueryPerformance(
    'Optimized',
    () => optimizedService.getLeaderboard({ teamId: testTeamId, limit: 10 })
  );
  
  console.log(`  Leaderboard generation: ${leaderboardOptimized.avg.toFixed(2)}ms\n`);
  
  // Test 5: Pagination performance
  console.log('📋 Test 5: Pagination Performance (5 pages)');
  let cursor: string | null = null;
  const paginationStart = Date.now();
  
  for (let page = 0; page < 5; page++) {
    const result = await optimizedService.getActivities(testUserId, {
      cursor: cursor || undefined,
      limit: 20,
    });
    cursor = result.nextCursor;
    if (!cursor) break;
  }
  
  const paginationTime = Date.now() - paginationStart;
  console.log(`  5 pages fetched in: ${paginationTime}ms (${(paginationTime / 5).toFixed(2)}ms per page)\n`);
  
  // Test 6: Bulk import performance
  console.log('📋 Test 6: Bulk Import Performance');
  const importActivities = Array.from({ length: 100 }, (_, i) => ({
    teamIds: [testTeamId],
    distance: 5000 + Math.random() * 5000,
    duration: 1800 + Math.random() * 3600,
    activityDate: new Date().toISOString(),
    source: ActivitySource.STRAVA,
    externalId: `strava-${Date.now()}-${i}`,
  }));
  
  const bulkImportTime = await measureQueryPerformance(
    'Bulk Import',
    () => optimizedService.bulkImportActivities(testUserId, importActivities),
    1
  );
  
  console.log(`  100 activities imported in: ${bulkImportTime.avg.toFixed(2)}ms\n`);
  
  // Query analysis
  console.log('📊 Query Analysis:');
  for (const [query, times] of Object.entries(queryTimes)) {
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`  ${query}: ${avg.toFixed(2)}ms avg (${times.length} queries)`);
  }
}

async function analyzeIndexUsage() {
  console.log('\n🔍 Analyzing Index Usage...\n');
  
  // Check index usage for common queries
  const queries = [
    {
      name: 'User activities by date',
      sql: `EXPLAIN (ANALYZE, BUFFERS) 
            SELECT * FROM activities 
            WHERE "userId" = 'test-user-1' 
            ORDER BY "startTime" DESC 
            LIMIT 20`,
    },
    {
      name: 'Team activities (public only)',
      sql: `EXPLAIN (ANALYZE, BUFFERS) 
            SELECT * FROM activities 
            WHERE "teamId" = $1 AND "isPrivate" = false 
            ORDER BY "startTime" DESC 
            LIMIT 50`,
    },
    {
      name: 'Leaderboard aggregation',
      sql: `EXPLAIN (ANALYZE, BUFFERS) 
            SELECT "userId", SUM(distance), COUNT(*) 
            FROM activities 
            WHERE "teamId" = $1 AND "isPrivate" = false 
            GROUP BY "userId" 
            ORDER BY SUM(distance) DESC 
            LIMIT 10`,
    },
  ];
  
  const team = await prisma.team.findFirst({ where: { name: 'Performance Test Team' } });
  
  for (const query of queries) {
    console.log(`📊 ${query.name}:`);
    try {
      const result = await prisma.$queryRawUnsafe(
        query.sql.replace('$1', `'${team?.id}'`)
      );
      console.log('  ✅ Query executed successfully\n');
    } catch (error) {
      console.log('  ❌ Query failed:', error, '\n');
    }
  }
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');
  
  // Delete in correct order to respect foreign keys
  await prisma.userAchievement.deleteMany({});
  await prisma.activity.deleteMany({
    where: {
      userId: {
        startsWith: 'test-user-',
      },
    },
  });
  await prisma.teamProgress.deleteMany({});
  await prisma.teamGoal.deleteMany({
    where: {
      id: 'test-goal-1',
    },
  });
  await prisma.teamMember.deleteMany({
    where: {
      userId: {
        startsWith: 'test-user-',
      },
    },
  });
  await prisma.teamInvite.deleteMany({});
  await prisma.team.deleteMany({
    where: {
      name: 'Performance Test Team',
    },
  });
  await prisma.userStats.deleteMany({
    where: {
      userId: {
        startsWith: 'test-user-',
      },
    },
  });
  await prisma.user.deleteMany({
    where: {
      id: {
        startsWith: 'test-user-',
      },
    },
  });
  
  console.log('✅ Cleanup complete\n');
}

// Main execution
async function main() {
  console.log('🚀 Mile Quest Activity Performance Testing\n');
  
  try {
    // Test with different dataset sizes
    const testConfigs = [
      { users: 10, activitiesPerUser: 100, label: 'Small dataset (1K activities)' },
      { users: 100, activitiesPerUser: 100, label: 'Medium dataset (10K activities)' },
      { users: 100, activitiesPerUser: 1000, label: 'Large dataset (100K activities)' },
    ];
    
    for (const config of testConfigs) {
      console.log(`\n📦 Testing with ${config.label}\n`);
      console.log('='.repeat(60));
      
      await cleanup();
      await seedTestData(config.users, config.activitiesPerUser);
      await runPerformanceTests();
      
      if (config === testConfigs[testConfigs.length - 1]) {
        await analyzeIndexUsage();
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}