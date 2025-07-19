/**
 * WebSocket Service Usage Examples
 * Comprehensive examples demonstrating enhanced WebSocket capabilities
 */

import {
  createWebSocketService,
  createProductionWebSocketService,
  createTestWebSocketService,
  WebSocketEventHandler,
  EventMiddleware,
  PusherWebSocketService,
  MockWebSocketService,
} from './index';

/**
 * Example 1: Basic Service Creation and Usage
 */
export async function basicUsageExample() {
  console.log('=== Basic WebSocket Service Usage ===');
  
  // Create service with automatic provider selection
  const webSocketService = createWebSocketService({
    enableRetries: true,
    maxRetries: 3,
    heartbeatInterval: 30000,
  });
  
  try {
    // Send a single message
    await webSocketService.trigger('private-team-123', 'activity-added', {
      userId: 'user-456',
      distance: 5.2,
      timestamp: new Date().toISOString(),
    });
    
    // Send batch messages for efficiency
    const messages = [
      {
        channel: 'private-team-123',
        event: 'progress-update',
        data: { totalDistance: 125.5, percentComplete: 62.75 },
      },
      {
        channel: 'presence-team-123',
        event: 'user-presence-changed',
        data: { userId: 'user-789', status: 'online' },
      },
    ];
    
    await webSocketService.triggerBatch(messages);
    
    // Check channel information
    const channelInfo = await webSocketService.getChannelInfo('presence-team-123');
    console.log('Channel info:', channelInfo);
    
    // Get users in presence channel
    const users = await webSocketService.getChannelUsers('presence-team-123');
    console.log('Online users:', users);
    
    // Test connection health
    const healthCheck = await webSocketService.healthCheck();
    console.log('Service health:', healthCheck);
    
  } catch (error) {
    console.error('WebSocket operation failed:', error);
  }
  
  // Cleanup if service supports it
  if ('destroy' in webSocketService) {
    (webSocketService as any).destroy();
  }
}

/**
 * Example 2: Production Service Configuration
 */
export async function productionServiceExample() {
  console.log('=== Production WebSocket Service ===');
  
  // Create production-optimized service
  const productionService = createProductionWebSocketService('pusher', {
    // Override production defaults
    maxRetries: 5,
    heartbeatInterval: 60000,
    batchSize: 20,
  });
  
  // Get connection state if service supports it
  if (productionService instanceof PusherWebSocketService) {
    const connectionState = productionService.getConnectionState();
    console.log('Connection state:', {
      isConnected: connectionState.isConnected,
      healthStatus: connectionState.healthStatus,
      config: connectionState.config,
    });
    
    // Test connection with latency measurement
    const testResult = await productionService.testConnection();
    console.log('Connection test:', testResult);
    
    // Reset connection state if needed
    productionService.resetConnectionState();
  }
  
  // Simulate high-load scenario
  const batchMessages = Array.from({ length: 50 }, (_, i) => ({
    channel: `private-team-${Math.floor(i / 10)}`,
    event: 'bulk-update',
    data: { batchId: i, timestamp: Date.now() },
  }));
  
  await productionService.triggerBatch(batchMessages);
  console.log('Bulk messages sent successfully');
  
  productionService.destroy();
}

/**
 * Example 3: Test Service with Simulated Conditions
 */
export async function testServiceExample() {
  console.log('=== Test WebSocket Service ===');
  
  // Create test service with simulated conditions
  const testService = createTestWebSocketService({
    enableSimulatedLatency: true,
    maxLatency: 200,
    enableRandomFailures: true,
    failureRate: 0.1, // 10% failure rate
  });
  
  if (testService instanceof MockWebSocketService) {
    console.log('Initial state:', testService.getConnectionState());
    
    // Test normal operations
    await testService.trigger('test-channel', 'test-event', { test: true });
    
    // Simulate connection failure
    testService.simulateConnectionFailure();
    console.log('After connection failure:', testService.getConnectionState().healthStatus);
    
    try {
      await testService.trigger('test-channel', 'test-event', { test: true });
    } catch (error) {
      console.log('Expected failure during connection down:', error.message);
    }
    
    // Restore connection
    testService.simulateConnectionRestore();
    console.log('After connection restore:', testService.getConnectionState().healthStatus);
    
    // Test with higher failure rate
    testService.setFailureRate(0.5);
    
    let successCount = 0;
    let failureCount = 0;
    
    for (let i = 0; i < 20; i++) {
      try {
        await testService.trigger(`channel-${i}`, 'test', { iteration: i });
        successCount++;
      } catch (error) {
        failureCount++;
      }
    }
    
    console.log('Test results:', { successCount, failureCount });
    console.log('Operation history:', testService.getOperationHistory().slice(-5));
    
    // Get comprehensive metrics
    const finalState = testService.getConnectionState();
    console.log('Final metrics:', finalState.metrics);
  }
  
  testService.destroy();
}

/**
 * Example 4: Event Handler with Real-time Patterns
 */
export async function eventHandlerExample() {
  console.log('=== WebSocket Event Handler ===');
  
  const webSocketService = createTestWebSocketService();
  const eventHandler = new WebSocketEventHandler(webSocketService);
  
  // Add middleware
  eventHandler.use(EventMiddleware.logger('MILE-QUEST'));
  eventHandler.use(EventMiddleware.requireAuth());
  eventHandler.use(EventMiddleware.rateLimit({
    'activity-added': { maxPerMinute: 60, maxPerHour: 600 },
    'achievement-unlocked': { maxPerMinute: 10, maxPerHour: 100 },
  }));
  
  // Register event handlers
  eventHandler.on('activity-added', async (data, metadata) => {
    console.log('Activity added:', data);
    console.log('Metadata:', metadata);
    
    // Process activity logic here
    // e.g., update team progress, check for achievements
  });
  
  eventHandler.on('achievement-unlocked', async (data, metadata) => {
    console.log('Achievement unlocked:', data);
    
    // Send celebration notifications
    // e.g., notify team members, update leaderboards
  });
  
  eventHandler.on('team-member-achievement', async (data, metadata) => {
    console.log('Team member achieved:', data);
    
    // Handle team achievement notifications
  });
  
  // Broadcast activity update
  await eventHandler.broadcastActivity({
    userId: 'user-123',
    teamId: 'team-456',
    distance: 3.2,
    duration: 1200,
    isPrivate: false,
  }, {
    newTotalDistance: 45.8,
    newPercentComplete: 22.9,
    milestoneReached: false,
  });
  
  // Broadcast achievement
  await eventHandler.broadcastAchievement({
    userId: 'user-123',
    achievementId: 'first-5k',
    achievementName: 'First 5K',
    description: 'Complete your first 5K distance',
    type: 'distance',
  }, ['team-456', 'team-789']);
  
  // Broadcast team progress
  await eventHandler.broadcastTeamProgress('team-456', {
    totalDistance: 125.7,
    percentComplete: 62.85,
    isOnTrack: true,
    estimatedCompletionDate: new Date('2024-03-15'),
    topContributors: [
      { userId: 'user-123', name: 'John Doe', distance: 45.8 },
      { userId: 'user-456', name: 'Jane Smith', distance: 38.2 },
      { userId: 'user-789', name: 'Bob Johnson', distance: 41.7 },
    ],
  });
  
  // Broadcast presence update
  await eventHandler.broadcastPresence('user-123', 'online', ['team-456'], {
    name: 'John Doe',
    avatar: 'https://example.com/avatar.jpg',
  });
  
  // Simulate webhook events
  await eventHandler.processWebhookEvent('activity-added', {
    userId: 'user-999',
    distance: 2.1,
    teamId: 'team-456',
  }, {
    channel: 'private-team-456',
    event: 'activity-added',
    timestamp: new Date(),
    userId: 'user-999',
  });
  
  // Check triggered messages
  if (webSocketService instanceof MockWebSocketService) {
    const messages = webSocketService.getTriggeredMessages();
    console.log(`Total messages sent: ${messages.length}`);
    console.log('Recent messages:', messages.slice(-3));
  }
  
  // Cleanup
  eventHandler.destroy();
  webSocketService.destroy();
}

/**
 * Example 5: Authentication and Authorization
 */
export async function authenticationExample() {
  console.log('=== WebSocket Authentication ===');
  
  const webSocketService = createWebSocketService({
    appId: 'test-app',
    key: 'test-key',
    secret: 'test-secret',
    cluster: 'us2',
  });
  
  try {
    // Authenticate private channel
    const privateAuth = webSocketService.authenticateChannel(
      'socket-123456',
      'private-user-789'
    );
    console.log('Private channel auth:', privateAuth);
    
    // Authenticate presence channel
    const presenceAuth = webSocketService.authenticateChannel(
      'socket-123456',
      'presence-team-456',
      'user-789',
      {
        name: 'John Doe',
        avatar: 'https://example.com/avatar.jpg',
        role: 'member',
      }
    );
    console.log('Presence channel auth:', presenceAuth);
    
    // Validate webhook (would normally come from Pusher)
    const webhookBody = JSON.stringify({
      time_ms: Date.now(),
      events: [{
        name: 'channel_occupied',
        channel: 'presence-team-456',
        user_id: 'user-789',
        socket_id: 'socket-123456',
      }],
    });
    
    const isValidWebhook = webSocketService.validateWebhook(
      'expected-signature',
      webhookBody
    );
    console.log('Webhook validation:', isValidWebhook);
    
    // Parse webhook event
    const parsedWebhook = webSocketService.parseWebhook(webhookBody);
    console.log('Parsed webhook:', parsedWebhook);
    
  } catch (error) {
    console.error('Authentication error:', error);
  }
  
  if ('destroy' in webSocketService) {
    (webSocketService as any).destroy();
  }
}

/**
 * Example 6: Error Handling and Recovery
 */
export async function errorHandlingExample() {
  console.log('=== Error Handling and Recovery ===');
  
  const webSocketService = createWebSocketService({
    enableRetries: true,
    maxRetries: 3,
    retryBaseDelay: 500,
  });
  
  // Example of handling different error types
  try {
    // This will trigger retry logic on network errors
    await webSocketService.trigger('test-channel', 'test-event', {
      message: 'This might fail and retry',
    });
    
  } catch (error) {
    if (error.code === 'RATE_LIMITED') {
      console.log('Rate limited - should back off');
      // Implement exponential backoff
      
    } else if (error.code === 'AUTHENTICATION_FAILED') {
      console.log('Auth failed - need to refresh credentials');
      // Refresh authentication
      
    } else if (error.code === 'NETWORK_ERROR') {
      console.log('Network error - connection issues');
      // Check network connectivity
      
    } else {
      console.log('Unexpected error:', error);
    }
  }
  
  // Monitor connection health
  if (webSocketService instanceof PusherWebSocketService) {
    const connectionState = webSocketService.getConnectionState();
    
    switch (connectionState.healthStatus) {
      case 'healthy':
        console.log('Connection is healthy');
        break;
        
      case 'degraded':
        console.log('Connection is degraded - monitoring closely');
        // Maybe reduce message frequency
        break;
        
      case 'unhealthy':
        console.log('Connection is unhealthy - taking corrective action');
        // Reset connection, switch to fallback, etc.
        webSocketService.resetConnectionState();
        break;
    }
    
    // Test connection if needed
    if (connectionState.healthStatus !== 'healthy') {
      const testResult = await webSocketService.testConnection();
      console.log('Connection test after issues:', testResult);
    }
  }
  
  if ('destroy' in webSocketService) {
    (webSocketService as any).destroy();
  }
}

/**
 * Example 7: Integration with Progress Service
 */
export async function progressIntegrationExample() {
  console.log('=== Progress Service Integration ===');
  
  const webSocketService = createWebSocketService();
  const eventHandler = new WebSocketEventHandler(webSocketService);
  
  // Simulate activity processing with real-time updates
  const processActivityAndBroadcast = async (activityData: {
    userId: string;
    teamId: string;
    distance: number;
    duration: number;
    isPrivate: boolean;
  }) => {
    console.log('Processing activity:', activityData);
    
    // Calculate new progress (normally from progress service)
    const progressUpdate = {
      newTotalDistance: 147.3,
      newPercentComplete: 73.65,
      milestoneReached: Math.random() > 0.8, // 20% chance of milestone
    };
    
    // Broadcast activity with progress
    await eventHandler.broadcastActivity(activityData, progressUpdate);
    
    // Check for achievements (normally from achievement service)
    if (activityData.distance >= 5.0 && Math.random() > 0.7) {
      await eventHandler.broadcastAchievement({
        userId: activityData.userId,
        achievementId: '5k-distance',
        achievementName: '5K Achievement',
        description: 'Completed a 5K+ activity',
        type: 'distance',
      }, [activityData.teamId]);
    }
    
    // Update team progress if milestone reached
    if (progressUpdate.milestoneReached) {
      await eventHandler.broadcastTeamProgress(activityData.teamId, {
        totalDistance: progressUpdate.newTotalDistance,
        percentComplete: progressUpdate.newPercentComplete,
        isOnTrack: true,
        topContributors: [
          { userId: activityData.userId, name: 'Active User', distance: 25.5 },
        ],
      });
    }
  };
  
  // Process multiple activities
  const activities = [
    { userId: 'user-1', teamId: 'team-alpha', distance: 3.2, duration: 1200, isPrivate: false },
    { userId: 'user-2', teamId: 'team-alpha', distance: 5.8, duration: 2400, isPrivate: true },
    { userId: 'user-3', teamId: 'team-beta', distance: 2.1, duration: 900, isPrivate: false },
  ];
  
  for (const activity of activities) {
    await processActivityAndBroadcast(activity);
    
    // Small delay to simulate real processing
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Show final message count
  if (webSocketService instanceof MockWebSocketService) {
    const messages = webSocketService.getTriggeredMessages();
    console.log(`Total real-time messages sent: ${messages.length}`);
    
    // Group by event type
    const eventCounts = messages.reduce((acc, msg) => {
      acc[msg.event] = (acc[msg.event] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('Messages by event type:', eventCounts);
  }
  
  eventHandler.destroy();
  webSocketService.destroy();
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log('🚀 WebSocket Service Examples Starting...\n');
  
  try {
    await basicUsageExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await productionServiceExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await testServiceExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await eventHandlerExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await authenticationExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await errorHandlingExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await progressIntegrationExample();
    
    console.log('\n✅ All WebSocket examples completed successfully!');
    
  } catch (error) {
    console.error('❌ Example failed:', error);
  }
}

// Export for easy testing
export default {
  basicUsageExample,
  productionServiceExample,
  testServiceExample,
  eventHandlerExample,
  authenticationExample,
  errorHandlingExample,
  progressIntegrationExample,
  runAllExamples,
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}