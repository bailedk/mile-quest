import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Starting minimal database seed...');

  // Check if test user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: 'test@example.com' }
  });

  if (existingUser) {
    console.log('✅ Test user already exists:', existingUser.email);
  } else {
    // Create test user that matches the mock auth service
    console.log('👥 Creating test user...');
    const testUser = await prisma.user.create({
      data: {
        id: 'test-user-1',
        email: 'test@example.com',
        name: 'Test User',
        cognitoId: 'test-user-1',
        emailVerified: true,
        preferredUnits: 'miles',
        timezone: 'UTC',
      },
    });
    console.log('✅ Test user created:', testUser.email);
  }

  console.log('✨ Minimal seed completed!');
}

seed()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });