import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

interface MonitoringStackProps extends cdk.StackProps {
  stage: string;
  api: apigateway.RestApi;
  database: rds.DatabaseInstance;
}

export class MonitoringStack extends cdk.Stack {
  public readonly alarmTopic: sns.Topic;
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { stage, api, database } = props;

    // SNS Topic for Alerts
    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: `mile-quest-${stage}-alarms`,
      displayName: `Mile Quest ${stage} Alerts`,
    });

    // Email subscription for alerts (replace with actual email)
    this.alarmTopic.addSubscription(
      new snsSubscriptions.EmailSubscription('devops@mile-quest.com')
    );

    // CloudWatch Dashboard
    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `mile-quest-${stage}-dashboard`,
    });

    // API Gateway Metrics
    const apiErrorMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '4XXError',
      dimensionsMap: {
        ApiName: api.restApiName,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const apiLatencyMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Latency',
      dimensionsMap: {
        ApiName: api.restApiName,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    const apiCountMetric = new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Count',
      dimensionsMap: {
        ApiName: api.restApiName,
      },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // Database Metrics
    const dbCpuMetric = new cloudwatch.Metric({
      namespace: 'AWS/RDS',
      metricName: 'CPUUtilization',
      dimensionsMap: {
        DBInstanceIdentifier: database.instanceIdentifier,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    const dbConnectionsMetric = new cloudwatch.Metric({
      namespace: 'AWS/RDS',
      metricName: 'DatabaseConnections',
      dimensionsMap: {
        DBInstanceIdentifier: database.instanceIdentifier,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    const dbFreeStorageMetric = new cloudwatch.Metric({
      namespace: 'AWS/RDS',
      metricName: 'FreeStorageSpace',
      dimensionsMap: {
        DBInstanceIdentifier: database.instanceIdentifier,
      },
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    // Alarms
    const apiErrorAlarm = new cloudwatch.Alarm(this, 'ApiErrorAlarm', {
      alarmName: `mile-quest-${stage}-api-errors`,
      alarmDescription: 'API Gateway 4XX error rate is too high',
      metric: apiErrorMetric,
      threshold: 10, // 10 errors in 5 minutes
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    const apiLatencyAlarm = new cloudwatch.Alarm(this, 'ApiLatencyAlarm', {
      alarmName: `mile-quest-${stage}-api-latency`,
      alarmDescription: 'API Gateway latency is too high',
      metric: apiLatencyMetric,
      threshold: 2000, // 2 seconds
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    const dbCpuAlarm = new cloudwatch.Alarm(this, 'DbCpuAlarm', {
      alarmName: `mile-quest-${stage}-db-cpu`,
      alarmDescription: 'Database CPU utilization is too high',
      metric: dbCpuMetric,
      threshold: 80, // 80%
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    const dbConnectionsAlarm = new cloudwatch.Alarm(this, 'DbConnectionsAlarm', {
      alarmName: `mile-quest-${stage}-db-connections`,
      alarmDescription: 'Database connections are too high',
      metric: dbConnectionsMetric,
      threshold: 80, // 80 connections (out of 100 max for t3.micro)
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    const dbStorageAlarm = new cloudwatch.Alarm(this, 'DbStorageAlarm', {
      alarmName: `mile-quest-${stage}-db-storage`,
      alarmDescription: 'Database free storage is too low',
      metric: dbFreeStorageMetric,
      threshold: 2 * 1024 * 1024 * 1024, // 2 GB in bytes
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });

    // Budget Alarm (Cost Management)
    const budgetAlarm = new cloudwatch.Alarm(this, 'BudgetAlarm', {
      alarmName: `mile-quest-${stage}-budget`,
      alarmDescription: 'Monthly AWS spend is approaching budget limit',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Billing',
        metricName: 'EstimatedCharges',
        dimensionsMap: {
          Currency: 'USD',
        },
        statistic: 'Maximum',
        period: cdk.Duration.hours(6),
      }),
      threshold: stage === 'production' ? 150 : 50, // $150 for prod, $50 for staging
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Add alarms to SNS topic
    apiErrorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));
    apiLatencyAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));
    dbCpuAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));
    dbConnectionsAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));
    dbStorageAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));
    budgetAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

    // Dashboard Widgets
    this.dashboard.addWidgets(
      // API Metrics Row
      new cloudwatch.GraphWidget({
        title: 'API Gateway Requests',
        left: [apiCountMetric],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway Latency',
        left: [apiLatencyMetric],
        width: 12,
        height: 6,
      })
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Gateway Errors',
        left: [apiErrorMetric],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Database CPU Utilization',
        left: [dbCpuMetric],
        width: 12,
        height: 6,
      })
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Database Connections',
        left: [dbConnectionsMetric],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Database Free Storage',
        left: [dbFreeStorageMetric],
        width: 12,
        height: 6,
      })
    );

    // Lambda Log Groups (will be created by SAM, but we can configure retention)
    const lambdaLogGroups = [
      'mile-quest-auth',
      'mile-quest-users',
      'mile-quest-teams',
      'mile-quest-activities',
      'mile-quest-dashboard',
    ];

    lambdaLogGroups.forEach((functionName) => {
      new logs.LogGroup(this, `${functionName}LogGroup`, {
        logGroupName: `/aws/lambda/${functionName}-${stage}`,
        retention: stage === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });
    });

    // API Gateway Log Group
    new logs.LogGroup(this, 'ApiGatewayLogGroup', {
      logGroupName: `/aws/apigateway/${api.restApiName}`,
      retention: stage === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Store monitoring configuration in Systems Manager
    new ssm.StringParameter(this, 'AlarmTopicArnParameter', {
      parameterName: `/mile-quest/${stage}/monitoring/alarm-topic-arn`,
      stringValue: this.alarmTopic.topicArn,
      description: 'SNS Topic ARN for Mile Quest alarms',
    });

    new ssm.StringParameter(this, 'DashboardUrlParameter', {
      parameterName: `/mile-quest/${stage}/monitoring/dashboard-url`,
      stringValue: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
    });

    // Outputs
    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: this.alarmTopic.topicArn,
      description: 'SNS Topic ARN for alarms',
    });

    new cdk.CfnOutput(this, 'DashboardName', {
      value: this.dashboard.dashboardName,
      description: 'CloudWatch Dashboard Name',
    });

    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
    });
  }
}