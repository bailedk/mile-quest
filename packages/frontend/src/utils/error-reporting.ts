/**
 * Enhanced error reporting and analytics for Mile Quest
 */

import { logError } from './error-handling';

// =============================================================================
// ERROR CATEGORIZATION
// =============================================================================

export type ErrorCategory = 
  | 'network'
  | 'authentication'
  | 'authorization'
  | 'validation'
  | 'api'
  | 'ui'
  | 'data'
  | 'performance'
  | 'unknown';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  page?: string;
  component?: string;
  action?: string;
  timestamp: number;
  userAgent: string;
  url: string;
  referrer?: string;
  viewport?: {
    width: number;
    height: number;
  };
  connection?: {
    type?: string;
    effectiveType?: string;
    downlink?: number;
  };
  memory?: {
    used: number;
    limit: number;
  };
  performance?: {
    timing: Record<string, number>;
    navigation: Record<string, any>;
  };
  customData?: Record<string, any>;
}

export interface ErrorReport {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  stack?: string;
  context: ErrorContext;
  fingerprint: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
  resolved: boolean;
  tags: string[];
}

// =============================================================================
// ERROR CATEGORIZATION LOGIC
// =============================================================================

export function categorizeError(error: unknown): { category: ErrorCategory; severity: ErrorSeverity } {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();
    
    // Network errors
    if (
      name.includes('network') ||
      message.includes('fetch') ||
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('timeout')
    ) {
      return { category: 'network', severity: 'medium' };
    }
    
    // Authentication errors
    if (
      name.includes('auth') ||
      message.includes('unauthorized') ||
      message.includes('authentication') ||
      message.includes('token')
    ) {
      return { category: 'authentication', severity: 'medium' };
    }
    
    // Authorization errors
    if (
      message.includes('forbidden') ||
      message.includes('permission') ||
      message.includes('authorization')
    ) {
      return { category: 'authorization', severity: 'low' };
    }
    
    // Validation errors
    if (
      name.includes('validation') ||
      message.includes('invalid') ||
      message.includes('required') ||
      message.includes('format')
    ) {
      return { category: 'validation', severity: 'low' };
    }
    
    // API errors
    if (
      name.includes('api') ||
      message.includes('api') ||
      message.includes('server') ||
      message.includes('response')
    ) {
      return { category: 'api', severity: 'medium' };
    }
    
    // UI/Component errors
    if (
      name.includes('react') ||
      message.includes('component') ||
      message.includes('render') ||
      message.includes('hook')
    ) {
      return { category: 'ui', severity: 'high' };
    }
    
    // Data errors
    if (
      name.includes('type') ||
      name.includes('reference') ||
      message.includes('undefined') ||
      message.includes('null') ||
      message.includes('cannot read')
    ) {
      return { category: 'data', severity: 'high' };
    }
    
    // Performance errors
    if (
      message.includes('memory') ||
      message.includes('performance') ||
      message.includes('slow')
    ) {
      return { category: 'performance', severity: 'medium' };
    }
  }
  
  return { category: 'unknown', severity: 'medium' };
}

// =============================================================================
// ERROR FINGERPRINTING
// =============================================================================

export function generateErrorFingerprint(error: unknown, context: Partial<ErrorContext> = {}): string {
  const parts: string[] = [];
  
  if (error instanceof Error) {
    // Error name and message
    parts.push(error.name);
    
    // Normalize error message (remove dynamic parts)
    const normalizedMessage = error.message
      .replace(/\d+/g, 'N') // Replace numbers
      .replace(/[a-f0-9-]{36}/g, 'UUID') // Replace UUIDs
      .replace(/https?:\/\/[^\s]+/g, 'URL') // Replace URLs
      .replace(/\b\w+@\w+\.\w+/g, 'EMAIL'); // Replace emails
    
    parts.push(normalizedMessage);
    
    // Stack trace (first few lines)
    if (error.stack) {
      const stackLines = error.stack.split('\n').slice(0, 3);
      const normalizedStack = stackLines
        .map(line => line.replace(/:\d+:\d+/g, ':N:N'))
        .join('|');
      parts.push(normalizedStack);
    }
  } else {
    parts.push(String(error));
  }
  
  // Add context
  if (context.component) {
    parts.push(`component:${context.component}`);
  }
  
  if (context.page) {
    parts.push(`page:${context.page}`);
  }
  
  // Generate hash
  const fingerprint = parts.join('|');
  return hashString(fingerprint);
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

// =============================================================================
// ERROR CONTEXT COLLECTION
// =============================================================================

export function collectErrorContext(customData?: Record<string, any>): ErrorContext {
  const context: ErrorContext = {
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    referrer: document.referrer || undefined
  };
  
  // Viewport information
  context.viewport = {
    width: window.innerWidth,
    height: window.innerHeight
  };
  
  // Connection information
  const connection = (navigator as any)?.connection;
  if (connection) {
    context.connection = {
      type: connection.type,
      effectiveType: connection.effectiveType,
      downlink: connection.downlink
    };
  }
  
  // Memory information
  const memory = (performance as any)?.memory;
  if (memory) {
    context.memory = {
      used: memory.usedJSHeapSize,
      limit: memory.jsHeapSizeLimit
    };
  }
  
  // Performance information
  if (performance.timing) {
    context.performance = {
      timing: Object.fromEntries(
        Object.entries(performance.timing).map(([key, value]) => [key, value])
      ),
      navigation: Object.fromEntries(
        Object.entries(performance.navigation).map(([key, value]) => [key, value])
      )
    };
  }
  
  // Session information
  try {
    context.sessionId = getSessionId();
    context.userId = getUserId();
  } catch {
    // Ignore errors getting user/session info
  }
  
  // Custom data
  if (customData) {
    context.customData = customData;
  }
  
  return context;
}

function getSessionId(): string | undefined {
  return sessionStorage.getItem('session_id') || undefined;
}

function getUserId(): string | undefined {
  try {
    const authData = localStorage.getItem('auth_store');
    if (authData) {
      const parsed = JSON.parse(authData);
      return parsed.state?.user?.id;
    }
  } catch {
    // Ignore parsing errors
  }
  return undefined;
}

// =============================================================================
// ERROR REPORTING SERVICE
// =============================================================================

class ErrorReportingService {
  private reports: Map<string, ErrorReport> = new Map();
  private maxReports = 100;
  private reportingEndpoint?: string;
  private enabled = true;
  
  constructor() {
    // Load existing reports from storage
    this.loadReports();
    
    // Set up periodic cleanup
    setInterval(() => this.cleanup(), 60000); // Every minute
  }
  
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
  
  setReportingEndpoint(endpoint: string): void {
    this.reportingEndpoint = endpoint;
  }
  
  report(error: unknown, context?: Partial<ErrorContext>): string {
    if (!this.enabled) return '';
    
    const fullContext = {
      ...collectErrorContext(),
      ...context
    };
    
    const { category, severity } = categorizeError(error);
    const fingerprint = generateErrorFingerprint(error, fullContext);
    
    // Get or create report
    const existingReport = this.reports.get(fingerprint);
    const now = Date.now();
    
    if (existingReport) {
      // Update existing report
      existingReport.count++;
      existingReport.lastSeen = now;
      existingReport.context = fullContext; // Update with latest context
    } else {
      // Create new report
      const newReport: ErrorReport = {
        id: generateReportId(),
        category,
        severity,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: fullContext,
        fingerprint,
        count: 1,
        firstSeen: now,
        lastSeen: now,
        resolved: false,
        tags: this.generateTags(error, fullContext)
      };
      
      this.reports.set(fingerprint, newReport);
    }
    
    // Save to storage
    this.saveReports();
    
    // Send to remote endpoint if configured
    if (this.reportingEndpoint) {
      this.sendReport(this.reports.get(fingerprint)!);
    }
    
    // Log locally
    logError(error, fullContext);
    
    return fingerprint;
  }
  
  getReports(filters?: {
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    resolved?: boolean;
    since?: number;
  }): ErrorReport[] {
    let reports = Array.from(this.reports.values());
    
    if (filters) {
      if (filters.category) {
        reports = reports.filter(r => r.category === filters.category);
      }
      if (filters.severity) {
        reports = reports.filter(r => r.severity === filters.severity);
      }
      if (filters.resolved !== undefined) {
        reports = reports.filter(r => r.resolved === filters.resolved);
      }
      if (filters.since) {
        reports = reports.filter(r => r.lastSeen >= filters.since);
      }
    }
    
    return reports.sort((a, b) => b.lastSeen - a.lastSeen);
  }
  
  markResolved(fingerprint: string): void {
    const report = this.reports.get(fingerprint);
    if (report) {
      report.resolved = true;
      this.saveReports();
    }
  }
  
  clearReports(): void {
    this.reports.clear();
    this.saveReports();
  }
  
  private generateTags(error: unknown, context: ErrorContext): string[] {
    const tags: string[] = [];
    
    if (context.page) {
      tags.push(`page:${context.page}`);
    }
    
    if (context.component) {
      tags.push(`component:${context.component}`);
    }
    
    if (context.connection?.effectiveType) {
      tags.push(`connection:${context.connection.effectiveType}`);
    }
    
    if (error instanceof Error) {
      tags.push(`error:${error.name}`);
    }
    
    return tags;
  }
  
  private async sendReport(report: ErrorReport): Promise<void> {
    if (!this.reportingEndpoint) return;
    
    try {
      await fetch(this.reportingEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(report)
      });
    } catch (error) {
      // Don't report errors in error reporting
      console.warn('Failed to send error report:', error);
    }
  }
  
  private loadReports(): void {
    try {
      const stored = localStorage.getItem('error_reports');
      if (stored) {
        const reports = JSON.parse(stored);
        this.reports = new Map(Object.entries(reports));
      }
    } catch {
      // Ignore storage errors
    }
  }
  
  private saveReports(): void {
    try {
      const reportsObj = Object.fromEntries(this.reports.entries());
      localStorage.setItem('error_reports', JSON.stringify(reportsObj));
    } catch {
      // Ignore storage errors
    }
  }
  
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    // Remove old reports
    for (const [fingerprint, report] of this.reports.entries()) {
      if (now - report.lastSeen > maxAge) {
        this.reports.delete(fingerprint);
      }
    }
    
    // Keep only most recent reports if we have too many
    if (this.reports.size > this.maxReports) {
      const sortedReports = Array.from(this.reports.entries())
        .sort(([, a], [, b]) => b.lastSeen - a.lastSeen)
        .slice(0, this.maxReports);
      
      this.reports = new Map(sortedReports);
    }
    
    this.saveReports();
  }
}

function generateReportId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// =============================================================================
// GLOBAL ERROR REPORTING INSTANCE
// =============================================================================

export const errorReporting = new ErrorReportingService();

// Configure based on environment
if (process.env.NODE_ENV === 'production') {
  // In production, enable reporting to endpoint
  const reportingEndpoint = process.env.NEXT_PUBLIC_ERROR_REPORTING_ENDPOINT;
  if (reportingEndpoint) {
    errorReporting.setReportingEndpoint(reportingEndpoint);
  }
} else {
  // In development, keep local reporting only
  errorReporting.setEnabled(true);
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

export function reportError(error: unknown, context?: Partial<ErrorContext>): string {
  return errorReporting.report(error, context);
}

export function getErrorReports(filters?: {
  category?: ErrorCategory;
  severity?: ErrorSeverity;
  resolved?: boolean;
  since?: number;
}): ErrorReport[] {
  return errorReporting.getReports(filters);
}

export function markErrorResolved(fingerprint: string): void {
  errorReporting.markResolved(fingerprint);
}

export function clearErrorReports(): void {
  errorReporting.clearReports();
}

// =============================================================================
// ERROR ANALYTICS
// =============================================================================

export interface ErrorAnalytics {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  topErrors: Array<{ fingerprint: string; message: string; count: number }>;
  errorRate: number; // errors per hour
  resolvedRate: number; // percentage of resolved errors
  averageResolutionTime: number; // in hours
}

export function generateErrorAnalytics(timeframe?: number): ErrorAnalytics {
  const since = timeframe ? Date.now() - timeframe : 0;
  const reports = errorReporting.getReports({ since });
  
  const analytics: ErrorAnalytics = {
    totalErrors: reports.reduce((sum, r) => sum + r.count, 0),
    errorsByCategory: {} as Record<ErrorCategory, number>,
    errorsBySeverity: {} as Record<ErrorSeverity, number>,
    topErrors: [],
    errorRate: 0,
    resolvedRate: 0,
    averageResolutionTime: 0
  };
  
  // Initialize counters
  const categories: ErrorCategory[] = ['network', 'authentication', 'authorization', 'validation', 'api', 'ui', 'data', 'performance', 'unknown'];
  const severities: ErrorSeverity[] = ['low', 'medium', 'high', 'critical'];
  
  categories.forEach(cat => analytics.errorsByCategory[cat] = 0);
  severities.forEach(sev => analytics.errorsBySeverity[sev] = 0);
  
  // Count errors
  reports.forEach(report => {
    analytics.errorsByCategory[report.category] += report.count;
    analytics.errorsBySeverity[report.severity] += report.count;
  });
  
  // Top errors
  analytics.topErrors = reports
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(r => ({
      fingerprint: r.fingerprint,
      message: r.message,
      count: r.count
    }));
  
  // Calculate rates
  if (timeframe) {
    const hours = timeframe / (1000 * 60 * 60);
    analytics.errorRate = analytics.totalErrors / hours;
  }
  
  const resolvedCount = reports.filter(r => r.resolved).length;
  analytics.resolvedRate = reports.length > 0 ? (resolvedCount / reports.length) * 100 : 0;
  
  // Average resolution time (simplified)
  const resolvedReports = reports.filter(r => r.resolved);
  if (resolvedReports.length > 0) {
    const totalResolutionTime = resolvedReports.reduce((sum, r) => {
      return sum + (r.lastSeen - r.firstSeen);
    }, 0);
    analytics.averageResolutionTime = (totalResolutionTime / resolvedReports.length) / (1000 * 60 * 60);
  }
  
  return analytics;
}