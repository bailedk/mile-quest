import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkActivities() {
  try {
    // Get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
      },
    });
    
    console.log('\n=== USERS ===');
    console.log(users);
    
    // Get all activities
    const activities = await prisma.activity.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });
    
    console.log('\n=== ACTIVITIES ===');
    console.log(`Total activities: ${activities.length}`);
    activities.forEach((activity, index) => {
      console.log(`\nActivity ${index + 1}:`);
      console.log(`  ID: ${activity.id}`);
      console.log(`  User: ${activity.user.name} (${activity.user.email})`);
      console.log(`  Distance: ${activity.distance} meters`);
      console.log(`  Duration: ${activity.duration} seconds`);
      console.log(`  Timestamp: ${activity.timestamp}`);
      console.log(`  Source: ${activity.source}`);
      console.log(`  IsPrivate: ${activity.isPrivate}`);
      console.log(`  Notes: ${activity.notes || 'N/A'}`);
    });
    
    // Get UserStats
    const userStats = await prisma.userStats.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });
    
    console.log('\n=== USER STATS ===');
    userStats.forEach(stats => {
      console.log(`\nUser: ${stats.user.name} (${stats.user.email})`);
      console.log(`  Total Distance: ${stats.totalDistance} meters`);
      console.log(`  Total Activities: ${stats.totalActivities}`);
      console.log(`  Total Duration: ${stats.totalDuration} seconds`);
      console.log(`  Current Streak: ${stats.currentStreak}`);
      console.log(`  Longest Streak: ${stats.longestStreak}`);
      console.log(`  Last Activity: ${stats.lastActivityAt || 'N/A'}`);
    });
    
  } catch (error) {
    console.error('Error checking activities:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkActivities();