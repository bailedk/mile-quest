import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';
interface MonitoringStackProps extends cdk.StackProps {
    stage: string;
    api: apigateway.RestApi;
    database: rds.DatabaseInstance;
}
export declare class MonitoringStack extends cdk.Stack {
    readonly alarmTopic: sns.Topic;
    readonly dashboard: cloudwatch.Dashboard;
    constructor(scope: Construct, id: string, props: MonitoringStackProps);
}
export {};
