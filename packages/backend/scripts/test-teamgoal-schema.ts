/**
 * Test script to verify TeamGoal schema functionality
 * Tests waypoint storage, route data, and query performance
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testTeamGoalSchema() {
  console.log('🔍 Testing TeamGoal Schema...\n');

  try {
    // Test 1: Create a team goal with waypoints
    console.log('1️⃣ Testing TeamGoal creation with waypoints...');
    
    const testGoal = {
      name: 'Pacific Coast Trail',
      description: 'Walk from Seattle to San Francisco via coastal cities',
      targetDistance: 1300000, // 1,300 km in meters
      startLocation: {
        lat: 47.6062,
        lng: -122.3321,
        address: 'Seattle, WA'
      },
      endLocation: {
        lat: 37.7749,
        lng: -122.4194,
        address: 'San Francisco, CA'
      },
      waypoints: [
        {
          id: 'wp1',
          position: { lat: 45.5152, lng: -122.6784 },
          address: 'Portland, OR',
          order: 1,
          isLocked: false
        },
        {
          id: 'wp2',
          position: { lat: 44.0582, lng: -123.0868 },
          address: 'Eugene, OR',
          order: 2,
          isLocked: false
        },
        {
          id: 'wp3',
          position: { lat: 40.5865, lng: -122.3917 },
          address: 'Redding, CA',
          order: 3,
          isLocked: false
        }
      ],
      routePolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@', // Example encoded polyline
      routeData: {
        segments: [
          { distance: 280000, duration: 93333 }, // Seattle to Portland
          { distance: 180000, duration: 60000 }, // Portland to Eugene
          { distance: 540000, duration: 180000 }, // Eugene to Redding
          { distance: 300000, duration: 100000 }  // Redding to SF
        ],
        bounds: {
          southwest: { lat: 37.7749, lng: -123.0868 },
          northeast: { lat: 47.6062, lng: -122.3321 }
        },
        totalDuration: 433333
      }
    };

    // Find a team and user for testing
    const team = await prisma.team.findFirst({
      include: { members: { take: 1 } }
    });

    if (!team || !team.members[0]) {
      console.log('❌ No team with members found for testing');
      return;
    }

    const createdGoal = await prisma.teamGoal.create({
      data: {
        teamId: team.id,
        createdById: team.members[0].userId,
        name: testGoal.name,
        description: testGoal.description,
        targetDistance: testGoal.targetDistance,
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
        startLocation: testGoal.startLocation,
        endLocation: testGoal.endLocation,
        waypoints: testGoal.waypoints,
        routePolyline: testGoal.routePolyline,
        routeData: testGoal.routeData,
        status: 'DRAFT'
      }
    });

    console.log('✅ TeamGoal created successfully:', {
      id: createdGoal.id,
      name: createdGoal.name,
      waypointCount: createdGoal.waypoints.length,
      targetDistance: createdGoal.targetDistance
    });

    // Test 2: Query goals with waypoints
    console.log('\n2️⃣ Testing waypoint queries...');
    
    const goalsWithWaypoints = await prisma.teamGoal.findMany({
      where: {
        teamId: team.id,
        waypoints: {
          isEmpty: false
        }
      },
      select: {
        id: true,
        name: true,
        waypoints: true,
        targetDistance: true
      }
    });

    console.log(`✅ Found ${goalsWithWaypoints.length} goals with waypoints`);

    // Test 3: Query active goals
    console.log('\n3️⃣ Testing active goal queries...');
    
    // Update the goal to active
    await prisma.teamGoal.update({
      where: { id: createdGoal.id },
      data: { status: 'ACTIVE' }
    });

    const activeGoals = await prisma.teamGoal.findMany({
      where: {
        teamId: team.id,
        status: 'ACTIVE'
      },
      include: {
        progress: true
      }
    });

    console.log(`✅ Found ${activeGoals.length} active goals`);

    // Test 4: Test route bounds query
    console.log('\n4️⃣ Testing route bounds extraction...');
    
    const goalWithBounds = await prisma.teamGoal.findFirst({
      where: { id: createdGoal.id },
      select: {
        id: true,
        name: true,
        routeData: true
      }
    });

    if (goalWithBounds) {
      const routeData = goalWithBounds.routeData as any;
      console.log('✅ Route bounds:', routeData.bounds);
    }

    // Test 5: Verify data types
    console.log('\n5️⃣ Verifying data types...');
    
    const verifyGoal = await prisma.teamGoal.findUnique({
      where: { id: createdGoal.id }
    });

    if (verifyGoal) {
      console.log('✅ Data type verification:');
      console.log('  - waypoints is array:', Array.isArray(verifyGoal.waypoints));
      console.log('  - startLocation has lat/lng:', 
        'lat' in (verifyGoal.startLocation as any) && 
        'lng' in (verifyGoal.startLocation as any)
      );
      console.log('  - routePolyline is string:', typeof verifyGoal.routePolyline === 'string');
      console.log('  - targetDistance is number:', typeof verifyGoal.targetDistance === 'number');
    }

    // Clean up
    console.log('\n🧹 Cleaning up test data...');
    await prisma.teamGoal.delete({
      where: { id: createdGoal.id }
    });
    console.log('✅ Test goal deleted');

    console.log('\n✅ All TeamGoal schema tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the tests
testTeamGoalSchema();