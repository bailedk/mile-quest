#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

async function testProgressService() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Direct Progress Service Test\n');
    
    // Test getting team goal with progress
    const teamGoalId = 'goal-1'; // Walk from NYC to LA
    
    const teamGoal = await prisma.teamGoal.findUnique({
      where: { id: teamGoalId },
      include: {
        team: {
          include: {
            members: {
              where: { leftAt: null },
              include: {
                user: true,
              },
            },
          },
        },
        progress: true,
      },
    });
    
    if (!teamGoal) {
      console.error('❌ Team goal not found');
      return;
    }
    
    console.log('✅ Team goal found:', teamGoal.name);
    console.log('- Team:', teamGoal.team.name);
    console.log('- Members:', teamGoal.team.members.length);
    console.log('- Progress exists:', !!teamGoal.progress);
    
    if (teamGoal.progress) {
      console.log('\nProgress details:');
      console.log('- Total distance:', teamGoal.progress.totalDistance);
      console.log('- Total activities:', teamGoal.progress.totalActivities);
      console.log('- Percent complete:', ((teamGoal.progress.totalDistance / teamGoal.targetDistance) * 100).toFixed(1) + '%');
    }
    
    // Test getting contributors
    const contributors = await prisma.activity.groupBy({
      by: ['userId'],
      where: {
        teamGoalId,
      },
      _sum: {
        distance: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _sum: {
          distance: 'desc',
        },
      },
      take: 5,
    });
    
    console.log('\nTop contributors:');
    for (const contributor of contributors) {
      const user = await prisma.user.findUnique({
        where: { id: contributor.userId },
        select: { name: true },
      });
      console.log(`- ${user?.name}: ${contributor._sum.distance}m (${contributor._count.id} activities)`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testProgressService();