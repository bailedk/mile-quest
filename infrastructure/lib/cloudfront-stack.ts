import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

interface CloudFrontStackProps extends cdk.StackProps {
  stage: string;
}

export class CloudFrontStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: CloudFrontStackProps) {
    super(scope, id, props);

    const { stage } = props;

    // Create CloudFront distribution optimized for map tiles and assets
    this.distribution = new cloudfront.Distribution(this, 'MapAssetsDistribution', {
      comment: `Mile Quest ${stage} - Map Assets CDN`,
      defaultRootObject: undefined, // No default root object for API proxy
      
      // Map tile caching behavior (primary)
      defaultBehavior: {
        origin: new origins.HttpOrigin('api.mapbox.com', {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          customHeaders: {
            // Pass through authorization header for Mapbox API
            'User-Agent': 'Mile-Quest-App/1.0',
          },
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        compress: true,
        
        // Optimized caching for map tiles
        cachePolicy: new cloudfront.CachePolicy(this, 'MapTileCachePolicy', {
          cachePolicyName: `mile-quest-${stage}-map-tiles`,
          comment: 'Optimized caching for Mapbox map tiles',
          defaultTtl: cdk.Duration.days(30), // Map tiles don't change often
          maxTtl: cdk.Duration.days(365),
          minTtl: cdk.Duration.minutes(1),
          
          // Cache based on query parameters (zoom, x, y coordinates)
          queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
          headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
            'User-Agent',
          ),
          cookieBehavior: cloudfront.CacheCookieBehavior.none(),
          enableAcceptEncodingGzip: true,
          enableAcceptEncodingBrotli: true,
        }),

        // Origin request policy to forward necessary headers
        originRequestPolicy: new cloudfront.OriginRequestPolicy(this, 'MapTileOriginPolicy', {
          originRequestPolicyName: `mile-quest-${stage}-map-origin`,
          comment: 'Forward necessary headers to Mapbox API',
          queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
          headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
            'User-Agent',
            'Accept',
            'Origin',
            'Referer',
          ),
          cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
        }),

        // Response headers policy for CORS
        responseHeadersPolicy: new cloudfront.ResponseHeadersPolicy(this, 'MapTileResponseHeaders', {
          responseHeadersPolicyName: `mile-quest-${stage}-map-cors`,
          comment: 'CORS headers for map tile requests',
          
          // CORS configuration  
          corsBehavior: {
            accessControlAllowCredentials: false,
            accessControlAllowHeaders: ['*'],
            accessControlAllowMethods: ['GET', 'HEAD', 'OPTIONS'],
            accessControlAllowOrigins: this.getAllowedOrigins(stage),
            accessControlMaxAge: cdk.Duration.hours(24),
            originOverride: false,
          },

          // Security headers
          securityHeadersBehavior: {
            contentTypeOptions: { override: true },
            frameOptions: {
              frameOption: cloudfront.HeadersFrameOption.DENY,
              override: true,
            },
            referrerPolicy: {
              referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
              override: true,
            },
            strictTransportSecurity: {
              accessControlMaxAge: cdk.Duration.seconds(31536000),
              includeSubdomains: true,
              preload: true,
              override: true,
            },
          },

          // Custom headers for performance
          customHeadersBehavior: {
            customHeaders: [
              {
                header: 'Cache-Control',
                value: 'public, max-age=2592000, immutable', // 30 days for tiles
                override: false,
              },
              {
                header: 'X-Content-Type-Options',
                value: 'nosniff',
                override: true,
              },
            ],
          },
        }),
      },

      // Additional behaviors for different map assets
      additionalBehaviors: {
        // Styles and sprites (less cacheable)
        '/styles/*': {
          origin: new origins.HttpOrigin('api.mapbox.com', {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: new cloudfront.CachePolicy(this, 'MapStylesCachePolicy', {
            cachePolicyName: `mile-quest-${stage}-map-styles`,
            comment: 'Caching for map styles and sprites',
            defaultTtl: cdk.Duration.hours(24),
            maxTtl: cdk.Duration.days(7),
            minTtl: cdk.Duration.minutes(5),
            queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
            headerBehavior: cloudfront.CacheHeaderBehavior.none(),
          }),
        },

        // Fonts (highly cacheable)
        '/fonts/*': {
          origin: new origins.HttpOrigin('api.mapbox.com', {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },

        // Geocoding API (not cacheable)
        '/geocoding/*': {
          origin: new origins.HttpOrigin('api.mapbox.com', {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },

        // Directions API (not cacheable)
        '/directions/*': {
          origin: new origins.HttpOrigin('api.mapbox.com', {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },
      },

      // Configure for optimal global performance
      priceClass: stage === 'production' 
        ? cloudfront.PriceClass.PRICE_CLASS_ALL 
        : cloudfront.PriceClass.PRICE_CLASS_100,
      
      // Enable HTTP/2 and compression
      httpVersion: cloudfront.HttpVersion.HTTP2,
      enableIpv6: true,

      // Error handling
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 404,
          responsePagePath: '/error.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 403,
          responsePagePath: '/error.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],

      // Enable logging for production
      enableLogging: stage === 'production',
      logBucket: stage === 'production' ? undefined : undefined, // TODO: Create S3 bucket for logs if needed
      logFilePrefix: `cloudfront-logs/${stage}/`,
      logIncludesCookies: false,
    });

    // Store CloudFront domain in Parameter Store
    new ssm.StringParameter(this, 'CloudFrontDomainParameter', {
      parameterName: `/mile-quest/${stage}/cloudfront/domain-name`,
      stringValue: this.distribution.distributionDomainName,
      description: 'CloudFront distribution domain name for map assets',
    });

    new ssm.StringParameter(this, 'CloudFrontDistributionIdParameter', {
      parameterName: `/mile-quest/${stage}/cloudfront/distribution-id`,
      stringValue: this.distribution.distributionId,
      description: 'CloudFront distribution ID for cache invalidation',
    });

    // Outputs
    new cdk.CfnOutput(this, 'CloudFrontDomainName', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront distribution domain name',
      exportName: `${stage}-CloudFrontDomain`,
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront distribution ID',
      exportName: `${stage}-CloudFrontDistributionId`,
    });
  }

  /**
   * Get allowed origins based on environment
   */
  private getAllowedOrigins(stage: string): string[] {
    switch (stage) {
      case 'production':
        return [
          'https://milequest.app',
          'https://www.milequest.app',
        ];
      case 'staging':
        return [
          'https://staging.milequest.app',
        ];
      default:
        return [
          'http://localhost:3000',
          'https://dev.milequest.app',
        ];
    }
  }
}