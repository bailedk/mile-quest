/**
 * Log Aggregation Service
 * 
 * Centralized log collection, storage, and analysis
 */

import { createLogger } from '../logger';
import { 
  ILogAggregationService, 
  LogEntry, 
  LogQuery, 
  LogAggregation,
  LogLevel 
} from './types';

export class LogAggregationService implements ILogAggregationService {
  private logger = createLogger('log-aggregation');
  private logs: LogEntry[] = [];
  private indexes: Map<string, Map<string, LogEntry[]>> = new Map();
  private maxLogs: number = 10000;
  private retentionDays: number = 7;

  constructor(
    private config: {
      maxLogs?: number;
      retentionDays?: number;
      enableElasticsearch?: boolean;
      enableCloudWatch?: boolean;
    } = {}
  ) {
    this.maxLogs = config.maxLogs ?? 10000;
    this.retentionDays = config.retentionDays ?? 7;
    
    // Start cleanup scheduler
    this.startCleanupScheduler();
  }

  /**
   * Ingest a log entry
   */
  async ingestLog(entry: LogEntry): Promise<void> {
    try {
      // Add to main log storage
      this.logs.push(entry);
      
      // Maintain size limit
      if (this.logs.length > this.maxLogs) {
        this.logs.splice(0, this.logs.length - this.maxLogs);
      }
      
      // Update indexes
      this.updateIndexes(entry);
      
      // Log to CloudWatch (through existing logger)
      this.forwardToCloudWatch(entry);
      
    } catch (error) {
      this.logger.error('Failed to ingest log entry', error as Error, {
        entryService: entry.service,
        entryFunction: entry.function,
        entryLevel: entry.level,
      });
    }
  }

  /**
   * Query logs with filtering and search
   */
  async queryLogs(query: LogQuery): Promise<LogEntry[]> {
    let filteredLogs = this.logs;
    
    // Apply filters
    if (query.service) {
      filteredLogs = filteredLogs.filter(log => log.service === query.service);
    }
    
    if (query.function) {
      filteredLogs = filteredLogs.filter(log => log.function === query.function);
    }
    
    if (query.level) {
      filteredLogs = filteredLogs.filter(log => log.level === query.level);
    }
    
    if (query.startTime) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= query.startTime!);
    }
    
    if (query.endTime) {
      filteredLogs = filteredLogs.filter(log => log.timestamp <= query.endTime!);
    }
    
    if (query.tags) {
      filteredLogs = filteredLogs.filter(log => {
        return Object.entries(query.tags!).every(([key, value]) =>
          log.context[key] === value
        );
      });
    }

    // Text search in message and context
    if (query.search) {
      const searchTerm = query.search.toLowerCase();
      filteredLogs = filteredLogs.filter(log => {
        return log.message.toLowerCase().includes(searchTerm) ||
               JSON.stringify(log.context).toLowerCase().includes(searchTerm);
      });
    }

    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    
    return filteredLogs.slice(offset, offset + limit);
  }

  /**
   * Aggregate logs by field
   */
  async aggregateLogs(field: string, query?: LogQuery): Promise<LogAggregation> {
    const logs = query ? await this.queryLogs(query) : this.logs;
    const fieldCounts = new Map<string, number>();
    
    logs.forEach(log => {
      let fieldValue: string;
      
      // Extract field value based on field path
      if (field === 'level') {
        fieldValue = log.level;
      } else if (field === 'service') {
        fieldValue = log.service;
      } else if (field === 'function') {
        fieldValue = log.function;
      } else if (field.startsWith('context.')) {
        const contextField = field.replace('context.', '');
        fieldValue = String(log.context[contextField] || 'unknown');
      } else {
        fieldValue = 'unknown';
      }
      
      fieldCounts.set(fieldValue, (fieldCounts.get(fieldValue) || 0) + 1);
    });
    
    const total = logs.length;
    const values = Array.from(fieldCounts.entries())
      .map(([value, count]) => ({
        value,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
    
    return {
      field,
      values,
      total,
    };
  }

  /**
   * Create index for faster querying
   */
  async createIndex(fields: string[]): Promise<void> {
    for (const field of fields) {
      if (!this.indexes.has(field)) {
        this.indexes.set(field, new Map());
        
        // Rebuild index for existing logs
        this.logs.forEach(log => {
          this.updateFieldIndex(field, log);
        });
        
        this.logger.info('Log index created', { field, logCount: this.logs.length });
      }
    }
  }

  /**
   * Get log statistics
   */
  async getLogStatistics(timeRange: string = '24h'): Promise<{
    totalLogs: number;
    logsByLevel: Record<LogLevel, number>;
    logsByService: Record<string, number>;
    logsByFunction: Record<string, number>;
    recentErrors: LogEntry[];
    logRate: number;
    topErrors: Array<{
      message: string;
      count: number;
      lastOccurrence: Date;
    }>;
  }> {
    const cutoff = this.getTimeRangeCutoff(timeRange);
    const recentLogs = this.logs.filter(log => log.timestamp >= cutoff);
    
    const logsByLevel: Record<LogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      fatal: 0,
    };
    
    const logsByService: Record<string, number> = {};
    const logsByFunction: Record<string, number> = {};
    const errorMessages = new Map<string, { count: number; lastOccurrence: Date }>();
    
    recentLogs.forEach(log => {
      logsByLevel[log.level]++;
      logsByService[log.service] = (logsByService[log.service] || 0) + 1;
      logsByFunction[log.function] = (logsByFunction[log.function] || 0) + 1;
      
      if (log.level === 'error' || log.level === 'fatal') {
        const existing = errorMessages.get(log.message);
        if (existing) {
          existing.count++;
          if (log.timestamp > existing.lastOccurrence) {
            existing.lastOccurrence = log.timestamp;
          }
        } else {
          errorMessages.set(log.message, {
            count: 1,
            lastOccurrence: log.timestamp,
          });
        }
      }
    });
    
    const recentErrors = recentLogs
      .filter(log => log.level === 'error' || log.level === 'fatal')
      .slice(0, 50);
    
    const topErrors = Array.from(errorMessages.entries())
      .map(([message, data]) => ({
        message,
        count: data.count,
        lastOccurrence: data.lastOccurrence,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    const timeRangeMs = this.parseTimeRange(timeRange) * 60 * 1000;
    const logRate = (recentLogs.length / (timeRangeMs / 1000)) * 60; // logs per minute
    
    return {
      totalLogs: recentLogs.length,
      logsByLevel,
      logsByService,
      logsByFunction,
      recentErrors,
      logRate,
      topErrors,
    };
  }
    
    // Apply text search
    if (query.search) {
      const searchTerm = query.search.toLowerCase();
      filteredLogs = filteredLogs.filter(log => 
        log.message.toLowerCase().includes(searchTerm) ||
        JSON.stringify(log.context).toLowerCase().includes(searchTerm)
      );
    }
    
    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Apply pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 100;
    
    return filteredLogs.slice(offset, offset + limit);
  }

  /**
   * Aggregate logs by field
   */
  async aggregateLogs(field: string, query?: LogQuery): Promise<LogAggregation> {
    const logs = query ? await this.queryLogs(query) : this.logs;
    const fieldCounts: Map<string, number> = new Map();
    
    logs.forEach(log => {
      let value: string;
      
      // Extract field value
      switch (field) {
        case 'service':
          value = log.service;
          break;
        case 'function':
          value = log.function;
          break;
        case 'level':
          value = log.level;
          break;
        case 'userId':
          value = log.userId || 'unknown';
          break;
        case 'teamId':
          value = log.teamId || 'unknown';
          break;
        default:
          // Check in context
          value = log.context[field]?.toString() || 'unknown';
      }
      
      fieldCounts.set(value, (fieldCounts.get(value) || 0) + 1);
    });
    
    const total = logs.length;
    const values = Array.from(fieldCounts.entries())
      .map(([value, count]) => ({
        value,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
    
    return {
      field,
      values,
      total,
    };
  }

  /**
   * Create search index for field
   */
  async createIndex(fields: string[]): Promise<void> {
    for (const field of fields) {
      if (!this.indexes.has(field)) {
        this.indexes.set(field, new Map());
        
        // Build index for existing logs
        this.logs.forEach(log => {
          this.addToIndex(field, log);
        });
        
        this.logger.info('Search index created', { field });
      }
    }
  }

  /**
   * Get log statistics
   */
  async getLogStatistics(timeRange: string = '24h'): Promise<{
    totalLogs: number;
    logsByLevel: Record<LogLevel, number>;
    logsByService: Record<string, number>;
    logsByFunction: Record<string, number>;
    topErrors: Array<{
      message: string;
      count: number;
      lastSeen: Date;
    }>;
    logVolume: Array<{
      timestamp: Date;
      count: number;
    }>;
    averageLogSize: number;
  }> {
    const cutoff = this.getTimeRangeCutoff(timeRange);
    const recentLogs = this.logs.filter(log => log.timestamp >= cutoff);
    
    // Count by level
    const logsByLevel: Record<LogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      fatal: 0,
    };
    
    const logsByService: Record<string, number> = {};
    const logsByFunction: Record<string, number> = {};
    const errorMessages: Map<string, { count: number; lastSeen: Date }> = new Map();
    
    recentLogs.forEach(log => {
      logsByLevel[log.level]++;
      logsByService[log.service] = (logsByService[log.service] || 0) + 1;
      logsByFunction[log.function] = (logsByFunction[log.function] || 0) + 1;
      
      if (log.level === 'error' || log.level === 'fatal') {
        const key = log.message;
        const existing = errorMessages.get(key);
        if (existing) {
          existing.count++;
          existing.lastSeen = log.timestamp;
        } else {
          errorMessages.set(key, { count: 1, lastSeen: log.timestamp });
        }
      }
    });
    
    // Top errors
    const topErrors = Array.from(errorMessages.entries())
      .map(([message, data]) => ({
        message,
        count: data.count,
        lastSeen: data.lastSeen,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Log volume over time (hourly buckets)
    const logVolume = this.calculateLogVolume(recentLogs);
    
    // Average log size
    const totalSize = recentLogs.reduce((sum, log) => {
      return sum + JSON.stringify(log).length;
    }, 0);
    const averageLogSize = recentLogs.length > 0 ? totalSize / recentLogs.length : 0;
    
    return {
      totalLogs: recentLogs.length,
      logsByLevel,
      logsByService,
      logsByFunction,
      topErrors,
      logVolume,
      averageLogSize,
    };
  }

  /**
   * Search logs with advanced query syntax
   */
  async searchLogs(searchQuery: string, options: {
    timeRange?: string;
    limit?: number;
    includeContext?: boolean;
  } = {}): Promise<{
    logs: LogEntry[];
    totalMatches: number;
    searchTime: number;
  }> {
    const startTime = Date.now();
    
    // Parse advanced search query
    const parsedQuery = this.parseSearchQuery(searchQuery);
    
    let logs = this.logs;
    
    // Apply time range filter
    if (options.timeRange) {
      const cutoff = this.getTimeRangeCutoff(options.timeRange);
      logs = logs.filter(log => log.timestamp >= cutoff);
    }
    
    // Apply search filters
    logs = logs.filter(log => this.matchesSearchQuery(log, parsedQuery));
    
    const totalMatches = logs.length;
    
    // Sort by relevance and timestamp
    logs = logs.sort((a, b) => {
      const relevanceA = this.calculateRelevanceScore(a, parsedQuery);
      const relevanceB = this.calculateRelevanceScore(b, parsedQuery);
      
      if (relevanceA !== relevanceB) {
        return relevanceB - relevanceA;
      }
      
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
    
    // Apply limit
    const limit = options.limit ?? 100;
    logs = logs.slice(0, limit);
    
    // Filter context if requested
    if (!options.includeContext) {
      logs = logs.map(log => ({
        ...log,
        context: {},
      }));
    }
    
    const searchTime = Date.now() - startTime;
    
    return {
      logs,
      totalMatches,
      searchTime,
    };
  }

  /**
   * Export logs for external analysis
   */
  async exportLogs(query: LogQuery, format: 'json' | 'csv' = 'json'): Promise<string> {
    const logs = await this.queryLogs(query);
    
    if (format === 'csv') {
      return this.exportToCsv(logs);
    } else {
      return JSON.stringify(logs, null, 2);
    }
  }

  /**
   * Update search indexes
   */
  private updateIndexes(entry: LogEntry): void {
    for (const [field, index] of this.indexes.entries()) {
      this.addToIndex(field, entry);
    }
  }

  /**
   * Add entry to specific index
   */
  private addToIndex(field: string, entry: LogEntry): void {
    const index = this.indexes.get(field);
    if (!index) return;
    
    let value: string;
    
    switch (field) {
      case 'service':
        value = entry.service;
        break;
      case 'function':
        value = entry.function;
        break;
      case 'level':
        value = entry.level;
        break;
      default:
        value = entry.context[field]?.toString() || '';
    }
    
    if (value) {
      const entries = index.get(value) || [];
      entries.push(entry);
      index.set(value, entries);
    }
  }

  /**
   * Forward log to CloudWatch
   */
  private forwardToCloudWatch(entry: LogEntry): void {
    // Use existing logger to forward to CloudWatch
    const contextWithTrace = {
      ...entry.context,
      service: entry.service,
      function: entry.function,
      traceId: entry.traceId,
      spanId: entry.spanId,
      userId: entry.userId,
      teamId: entry.teamId,
      requestId: entry.requestId,
    };
    
    switch (entry.level) {
      case 'debug':
        this.logger.debug(entry.message, contextWithTrace);
        break;
      case 'info':
        this.logger.info(entry.message, contextWithTrace);
        break;
      case 'warn':
        this.logger.warn(entry.message, undefined, contextWithTrace);
        break;
      case 'error':
      case 'fatal':
        this.logger.error(entry.message, undefined, contextWithTrace);
        break;
    }
  }

  /**
   * Parse advanced search query
   */
  private parseSearchQuery(query: string): {
    terms: string[];
    filters: Record<string, string>;
    excludes: string[];
  } {
    const terms: string[] = [];
    const filters: Record<string, string> = {};
    const excludes: string[] = [];
    
    // Simple parser for search syntax
    const tokens = query.split(/\s+/);
    
    for (const token of tokens) {
      if (token.startsWith('-')) {
        excludes.push(token.substring(1));
      } else if (token.includes(':')) {
        const [key, value] = token.split(':', 2);
        filters[key] = value;
      } else {
        terms.push(token);
      }
    }
    
    return { terms, filters, excludes };
  }

  /**
   * Check if log matches search query
   */
  private matchesSearchQuery(log: LogEntry, query: {
    terms: string[];
    filters: Record<string, string>;
    excludes: string[];
  }): boolean {
    const logText = `${log.message} ${JSON.stringify(log.context)}`.toLowerCase();
    
    // Check exclusions
    for (const exclude of query.excludes) {
      if (logText.includes(exclude.toLowerCase())) {
        return false;
      }
    }
    
    // Check filters
    for (const [key, value] of Object.entries(query.filters)) {
      let logValue: string;
      
      switch (key) {
        case 'service':
          logValue = log.service;
          break;
        case 'function':
          logValue = log.function;
          break;
        case 'level':
          logValue = log.level;
          break;
        default:
          logValue = log.context[key]?.toString() || '';
      }
      
      if (!logValue.toLowerCase().includes(value.toLowerCase())) {
        return false;
      }
    }
    
    // Check terms
    for (const term of query.terms) {
      if (!logText.includes(term.toLowerCase())) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Calculate relevance score for search results
   */
  private calculateRelevanceScore(log: LogEntry, query: {
    terms: string[];
    filters: Record<string, string>;
    excludes: string[];
  }): number {
    let score = 0;
    const logText = `${log.message} ${JSON.stringify(log.context)}`.toLowerCase();
    
    // Score based on term matches
    for (const term of query.terms) {
      const termLower = term.toLowerCase();
      const messageMatches = (log.message.toLowerCase().match(new RegExp(termLower, 'g')) || []).length;
      score += messageMatches * 10; // Message matches are more important
      
      const contextMatches = (logText.match(new RegExp(termLower, 'g')) || []).length - messageMatches;
      score += contextMatches * 5;
    }
    
    // Boost score for exact filter matches
    for (const [key, value] of Object.entries(query.filters)) {
      let logValue: string;
      
      switch (key) {
        case 'service':
          logValue = log.service;
          break;
        case 'function':
          logValue = log.function;
          break;
        case 'level':
          logValue = log.level;
          break;
        default:
          logValue = log.context[key]?.toString() || '';
      }
      
      if (logValue.toLowerCase() === value.toLowerCase()) {
        score += 20;
      }
    }
    
    return score;
  }

  /**
   * Calculate log volume over time
   */
  private calculateLogVolume(logs: LogEntry[]): Array<{
    timestamp: Date;
    count: number;
  }> {
    const hourlyBuckets: Map<string, number> = new Map();
    
    logs.forEach(log => {
      const hour = new Date(log.timestamp);
      hour.setMinutes(0, 0, 0);
      const key = hour.toISOString();
      
      hourlyBuckets.set(key, (hourlyBuckets.get(key) || 0) + 1);
    });
    
    return Array.from(hourlyBuckets.entries())
      .map(([timestamp, count]) => ({
        timestamp: new Date(timestamp),
        count,
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Export logs to CSV format
   */
  private exportToCsv(logs: LogEntry[]): string {
    const headers = ['timestamp', 'level', 'service', 'function', 'message', 'context'];
    const rows = logs.map(log => [
      log.timestamp.toISOString(),
      log.level,
      log.service,
      log.function,
      log.message.replace(/"/g, '""'), // Escape quotes
      JSON.stringify(log.context).replace(/"/g, '""'),
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');
    
    return csvContent;
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
   * Start cleanup scheduler
   */
  private startCleanupScheduler(): void {
    // Clean up old logs every hour
    setInterval(() => {
      this.cleanupOldLogs();
    }, 60 * 60 * 1000);
  }

  /**
   * Clean up old logs based on retention policy
   */
  private cleanupOldLogs(): void {
    const cutoff = new Date(Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000));
    const originalCount = this.logs.length;
    
    this.logs = this.logs.filter(log => log.timestamp >= cutoff);
    
    const cleaned = originalCount - this.logs.length;
    
    if (cleaned > 0) {
      this.logger.info('Cleaned up old logs', {
        cleanedCount: cleaned,
        retentionDays: this.retentionDays,
        remainingLogs: this.logs.length,
      });
    }
    
    // Clean up indexes
    this.rebuildIndexes();
  }

  /**
   * Rebuild search indexes
   */
  private rebuildIndexes(): void {
    for (const [field, index] of this.indexes.entries()) {
      index.clear();
      this.logs.forEach(log => {
        this.addToIndex(field, log);
      });
    }
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    this.logger.info('Log aggregation service shutdown', {
      totalLogs: this.logs.length,
      indexCount: this.indexes.size,
    });
  }
}