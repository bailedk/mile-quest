/**
 * Error Tracking Service
 * 
 * Comprehensive error tracking and alerting system
 */

import { createLogger } from '../logger';
import { 
  IErrorTrackingService, 
  ErrorEvent, 
  ErrorContext, 
  ErrorSummary,
  LogLevel 
} from './types';
import crypto from 'crypto';

export class ErrorTrackingService implements IErrorTrackingService {
  private logger = createLogger('error-tracking');
  private errorStore: Map<string, ErrorEvent> = new Map();
  private errorSummaries: Map<string, ErrorSummary> = new Map();
  private sampleRate: number = 1.0;
  private ignoredErrors: Set<string> = new Set();

  constructor(
    private config: {
      sampleRate?: number;
      ignoredErrors?: string[];
      enablePersistence?: boolean;
    } = {}
  ) {
    this.sampleRate = config.sampleRate ?? 1.0;
    this.ignoredErrors = new Set(config.ignoredErrors ?? []);
    
    // Start background cleanup
    this.startCleanupScheduler();
  }

  /**
   * Track an error with context
   */
  async trackError(error: Error, context: ErrorContext = {}): Promise<void> {
    try {
      // Check if we should sample this error
      if (Math.random() > this.sampleRate) {
        return;
      }

      // Check if this error type should be ignored
      if (this.shouldIgnoreError(error)) {
        return;
      }

      const errorEvent = this.createErrorEvent(error, context);
      const fingerprint = this.generateFingerprint(error, context);
      
      // Store the error event
      this.errorStore.set(errorEvent.id, errorEvent);
      
      // Update error summary
      this.updateErrorSummary(fingerprint, errorEvent);
      
      // Log the error for CloudWatch
      this.logger.error('Error tracked', error, {
        errorId: errorEvent.id,
        fingerprint,
        context,
        stackTrace: error.stack,
      });

      // Check if this error requires immediate alerting
      await this.checkForCriticalError(errorEvent, fingerprint);

    } catch (trackingError) {
      // Don't let error tracking itself cause issues
      this.logger.error('Failed to track error', trackingError as Error, {
        originalError: error.message,
        context,
      });
    }
  }

  /**
   * Get errors based on query
   */
  async getErrors(query: Partial<ErrorEvent> = {}): Promise<ErrorEvent[]> {
    const errors = Array.from(this.errorStore.values());
    
    return errors.filter(error => {
      if (query.level && error.level !== query.level) return false;
      if (query.environment && error.environment !== query.environment) return false;
      if (query.context?.functionName && error.context.functionName !== query.context.functionName) return false;
      if (query.context?.userId && error.context.userId !== query.context.userId) return false;
      if (query.context?.teamId && error.context.teamId !== query.context.teamId) return false;
      return true;
    }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get error summary grouped by fingerprint
   */
  async getErrorSummary(timeRange: string = '24h'): Promise<ErrorSummary[]> {
    const cutoff = this.getTimeRangeCutoff(timeRange);
    const summaries = Array.from(this.errorSummaries.values());
    
    return summaries
      .filter(summary => summary.lastSeen >= cutoff)
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Mark error as resolved
   */
  async resolveError(fingerprint: string): Promise<void> {
    const summary = this.errorSummaries.get(fingerprint);
    if (summary) {
      this.logger.info('Error marked as resolved', {
        fingerprint,
        message: summary.message,
        count: summary.count,
      });
    }
    
    // In a real implementation, you'd mark it as resolved in persistent storage
    // For now, we'll just log it
  }

  /**
   * Get error statistics
   */
  async getErrorStats(timeRange: string = '24h'): Promise<{
    totalErrors: number;
    uniqueErrors: number;
    errorRate: number;
    topErrors: ErrorSummary[];
    errorsByLevel: Record<LogLevel, number>;
    errorsByFunction: Record<string, number>;
  }> {
    const cutoff = this.getTimeRangeCutoff(timeRange);
    const recentErrors = Array.from(this.errorStore.values())
      .filter(error => error.timestamp >= cutoff);
    
    const errorsByLevel: Record<LogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      fatal: 0,
    };
    
    const errorsByFunction: Record<string, number> = {};
    
    recentErrors.forEach(error => {
      errorsByLevel[error.level]++;
      const functionName = error.context.functionName || 'unknown';
      errorsByFunction[functionName] = (errorsByFunction[functionName] || 0) + 1;
    });
    
    const summaries = await this.getErrorSummary(timeRange);
    
    return {
      totalErrors: recentErrors.length,
      uniqueErrors: summaries.length,
      errorRate: this.calculateErrorRate(recentErrors, timeRange),
      topErrors: summaries.slice(0, 10),
      errorsByLevel,
      errorsByFunction,
    };
  }

  /**
   * Create error event from error and context
   */
  private createErrorEvent(error: Error, context: ErrorContext): ErrorEvent {
    const timestamp = new Date();
    const id = crypto.randomUUID();
    
    return {
      id,
      timestamp,
      level: this.determineErrorLevel(error),
      message: error.message,
      error,
      context: {
        ...context,
        requestId: context.requestId || `req-${Date.now()}`,
      },
      stackTrace: error.stack,
      fingerprint: this.generateFingerprint(error, context),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.AWS_LAMBDA_FUNCTION_VERSION || '1.0.0',
    };
  }

  /**
   * Generate unique fingerprint for error grouping
   */
  private generateFingerprint(error: Error, context: ErrorContext): string {
    const key = [
      error.name,
      error.message,
      context.functionName || 'unknown',
      // First few lines of stack trace for grouping similar errors
      error.stack?.split('\n').slice(0, 3).join('|') || '',
    ].join('::');
    
    return crypto.createHash('md5').update(key).digest('hex');
  }

  /**
   * Update error summary for fingerprint
   */
  private updateErrorSummary(fingerprint: string, errorEvent: ErrorEvent): void {
    const existing = this.errorSummaries.get(fingerprint);
    
    if (existing) {
      existing.count++;
      existing.lastSeen = errorEvent.timestamp;
      if (errorEvent.context.userId) {
        // Track affected users (simplified - in production use proper set tracking)
        existing.affectedUsers = Math.max(existing.affectedUsers, existing.count);
      }
      if (!existing.environments.includes(errorEvent.environment)) {
        existing.environments.push(errorEvent.environment);
      }
    } else {
      this.errorSummaries.set(fingerprint, {
        fingerprint,
        message: errorEvent.message,
        count: 1,
        firstSeen: errorEvent.timestamp,
        lastSeen: errorEvent.timestamp,
        level: errorEvent.level,
        affectedUsers: errorEvent.context.userId ? 1 : 0,
        environments: [errorEvent.environment],
      });
    }
  }

  /**
   * Check if error should be ignored
   */
  private shouldIgnoreError(error: Error): boolean {
    return this.ignoredErrors.has(error.name) || 
           this.ignoredErrors.has(error.message) ||
           error.message.includes('AbortError') ||
           error.message.includes('TimeoutError');
  }

  /**
   * Determine error level based on error type
   */
  private determineErrorLevel(error: Error): LogLevel {
    if (error.name === 'ValidationError') return 'warn';
    if (error.name === 'UnauthorizedError') return 'warn';
    if (error.name === 'NotFoundError') return 'info';
    if (error.message.includes('timeout')) return 'warn';
    if (error.message.includes('database')) return 'error';
    if (error.message.includes('fatal') || error.message.includes('critical')) return 'fatal';
    
    return 'error';
  }

  /**
   * Check for critical errors that need immediate alerting
   */
  private async checkForCriticalError(errorEvent: ErrorEvent, fingerprint: string): Promise<void> {
    const summary = this.errorSummaries.get(fingerprint);
    if (!summary) return;

    // Alert on high error frequency
    if (summary.count >= 10 && this.isRecentTimeWindow(summary.lastSeen, 300)) { // 10 errors in 5 minutes
      this.logger.error('High error frequency detected', undefined, {
        fingerprint,
        message: summary.message,
        count: summary.count,
        timeWindow: '5 minutes',
        alertType: 'high_frequency',
      });
    }

    // Alert on fatal errors immediately
    if (errorEvent.level === 'fatal') {
      this.logger.error('Fatal error detected', undefined, {
        fingerprint,
        message: summary.message,
        context: errorEvent.context,
        alertType: 'fatal_error',
      });
    }

    // Alert on database errors
    if (errorEvent.message.toLowerCase().includes('database') || 
        errorEvent.message.toLowerCase().includes('connection')) {
      this.logger.error('Database error detected', undefined, {
        fingerprint,
        message: summary.message,
        context: errorEvent.context,
        alertType: 'database_error',
      });
    }
  }

  /**
   * Calculate error rate for time range
   */
  private calculateErrorRate(errors: ErrorEvent[], timeRange: string): number {
    if (errors.length === 0) return 0;
    
    const totalRequests = errors.length; // Simplified - in production track total requests
    const errorCount = errors.filter(e => e.level === 'error' || e.level === 'fatal').length;
    
    return totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;
  }

  /**
   * Get cutoff time for time range
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
   * Check if timestamp is within recent time window
   */
  private isRecentTimeWindow(timestamp: Date, windowSeconds: number): boolean {
    const now = new Date();
    const diff = (now.getTime() - timestamp.getTime()) / 1000;
    return diff <= windowSeconds;
  }

  /**
   * Start background cleanup scheduler
   */
  private startCleanupScheduler(): void {
    // Clean up old errors every hour
    setInterval(() => {
      this.cleanupOldErrors();
    }, 60 * 60 * 1000);
  }

  /**
   * Clean up old error events (keep last 7 days)
   */
  private cleanupOldErrors(): void {
    const cutoff = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)); // 7 days ago
    let cleaned = 0;
    
    for (const [id, error] of this.errorStore.entries()) {
      if (error.timestamp < cutoff) {
        this.errorStore.delete(id);
        cleaned++;
      }
    }
    
    // Clean up old summaries
    for (const [fingerprint, summary] of this.errorSummaries.entries()) {
      if (summary.lastSeen < cutoff) {
        this.errorSummaries.delete(fingerprint);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.info('Cleaned up old error data', { cleanedCount: cleaned });
    }
  }
}