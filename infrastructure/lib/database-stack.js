"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseStack = void 0;
const cdk = require("aws-cdk-lib");
const rds = require("aws-cdk-lib/aws-rds");
const ec2 = require("aws-cdk-lib/aws-ec2");
const ssm = require("aws-cdk-lib/aws-ssm");
const secretsmanager = require("aws-cdk-lib/aws-secretsmanager");
class DatabaseStack extends cdk.Stack {
    database;
    vpc;
    databaseSecurityGroup;
    constructor(scope, id, props) {
        super(scope, id, props);
        const { stage } = props;
        // VPC
        this.vpc = new ec2.Vpc(this, 'VPC', {
            cidr: '10.0.0.0/16',
            maxAzs: 2,
            enableDnsHostnames: true,
            enableDnsSupport: true,
            subnetConfiguration: [
                {
                    cidrMask: 24,
                    name: 'public',
                    subnetType: ec2.SubnetType.PUBLIC,
                },
                {
                    cidrMask: 24,
                    name: 'private',
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                },
                {
                    cidrMask: 28,
                    name: 'database',
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                },
            ],
        });
        // Database Security Group
        this.databaseSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
            vpc: this.vpc,
            description: 'Security group for Mile Quest RDS database',
            allowAllOutbound: false,
        });
        // Lambda Security Group (for database access)
        const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
            vpc: this.vpc,
            description: 'Security group for Lambda functions',
            allowAllOutbound: true,
        });
        // Allow Lambda to access database
        this.databaseSecurityGroup.addIngressRule(lambdaSecurityGroup, ec2.Port.tcp(5432), 'Allow Lambda access to PostgreSQL');
        // Database Subnet Group
        const subnetGroup = new rds.SubnetGroup(this, 'DatabaseSubnetGroup', {
            description: 'Subnet group for Mile Quest database',
            vpc: this.vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
            },
        });
        // Database Credentials
        const databaseCredentials = new secretsmanager.Secret(this, 'DatabaseCredentials', {
            secretName: `mile-quest-${stage}-db-credentials`,
            description: 'Database credentials for Mile Quest',
            generateSecretString: {
                secretStringTemplate: JSON.stringify({ username: 'milequest' }),
                generateStringKey: 'password',
                excludeCharacters: '"@/\\',
            },
        });
        // Parameter Group for PostgreSQL with PostGIS
        const parameterGroup = new rds.ParameterGroup(this, 'DatabaseParameterGroup', {
            engine: rds.DatabaseInstanceEngine.postgres({
                version: rds.PostgresEngineVersion.VER_14_9,
            }),
            description: 'Parameter group for Mile Quest PostgreSQL with PostGIS',
            parameters: {
                'shared_preload_libraries': 'postgis',
                'log_statement': 'all',
                'log_min_duration_statement': '1000',
                'max_connections': '100',
            },
        });
        // RDS Instance
        this.database = new rds.DatabaseInstance(this, 'Database', {
            instanceIdentifier: `mile-quest-${stage}`,
            engine: rds.DatabaseInstanceEngine.postgres({
                version: rds.PostgresEngineVersion.VER_14_9,
            }),
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
            credentials: rds.Credentials.fromSecret(databaseCredentials),
            vpc: this.vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
            },
            securityGroups: [this.databaseSecurityGroup],
            subnetGroup,
            parameterGroup,
            databaseName: 'milequest',
            port: 5432,
            multiAz: stage === 'production',
            storageEncrypted: true,
            storageType: rds.StorageType.GP2,
            allocatedStorage: 20,
            maxAllocatedStorage: 100,
            deletionProtection: stage === 'production',
            backupRetention: stage === 'production' ? cdk.Duration.days(7) : cdk.Duration.days(3),
            preferredBackupWindow: '03:00-04:00',
            preferredMaintenanceWindow: 'sat:04:00-sat:05:00',
            cloudwatchLogsExports: ['postgresql'],
            enablePerformanceInsights: stage === 'production',
            performanceInsightRetention: stage === 'production'
                ? rds.PerformanceInsightRetention.DEFAULT
                : undefined,
            removalPolicy: stage === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        });
        // Store database configuration in Systems Manager
        new ssm.StringParameter(this, 'DatabaseEndpointParameter', {
            parameterName: `/mile-quest/${stage}/database/endpoint`,
            stringValue: this.database.instanceEndpoint.hostname,
            description: 'Mile Quest Database Endpoint',
        });
        new ssm.StringParameter(this, 'DatabasePortParameter', {
            parameterName: `/mile-quest/${stage}/database/port`,
            stringValue: this.database.instanceEndpoint.port.toString(),
            description: 'Mile Quest Database Port',
        });
        new ssm.StringParameter(this, 'DatabaseNameParameter', {
            parameterName: `/mile-quest/${stage}/database/name`,
            stringValue: 'milequest',
            description: 'Mile Quest Database Name',
        });
        new ssm.StringParameter(this, 'DatabaseCredentialsArnParameter', {
            parameterName: `/mile-quest/${stage}/database/credentials-arn`,
            stringValue: databaseCredentials.secretArn,
            description: 'Mile Quest Database Credentials ARN',
        });
        new ssm.StringParameter(this, 'LambdaSecurityGroupIdParameter', {
            parameterName: `/mile-quest/${stage}/lambda/security-group-id`,
            stringValue: lambdaSecurityGroup.securityGroupId,
            description: 'Lambda Security Group ID for database access',
        });
        new ssm.StringParameter(this, 'VpcIdParameter', {
            parameterName: `/mile-quest/${stage}/vpc/vpc-id`,
            stringValue: this.vpc.vpcId,
            description: 'VPC ID for Mile Quest',
        });
        new ssm.StringParameter(this, 'PrivateSubnetIdsParameter', {
            parameterName: `/mile-quest/${stage}/vpc/private-subnet-ids`,
            stringValue: this.vpc.privateSubnets.map(subnet => subnet.subnetId).join(','),
            description: 'Private Subnet IDs for Lambda functions',
        });
        // Outputs
        new cdk.CfnOutput(this, 'DatabaseEndpoint', {
            value: this.database.instanceEndpoint.hostname,
            description: 'RDS Database Endpoint',
        });
        new cdk.CfnOutput(this, 'DatabasePort', {
            value: this.database.instanceEndpoint.port.toString(),
            description: 'RDS Database Port',
        });
        new cdk.CfnOutput(this, 'DatabaseCredentialsArn', {
            value: databaseCredentials.secretArn,
            description: 'Database Credentials Secret ARN',
        });
        new cdk.CfnOutput(this, 'VpcId', {
            value: this.vpc.vpcId,
            description: 'VPC ID',
        });
        new cdk.CfnOutput(this, 'LambdaSecurityGroupId', {
            value: lambdaSecurityGroup.securityGroupId,
            description: 'Lambda Security Group ID',
        });
    }
}
exports.DatabaseStack = DatabaseStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YWJhc2Utc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJkYXRhYmFzZS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBbUM7QUFDbkMsMkNBQTJDO0FBQzNDLDJDQUEyQztBQUMzQywyQ0FBMkM7QUFDM0MsaUVBQWlFO0FBT2pFLE1BQWEsYUFBYyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzFCLFFBQVEsQ0FBdUI7SUFDL0IsR0FBRyxDQUFVO0lBQ2IscUJBQXFCLENBQW9CO0lBRXpELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBeUI7UUFDakUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLEtBQUssRUFBRSxHQUFHLEtBQUssQ0FBQztRQUV4QixNQUFNO1FBQ04sSUFBSSxDQUFDLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRTtZQUNsQyxJQUFJLEVBQUUsYUFBYTtZQUNuQixNQUFNLEVBQUUsQ0FBQztZQUNULGtCQUFrQixFQUFFLElBQUk7WUFDeEIsZ0JBQWdCLEVBQUUsSUFBSTtZQUN0QixtQkFBbUIsRUFBRTtnQkFDbkI7b0JBQ0UsUUFBUSxFQUFFLEVBQUU7b0JBQ1osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsVUFBVSxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsTUFBTTtpQkFDbEM7Z0JBQ0Q7b0JBQ0UsUUFBUSxFQUFFLEVBQUU7b0JBQ1osSUFBSSxFQUFFLFNBQVM7b0JBQ2YsVUFBVSxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsbUJBQW1CO2lCQUMvQztnQkFDRDtvQkFDRSxRQUFRLEVBQUUsRUFBRTtvQkFDWixJQUFJLEVBQUUsVUFBVTtvQkFDaEIsVUFBVSxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsZ0JBQWdCO2lCQUM1QzthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgs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RjtBQWpNRCxzQ0FpTUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgcmRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1yZHMnO1xuaW1wb3J0ICogYXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0ICogYXMgc3NtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zc20nO1xuaW1wb3J0ICogYXMgc2VjcmV0c21hbmFnZXIgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlY3JldHNtYW5hZ2VyJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5pbnRlcmZhY2UgRGF0YWJhc2VTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBzdGFnZTogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgRGF0YWJhc2VTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBkYXRhYmFzZTogcmRzLkRhdGFiYXNlSW5zdGFuY2U7XG4gIHB1YmxpYyByZWFkb25seSB2cGM6IGVjMi5WcGM7XG4gIHB1YmxpYyByZWFkb25seSBkYXRhYmFzZVNlY3VyaXR5R3JvdXA6IGVjMi5TZWN1cml0eUdyb3VwO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBEYXRhYmFzZVN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgc3RhZ2UgfSA9IHByb3BzO1xuXG4gICAgLy8gVlBDXG4gICAgdGhpcy52cGMgPSBuZXcgZWMyLlZwYyh0aGlzLCAnVlBDJywge1xuICAgICAgY2lkcjogJzEwLjAuMC4wLzE2JyxcbiAgICAgIG1heEF6czogMixcbiAgICAgIGVuYWJsZURuc0hvc3RuYW1lczogdHJ1ZSxcbiAgICAgIGVuYWJsZURuc1N1cHBvcnQ6IHRydWUsXG4gICAgICBzdWJuZXRDb25maWd1cmF0aW9uOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBjaWRyTWFzazogMjQsXG4gICAgICAgICAgbmFtZTogJ3B1YmxpYycsXG4gICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFVCTElDLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgY2lkck1hc2s6IDI0LFxuICAgICAgICAgIG5hbWU6ICdwcml2YXRlJyxcbiAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgY2lkck1hc2s6IDI4LFxuICAgICAgICAgIG5hbWU6ICdkYXRhYmFzZScsXG4gICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9JU09MQVRFRCxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBEYXRhYmFzZSBTZWN1cml0eSBHcm91cFxuICAgIHRoaXMuZGF0YWJhc2VTZWN1cml0eUdyb3VwID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKHRoaXMsICdEYXRhYmFzZVNlY3VyaXR5R3JvdXAnLCB7XG4gICAgICB2cGM6IHRoaXMudnBjLFxuICAgICAgZGVzY3JpcHRpb246ICdTZWN1cml0eSBncm91cCBmb3IgTWlsZSBRdWVzdCBSRFMgZGF0YWJhc2UnLFxuICAgICAgYWxsb3dBbGxPdXRib3VuZDogZmFsc2UsXG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGEgU2VjdXJpdHkgR3JvdXAgKGZvciBkYXRhYmFzZSBhY2Nlc3MpXG4gICAgY29uc3QgbGFtYmRhU2VjdXJpdHlHcm91cCA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnTGFtYmRhU2VjdXJpdHlHcm91cCcsIHtcbiAgICAgIHZwYzogdGhpcy52cGMsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyaXR5IGdyb3VwIGZvciBMYW1iZGEgZnVuY3Rpb25zJyxcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBBbGxvdyBMYW1iZGEgdG8gYWNjZXNzIGRhdGFiYXNlXG4gICAgdGhpcy5kYXRhYmFzZVNlY3VyaXR5R3JvdXAuYWRkSW5ncmVzc1J1bGUoXG4gICAgICBsYW1iZGFTZWN1cml0eUdyb3VwLFxuICAgICAgZWMyLlBvcnQudGNwKDU0MzIpLFxuICAgICAgJ0FsbG93IExhbWJkYSBhY2Nlc3MgdG8gUG9zdGdyZVNRTCdcbiAgICApO1xuXG4gICAgLy8gRGF0YWJhc2UgU3VibmV0IEdyb3VwXG4gICAgY29uc3Qgc3VibmV0R3JvdXAgPSBuZXcgcmRzLlN1Ym5ldEdyb3VwKHRoaXMsICdEYXRhYmFzZVN1Ym5ldEdyb3VwJywge1xuICAgICAgZGVzY3JpcHRpb246ICdTdWJuZXQgZ3JvdXAgZm9yIE1pbGUgUXVlc3QgZGF0YWJhc2UnLFxuICAgICAgdnBjOiB0aGlzLnZwYyxcbiAgICAgIHZwY1N1Ym5ldHM6IHtcbiAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9JU09MQVRFRCxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBEYXRhYmFzZSBDcmVkZW50aWFsc1xuICAgIGNvbnN0IGRhdGFiYXNlQ3JlZGVudGlhbHMgPSBuZXcgc2VjcmV0c21hbmFnZXIuU2VjcmV0KHRoaXMsICdEYXRhYmFzZUNyZWRlbnRpYWxzJywge1xuICAgICAgc2VjcmV0TmFtZTogYG1pbGUtcXVlc3QtJHtzdGFnZX0tZGItY3JlZGVudGlhbHNgLFxuICAgICAgZGVzY3JpcHRpb246ICdEYXRhYmFzZSBjcmVkZW50aWFscyBmb3IgTWlsZSBRdWVzdCcsXG4gICAgICBnZW5lcmF0ZVNlY3JldFN0cmluZzoge1xuICAgICAgICBzZWNyZXRTdHJpbmdUZW1wbGF0ZTogSlNPTi5zdHJpbmdpZnkoeyB1c2VybmFtZTogJ21pbGVxdWVzdCcgfSksXG4gICAgICAgIGdlbmVyYXRlU3RyaW5nS2V5OiAncGFzc3dvcmQnLFxuICAgICAgICBleGNsdWRlQ2hhcmFjdGVyczogJ1wiQC9cXFxcJyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBQYXJhbWV0ZXIgR3JvdXAgZm9yIFBvc3RncmVTUUwgd2l0aCBQb3N0R0lTXG4gICAgY29uc3QgcGFyYW1ldGVyR3JvdXAgPSBuZXcgcmRzLlBhcmFtZXRlckdyb3VwKHRoaXMsICdEYXRhYmFzZVBhcmFtZXRlckdyb3VwJywge1xuICAgICAgZW5naW5lOiByZHMuRGF0YWJhc2VJbnN0YW5jZUVuZ2luZS5wb3N0Z3Jlcyh7XG4gICAgICAgIHZlcnNpb246IHJkcy5Qb3N0Z3Jlc0VuZ2luZVZlcnNpb24uVkVSXzE0XzksXG4gICAgICB9KSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUGFyYW1ldGVyIGdyb3VwIGZvciBNaWxlIFF1ZXN0IFBvc3RncmVTUUwgd2l0aCBQb3N0R0lTJyxcbiAgICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICAgJ3NoYXJlZF9wcmVsb2FkX2xpYnJhcmllcyc6ICdwb3N0Z2lzJyxcbiAgICAgICAgJ2xvZ19zdGF0ZW1lbnQnOiAnYWxsJyxcbiAgICAgICAgJ2xvZ19taW5fZHVyYXRpb25fc3RhdGVtZW50JzogJzEwMDAnLFxuICAgICAgICAnbWF4X2Nvbm5lY3Rpb25zJzogJzEwMCcsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gUkRTIEluc3RhbmNlXG4gICAgdGhpcy5kYXRhYmFzZSA9IG5ldyByZHMuRGF0YWJhc2VJbnN0YW5jZSh0aGlzLCAnRGF0YWJhc2UnLCB7XG4gICAgICBpbnN0YW5jZUlkZW50aWZpZXI6IGBtaWxlLXF1ZXN0LSR7c3RhZ2V9YCxcbiAgICAgIGVuZ2luZTogcmRzLkRhdGFiYXNlSW5zdGFuY2VFbmdpbmUucG9zdGdyZXMoe1xuICAgICAgICB2ZXJzaW9uOiByZHMuUG9zdGdyZXNFbmdpbmVWZXJzaW9uLlZFUl8xNF85LFxuICAgICAgfSksXG4gICAgICBpbnN0YW5jZVR5cGU6IGVjMi5JbnN0YW5jZVR5cGUub2YoZWMyLkluc3RhbmNlQ2xhc3MuVDMsIGVjMi5JbnN0YW5jZVNpemUuTUlDUk8pLFxuICAgICAgY3JlZGVudGlhbHM6IHJkcy5DcmVkZW50aWFscy5mcm9tU2VjcmV0KGRhdGFiYXNlQ3JlZGVudGlhbHMpLFxuICAgICAgdnBjOiB0aGlzLnZwYyxcbiAgICAgIHZwY1N1Ym5ldHM6IHtcbiAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9JU09MQVRFRCxcbiAgICAgIH0sXG4gICAgICBzZWN1cml0eUdyb3VwczogW3RoaXMuZGF0YWJhc2VTZWN1cml0eUdyb3VwXSxcbiAgICAgIHN1Ym5ldEdyb3VwLFxuICAgICAgcGFyYW1ldGVyR3JvdXAsXG4gICAgICBkYXRhYmFzZU5hbWU6ICdtaWxlcXVlc3QnLFxuICAgICAgcG9ydDogNTQzMixcbiAgICAgIG11bHRpQXo6IHN0YWdlID09PSAncHJvZHVjdGlvbicsXG4gICAgICBzdG9yYWdlRW5jcnlwdGVkOiB0cnVlLFxuICAgICAgc3RvcmFnZVR5cGU6IHJkcy5TdG9yYWdlVHlwZS5HUDIsXG4gICAgICBhbGxvY2F0ZWRTdG9yYWdlOiAyMCxcbiAgICAgIG1heEFsbG9jYXRlZFN0b3JhZ2U6IDEwMCxcbiAgICAgIGRlbGV0aW9uUHJvdGVjdGlvbjogc3RhZ2UgPT09ICdwcm9kdWN0aW9uJyxcbiAgICAgIGJhY2t1cFJldGVudGlvbjogc3RhZ2UgPT09ICdwcm9kdWN0aW9uJyA/IGNkay5EdXJhdGlvbi5kYXlzKDcpIDogY2RrLkR1cmF0aW9uLmRheXMoMyksXG4gICAgICBwcmVmZXJyZWRCYWNrdXBXaW5kb3c6ICcwMzowMC0wNDowMCcsXG4gICAgICBwcmVmZXJyZWRNYWludGVuYW5jZVdpbmRvdzogJ3NhdDowNDowMC1zYXQ6MDU6MDAnLFxuICAgICAgY2xvdWR3YXRjaExvZ3NFeHBvcnRzOiBbJ3Bvc3RncmVzcWwnXSxcbiAgICAgIGVuYWJsZVBlcmZvcm1hbmNlSW5zaWdodHM6IHN0YWdlID09PSAncHJvZHVjdGlvbicsXG4gICAgICBwZXJmb3JtYW5jZUluc2lnaHRSZXRlbnRpb246IHN0YWdlID09PSAncHJvZHVjdGlvbicgXG4gICAgICAgID8gcmRzLlBlcmZvcm1hbmNlSW5zaWdodFJldGVudGlvbi5ERUZBVUxUIFxuICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IHN0YWdlID09PSAncHJvZHVjdGlvbicgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gU3RvcmUgZGF0YWJhc2UgY29uZmlndXJhdGlvbiBpbiBTeXN0ZW1zIE1hbmFnZXJcbiAgICBuZXcgc3NtLlN0cmluZ1BhcmFtZXRlcih0aGlzLCAnRGF0YWJhc2VFbmRwb2ludFBhcmFtZXRlcicsIHtcbiAgICAgIHBhcmFtZXRlck5hbWU6IGAvbWlsZS1xdWVzdC8ke3N0YWdlfS9kYXRhYmFzZS9lbmRwb2ludGAsXG4gICAgICBzdHJpbmdWYWx1ZTogdGhpcy5kYXRhYmFzZS5pbnN0YW5jZUVuZHBvaW50Lmhvc3RuYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdNaWxlIFF1ZXN0IERhdGFiYXNlIEVuZHBvaW50JyxcbiAgICB9KTtcblxuICAgIG5ldyBzc20uU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdEYXRhYmFzZVBvcnRQYXJhbWV0ZXInLCB7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiBgL21pbGUtcXVlc3QvJHtzdGFnZX0vZGF0YWJhc2UvcG9ydGAsXG4gICAgICBzdHJpbmdWYWx1ZTogdGhpcy5kYXRhYmFzZS5pbnN0YW5jZUVuZHBvaW50LnBvcnQudG9TdHJpbmcoKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTWlsZSBRdWVzdCBEYXRhYmFzZSBQb3J0JyxcbiAgICB9KTtcblxuICAgIG5ldyBzc20uU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdEYXRhYmFzZU5hbWVQYXJhbWV0ZXInLCB7XG4gICAgICBwYXJhbWV0ZXJOYW1lOiBgL21pbGUtcXVlc3QvJHtzdGFnZX0vZGF0YWJhc2UvbmFtZWAsXG4gICAgICBzdHJpbmdWYWx1ZTogJ21pbGVxdWVzdCcsXG4gICAgICBkZXNjcmlwdGlvbjogJ01pbGUgUXVlc3QgRGF0YWJhc2UgTmFtZScsXG4gICAgfSk7XG5cbiAgICBuZXcgc3NtLlN0cmluZ1BhcmFtZXRlcih0aGlzLCAnRGF0YWJhc2VDcmVkZW50aWFsc0FyblBhcmFtZXRlcicsIHtcbiAgICAgIHBhcmFtZXRlck5hbWU6IGAvbWlsZS1xdWVzdC8ke3N0YWdlfS9kYXRhYmFzZS9jcmVkZW50aWFscy1hcm5gLFxuICAgICAgc3RyaW5nVmFsdWU6IGRhdGFiYXNlQ3JlZGVudGlhbHMuc2VjcmV0QXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdNaWxlIFF1ZXN0IERhdGFiYXNlIENyZWRlbnRpYWxzIEFSTicsXG4gICAgfSk7XG5cbiAgICBuZXcgc3NtLlN0cmluZ1BhcmFtZXRlcih0aGlzLCAnTGFtYmRhU2VjdXJpdHlHcm91cElkUGFyYW1ldGVyJywge1xuICAgICAgcGFyYW1ldGVyTmFtZTogYC9taWxlLXF1ZXN0LyR7c3RhZ2V9L2xhbWJkYS9zZWN1cml0eS1ncm91cC1pZGAsXG4gICAgICBzdHJpbmdWYWx1ZTogbGFtYmRhU2VjdXJpdHlHcm91cC5zZWN1cml0eUdyb3VwSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0xhbWJkYSBTZWN1cml0eSBHcm91cCBJRCBmb3IgZGF0YWJhc2UgYWNjZXNzJyxcbiAgICB9KTtcblxuICAgIG5ldyBzc20uU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdWcGNJZFBhcmFtZXRlcicsIHtcbiAgICAgIHBhcmFtZXRlck5hbWU6IGAvbWlsZS1xdWVzdC8ke3N0YWdlfS92cGMvdnBjLWlkYCxcbiAgICAgIHN0cmluZ1ZhbHVlOiB0aGlzLnZwYy52cGNJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVlBDIElEIGZvciBNaWxlIFF1ZXN0JyxcbiAgICB9KTtcblxuICAgIG5ldyBzc20uU3RyaW5nUGFyYW1ldGVyKHRoaXMsICdQcml2YXRlU3VibmV0SWRzUGFyYW1ldGVyJywge1xuICAgICAgcGFyYW1ldGVyTmFtZTogYC9taWxlLXF1ZXN0LyR7c3RhZ2V9L3ZwYy9wcml2YXRlLXN1Ym5ldC1pZHNgLFxuICAgICAgc3RyaW5nVmFsdWU6IHRoaXMudnBjLnByaXZhdGVTdWJuZXRzLm1hcChzdWJuZXQgPT4gc3VibmV0LnN1Ym5ldElkKS5qb2luKCcsJyksXG4gICAgICBkZXNjcmlwdGlvbjogJ1ByaXZhdGUgU3VibmV0IElEcyBmb3IgTGFtYmRhIGZ1bmN0aW9ucycsXG4gICAgfSk7XG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0RhdGFiYXNlRW5kcG9pbnQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5kYXRhYmFzZS5pbnN0YW5jZUVuZHBvaW50Lmhvc3RuYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdSRFMgRGF0YWJhc2UgRW5kcG9pbnQnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0RhdGFiYXNlUG9ydCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmRhdGFiYXNlLmluc3RhbmNlRW5kcG9pbnQucG9ydC50b1N0cmluZygpLFxuICAgICAgZGVzY3JpcHRpb246ICdSRFMgRGF0YWJhc2UgUG9ydCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGF0YWJhc2VDcmVkZW50aWFsc0FybicsIHtcbiAgICAgIHZhbHVlOiBkYXRhYmFzZUNyZWRlbnRpYWxzLnNlY3JldEFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnRGF0YWJhc2UgQ3JlZGVudGlhbHMgU2VjcmV0IEFSTicsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVnBjSWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy52cGMudnBjSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ1ZQQyBJRCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTGFtYmRhU2VjdXJpdHlHcm91cElkJywge1xuICAgICAgdmFsdWU6IGxhbWJkYVNlY3VyaXR5R3JvdXAuc2VjdXJpdHlHcm91cElkLFxuICAgICAgZGVzY3JpcHRpb246ICdMYW1iZGEgU2VjdXJpdHkgR3JvdXAgSUQnLFxuICAgIH0pO1xuICB9XG59Il19