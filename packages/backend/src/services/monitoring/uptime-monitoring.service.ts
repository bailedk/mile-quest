/**
 * Uptime Monitoring Service
 * 
 * External uptime monitoring and availability tracking
 */

import { createLogger } from '../logger';
import { 
  IUptimeMonitoringService, 
  UptimeCheck, 
  UptimeResult, 
  UptimeSummary, 
  UptimeIncident 
} from './types';
import crypto from 'crypto';

export class UptimeMonitoringService implements IUptimeMonitoringService {
  private logger = createLogger('uptime-monitoring');
  private checks: Map<string, UptimeCheck> = new Map();
  private results: Map<string, UptimeResult[]> = new Map();
  private incidents: Map<string, UptimeIncident> = new Map();
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();
  private maxResultsPerCheck = 1000;

  constructor(
    private config: {
      regions?: string[];
      maxResultHistory?: number;
    } = {}
  ) {
    this.maxResultsPerCheck = config.maxResultHistory ?? 1000;
  }

  /**
   * Create a new uptime check
   */
  async createCheck(checkData: Omit<UptimeCheck, 'id'>): Promise<UptimeCheck> {
    const id = crypto.randomUUID();
    const check: UptimeCheck = {
      id,
      ...checkData,
    };

    this.checks.set(id, check);
    
    if (check.enabled) {
      this.startMonitoring(check);
    }

    this.logger.info('Uptime check created', {
      id,
      name: check.name,
      type: check.type,
      target: check.target,
      interval: check.interval,
    });

    return check;
  }

  /**
   * Update an existing uptime check
   */
  async updateCheck(id: string, updates: Partial<UptimeCheck>): Promise<UptimeCheck> {
    const existingCheck = this.checks.get(id);
    if (!existingCheck) {
      throw new Error(`Uptime check not found: ${id}`);
    }

    const updatedCheck: UptimeCheck = {
      ...existingCheck,
      ...updates,
      id, // Ensure ID doesn't change
    };

    this.checks.set(id, updatedCheck);

    // Restart monitoring if enabled status or interval changed
    if (updates.enabled !== undefined || updates.interval !== undefined) {
      this.stopMonitoring(id);
      if (updatedCheck.enabled) {
        this.startMonitoring(updatedCheck);
      }
    }

    this.logger.info('Uptime check updated', {
      id,
      updates: Object.keys(updates),
    });

    return updatedCheck;
  }

  /**
   * Delete an uptime check
   */
  async deleteCheck(id: string): Promise<void> {
    const check = this.checks.get(id);
    if (!check) {
      throw new Error(`Uptime check not found: ${id}`);
    }

    this.stopMonitoring(id);
    this.checks.delete(id);
    this.results.delete(id);
    
    // Close any active incidents for this check
    const activeIncidents = Array.from(this.incidents.values())
      .filter(incident => incident.checkId === id && incident.status === 'ongoing');
    
    for (const incident of activeIncidents) {
      incident.status = 'resolved';
      incident.endTime = new Date();
      incident.duration = incident.endTime.getTime() - incident.startTime.getTime();
    }

    this.logger.info('Uptime check deleted', { id, name: check.name });
  }

  /**
   * Get all uptime checks
   */
  async getChecks(): Promise<UptimeCheck[]> {
    return Array.from(this.checks.values())
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get overall uptime statistics
   */
  async getOverallStatistics(): Promise<{
    totalChecks: number;
    activeChecks: number;
    overallUptime: number;
    incidentCount: number;
    avgResponseTime: number;
  }> {
    const checks = Array.from(this.checks.values());
    const activeChecks = checks.filter(check => check.enabled);
    
    let totalUptime = 0;
    let totalResponseTime = 0;
    let totalResults = 0;
    
    for (const check of checks) {
      const summary = await this.getUptimeSummary(check.id);
      totalUptime += summary.uptime;
      totalResponseTime += summary.avgResponseTime * summary.totalChecks;
      totalResults += summary.totalChecks;
    }
    
    const overallUptime = checks.length > 0 ? totalUptime / checks.length : 100;
    const avgResponseTime = totalResults > 0 ? totalResponseTime / totalResults : 0;
    
    const activeIncidents = Array.from(this.incidents.values())
      .filter(incident => incident.status === 'ongoing');
    
    return {
      totalChecks: checks.length,
      activeChecks: activeChecks.length,
      overallUptime,
      incidentCount: activeIncidents.length,
      avgResponseTime,
    };
  }

  /**
   * Run a specific uptime check manually
   */
  async runCheck(id: string): Promise<UptimeResult> {
    const check = this.checks.get(id);
    if (!check) {
      throw new Error(`Uptime check not found: ${id}`);
    }

    const region = check.regions[0] || 'us-east-1'; // Use first region
    const result = await this.executeCheck(check, region);
    
    this.storeResult(result);
    this.evaluateResult(check, result);

    return result;
  }

  /**
   * Get uptime summary for a check
   */
  async getUptimeSummary(checkId: string, period: string = '24h'): Promise<UptimeSummary> {
    const check = this.checks.get(checkId);
    if (!check) {
      throw new Error(`Uptime check not found: ${checkId}`);
    }

    const cutoff = this.getTimeRangeCutoff(period);
    const results = this.results.get(checkId) || [];
    const periodResults = results.filter(r => r.timestamp >= cutoff);

    const totalChecks = periodResults.length;
    const successfulChecks = periodResults.filter(r => r.status === 'up').length;
    const uptime = totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 0;

    const responseTimes = periodResults
      .filter(r => r.responseTime !== undefined)
      .map(r => r.responseTime!);
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;

    const incidents = Array.from(this.incidents.values())
      .filter(incident => 
        incident.checkId === checkId && 
        incident.startTime >= cutoff
      );

    return {
      checkId,
      name: check.name,
      period,
      uptime,
      totalChecks,
      successfulChecks,
      avgResponseTime,
      incidents,
    };
  }

  /**
   * Get incidents for a check or all checks
   */
  async getIncidents(checkId?: string): Promise<UptimeIncident[]> {
    let incidents = Array.from(this.incidents.values());
    
    if (checkId) {
      incidents = incidents.filter(incident => incident.checkId === checkId);
    }

    return incidents.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  /**
   * Get all uptime checks
   */
  async getChecks(): Promise<UptimeCheck[]> {
    return Array.from(this.checks.values());
  }

  /**
   * Get check results
   */
  async getResults(checkId: string, limit: number = 100): Promise<UptimeResult[]> {
    const results = this.results.get(checkId) || [];
    return results
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get uptime statistics across all checks
   */
  async getOverallStatistics(period: string = '24h'): Promise<{
    totalChecks: number;
    activeChecks: number;
    overallUptime: number;
    totalIncidents: number;
    activeIncidents: number;
    avgResponseTime: number;
    checksByStatus: Record<string, number>;
  }> {
    const cutoff = this.getTimeRangeCutoff(period);
    const allChecks = Array.from(this.checks.values());
    const activeChecks = allChecks.filter(c => c.enabled);

    let totalResults = 0;
    let successfulResults = 0;
    let totalResponseTime = 0;
    let responseTimeCount = 0;

    for (const check of activeChecks) {
      const results = this.results.get(check.id) || [];
      const periodResults = results.filter(r => r.timestamp >= cutoff);
      
      totalResults += periodResults.length;
      successfulResults += periodResults.filter(r => r.status === 'up').length;
      
      const responseTimes = periodResults
        .filter(r => r.responseTime !== undefined)
        .map(r => r.responseTime!);
      
      if (responseTimes.length > 0) {
        totalResponseTime += responseTimes.reduce((a, b) => a + b, 0);
        responseTimeCount += responseTimes.length;
      }
    }

    const incidents = Array.from(this.incidents.values())
      .filter(incident => incident.startTime >= cutoff);

    const checksByStatus: Record<string, number> = {
      up: 0,
      down: 0,
      unknown: 0,
    };

    // Get latest status for each check
    for (const check of activeChecks) {
      const results = this.results.get(check.id) || [];
      if (results.length > 0) {
        const latestResult = results[results.length - 1];
        if (latestResult.status === 'up') {
          checksByStatus.up++;
        } else {
          checksByStatus.down++;
        }
      } else {
        checksByStatus.unknown++;
      }
    }

    return {
      totalChecks: allChecks.length,
      activeChecks: activeChecks.length,
      overallUptime: totalResults > 0 ? (successfulResults / totalResults) * 100 : 100,
      totalIncidents: incidents.length,
      activeIncidents: incidents.filter(i => i.status === 'ongoing').length,
      avgResponseTime: responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0,
      checksByStatus,
    };
  }

  /**
   * Start monitoring a check
   */
  private startMonitoring(check: UptimeCheck): void {
    if (this.checkIntervals.has(check.id)) {
      this.stopMonitoring(check.id);
    }

    const intervalMs = check.interval * 1000;
    const intervalId = setInterval(async () => {
      try {
        for (const region of check.regions) {
          const result = await this.executeCheck(check, region);
          this.storeResult(result);
          this.evaluateResult(check, result);
        }
      } catch (error) {
        this.logger.error('Failed to execute uptime check', error as Error, {
          checkId: check.id,
          checkName: check.name,
        });
      }
    }, intervalMs);

    this.checkIntervals.set(check.id, intervalId);

    this.logger.info('Started monitoring uptime check', {
      id: check.id,
      name: check.name,
      interval: check.interval,
      regions: check.regions.length,
    });
  }

  /**
   * Stop monitoring a check
   */
  private stopMonitoring(id: string): void {
    const intervalId = this.checkIntervals.get(id);
    if (intervalId) {
      clearInterval(intervalId);
      this.checkIntervals.delete(id);
      
      this.logger.info('Stopped monitoring uptime check', { id });
    }
  }

  /**
   * Execute a single uptime check
   */
  private async executeCheck(check: UptimeCheck, region: string): Promise<UptimeResult> {
    const startTime = Date.now();
    
    try {
      switch (check.type) {
        case 'http':
          return await this.executeHttpCheck(check, region, startTime);
        case 'tcp':
          return await this.executeTcpCheck(check, region, startTime);
        case 'ping':
          return await this.executePingCheck(check, region, startTime);
        case 'database':
          return await this.executeDatabaseCheck(check, region, startTime);
        default:
          throw new Error(`Unsupported check type: ${check.type}`);
      }
    } catch (error) {
      return {
        checkId: check.id,
        timestamp: new Date(),
        region,
        status: 'error',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute HTTP check
   */
  private async executeHttpCheck(
    check: UptimeCheck, 
    region: string, 
    startTime: number
  ): Promise<UptimeResult> {
    // In a real implementation, you'd use fetch or axios to make HTTP requests
    // For now, we'll simulate the check
    
    const responseTime = Math.random() * 1000 + 100; // 100-1100ms
    const isSuccess = Math.random() > 0.05; // 95% success rate simulation
    
    // Simulate timeout
    if (responseTime > check.timeout) {
      return {
        checkId: check.id,
        timestamp: new Date(),
        region,
        status: 'timeout',
        responseTime: check.timeout,
        error: 'Request timeout',
      };
    }

    return {
      checkId: check.id,
      timestamp: new Date(),
      region,
      status: isSuccess ? 'up' : 'down',
      responseTime: Math.round(responseTime),
      statusCode: isSuccess ? (check.expectedStatus || 200) : 500,
    };
  }

  /**
   * Execute TCP check
   */
  private async executeTcpCheck(
    check: UptimeCheck, 
    region: string, 
    startTime: number
  ): Promise<UptimeResult> {
    // Simulate TCP connection check
    const responseTime = Math.random() * 200 + 50; // 50-250ms
    const isSuccess = Math.random() > 0.02; // 98% success rate
    
    return {
      checkId: check.id,
      timestamp: new Date(),
      region,
      status: isSuccess ? 'up' : 'down',
      responseTime: Math.round(responseTime),
    };
  }

  /**
   * Execute ping check
   */
  private async executePingCheck(
    check: UptimeCheck, 
    region: string, 
    startTime: number
  ): Promise<UptimeResult> {
    // Simulate ping check
    const responseTime = Math.random() * 100 + 10; // 10-110ms
    const isSuccess = Math.random() > 0.01; // 99% success rate
    
    return {
      checkId: check.id,
      timestamp: new Date(),
      region,
      status: isSuccess ? 'up' : 'down',
      responseTime: Math.round(responseTime),
    };
  }

  /**
   * Execute database check
   */
  private async executeDatabaseCheck(
    check: UptimeCheck, 
    region: string, 
    startTime: number
  ): Promise<UptimeResult> {
    // Simulate database connection check
    const responseTime = Math.random() * 500 + 100; // 100-600ms
    const isSuccess = Math.random() > 0.03; // 97% success rate
    
    return {
      checkId: check.id,
      timestamp: new Date(),
      region,
      status: isSuccess ? 'up' : 'down',
      responseTime: Math.round(responseTime),
    };
  }

  /**
   * Store check result
   */
  private storeResult(result: UptimeResult): void {
    const results = this.results.get(result.checkId) || [];
    results.push(result);
    
    // Keep only recent results
    if (results.length > this.maxResultsPerCheck) {
      results.splice(0, results.length - this.maxResultsPerCheck);
    }
    
    this.results.set(result.checkId, results);
  }

  /**
   * Evaluate result and handle incidents
   */
  private evaluateResult(check: UptimeCheck, result: UptimeResult): void {
    const isDown = result.status !== 'up';
    const existingIncident = this.findOngoingIncident(check.id, result.region);
    
    if (isDown && !existingIncident) {
      // Start new incident
      this.startIncident(check, result);
    } else if (!isDown && existingIncident) {
      // Resolve incident
      this.resolveIncident(existingIncident);
    }
    
    // Log significant events
    if (isDown) {
      this.logger.warn('Uptime check failed', undefined, {
        checkId: check.id,
        checkName: check.name,
        region: result.region,
        status: result.status,
        responseTime: result.responseTime,
        error: result.error,
      });
    }
  }

  /**
   * Start a new incident
   */
  private startIncident(check: UptimeCheck, result: UptimeResult): void {
    const incidentId = crypto.randomUUID();
    const incident: UptimeIncident = {
      id: incidentId,
      checkId: check.id,
      startTime: result.timestamp,
      status: 'ongoing',
      affectedRegions: [result.region],
      description: `${check.name} is down in ${result.region}: ${result.error || 'Service unavailable'}`,
    };
    
    this.incidents.set(incidentId, incident);
    
    this.logger.error('Uptime incident started', undefined, {
      incidentId,
      checkId: check.id,
      checkName: check.name,
      region: result.region,
      description: incident.description,
    });
  }

  /**
   * Resolve an incident
   */
  private resolveIncident(incident: UptimeIncident): void {
    incident.status = 'resolved';
    incident.endTime = new Date();
    incident.duration = incident.endTime.getTime() - incident.startTime.getTime();
    
    this.logger.info('Uptime incident resolved', {
      incidentId: incident.id,
      checkId: incident.checkId,
      duration: incident.duration,
      affectedRegions: incident.affectedRegions,
    });
  }

  /**
   * Find ongoing incident for check and region
   */
  private findOngoingIncident(checkId: string, region: string): UptimeIncident | undefined {
    return Array.from(this.incidents.values()).find(incident =>
      incident.checkId === checkId &&
      incident.status === 'ongoing' &&
      incident.affectedRegions.includes(region)
    );
  }

  /**
   * Get time range cutoff
   */
  private getTimeRangeCutoff(timeRange: string): Date {
    const now = new Date();
    const minutes = this.parseTimeRange(timeRange);
    return new Date(now.getTime() - (minutes * 60 * 1000));
  }

  /**
   * Parse time range string to minutes
   */
  private parseTimeRange(timeRange: string): number {
    const match = timeRange.match(/^(\d+)([hmd])$/);
    if (!match) return 60 * 24; // Default to 24 hours
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'm': return value;
      case 'h': return value * 60;
      case 'd': return value * 60 * 24;
      default: return 60 * 24;
    }
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    // Stop all monitoring
    for (const checkId of this.checkIntervals.keys()) {
      this.stopMonitoring(checkId);
    }
    
    this.logger.info('Uptime monitoring service shutdown', {
      totalChecks: this.checks.size,
      totalResults: Array.from(this.results.values()).reduce((sum, r) => sum + r.length, 0),
      totalIncidents: this.incidents.size,
    });
  }
}