#!/usr/bin/env tsx

/**
 * Test script for activity endpoints
 * Usage: npm run script test-activities.ts
 */

import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

if (!AUTH_TOKEN) {
  console.error('Please set AUTH_TOKEN environment variable');
  console.error('You can get a token by logging in and checking the network tab');
  process.exit(1);
}

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

async function testActivityEndpoints() {
  try {
    console.log('Testing Activity Endpoints...\n');

    // 1. Create an activity
    console.log('1. Creating activity...');
    const createResponse = await api.post('/activities', {
      teamIds: ['YOUR_TEAM_ID'], // Replace with actual team ID
      distance: 5000, // 5km
      duration: 1800, // 30 minutes
      activityDate: new Date().toISOString(),
      note: 'Morning walk',
      isPrivate: false,
    });
    console.log('✅ Activity created:', createResponse.data);
    const activityId = createResponse.data.data.activity.id;

    // 2. List activities
    console.log('\n2. Listing activities...');
    const listResponse = await api.get('/activities');
    console.log('✅ Activities:', listResponse.data);

    // 3. Update activity
    console.log('\n3. Updating activity...');
    const updateResponse = await api.patch(`/activities/${activityId}`, {
      note: 'Morning walk - updated',
      isPrivate: true,
    });
    console.log('✅ Activity updated:', updateResponse.data);

    // 4. Delete activity
    console.log('\n4. Deleting activity...');
    const deleteResponse = await api.delete(`/activities/${activityId}`);
    console.log('✅ Activity deleted:', deleteResponse.data);

  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Run the tests
testActivityEndpoints();