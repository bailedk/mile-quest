"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoringStack = void 0;
const cdk = require("aws-cdk-lib");
const cloudwatch = require("aws-cdk-lib/aws-cloudwatch");
const cloudwatchActions = require("aws-cdk-lib/aws-cloudwatch-actions");
const logs = require("aws-cdk-lib/aws-logs");
const sns = require("aws-cdk-lib/aws-sns");
const snsSubscriptions = require("aws-cdk-lib/aws-sns-subscriptions");
const ssm = require("aws-cdk-lib/aws-ssm");
class MonitoringStack extends cdk.Stack {
    alarmTopic;
    dashboard;
    constructor(scope, id, props) {
        super(scope, id, props);
        const { stage, api, database } = props;
        // SNS Topic for Alerts
        this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
            topicName: `mile-quest-${stage}-alarms`,
            displayName: `Mile Quest ${stage} Alerts`,
        });
        // Email subscription for alerts (replace with actual email)
        this.alarmTopic.addSubscription(new snsSubscriptions.EmailSubscription('devops@mile-quest.com'));
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
            threshold: 10,
            evaluationPeriods: 2,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        const apiLatencyAlarm = new cloudwatch.Alarm(this, 'ApiLatencyAlarm', {
            alarmName: `mile-quest-${stage}-api-latency`,
            alarmDescription: 'API Gateway latency is too high',
            metric: apiLatencyMetric,
            threshold: 2000,
            evaluationPeriods: 3,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        const dbCpuAlarm = new cloudwatch.Alarm(this, 'DbCpuAlarm', {
            alarmName: `mile-quest-${stage}-db-cpu`,
            alarmDescription: 'Database CPU utilization is too high',
            metric: dbCpuMetric,
            threshold: 80,
            evaluationPeriods: 3,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        const dbConnectionsAlarm = new cloudwatch.Alarm(this, 'DbConnectionsAlarm', {
            alarmName: `mile-quest-${stage}-db-connections`,
            alarmDescription: 'Database connections are too high',
            metric: dbConnectionsMetric,
            threshold: 80,
            evaluationPeriods: 2,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        const dbStorageAlarm = new cloudwatch.Alarm(this, 'DbStorageAlarm', {
            alarmName: `mile-quest-${stage}-db-storage`,
            alarmDescription: 'Database free storage is too low',
            metric: dbFreeStorageMetric,
            threshold: 2 * 1024 * 1024 * 1024,
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
            threshold: stage === 'production' ? 150 : 50,
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
        }), new cloudwatch.GraphWidget({
            title: 'API Gateway Latency',
            left: [apiLatencyMetric],
            width: 12,
            height: 6,
        }));
        this.dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'API Gateway Errors',
            left: [apiErrorMetric],
            width: 12,
            height: 6,
        }), new cloudwatch.GraphWidget({
            title: 'Database CPU Utilization',
            left: [dbCpuMetric],
            width: 12,
            height: 6,
        }));
        this.dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'Database Connections',
            left: [dbConnectionsMetric],
            width: 12,
            height: 6,
        }), new cloudwatch.GraphWidget({
            title: 'Database Free Storage',
            left: [dbFreeStorageMetric],
            width: 12,
            height: 6,
        }));
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
exports.MonitoringStack = MonitoringStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9uaXRvcmluZy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1vbml0b3Jpbmctc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBQ25DLHlEQUF5RDtBQUN6RCx3RUFBd0U7QUFDeEUsNkNBQTZDO0FBQzdDLDJDQUEyQztBQUMzQyxzRUFBc0U7QUFHdEUsMkNBQTJDO0FBUzNDLE1BQWEsZUFBZ0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQUM1QixVQUFVLENBQVk7SUFDdEIsU0FBUyxDQUF1QjtJQUVoRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQTJCO1FBQ25FLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxHQUFHLEtBQUssQ0FBQztRQUV2Qyx1QkFBdUI7UUFDdkIsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUNsRCxTQUFTLEVBQUUsY0FBYyxLQUFLLFNBQVM7WUFDdkMsV0FBVyxFQUFFLGNBQWMsS0FBSyxTQUFTO1NBQzFDLENBQUMsQ0FBQztRQUVILDREQUE0RDtRQUM1RCxJQUFJLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FDN0IsSUFBSSxnQkFBZ0IsQ0FBQyxpQkFBaUIsQ0FBQyx1QkFBdUIsQ0FBQyxDQUNoRSxDQUFDO1FBRUYsdUJBQXVCO1FBQ3ZCLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxVQUFVLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxXQUFXLEVBQUU7WUFDM0QsYUFBYSxFQUFFLGNBQWMsS0FBSyxZQUFZO1NBQy9DLENBQUMsQ0FBQztRQUVILHNCQUFzQjtRQUN0QixNQUFNLGNBQWMsR0FBRyxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUM7WUFDM0MsU0FBUyxFQUFFLGdCQUFn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SUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUU7WUFDdEMsS0FBSyxFQUFFLHlEQUF5RCxJQUFJLENBQUMsTUFBTSxvQkFBb0IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxhQUFhLEVBQUU7WUFDN0gsV0FBVyxFQUFFLDBCQUEwQjtTQUN4QyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUF6UUQsMENBeVFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGNsb3Vkd2F0Y2ggZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3Vkd2F0Y2gnO1xuaW1wb3J0ICogYXMgY2xvdWR3YXRjaEFjdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3Vkd2F0Y2gtYWN0aW9ucyc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIHNucyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc25zJztcbmltcG9ydCAqIGFzIHNuc1N1YnNjcmlwdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucy1zdWJzY3JpcHRpb25zJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0ICogYXMgcmRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1yZHMnO1xuaW1wb3J0ICogYXMgc3NtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zc20nO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmludGVyZmFjZSBNb25pdG9yaW5nU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgc3RhZ2U6IHN0cmluZztcbiAgYXBpOiBhcGlnYXRld2F5LlJlc3RBcGk7XG4gIGRhdGFiYXNlOiByZHMuRGF0YWJhc2VJbnN0YW5jZTtcbn1cblxuZXhwb3J0IGNsYXNzIE1vbml0b3JpbmdTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBhbGFybVRvcGljOiBzbnMuVG9waWM7XG4gIHB1YmxpYyByZWFkb25seSBkYXNoYm9hcmQ6IGNsb3Vkd2F0Y2guRGFzaGJvYXJkO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBNb25pdG9yaW5nU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgeyBzdGFnZSwgYXBpLCBkYXRhYmFzZSB9ID0gcHJvcHM7XG5cbiAgICAvLyBTTlMgVG9waWMgZm9yIEFsZXJ0c1xuICAgIHRoaXMuYWxhcm1Ub3BpYyA9IG5ldyBzbnMuVG9waWModGhpcywgJ0FsYXJtVG9waWMnLCB7XG4gICAgICB0b3BpY05hbWU6IGBtaWxlLXF1ZXN0LSR7c3RhZ2V9LWFsYXJtc2AsXG4gICAgICBkaXNwbGF5TmFtZTogYE1pbGUgUXVlc3QgJHtzdGFnZX0gQWxlcnRzYCxcbiAgICB9KTtcblxuICAgIC8vIEVtYWlsIHN1YnNjcmlwdGlvbiBmb3IgYWxlcnRzIChyZXBsYWNlIHdpdGggYWN0dWFsIGVtYWlsKVxuICAgIHRoaXMuYWxhcm1Ub3BpYy5hZGRTdWJzY3JpcHRpb24oXG4gICAgICBuZXcgc25zU3Vic2NyaXB0aW9ucy5FbWFpbFN1YnNjcmlwdGlvbignZGV2b3BzQG1pbGUtcXVlc3QuY29tJylcbiAgICApO1xuXG4gICAgLy8gQ2xvdWRXYXRjaCBEYXNoYm9hcmRcbiAgICB0aGlzLmRhc2hib2FyZCA9IG5ldyBjbG91ZHdhdGNoLkRhc2hib2FyZCh0aGlzLCAnRGFzaGJvYXJkJywge1xuICAgICAgZGFzaGJvYXJkTmFtZTogYG1pbGUtcXVlc3QtJHtzdGFnZX0tZGFzaGJvYXJkYCxcbiAgICB9KTtcblxuICAgIC8vIEFQSSBHYXRld2F5IE1ldHJpY3NcbiAgICBjb25zdCBhcGlFcnJvck1ldHJpYyA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICBuYW1lc3BhY2U6ICdBV1MvQXBpR2F0ZXdheScsXG4gICAgICBtZXRyaWNOYW1lOiAnNFhYRXJyb3InLFxuICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICBBcGlOYW1lOiBhcGkucmVzdEFwaU5hbWUsXG4gICAgICB9LFxuICAgICAgc3RhdGlzdGljOiAnU3VtJyxcbiAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgfSk7XG5cbiAgICBjb25zdCBhcGlMYXRlbmN5TWV0cmljID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcGlHYXRld2F5JyxcbiAgICAgIG1ldHJpY05hbWU6ICdMYXRlbmN5JyxcbiAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgQXBpTmFtZTogYXBpLnJlc3RBcGlOYW1lLFxuICAgICAgfSxcbiAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGFwaUNvdW50TWV0cmljID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgIG5hbWVzcGFjZTogJ0FXUy9BcGlHYXRld2F5JyxcbiAgICAgIG1ldHJpY05hbWU6ICdDb3VudCcsXG4gICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgIEFwaU5hbWU6IGFwaS5yZXN0QXBpTmFtZSxcbiAgICAgIH0sXG4gICAgICBzdGF0aXN0aWM6ICdTdW0nLFxuICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICB9KTtcblxuICAgIC8vIERhdGFiYXNlIE1ldHJpY3NcbiAgICBjb25zdCBkYkNwdU1ldHJpYyA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICBuYW1lc3BhY2U6ICdBV1MvUkRTJyxcbiAgICAgIG1ldHJpY05hbWU6ICdDUFVVdGlsaXphdGlvbicsXG4gICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgIERCSW5zdGFuY2VJZGVudGlmaWVyOiBkYXRhYmFzZS5pbnN0YW5jZUlkZW50aWZpZXIsXG4gICAgICB9LFxuICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZGJDb25uZWN0aW9uc01ldHJpYyA9IG5ldyBjbG91ZHdhdGNoLk1ldHJpYyh7XG4gICAgICBuYW1lc3BhY2U6ICdBV1MvUkRTJyxcbiAgICAgIG1ldHJpY05hbWU6ICdEYXRhYmFzZUNvbm5lY3Rpb25zJyxcbiAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgREJJbnN0YW5jZUlkZW50aWZpZXI6IGRhdGFiYXNlLmluc3RhbmNlSWRlbnRpZmllcixcbiAgICAgIH0sXG4gICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcbiAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgfSk7XG5cbiAgICBjb25zdCBkYkZyZWVTdG9yYWdlTWV0cmljID0gbmV3IGNsb3Vkd2F0Y2guTWV0cmljKHtcbiAgICAgIG5hbWVzcGFjZTogJ0FXUy9SRFMnLFxuICAgICAgbWV0cmljTmFtZTogJ0ZyZWVTdG9yYWdlU3BhY2UnLFxuICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICBEQkluc3RhbmNlSWRlbnRpZmllcjogZGF0YWJhc2UuaW5zdGFuY2VJZGVudGlmaWVyLFxuICAgICAgfSxcbiAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxuICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICB9KTtcblxuICAgIC8vIEFsYXJtc1xuICAgIGNvbnN0IGFwaUVycm9yQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnQXBpRXJyb3JBbGFybScsIHtcbiAgICAgIGFsYXJtTmFtZTogYG1pbGUtcXVlc3QtJHtzdGFnZX0tYXBpLWVycm9yc2AsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnQVBJIEdhdGV3YXkgNFhYIGVycm9yIHJhdGUgaXMgdG9vIGhpZ2gnLFxuICAgICAgbWV0cmljOiBhcGlFcnJvck1ldHJpYyxcbiAgICAgIHRocmVzaG9sZDogMTAsIC8vIDEwIGVycm9ycyBpbiA1IG1pbnV0ZXNcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgfSk7XG5cbiAgICBjb25zdCBhcGlMYXRlbmN5QWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnQXBpTGF0ZW5jeUFsYXJtJywge1xuICAgICAgYWxhcm1OYW1lOiBgbWlsZS1xdWVzdC0ke3N0YWdlfS1hcGktbGF0ZW5jeWAsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnQVBJIEdhdGV3YXkgbGF0ZW5jeSBpcyB0b28gaGlnaCcsXG4gICAgICBtZXRyaWM6IGFwaUxhdGVuY3lNZXRyaWMsXG4gICAgICB0aHJlc2hvbGQ6IDIwMDAsIC8vIDIgc2Vjb25kc1xuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDMsXG4gICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9USFJFU0hPTEQsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGRiQ3B1QWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnRGJDcHVBbGFybScsIHtcbiAgICAgIGFsYXJtTmFtZTogYG1pbGUtcXVlc3QtJHtzdGFnZX0tZGItY3B1YCxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdEYXRhYmFzZSBDUFUgdXRpbGl6YXRpb24gaXMgdG9vIGhpZ2gnLFxuICAgICAgbWV0cmljOiBkYkNwdU1ldHJpYyxcbiAgICAgIHRocmVzaG9sZDogODAsIC8vIDgwJVxuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDMsXG4gICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9USFJFU0hPTEQsXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGRiQ29ubmVjdGlvbnNBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdEYkNvbm5lY3Rpb25zQWxhcm0nLCB7XG4gICAgICBhbGFybU5hbWU6IGBtaWxlLXF1ZXN0LSR7c3RhZ2V9LWRiLWNvbm5lY3Rpb25zYCxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdEYXRhYmFzZSBjb25uZWN0aW9ucyBhcmUgdG9vIGhpZ2gnLFxuICAgICAgbWV0cmljOiBkYkNvbm5lY3Rpb25zTWV0cmljLFxuICAgICAgdGhyZXNob2xkOiA4MCwgLy8gODAgY29ubmVjdGlvbnMgKG91dCBvZiAxMDAgbWF4IGZvciB0My5taWNybylcbiAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxuICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXG4gICAgfSk7XG5cbiAgICBjb25zdCBkYlN0b3JhZ2VBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdEYlN0b3JhZ2VBbGFybScsIHtcbiAgICAgIGFsYXJtTmFtZTogYG1pbGUtcXVlc3QtJHtzdGFnZX0tZGItc3RvcmFnZWAsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnRGF0YWJhc2UgZnJlZSBzdG9yYWdlIGlzIHRvbyBsb3cnLFxuICAgICAgbWV0cmljOiBkYkZyZWVTdG9yYWdlTWV0cmljLFxuICAgICAgdGhyZXNob2xkOiAyICogMTAyNCAqIDEwMjQgKiAxMDI0LCAvLyAyIEdCIGluIGJ5dGVzXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuTEVTU19USEFOX1RIUkVTSE9MRCxcbiAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5CUkVBQ0hJTkcsXG4gICAgfSk7XG5cbiAgICAvLyBCdWRnZXQgQWxhcm0gKENvc3QgTWFuYWdlbWVudClcbiAgICBjb25zdCBidWRnZXRBbGFybSA9IG5ldyBjbG91ZHdhdGNoLkFsYXJtKHRoaXMsICdCdWRnZXRBbGFybScsIHtcbiAgICAgIGFsYXJtTmFtZTogYG1pbGUtcXVlc3QtJHtzdGFnZX0tYnVkZ2V0YCxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdNb250aGx5IEFXUyBzcGVuZCBpcyBhcHByb2FjaGluZyBidWRnZXQgbGltaXQnLFxuICAgICAgbWV0cmljOiBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xuICAgICAgICBuYW1lc3BhY2U6ICdBV1MvQmlsbGluZycsXG4gICAgICAgIG1ldHJpY05hbWU6ICdFc3RpbWF0ZWRDaGFyZ2VzJyxcbiAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgIEN1cnJlbmN5OiAnVVNEJyxcbiAgICAgICAgfSxcbiAgICAgICAgc3RhdGlzdGljOiAnTWF4aW11bScsXG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLmhvdXJzKDYpLFxuICAgICAgfSksXG4gICAgICB0aHJlc2hvbGQ6IHN0YWdlID09PSAncHJvZHVjdGlvbicgPyAxNTAgOiA1MCwgLy8gJDE1MCBmb3IgcHJvZCwgJDUwIGZvciBzdGFnaW5nXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX1RIUkVTSE9MRCxcbiAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGNsb3Vkd2F0Y2guVHJlYXRNaXNzaW5nRGF0YS5OT1RfQlJFQUNISU5HLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIGFsYXJtcyB0byBTTlMgdG9waWNcbiAgICBhcGlFcnJvckFsYXJtLmFkZEFsYXJtQWN0aW9uKG5ldyBjbG91ZHdhdGNoQWN0aW9ucy5TbnNBY3Rpb24odGhpcy5hbGFybVRvcGljKSk7XG4gICAgYXBpTGF0ZW5jeUFsYXJtLmFkZEFsYXJtQWN0aW9uKG5ldyBjbG91ZHdhdGNoQWN0aW9ucy5TbnNBY3Rpb24odGhpcy5hbGFybVRvcGljKSk7XG4gICAgZGJDcHVBbGFybS5hZGRBbGFybUFjdGlvbihuZXcgY2xvdWR3YXRjaEFjdGlvbnMuU25zQWN0aW9uKHRoaXMuYWxhcm1Ub3BpYykpO1xuICAgIGRiQ29ubmVjdGlvbnNBbGFybS5hZGRBbGFybUFjdGlvbihuZXcgY2xvdWR3YXRjaEFjdGlvbnMuU25zQWN0aW9uKHRoaXMuYWxhcm1Ub3BpYykpO1xuICAgIGRiU3RvcmFnZUFsYXJtLmFkZEFsYXJtQWN0aW9uKG5ldyBjbG91ZHdhdGNoQWN0aW9ucy5TbnNBY3Rpb24odGhpcy5hbGFybVRvcGljKSk7XG4gICAgYnVkZ2V0QWxhcm0uYWRkQWxhcm1BY3Rpb24obmV3IGNsb3Vkd2F0Y2hBY3Rpb25zLlNuc0FjdGlvbih0aGlzLmFsYXJtVG9waWMpKTtcblxuICAgIC8vIERhc2hib2FyZCBXaWRnZXRzXG4gICAgdGhpcy5kYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIC8vIEFQSSBNZXRyaWNzIFJvd1xuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogJ0FQSSBHYXRld2F5IFJlcXVlc3RzJyxcbiAgICAgICAgbGVmdDogW2FwaUNvdW50TWV0cmljXSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICB9KSxcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdBUEkgR2F0ZXdheSBMYXRlbmN5JyxcbiAgICAgICAgbGVmdDogW2FwaUxhdGVuY3lNZXRyaWNdLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIHRoaXMuZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnQVBJIEdhdGV3YXkgRXJyb3JzJyxcbiAgICAgICAgbGVmdDogW2FwaUVycm9yTWV0cmljXSxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICB9KSxcbiAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6ICdEYXRhYmFzZSBDUFUgVXRpbGl6YXRpb24nLFxuICAgICAgICBsZWZ0OiBbZGJDcHVNZXRyaWNdLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIHRoaXMuZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnRGF0YWJhc2UgQ29ubmVjdGlvbnMnLFxuICAgICAgICBsZWZ0OiBbZGJDb25uZWN0aW9uc01ldHJpY10sXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgfSksXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XG4gICAgICAgIHRpdGxlOiAnRGF0YWJhc2UgRnJlZSBTdG9yYWdlJyxcbiAgICAgICAgbGVmdDogW2RiRnJlZVN0b3JhZ2VNZXRyaWNdLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIExhbWJkYSBMb2cgR3JvdXBzICh3aWxsIGJlIGNyZWF0ZWQgYnkgU0FNLCBidXQgd2UgY2FuIGNvbmZpZ3VyZSByZXRlbnRpb24pXG4gICAgY29uc3QgbGFtYmRhTG9nR3JvdXBzID0gW1xuICAgICAgJ21pbGUtcXVlc3QtYXV0aCcsXG4gICAgICAnbWlsZS1xdWVzdC11c2VycycsXG4gICAgICAnbWlsZS1xdWVzdC10ZWFtcycsXG4gICAgICAnbWlsZS1xdWVzdC1hY3Rpdml0aWVzJyxcbiAgICAgICdtaWxlLXF1ZXN0LWRhc2hib2FyZCcsXG4gICAgXTtcblxuICAgIGxhbWJkYUxvZ0dyb3Vwcy5mb3JFYWNoKChmdW5jdGlvbk5hbWUpID0+IHtcbiAgICAgIG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsIGAke2Z1bmN0aW9uTmFtZX1Mb2dHcm91cGAsIHtcbiAgICAgICAgbG9nR3JvdXBOYW1lOiBgL2F3cy9sYW1iZGEvJHtmdW5jdGlvbk5hbWV9LSR7c3RhZ2V9YCxcbiAgICAgICAgcmV0ZW50aW9uOiBzdGFnZSA9PT0gJ3Byb2R1Y3Rpb24nID8gbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCA6IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgLy8gQVBJIEdhdGV3YXkgTG9nIEdyb3VwXG4gICAgbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0FwaUdhdGV3YXlMb2dHcm91cCcsIHtcbiAgICAgIGxvZ0dyb3VwTmFtZTogYC9hd3MvYXBpZ2F0ZXdheS8ke2FwaS5yZXN0QXBpTmFtZX1gLFxuICAgICAgcmV0ZW50aW9uOiBzdGFnZSA9PT0gJ3Byb2R1Y3Rpb24nID8gbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCA6IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBTdG9yZSBtb25pdG9yaW5nIGNvbmZpZ3VyYXRpb24gaW4gU3lzdGVtcyBNYW5hZ2VyXG4gICAgbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywgJ0FsYXJtVG9waWNBcm5QYXJhbWV0ZXInLCB7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiBgL21pbGUtcXVlc3QvJHtzdGFnZX0vbW9uaXRvcmluZy9hbGFybS10b3BpYy1hcm5gLFxuICAgICAgc3RyaW5nVmFsdWU6IHRoaXMuYWxhcm1Ub3BpYy50b3BpY0FybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnU05TIFRvcGljIEFSTiBmb3IgTWlsZSBRdWVzdCBhbGFybXMnLFxuICAgIH0pO1xuXG4gICAgbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywgJ0Rhc2hib2FyZFVybFBhcmFtZXRlcicsIHtcbiAgICAgIHBhcmFtZXRlck5hbWU6IGAvbWlsZS1xdWVzdC8ke3N0YWdlfS9tb25pdG9yaW5nL2Rhc2hib2FyZC11cmxgLFxuICAgICAgc3RyaW5nVmFsdWU6IGBodHRwczovL2NvbnNvbGUuYXdzLmFtYXpvbi5jb20vY2xvdWR3YXRjaC9ob21lP3JlZ2lvbj0ke3RoaXMucmVnaW9ufSNkYXNoYm9hcmRzOm5hbWU9JHt0aGlzLmRhc2hib2FyZC5kYXNoYm9hcmROYW1lfWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ0Nsb3VkV2F0Y2ggRGFzaGJvYXJkIFVSTCcsXG4gICAgfSk7XG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FsYXJtVG9waWNBcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hbGFybVRvcGljLnRvcGljQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdTTlMgVG9waWMgQVJOIGZvciBhbGFybXMnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Rhc2hib2FyZE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5kYXNoYm9hcmQuZGFzaGJvYXJkTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRXYXRjaCBEYXNoYm9hcmQgTmFtZScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGFzaGJvYXJkVXJsJywge1xuICAgICAgdmFsdWU6IGBodHRwczovL2NvbnNvbGUuYXdzLmFtYXpvbi5jb20vY2xvdWR3YXRjaC9ob21lP3JlZ2lvbj0ke3RoaXMucmVnaW9ufSNkYXNoYm9hcmRzOm5hbWU9JHt0aGlzLmRhc2hib2FyZC5kYXNoYm9hcmROYW1lfWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ0Nsb3VkV2F0Y2ggRGFzaGJvYXJkIFVSTCcsXG4gICAgfSk7XG4gIH1cbn0iXX0=