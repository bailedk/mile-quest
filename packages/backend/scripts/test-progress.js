#!/usr/bin/env node

/**
 * Test script for Progress tracking endpoints (BE-016)
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
  console.log('🧪 Testing Progress Tracking Endpoints (BE-016)\n');

  try {
    // 1. Get team progress
    console.log('📊 Testing GET /progress/team/:teamId');
    const teamId = 'team-1'; // Mile Crushers from seed data
    
    try {
      const teamProgressResponse = await api.get(`/progress/team/${teamId}`);
      console.log('✅ Team progress retrieved:', JSON.stringify(teamProgressResponse.data, null, 2));
    } catch (error) {
      console.error('❌ Failed to get team progress:', error.response?.data || error.message);
    }

    // 2. Get goal progress
    console.log('\n📈 Testing GET /progress/goal/:goalId');
    const goalId = 'goal-1'; // Walk from NYC to LA from seed data
    
    try {
      const goalProgressResponse = await api.get(`/progress/goal/${goalId}`);
      console.log('✅ Goal progress retrieved:', JSON.stringify(goalProgressResponse.data, null, 2));
    } catch (error) {
      console.error('❌ Failed to get goal progress:', error.response?.data || error.message);
    }

    // 3. Get daily progress summary
    console.log('\n📅 Testing GET /progress/goal/:goalId/daily');
    
    try {
      const dailyProgressResponse = await api.get(`/progress/goal/${goalId}/daily?days=7`);
      console.log('✅ Daily progress summary:', JSON.stringify(dailyProgressResponse.data, null, 2));
    } catch (error) {
      console.error('❌ Failed to get daily progress:', error.response?.data || error.message);
    }

    // 4. Get progress trend
    console.log('\n📈 Testing GET /progress/goal/:goalId/trend');
    
    try {
      const trendResponse = await api.get(`/progress/goal/${goalId}/trend?period=WEEK`);
      console.log('✅ Progress trend:', JSON.stringify(trendResponse.data, null, 2));
    } catch (error) {
      console.error('❌ Failed to get progress trend:', error.response?.data || error.message);
    }

    // 5. Test progress update through activity creation
    console.log('\n🏃 Testing progress update via activity creation');
    
    try {
      const activityData = {
        teamIds: [teamId],
        distance: 5000, // 5km
        duration: 1800, // 30 minutes
        activityDate: new Date().toISOString(),
        note: 'Test activity for progress tracking',
        isPrivate: false,
      };

      const activityResponse = await api.post('/activities', activityData);
      console.log('✅ Activity created:', JSON.stringify(activityResponse.data, null, 2));

      // Check updated progress
      const updatedProgressResponse = await api.get(`/progress/goal/${goalId}`);
      console.log('✅ Updated progress after activity:', JSON.stringify(updatedProgressResponse.data, null, 2));
    } catch (error) {
      console.error('❌ Failed to create activity:', error.response?.data || error.message);
    }

    console.log('\n✨ Progress tracking tests completed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run tests
testProgressEndpoints().catch(console.error);