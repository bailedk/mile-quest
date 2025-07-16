import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

interface CognitoStackProps extends cdk.StackProps {
  stage: string;
}

export class CognitoStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: CognitoStackProps) {
    super(scope, id, props);

    const { stage } = props;

    // User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `mile-quest-${stage}`,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: true,
          mutable: true,
        },
        familyName: {
          required: true,
          mutable: true,
        },
      },
      customAttributes: {
        'preferred_units': new cognito.StringAttribute({
          minLen: 2,
          maxLen: 10,
          mutable: true,
        }),
        'timezone': new cognito.StringAttribute({
          minLen: 3,
          maxLen: 50,
          mutable: true,
        }),
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: stage === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // User Pool Client
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: `mile-quest-${stage}-client`,
      authFlows: {
        userSrp: true,
        userPassword: false,
        adminUserPassword: false,
      },
      generateSecret: false, // For web applications
      preventUserExistenceErrors: true,
      refreshTokenValidity: cdk.Duration.days(30),
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      enableTokenRevocation: true,
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
    });

    // Google Identity Provider (optional - configure later)
    // const googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleProvider', {
    //   userPool: this.userPool,
    //   clientId: 'google-client-id',
    //   clientSecret: 'google-client-secret',
    //   scopes: ['profile', 'email', 'openid'],
    //   attributeMapping: {
    //     email: cognito.ProviderAttribute.GOOGLE_EMAIL,
    //     givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
    //     familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
    //   },
    // });

    // Store parameters in Systems Manager
    new ssm.StringParameter(this, 'UserPoolIdParameter', {
      parameterName: `/mile-quest/${stage}/cognito/user-pool-id`,
      stringValue: this.userPool.userPoolId,
      description: 'Mile Quest User Pool ID',
    });

    new ssm.StringParameter(this, 'UserPoolClientIdParameter', {
      parameterName: `/mile-quest/${stage}/cognito/user-pool-client-id`,
      stringValue: this.userPoolClient.userPoolClientId,
      description: 'Mile Quest User Pool Client ID',
    });

    new ssm.StringParameter(this, 'UserPoolArnParameter', {
      parameterName: `/mile-quest/${stage}/cognito/user-pool-arn`,
      stringValue: this.userPool.userPoolArn,
      description: 'Mile Quest User Pool ARN',
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
    });
  }
}