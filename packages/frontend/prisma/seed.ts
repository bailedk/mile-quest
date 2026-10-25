import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { haversineMeters } from '../src/server/geo';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'password123';

async function clearDatabase(): Promise<void> {
  await prisma.activity.deleteMany();
  await prisma.teamProgress.deleteMany();
  await prisma.teamGoal.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.teamInvite.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.userStats.deleteMany();
  await prisma.team.deleteMany();
  await prisma.user.deleteMany();
}

async function main(): Promise<void> {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0 && process.env.SEED_RESET !== 'true') {
    console.log('Database already has users. Set SEED_RESET=true to replace the demo data.');
    return;
  }

  if (existingUsers > 0) {
    console.log('SEED_RESET=true, replacing existing rows.');
    await clearDatabase();
  }

  const passwordHash = await hash(DEMO_PASSWORD, 10);
  const alice = await prisma.user.create({
    data: {
      email: 'alice@example.com',
      name: 'Alice Walker',
      passwordHash,
      emailVerified: true,
      preferredUnits: 'miles',
      timezone: 'America/Los_Angeles',
    },
  });
  const bob = await prisma.user.create({
    data: {
      email: 'bob@example.com',
      name: 'Bob Runner',
      passwordHash,
      emailVerified: true,
      preferredUnits: 'miles',
      timezone: 'America/Los_Angeles',
    },
  });

  const team = await prisma.team.create({
    data: {
      name: 'Harbor Walkers',
      description: 'A demo team for the waterfront route.',
      isPublic: true,
      createdById: alice.id,
    },
  });
  await prisma.teamMember.create({ data: { teamId: team.id, userId: alice.id, role: 'ADMIN' } });
  await prisma.teamMember.create({ data: { teamId: team.id, userId: bob.id, role: 'MEMBER' } });

  const start = { lat: 37.808, lng: -122.417, address: 'Fisherman\'s Wharf' };
  const end = { lat: 37.795, lng: -122.394, address: 'Ferry Building' };
  const meters = haversineMeters(start, end);
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  const goal = await prisma.teamGoal.create({
    data: {
      teamId: team.id,
      name: 'Wharf to the Ferry Building',
      description: 'Walk the waterfront together.',
      targetDistance: meters,
      targetDate: endDate,
      startDate,
      endDate,
      startLocation: start,
      endLocation: end,
      waypoints: [],
      routePolyline: '',
      routeData: {
        segments: [{ from: 0, to: 1, distance: meters }],
        totalDistance: meters,
      },
      createdById: alice.id,
    },
  });

  const aliceWalk = await prisma.activity.create({
    data: {
      userId: alice.id,
      distance: 3200,
      duration: 2400,
      timestamp: new Date(),
      notes: 'Morning loop',
      isPrivate: false,
    },
  });
  const bobWalk = await prisma.activity.create({
    data: {
      userId: bob.id,
      distance: 1500,
      duration: 1200,
      timestamp: new Date(),
      notes: 'Private errand',
      isPrivate: true,
    },
  });

  await prisma.teamProgress.create({
    data: {
      teamGoalId: goal.id,
      totalDistance: aliceWalk.distance + bobWalk.distance,
      totalActivities: 2,
      totalDuration: aliceWalk.duration + bobWalk.duration,
      lastActivityAt: new Date(),
    },
  });
  await prisma.teamInvite.create({
    data: {
      teamId: team.id,
      invitedByUserId: alice.id,
      code: 'WALK-TOGETHER',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('Seeded Neon demo data.');
  console.log('alice@example.com / password123 (admin)');
  console.log('bob@example.com / password123 (member)');
  console.log('Invite code: WALK-TOGETHER');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
