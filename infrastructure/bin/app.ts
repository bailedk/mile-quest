#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CognitoStack } from '../lib/cognito-stack';
import { DatabaseStack } from '../lib/database-stack';
import { ApiStack } from '../lib/api-stack';
import { MonitoringStack } from '../lib/monitoring-stack';
import { ExternalServicesStack } from '../lib/external-services-stack';
import { CloudFrontStack } from '../lib/cloudfront-stack';

const app = new cdk.App();

// Get environment variables
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

const stage = app.node.tryGetContext('stage') || 'staging';
const stackPrefix = `MileQuest-${stage}`;

// Core infrastructure stacks
const cognitoStack = new CognitoStack(app, `${stackPrefix}-Cognito`, {
  env,
  stage,
});

const databaseStack = new DatabaseStack(app, `${stackPrefix}-Database`, {
  env,
  stage,
});

// External services configuration (Mapbox, Pusher, SES)
const externalServicesStack = new ExternalServicesStack(app, `${stackPrefix}-ExternalServices`, {
  env,
  stage,
});

const apiStack = new ApiStack(app, `${stackPrefix}-Api`, {
  env,
  stage,
  userPool: cognitoStack.userPool,
  database: databaseStack.database,
});

// CloudFront for map assets and CDN
const cloudFrontStack = new CloudFrontStack(app, `${stackPrefix}-CloudFront`, {
  env,
  stage,
});

const monitoringStack = new MonitoringStack(app, `${stackPrefix}-Monitoring`, {
  env,
  stage,
  api: apiStack.api,
  database: databaseStack.database,
});

// Add dependencies
apiStack.addDependency(cognitoStack);
apiStack.addDependency(databaseStack);
cloudFrontStack.addDependency(externalServicesStack);
monitoringStack.addDependency(apiStack);
monitoringStack.addDependency(databaseStack);
monitoringStack.addDependency(cloudFrontStack);

// Tags
cdk.Tags.of(app).add('Project', 'MileQuest');
cdk.Tags.of(app).add('Environment', stage);
cdk.Tags.of(app).add('ManagedBy', 'CDK');