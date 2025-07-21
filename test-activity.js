const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testActivityCreation() {
  try {
    // First check if user exists
    const user = await prisma.user.findUnique({
      where: { id: 'test-user-1' }
    });
    console.log('User found:', user ? 'Yes' : 'No');
    
    // Try to create an activity directly
    const activity = await prisma.activity.create({
      data: {
        userId: 'test-user-1',
        distance: 8046.7,
        duration: 10980,
        pace: 10980 / (8046.7 / 1000), // duration / distance in km
        timestamp: new Date('2025-07-20T23:12:00.000Z'),
        notes: 'Great',
        isPrivate: false,
        source: 'MANUAL'
      }
    });
    
    console.log('Activity created successfully:', activity);
  } catch (error) {
    console.error('Error creating activity:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testActivityCreation();