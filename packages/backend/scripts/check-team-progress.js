#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTeamProgress() {
  try {
    // Check if TeamProgress records exist
    const progressCount = await prisma.teamProgress.count();
    console.log(`TeamProgress records: ${progressCount}`);

    if (progressCount === 0) {
      console.log('\nNo TeamProgress records found. Creating them for existing goals...');
      
      // Get all team goals
      const teamGoals = await prisma.teamGoal.findMany({
        where: {
          status: 'ACTIVE'
        }
      });

      console.log(`Found ${teamGoals.length} active team goals`);

      // Create TeamProgress for each goal
      for (const goal of teamGoals) {
        try {
          await prisma.teamProgress.create({
            data: {
              teamGoalId: goal.id,
              totalDistance: 0,
              totalActivities: 0,
              totalDuration: 0,
              currentSegmentIndex: 0,
              segmentProgress: 0,
            }
          });
          console.log(`Created TeamProgress for goal: ${goal.name}`);
        } catch (error) {
          if (error.code === 'P2002') {
            console.log(`TeamProgress already exists for goal: ${goal.name}`);
          } else {
            console.error(`Error creating TeamProgress for ${goal.name}:`, error.message);
          }
        }
      }
    } else {
      // List existing progress records
      const progress = await prisma.teamProgress.findMany({
        include: {
          teamGoal: true
        }
      });

      console.log('\nExisting TeamProgress records:');
      progress.forEach(p => {
        console.log(`- Goal: ${p.teamGoal.name}, Distance: ${p.totalDistance}m, Activities: ${p.totalActivities}`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTeamProgress();