#!/usr/bin/env node

/**
 * Simple test script for Progress tracking endpoints (BE-016)
 */

const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3001';
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbTU0cGtqZGIwMDAwMTNxcTVhejN0Z2Z2IiwiZW1haWwiOiJhbGljZS5qb2huc29uQGV4YW1wbGUuY29tIiwibmFtZSI6IkFsaWNlIEpvaG5zb24iLCJpYXQiOjE3MzcyOTcyNDh9.vJ-Y-OFW8Y6ypqmVdBpFkDcevK5K5hRU3mPnRHsZy9k';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

async function testProgressEndpoints() {
  console.log('🧪 Testing Progress Tracking Endpoints (BE-016) - Simple Version\n');

  try {
    // 1. Get team progress
    console.log('📊 Testing GET /progress/team/:teamId');
    const teamId = 'team-1'; // Mile Crushers from seed data
    
    try {
      const teamProgressResponse = await api.get(`/progress/team/${teamId}`);
      console.log('✅ Team progress retrieved successfully');
      console.log('- Progress count:', teamProgressResponse.data.progress?.length || 0);
      if (teamProgressResponse.data.progress?.length > 0) {
        const firstProgress = teamProgressResponse.data.progress[0];
        console.log('- First goal:', firstProgress.goalName);
        console.log('- Progress:', `${firstProgress.percentComplete.toFixed(1)}%`);
        console.log('- Distance:', `${firstProgress.totalDistance}m of ${firstProgress.targetDistance}m`);
      }
    } catch (error) {
      console.error('❌ Failed to get team progress:', error.response?.data || error.message);
      if (error.response?.status === 500) {
        console.log('💡 This might be a database connection issue or missing TeamProgress records');
      }
    }

    // 2. Get goal progress
    console.log('\n📈 Testing GET /progress/goal/:goalId');
    const goalId = 'goal-1'; // Walk from NYC to LA from seed data
    
    try {
      const goalProgressResponse = await api.get(`/progress/goal/${goalId}`);
      console.log('✅ Goal progress retrieved successfully');
      const progress = goalProgressResponse.data.progress;
      console.log('- Goal:', progress.goalName);
      console.log('- Progress:', `${progress.percentComplete.toFixed(1)}%`);
      console.log('- Team:', progress.teamId);
      console.log('- Participants:', progress.participantCount);
      if (progress.topContributors?.length > 0) {
        console.log('- Top contributor:', progress.topContributors[0].name);
      }
    } catch (error) {
      console.error('❌ Failed to get goal progress:', error.response?.data || error.message);
    }

    console.log('\n✨ Progress tracking tests completed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run tests
testProgressEndpoints().catch(console.error);