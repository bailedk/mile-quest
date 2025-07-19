/**
 * Tests for PusherMonitoring
 */

import { PusherMonitoring } from '../monitoring';
import { ConnectionStatus, PusherConnection } from '../types';

describe('PusherMonitoring', () => {
  let monitoring: PusherMonitoring;

  beforeEach(() => {
    monitoring = new PusherMonitoring();
  });

  afterEach(() => {
    monitoring.destroy();
  });

  describe('Connection Tracking', () => {
    it('should register a connection', () => {
      const connection: PusherConnection = {
        id: 'conn-1',
        socketId: 'socket-1',
        userId: 'user-1',
        teamId: 'team-1',
        connectedAt: new Date(),
        lastActivity: new Date(),
        status: ConnectionStatus.CONNECTED,
        channels: new Set(['public-test']),
        metadata: { userAgent: 'test' }
      };

      expect(() => monitoring.registerConnection(connection)).not.toThrow();
      expect(monitoring.getConnection('conn-1')).toBe(connection);
    });

    it('should update connection status', () => {
      const connection: PusherConnection = {
        id: 'conn-1',
        socketId: 'socket-1',
        connectedAt: new Date(),
        lastActivity: new Date(),
        status: ConnectionStatus.CONNECTING,
        channels: new Set()
      };

      monitoring.registerConnection(connection);
      monitoring.updateConnectionStatus('conn-1', ConnectionStatus.CONNECTED);

      expect(connection.status).toBe(ConnectionStatus.CONNECTED);
    });

    it('should remove a connection', () => {
      const connection: PusherConnection = {
        id: 'conn-1',
        socketId: 'socket-1',
        connectedAt: new Date(),
        lastActivity: new Date(),
        status: ConnectionStatus.CONNECTED,
        channels: new Set()
      };

      monitoring.registerConnection(connection);
      monitoring.removeConnection('conn-1');

      expect(monitoring.getConnection('conn-1')).toBeUndefined();
    });
  });

  describe('Message Tracking', () => {
    beforeEach(() => {
      const connection: PusherConnection = {
        id: 'conn-1',
        socketId: 'socket-1',
        connectedAt: new Date(),
        lastActivity: new Date(),
        status: ConnectionStatus.CONNECTED,
        channels: new Set()
      };
      monitoring.registerConnection(connection);
    });

    it('should record messages', () => {
      monitoring.recordMessage('conn-1', 50);
      
      const metrics = monitoring.getConnectionMetrics();
      expect(metrics.messagesPerSecond).toBeGreaterThanOrEqual(0);
    });

    it('should record latency', () => {
      monitoring.recordLatency(100);
      monitoring.recordLatency(200);
      
      const metrics = monitoring.getPerformanceMetrics();
      expect(metrics.averageMessageLatency).toBeGreaterThan(0);
    });
  });

  describe('Error Tracking', () => {
    it('should record errors', () => {
      monitoring.recordError('connection', 'conn-1');
      monitoring.recordError('authentication', 'conn-2');
      monitoring.recordError('message');

      const errorMetrics = monitoring.getErrorMetrics();
      expect(errorMetrics.connectionErrors).toBe(1);
      expect(errorMetrics.authenticationErrors).toBe(1);
      expect(errorMetrics.totalErrors).toBeGreaterThan(0);
    });
  });

  describe('Metrics Collection', () => {
    beforeEach(() => {
      // Add some test connections
      for (let i = 1; i <= 3; i++) {
        const connection: PusherConnection = {
          id: `conn-${i}`,
          socketId: `socket-${i}`,
          userId: `user-${i}`,
          connectedAt: new Date(),
          lastActivity: new Date(),
          status: ConnectionStatus.CONNECTED,
          channels: new Set([`channel-${i}`, 'shared-channel'])
        };
        monitoring.registerConnection(connection);
      }
    });

    it('should provide connection metrics', () => {
      const metrics = monitoring.getConnectionMetrics();

      expect(metrics.totalConnections).toBe(3);
      expect(metrics.activeConnections).toBe(3);
      expect(metrics.totalChannels).toBeGreaterThan(0);
      expect(metrics.messagesPerSecond).toBeGreaterThanOrEqual(0);
      expect(metrics.averageLatency).toBeGreaterThanOrEqual(0);
      expect(metrics.errorRate).toBeGreaterThanOrEqual(0);
      expect(metrics.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should provide error metrics', () => {
      monitoring.recordError('connection');
      monitoring.recordError('authentication');

      const errorMetrics = monitoring.getErrorMetrics();

      expect(errorMetrics.connectionErrors).toBe(1);
      expect(errorMetrics.authenticationErrors).toBe(1);
      expect(errorMetrics.totalErrors).toBeGreaterThanOrEqual(2);
    });

    it('should provide performance metrics', () => {
      monitoring.recordLatency(50);
      monitoring.recordLatency(100);

      const perfMetrics = monitoring.getPerformanceMetrics();

      expect(perfMetrics.averageMessageLatency).toBeGreaterThan(0);
      expect(perfMetrics.throughput).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Health Status', () => {
    it('should provide health status', () => {
      const health = monitoring.getHealthStatus();

      expect(health.status).toMatch(/healthy|degraded|unhealthy/);
      expect(health.connections).toBeDefined();
      expect(health.errors).toBeDefined();
      expect(health.performance).toBeDefined();
      expect(health.lastCheck).toBeInstanceOf(Date);
    });

    it('should mark as degraded with high error rate', () => {
      // Record messages and errors to create error rate
      for (let i = 0; i < 10; i++) {
        monitoring.recordMessage('conn-1');
      }
      for (let i = 0; i < 6; i++) {
        monitoring.recordError('message');
      }

      const health = monitoring.getHealthStatus();
      expect(health.status).toBe('degraded');
    });
  });

  describe('User and Team Queries', () => {
    beforeEach(() => {
      const connections: PusherConnection[] = [
        {
          id: 'conn-1',
          socketId: 'socket-1',
          userId: 'user-1',
          teamId: 'team-1',
          connectedAt: new Date(),
          lastActivity: new Date(),
          status: ConnectionStatus.CONNECTED,
          channels: new Set()
        },
        {
          id: 'conn-2',
          socketId: 'socket-2',
          userId: 'user-1',
          teamId: 'team-2',
          connectedAt: new Date(),
          lastActivity: new Date(),
          status: ConnectionStatus.CONNECTED,
          channels: new Set()
        },
        {
          id: 'conn-3',
          socketId: 'socket-3',
          userId: 'user-2',
          teamId: 'team-1',
          connectedAt: new Date(),
          lastActivity: new Date(),
          status: ConnectionStatus.CONNECTED,
          channels: new Set()
        }
      ];

      connections.forEach(conn => monitoring.registerConnection(conn));
    });

    it('should get user connections', () => {
      const user1Connections = monitoring.getUserConnections('user-1');
      expect(user1Connections).toHaveLength(2);
      
      const user2Connections = monitoring.getUserConnections('user-2');
      expect(user2Connections).toHaveLength(1);
    });

    it('should get team connections', () => {
      const team1Connections = monitoring.getTeamConnections('team-1');
      expect(team1Connections).toHaveLength(2);
      
      const team2Connections = monitoring.getTeamConnections('team-2');
      expect(team2Connections).toHaveLength(1);
    });
  });

  describe('Metrics History', () => {
    it('should provide metrics for time range', () => {
      const startTime = new Date(Date.now() - 60000); // 1 minute ago
      const endTime = new Date();

      // Record some activity
      monitoring.recordMessage('conn-1');
      monitoring.recordError('test');

      const metrics = monitoring.getMetricsForRange(startTime, endTime);
      expect(Array.isArray(metrics)).toBe(true);
    });

    it('should reset metrics', () => {
      monitoring.recordMessage('conn-1');
      monitoring.recordError('test');

      monitoring.resetMetrics();

      const metrics = monitoring.getConnectionMetrics();
      const errors = monitoring.getErrorMetrics();

      // Connections should still be there, but message/error history reset
      expect(errors.totalErrors).toBe(0);
    });
  });
});