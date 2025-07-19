/**
 * Distributed Tracing Service
 * 
 * Provides distributed tracing for debugging complex flows
 */

import { createLogger } from '../logger';
import { 
  ITracingService, 
  TraceSpan, 
  Trace, 
  TraceLog,
  LogLevel 
} from './types';
import crypto from 'crypto';

export class TracingService implements ITracingService {
  private logger = createLogger('tracing');
  private activeSpans: Map<string, TraceSpan> = new Map();
  private traces: Map<string, Trace> = new Map();
  private sampleRate: number;
  private maxTraceAge: number = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    private config: {
      sampleRate?: number;
      propagation?: string[];
      enableAwsXRay?: boolean;
    } = {}
  ) {
    this.sampleRate = config.sampleRate ?? 0.1; // 10% sampling by default
    
    // Start cleanup scheduler
    this.startCleanupScheduler();
  }

  /**
   * Start a new trace span
   */
  startSpan(operationName: string, parentSpan?: TraceSpan): TraceSpan {
    const shouldSample = Math.random() < this.sampleRate;
    if (!shouldSample && !parentSpan) {
      // Return a no-op span if not sampling and no parent
      return this.createNoOpSpan(operationName);
    }

    const traceId = parentSpan?.traceId || this.generateTraceId();
    const spanId = this.generateSpanId();
    const startTime = new Date();

    const span: TraceSpan = {
      traceId,
      spanId,
      parentSpanId: parentSpan?.spanId,
      operationName,
      startTime,
      tags: {},
      logs: [],
      status: 'ok',
    };

    this.activeSpans.set(spanId, span);

    // Initialize trace if this is the root span
    if (!parentSpan) {
      this.traces.set(traceId, {
        traceId,
        spans: [span],
        startTime,
        service: 'mile-quest-api',
        operation: operationName,
        status: 'ok',
      });
    } else {
      // Add span to existing trace
      const trace = this.traces.get(traceId);
      if (trace) {
        trace.spans.push(span);
      }
    }

    this.logger.debug('Trace span started', {
      traceId,
      spanId,
      parentSpanId: parentSpan?.spanId,
      operationName,
    });

    return span;
  }

  /**
   * Finish a trace span
   */
  finishSpan(span: TraceSpan, error?: Error): void {
    if (this.isNoOpSpan(span)) {
      return;
    }

    const endTime = new Date();
    span.endTime = endTime;
    span.duration = endTime.getTime() - span.startTime.getTime();

    if (error) {
      span.status = 'error';
      span.error = error.message;
      this.addSpanLog(span, 'error', error.message, {
        'error.kind': error.name,
        'error.object': error,
        'stack': error.stack,
      });
    }

    this.activeSpans.delete(span.spanId);

    // Update trace status and completion
    const trace = this.traces.get(span.traceId);
    if (trace) {
      trace.endTime = endTime;
      trace.duration = endTime.getTime() - trace.startTime.getTime();
      
      // Update trace status based on span statuses
      const hasErrors = trace.spans.some(s => s.status === 'error');
      trace.status = hasErrors ? 'error' : 'ok';
    }

    this.logger.debug('Trace span finished', {
      traceId: span.traceId,
      spanId: span.spanId,
      operationName: span.operationName,
      duration: span.duration,
      status: span.status,
    });

    // Log slow operations
    if (span.duration && span.duration > 5000) { // 5 seconds
      this.logger.warn('Slow operation detected', undefined, {
        traceId: span.traceId,
        spanId: span.spanId,
        operationName: span.operationName,
        duration: span.duration,
        tags: span.tags,
      });
    }
  }

  /**
   * Add tags to a span
   */
  setSpanTags(span: TraceSpan, tags: Record<string, any>): void {
    span.tags = { ...span.tags, ...tags };
  }

  /**
   * Add a log entry to a span
   */
  addSpanLog(
    span: TraceSpan, 
    level: LogLevel, 
    message: string, 
    fields?: Record<string, any>
  ): void {
    const log: TraceLog = {
      timestamp: new Date(),
      level,
      message,
      fields,
    };

    span.logs.push(log);

    this.logger.debug('Span log added', {
      traceId: span.traceId,
      spanId: span.spanId,
      level,
      message,
      fields,
    });
  }

  /**
   * Get a trace by ID
   */
  async getTrace(traceId: string): Promise<Trace | null> {
    return this.traces.get(traceId) || null;
  }

  /**
   * Get traces with optional filtering
   */
  async getTraces(query: {
    service?: string;
    operation?: string;
    status?: 'ok' | 'error' | 'timeout';
    minDuration?: number;
    maxDuration?: number;
    startTime?: Date;
    endTime?: Date;
    tags?: Record<string, string>;
    limit?: number;
  } = {}): Promise<Trace[]> {
    let traces = Array.from(this.traces.values());

    // Apply filters
    if (query.service) {
      traces = traces.filter(t => t.service === query.service);
    }
    if (query.operation) {
      traces = traces.filter(t => t.operation === query.operation);
    }
    if (query.status) {
      traces = traces.filter(t => t.status === query.status);
    }
    if (query.minDuration) {
      traces = traces.filter(t => t.duration && t.duration >= query.minDuration!);
    }
    if (query.maxDuration) {
      traces = traces.filter(t => t.duration && t.duration <= query.maxDuration!);
    }
    if (query.startTime) {
      traces = traces.filter(t => t.startTime >= query.startTime!);
    }
    if (query.endTime) {
      traces = traces.filter(t => t.endTime && t.endTime <= query.endTime!);
    }
    if (query.tags) {
      traces = traces.filter(trace => {
        return Object.entries(query.tags!).every(([key, value]) =>
          trace.spans.some(span => span.tags[key] === value)
        );
      });
    }

    // Sort by start time (newest first)
    traces.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

    // Apply limit
    if (query.limit) {
      traces = traces.slice(0, query.limit);
    }

    return traces;
  }

  /**
   * Get trace statistics
   */
  async getTraceStatistics(timeRange: string = '1h'): Promise<{
    totalTraces: number;
    successfulTraces: number;
    errorTraces: number;
    averageDuration: number;
    p95Duration: number;
    p99Duration: number;
    operationCounts: Record<string, number>;
    errorsByOperation: Record<string, number>;
    slowestTraces: Array<{
      traceId: string;
      operation: string;
      duration: number;
      status: string;
    }>;
  }> {
    const cutoff = this.getTimeRangeCutoff(timeRange);
    const recentTraces = Array.from(this.traces.values())
      .filter(trace => trace.startTime >= cutoff);

    const durations = recentTraces
      .filter(t => t.duration)
      .map(t => t.duration!);
    
    const operationCounts: Record<string, number> = {};
    const errorsByOperation: Record<string, number> = {};
    
    recentTraces.forEach(trace => {
      operationCounts[trace.operation] = (operationCounts[trace.operation] || 0) + 1;
      if (trace.status === 'error') {
        errorsByOperation[trace.operation] = (errorsByOperation[trace.operation] || 0) + 1;
      }
    });

    const sortedDurations = durations.sort((a, b) => a - b);
    const slowestTraces = recentTraces
      .filter(t => t.duration)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 10)
      .map(t => ({
        traceId: t.traceId,
        operation: t.operation,
        duration: t.duration!,
        status: t.status,
      }));

    return {
      totalTraces: recentTraces.length,
      successfulTraces: recentTraces.filter(t => t.status === 'ok').length,
      errorTraces: recentTraces.filter(t => t.status === 'error').length,
      averageDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      p95Duration: this.percentile(sortedDurations, 0.95),
      p99Duration: this.percentile(sortedDurations, 0.99),
      operationCounts,
      errorsByOperation,
      slowestTraces,
    };
  }

  /**
   * Create a trace context for Lambda handlers
   */
  createLambdaTraceContext(
    functionName: string,
    event: any,
    context: any
  ): TraceSpan {
    const span = this.startSpan(`lambda.${functionName}`);
    
    this.setSpanTags(span, {
      'aws.lambda.function_name': functionName,
      'aws.lambda.request_id': context.awsRequestId,
      'aws.lambda.function_version': context.functionVersion,
      'aws.lambda.memory_limit': context.memoryLimitInMB.toString(),
      'http.method': event.httpMethod || 'unknown',
      'http.path': event.path || event.routeKey || 'unknown',
      'user.id': event.requestContext?.authorizer?.userId || 'anonymous',
    });

    if (event.headers) {
      // Extract trace context from headers (for distributed tracing)
      const traceHeader = event.headers['x-trace-id'] || event.headers['X-Trace-Id'];
      if (traceHeader) {
        this.setSpanTags(span, { 'trace.parent': traceHeader });
      }
    }

    return span;
  }

  /**
   * Create a database operation span
   */
  createDatabaseSpan(
    parentSpan: TraceSpan,
    operation: string,
    table: string,
    query?: string
  ): TraceSpan {
    const span = this.startSpan(`db.${operation}`, parentSpan);
    
    this.setSpanTags(span, {
      'db.type': 'postgresql',
      'db.operation': operation,
      'db.table': table,
      'component': 'database',
    });

    if (query) {
      this.setSpanTags(span, {
        'db.statement': query.length > 500 ? query.substring(0, 500) + '...' : query,
      });
    }

    return span;
  }

  /**
   * Create an external service call span
   */
  createExternalSpan(
    parentSpan: TraceSpan,
    service: string,
    operation: string,
    url?: string
  ): TraceSpan {
    const span = this.startSpan(`external.${service}.${operation}`, parentSpan);
    
    this.setSpanTags(span, {
      'external.service': service,
      'external.operation': operation,
      'component': 'external',
    });

    if (url) {
      this.setSpanTags(span, {
        'http.url': url,
      });
    }

    return span;
  }

  /**
   * Get correlation headers for external requests
   */
  getCorrelationHeaders(span: TraceSpan): Record<string, string> {
    return {
      'X-Trace-Id': span.traceId,
      'X-Span-Id': span.spanId,
      'X-Parent-Span-Id': span.parentSpanId || '',
    };
  }

  /**
   * Generate trace ID
   */
  private generateTraceId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generate span ID
   */
  private generateSpanId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Create a no-op span for non-sampled traces
   */
  private createNoOpSpan(operationName: string): TraceSpan {
    return {
      traceId: 'noop',
      spanId: 'noop',
      operationName,
      startTime: new Date(),
      tags: {},
      logs: [],
      status: 'ok',
    };
  }

  /**
   * Check if span is a no-op span
   */
  private isNoOpSpan(span: TraceSpan): boolean {
    return span.traceId === 'noop' && span.spanId === 'noop';
  }

  /**
   * Calculate percentile
   */
  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    
    const index = Math.ceil(values.length * p) - 1;
    return values[Math.max(0, index)];
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
    if (!match) return 60; // Default to 1 hour
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'm': return value;
      case 'h': return value * 60;
      case 'd': return value * 60 * 24;
      default: return 60;
    }
  }

  /**
   * Start cleanup scheduler
   */
  private startCleanupScheduler(): void {
    // Clean up old traces every hour
    setInterval(() => {
      this.cleanupOldTraces();
    }, 60 * 60 * 1000);
  }

  /**
   * Clean up old traces
   */
  private cleanupOldTraces(): void {
    const cutoff = new Date(Date.now() - this.maxTraceAge);
    let cleaned = 0;
    
    for (const [traceId, trace] of this.traces.entries()) {
      if (trace.startTime < cutoff) {
        this.traces.delete(traceId);
        cleaned++;
      }
    }
    
    // Clean up orphaned active spans
    for (const [spanId, span] of this.activeSpans.entries()) {
      if (span.startTime < cutoff) {
        this.activeSpans.delete(spanId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.info('Cleaned up old traces', { cleanedCount: cleaned });
    }
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    this.logger.info('Tracing service shutdown', {
      activeSpans: this.activeSpans.size,
      totalTraces: this.traces.size,
    });
  }
}