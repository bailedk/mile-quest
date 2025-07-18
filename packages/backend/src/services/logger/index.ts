/**
 * Logging Service for Mile Quest
 * 
 * Provides structured logging for AWS Lambda functions with:
 * - CloudWatch integration
 * - Request correlation
 * - Performance tracking
 * - Error context
 */

import { Logger } from '@aws-lambda-powertools/logger';
import { config } from '../../config/environment';

// Create base logger instance
const baseLogger = new Logger({
  serviceName: 'mile-quest-api',
  logLevel: config.LOG_LEVEL.toUpperCase() as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
  environment: config.STAGE,
});

// Export types for use in other modules
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogContext = Record<string, any>;

/**
 * Enhanced logger with additional context and utilities
 */
export class MileQuestLogger {
  private logger: Logger;
  private context: LogContext = {};

  constructor(private functionName: string) {
    this.logger = baseLogger.createChild({
      persistentLogAttributes: {
        functionName,
        version: process.env.AWS_LAMBDA_FUNCTION_VERSION || 'local',
      },
    });
  }

  /**
   * Set correlation ID for request tracking
   */
  setCorrelationId(correlationId: string): void {
    this.context.correlationId = correlationId;
    this.logger.appendKeys({ correlationId });
  }

  /**
   * Set user context for the current request
   */
  setUserContext(userId?: string, teamId?: string): void {
    if (userId) {
      this.context.userId = userId;
      this.logger.appendKeys({ userId });
    }
    if (teamId) {
      this.context.teamId = teamId;
      this.logger.appendKeys({ teamId });
    }
  }

  /**
   * Add custom context that will be included in all logs
   */
  addContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
    this.logger.appendKeys(context);
  }

  /**
   * Log methods
   */
  debug(message: string, data?: LogContext): void {
    this.logger.debug(message, data || {});
  }

  info(message: string, data?: LogContext): void {
    this.logger.info(message, data || {});
  }

  warn(message: string, data?: LogContext): void {
    this.logger.warn(message, data || {});
  }

  error(message: string, error?: Error | unknown, data?: LogContext): void {
    const errorData: LogContext = {
      ...data,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
    };
    this.logger.error(message, errorData);
  }

  /**
   * Performance tracking
   */
  startTimer(operation: string): () => void {
    const startTime = Date.now();
    
    return () => {
      const duration = Date.now() - startTime;
      this.info(`Operation completed`, {
        operation,
        durationMs: duration,
        performance: {
          operation,
          duration,
          timestamp: new Date().toISOString(),
        },
      });
    };
  }

  /**
   * Log API request
   */
  logRequest(method: string, path: string, statusCode?: number): void {
    this.info('API Request', {
      httpMethod: method,
      path,
      statusCode,
      request: {
        method,
        path,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log database query
   */
  logQuery(operation: string, table: string, duration?: number): void {
    this.debug('Database Query', {
      database: {
        operation,
        table,
        duration,
      },
    });
  }

  /**
   * Create a child logger with additional context
   */
  createChild(context: LogContext): MileQuestLogger {
    const child = new MileQuestLogger(this.functionName);
    child.context = { ...this.context, ...context };
    child.logger.appendKeys(child.context);
    return child;
  }
}

/**
 * Factory function to create logger for each Lambda handler
 */
export function createLogger(functionName: string): MileQuestLogger {
  return new MileQuestLogger(functionName);
}

/**
 * Middleware to automatically inject logger into Lambda context
 */
export function withLogger(handler: Function, functionName: string) {
  return async (event: any, context: any) => {
    const logger = createLogger(functionName);
    
    // Set correlation ID from API Gateway or generate one
    const correlationId = event.headers?.['x-correlation-id'] || 
                         event.requestContext?.requestId || 
                         `local-${Date.now()}`;
    
    logger.setCorrelationId(correlationId);
    
    // Log the incoming request
    logger.logRequest(
      event.httpMethod || 'UNKNOWN',
      event.path || event.routeKey || 'UNKNOWN'
    );
    
    // Add logger to context for use in handler
    context.logger = logger;
    
    try {
      const result = await handler(event, context);
      
      // Log successful response
      logger.logRequest(
        event.httpMethod || 'UNKNOWN',
        event.path || event.routeKey || 'UNKNOWN',
        result.statusCode
      );
      
      return result;
    } catch (error) {
      // Log error
      logger.error('Lambda handler error', error);
      throw error;
    }
  };
}

// Export a default logger for utilities and services
export const defaultLogger = createLogger('mile-quest-service');