/**
 * Monitoring Service Types
 * 
 * Comprehensive types for monitoring and observability
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'timer';
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type ServiceStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

// Error Tracking Types
export interface ErrorContext {
  userId?: string;
  teamId?: string;
  sessionId?: string;
  requestId?: string;
  functionName?: string;
  operation?: string;
  [key: string]: any;
}

export interface ErrorEvent {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  error?: Error;
  context: ErrorContext;
  stackTrace?: string;
  fingerprint?: string;
  count?: number;
  environment: string;
  version: string;
}

export interface ErrorSummary {
  fingerprint: string;
  message: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  level: LogLevel;
  affectedUsers: number;
  environments: string[];
}

// Metrics Types
export interface MetricEvent {
  name: string;
  type: MetricType;
  value: number;
  timestamp: Date;
  tags: Record<string, string>;
  unit?: string;
}

export interface MetricSummary {
  name: string;
  type: MetricType;
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  p95: number;
  p99: number;
  tags: Record<string, string>;
  period: string;
}

// Tracing Types
export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  tags: Record<string, any>;
  logs: TraceLog[];
  status: 'ok' | 'error' | 'timeout';
  error?: string;
}

export interface TraceLog {
  timestamp: Date;
  level: LogLevel;
  message: string;
  fields?: Record<string, any>;
}

export interface Trace {
  traceId: string;
  spans: TraceSpan[];
  startTime: Date;
  endTime?: Date;
  duration?: number;
  service: string;
  operation: string;
  status: 'ok' | 'error' | 'timeout';
}

// Health Check Types
export interface HealthCheck {
  name: string;
  status: ServiceStatus;
  message?: string;
  lastCheck: Date;
  responseTime?: number;
  details?: Record<string, any>;
}

export interface SystemHealth {
  status: ServiceStatus;
  timestamp: Date;
  checks: HealthCheck[];
  summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
    unknown: number;
  };
}

// Uptime Monitoring Types
export interface UptimeCheck {
  id: string;
  name: string;
  type: 'http' | 'tcp' | 'ping' | 'database';
  target: string;
  interval: number; // seconds
  timeout: number; // seconds
  retries: number;
  regions: string[];
  enabled: boolean;
  headers?: Record<string, string>;
  expectedStatus?: number;
  expectedContent?: string;
}

export interface UptimeResult {
  checkId: string;
  timestamp: Date;
  region: string;
  status: 'up' | 'down' | 'timeout' | 'error';
  responseTime?: number;
  statusCode?: number;
  error?: string;
}

export interface UptimeSummary {
  checkId: string;
  name: string;
  period: string;
  uptime: number; // percentage
  totalChecks: number;
  successfulChecks: number;
  avgResponseTime: number;
  incidents: UptimeIncident[];
}

export interface UptimeIncident {
  id: string;
  checkId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'ongoing' | 'resolved';
  affectedRegions: string[];
  description: string;
}

// Alerting Types
export interface AlertRule {
  id: string;
  name: string;
  description: string;
  type: 'metric' | 'error' | 'uptime' | 'health';
  severity: AlertSeverity;
  enabled: boolean;
  conditions: AlertCondition[];
  actions: AlertAction[];
  cooldown: number; // seconds
  tags: Record<string, string>;
}

export interface AlertCondition {
  metric?: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
  threshold: number;
  timeWindow: number; // seconds
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';
}

export interface AlertAction {
  type: 'email' | 'sms' | 'webhook' | 'slack';
  target: string;
  template?: string;
  enabled: boolean;
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  status: 'firing' | 'resolved';
  message: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  context: Record<string, any>;
  actions: AlertActionResult[];
}

export interface AlertActionResult {
  type: string;
  target: string;
  status: 'sent' | 'failed' | 'pending';
  timestamp: Date;
  error?: string;
}

// Log Aggregation Types
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  service: string;
  function: string;
  message: string;
  context: Record<string, any>;
  traceId?: string;
  spanId?: string;
  userId?: string;
  teamId?: string;
  requestId?: string;
}

export interface LogQuery {
  service?: string;
  function?: string;
  level?: LogLevel;
  startTime?: Date;
  endTime?: Date;
  search?: string;
  tags?: Record<string, string>;
  limit?: number;
  offset?: number;
}

export interface LogAggregation {
  field: string;
  values: Array<{
    value: string;
    count: number;
    percentage: number;
  }>;
  total: number;
}

// Dashboard Types
export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'status' | 'logs';
  title: string;
  query: string;
  timeRange: string;
  refreshInterval: number;
  size: 'small' | 'medium' | 'large';
  position: { x: number; y: number };
}

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  widgets: DashboardWidget[];
  tags: string[];
  isPublic: boolean;
  owner: string;
  createdAt: Date;
  updatedAt: Date;
}

// Monitoring Configuration
export interface MonitoringConfig {
  errorTracking: {
    enabled: boolean;
    sampleRate: number;
    ignoredErrors: string[];
    groupingKey: string[];
  };
  metrics: {
    enabled: boolean;
    flushInterval: number;
    batchSize: number;
    namespace: string;
  };
  tracing: {
    enabled: boolean;
    sampleRate: number;
    propagation: string[];
  };
  alerting: {
    enabled: boolean;
    defaultCooldown: number;
    channels: Record<string, any>;
  };
  uptime: {
    enabled: boolean;
    defaultInterval: number;
    defaultTimeout: number;
    defaultRetries: number;
  };
}

// Service Interfaces
export interface IErrorTrackingService {
  trackError(error: Error, context?: ErrorContext): Promise<void>;
  getErrors(query?: Partial<ErrorEvent>): Promise<ErrorEvent[]>;
  getErrorSummary(timeRange?: string): Promise<ErrorSummary[]>;
  resolveError(fingerprint: string): Promise<void>;
}

export interface IMetricsService {
  counter(name: string, value?: number, tags?: Record<string, string>): void;
  gauge(name: string, value: number, tags?: Record<string, string>): void;
  histogram(name: string, value: number, tags?: Record<string, string>): void;
  timer(name: string): () => void;
  flush(): Promise<void>;
  getMetrics(query?: Partial<MetricEvent>): Promise<MetricEvent[]>;
  getMetricSummary(name: string, timeRange?: string): Promise<MetricSummary>;
}

export interface ITracingService {
  startSpan(operationName: string, parentSpan?: TraceSpan): TraceSpan;
  finishSpan(span: TraceSpan, error?: Error): void;
  getTrace(traceId: string): Promise<Trace | null>;
  getTraces(query?: any): Promise<Trace[]>;
}

export interface IHealthCheckService {
  registerCheck(name: string, checkFn: () => Promise<HealthCheck>): void;
  runCheck(name: string): Promise<HealthCheck>;
  runAllChecks(): Promise<SystemHealth>;
  getHealth(): Promise<SystemHealth>;
}

export interface IUptimeMonitoringService {
  createCheck(check: Omit<UptimeCheck, 'id'>): Promise<UptimeCheck>;
  updateCheck(id: string, updates: Partial<UptimeCheck>): Promise<UptimeCheck>;
  deleteCheck(id: string): Promise<void>;
  runCheck(id: string): Promise<UptimeResult>;
  getUptimeSummary(checkId: string, period?: string): Promise<UptimeSummary>;
  getIncidents(checkId?: string): Promise<UptimeIncident[]>;
}

export interface IAlertingService {
  createRule(rule: Omit<AlertRule, 'id'>): Promise<AlertRule>;
  updateRule(id: string, updates: Partial<AlertRule>): Promise<AlertRule>;
  deleteRule(id: string): Promise<void>;
  evaluateRules(): Promise<void>;
  fireAlert(ruleId: string, context: Record<string, any>): Promise<Alert>;
  resolveAlert(alertId: string): Promise<void>;
  getAlerts(status?: 'firing' | 'resolved'): Promise<Alert[]>;
}

export interface ILogAggregationService {
  ingestLog(entry: LogEntry): Promise<void>;
  queryLogs(query: LogQuery): Promise<LogEntry[]>;
  aggregateLogs(field: string, query?: LogQuery): Promise<LogAggregation>;
  createIndex(fields: string[]): Promise<void>;
}

export interface IMonitoringService {
  errorTracking: IErrorTrackingService;
  metrics: IMetricsService;
  tracing: ITracingService;
  healthCheck: IHealthCheckService;
  uptimeMonitoring: IUptimeMonitoringService;
  alerting: IAlertingService;
  logAggregation: ILogAggregationService;
  
  initialize(config: MonitoringConfig): Promise<void>;
  shutdown(): Promise<void>;
}