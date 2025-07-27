import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

interface ApiStackProps extends cdk.StackProps {
  stage: string;
  userPool: cognito.UserPool;
  database: rds.DatabaseInstance;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { stage, userPool, database } = props;

    // API Gateway
    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: `mile-quest-${stage}-api`,
      description: `Mile Quest ${stage} API`,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
      deployOptions: {
        stageName: stage,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
    });

    // Cognito Authorizer will be created by SAM template
    // Store user pool info for SAM to reference

    // Lambda functions will be deployed via SAM
    // Here we just create the API Gateway structure that SAM will integrate with

    // Health check endpoint (no auth required)
    const healthResource = this.api.root.addResource('health');
    healthResource.addMethod('GET', new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: '200',
        responseTemplates: {
          'application/json': '{"status": "healthy", "timestamp": "$context.requestTime"}',
        },
      }],
      passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
      requestTemplates: {
        'application/json': '{"statusCode": 200}',
      },
    }), {
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true,
        },
      }],
    });

    // API resource structure (endpoints will be created by SAM)
    const v1Resource = this.api.root.addResource('v1');
    
    // Auth endpoints
    const authResource = v1Resource.addResource('auth');
    authResource.addResource('login');
    authResource.addResource('register');
    authResource.addResource('refresh');
    authResource.addResource('logout');

    // User endpoints
    const usersResource = v1Resource.addResource('users');
    usersResource.addResource('profile');
    usersResource.addResource('stats');

    // Team endpoints
    const teamsResource = v1Resource.addResource('teams');
    teamsResource.addResource('{teamId}');
    teamsResource.addResource('join');
    teamsResource.addResource('leave');
    teamsResource.addResource('goals');

    // Activity endpoints
    const activitiesResource = v1Resource.addResource('activities');
    activitiesResource.addResource('{activityId}');
    activitiesResource.addResource('bulk');

    // Dashboard endpoints
    const dashboardResource = v1Resource.addResource('dashboard');
    dashboardResource.addResource('summary');
    dashboardResource.addResource('leaderboard');
    dashboardResource.addResource('progress');

    // Enable access logging
    const accessLogGroup = new logs.LogGroup(this, 'ApiAccessLogGroup', {
      logGroupName: `/aws/apigateway/${this.api.restApiName}/access`,
      retention: stage === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Custom domain (optional - configure later)
    // const certificate = new acm.Certificate(this, 'Certificate', {
    //   domainName: stage === 'production' ? 'api.mile-quest.com' : 'api-staging.mile-quest.com',
    //   validation: acm.CertificateValidation.fromDns(),
    // });

    // const domain = new apigateway.DomainName(this, 'Domain', {
    //   domainName: stage === 'production' ? 'api.mile-quest.com' : 'api-staging.mile-quest.com',
    //   certificate: certificate,
    // });

    // new route53.ARecord(this, 'DomainRecord', {
    //   zone: route53.HostedZone.fromLookup(this, 'Zone', {
    //     domainName: 'mile-quest.com',
    //   }),
    //   target: route53.RecordTarget.fromAlias(new route53Targets.ApiGatewayDomain(domain)),
    // });

    // Store API configuration in Systems Manager
    new ssm.StringParameter(this, 'ApiGatewayIdParameter', {
      parameterName: `/mile-quest/${stage}/api/gateway-id`,
      stringValue: this.api.restApiId,
      description: 'API Gateway ID',
    });

    new ssm.StringParameter(this, 'ApiGatewayUrlParameter', {
      parameterName: `/mile-quest/${stage}/api/gateway-url`,
      stringValue: this.api.url,
      description: 'API Gateway URL',
    });

    new ssm.StringParameter(this, 'UserPoolArnParameter', {
      parameterName: `/mile-quest/${stage}/api/user-pool-arn`,
      stringValue: userPool.userPoolArn,
      description: 'Cognito User Pool ARN for API authorization',
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiGatewayId', {
      value: this.api.restApiId,
      description: 'API Gateway ID',
    });

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
    });
  }
}