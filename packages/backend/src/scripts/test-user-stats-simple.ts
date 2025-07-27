import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testUserStats() {
  try {
    // Direct DB query for test user
    const testUserId = 'test-user-1';
    
    console.log('\n=== Checking UserStats table directly ===');
    const userStats = await prisma.userStats.findUnique({
      where: { userId: testUserId },
    });
    console.log('UserStats for test-user-1:', userStats);
    
    if (!userStats) {
      console.log('\n=== Creating UserStats record ===');
      const newStats = await prisma.userStats.create({
        data: {
          userId: testUserId,
          totalDistance: 0,
          totalActivities: 0,
          totalDuration: 0,
          currentStreak: 0,
          longestStreak: 0,
          lastActivityAt: null,
        },
      });
      console.log('Created UserStats:', newStats);
    }
    
    // Calculate actual stats from activities
    console.log('\n=== Calculating stats from activities ===');
    const activities = await prisma.activity.findMany({
      where: { userId: testUserId },
      orderBy: { timestamp: 'desc' },
    });
    
    console.log(`Found ${activities.length} activities for test user`);
    
    const totalDistance = activities.reduce((sum, a) => sum + a.distance, 0);
    const totalDuration = activities.reduce((sum, a) => sum + a.duration, 0);
    const totalActivities = activities.length;
    const averageDistance = totalActivities > 0 ? totalDistance / totalActivities : 0;
    
    console.log('Calculated stats:');
    console.log(`  Total Distance: ${totalDistance} meters`);
    console.log(`  Total Activities: ${totalActivities}`);
    console.log(`  Total Duration: ${totalDuration} seconds`);
    console.log(`  Average Distance: ${averageDistance} meters`);
    
    // Update UserStats with correct values
    if (totalActivities > 0) {
      console.log('\n=== Updating UserStats with correct values ===');
      const updated = await prisma.userStats.upsert({
        where: { userId: testUserId },
        update: {
          totalDistance,
          totalActivities,
          totalDuration,
          currentStreak: 1, // Simple value for now
          longestStreak: 1,
          lastActivityAt: activities[0].timestamp,
        },
        create: {
          userId: testUserId,
          totalDistance,
          totalActivities,
          totalDuration,
          currentStreak: 1,
          longestStreak: 1,
          lastActivityAt: activities[0].timestamp,
        },
      });
      console.log('Updated UserStats:', updated);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testUserStats();