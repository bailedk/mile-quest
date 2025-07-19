#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

async function listGoals() {
  const prisma = new PrismaClient();
  
  try {
    const goals = await prisma.teamGoal.findMany({
      include: {
        team: true,
        progress: true,
      },
      take: 10,
    });
    
    console.log(`Found ${goals.length} team goals:\n`);
    
    for (const goal of goals) {
      console.log(`Goal: ${goal.name}`);
      console.log(`- ID: ${goal.id}`);
      console.log(`- Team: ${goal.team.name} (${goal.team.id})`);
      console.log(`- Status: ${goal.status}`);
      console.log(`- Target: ${goal.targetDistance}m`);
      console.log(`- Progress: ${goal.progress ? goal.progress.totalDistance + 'm' : 'No progress record'}`);
      console.log('---');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listGoals();