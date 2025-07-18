/**
 * Logger Factory
 * 
 * Creates appropriate logger instance based on environment
 */

import { MileQuestLogger, createLogger } from './index';

export interface LoggerFactory {
  createLogger(functionName: string): MileQuestLogger;
}

/**
 * Production logger factory using AWS Lambda Powertools
 */
class ProductionLoggerFactory implements LoggerFactory {
  createLogger(functionName: string): MileQuestLogger {
    return createLogger(functionName);
  }
}

/**
 * Development logger factory with console output
 */
class DevelopmentLoggerFactory implements LoggerFactory {
  createLogger(functionName: string): MileQuestLogger {
    // In development, we use the same logger but it will
    // output to console in a more readable format
    const logger = createLogger(functionName);
    
    // Lambda Powertools automatically detects local environment
    // and adjusts output format
    return logger;
  }
}

/**
 * Get appropriate logger factory based on environment
 */
export function getLoggerFactory(): LoggerFactory {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return isProduction 
    ? new ProductionLoggerFactory()
    : new DevelopmentLoggerFactory();
}

// Export singleton factory
export const loggerFactory = getLoggerFactory();