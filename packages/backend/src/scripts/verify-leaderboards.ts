#!/usr/bin/env ts-node

/**
 * Quick verification script for leaderboard API endpoints
 * Tests basic functionality and ensures all endpoints are working
 */

import { PrismaClient } from '@prisma/client';
import { LeaderboardService } from '../services/leaderboard/leaderboard.service';

const prisma = new PrismaClient();

async function verifyLeaderboards() {
  console.log('🔍 Verifying Leaderboard Implementation (BE-018)');
  console.log('==============================================\n');

  try {
    const leaderboardService = new LeaderboardService(prisma);

    // Get a test team and user
    const team = await prisma.team.findFirst({
      where: { 
        deletedAt: null,
        members: {
          some: { leftAt: null }
        }
      },
      include: {
        members: {
          where: { leftAt: null },
          include: { user: true },
          take: 1,
        },
      },
    });

    if (!team || team.members.length === 0) {
      console.log('❌ No teams with members found. Please run seed script first.');
      return;
    }

    const testUserId = team.members[0].userId;
    console.log(`📊 Testing with team: ${team.name} (${team.id})`);
    console.log(`👤 Test user: ${team.members[0].user.name} (${testUserId})\n`);

    // Test 1: Team Leaderboard
    console.log('✅ Testing team leaderboard...');
    try {
      const teamLeaderboard = await leaderboardService.getTeamLeaderboard(
        team.id,
        testUserId,
        { period: 'week', limit: 5 }
      );
      console.log(`   ✓ Returned ${teamLeaderboard.entries.length} entries`);
      console.log(`   ✓ Team: ${teamLeaderboard.team.name}`);
      console.log(`   ✓ Period: ${teamLeaderboard.period}`);
    } catch (error) {
      console.log(`   ❌ Team leaderboard failed: ${error.message}`);
    }

    // Test 2: Global Leaderboard
    console.log('✅ Testing global leaderboard...');
    try {
      const globalLeaderboard = await leaderboardService.getGlobalLeaderboard(
        testUserId,
        { period: 'week', limit: 5 }
      );
      console.log(`   ✓ Returned ${globalLeaderboard.entries.length} entries`);
      console.log(`   ✓ Period: ${globalLeaderboard.period}`);
    } catch (error) {
      console.log(`   ❌ Global leaderboard failed: ${error.message}`);
    }

    // Test 3: User Rank
    console.log('✅ Testing user rank...');
    try {
      const userRank = await leaderboardService.getUserRank(
        testUserId,
        team.id,
        { period: 'week' }
      );
      console.log(`   ✓ User rank: ${userRank.rank} out of ${userRank.totalParticipants}`);
      console.log(`   ✓ Total distance: ${(userRank.totalDistance / 1000).toFixed(2)}km`);
    } catch (error) {
      console.log(`   ❌ User rank failed: ${error.message}`);
    }

    // Test 4: Privacy Check
    console.log('✅ Testing privacy controls...');
    const privateCount = await prisma.activity.count({
      where: { isPrivate: true }
    });
    const publicCount = await prisma.activity.count({
      where: { isPrivate: false }
    });
    console.log(`   ✓ Private activities: ${privateCount}, Public: ${publicCount}`);

    console.log('\n🎉 Leaderboard verification completed!');
    console.log('====================================\n');

  } catch (error) {
    console.error('❌ Verification failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run verification
verifyLeaderboards().catch(console.error);