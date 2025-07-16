"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CognitoStack = void 0;
const cdk = require("aws-cdk-lib");
const cognito = require("aws-cdk-lib/aws-cognito");
const ssm = require("aws-cdk-lib/aws-ssm");
class CognitoStack extends cdk.Stack {
    userPool;
    userPoolClient;
    constructor(scope, id, props) {
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
            generateSecret: false,
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
exports.CognitoStack = CognitoStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29nbml0by1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNvZ25pdG8tc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBQ25DLG1EQUFtRDtBQUNuRCwyQ0FBMkM7QUFPM0MsTUFBYSxZQUFhLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDekIsUUFBUSxDQUFtQjtJQUMzQixjQUFjLENBQXlCO0lBRXZELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBd0I7UUFDaEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLEtBQUssRUFBRSxHQUFHLEtBQUssQ0FBQztRQUV4QixZQUFZO1FBQ1osSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRTtZQUNyRCxZQUFZLEVBQUUsY0FBYyxLQUFLLEVBQUU7WUFDbkMsaUJBQWlCLEVBQUUsSUFBSTtZQUN2QixhQUFhLEVBQUU7Z0JBQ2IsS0FBSyxFQUFFLElBQUk7YUFDWjtZQUNELFVBQVUsRUFBRTtnQkFDVixLQUFLLEVBQUUsSUFBSTthQUNaO1lBQ0Qsa0JBQWtCLEVBQUU7Z0JBQ2xCLEtBQUssRUFBRTtvQkFDTCxRQUFRLEVBQUUsSUFBSTtvQkFDZCxPQUFPLEVBQUUsSUFBSTtpQkFDZDtnQkFDRCxTQUFTLEVBQUU7b0JBQ1QsUUFBUSxFQUFFLElBQUk7b0JBQ2QsT0FBTyxFQUFFLElBQUk7aUJBQ2Q7Z0JBQ0QsVUFBVSxFQUFFO29CQUNWLFFBQVEsRUFBRSxJQUFJO29CQUNkLE9BQU8sRUFBRSxJQUFJO2lCQUNkO2FBQ0Y7WUFDRCxnQkFBZ0IsRUFBRTtnQkFDaEIsaUJBQWlCLEVBQUUsSUFBSSxPQUFPLENBQUMsZUFBZSxDQUFDO29CQUM3QyxNQUFNLEVBQUUsQ0FBQztvQkFDVCxNQUFNLEVBQUUsRUFBRTtvQkFDVixPQUFPLEVB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LENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUMxQyxLQUFLLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxnQkFBZ0I7WUFDM0MsV0FBVyxFQUFFLDZCQUE2QjtTQUMzQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUNyQyxLQUFLLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXO1lBQ2hDLFdBQVcsRUFBRSx1QkFBdUI7U0FDckMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBMUhELG9DQTBIQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcbmltcG9ydCAqIGFzIHNzbSBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc3NtJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5pbnRlcmZhY2UgQ29nbml0b1N0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIHN0YWdlOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBDb2duaXRvU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgdXNlclBvb2w6IGNvZ25pdG8uVXNlclBvb2w7XG4gIHB1YmxpYyByZWFkb25seSB1c2VyUG9vbENsaWVudDogY29nbml0by5Vc2VyUG9vbENsaWVudDtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQ29nbml0b1N0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgc3RhZ2UgfSA9IHByb3BzO1xuXG4gICAgLy8gVXNlciBQb29sXG4gICAgdGhpcy51c2VyUG9vbCA9IG5ldyBjb2duaXRvLlVzZXJQb29sKHRoaXMsICdVc2VyUG9vbCcsIHtcbiAgICAgIHVzZXJQb29sTmFtZTogYG1pbGUtcXVlc3QtJHtzdGFnZX1gLFxuICAgICAgc2VsZlNpZ25VcEVuYWJsZWQ6IHRydWUsXG4gICAgICBzaWduSW5BbGlhc2VzOiB7XG4gICAgICAgIGVtYWlsOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIGF1dG9WZXJpZnk6IHtcbiAgICAgICAgZW1haWw6IHRydWUsXG4gICAgICB9LFxuICAgICAgc3RhbmRhcmRBdHRyaWJ1dGVzOiB7XG4gICAgICAgIGVtYWlsOiB7XG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgZ2l2ZW5OYW1lOiB7XG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgZmFtaWx5TmFtZToge1xuICAgICAgICAgIHJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgIG11dGFibGU6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgY3VzdG9tQXR0cmlidXRlczoge1xuICAgICAgICAncHJlZmVycmVkX3VuaXRzJzogbmV3IGNvZ25pdG8uU3RyaW5nQXR0cmlidXRlKHtcbiAgICAgICAgICBtaW5MZW46IDIsXG4gICAgICAgICAgbWF4TGVuOiAxMCxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9KSxcbiAgICAgICAgJ3RpbWV6b25lJzogbmV3IGNvZ25pdG8uU3RyaW5nQXR0cmlidXRlKHtcbiAgICAgICAgICBtaW5MZW46IDMsXG4gICAgICAgICAgbWF4TGVuOiA1MCxcbiAgICAgICAgICBtdXRhYmxlOiB0cnVlLFxuICAgICAgICB9KSxcbiAgICAgIH0sXG4gICAgICBwYXNzd29yZFBvbGljeToge1xuICAgICAgICBtaW5MZW5ndGg6IDgsXG4gICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVVcHBlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVEaWdpdHM6IHRydWUsXG4gICAgICAgIHJlcXVpcmVTeW1ib2xzOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBhY2NvdW50UmVjb3Zlcnk6IGNvZ25pdG8uQWNjb3VudFJlY292ZXJ5LkVNQUlMX09OTFksXG4gICAgICByZW1vdmFsUG9saWN5OiBzdGFnZSA9PT0gJ3Byb2R1Y3Rpb24nID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIFVzZXIgUG9vbCBDbGllbnRcbiAgICB0aGlzLnVzZXJQb29sQ2xpZW50ID0gbmV3IGNvZ25pdG8uVXNlclBvb2xDbGllbnQodGhpcywgJ1VzZXJQb29sQ2xpZW50Jywge1xuICAgICAgdXNlclBvb2w6IHRoaXMudXNlclBvb2wsXG4gICAgICB1c2VyUG9vbENsaWVudE5hbWU6IGBtaWxlLXF1ZXN0LSR7c3RhZ2V9LWNsaWVudGAsXG4gICAgICBhdXRoRmxvd3M6IHtcbiAgICAgICAgdXNlclNycDogdHJ1ZSxcbiAgICAgICAgdXNlclBhc3N3b3JkOiBmYWxzZSxcbiAgICAgICAgYWRtaW5Vc2VyUGFzc3dvcmQ6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIGdlbmVyYXRlU2VjcmV0OiBmYWxzZSwgLy8gRm9yIHdlYiBhcHBsaWNhdGlvbnNcbiAgICAgIHByZXZlbnRVc2VyRXhpc3RlbmNlRXJyb3JzOiB0cnVlLFxuICAgICAgcmVmcmVzaFRva2VuVmFsaWRpdHk6IGNkay5EdXJhdGlvbi5kYXlzKDMwKSxcbiAgICAgIGFjY2Vzc1Rva2VuVmFsaWRpdHk6IGNkay5EdXJhdGlvbi5ob3VycygxKSxcbiAgICAgIGlkVG9rZW5WYWxpZGl0eTogY2RrLkR1cmF0aW9uLmhvdXJzKDEpLFxuICAgICAgZW5hYmxlVG9rZW5SZXZvY2F0aW9uOiB0cnVlLFxuICAgICAgc3VwcG9ydGVkSWRlbnRpdHlQcm92aWRlcnM6IFtjb2duaXRvLlVzZXJQb29sQ2xpZW50SWRlbnRpdHlQcm92aWRlci5DT0dOSVRPXSxcbiAgICB9KTtcblxuICAgIC8vIEdvb2dsZSBJZGVudGl0eSBQcm92aWRlciAob3B0aW9uYWwgLSBjb25maWd1cmUgbGF0ZXIpXG4gICAgLy8gY29uc3QgZ29vZ2xlUHJvdmlkZXIgPSBuZXcgY29nbml0by5Vc2VyUG9vbElkZW50aXR5UHJvdmlkZXJHb29nbGUodGhpcywgJ0dvb2dsZVByb3ZpZGVyJywge1xuICAgIC8vICAgdXNlclBvb2w6IHRoaXMudXNlclBvb2wsXG4gICAgLy8gICBjbGllbnRJZDogJ2dvb2dsZS1jbGllbnQtaWQnLFxuICAgIC8vICAgY2xpZW50U2VjcmV0OiAnZ29vZ2xlLWNsaWVudC1zZWNyZXQnLFxuICAgIC8vICAgc2NvcGVzOiBbJ3Byb2ZpbGUnLCAnZW1haWwnLCAnb3BlbmlkJ10sXG4gICAgLy8gICBhdHRyaWJ1dGVNYXBwaW5nOiB7XG4gICAgLy8gICAgIGVtYWlsOiBjb2duaXRvLlByb3ZpZGVyQXR0cmlidXRlLkdPT0dMRV9FTUFJTCxcbiAgICAvLyAgICAgZ2l2ZW5OYW1lOiBjb2duaXRvLlByb3ZpZGVyQXR0cmlidXRlLkdPT0dMRV9HSVZFTl9OQU1FLFxuICAgIC8vICAgICBmYW1pbHlOYW1lOiBjb2duaXRvLlByb3ZpZGVyQXR0cmlidXRlLkdPT0dMRV9GQU1JTFlfTkFNRSxcbiAgICAvLyAgIH0sXG4gICAgLy8gfSk7XG5cbiAgICAvLyBTdG9yZSBwYXJhbWV0ZXJzIGluIFN5c3RlbXMgTWFuYWdlclxuICAgIG5ldyBzc20uU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdVc2VyUG9vbElkUGFyYW1ldGVyJywge1xuICAgICAgcGFyYW1ldGVyTmFtZTogYC9taWxlLXF1ZXN0LyR7c3RhZ2V9L2NvZ25pdG8vdXNlci1wb29sLWlkYCxcbiAgICAgIHN0cmluZ1ZhbHVlOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ01pbGUgUXVlc3QgVXNlciBQb29sIElEJyxcbiAgICB9KTtcblxuICAgIG5ldyBzc20uU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdVc2VyUG9vbENsaWVudElkUGFyYW1ldGVyJywge1xuICAgICAgcGFyYW1ldGVyTmFtZTogYC9taWxlLXF1ZXN0LyR7c3RhZ2V9L2NvZ25pdG8vdXNlci1wb29sLWNsaWVudC1pZGAsXG4gICAgICBzdHJpbmdWYWx1ZTogdGhpcy51c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgICAgZGVzY3JpcHRpb246ICdNaWxlIFF1ZXN0IFVzZXIgUG9vbCBDbGllbnQgSUQnLFxuICAgIH0pO1xuXG4gICAgbmV3IHNzbS5TdHJpbmdQYXJhbWV0ZXIodGhpcywgJ1VzZXJQb29sQXJuUGFyYW1ldGVyJywge1xuICAgICAgcGFyYW1ldGVyTmFtZTogYC9taWxlLXF1ZXN0LyR7c3RhZ2V9L2NvZ25pdG8vdXNlci1wb29sLWFybmAsXG4gICAgICBzdHJpbmdWYWx1ZTogdGhpcy51c2VyUG9vbC51c2VyUG9vbEFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnTWlsZSBRdWVzdCBVc2VyIFBvb2wgQVJOJyxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIElEJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUG9vbENsaWVudElkJywge1xuICAgICAgdmFsdWU6IHRoaXMudXNlclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29nbml0byBVc2VyIFBvb2wgQ2xpZW50IElEJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUG9vbEFybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdDb2duaXRvIFVzZXIgUG9vbCBBUk4nLFxuICAgIH0pO1xuICB9XG59Il19