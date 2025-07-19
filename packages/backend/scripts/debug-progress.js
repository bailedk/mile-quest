#!/usr/bin/env node

/**
 * Debug script for Progress service
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import the progress service directly
const { ProgressService } = require('../dist/services/progress/progress.service');

async function debugProgress() {
  try {
    console.log('🔍 Debugging Progress Service\n');
    
    // Create progress service instance
    const progressService = new ProgressService(prisma);
    
    // Test 1: Get team progress
    const teamId = 'cm54pkjdd000913qq9z46l8j1'; // Team Alpha
    console.log(`Testing getMultipleTeamProgress for team: ${teamId}`);
    
    try {
      const teamProgress = await progressService.getMultipleTeamProgress(
        { teamIds: [teamId] },
        { includeEstimates: true, includeContributors: true }
      );
      console.log('✅ Team progress:', JSON.stringify(teamProgress, null, 2));
    } catch (error) {
      console.error('❌ Error getting team progress:', error);
    }
    
    // Test 2: Get specific goal progress
    const goalId = 'cm54pkjdi001013qqo3nnpkbg'; // Team Alpha's goal
    console.log(`\nTesting calculateTeamProgress for goal: ${goalId}`);
    
    try {
      const goalProgress = await progressService.calculateTeamProgress(goalId, {
        includeEstimates: true,
        includeContributors: true,
      });
      console.log('✅ Goal progress:', JSON.stringify(goalProgress, null, 2));
    } catch (error) {
      console.error('❌ Error getting goal progress:', error);
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugProgress();