import { PrismaClient } from '@prisma/client';
import { ActivityService } from '../services/activity/activity.service';

const prisma = new PrismaClient();
const activityService = new ActivityService(prisma);

async function testUserStats() {
  try {
    // Test with the test user
    const testUserId = 'test-user-1';
    
    console.log('\n=== Testing getUserStats for test-user-1 ===');
    const stats = await activityService.getUserStats(testUserId);
    console.log('Stats returned:', JSON.stringify(stats, null, 2));
    
    // Also test getActivities
    console.log('\n=== Testing getActivities for test-user-1 ===');
    const activities = await activityService.getActivities(testUserId, { limit: 10 });
    console.log('Activities returned:', JSON.stringify(activities, null, 2));
    
    // Check if Douglas Bailey has activities
    const dougId = '82e57bd0-7ffa-4753-94de-a263ef0948c6';
    console.log('\n=== Testing getUserStats for Douglas Bailey ===');
    const dougStats = await activityService.getUserStats(dougId);
    console.log('Doug Stats:', JSON.stringify(dougStats, null, 2));
    
    console.log('\n=== Testing getActivities for Douglas Bailey ===');
    const dougActivities = await activityService.getActivities(dougId, { limit: 10 });
    console.log('Doug Activities:', JSON.stringify(dougActivities, null, 2));
    
  } catch (error) {
    console.error('Error testing user stats:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testUserStats();