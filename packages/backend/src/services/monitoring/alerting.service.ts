/**
 * Alerting Service
 * 
 * Rule-based alerting and notification system
 */

import { createLogger } from '../logger';
import { 
  IAlertingService, 
  AlertRule, 
  Alert, 
  AlertCondition, 
  AlertAction,
  AlertActionResult,
  AlertSeverity 
} from './types';
import crypto from 'crypto';

export class AlertingService implements IAlertingService {
  private logger = createLogger('alerting');
  private rules: Map<string, AlertRule> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private cooldowns: Map<string, Date> = new Map();
  private evaluationInterval: number = 60000; // 1 minute
  private evaluationTimer?: NodeJS.Timeout;

  constructor(
    private config: {
      evaluationInterval?: number;
      defaultCooldown?: number;
      emailService?: any;
      slackService?: any;
      webhookService?: any;
    } = {}
  ) {
    this.evaluationInterval = config.evaluationInterval ?? 60000;
    
    // Start rule evaluation
    this.startRuleEvaluation();
    
    // Create default alert rules
    this.createDefaultRules();
  }

  /**
   * Create a new alert rule
   */
  async createRule(ruleData: Omit<AlertRule, 'id'>): Promise<AlertRule> {
    const id = crypto.randomUUID();
    const rule: AlertRule = {
      id,
      ...ruleData,
    };

    this.rules.set(id, rule);
    
    this.logger.info('Alert rule created', {
      id,
      name: rule.name,
      type: rule.type,
      severity: rule.severity,
      enabled: rule.enabled,
    });

    return rule;
  }

  /**
   * Update an existing alert rule
   */
  async updateRule(id: string, updates: Partial<AlertRule>): Promise<AlertRule> {
    const existingRule = this.rules.get(id);
    if (!existingRule) {
      throw new Error(`Alert rule not found: ${id}`);
    }

    const updatedRule: AlertRule = {
      ...existingRule,
      ...updates,
      id, // Ensure ID doesn't change
    };

    this.rules.set(id, updatedRule);

    this.logger.info('Alert rule updated', {
      id,
      updates: Object.keys(updates),
    });

    return updatedRule;
  }

  /**
   * Delete an alert rule
   */
  async deleteRule(id: string): Promise<void> {
    const rule = this.rules.get(id);
    if (!rule) {
      throw new Error(`Alert rule not found: ${id}`);
    }

    this.rules.delete(id);
    this.cooldowns.delete(id);

    // Resolve any active alerts for this rule
    const activeAlerts = Array.from(this.alerts.values())
      .filter(alert => alert.ruleId === id && alert.status === 'firing');
    
    for (const alert of activeAlerts) {
      await this.resolveAlert(alert.id);
    }

    this.logger.info('Alert rule deleted', { id, name: rule.name });
  }

  /**
   * Evaluate all alert rules
   */
  async evaluateRules(): Promise<void> {
    const enabledRules = Array.from(this.rules.values()).filter(rule => rule.enabled);
    
    for (const rule of enabledRules) {
      try {
        await this.evaluateRule(rule);
      } catch (error) {
        this.logger.error('Failed to evaluate alert rule', error as Error, {
          ruleId: rule.id,
          ruleName: rule.name,
        });
      }
    }
  }

  /**
   * Fire an alert manually
   */
  async fireAlert(ruleId: string, context: Record<string, any>): Promise<Alert> {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Alert rule not found: ${ruleId}`);
    }

    const alertId = crypto.randomUUID();
    const alert: Alert = {
      id: alertId,
      ruleId,
      ruleName: rule.name,
      severity: rule.severity,
      status: 'firing',
      message: this.generateAlertMessage(rule, context),
      startTime: new Date(),
      context,
      actions: [],
    };

    this.alerts.set(alertId, alert);

    // Execute alert actions
    for (const action of rule.actions) {
      if (action.enabled) {
        const result = await this.executeAction(action, alert);
        alert.actions.push(result);
      }
    }

    // Set cooldown
    this.cooldowns.set(ruleId, new Date(Date.now() + (rule.cooldown * 1000)));

    this.logger.error('Alert fired', undefined, {
      alertId,
      ruleId,
      ruleName: rule.name,
      severity: rule.severity,
      message: alert.message,
      context,
    });

    return alert;
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    if (alert.status === 'resolved') {
      return; // Already resolved
    }

    alert.status = 'resolved';
    alert.endTime = new Date();
    alert.duration = alert.endTime.getTime() - alert.startTime.getTime();

    // Send resolution notifications
    const rule = this.rules.get(alert.ruleId);
    if (rule) {
      for (const action of rule.actions) {
        if (action.enabled) {
          const resolutionAlert = { ...alert, message: `RESOLVED: ${alert.message}` };
          const result = await this.executeAction(action, resolutionAlert);
          alert.actions.push(result);
        }
      }
    }

    this.logger.info('Alert resolved', {
      alertId,
      ruleId: alert.ruleId,
      ruleName: alert.ruleName,
      duration: alert.duration,
    });
  }

  /**
   * Get alerts by status
   */
  async getAlerts(status?: 'firing' | 'resolved'): Promise<Alert[]> {
    let alerts = Array.from(this.alerts.values());
    
    if (status) {
      alerts = alerts.filter(alert => alert.status === status);
    }
    
    return alerts.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  /**
   * Get alert statistics
   */
  async getAlertStatistics(): Promise<{
    total: number;
    firing: number;
    resolved: number;
    byRule: Record<string, number>;
    bySeverity: Record<AlertSeverity, number>;
  }> {
    const alerts = Array.from(this.alerts.values());
    
    const byRule: Record<string, number> = {};
    const bySeverity: Record<AlertSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };
    
    alerts.forEach(alert => {
      byRule[alert.ruleName] = (byRule[alert.ruleName] || 0) + 1;
      bySeverity[alert.severity]++;
    });
    
    return {
      total: alerts.length,
      firing: alerts.filter(a => a.status === 'firing').length,
      resolved: alerts.filter(a => a.status === 'resolved').length,
      byRule,
      bySeverity,
    };
  }

  /**
   * Get alert rules
   */
  async getRules(): Promise<AlertRule[]> {
    return Array.from(this.rules.values())
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get detailed alert statistics with time range analysis
   */
  async getDetailedAlertStatistics(timeRange: string = '24h'): Promise<{
    totalAlerts: number;
    firingAlerts: number;
    resolvedAlerts: number;
    alertsBySeverity: Record<AlertSeverity, number>;
    alertsByRule: Record<string, number>;
    averageResolutionTime: number;
    topAlertingRules: Array<{
      ruleId: string;
      ruleName: string;
      count: number;
    }>;
  }> {
    const cutoff = this.getTimeRangeCutoff(timeRange);
    const recentAlerts = Array.from(this.alerts.values())
      .filter(alert => alert.startTime >= cutoff);

    const alertsBySeverity: Record<AlertSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    const alertsByRule: Record<string, number> = {};
    const resolutionTimes: number[] = [];

    recentAlerts.forEach(alert => {
      alertsBySeverity[alert.severity]++;
      alertsByRule[alert.ruleName] = (alertsByRule[alert.ruleName] || 0) + 1;

      if (alert.duration) {
        resolutionTimes.push(alert.duration);
      }
    });

    const topAlertingRules = Object.entries(alertsByRule)
      .map(([ruleName, count]) => {
        const rule = Array.from(this.rules.values()).find(r => r.name === ruleName);
        return {
          ruleId: rule?.id || 'unknown',
          ruleName,
          count,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const averageResolutionTime = resolutionTimes.length > 0
      ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
      : 0;

    return {
      totalAlerts: recentAlerts.length,
      firingAlerts: recentAlerts.filter(a => a.status === 'firing').length,
      resolvedAlerts: recentAlerts.filter(a => a.status === 'resolved').length,
      alertsBySeverity,
      alertsByRule,
      averageResolutionTime,
      topAlertingRules,
    };
  }

  /**
   * Test alert rule
   */
  async testRule(ruleId: string): Promise<{
    success: boolean;
    message: string;
    testAlert?: Alert;
  }> {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return {
        success: false,
        message: `Alert rule not found: ${ruleId}`,
      };
    }

    try {
      // Create test alert
      const testAlert = await this.fireAlert(ruleId, {
        test: true,
        timestamp: new Date().toISOString(),
        message: 'This is a test alert',
      });

      // Immediately resolve test alert
      await this.resolveAlert(testAlert.id);

      return {
        success: true,
        message: 'Alert rule test completed successfully',
        testAlert,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Test failed',
      };
    }
  }

  /**
   * Evaluate a single alert rule
   */
  private async evaluateRule(rule: AlertRule): Promise<void> {
    // Check if rule is in cooldown
    const cooldownEnd = this.cooldowns.get(rule.id);
    if (cooldownEnd && cooldownEnd > new Date()) {
      return;
    }

    // Check if there's already a firing alert for this rule
    const existingAlert = Array.from(this.alerts.values())
      .find(alert => alert.ruleId === rule.id && alert.status === 'firing');

    let shouldAlert = false;
    const context: Record<string, any> = {};

    // Evaluate conditions based on rule type
    switch (rule.type) {
      case 'metric':
        shouldAlert = await this.evaluateMetricConditions(rule, context);
        break;
      case 'error':
        shouldAlert = await this.evaluateErrorConditions(rule, context);
        break;
      case 'uptime':
        shouldAlert = await this.evaluateUptimeConditions(rule, context);
        break;
      case 'health':
        shouldAlert = await this.evaluateHealthConditions(rule, context);
        break;
    }

    if (shouldAlert && !existingAlert) {
      // Fire new alert
      await this.fireAlert(rule.id, context);
    } else if (!shouldAlert && existingAlert) {
      // Resolve existing alert
      await this.resolveAlert(existingAlert.id);
    }
  }

  /**
   * Evaluate metric-based conditions
   */
  private async evaluateMetricConditions(
    rule: AlertRule, 
    context: Record<string, any>
  ): Promise<boolean> {
    // In a real implementation, this would query the metrics service
    // For now, we'll simulate metric evaluation
    
    for (const condition of rule.conditions) {
      if (!condition.metric) continue;

      // Simulate metric value
      const metricValue = Math.random() * 100;
      context[`metric_${condition.metric}`] = metricValue;

      const threshold = condition.threshold;
      let conditionMet = false;

      switch (condition.operator) {
        case 'gt':
          conditionMet = metricValue > threshold;
          break;
        case 'gte':
          conditionMet = metricValue >= threshold;
          break;
        case 'lt':
          conditionMet = metricValue < threshold;
          break;
        case 'lte':
          conditionMet = metricValue <= threshold;
          break;
        case 'eq':
          conditionMet = metricValue === threshold;
          break;
        case 'neq':
          conditionMet = metricValue !== threshold;
          break;
      }

      if (conditionMet) {
        context.triggeredCondition = condition;
        return true;
      }
    }

    return false;
  }

  /**
   * Evaluate error-based conditions
   */
  private async evaluateErrorConditions(
    rule: AlertRule, 
    context: Record<string, any>
  ): Promise<boolean> {
    // Simulate error rate check
    const errorRate = Math.random() * 10; // 0-10%
    context.errorRate = errorRate;

    for (const condition of rule.conditions) {
      if (condition.operator === 'gt' && errorRate > condition.threshold) {
        context.triggeredCondition = condition;
        return true;
      }
    }

    return false;
  }

  /**
   * Evaluate uptime-based conditions
   */
  private async evaluateUptimeConditions(
    rule: AlertRule, 
    context: Record<string, any>
  ): Promise<boolean> {
    // Simulate uptime check
    const uptime = Math.random() * 100; // 0-100%
    context.uptime = uptime;

    for (const condition of rule.conditions) {
      if (condition.operator === 'lt' && uptime < condition.threshold) {
        context.triggeredCondition = condition;
        return true;
      }
    }

    return false;
  }

  /**
   * Evaluate health-based conditions
   */
  private async evaluateHealthConditions(
    rule: AlertRule, 
    context: Record<string, any>
  ): Promise<boolean> {
    // Simulate health check failure
    const healthStatus = Math.random() > 0.95 ? 'unhealthy' : 'healthy';
    context.healthStatus = healthStatus;

    if (healthStatus === 'unhealthy') {
      context.triggeredCondition = { metric: 'health_status', operator: 'eq', threshold: 0, timeWindow: 60, aggregation: 'avg' };
      return true;
    }

    return false;
  }

  /**
   * Execute alert action
   */
  private async executeAction(action: AlertAction, alert: Alert): Promise<AlertActionResult> {
    const result: AlertActionResult = {
      type: action.type,
      target: action.target,
      status: 'pending',
      timestamp: new Date(),
    };

    try {
      switch (action.type) {
        case 'email':
          await this.sendEmailAlert(action, alert);
          result.status = 'sent';
          break;
        case 'sms':
          await this.sendSmsAlert(action, alert);
          result.status = 'sent';
          break;
        case 'webhook':
          await this.sendWebhookAlert(action, alert);
          result.status = 'sent';
          break;
        case 'slack':
          await this.sendSlackAlert(action, alert);
          result.status = 'sent';
          break;
        default:
          throw new Error(`Unsupported action type: ${action.type}`);
      }

      this.logger.info('Alert action executed', {
        actionType: action.type,
        target: action.target,
        alertId: alert.id,
      });

    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('Alert action failed', error as Error, {
        actionType: action.type,
        target: action.target,
        alertId: alert.id,
      });
    }

    return result;
  }

  /**
   * Execute resolution action
   */
  private async executeResolutionAction(action: AlertAction, alert: Alert): Promise<void> {
    try {
      switch (action.type) {
        case 'email':
          await this.sendEmailResolution(action, alert);
          break;
        case 'webhook':
          await this.sendWebhookResolution(action, alert);
          break;
        case 'slack':
          await this.sendSlackResolution(action, alert);
          break;
        // SMS typically doesn't send resolution notifications
      }

      this.logger.info('Alert resolution notification sent', {
        actionType: action.type,
        target: action.target,
        alertId: alert.id,
      });

    } catch (error) {
      this.logger.error('Alert resolution notification failed', error as Error, {
        actionType: action.type,
        target: action.target,
        alertId: alert.id,
      });
    }
  }

  /**
   * Send email alert (simulated)
   */
  private async sendEmailAlert(action: AlertAction, alert: Alert): Promise<void> {
    // In a real implementation, this would use the email service
    this.logger.info('Email alert sent (simulated)', {
      to: action.target,
      subject: `Alert: ${alert.ruleName}`,
      alertId: alert.id,
      severity: alert.severity,
    });
  }

  /**
   * Send SMS alert (simulated)
   */
  private async sendSmsAlert(action: AlertAction, alert: Alert): Promise<void> {
    // In a real implementation, this would use an SMS service
    this.logger.info('SMS alert sent (simulated)', {
      to: action.target,
      message: alert.message,
      alertId: alert.id,
    });
  }

  /**
   * Send webhook alert (simulated)
   */
  private async sendWebhookAlert(action: AlertAction, alert: Alert): Promise<void> {
    // In a real implementation, this would make HTTP POST to webhook URL
    this.logger.info('Webhook alert sent (simulated)', {
      url: action.target,
      payload: {
        alertId: alert.id,
        ruleName: alert.ruleName,
        severity: alert.severity,
        message: alert.message,
        timestamp: alert.startTime,
        context: alert.context,
      },
    });
  }

  /**
   * Send Slack alert (simulated)
   */
  private async sendSlackAlert(action: AlertAction, alert: Alert): Promise<void> {
    // In a real implementation, this would use Slack API
    this.logger.info('Slack alert sent (simulated)', {
      channel: action.target,
      text: `🚨 *${alert.ruleName}* (${alert.severity})\n${alert.message}`,
      alertId: alert.id,
    });
  }

  /**
   * Send email resolution (simulated)
   */
  private async sendEmailResolution(action: AlertAction, alert: Alert): Promise<void> {
    this.logger.info('Email resolution sent (simulated)', {
      to: action.target,
      subject: `Resolved: ${alert.ruleName}`,
      alertId: alert.id,
      duration: alert.duration,
    });
  }

  /**
   * Send webhook resolution (simulated)
   */
  private async sendWebhookResolution(action: AlertAction, alert: Alert): Promise<void> {
    this.logger.info('Webhook resolution sent (simulated)', {
      url: action.target,
      payload: {
        alertId: alert.id,
        ruleName: alert.ruleName,
        status: 'resolved',
        duration: alert.duration,
        resolvedAt: alert.endTime,
      },
    });
  }

  /**
   * Send Slack resolution (simulated)
   */
  private async sendSlackResolution(action: AlertAction, alert: Alert): Promise<void> {
    this.logger.info('Slack resolution sent (simulated)', {
      channel: action.target,
      text: `✅ *Resolved: ${alert.ruleName}*\nDuration: ${Math.round((alert.duration || 0) / 1000)}s`,
      alertId: alert.id,
    });
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(rule: AlertRule, context: Record<string, any>): string {
    const condition = context.triggeredCondition;
    
    let message = `${rule.name}: `;
    
    if (condition && condition.metric) {
      const value = context[`metric_${condition.metric}`];
      message += `${condition.metric} is ${value} (threshold: ${condition.threshold})`;
    } else if (context.errorRate !== undefined) {
      message += `Error rate is ${context.errorRate}%`;
    } else if (context.uptime !== undefined) {
      message += `Uptime is ${context.uptime}%`;
    } else if (context.healthStatus) {
      message += `Health status is ${context.healthStatus}`;
    } else {
      message += 'Alert condition triggered';
    }
    
    return message;
  }

  /**
   * Create default alert rules
   */
  private createDefaultRules(): void {
    // High error rate alert
    this.createRule({
      name: 'High Error Rate',
      description: 'Alert when error rate exceeds 5%',
      type: 'error',
      severity: 'high',
      enabled: true,
      conditions: [{
        operator: 'gt',
        threshold: 5,
        timeWindow: 300, // 5 minutes
        aggregation: 'avg',
      }],
      actions: [{
        type: 'email',
        target: 'admin@example.com',
        enabled: true,
      }],
      cooldown: 900, // 15 minutes
      tags: { category: 'error', auto_created: 'true' },
    });

    // Low uptime alert
    this.createRule({
      name: 'Low Uptime',
      description: 'Alert when uptime falls below 95%',
      type: 'uptime',
      severity: 'critical',
      enabled: true,
      conditions: [{
        operator: 'lt',
        threshold: 95,
        timeWindow: 600, // 10 minutes
        aggregation: 'avg',
      }],
      actions: [{
        type: 'email',
        target: 'ops@example.com',
        enabled: true,
      }],
      cooldown: 300, // 5 minutes
      tags: { category: 'uptime', auto_created: 'true' },
    });

    // Health check failure alert
    this.createRule({
      name: 'Health Check Failure',
      description: 'Alert when health checks fail',
      type: 'health',
      severity: 'critical',
      enabled: true,
      conditions: [{
        operator: 'eq',
        threshold: 0, // 0 = unhealthy
        timeWindow: 120, // 2 minutes
        aggregation: 'avg',
      }],
      actions: [{
        type: 'email',
        target: 'ops@example.com',
        enabled: true,
      }],
      cooldown: 600, // 10 minutes
      tags: { category: 'health', auto_created: 'true' },
    });
  }

  /**
   * Start rule evaluation timer
   */
  private startRuleEvaluation(): void {
    this.evaluationTimer = setInterval(() => {
      this.evaluateRules().catch(error => {
        this.logger.error('Rule evaluation failed', error as Error);
      });
    }, this.evaluationInterval);

    this.logger.info('Alert rule evaluation started', {
      interval: this.evaluationInterval,
    });
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
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = undefined;
    }

    this.logger.info('Alerting service shutdown', {
      totalRules: this.rules.size,
      totalAlerts: this.alerts.size,
      activeAlerts: Array.from(this.alerts.values()).filter(a => a.status === 'firing').length,
    });
  }
}