/**
 * SDK Types
 * 
 * Types for monitoring SDK integration
 */

export interface MonitoringOptions {
  functionName?: string;
  trackErrors?: boolean;
  trackMetrics?: boolean;
  trackTracing?: boolean;
  tags?: Record<string, string>;
  sampleRate?: number;
}

export interface ExternalServiceConfig {
  name: string;
  type: 'http' | 'database' | 'queue' | 'cache' | 'storage';
  endpoint?: string;
  timeout?: number;
  retries?: number;
  trackRequests?: boolean;
  trackErrors?: boolean;
  trackLatency?: boolean;
}

export interface BusinessEvent {
  name: string;
  value?: number;
  metadata?: Record<string, any>;
  userId?: string;
  teamId?: string;
  timestamp?: Date;
}

export interface MonitoringMetadata {
  traceId?: string;
  spanId?: string;
  userId?: string;
  teamId?: string;
  sessionId?: string;
  requestId?: string;
  operation?: string;
  tags?: Record<string, string>;
}