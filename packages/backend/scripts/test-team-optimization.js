#!/usr/bin/env node

/**
 * Test script to verify team query optimization improvements (DB-006)
 * This script demonstrates the performance improvements from the new indexes
 */

const { PrismaClient } = require('@prisma/client');
const { performance } = require('perf_hooks');

const prisma = new PrismaClient({
  log: ['query']
});

async function measureQuery(description, queryFn) {
  console.log(`\n📊 Testing: ${description}`);
  const start = performance.now();
  const result = await queryFn();
  const end = performance.now();
  const duration = (end - start).toFixed(2);
  console.log(`⏱️  Time: ${duration}ms`);
  console.log(`📦 Result count: ${Array.isArray(result) ? result.length : 'single record'}`);
  return { duration: parseFloat(duration), result };
}

async function testTeamQueries() {
  console.log('🚀 Testing Team Query Optimizations (DB-006)\n');
  console.log('================================================\n');

  try {
    // Get a test user
    const testUser = await prisma.user.findFirst();
    if (!testUser) {
      console.error('❌ No users found in database');
      return;
    }
    console.log(`✅ Using test user: ${testUser.name} (${testUser.id})`);

    // Test 1: getUserTeams - Uses idx_team_members_user_active
    await measureQuery(
      'getUserTeams - Fetching all teams for a user',
      async () => {
        return await prisma.teamMember.findMany({
          where: {
            userId: testUser.id,
            leftAt: null,
            team: {
              deletedAt: null,
            },
          },
          include: {
            team: {
              include: {
                _count: {
                  select: {
                    members: {
                      where: {
                        leftAt: null,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: {
            joinedAt: 'desc',
          },
        });
      }
    );

    // Test 2: Team member count - Uses idx_team_members_team_active
    const team = await prisma.team.findFirst();
    if (team) {
      await measureQuery(
        'Active member count for a team',
        async () => {
          return await prisma.teamMember.count({
            where: {
              teamId: team.id,
              leftAt: null,
            },
          });
        }
      );
    }

    // Test 3: Admin permission check - Uses idx_team_members_admin
    if (team) {
      await measureQuery(
        'Check if user is admin of team',
        async () => {
          return await prisma.teamMember.findFirst({
            where: {
              teamId: team.id,
              userId: testUser.id,
              role: 'ADMIN',
              leftAt: null,
            },
            select: { id: true },
          });
        }
      );
    }

    // Test 4: Team name search - Uses idx_teams_name_pattern
    await measureQuery(
      'Search teams by name pattern',
      async () => {
        return await prisma.team.findMany({
          where: {
            deletedAt: null,
            name: {
              contains: 'Team',
              mode: 'insensitive',
            },
          },
          take: 10,
        });
      }
    );

    // Test 5: Public teams discovery - Uses idx_teams_public_active
    await measureQuery(
      'Find public teams (ordered by creation)',
      async () => {
        return await prisma.team.findMany({
          where: {
            isPublic: true,
            deletedAt: null,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 20,
        });
      }
    );

    // Test 6: Member existence check - Uses idx_team_members_unique_active
    if (team) {
      await measureQuery(
        'Check if user is already a member',
        async () => {
          return await prisma.teamMember.findFirst({
            where: {
              teamId: team.id,
              userId: testUser.id,
              leftAt: null,
            },
            select: { id: true },
          });
        }
      );
    }

    // Test 7: Team invite lookup - Uses idx_team_invites_valid
    await measureQuery(
      'Look up valid invite by code',
      async () => {
        return await prisma.teamInvite.findFirst({
          where: {
            code: 'test-invite-code',
            status: 'PENDING',
            expiresAt: { gt: new Date() },
          },
        });
      }
    );

    // Test 8: Complex aggregation using raw SQL
    if (team) {
      await measureQuery(
        'Team statistics aggregation (raw SQL)',
        async () => {
          return await prisma.$queryRaw`
            SELECT 
              COUNT(DISTINCT CASE WHEN tm."leftAt" IS NULL THEN tm."userId" END) as member_count,
              COUNT(DISTINCT CASE WHEN tm."leftAt" IS NULL AND tm."role" = 'ADMIN' THEN tm."userId" END) as admin_count,
              COALESCE(SUM(a."distance"), 0) as total_distance,
              COUNT(DISTINCT a."id") as total_activities
            FROM "teams" t
            LEFT JOIN "team_members" tm ON t."id" = tm."teamId"
            LEFT JOIN "activities" a ON t."id" = a."teamId" AND a."startTime" >= NOW() - INTERVAL '30 days'
            WHERE t."id" = ${team.id}
            GROUP BY t."id"
          `;
        }
      );
    }

    console.log('\n✅ Team query optimization tests completed successfully!');
    console.log('\n📝 Summary of optimizations implemented:');
    console.log('- idx_team_members_user_active: Optimizes getUserTeams queries');
    console.log('- idx_team_members_team_active: Speeds up active member counts');
    console.log('- idx_team_members_admin: Fast admin permission checks');
    console.log('- idx_teams_name_pattern: Efficient team name searches');
    console.log('- idx_teams_public_active: Quick public team discovery');
    console.log('- idx_team_members_unique_active: Fast membership existence checks');
    console.log('- idx_team_invites_valid: Optimized invite code lookups');
    console.log('- team_stats_mv: Materialized view for pre-aggregated stats');

  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the tests
testTeamQueries();