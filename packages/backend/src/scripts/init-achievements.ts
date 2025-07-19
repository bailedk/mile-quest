#!/usr/bin/env ts-node

/**
 * Achievement initialization script
 * Run this to populate the achievements table with predefined achievements
 */

import { PrismaClient } from '@prisma/client';
import { AchievementService } from '../services/achievement';

async function initializeAchievements() {
  const prisma = new PrismaClient();
  const achievementService = new AchievementService(prisma);

  try {
    console.log('Initializing achievements...');
    
    await achievementService.initializeAchievements();
    
    console.log('✅ Achievements initialized successfully');
    
    // List all achievements
    const achievements = await prisma.achievement.findMany({
      orderBy: [{ category: 'asc' }, { points: 'asc' }],
    });
    
    console.log('\n📋 Available achievements:');
    achievements.forEach(achievement => {
      console.log(`  • ${achievement.name} (${achievement.category}, ${achievement.points} pts)`);
      console.log(`    ${achievement.description}`);
    });
    
  } catch (error) {
    console.error('❌ Error initializing achievements:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if this file is executed directly
if (require.main === module) {
  initializeAchievements();
}

export { initializeAchievements };