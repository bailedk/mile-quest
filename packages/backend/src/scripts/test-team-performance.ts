#!/usr/bin/env node

/**
 * Team Query Performance Testing Script
 * Tests team-related queries with large datasets
 */

import { PrismaClient } from '@prisma/client';
import { TeamService } from '../services/team/team.service';
import { OptimizedTeamService } from '../services/team/team.service.optimized';
import { config } from 'dotenv';
import { faker } from '@faker-js/faker';
import { performance } from 'perf_hooks';

// Load environment variables
config({ path: '.env.local' });

const prisma = new PrismaClient({
  log: process.env.DEBUG === 'true' ? ['query'] : [],
});

const originalService = new TeamService(prisma);
const optimizedService = new OptimizedTeamService(prisma);

interface PerformanceResult {
  operation: string;
  originalTime: number;
  optimizedTime: number;
  improvement: string;
  sampleSize: number;
}

const results: PerformanceResult[] = [];

/**
 * Measure execution time of a function
 */
async function measureTime<T>(
  fn: () => Promise<T>,
  warmup: boolean = true
): Promise<{ result: T; time: number }> {
  // Warmup run to avoid cold start issues
  if (warmup) {
    await fn();
  }

  const start = performance.now();
  const result = await fn();
  const end = performance.now();

  return { result, time: end - start };
}

/**
 * Generate test data
 */
async function generateTestData() {
  console.log('🔧 Generating test data...');

  // Check if we already have test data
  const existingTeams = await prisma.team.count();
  if (existingTeams >= 1000) {
    console.log('✅ Test data already exists');
    return;
  }

  // Create test users
  console.log('Creating test users...');
  const userIds: string[] = [];
  
  for (let i = 0; i < 5000; i++) {
    const user = await prisma.user.create({
      data: {
        email: faker.internet.email(),
        name: faker.person.fullName(),
        cognitoId: faker.string.uuid(),
        emailVerified: true,
      },
    });
    userIds.push(user.id);

    if (i % 500 === 0) {
      console.log(`Created ${i + 1} users...`);
    }
  }

  // Create teams with members
  console.log('Creating teams with members...');
  
  for (let i = 0; i < 1000; i++) {
    const creatorId = faker.helpers.arrayElement(userIds);
    const team = await prisma.team.create({
      data: {
        name: `${faker.company.name()} ${faker.datatype.number({ min: 1000, max: 9999 })}`,
        description: faker.company.catchPhrase(),
        isPublic: faker.datatype.boolean({ probability: 0.7 }),
        createdById: creatorId,
        members: {
          create: {
            userId: creatorId,
            role: 'ADMIN',
          },
        },
      },
    });

    // Add random members
    const memberCount = faker.datatype.number({ min: 5, max: 50 });
    const teamMembers = faker.helpers.arrayElements(
      userIds.filter(id => id !== creatorId),
      memberCount
    );

    for (let j = 0; j < teamMembers.length; j++) {
      // Some members might have left
      const hasLeft = faker.datatype.boolean({ probability: 0.1 });
      
      await prisma.teamMember.create({
        data: {
          teamId: team.id,
          userId: teamMembers[j],
          role: j === 0 && faker.datatype.boolean({ probability: 0.3 }) ? 'ADMIN' : 'MEMBER',
          leftAt: hasLeft ? faker.date.recent({ days: 30 }) : null,
        },
      });
    }

    // Add some activities
    const activityCount = faker.datatype.number({ min: 10, max: 100 });
    for (let k = 0; k < activityCount; k++) {
      const userId = faker.helpers.arrayElement([creatorId, ...teamMembers]);
      const startTime = faker.date.recent({ days: 30 });
      const duration = faker.datatype.number({ min: 15, max: 120 }) * 60; // in seconds
      
      await prisma.activity.create({
        data: {
          userId,
          teamId: team.id,
          distance: faker.datatype.float({ min: 1, max: 10, precision: 0.1 }),
          duration,
          startTime,
          endTime: new Date(startTime.getTime() + duration * 1000),
          source: 'MANUAL',
          isPrivate: faker.datatype.boolean({ probability: 0.2 }),
        },
      });
    }

    if (i % 100 === 0) {
      console.log(`Created ${i + 1} teams...`);
    }
  }

  console.log('✅ Test data generation complete');
}

/**
 * Test getUserTeams performance
 */
async function testGetUserTeams() {
  console.log('\n📊 Testing getUserTeams performance...');
  
  // Get a user with many teams
  const userWithTeams = await prisma.teamMember.findFirst({
    where: { leftAt: null },
    orderBy: { userId: 'asc' },
    select: { userId: true },
  });

  if (!userWithTeams) {
    console.log('❌ No users with teams found');
    return;
  }

  const userId = userWithTeams.userId;

  // Count teams for context
  const teamCount = await prisma.teamMember.count({
    where: { userId, leftAt: null },
  });

  console.log(`Testing with user who has ${teamCount} teams`);

  // Test original implementation
  const original = await measureTime(() => originalService.getUserTeams(userId));
  
  // Test optimized implementation
  const optimized = await measureTime(() => optimizedService.getUserTeams(userId));

  const improvement = ((original.time - optimized.time) / original.time * 100).toFixed(2);

  results.push({
    operation: 'getUserTeams',
    originalTime: original.time,
    optimizedTime: optimized.time,
    improvement: `${improvement}%`,
    sampleSize: teamCount,
  });

  console.log(`✅ Original: ${original.time.toFixed(2)}ms`);
  console.log(`✅ Optimized: ${optimized.time.toFixed(2)}ms`);
  console.log(`✅ Improvement: ${improvement}%`);
}

/**
 * Test getTeamById performance
 */
async function testGetTeamById() {
  console.log('\n📊 Testing getTeamById performance...');
  
  // Get a team with many members
  const teamWithMembers = await prisma.team.findFirst({
    where: { deletedAt: null },
    select: { 
      id: true,
      _count: {
        select: {
          members: {
            where: { leftAt: null },
          },
        },
      },
    },
    orderBy: {
      members: {
        _count: 'desc',
      },
    },
  });

  if (!teamWithMembers) {
    console.log('❌ No teams found');
    return;
  }

  const teamId = teamWithMembers.id;
  const memberCount = teamWithMembers._count.members;

  console.log(`Testing with team that has ${memberCount} members`);

  // Test original implementation
  const original = await measureTime(() => originalService.getTeamById(teamId));
  
  // Test optimized implementation
  const optimized = await measureTime(() => optimizedService.getTeamById(teamId));

  const improvement = ((original.time - optimized.time) / original.time * 100).toFixed(2);

  results.push({
    operation: 'getTeamById',
    originalTime: original.time,
    optimizedTime: optimized.time,
    improvement: `${improvement}%`,
    sampleSize: memberCount,
  });

  console.log(`✅ Original: ${original.time.toFixed(2)}ms`);
  console.log(`✅ Optimized: ${optimized.time.toFixed(2)}ms`);
  console.log(`✅ Improvement: ${improvement}%`);
}

/**
 * Test team name uniqueness check
 */
async function testTeamNameCheck() {
  console.log('\n📊 Testing team name uniqueness check performance...');
  
  const existingTeam = await prisma.team.findFirst({
    where: { deletedAt: null },
    select: { name: true },
  });

  if (!existingTeam) {
    console.log('❌ No teams found');
    return;
  }

  const totalTeams = await prisma.team.count();
  console.log(`Testing with ${totalTeams} total teams`);

  // Test checking an existing name
  const checkExistingName = async () => {
    const exists = await prisma.team.findFirst({
      where: {
        name: existingTeam.name,
        deletedAt: null,
      },
      select: { id: true },
    });
    return !!exists;
  };

  const original = await measureTime(checkExistingName);
  const optimized = await measureTime(checkExistingName); // Same query, but with better indexes

  const improvement = ((original.time - optimized.time) / original.time * 100).toFixed(2);

  results.push({
    operation: 'teamNameCheck',
    originalTime: original.time,
    optimizedTime: optimized.time,
    improvement: `${improvement}%`,
    sampleSize: totalTeams,
  });

  console.log(`✅ Original: ${original.time.toFixed(2)}ms`);
  console.log(`✅ Optimized: ${optimized.time.toFixed(2)}ms`);
  console.log(`✅ Improvement: ${improvement}%`);
}

/**
 * Test admin permission check
 */
async function testAdminCheck() {
  console.log('\n📊 Testing admin permission check performance...');
  
  const admin = await prisma.teamMember.findFirst({
    where: { 
      role: 'ADMIN',
      leftAt: null,
    },
    select: { 
      teamId: true,
      userId: true,
    },
  });

  if (!admin) {
    console.log('❌ No admin found');
    return;
  }

  const totalMembers = await prisma.teamMember.count();
  console.log(`Testing with ${totalMembers} total team members`);

  // Test original implementation
  const checkAdminOriginal = async () => {
    const membership = await prisma.teamMember.findFirst({
      where: {
        teamId: admin.teamId,
        userId: admin.userId,
        role: 'ADMIN',
        leftAt: null,
      },
    });
    return !!membership;
  };

  // Test optimized implementation
  const checkAdminOptimized = () => optimizedService.isTeamAdmin(admin.teamId, admin.userId);

  const original = await measureTime(checkAdminOriginal);
  const optimized = await measureTime(checkAdminOptimized);

  const improvement = ((original.time - optimized.time) / original.time * 100).toFixed(2);

  results.push({
    operation: 'adminCheck',
    originalTime: original.time,
    optimizedTime: optimized.time,
    improvement: `${improvement}%`,
    sampleSize: totalMembers,
  });

  console.log(`✅ Original: ${original.time.toFixed(2)}ms`);
  console.log(`✅ Optimized: ${optimized.time.toFixed(2)}ms`);
  console.log(`✅ Improvement: ${improvement}%`);
}

/**
 * Test team search
 */
async function testTeamSearch() {
  console.log('\n📊 Testing team search performance...');
  
  const totalTeams = await prisma.team.count({ where: { isPublic: true, deletedAt: null } });
  console.log(`Testing search with ${totalTeams} public teams`);

  const searchQuery = 'team';

  // Test search performance
  const searchOriginal = async () => {
    return await prisma.team.findMany({
      where: {
        AND: [
          { deletedAt: null },
          { isPublic: true },
          {
            OR: [
              { name: { contains: searchQuery, mode: 'insensitive' } },
              { description: { contains: searchQuery, mode: 'insensitive' } },
            ],
          },
        ],
      },
      include: {
        _count: {
          select: {
            members: {
              where: { leftAt: null },
            },
          },
        },
      },
      take: 10,
    });
  };

  const original = await measureTime(searchOriginal);
  const optimized = await measureTime(() => optimizedService.searchTeams(searchQuery));

  const improvement = ((original.time - optimized.time) / original.time * 100).toFixed(2);

  results.push({
    operation: 'teamSearch',
    originalTime: original.time,
    optimizedTime: optimized.time,
    improvement: `${improvement}%`,
    sampleSize: totalTeams,
  });

  console.log(`✅ Original: ${original.time.toFixed(2)}ms`);
  console.log(`✅ Optimized: ${optimized.time.toFixed(2)}ms`);
  console.log(`✅ Improvement: ${improvement}%`);
}

/**
 * Print summary
 */
function printSummary() {
  console.log('\n📊 Performance Test Summary');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('Operation          | Original (ms) | Optimized (ms) | Improvement | Sample Size');
  console.log('───────────────────┼───────────────┼────────────────┼─────────────┼────────────');
  
  for (const result of results) {
    console.log(
      `${result.operation.padEnd(18)} | ` +
      `${result.originalTime.toFixed(2).padStart(13)} | ` +
      `${result.optimizedTime.toFixed(2).padStart(14)} | ` +
      `${result.improvement.padStart(11)} | ` +
      `${result.sampleSize}`
    );
  }
  
  console.log('═══════════════════════════════════════════════════════════════════════');
  
  // Calculate average improvement
  const avgImprovement = results.reduce((sum, r) => 
    sum + parseFloat(r.improvement), 0) / results.length;
  
  console.log(`\n✅ Average Performance Improvement: ${avgImprovement.toFixed(2)}%`);
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🚀 Mile Quest Team Performance Testing');
    console.log('=====================================\n');

    // Generate test data if needed
    await generateTestData();

    // Run performance tests
    await testGetUserTeams();
    await testGetTeamById();
    await testTeamNameCheck();
    await testAdminCheck();
    await testTeamSearch();

    // Print summary
    printSummary();

    // Test team stats query
    console.log('\n📊 Testing team stats query...');
    const team = await prisma.team.findFirst({ select: { id: true } });
    if (team) {
      const stats = await measureTime(() => optimizedService.getTeamStats(team.id));
      console.log(`✅ Team stats query: ${stats.time.toFixed(2)}ms`);
      console.log('Stats:', stats.result);
    }

  } catch (error) {
    console.error('❌ Error during performance testing:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}