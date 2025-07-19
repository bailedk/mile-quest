#!/usr/bin/env tsx
/**
 * Test script for WebSocket authentication endpoints
 * Validates JWT token authentication and channel authorization
 */

import fetch from 'node-fetch';
import { generateAccessToken } from '../utils/auth/jwt.utils';
import { AuthUser } from '@mile-quest/shared';

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api/v1';

// Mock users for testing
const mockUser1: AuthUser = {
  id: 'user-1',
  email: 'alice@example.com',
  name: 'Alice Smith',
  emailVerified: true,
  attributes: {}
};

const mockUser2: AuthUser = {
  id: 'user-2', 
  email: 'bob@example.com',
  name: 'Bob Johnson',
  emailVerified: true,
  attributes: {}
};

async function testWebSocketAuth() {
  console.log('🔌 Testing WebSocket Authentication Endpoints\n');

  // Generate test tokens
  const user1Token = generateAccessToken(mockUser1);
  const user2Token = generateAccessToken(mockUser2);

  let testsPassed = 0;
  let testsTotal = 0;

  // Test 1: Public channel (no auth required)
  testsTotal++;
  console.log('Test 1: Public channel access (no token)');
  try {
    const response = await fetch(`${API_BASE}/websocket/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        socket_id: 'test-socket-1',
        channel_name: 'public-global'
      })
    });

    const result = await response.json();
    if (response.ok && result.status === 'ok') {
      console.log('✅ Public channel access granted without token');
      testsPassed++;
    } else {
      console.log('❌ Public channel access failed:', result);
    }
  } catch (error) {
    console.log('❌ Public channel test error:', error);
  }

  // Test 2: Private channel without token (should fail)
  testsTotal++;
  console.log('\nTest 2: Private channel access (no token)');
  try {
    const response = await fetch(`${API_BASE}/websocket/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        socket_id: 'test-socket-2',
        channel_name: 'private-user-user-1'
      })
    });

    const result = await response.json();
    if (response.status === 401 && result.status === 'forbidden') {
      console.log('✅ Private channel correctly rejected without token');
      testsPassed++;
    } else {
      console.log('❌ Private channel should require token:', result);
    }
  } catch (error) {
    console.log('❌ Private channel test error:', error);
  }

  // Test 3: Valid user accessing their own private channel
  testsTotal++;
  console.log('\nTest 3: User accessing own private channel');
  try {
    const response = await fetch(`${API_BASE}/websocket/auth`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user1Token}`
      },
      body: JSON.stringify({
        socket_id: 'test-socket-3',
        channel_name: 'private-user-user-1'
      })
    });

    const result = await response.json();
    if (response.ok && result.status === 'ok' && result.auth) {
      console.log('✅ User can access own private channel');
      testsPassed++;
    } else {
      console.log('❌ User should access own private channel:', result);
    }
  } catch (error) {
    console.log('❌ Own private channel test error:', error);
  }

  // Test 4: User trying to access another user's private channel (should fail)
  testsTotal++;
  console.log('\nTest 4: User accessing another user\'s private channel');
  try {
    const response = await fetch(`${API_BASE}/websocket/auth`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user1Token}`
      },
      body: JSON.stringify({
        socket_id: 'test-socket-4',
        channel_name: 'private-user-user-2'
      })
    });

    const result = await response.json();
    if (response.status === 403 && result.status === 'forbidden') {
      console.log('✅ User correctly denied access to another user\'s channel');
      testsPassed++;
    } else {
      console.log('❌ User should not access another user\'s channel:', result);
    }
  } catch (error) {
    console.log('❌ Other user channel test error:', error);
  }

  // Test 5: Team channel access (mock team membership)
  testsTotal++;
  console.log('\nTest 5: Team channel access');
  try {
    const response = await fetch(`${API_BASE}/websocket/auth`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user1Token}`
      },
      body: JSON.stringify({
        socket_id: 'test-socket-5',
        channel_name: 'private-team-team-123',
        team_id: 'team-123'
      })
    });

    const result = await response.json();
    if (response.ok && result.status === 'ok' && result.auth) {
      console.log('✅ Team channel access granted (team membership mocked)');
      testsPassed++;
    } else {
      console.log('❌ Team channel access failed:', result);
    }
  } catch (error) {
    console.log('❌ Team channel test error:', error);
  }

  // Test 6: Presence channel with user data
  testsTotal++;
  console.log('\nTest 6: Presence channel with user data');
  try {
    const response = await fetch(`${API_BASE}/websocket/auth`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user1Token}`
      },
      body: JSON.stringify({
        socket_id: 'test-socket-6',
        channel_name: 'presence-team-team-456',
        team_id: 'team-456',
        user_data: { status: 'online', location: 'dashboard' }
      })
    });

    const result = await response.json();
    if (response.ok && result.status === 'ok' && result.auth && result.channel_data) {
      console.log('✅ Presence channel access with user data');
      console.log('   Channel data:', result.channel_data);
      testsPassed++;
    } else {
      console.log('❌ Presence channel should include channel_data:', result);
    }
  } catch (error) {
    console.log('❌ Presence channel test error:', error);
  }

  // Test 7: Invalid JWT token
  testsTotal++;
  console.log('\nTest 7: Invalid JWT token');
  try {
    const response = await fetch(`${API_BASE}/websocket/auth`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-token-here'
      },
      body: JSON.stringify({
        socket_id: 'test-socket-7',
        channel_name: 'private-user-user-1'
      })
    });

    const result = await response.json();
    if (response.status === 403 && result.status === 'forbidden') {
      console.log('✅ Invalid token correctly rejected');
      testsPassed++;
    } else {
      console.log('❌ Invalid token should be rejected:', result);
    }
  } catch (error) {
    console.log('❌ Invalid token test error:', error);
  }

  // Test 8: Temporary token generation
  testsTotal++;
  console.log('\nTest 8: Temporary token generation');
  try {
    const response = await fetch(`${API_BASE}/websocket/token`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${user1Token}`
      }
    });

    const result = await response.json();
    if (response.ok && result.token && result.expiresIn === 300) {
      console.log('✅ Temporary token generated successfully');
      console.log(`   Token expires in: ${result.expiresIn} seconds`);
      testsPassed++;
    } else {
      console.log('❌ Temporary token generation failed:', result);
    }
  } catch (error) {
    console.log('❌ Temporary token test error:', error);
  }

  // Test 9: Missing required parameters
  testsTotal++;
  console.log('\nTest 9: Missing required parameters');
  try {
    const response = await fetch(`${API_BASE}/websocket/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        socket_id: 'test-socket-9'
        // Missing channel_name
      })
    });

    const result = await response.json();
    if (response.status === 400 && result.status === 'forbidden') {
      console.log('✅ Missing parameters correctly rejected');
      testsPassed++;
    } else {
      console.log('❌ Missing parameters should be rejected:', result);
    }
  } catch (error) {
    console.log('❌ Missing parameters test error:', error);
  }

  // Test 10: Admin channel access
  testsTotal++;
  console.log('\nTest 10: Admin channel access');
  try {
    const response = await fetch(`${API_BASE}/websocket/auth`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user1Token}`
      },
      body: JSON.stringify({
        socket_id: 'test-socket-10',
        channel_name: 'private-admin-system'
      })
    });

    const result = await response.json();
    // This should pass because the mock admin check returns true
    if (response.ok && result.status === 'ok') {
      console.log('✅ Admin channel access granted (admin check mocked)');
      testsPassed++;
    } else {
      console.log('❌ Admin channel access failed:', result);
    }
  } catch (error) {
    console.log('❌ Admin channel test error:', error);
  }

  // Results summary
  console.log(`\n📊 Test Results: ${testsPassed}/${testsTotal} tests passed`);
  
  if (testsPassed === testsTotal) {
    console.log('🎉 All WebSocket authentication tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. Check the implementation.');
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  testWebSocketAuth().catch((error) => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}

export { testWebSocketAuth };