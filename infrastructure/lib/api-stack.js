"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiStack = void 0;
const cdk = require("aws-cdk-lib");
const apigateway = require("aws-cdk-lib/aws-apigateway");
const logs = require("aws-cdk-lib/aws-logs");
const ssm = require("aws-cdk-lib/aws-ssm");
class ApiStack extends cdk.Stack {
    api;
    constructor(scope, id, props) {
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
        // Cognito Authorizer
        const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'Authorizer', {
            cognitoUserPools: [userPool],
            authorizerName: `mile-quest-${stage}-authorizer`,
            identitySource: 'method.request.header.Authorization',
        });
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
        usersResource.addResource('achievements');
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
        new ssm.StringParameter(this, 'AuthorizerIdParameter', {
            parameterName: `/mile-quest/${stage}/api/authorizer-id`,
            stringValue: authorizer.authorizerId,
            description: 'Cognito Authorizer ID',
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
        new cdk.CfnOutput(this, 'AuthorizerId', {
            value: authorizer.authorizerId,
            description: 'Cognito Authorizer ID',
        });
    }
}
exports.ApiStack = ApiStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBpLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFtQztBQUNuQyx5REFBeUQ7QUFJekQsNkNBQTZDO0FBQzdDLDJDQUEyQztBQVMzQyxNQUFhLFFBQVMsU0FBUSxHQUFHLENBQUMsS0FBSztJQUNyQixHQUFHLENBQXFCO0lBRXhDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBb0I7UUFDNUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBRTVDLGNBQWM7UUFDZCxJQUFJLENBQUMsR0FBRyxHQUFHLElBQUksVUFBVSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFO1lBQzdDLFdBQVcsRUFBRSxjQUFjLEtBQUssTUFBTTtZQUN0QyxXQUFXLEVBQUUsY0FBYyxLQUFLLE1BQU07WUFDdEMsMkJBQTJCLEVBQUU7Z0JBQzNCLFlBQVksRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLFdBQVc7Z0JBQ3pDLFlBQVksRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLFdBQVc7Z0JBQ3pDLFlBQVksRUFBRSxDQUFDLGNBQWMsRUFBRSxZQUFZLEVBQUUsZUFBZSxFQUFFLFdBQVcsQ0FBQzthQUMzRTtZQUNELGFBQWEsRUFBRTtnQkFDYixTQUFTLEVBQUUsS0FBSztnQkFDaEIsWUFBWSxFQUFFLFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJO2dCQUNoRCxnQkFBZ0IsRUFBRSxJQUFJO2dCQUN0QixjQUFjLEVBQUUsSUFBSTthQUNyQjtTQUNGLENBQUMsQ0FBQztRQUVILHFCQUFxQjtRQUNyQixNQUFNLFVBQVUsR0FBRyxJQUFJLFVBQVUsQ0FBQywwQkFBMEIsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lB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SCxVQUFVO1FBQ1YsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUU7WUFDdEMsS0FBSyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUztZQUN6QixXQUFXLEVBQUUsZ0JBQWdCO1NBQzlCLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ3ZDLEtBQUssRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUc7WUFDbkIsV0FBVyxFQUFFLGlCQUFpQjtTQUMvQixDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUN0QyxLQUFLLEVBQUUsVUFBVSxDQUFDLFlBQVk7WUFDOUIsV0FBVyxFQUFFLHVCQUF1QjtTQUNyQyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUF2SkQsNEJBdUpDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgY29nbml0byBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29nbml0byc7XG5pbXBvcnQgKiBhcyByZHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXJkcyc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIHNzbSBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc3NtJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5pbnRlcmZhY2UgQXBpU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgc3RhZ2U6IHN0cmluZztcbiAgdXNlclBvb2w6IGNvZ25pdG8uVXNlclBvb2w7XG4gIGRhdGFiYXNlOiByZHMuRGF0YWJhc2VJbnN0YW5jZTtcbn1cblxuZXhwb3J0IGNsYXNzIEFwaVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IGFwaTogYXBpZ2F0ZXdheS5SZXN0QXBpO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBBcGlTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCB7IHN0YWdlLCB1c2VyUG9vbCwgZGF0YWJhc2UgfSA9IHByb3BzO1xuXG4gICAgLy8gQVBJIEdhdGV3YXlcbiAgICB0aGlzLmFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgJ0FwaScsIHtcbiAgICAgIHJlc3RBcGlOYW1lOiBgbWlsZS1xdWVzdC0ke3N0YWdlfS1hcGlgLFxuICAgICAgZGVzY3JpcHRpb246IGBNaWxlIFF1ZXN0ICR7c3RhZ2V9IEFQSWAsXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBhcGlnYXRld2F5LkNvcnMuQUxMX09SSUdJTlMsXG4gICAgICAgIGFsbG93TWV0aG9kczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9NRVRIT0RTLFxuICAgICAgICBhbGxvd0hlYWRlcnM6IFsnQ29udGVudC1UeXBlJywgJ1gtQW16LURhdGUnLCAnQXV0aG9yaXphdGlvbicsICdYLUFwaS1LZXknXSxcbiAgICAgIH0sXG4gICAgICBkZXBsb3lPcHRpb25zOiB7XG4gICAgICAgIHN0YWdlTmFtZTogc3RhZ2UsXG4gICAgICAgIGxvZ2dpbmdMZXZlbDogYXBpZ2F0ZXdheS5NZXRob2RMb2dnaW5nTGV2ZWwuSU5GTyxcbiAgICAgICAgZGF0YVRyYWNlRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgbWV0cmljc0VuYWJsZWQ6IHRydWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gQ29nbml0byBBdXRob3JpemVyXG4gICAgY29uc3QgYXV0aG9yaXplciA9IG5ldyBhcGlnYXRld2F5LkNvZ25pdG9Vc2VyUG9vbHNBdXRob3JpemVyKHRoaXMsICdBdXRob3JpemVyJywge1xuICAgICAgY29nbml0b1VzZXJQb29sczogW3VzZXJQb29sXSxcbiAgICAgIGF1dGhvcml6ZXJOYW1lOiBgbWlsZS1xdWVzdC0ke3N0YWdlfS1hdXRob3JpemVyYCxcbiAgICAgIGlkZW50aXR5U291cmNlOiAnbWV0aG9kLnJlcXVlc3QuaGVhZGVyLkF1dGhvcml6YXRpb24nLFxuICAgIH0pO1xuXG4gICAgLy8gTGFtYmRhIGZ1bmN0aW9ucyB3aWxsIGJlIGRlcGxveWVkIHZpYSBTQU1cbiAgICAvLyBIZXJlIHdlIGp1c3QgY3JlYXRlIHRoZSBBUEkgR2F0ZXdheSBzdHJ1Y3R1cmUgdGhhdCBTQU0gd2lsbCBpbnRlZ3JhdGUgd2l0aFxuXG4gICAgLy8gSGVhbHRoIGNoZWNrIGVuZHBvaW50IChubyBhdXRoIHJlcXVpcmVkKVxuICAgIGNvbnN0IGhlYWx0aFJlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgnaGVhbHRoJyk7XG4gICAgaGVhbHRoUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5Nb2NrSW50ZWdyYXRpb24oe1xuICAgICAgaW50ZWdyYXRpb25SZXNwb25zZXM6IFt7XG4gICAgICAgIHN0YXR1c0NvZGU6ICcyMDAnLFxuICAgICAgICByZXNwb25zZVRlbXBsYXRlczoge1xuICAgICAgICAgICdhcHBsaWNhdGlvbi9qc29uJzogJ3tcInN0YXR1c1wiOiBcImhlYWx0aHlcIiwgXCJ0aW1lc3RhbXBcIjogXCIkY29udGV4dC5yZXF1ZXN0VGltZVwifScsXG4gICAgICAgIH0sXG4gICAgICB9XSxcbiAgICAgIHBhc3N0aHJvdWdoQmVoYXZpb3I6IGFwaWdhdGV3YXkuUGFzc3Rocm91Z2hCZWhhdmlvci5ORVZFUixcbiAgICAgIHJlcXVlc3RUZW1wbGF0ZXM6IHtcbiAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiAne1wic3RhdHVzQ29kZVwiOiAyMDB9JyxcbiAgICAgIH0sXG4gICAgfSksIHtcbiAgICAgIG1ldGhvZFJlc3BvbnNlczogW3tcbiAgICAgICAgc3RhdHVzQ29kZTogJzIwMCcsXG4gICAgICAgIHJlc3BvbnNlUGFyYW1ldGVyczoge1xuICAgICAgICAgICdtZXRob2QucmVzcG9uc2UuaGVhZGVyLkFjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICB9XSxcbiAgICB9KTtcblxuICAgIC8vIEFQSSByZXNvdXJjZSBzdHJ1Y3R1cmUgKGVuZHBvaW50cyB3aWxsIGJlIGNyZWF0ZWQgYnkgU0FNKVxuICAgIGNvbnN0IHYxUmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCd2MScpO1xuICAgIFxuICAgIC8vIEF1dGggZW5kcG9pbnRzXG4gICAgY29uc3QgYXV0aFJlc291cmNlID0gdjFSZXNvdXJjZS5hZGRSZXNvdXJjZSgnYXV0aCcpO1xuICAgIGF1dGhSZXNvdXJjZS5hZGRSZXNvdXJjZSgnbG9naW4nKTtcbiAgICBhdXRoUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3JlZ2lzdGVyJyk7XG4gICAgYXV0aFJlc291cmNlLmFkZFJlc291cmNlKCdyZWZyZXNoJyk7XG4gICAgYXV0aFJlc291cmNlLmFkZFJlc291cmNlKCdsb2dvdXQnKTtcblxuICAgIC8vIFVzZXIgZW5kcG9pbnRzXG4gICAgY29uc3QgdXNlcnNSZXNvdXJjZSA9IHYxUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3VzZXJzJyk7XG4gICAgdXNlcnNSZXNvdXJjZS5hZGRSZXNvdXJjZSgncHJvZmlsZScpO1xuICAgIHVzZXJzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3N0YXRzJyk7XG4gICAgdXNlcnNSZXNvdXJjZS5hZGRSZXNvdXJjZSgnYWNoaWV2ZW1lbnRzJyk7XG5cbiAgICAvLyBUZWFtIGVuZHBvaW50c1xuICAgIGNvbnN0IHRlYW1zUmVzb3VyY2UgPSB2MVJlc291cmNlLmFkZFJlc291cmNlKCd0ZWFtcycpO1xuICAgIHRlYW1zUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3t0ZWFtSWR9Jyk7XG4gICAgdGVhbXNSZXNvdXJjZS5hZGRSZXNvdXJjZSgnam9pbicpO1xuICAgIHRlYW1zUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2xlYXZlJyk7XG4gICAgdGVhbXNSZXNvdXJjZS5hZGRSZXNvdXJjZSgnZ29hbHMnKTtcblxuICAgIC8vIEFjdGl2aXR5IGVuZHBvaW50c1xuICAgIGNvbnN0IGFjdGl2aXRpZXNSZXNvdXJjZSA9IHYxUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2FjdGl2aXRpZXMnKTtcbiAgICBhY3Rpdml0aWVzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3thY3Rpdml0eUlkfScpO1xuICAgIGFjdGl2aXRpZXNSZXNvdXJjZS5hZGRSZXNvdXJjZSgnYnVsaycpO1xuXG4gICAgLy8gRGFzaGJvYXJkIGVuZHBvaW50c1xuICAgIGNvbnN0IGRhc2hib2FyZFJlc291cmNlID0gdjFSZXNvdXJjZS5hZGRSZXNvdXJjZSgnZGFzaGJvYXJkJyk7XG4gICAgZGFzaGJvYXJkUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3N1bW1hcnknKTtcbiAgICBkYXNoYm9hcmRSZXNvdXJjZS5hZGRSZXNvdXJjZSgnbGVhZGVyYm9hcmQnKTtcbiAgICBkYXNoYm9hcmRSZXNvdXJjZS5hZGRSZXNvdXJjZSgncHJvZ3Jlc3MnKTtcblxuICAgIC8vIEVuYWJsZSBhY2Nlc3MgbG9nZ2luZ1xuICAgIGNvbnN0IGFjY2Vzc0xvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0FwaUFjY2Vzc0xvZ0dyb3VwJywge1xuICAgICAgbG9nR3JvdXBOYW1lOiBgL2F3cy9hcGlnYXRld2F5LyR7dGhpcy5hcGkucmVzdEFwaU5hbWV9L2FjY2Vzc2AsXG4gICAgICByZXRlbnRpb246IHN0YWdlID09PSAncHJvZHVjdGlvbicgPyBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRIIDogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIEN1c3RvbSBkb21haW4gKG9wdGlvbmFsIC0gY29uZmlndXJlIGxhdGVyKVxuICAgIC8vIGNvbnN0IGNlcnRpZmljYXRlID0gbmV3IGFjbS5DZXJ0aWZpY2F0ZSh0aGlzLCAnQ2VydGlmaWNhdGUnLCB7XG4gICAgLy8gICBkb21haW5OYW1lOiBzdGFnZSA9PT0gJ3Byb2R1Y3Rpb24nID8gJ2FwaS5taWxlLXF1ZXN0LmNvbScgOiAnYXBpLXN0YWdpbmcubWlsZS1xdWVzdC5jb20nLFxuICAgIC8vICAgdmFsaWRhdGlvbjogYWNtLkNlcnRpZmljYXRlVmFsaWRhdGlvbi5mcm9tRG5zKCksXG4gICAgLy8gfSk7XG5cbiAgICAvLyBjb25zdCBkb21haW4gPSBuZXcgYXBpZ2F0ZXdheS5Eb21haW5OYW1lKHRoaXMsICdEb21haW4nLCB7XG4gICAgLy8gICBkb21haW5OYW1lOiBzdGFnZSA9PT0gJ3Byb2R1Y3Rpb24nID8gJ2FwaS5taWxlLXF1ZXN0LmNvbScgOiAnYXBpLXN0YWdpbmcubWlsZS1xdWVzdC5jb20nLFxuICAgIC8vICAgY2VydGlmaWNhdGU6IGNlcnRpZmljYXRlLFxuICAgIC8vIH0pO1xuXG4gICAgLy8gbmV3IHJvdXRlNTMuQVJlY29yZCh0aGlzLCAnRG9tYWluUmVjb3JkJywge1xuICAgIC8vICAgem9uZTogcm91dGU1My5Ib3N0ZWRab25lLmZyb21Mb29rdXAodGhpcywgJ1pvbmUnLCB7XG4gICAgLy8gICAgIGRvbWFpbk5hbWU6ICdtaWxlLXF1ZXN0LmNvbScsXG4gICAgLy8gICB9KSxcbiAgICAvLyAgIHRhcmdldDogcm91dGU1My5SZWNvcmRUYXJnZXQuZnJvbUFsaWFzKG5ldyByb3V0ZTUzVGFyZ2V0cy5BcGlHYXRld2F5RG9tYWluKGRvbWFpbikpLFxuICAgIC8vIH0pO1xuXG4gICAgLy8gU3RvcmUgQVBJIGNvbmZpZ3VyYXRpb24gaW4gU3lzdGVtcyBNYW5hZ2VyXG4gICAgbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywgJ0FwaUdhdGV3YXlJZFBhcmFtZXRlcicsIHtcbiAgICAgIHBhcmFtZXRlck5hbWU6IGAvbWlsZS1xdWVzdC8ke3N0YWdlfS9hcGkvZ2F0ZXdheS1pZGAsXG4gICAgICBzdHJpbmdWYWx1ZTogdGhpcy5hcGkucmVzdEFwaUlkLFxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgR2F0ZXdheSBJRCcsXG4gICAgfSk7XG5cbiAgICBuZXcgc3NtLlN0cmluZ1BhcmFtZXRlcih0aGlzLCAnQXBpR2F0ZXdheVVybFBhcmFtZXRlcicsIHtcbiAgICAgIHBhcmFtZXRlck5hbWU6IGAvbWlsZS1xdWVzdC8ke3N0YWdlfS9hcGkvZ2F0ZXdheS11cmxgLFxuICAgICAgc3RyaW5nVmFsdWU6IHRoaXMuYXBpLnVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIEdhdGV3YXkgVVJMJyxcbiAgICB9KTtcblxuICAgIG5ldyBzc20uU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdBdXRob3JpemVySWRQYXJhbWV0ZXInLCB7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiBgL21pbGUtcXVlc3QvJHtzdGFnZX0vYXBpL2F1dGhvcml6ZXItaWRgLFxuICAgICAgc3RyaW5nVmFsdWU6IGF1dGhvcml6ZXIuYXV0aG9yaXplcklkLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIEF1dGhvcml6ZXIgSUQnLFxuICAgIH0pO1xuXG4gICAgLy8gT3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlHYXRld2F5SWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hcGkucmVzdEFwaUlkLFxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgR2F0ZXdheSBJRCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpR2F0ZXdheVVybCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmFwaS51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBHYXRld2F5IFVSTCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXV0aG9yaXplcklkJywge1xuICAgICAgdmFsdWU6IGF1dGhvcml6ZXIuYXV0aG9yaXplcklkLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIEF1dGhvcml6ZXIgSUQnLFxuICAgIH0pO1xuICB9XG59Il19