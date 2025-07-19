/**
 * Monitoring and metrics collection for Pusher connections
 */

import { 
  ConnectionMetrics, 
  HealthStatus, 
  ErrorMetrics, 
  PerformanceMetrics,
  PusherConnection,
  ConnectionStatus 
} from './types';

interface MetricsWindow {
  timestamp: Date;
  connections: number;
  messages: number;
  errors: number;
  latency: number[];
}

export class PusherMonitoring {
  private connections = new Map<string, PusherConnection>();
  private metricsHistory: MetricsWindow[] = [];
  private errorCounts = new Map<string, number>();
  private performanceData: PerformanceMetrics = {
    averageConnectionTime: 0,
    averageMessageLatency: 0,
    throughput: 0,
    memoryUsage: 0,
    cpuUsage: 0
  };

  private readonly MAX_HISTORY_SIZE = 300; // 5 minutes at 1-second intervals
  private readonly METRICS_INTERVAL = 1000; // 1 second
  private metricsTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startMetricsCollection();
  }

  /**
   * Register a new connection
   */
  registerConnection(connection: PusherConnection): void {
    this.connections.set(connection.id, connection);
    this.recordConnectionEvent('connected');
  }

  /**
   * Update connection status
   */
  updateConnectionStatus(connectionId: string, status: ConnectionStatus): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      const oldStatus = connection.status;
      connection.status = status;
      connection.lastActivity = new Date();

      if (oldStatus !== status) {
        this.recordConnectionEvent(status);
      }
    }
  }

  /**
   * Remove a connection
   */
  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      this.connections.delete(connectionId);
      this.recordConnectionEvent('disconnected');
    }
  }

  /**
   * Record a message being sent
   */
  recordMessage(connectionId: string, latency?: number): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastActivity = new Date();
    }

    // Record latency if provided
    if (latency !== undefined) {
      this.recordLatency(latency);
    }

    // Update current metrics window
    const currentWindow = this.getCurrentMetricsWindow();
    currentWindow.messages++;
  }

  /**
   * Record an error
   */
  recordError(errorType: string, connectionId?: string): void {
    const count = this.errorCounts.get(errorType) || 0;
    this.errorCounts.set(errorType, count + 1);

    const currentWindow = this.getCurrentMetricsWindow();
    currentWindow.errors++;

    if (connectionId) {
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.lastActivity = new Date();
      }
    }
  }

  /**
   * Record connection latency
   */
  recordLatency(latency: number): void {
    const currentWindow = this.getCurrentMetricsWindow();
    currentWindow.latency.push(latency);
  }

  /**
   * Get current connection metrics
   */
  getConnectionMetrics(): ConnectionMetrics {
    const activeConnections = Array.from(this.connections.values())
      .filter(conn => conn.status === ConnectionStatus.CONNECTED).length;

    const allChannels = new Set<string>();
    this.connections.forEach(conn => {
      conn.channels.forEach(channel => allChannels.add(channel));
    });

    const recentWindows = this.metricsHistory.slice(-60); // Last minute
    const totalMessages = recentWindows.reduce((sum, window) => sum + window.messages, 0);
    const messagesPerSecond = totalMessages / Math.max(recentWindows.length, 1);

    const allLatencies = recentWindows.flatMap(window => window.latency);
    const averageLatency = allLatencies.length > 0 
      ? allLatencies.reduce((sum, lat) => sum + lat, 0) / allLatencies.length 
      : 0;

    const totalErrors = recentWindows.reduce((sum, window) => sum + window.errors, 0);
    const errorRate = totalMessages > 0 ? (totalErrors / totalMessages) * 100 : 0;

    return {
      totalConnections: this.connections.size,
      activeConnections,
      totalChannels: allChannels.size,
      activeChannels: allChannels.size, // Simplified - all subscribed channels are considered active
      messagesPerSecond,
      averageLatency,
      errorRate,
      uptime: this.getUptime()
    };
  }

  /**
   * Get error metrics
   */
  getErrorMetrics(): ErrorMetrics {
    const recentWindows = this.metricsHistory.slice(-60); // Last minute
    const totalErrors = recentWindows.reduce((sum, window) => sum + window.errors, 0);
    const totalMessages = recentWindows.reduce((sum, window) => sum + window.messages, 0);
    const errorRate = totalMessages > 0 ? (totalErrors / totalMessages) * 100 : 0;

    return {
      connectionErrors: this.errorCounts.get('connection') || 0,
      authenticationErrors: this.errorCounts.get('authentication') || 0,
      messageErrors: this.errorCounts.get('message') || 0,
      rateLimitHits: this.errorCounts.get('rateLimit') || 0,
      totalErrors,
      errorRate
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const recentWindows = this.metricsHistory.slice(-60);
    const allLatencies = recentWindows.flatMap(window => window.latency);
    
    const averageLatency = allLatencies.length > 0 
      ? allLatencies.reduce((sum, lat) => sum + lat, 0) / allLatencies.length 
      : 0;

    const totalMessages = recentWindows.reduce((sum, window) => sum + window.messages, 0);
    const throughput = totalMessages / Math.max(recentWindows.length, 1);

    return {
      ...this.performanceData,
      averageMessageLatency: averageLatency,
      throughput
    };
  }

  /**
   * Get overall health status
   */
  getHealthStatus(): HealthStatus {
    const connections = this.getConnectionMetrics();
    const errors = this.getErrorMetrics();
    const performance = this.getPerformanceMetrics();

    // Determine health status based on various factors
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (errors.errorRate > 10) {
      status = 'unhealthy';
    } else if (errors.errorRate > 5 || performance.averageMessageLatency > 1000) {
      status = 'degraded';
    }

    return {
      status,
      connections,
      errors,
      performance,
      lastCheck: new Date()
    };
  }

  /**
   * Get connection details by ID
   */
  getConnection(connectionId: string): PusherConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get all connections for a user
   */
  getUserConnections(userId: string): PusherConnection[] {
    return Array.from(this.connections.values())
      .filter(conn => conn.userId === userId);
  }

  /**
   * Get all connections for a team
   */
  getTeamConnections(teamId: string): PusherConnection[] {
    return Array.from(this.connections.values())
      .filter(conn => conn.teamId === teamId);
  }

  /**
   * Get metrics for a specific time range
   */
  getMetricsForRange(startTime: Date, endTime: Date): MetricsWindow[] {
    return this.metricsHistory.filter(window => 
      window.timestamp >= startTime && window.timestamp <= endTime
    );
  }

  /**
   * Reset all metrics (useful for testing)
   */
  resetMetrics(): void {
    this.metricsHistory = [];
    this.errorCounts.clear();
    this.performanceData = {
      averageConnectionTime: 0,
      averageMessageLatency: 0,
      throughput: 0,
      memoryUsage: 0,
      cpuUsage: 0
    };
  }

  /**
   * Cleanup and stop monitoring
   */
  destroy(): void {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }
    this.connections.clear();
    this.metricsHistory = [];
    this.errorCounts.clear();
  }

  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      this.collectMetrics();
    }, this.METRICS_INTERVAL);
  }

  private collectMetrics(): void {
    // Clean up old metrics
    if (this.metricsHistory.length >= this.MAX_HISTORY_SIZE) {
      this.metricsHistory = this.metricsHistory.slice(-this.MAX_HISTORY_SIZE + 1);
    }

    // Collect system metrics if available
    this.updateSystemMetrics();
  }

  private getCurrentMetricsWindow(): MetricsWindow {
    const now = new Date();
    const currentSecond = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 
      now.getHours(), now.getMinutes(), now.getSeconds());

    // Find or create metrics window for current second
    let currentWindow = this.metricsHistory.find(window => 
      window.timestamp.getTime() === currentSecond.getTime()
    );

    if (!currentWindow) {
      currentWindow = {
        timestamp: currentSecond,
        connections: this.connections.size,
        messages: 0,
        errors: 0,
        latency: []
      };
      this.metricsHistory.push(currentWindow);
    }

    return currentWindow;
  }

  private recordConnectionEvent(event: string): void {
    const currentWindow = this.getCurrentMetricsWindow();
    currentWindow.connections = this.connections.size;
  }

  private updateSystemMetrics(): void {
    // Update performance data with system metrics
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      this.performanceData.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB
    }

    // CPU usage would require additional libraries like 'os' or 'usage'
    // For now, we'll leave it as 0 or implement a simple approximation
  }

  private getUptime(): number {
    // Simple uptime calculation based on when monitoring started
    // In a real implementation, this might track actual service uptime
    return Date.now() - (this.metricsHistory[0]?.timestamp.getTime() || Date.now());
  }
}