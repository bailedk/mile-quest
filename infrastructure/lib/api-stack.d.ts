import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';
interface ApiStackProps extends cdk.StackProps {
    stage: string;
    userPool: cognito.UserPool;
    database: rds.DatabaseInstance;
}
export declare class ApiStack extends cdk.Stack {
    readonly api: apigateway.RestApi;
    constructor(scope: Construct, id: string, props: ApiStackProps);
}
export {};
