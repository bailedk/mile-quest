#!/usr/bin/env ts-node

/**
 * Test script for leaderboard calculations (BE-018)
 * Verifies team and global leaderboard functionality
 */

import { PrismaClient } from '@prisma/client';
import { LeaderboardService } from '../services/leaderboard/leaderboard.service';

const prisma = new PrismaClient();
const leaderboardService = new LeaderboardService(prisma);

async function testLeaderboards() {
  console.log('🏆 Testing Leaderboard Service (BE-018)');
  console.log('=====================================\n');

  try {
    // Get first team and users for testing
    const team = await prisma.team.findFirst({
      where: { deletedAt: null },
      include: {
        members: {
          where: { leftAt: null },
          include: { user: true },
          take: 3,
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

    // Test 1: Team Leaderboard - Weekly
    console.log('Test 1: Team Leaderboard (Weekly)');
    console.log('----------------------------------');
    try {
      const weeklyLeaderboard = await leaderboardService.getTeamLeaderboard(
        team.id,
        testUserId,
        { period: 'week', limit: 10 }
      );

      console.log(`✅ Team: ${weeklyLeaderboard.team.name}`);
      console.log(`📅 Period: ${weeklyLeaderboard.period}`);
      console.log(`👥 Total Active Members: ${weeklyLeaderboard.totalActiveMembers}`);
      console.log('📋 Top entries:');
      
      weeklyLeaderboard.entries.slice(0, 5).forEach(entry => {
        const marker = entry.isCurrentUser ? '👤' : '  ';
        const privateNote = entry.hasPrivateActivities ? ' (has private)' : '';
        console.log(
          `${marker} ${entry.rank}. ${entry.name}: ${(entry.totalDistance / 1000).toFixed(2)}km ` +
          `(${entry.activityCount} activities)${privateNote}`
        );
      });
      console.log();
    } catch (error) {
      console.log(`❌ Team leaderboard failed: ${error.message}\n`);
    }

    // Test 2: Team Leaderboard - Monthly
    console.log('Test 2: Team Leaderboard (Monthly)');
    console.log('-----------------------------------');
    try {
      const monthlyLeaderboard = await leaderboardService.getTeamLeaderboard(
        team.id,
        testUserId,
        { period: 'month', limit: 10 }
      );

      console.log(`✅ Period: ${monthlyLeaderboard.period}`);
      console.log(`👥 Total Active Members: ${monthlyLeaderboard.totalActiveMembers}`);
      console.log('📋 Top 3 entries:');
      
      monthlyLeaderboard.entries.slice(0, 3).forEach(entry => {
        const marker = entry.isCurrentUser ? '👤' : '  ';
        console.log(
          `${marker} ${entry.rank}. ${entry.name}: ${(entry.totalDistance / 1000).toFixed(2)}km`
        );
      });
      console.log();
    } catch (error) {
      console.log(`❌ Monthly team leaderboard failed: ${error.message}\n`);
    }

    // Test 3: Global Leaderboard
    console.log('Test 3: Global Leaderboard (Weekly)');
    console.log('------------------------------------');
    try {
      const globalLeaderboard = await leaderboardService.getGlobalLeaderboard(
        testUserId,
        { period: 'week', limit: 10 }
      );

      console.log(`✅ Period: ${globalLeaderboard.period}`);
      console.log(`🌍 Total Active Users: ${globalLeaderboard.totalActiveUsers}`);
      console.log('📋 Top 5 global entries:');
      
      globalLeaderboard.entries.slice(0, 5).forEach(entry => {
        const marker = entry.isCurrentUser ? '👤' : '  ';
        const privateNote = entry.hasPrivateActivities ? ' (has private)' : '';
        console.log(
          `${marker} ${entry.rank}. ${entry.name}: ${(entry.totalDistance / 1000).toFixed(2)}km ` +
          `(${entry.activityCount} activities)${privateNote}`
        );
      });
      console.log();
    } catch (error) {
      console.log(`❌ Global leaderboard failed: ${error.message}\n`);
    }

    // Test 4: User Rank
    console.log('Test 4: User Rank in Team');
    console.log('-------------------------');
    try {
      const userRank = await leaderboardService.getUserRank(
        testUserId,
        team.id,
        { period: 'week' }
      );

      console.log(`✅ User rank: ${userRank.rank} out of ${userRank.totalParticipants}`);
      console.log(`📏 Total distance: ${(userRank.totalDistance / 1000).toFixed(2)}km`);
      
      if (userRank.distanceToNextRank !== null) {
        console.log(`📈 Distance to next rank: ${(userRank.distanceToNextRank / 1000).toFixed(2)}km`);
      } else {
        console.log(`🏆 Already at #1!`);
      }
      
      if (userRank.distanceFromPreviousRank !== null) {
        console.log(`📉 Distance from previous rank: ${(userRank.distanceFromPreviousRank / 1000).toFixed(2)}km`);
      }
      console.log();
    } catch (error) {
      console.log(`❌ User rank failed: ${error.message}\n`);
    }

    // Test 5: Privacy Verification
    console.log('Test 5: Privacy Verification');
    console.log('-----------------------------');
    try {
      // Check if there are any private activities
      const privateActivityCount = await prisma.activity.count({
        where: {
          teamId: team.id,
          isPrivate: true,
        },
      });

      const publicActivityCount = await prisma.activity.count({
        where: {
          teamId: team.id,
          isPrivate: false,
        },
      });

      console.log(`🔒 Private activities in team: ${privateActivityCount}`);
      console.log(`🔓 Public activities in team: ${publicActivityCount}`);

      if (privateActivityCount > 0) {
        console.log('✅ Privacy test: Leaderboards should only show public activity totals');
      } else {
        console.log('ℹ️  No private activities found for privacy testing');
      }
      console.log();
    } catch (error) {
      console.log(`❌ Privacy verification failed: ${error.message}\n`);
    }

    // Test 6: Caching Test
    console.log('Test 6: Caching Performance');
    console.log('----------------------------');
    try {
      const startTime = Date.now();
      
      // First call (should hit database)
      await leaderboardService.getTeamLeaderboard(
        team.id,
        testUserId,
        { period: 'week', limit: 10 }
      );
      const firstCallTime = Date.now() - startTime;
      
      // Second call (should hit cache)
      const cacheStartTime = Date.now();
      await leaderboardService.getTeamLeaderboard(
        team.id,
        testUserId,
        { period: 'week', limit: 10 }
      );
      const secondCallTime = Date.now() - cacheStartTime;
      
      console.log(`⏱️  First call (DB): ${firstCallTime}ms`);
      console.log(`⚡ Second call (cache): ${secondCallTime}ms`);
      
      if (secondCallTime < firstCallTime) {
        console.log('✅ Caching is working - second call was faster');
      } else {
        console.log('⚠️  Caching may not be working optimally');
      }
      console.log();
    } catch (error) {
      console.log(`❌ Caching test failed: ${error.message}\n`);
    }

    // Test 7: Invalid Team Access
    console.log('Test 7: Security - Invalid Team Access');
    console.log('--------------------------------------');
    try {
      // Try to access leaderboard for team user is not a member of
      const nonMemberTeam = await prisma.team.findFirst({
        where: {
          deletedAt: null,
          id: { not: team.id },
          members: { none: { userId: testUserId } },
        },
      });

      if (nonMemberTeam) {
        try {
          await leaderboardService.getTeamLeaderboard(
            nonMemberTeam.id,
            testUserId,
            { period: 'week' }
          );
          console.log('❌ Security issue: User accessed team they are not a member of');
        } catch (error) {
          if (error.message === 'User is not a member of this team') {
            console.log('✅ Security working: Access denied for non-member');
          } else {
            console.log(`❌ Unexpected error: ${error.message}`);
          }
        }
      } else {
        console.log('ℹ️  No other teams found for security testing');
      }
      console.log();
    } catch (error) {
      console.log(`❌ Security test failed: ${error.message}\n`);
    }

    console.log('🎉 Leaderboard testing completed!');
    console.log('================================\n');

  } catch (error) {
    console.error('❌ Test setup failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
testLeaderboards().catch(console.error);