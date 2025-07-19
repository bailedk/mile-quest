/**
 * Monitoring Configuration
 * 
 * Environment-specific monitoring configurations for Mile Quest
 */

import { MonitoringConfig } from '../types';

export interface EnvironmentConfig {
  environment: string;
  monitoring: MonitoringConfig;
  cloudWatch: {
    enabled: boolean;
    region: string;
    namespace: string;
    logGroupName: string;
    enableXRay: boolean;
    enableLogs: boolean;
    enableMetrics: boolean;
    batchSize: number;
    flushInterval: number;
  };
  alerting: {
    email: {
      enabled: boolean;
      recipients: string[];
      smtpConfig: {
        host: string;
        port: number;
        secure: boolean;
        auth: {
          user: string;
          pass: string;
        };
      };
    };
    slack: {
      enabled: boolean;
      webhookUrl: string;
      channel: string;
      mentionUsers: string[];
    };
    sns: {
      enabled: boolean;
      topicArn: string;
      region: string;
    };
    webhook: {
      enabled: boolean;
      url: string;
      headers: Record<string, string>;
    };
  };
  retention: {
    metrics: string; // e.g., "30d"
    logs: string;    // e.g., "7d"
    traces: string;  // e.g., "24h"
    errors: string;  // e.g., "90d"
  };
}

/**
 * Production configuration
 */
export const PRODUCTION_CONFIG: EnvironmentConfig = {
  environment: 'production',
  monitoring: {
    errorTracking: {
      enabled: true,
      sampleRate: 1.0, // Track all errors in production
      ignoredErrors: [
        'AbortError',
        'TimeoutError',
        'ValidationError',
      ],
      groupingKey: ['error.name', 'error.message', 'function.name'],
    },
    metrics: {
      enabled: true,
      flushInterval: 120000, // 2 minutes
      batchSize: 200,
      namespace: 'MileQuest/Production',
    },
    tracing: {
      enabled: true,
      sampleRate: 0.05, // 5% sampling for production
      propagation: ['x-trace-id', 'x-span-id', 'x-parent-span-id'],
    },
    alerting: {
      enabled: true,
      defaultCooldown: 900, // 15 minutes
      channels: {
        email: {
          enabled: true,
          smtp: {
            host: process.env.SMTP_HOST || 'smtp.ses.us-east-1.amazonaws.com',
            port: 587,
            secure: true,
            auth: {
              user: process.env.SMTP_USER || '',
              pass: process.env.SMTP_PASS || '',
            },
          },
        },
        slack: {
          enabled: true,
          webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
        },
        sns: {
          enabled: true,
          topicArn: process.env.SNS_ALERT_TOPIC_ARN || '',
          region: process.env.AWS_REGION || 'us-east-1',
        },
      },
    },
    uptime: {
      enabled: true,
      defaultInterval: 60, // 1 minute
      defaultTimeout: 10000, // 10 seconds
      defaultRetries: 3,
    },
  },
  cloudWatch: {
    enabled: true,
    region: process.env.AWS_REGION || 'us-east-1',
    namespace: 'MileQuest/Production',
    logGroupName: '/aws/lambda/mile-quest-production',
    enableXRay: true,
    enableLogs: true,
    enableMetrics: true,
    batchSize: 100,
    flushInterval: 60000, // 1 minute
  },
  alerting: {
    email: {
      enabled: true,
      recipients: [
        process.env.ALERT_EMAIL_PRIMARY || 'alerts@milequest.app',
        process.env.ALERT_EMAIL_SECONDARY || 'devops@milequest.app',
      ],
      smtpConfig: {
        host: process.env.SMTP_HOST || 'smtp.ses.us-east-1.amazonaws.com',
        port: 587,
        secure: true,
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || '',
        },
      },
    },
    slack: {
      enabled: true,
      webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
      channel: '#alerts-production',
      mentionUsers: ['@channel'],
    },
    sns: {
      enabled: true,
      topicArn: process.env.SNS_ALERT_TOPIC_ARN || '',
      region: process.env.AWS_REGION || 'us-east-1',
    },
    webhook: {
      enabled: false,
      url: '',
      headers: {},
    },
  },
  retention: {
    metrics: '90d',
    logs: '30d',
    traces: '7d',
    errors: '180d',
  },
};

/**
 * Staging configuration
 */
export const STAGING_CONFIG: EnvironmentConfig = {
  ...PRODUCTION_CONFIG,
  environment: 'staging',
  monitoring: {
    ...PRODUCTION_CONFIG.monitoring,
    tracing: {
      ...PRODUCTION_CONFIG.monitoring.tracing,
      sampleRate: 0.2, // 20% sampling for staging
    },
    metrics: {
      ...PRODUCTION_CONFIG.monitoring.metrics,
      namespace: 'MileQuest/Staging',
      flushInterval: 60000, // 1 minute
    },
    alerting: {
      ...PRODUCTION_CONFIG.monitoring.alerting,
      defaultCooldown: 300, // 5 minutes
    },
  },
  cloudWatch: {
    ...PRODUCTION_CONFIG.cloudWatch,
    namespace: 'MileQuest/Staging',
    logGroupName: '/aws/lambda/mile-quest-staging',
    flushInterval: 30000, // 30 seconds
  },
  alerting: {
    ...PRODUCTION_CONFIG.alerting,
    slack: {
      ...PRODUCTION_CONFIG.alerting.slack,
      channel: '#alerts-staging',
      mentionUsers: [],
    },
  },
  retention: {
    metrics: '30d',
    logs: '14d',
    traces: '3d',
    errors: '90d',
  },
};

/**
 * Development configuration
 */
export const DEVELOPMENT_CONFIG: EnvironmentConfig = {
  environment: 'development',
  monitoring: {
    errorTracking: {
      enabled: true,
      sampleRate: 1.0, // Track all errors in development
      ignoredErrors: [],
      groupingKey: ['error.name', 'error.message'],
    },
    metrics: {
      enabled: true,
      flushInterval: 30000, // 30 seconds
      batchSize: 50,
      namespace: 'MileQuest/Development',
    },
    tracing: {
      enabled: true,
      sampleRate: 1.0, // Sample all traces in development
      propagation: ['x-trace-id', 'x-span-id'],
    },
    alerting: {
      enabled: false, // Disable alerting in development
      defaultCooldown: 60,
      channels: {},
    },
    uptime: {
      enabled: false, // Disable uptime monitoring in development
      defaultInterval: 300,
      defaultTimeout: 5000,
      defaultRetries: 1,
    },
  },
  cloudWatch: {
    enabled: false, // Use local logging in development
    region: 'us-east-1',
    namespace: 'MileQuest/Development',
    logGroupName: '/aws/lambda/mile-quest-development',
    enableXRay: false,
    enableLogs: false,
    enableMetrics: false,
    batchSize: 10,
    flushInterval: 15000, // 15 seconds
  },
  alerting: {
    email: {
      enabled: false,
      recipients: [],
      smtpConfig: {
        host: '',
        port: 587,
        secure: false,
        auth: {
          user: '',
          pass: '',
        },
      },
    },
    slack: {
      enabled: false,
      webhookUrl: '',
      channel: '#dev-alerts',
      mentionUsers: [],
    },
    sns: {
      enabled: false,
      topicArn: '',
      region: 'us-east-1',
    },
    webhook: {
      enabled: false,
      url: '',
      headers: {},
    },
  },
  retention: {
    metrics: '1d',
    logs: '6h',
    traces: '1h',
    errors: '24h',
  },
};

/**
 * Test configuration
 */
export const TEST_CONFIG: EnvironmentConfig = {
  environment: 'test',
  monitoring: {
    errorTracking: {
      enabled: false,
      sampleRate: 0,
      ignoredErrors: [],
      groupingKey: [],
    },
    metrics: {
      enabled: false,
      flushInterval: 5000,
      batchSize: 10,
      namespace: 'MileQuest/Test',
    },
    tracing: {
      enabled: false,
      sampleRate: 0,
      propagation: [],
    },
    alerting: {
      enabled: false,
      defaultCooldown: 0,
      channels: {},
    },
    uptime: {
      enabled: false,
      defaultInterval: 60,
      defaultTimeout: 1000,
      defaultRetries: 1,
    },
  },
  cloudWatch: {
    enabled: false,
    region: 'us-east-1',
    namespace: 'MileQuest/Test',
    logGroupName: '/aws/lambda/mile-quest-test',
    enableXRay: false,
    enableLogs: false,
    enableMetrics: false,
    batchSize: 1,
    flushInterval: 1000,
  },
  alerting: {
    email: {
      enabled: false,
      recipients: [],
      smtpConfig: {
        host: '',
        port: 587,
        secure: false,
        auth: {
          user: '',
          pass: '',
        },
      },
    },
    slack: {
      enabled: false,
      webhookUrl: '',
      channel: '',
      mentionUsers: [],
    },
    sns: {
      enabled: false,
      topicArn: '',
      region: 'us-east-1',
    },
    webhook: {
      enabled: false,
      url: '',
      headers: {},
    },
  },
  retention: {
    metrics: '1h',
    logs: '10m',
    traces: '5m',
    errors: '30m',
  },
};

/**
 * Get configuration for current environment
 */
export function getMonitoringConfig(): EnvironmentConfig {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env.toLowerCase()) {
    case 'production':
      return PRODUCTION_CONFIG;
    case 'staging':
      return STAGING_CONFIG;
    case 'development':
      return DEVELOPMENT_CONFIG;
    case 'test':
      return TEST_CONFIG;
    default:
      return DEVELOPMENT_CONFIG;
  }
}

/**
 * Get CloudWatch alarm configurations for the environment
 */
export function getAlarmConfigurations(environment: string): Array<{
  alarmName: string;
  metricName: string;
  threshold: number;
  comparisonOperator: string;
  evaluationPeriods: number;
  period: number;
  statistic: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
}> {
  const isProduction = environment === 'production';
  
  return [
    {
      alarmName: `MileQuest-${environment}-High-Error-Rate`,
      metricName: 'api.requests.errors',
      threshold: isProduction ? 10 : 20, // More lenient in non-prod
      comparisonOperator: 'GreaterThanThreshold',
      evaluationPeriods: 2,
      period: 300, // 5 minutes
      statistic: 'Sum',
      severity: 'critical',
      description: 'API error rate is too high',
    },
    {
      alarmName: `MileQuest-${environment}-Slow-Response-Time`,
      metricName: 'api.requests.duration',
      threshold: isProduction ? 5000 : 10000, // 5s prod, 10s non-prod
      comparisonOperator: 'GreaterThanThreshold',
      evaluationPeriods: 3,
      period: 300,
      statistic: 'Average',
      severity: 'high',
      description: 'API response time is too slow',
    },
    {
      alarmName: `MileQuest-${environment}-Database-Errors`,
      metricName: 'database.operations.errors',
      threshold: isProduction ? 5 : 10,
      comparisonOperator: 'GreaterThanThreshold',
      evaluationPeriods: 2,
      period: 300,
      statistic: 'Sum',
      severity: 'critical',
      description: 'Database error rate is too high',
    },
    {
      alarmName: `MileQuest-${environment}-Lambda-Throttles`,
      metricName: 'aws.lambda.throttles',
      threshold: 1,
      comparisonOperator: 'GreaterThanOrEqualToThreshold',
      evaluationPeriods: 1,
      period: 300,
      statistic: 'Sum',
      severity: 'high',
      description: 'Lambda functions are being throttled',
    },
    {
      alarmName: `MileQuest-${environment}-Memory-Usage`,
      metricName: 'aws.lambda.memory_utilization',
      threshold: 85, // 85%
      comparisonOperator: 'GreaterThanThreshold',
      evaluationPeriods: 3,
      period: 300,
      statistic: 'Average',
      severity: 'medium',
      description: 'Lambda memory utilization is high',
    },
    {
      alarmName: `MileQuest-${environment}-Dead-Letter-Queue`,
      metricName: 'aws.sqs.messages_visible',
      threshold: 0,
      comparisonOperator: 'GreaterThanThreshold',
      evaluationPeriods: 1,
      period: 60,
      statistic: 'Sum',
      severity: 'critical',
      description: 'Messages in dead letter queue',
    },
  ];
}

/**
 * Get dashboard configurations for the environment
 */
export function getDashboardConfigurations(environment: string): Array<{
  name: string;
  description: string;
  widgets: Array<{
    title: string;
    type: 'line' | 'number' | 'gauge' | 'bar';
    metrics: string[];
    period: number;
    statistic: string;
    yAxis?: {
      left?: {
        min?: number;
        max?: number;
      };
    };
  }>;
}> {
  return [
    {
      name: `MileQuest-${environment}-Application-Performance`,
      description: 'Key application performance metrics',
      widgets: [
        {
          title: 'API Response Time (ms)',
          type: 'line',
          metrics: ['api.requests.duration'],
          period: 300,
          statistic: 'Average',
          yAxis: {
            left: {
              min: 0,
            },
          },
        },
        {
          title: 'API Error Rate',
          type: 'line',
          metrics: ['api.requests.errors'],
          period: 300,
          statistic: 'Sum',
        },
        {
          title: 'Database Performance',
          type: 'line',
          metrics: [
            'database.operations.duration',
            'database.connections.active',
          ],
          period: 300,
          statistic: 'Average',
        },
        {
          title: 'Active Users',
          type: 'number',
          metrics: ['users.active'],
          period: 300,
          statistic: 'Maximum',
        },
      ],
    },
    {
      name: `MileQuest-${environment}-Business-Metrics`,
      description: 'Business KPIs and user engagement',
      widgets: [
        {
          title: 'Daily Active Users',
          type: 'line',
          metrics: ['users.daily_active'],
          period: 3600, // 1 hour
          statistic: 'Maximum',
        },
        {
          title: 'Activities Created',
          type: 'bar',
          metrics: ['activities.created'],
          period: 3600,
          statistic: 'Sum',
        },
        {
          title: 'Team Goals Completed',
          type: 'number',
          metrics: ['goals.completed'],
          period: 3600,
          statistic: 'Sum',
        },
        {
          title: 'Average Session Duration',
          type: 'gauge',
          metrics: ['sessions.duration'],
          period: 3600,
          statistic: 'Average',
          yAxis: {
            left: {
              min: 0,
              max: 3600, // 1 hour max
            },
          },
        },
      ],
    },
    {
      name: `MileQuest-${environment}-Infrastructure`,
      description: 'Infrastructure and AWS service metrics',
      widgets: [
        {
          title: 'Lambda Duration',
          type: 'line',
          metrics: ['aws.lambda.duration'],
          period: 300,
          statistic: 'Average',
        },
        {
          title: 'Lambda Memory Usage',
          type: 'line',
          metrics: ['aws.lambda.memory_utilization'],
          period: 300,
          statistic: 'Maximum',
          yAxis: {
            left: {
              min: 0,
              max: 100,
            },
          },
        },
        {
          title: 'Database Connections',
          type: 'line',
          metrics: ['database.connections.total', 'database.connections.active'],
          period: 300,
          statistic: 'Average',
        },
        {
          title: 'CloudWatch Costs',
          type: 'number',
          metrics: ['aws.cloudwatch.estimated_charges'],
          period: 3600,
          statistic: 'Maximum',
        },
      ],
    },
  ];
}

export default {
  getMonitoringConfig,
  getAlarmConfigurations,
  getDashboardConfigurations,
  PRODUCTION_CONFIG,
  STAGING_CONFIG,
  DEVELOPMENT_CONFIG,
  TEST_CONFIG,
};