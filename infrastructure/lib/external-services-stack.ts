import * as cdk from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

interface ExternalServicesStackProps extends cdk.StackProps {
  stage: string;
}

export class ExternalServicesStack extends cdk.Stack {
  public readonly mapboxSecrets: secretsmanager.Secret;
  public readonly pusherSecrets: secretsmanager.Secret;
  public readonly sesConfiguration: ssm.StringParameter;

  constructor(scope: Construct, id: string, props: ExternalServicesStackProps) {
    super(scope, id, props);

    const { stage } = props;

    // Mapbox configuration using AWS Secrets Manager for sensitive tokens
    this.mapboxSecrets = new secretsmanager.Secret(this, 'MapboxSecrets', {
      secretName: `/mile-quest/${stage}/mapbox/tokens`,
      description: `Mapbox API tokens for ${stage} environment`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          publicToken: '',
          secretToken: '',
        }),
        generateStringKey: 'placeholder',
        excludeCharacters: ' %+~`#$&*()|[]{}:;<>?!\'/@"\\',
      },
    });

    // Mapbox configuration parameters (non-sensitive)
    new ssm.StringParameter(this, 'MapboxConfigParameter', {
      parameterName: `/mile-quest/${stage}/mapbox/config`,
      stringValue: JSON.stringify({
        defaultStyle: 'mapbox://styles/mapbox/outdoors-v12',
        provider: 'mapbox',
        apiBaseUrl: 'https://api.mapbox.com',
        rateLimits: {
          requestsPerMinute: 600,
          requestsPerDay: 100000,
        },
        allowedDomains: this.getAllowedDomains(stage),
        scopes: [
          'styles:read',
          'tiles:read',
          'geocoding',
          'directions',
          'optimization'
        ]
      }),
      description: 'Mapbox service configuration',
    });

    // Environment-specific Mapbox settings
    new ssm.StringParameter(this, 'MapboxEnvironmentParameter', {
      parameterName: `/mile-quest/${stage}/mapbox/environment`,
      stringValue: JSON.stringify({
        stage: stage,
        enableCaching: stage !== 'development',
        enableAnalytics: stage === 'production',
        debugMode: stage === 'development',
        maxRetries: stage === 'production' ? 3 : 1,
        timeout: stage === 'production' ? 10000 : 5000,
      }),
      description: `Mapbox environment-specific settings for ${stage}`,
    });

    // Pusher configuration (WebSocket service)
    this.pusherSecrets = new secretsmanager.Secret(this, 'PusherSecrets', {
      secretName: `/mile-quest/${stage}/pusher/credentials`,
      description: `Pusher WebSocket credentials for ${stage} environment`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          appId: '',
          appKey: '',
          appSecret: '',
          cluster: 'us2',
        }),
        generateStringKey: 'placeholder',
        excludeCharacters: ' %+~`#$&*()|[]{}:;<>?!\'/@"\\',
      },
    });

    // Pusher configuration
    new ssm.StringParameter(this, 'PusherConfigParameter', {
      parameterName: `/mile-quest/${stage}/pusher/config`,
      stringValue: JSON.stringify({
        cluster: 'us2',
        encrypted: true,
        enableLogging: stage === 'development',
        enableStats: stage === 'production',
        maxConnections: stage === 'production' ? 1000 : 100,
        allowedOrigins: this.getAllowedOrigins(stage),
      }),
      description: 'Pusher WebSocket configuration',
    });

    // SES (Email service) configuration
    this.sesConfiguration = new ssm.StringParameter(this, 'SESConfigParameter', {
      parameterName: `/mile-quest/${stage}/ses/config`,
      stringValue: JSON.stringify({
        region: 'us-east-1',
        fromEmail: stage === 'production' 
          ? 'noreply@milequest.app' 
          : `noreply-${stage}@milequest.app`,
        replyToEmail: stage === 'production'
          ? 'support@milequest.app'
          : `support-${stage}@milequest.app`,
        configurationSet: `mile-quest-${stage}`,
        enableBounceTracking: true,
        enableComplaintTracking: true,
        enableOpenTracking: stage === 'production',
        enableClickTracking: stage === 'production',
        defaultTemplateName: 'mile-quest-default',
        rateLimits: {
          sendingQuota: stage === 'production' ? 10000 : 200,
          sendingRate: stage === 'production' ? 14 : 1, // emails per second
        },
      }),
      description: 'SES email service configuration',
    });

    // Analytics and monitoring configuration
    new ssm.StringParameter(this, 'AnalyticsConfigParameter', {
      parameterName: `/mile-quest/${stage}/analytics/config`,
      stringValue: JSON.stringify({
        enableGoogleAnalytics: stage === 'production',
        enableMixpanel: stage === 'production',
        enableSentry: true,
        sentryEnvironment: stage,
        enablePerformanceMonitoring: stage === 'production',
        sampleRate: stage === 'production' ? 0.1 : 1.0,
        enableErrorReporting: true,
        enableUserTracking: stage === 'production',
        enableMapAnalytics: true,
        mapAnalyticsConfig: {
          trackRouteCreation: true,
          trackGeocoding: true,
          trackMapInteractions: stage === 'production',
          aggregateUsageStats: stage === 'production',
        },
      }),
      description: 'Analytics and monitoring configuration',
    });

    // Lambda environment variables for external services
    new ssm.StringParameter(this, 'LambdaEnvironmentParameter', {
      parameterName: `/mile-quest/${stage}/lambda/environment`,
      stringValue: JSON.stringify({
        NODE_ENV: stage === 'production' ? 'production' : 'development',
        STAGE: stage,
        AWS_REGION: 'us-east-1',
        
        // External service parameter paths
        MAPBOX_SECRETS_ARN: this.mapboxSecrets.secretArn,
        MAPBOX_CONFIG_PARAM: `/mile-quest/${stage}/mapbox/config`,
        MAPBOX_ENV_PARAM: `/mile-quest/${stage}/mapbox/environment`,
        
        PUSHER_SECRETS_ARN: this.pusherSecrets.secretArn,
        PUSHER_CONFIG_PARAM: `/mile-quest/${stage}/pusher/config`,
        
        SES_CONFIG_PARAM: `/mile-quest/${stage}/ses/config`,
        ANALYTICS_CONFIG_PARAM: `/mile-quest/${stage}/analytics/config`,
        
        // Caching and performance
        ENABLE_CACHING: stage !== 'development' ? 'true' : 'false',
        CACHE_TTL: stage === 'production' ? '3600' : '300',
        ENABLE_COMPRESSION: 'true',
        
        // Rate limiting
        ENABLE_RATE_LIMITING: 'true',
        RATE_LIMIT_WINDOW: '60000', // 1 minute
        RATE_LIMIT_MAX_REQUESTS: stage === 'production' ? '100' : '1000',
        
        // Error handling
        ENABLE_ERROR_REPORTING: 'true',
        ERROR_SAMPLE_RATE: stage === 'production' ? '0.1' : '1.0',
        
        // Feature flags
        ENABLE_MAP_FEATURES: 'true',
        ENABLE_REALTIME_FEATURES: 'true',
        ENABLE_NOTIFICATIONS: stage !== 'development' ? 'true' : 'false',
      }),
      description: 'Lambda environment variables for external services',
    });

    // CloudFront origins for external services
    new ssm.StringParameter(this, 'CloudFrontOriginsParameter', {
      parameterName: `/mile-quest/${stage}/cloudfront/origins`,
      stringValue: JSON.stringify({
        mapbox: {
          domainName: 'api.mapbox.com',
          originPath: '',
          protocolPolicy: 'https-only',
          customHeaders: {
            'User-Agent': 'Mile-Quest-App/1.0',
          },
        },
        tiles: {
          domainName: 'api.mapbox.com',
          originPath: '',
          protocolPolicy: 'https-only',
          cacheBehaviors: {
            '/styles/*': {
              cachePolicyName: 'Managed-CachingOptimizedForUncompressedObjects',
              originRequestPolicyName: 'Managed-CORS-S3Origin',
              viewerProtocolPolicy: 'redirect-to-https',
            },
            '/fonts/*': {
              cachePolicyName: 'Managed-CachingOptimized',
              viewerProtocolPolicy: 'redirect-to-https',
            },
            '/v4/*': {
              cachePolicyName: 'mile-quest-map-tiles',
              viewerProtocolPolicy: 'redirect-to-https',
            },
          },
        },
        api: {
          domainName: stage === 'production' ? 'api.milequest.app' : `api-${stage}.milequest.app`,
          originPath: '',
          protocolPolicy: 'https-only',
        },
      }),
      description: 'CloudFront origin configurations for external services',
    });

    // Output parameter ARNs for other stacks to reference
    new cdk.CfnOutput(this, 'MapboxSecretsArn', {
      value: this.mapboxSecrets.secretArn,
      description: 'Mapbox secrets ARN',
      exportName: `${stage}-MapboxSecretsArn`,
    });

    new cdk.CfnOutput(this, 'PusherSecretsArn', {
      value: this.pusherSecrets.secretArn,
      description: 'Pusher secrets ARN',
      exportName: `${stage}-PusherSecretsArn`,
    });

    new cdk.CfnOutput(this, 'MapboxConfigParam', {
      value: `/mile-quest/${stage}/mapbox/config`,
      description: 'Mapbox configuration parameter name',
      exportName: `${stage}-MapboxConfigParam`,
    });

    new cdk.CfnOutput(this, 'LambdaEnvironmentParam', {
      value: `/mile-quest/${stage}/lambda/environment`,
      description: 'Lambda environment variables parameter name',
      exportName: `${stage}-LambdaEnvironmentParam`,
    });
  }

  /**
   * Get allowed domains based on environment
   */
  private getAllowedDomains(stage: string): string[] {
    switch (stage) {
      case 'production':
        return [
          'https://milequest.app',
          'https://www.milequest.app',
          'https://api.milequest.app',
        ];
      case 'staging':
        return [
          'https://staging.milequest.app',
          'https://api-staging.milequest.app',
        ];
      default:
        return [
          'http://localhost:3000',
          'http://localhost:3001',
          'https://dev.milequest.app',
          'https://api-dev.milequest.app',
        ];
    }
  }

  /**
   * Get allowed origins for CORS
   */
  private getAllowedOrigins(stage: string): string[] {
    return this.getAllowedDomains(stage);
  }
}