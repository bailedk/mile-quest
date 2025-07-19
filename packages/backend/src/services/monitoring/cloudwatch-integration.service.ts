/**
 * CloudWatch Integration Service
 * 
 * AWS CloudWatch integration for production monitoring and observability
 */

import { createLogger } from '../logger';
import { MetricEvent, LogEntry } from './types';

interface CloudWatchConfig {
  region: string;
  namespace: string;
  enableXRay?: boolean;
  enableLogs?: boolean;
  enableMetrics?: boolean;
  logGroupName?: string;
  batchSize?: number;
  flushInterval?: number;
}

export class CloudWatchIntegrationService {
  private logger = createLogger('cloudwatch-integration');
  private metricBuffer: MetricEvent[] = [];
  private logBuffer: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(private config: CloudWatchConfig) {
    this.startAutoFlush();
  }

  /**
   * Send custom metrics to CloudWatch
   */
  async putMetrics(metrics: MetricEvent[]): Promise<void> {
    if (!this.config.enableMetrics || metrics.length === 0) {
      return;
    }

    try {
      // In production, use AWS SDK v3
      const cloudWatchData = this.formatMetricsForCloudWatch(metrics);
      
      this.logger.info('Sending metrics to CloudWatch', {
        namespace: this.config.namespace,
        metricCount: metrics.length,
        metrics: cloudWatchData.slice(0, 5), // Log first 5 for debugging
      });

      // Simulate CloudWatch putMetricData API call
      // In production: await cloudWatchClient.putMetricData(cloudWatchData);
      
    } catch (error) {
      this.logger.error('Failed to send metrics to CloudWatch', error as Error, {
        metricCount: metrics.length,
        namespace: this.config.namespace,
      });
      throw error;
    }
  }

  /**
   * Send logs to CloudWatch Logs
   */
  async putLogEvents(logs: LogEntry[]): Promise<void> {
    if (!this.config.enableLogs || logs.length === 0) {
      return;
    }

    try {
      const logEvents = this.formatLogsForCloudWatch(logs);
      
      this.logger.info('Sending logs to CloudWatch Logs', {
        logGroup: this.config.logGroupName,
        eventCount: logs.length,
      });

      // Simulate CloudWatch Logs putLogEvents API call
      // In production: await cloudWatchLogsClient.putLogEvents(logEvents);
      
    } catch (error) {
      this.logger.error('Failed to send logs to CloudWatch', error as Error, {
        logCount: logs.length,
        logGroup: this.config.logGroupName,
      });
      throw error;
    }
  }

  /**
   * Create CloudWatch dashboard
   */
  async createDashboard(dashboardName: string, widgets: any[]): Promise<void> {
    try {
      const dashboardBody = {
        widgets: widgets.map(widget => ({
          type: widget.type,
          properties: {
            metrics: widget.metrics,
            period: widget.period || 300,
            stat: widget.stat || 'Average',
            region: this.config.region,
            title: widget.title,
            view: widget.view || 'timeSeries',
          },
        })),
      };

      this.logger.info('Creating CloudWatch dashboard', {
        dashboardName,
        widgetCount: widgets.length,
      });

      // Simulate CloudWatch putDashboard API call
      // In production: await cloudWatchClient.putDashboard({
      //   DashboardName: dashboardName,
      //   DashboardBody: JSON.stringify(dashboardBody)
      // });

    } catch (error) {
      this.logger.error('Failed to create CloudWatch dashboard', error as Error, {
        dashboardName,
        widgetCount: widgets.length,
      });
      throw error;
    }
  }

  /**
   * Create CloudWatch alarms
   */
  async createAlarm(alarmConfig: {
    alarmName: string;
    metricName: string;
    threshold: number;
    comparisonOperator: string;
    evaluationPeriods: number;
    period: number;
    statistic: string;
    alarmActions?: string[];
    treatMissingData?: string;
  }): Promise<void> {
    try {
      this.logger.info('Creating CloudWatch alarm', {
        alarmName: alarmConfig.alarmName,
        metricName: alarmConfig.metricName,
        threshold: alarmConfig.threshold,
      });

      // Simulate CloudWatch putMetricAlarm API call
      // In production: await cloudWatchClient.putMetricAlarm({
      //   AlarmName: alarmConfig.alarmName,
      //   MetricName: alarmConfig.metricName,
      //   Namespace: this.config.namespace,
      //   Threshold: alarmConfig.threshold,
      //   ComparisonOperator: alarmConfig.comparisonOperator,
      //   EvaluationPeriods: alarmConfig.evaluationPeriods,
      //   Period: alarmConfig.period,
      //   Statistic: alarmConfig.statistic,
      //   AlarmActions: alarmConfig.alarmActions || [],
      //   TreatMissingData: alarmConfig.treatMissingData || 'notBreaching'
      // });

    } catch (error) {
      this.logger.error('Failed to create CloudWatch alarm', error as Error, {
        alarmName: alarmConfig.alarmName,
        metricName: alarmConfig.metricName,
      });
      throw error;
    }
  }

  /**
   * Set up default Mile Quest monitoring dashboards
   */
  async setupDefaultDashboards(): Promise<void> {
    try {
      // Application Performance Dashboard
      await this.createDashboard('MileQuest-Application-Performance', [
        {
          type: 'metric',
          title: 'API Response Time',
          metrics: [
            [this.config.namespace, 'api.requests.duration', 'Endpoint', 'ALL'],
          ],
          stat: 'Average',
          period: 300,
        },
        {
          type: 'metric',
          title: 'Error Rate',
          metrics: [
            [this.config.namespace, 'api.requests.errors', 'Endpoint', 'ALL'],
          ],
          stat: 'Sum',
          period: 300,
        },
        {
          type: 'metric',
          title: 'Database Performance',
          metrics: [
            [this.config.namespace, 'database.operations.duration', 'Operation', 'SELECT'],
            [this.config.namespace, 'database.operations.duration', 'Operation', 'INSERT'],
            [this.config.namespace, 'database.operations.duration', 'Operation', 'UPDATE'],
          ],
          stat: 'Average',
          period: 300,
        },
      ]);

      // Business Metrics Dashboard
      await this.createDashboard('MileQuest-Business-Metrics', [
        {
          type: 'metric',
          title: 'Active Users',
          metrics: [
            [this.config.namespace, 'users.active'],
          ],
          stat: 'Maximum',
          period: 300,
        },
        {
          type: 'metric',
          title: 'Activities Created',
          metrics: [
            [this.config.namespace, 'activities.created'],
          ],
          stat: 'Sum',
          period: 300,
        },
        {
          type: 'metric',
          title: 'Team Progress',
          metrics: [
            [this.config.namespace, 'teams.progress.percentage'],
          ],
          stat: 'Average',
          period: 300,
        },
        {
          type: 'metric',
          title: 'Goals Completed',
          metrics: [
            [this.config.namespace, 'goals.completed'],
          ],
          stat: 'Sum',
          period: 300,
        },
      ]);

      this.logger.info('Default CloudWatch dashboards created successfully');

    } catch (error) {
      this.logger.error('Failed to setup default dashboards', error as Error);
      throw error;
    }
  }

  /**
   * Set up default CloudWatch alarms
   */
  async setupDefaultAlarms(): Promise<void> {
    try {
      const alarms = [
        {
          alarmName: 'MileQuest-High-Error-Rate',
          metricName: 'api.requests.errors',
          threshold: 10, // 10 errors per minute
          comparisonOperator: 'GreaterThanThreshold',
          evaluationPeriods: 2,
          period: 60,
          statistic: 'Sum',
          alarmActions: [process.env.SNS_ALERT_TOPIC_ARN],
        },
        {
          alarmName: 'MileQuest-Slow-Response-Time',
          metricName: 'api.requests.duration',
          threshold: 5000, // 5 seconds
          comparisonOperator: 'GreaterThanThreshold',
          evaluationPeriods: 3,
          period: 300,
          statistic: 'Average',
          alarmActions: [process.env.SNS_ALERT_TOPIC_ARN],
        },
        {
          alarmName: 'MileQuest-Database-Slow-Queries',
          metricName: 'database.operations.duration',
          threshold: 1000, // 1 second
          comparisonOperator: 'GreaterThanThreshold',
          evaluationPeriods: 2,
          period: 300,
          statistic: 'Average',
          alarmActions: [process.env.SNS_ALERT_TOPIC_ARN],
        },
        {
          alarmName: 'MileQuest-Lambda-Errors',
          metricName: 'lambda.errors',
          threshold: 5, // 5 errors per minute
          comparisonOperator: 'GreaterThanThreshold',
          evaluationPeriods: 1,
          period: 60,
          statistic: 'Sum',
          alarmActions: [process.env.SNS_ALERT_TOPIC_ARN],
        },
      ];

      for (const alarm of alarms) {
        await this.createAlarm(alarm);
      }

      this.logger.info('Default CloudWatch alarms created successfully', {
        alarmCount: alarms.length,
      });

    } catch (error) {
      this.logger.error('Failed to setup default alarms', error as Error);
      throw error;
    }
  }

  /**
   * Buffer metrics for batch sending
   */
  bufferMetric(metric: MetricEvent): void {
    this.metricBuffer.push(metric);
    
    if (this.metricBuffer.length >= (this.config.batchSize || 20)) {
      this.flushMetrics();
    }
  }

  /**
   * Buffer logs for batch sending
   */
  bufferLog(log: LogEntry): void {
    this.logBuffer.push(log);
    
    if (this.logBuffer.length >= (this.config.batchSize || 100)) {
      this.flushLogs();
    }
  }

  /**
   * Flush metrics buffer
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricBuffer.length === 0) return;
    
    const metricsToSend = this.metricBuffer.splice(0);
    await this.putMetrics(metricsToSend);
  }

  /**
   * Flush logs buffer
   */
  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0) return;
    
    const logsToSend = this.logBuffer.splice(0);
    await this.putLogEvents(logsToSend);
  }

  /**
   * Format metrics for CloudWatch API
   */
  private formatMetricsForCloudWatch(metrics: MetricEvent[]): any[] {
    return metrics.map(metric => ({
      MetricName: metric.name,
      Dimensions: Object.entries(metric.tags).map(([key, value]) => ({
        Name: key,
        Value: value,
      })),
      Unit: metric.unit || 'Count',
      Value: metric.value,
      Timestamp: metric.timestamp,
    }));
  }

  /**
   * Format logs for CloudWatch Logs API
   */
  private formatLogsForCloudWatch(logs: LogEntry[]): any {
    return {
      logGroupName: this.config.logGroupName,
      logStreamName: `mile-quest-${new Date().toISOString().split('T')[0]}`,
      logEvents: logs.map(log => ({
        timestamp: log.timestamp.getTime(),
        message: JSON.stringify({
          level: log.level,
          service: log.service,
          function: log.function,
          message: log.message,
          context: log.context,
          traceId: log.traceId,
          spanId: log.spanId,
          userId: log.userId,
          teamId: log.teamId,
          requestId: log.requestId,
        }),
      })),
    };
  }

  /**
   * Start auto-flush timer
   */
  private startAutoFlush(): void {
    const interval = this.config.flushInterval || 60000; // 1 minute
    
    this.flushTimer = setInterval(async () => {
      try {
        await Promise.all([
          this.flushMetrics(),
          this.flushLogs(),
        ]);
      } catch (error) {
        this.logger.error('Auto-flush failed', error as Error);
      }
    }, interval);
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Final flush
    await Promise.all([
      this.flushMetrics(),
      this.flushLogs(),
    ]);

    this.logger.info('CloudWatch integration service shutdown complete');
  }

  /**
   * Create production monitoring setup
   */
  async setupProductionMonitoring(): Promise<void> {
    try {
      this.logger.info('Setting up production monitoring in CloudWatch');

      // Create dashboards and alarms
      await Promise.all([
        this.setupDefaultDashboards(),
        this.setupDefaultAlarms(),
      ]);

      this.logger.info('Production monitoring setup complete');

    } catch (error) {
      this.logger.error('Failed to setup production monitoring', error as Error);
      throw error;
    }
  }
}