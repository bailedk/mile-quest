// Test the activity service directly
const { PrismaClient } = require('@prisma/client');
const { ActivityService } = require('./packages/backend/dist/lambda/activities/index.js');

const prisma = new PrismaClient();
const activityService = new ActivityService(prisma);

async function testActivityService() {
  try {
    console.log('Testing ActivityService.createActivity...');
    
    const result = await activityService.createActivity('test-user-1', {
      distance: 8046.7,
      duration: 10980,
      timestamp: new Date('2025-07-20T23:12:00.000Z'),
      notes: 'Great',
      isPrivate: false,
      source: 'MANUAL'
    });
    
    console.log('Success! Activity created:', result);
  } catch (error) {
    console.error('Error:', error);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testActivityService();