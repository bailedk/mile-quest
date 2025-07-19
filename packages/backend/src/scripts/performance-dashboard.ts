/**
 * API Performance Dashboard - BE-701
 * Simple command-line dashboard for monitoring API performance in real-time
 */

import { apiPerformanceService } from '../services/performance-monitoring/api-performance.service';
import { ProductionPerformanceService } from '../services/performance-monitoring/production-performance.service';
import { prisma } from '../lib/database';
import { checkDatabaseHealth } from '../lib/database';

interface DashboardConfig {
  refreshInterval: number; // milliseconds
  showRealtime: boolean;
  showDatabase: boolean;
  showAlerts: boolean;
  showEndpoints: boolean;
  compactMode: boolean;
}

export class PerformanceDashboard {
  private config: DashboardConfig;
  private productionService: ProductionPerformanceService;
  private isRunning = false;
  private refreshTimer?: NodeJS.Timeout;

  constructor(config: Partial<DashboardConfig> = {}) {
    this.config = {
      refreshInterval: config.refreshInterval || 5000, // 5 seconds
      showRealtime: config.showRealtime !== false,
      showDatabase: config.showDatabase !== false,
      showAlerts: config.showAlerts !== false,
      showEndpoints: config.showEndpoints !== false,
      compactMode: config.compactMode || false,
    };

    this.productionService = new ProductionPerformanceService(prisma);
  }

  /**
   * Start the dashboard
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Dashboard is already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting Mile Quest API Performance Dashboard');
    console.log(`📊 Refresh interval: ${this.config.refreshInterval / 1000}s`);
    console.log('Press Ctrl+C to exit\n');

    // Initial render
    await this.render();

    // Set up refresh timer
    this.refreshTimer = setInterval(async () => {
      await this.render();
    }, this.config.refreshInterval);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      this.stop();
    });

    process.on('SIGTERM', () => {
      this.stop();
    });
  }

  /**
   * Stop the dashboard
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    console.log('\n👋 Stopping dashboard...');
    process.exit(0);
  }

  /**
   * Render the dashboard
   */
  private async render(): Promise<void> {
    try {
      // Clear screen and move cursor to top
      process.stdout.write('\x1B[2J\x1B[0f');

      // Header
      this.renderHeader();

      // Get data in parallel
      const [
        realtimeMetrics,
        summary24h,
        alerts,
        databaseHealth,
        databaseMetrics,
      ] = await Promise.all([
        this.config.showRealtime ? apiPerformanceService.getRealtimeMetrics() : null,
        this.config.showEndpoints ? apiPerformanceService.getPerformanceSummary(24) : null,
        this.config.showAlerts ? apiPerformanceService.getPerformanceAlerts() : null,
        this.config.showDatabase ? checkDatabaseHealth() : null,
        this.config.showDatabase ? this.productionService.getComprehensiveMetrics() : null,
      ]);

      // Render sections
      if (this.config.showRealtime && realtimeMetrics) {
        this.renderRealtimeMetrics(realtimeMetrics);
      }

      if (this.config.showDatabase && databaseHealth && databaseMetrics) {
        this.renderDatabaseMetrics(databaseHealth, databaseMetrics);
      }

      if (this.config.showAlerts && alerts) {
        this.renderAlerts(alerts);
      }

      if (this.config.showEndpoints && summary24h) {
        this.renderEndpointPerformance(summary24h);
      }

      // Footer
      this.renderFooter();

    } catch (error) {
      console.error('Dashboard render error:', error);
    }
  }

  /**
   * Render dashboard header
   */
  private renderHeader(): void {
    const timestamp = new Date().toLocaleString();
    const title = '📊 Mile Quest API Performance Dashboard';
    
    console.log('='.repeat(80));
    console.log(title.padEnd(60) + timestamp);
    console.log('='.repeat(80));
  }

  /**
   * Render real-time metrics
   */
  private renderRealtimeMetrics(metrics: any): void {
    console.log('\n🔥 Real-time Metrics');
    console.log('-'.repeat(40));

    const throughputColor = metrics.currentThroughput > 10 ? '🟢' : 
                           metrics.currentThroughput > 5 ? '🟡' : '🔴';
    
    const latencyColor = metrics.averageLatency < 500 ? '🟢' :
                        metrics.averageLatency < 1000 ? '🟡' : '🔴';
    
    const errorColor = metrics.errorRate < 1 ? '🟢' :
                      metrics.errorRate < 5 ? '🟡' : '🔴';

    if (this.config.compactMode) {
      console.log(`${throughputColor} Throughput: ${metrics.currentThroughput.toFixed(1)} req/min | ${latencyColor} Latency: ${metrics.averageLatency}ms | ${errorColor} Errors: ${metrics.errorRate.toFixed(1)}%`);
    } else {
      console.log(`${throughputColor} Throughput:     ${metrics.currentThroughput.toFixed(1)} requests/minute`);
      console.log(`${latencyColor} Avg Latency:    ${metrics.averageLatency}ms`);
      console.log(`${errorColor} Error Rate:     ${metrics.errorRate.toFixed(1)}%`);
      console.log(`🧠 Memory Usage:   ${metrics.memoryUsage}%`);
      console.log(`🔗 Connections:    ${metrics.activeConnections}`);
    }
  }

  /**
   * Render database metrics
   */
  private renderDatabaseMetrics(health: any, metrics: any): void {
    console.log('\n🗄️  Database Performance');
    console.log('-'.repeat(40));

    const healthColor = health.status === 'healthy' ? '🟢' :
                       health.status === 'degraded' ? '🟡' : '🔴';

    const poolColor = metrics.connectionPool.connectionUtilization < 70 ? '🟢' :
                     metrics.connectionPool.connectionUtilization < 90 ? '🟡' : '🔴';

    const cacheColor = metrics.queryPerformance.cacheHitRatio > 90 ? '🟢' :
                      metrics.queryPerformance.cacheHitRatio > 80 ? '🟡' : '🔴';

    if (this.config.compactMode) {
      console.log(`${healthColor} Status: ${health.status} | ${poolColor} Pool: ${metrics.connectionPool.connectionUtilization.toFixed(1)}% | ${cacheColor} Cache: ${metrics.queryPerformance.cacheHitRatio.toFixed(1)}%`);
    } else {
      console.log(`${healthColor} Health Status:    ${health.status.toUpperCase()}`);
      console.log(`⚡ Response Time:    ${health.responseTime}ms`);
      console.log(`${poolColor} Connection Pool:  ${metrics.connectionPool.connectionUtilization.toFixed(1)}% (${metrics.connectionPool.activeConnections}/${metrics.connectionPool.totalConnections})`);
      console.log(`${cacheColor} Cache Hit Ratio:  ${metrics.queryPerformance.cacheHitRatio.toFixed(1)}%`);
      console.log(`📊 Query Avg Time:   ${metrics.queryPerformance.averageQueryTime.toFixed(1)}ms`);
      
      if (metrics.materializedViews.staleViews > 0) {
        console.log(`⚠️  Stale Views:      ${metrics.materializedViews.staleViews}`);
      }
    }
  }

  /**
   * Render performance alerts
   */
  private renderAlerts(alerts: any[]): void {
    console.log('\n🚨 Performance Alerts');
    console.log('-'.repeat(40));

    if (alerts.length === 0) {
      console.log('✅ No active alerts');
      return;
    }

    const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
    const highAlerts = alerts.filter(a => a.severity === 'high').length;
    const mediumAlerts = alerts.filter(a => a.severity === 'medium').length;

    console.log(`🔴 Critical: ${criticalAlerts} | 🟠 High: ${highAlerts} | 🟡 Medium: ${mediumAlerts}`);

    if (!this.config.compactMode) {
      // Show top 5 most severe alerts
      alerts
        .sort((a, b) => {
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return severityOrder[b.severity] - severityOrder[a.severity];
        })
        .slice(0, 5)
        .forEach(alert => {
          const icon = alert.severity === 'critical' ? '🔴' :
                      alert.severity === 'high' ? '🟠' :
                      alert.severity === 'medium' ? '🟡' : '🔵';
          
          const time = new Date(alert.timestamp).toLocaleTimeString();
          console.log(`${icon} [${time}] ${alert.message}`);
          
          if (alert.endpoint) {
            console.log(`   Endpoint: ${alert.endpoint}`);
          }
        });
    }
  }

  /**
   * Render endpoint performance
   */
  private renderEndpointPerformance(summary: any): void {
    console.log('\n🎯 Top Endpoints (24h)');
    console.log('-'.repeat(40));

    if (summary.topEndpoints.length === 0) {
      console.log('No endpoint data available');
      return;
    }

    console.log(`📈 Total Requests: ${summary.totalRequests} | ⚡ Avg Latency: ${summary.averageResponseTime}ms | ✅ Success Rate: ${summary.successRate.toFixed(1)}%`);

    if (!this.config.compactMode) {
      console.log('\nTop 5 by Volume:');
      summary.topEndpoints.slice(0, 5).forEach((endpoint: any, index: number) => {
        const statusIcon = endpoint.errorRate < 1 ? '🟢' :
                          endpoint.errorRate < 5 ? '🟡' : '🔴';
        
        console.log(`${index + 1}. ${statusIcon} ${endpoint.endpoint}`);
        console.log(`   Requests: ${endpoint.requestCount} | Avg: ${endpoint.averageResponseTime}ms | Errors: ${endpoint.errorRate.toFixed(1)}%`);
      });

      if (summary.slowestEndpoints.length > 0) {
        console.log('\nSlowest Endpoints:');
        summary.slowestEndpoints.slice(0, 3).forEach((endpoint: any, index: number) => {
          console.log(`${index + 1}. ⚠️  ${endpoint.endpoint} - ${endpoint.averageResponseTime}ms avg, ${endpoint.p95ResponseTime}ms p95`);
        });
      }
    }
  }

  /**
   * Render dashboard footer
   */
  private renderFooter(): void {
    console.log('\n' + '='.repeat(80));
    console.log('💡 Commands: [q]uit | [r]efresh | [c]ompact toggle | [h]elp');
    console.log(`⏱️  Last updated: ${new Date().toLocaleTimeString()} | Next refresh in ${this.config.refreshInterval / 1000}s`);
  }

  /**
   * Interactive mode for dashboard controls
   */
  enableInteractiveMode(): void {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', async (key: string) => {
      switch (key.toLowerCase()) {
        case 'q':
        case '\u0003': // Ctrl+C
          this.stop();
          break;
        
        case 'r':
          await this.render();
          break;
        
        case 'c':
          this.config.compactMode = !this.config.compactMode;
          await this.render();
          break;
        
        case 'h':
          this.showHelp();
          break;
      }
    });
  }

  /**
   * Show help information
   */
  private showHelp(): void {
    console.log('\n📖 Dashboard Help');
    console.log('-'.repeat(20));
    console.log('Commands:');
    console.log('  q - Quit dashboard');
    console.log('  r - Refresh now');
    console.log('  c - Toggle compact mode');
    console.log('  h - Show this help');
    console.log('\nPress any key to continue...');
  }
}

/**
 * CLI interface for running the dashboard
 */
export async function runDashboard(): Promise<void> {
  const args = process.argv.slice(2);
  const config: Partial<DashboardConfig> = {};

  // Parse command line arguments
  args.forEach((arg, index) => {
    switch (arg) {
      case '--compact':
        config.compactMode = true;
        break;
      case '--refresh':
        const interval = parseInt(args[index + 1], 10);
        if (interval && interval > 0) {
          config.refreshInterval = interval * 1000;
        }
        break;
      case '--no-realtime':
        config.showRealtime = false;
        break;
      case '--no-database':
        config.showDatabase = false;
        break;
      case '--no-alerts':
        config.showAlerts = false;
        break;
      case '--no-endpoints':
        config.showEndpoints = false;
        break;
    }
  });

  const dashboard = new PerformanceDashboard(config);
  
  // Enable interactive mode for better UX
  dashboard.enableInteractiveMode();
  
  // Start the dashboard
  await dashboard.start();
}

// Run dashboard if this script is executed directly
if (require.main === module) {
  runDashboard().catch(error => {
    console.error('Dashboard error:', error);
    process.exit(1);
  });
}