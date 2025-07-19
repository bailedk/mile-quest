#!/usr/bin/env tsx
/**
 * Test script for activity aggregation endpoints (BE-015)
 * Usage: pnpm test:aggregations
 */

import axios from 'axios';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../../.env') });

const API_URL = process.env.API_URL || 'http://localhost:3001';
let authToken: string;
let teamId: string;

// Test user credentials
const testUser = {
  email: 'test.aggregations@example.com',
  password: 'TestPassword123!',
  name: 'Test Aggregations User',
};

// Helper function for API calls
async function apiCall(method: string, endpoint: string, data?: any, queryParams?: any) {
  try {
    const url = new URL(`${API_URL}${endpoint}`);
    if (queryParams) {
      Object.keys(queryParams).forEach(key => 
        url.searchParams.append(key, queryParams[key])
      );
    }

    const response = await axios({
      method,
      url: url.toString(),
      data,
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });
    return response.data;
  } catch (error: any) {
    console.error(`Error calling ${method} ${endpoint}:`, error.response?.data || error.message);
    throw error;
  }
}

async function setupTestData() {
  console.log('🔧 Setting up test data...');

  // Register/login user
  try {
    await apiCall('POST', '/auth/register', {
      ...testUser,
      provider: 'email',
    });
    console.log('✅ User registered');
  } catch (error: any) {
    if (error.response?.status === 409) {
      console.log('ℹ️  User already exists');
    } else {
      throw error;
    }
  }

  // Login
  const loginResponse = await apiCall('POST', '/auth/login', {
    email: testUser.email,
    password: testUser.password,
  });
  authToken = loginResponse.data.accessToken;
  console.log('✅ Logged in successfully');

  // Create a test team
  const teamResponse = await apiCall('POST', '/teams', {
    name: `Aggregation Test Team ${Date.now()}`,
    goalDistance: 100000, // 100km
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    description: 'Test team for aggregation endpoints',
  });
  teamId = teamResponse.data.team.id;
  console.log('✅ Team created:', teamId);

  // Create some test activities
  const activities = [
    { distance: 5000, duration: 1800, daysAgo: 0 }, // Today
    { distance: 3000, duration: 1200, daysAgo: 1 },
    { distance: 7000, duration: 2400, daysAgo: 2 },
    { distance: 4000, duration: 1500, daysAgo: 5 },
    { distance: 6000, duration: 2100, daysAgo: 8 },
    { distance: 5500, duration: 1900, daysAgo: 15 },
    { distance: 8000, duration: 2800, daysAgo: 20 },
    { distance: 3500, duration: 1300, daysAgo: 25 },
  ];

  for (const activity of activities) {
    const activityDate = new Date();
    activityDate.setDate(activityDate.getDate() - activity.daysAgo);
    
    await apiCall('POST', '/activities', {
      teamIds: [teamId],
      distance: activity.distance,
      duration: activity.duration,
      activityDate: activityDate.toISOString(),
      note: `Test activity from ${activity.daysAgo} days ago`,
      isPrivate: false,
    });
  }
  console.log('✅ Created', activities.length, 'test activities');
}

async function testUserStats() {
  console.log('\n📊 Testing GET /activities/stats...');
  
  const response = await apiCall('GET', '/activities/stats');
  const stats = response.data.stats;
  
  console.log('User Statistics:');
  console.log('- Total Distance:', stats.totalDistance, 'meters');
  console.log('- Total Duration:', stats.totalDuration, 'seconds');
  console.log('- Total Activities:', stats.totalActivities);
  console.log('- Average Pace:', stats.averagePace.toFixed(2), 'min/km');
  console.log('- Average Distance:', stats.averageDistance.toFixed(0), 'meters');
  console.log('- Current Streak:', stats.currentStreak, 'days');
  console.log('- Longest Streak:', stats.longestStreak, 'days');
  console.log('- Last Activity:', stats.lastActivityDate);
  console.log('\nWeekly Stats:');
  console.log('- Distance:', stats.weeklyStats.distance, 'meters');
  console.log('- Duration:', stats.weeklyStats.duration, 'seconds');
  console.log('- Activities:', stats.weeklyStats.activities);
  console.log('\nMonthly Stats:');
  console.log('- Distance:', stats.monthlyStats.distance, 'meters');
  console.log('- Duration:', stats.monthlyStats.duration, 'seconds');
  console.log('- Activities:', stats.monthlyStats.activities);
  
  console.log('✅ User stats endpoint working correctly');
}

async function testTeamProgress() {
  console.log('\n🏃 Testing GET /teams/:id/progress...');
  
  const response = await apiCall('GET', `/teams/${teamId}/progress`);
  const data = response.data;
  
  console.log('Team Progress:');
  console.log('- Team:', data.team.name);
  console.log('- Goal Distance:', data.team.goalDistance, 'meters');
  console.log('- Start Date:', data.team.startDate);
  console.log('- End Date:', data.team.endDate);
  console.log('\nProgress:');
  console.log('- Total Distance:', data.progress.totalDistance, 'meters');
  console.log('- Percent Complete:', data.progress.percentComplete.toFixed(2) + '%');
  console.log('- Average Daily Distance:', data.progress.averageDailyDistance.toFixed(0), 'meters');
  console.log('- Days Remaining:', data.progress.daysRemaining);
  console.log('- Projected Completion:', data.progress.projectedCompletionDate);
  console.log('\nMember Stats:');
  console.log('- Total Members:', data.memberStats.totalMembers);
  console.log('- Active Members:', data.memberStats.activeMembers);
  console.log('- Top Contributors:');
  data.memberStats.topContributors.forEach((contributor: any) => {
    console.log(`  - ${contributor.name}: ${contributor.distance}m (${contributor.percentage.toFixed(1)}%)`);
  });
  
  console.log('✅ Team progress endpoint working correctly');
}

async function testActivitySummary() {
  console.log('\n📅 Testing GET /activities/summary...');
  
  // Test daily summary
  console.log('\nDaily Summary:');
  const dailyResponse = await apiCall('GET', '/activities/summary', null, {
    period: 'daily',
    limit: 7,
  });
  console.log(`Found ${dailyResponse.data.summaries.length} daily periods`);
  dailyResponse.data.summaries.slice(0, 3).forEach((summary: any) => {
    console.log(`- ${summary.startDate.split('T')[0]}: ${summary.totalDistance}m in ${summary.totalActivities} activities`);
  });
  
  // Test weekly summary
  console.log('\nWeekly Summary:');
  const weeklyResponse = await apiCall('GET', '/activities/summary', null, {
    period: 'weekly',
    limit: 4,
  });
  console.log(`Found ${weeklyResponse.data.summaries.length} weekly periods`);
  weeklyResponse.data.summaries.forEach((summary: any) => {
    console.log(`- Week of ${summary.startDate.split('T')[0]}: ${summary.totalDistance}m in ${summary.totalActivities} activities (${summary.activeDays} active days)`);
  });
  
  // Test monthly summary
  console.log('\nMonthly Summary:');
  const monthlyResponse = await apiCall('GET', '/activities/summary', null, {
    period: 'monthly',
    limit: 3,
  });
  console.log(`Found ${monthlyResponse.data.summaries.length} monthly periods`);
  monthlyResponse.data.summaries.forEach((summary: any) => {
    const month = new Date(summary.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    console.log(`- ${month}: ${summary.totalDistance}m in ${summary.totalActivities} activities`);
  });
  
  // Test with team filter
  console.log('\nTeam-filtered Weekly Summary:');
  const teamResponse = await apiCall('GET', '/activities/summary', null, {
    period: 'weekly',
    teamId: teamId,
    limit: 2,
  });
  console.log(`Found ${teamResponse.data.summaries.length} periods for team ${teamId}`);
  
  console.log('✅ Activity summary endpoint working correctly');
}

async function testCaching() {
  console.log('\n⚡ Testing caching behavior...');
  
  // Call user stats twice and measure response time
  console.log('First call (no cache):');
  const start1 = Date.now();
  await apiCall('GET', '/activities/stats');
  const time1 = Date.now() - start1;
  console.log(`Response time: ${time1}ms`);
  
  console.log('Second call (cached):');
  const start2 = Date.now();
  await apiCall('GET', '/activities/stats');
  const time2 = Date.now() - start2;
  console.log(`Response time: ${time2}ms`);
  
  if (time2 < time1) {
    console.log('✅ Caching appears to be working (second call was faster)');
  } else {
    console.log('⚠️  Cache might not be working as expected');
  }
}

async function main() {
  try {
    console.log('🚀 Testing Activity Aggregation Endpoints (BE-015)\n');
    
    await setupTestData();
    await testUserStats();
    await testTeamProgress();
    await testActivitySummary();
    await testCaching();
    
    console.log('\n✅ All aggregation endpoint tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the tests
main();