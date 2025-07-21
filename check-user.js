const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser() {
  try {
    const user = await prisma.user.findUnique({
      where: { id: 'test-user-1' }
    });
    console.log('User found:', user);
    
    if (!user) {
      console.log('Creating test user...');
      const newUser = await prisma.user.create({
        data: {
          id: 'test-user-1',
          email: 'test@example.com',
          name: 'Test User',
          avatarUrl: null
        }
      });
      console.log('User created:', newUser);
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();