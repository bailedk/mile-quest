#!/usr/bin/env ts-node

/**
 * Achievement testing script
 * Tests the achievement detection system
 */

import { PrismaClient } from '@prisma/client';
import { AchievementService } from '../services/achievement';

async function testAchievements() {
  const prisma = new PrismaClient();
  const achievementService = new AchievementService(prisma);

  try {
    console.log('🧪 Testing achievement detection...');
    
    // Initialize achievements first
    await achievementService.initializeAchievements();
    console.log('✅ Achievements initialized');
    
    // Find a test user
    const testUser = await prisma.user.findFirst({
      where: {
        deletedAt: null,
      },
    });
    
    if (!testUser) {
      console.log('❌ No test user found. Please create a user first.');
      return;
    }
    
    console.log(`🔍 Testing achievements for user: ${testUser.name} (${testUser.id})`);
    
    // Check current achievements
    const currentAchievements = await achievementService.getUserAchievements(testUser.id);
    console.log(`\n📊 Current achievement status:`);
    
    currentAchievements.forEach(achievement => {
      if (achievement.earned) {
        console.log(`  ✅ ${achievement.achievement.name} - Earned on ${achievement.earnedAt?.toLocaleDateString()}`);
      } else if (achievement.progress) {
        console.log(`  🔄 ${achievement.achievement.name} - ${achievement.progress.percentage.toFixed(1)}% (${achievement.progress.current}/${achievement.progress.target})`);
      } else {
        console.log(`  ⏸️  ${achievement.achievement.name} - Not started`);
      }
    });
    
    // Run achievement check
    console.log(`\n🔄 Running achievement check...`);
    const checkResult = await achievementService.checkUserAchievements(testUser.id);
    
    if (checkResult.newAchievements.length > 0) {
      console.log(`🎉 New achievements earned:`);
      checkResult.newAchievements.forEach(achievement => {
        console.log(`  🏆 ${achievement.achievement.name} - ${achievement.achievement.description}`);
      });
    } else {
      console.log(`📝 No new achievements earned`);
    }
    
    // Get user stats for context
    const userStats = await prisma.userStats.findUnique({
      where: { userId: testUser.id },
    });
    
    if (userStats) {
      console.log(`\n📈 User stats:`);
      console.log(`  • Total distance: ${(userStats.totalDistance / 1000).toFixed(2)} km`);
      console.log(`  • Total activities: ${userStats.totalActivities}`);
      console.log(`  • Current streak: ${userStats.currentStreak} days`);
    }
    
    // Get team membership count
    const teamCount = await prisma.teamMember.count({
      where: {
        userId: testUser.id,
        leftAt: null,
      },
    });
    console.log(`  • Team memberships: ${teamCount}`);
    
  } catch (error) {
    console.error('❌ Error testing achievements:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if this file is executed directly
if (require.main === module) {
  testAchievements();
}

export { testAchievements };