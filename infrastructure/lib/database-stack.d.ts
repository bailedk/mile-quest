import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
interface DatabaseStackProps extends cdk.StackProps {
    stage: string;
}
export declare class DatabaseStack extends cdk.Stack {
    readonly database: rds.DatabaseInstance;
    readonly vpc: ec2.Vpc;
    readonly databaseSecurityGroup: ec2.SecurityGroup;
    constructor(scope: Construct, id: string, props: DatabaseStackProps);
}
export {};
