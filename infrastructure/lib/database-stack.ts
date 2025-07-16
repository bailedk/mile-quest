import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

interface DatabaseStackProps extends cdk.StackProps {
  stage: string;
}

export class DatabaseStack extends cdk.Stack {
  public readonly database: rds.DatabaseInstance;
  public readonly vpc: ec2.Vpc;
  public readonly databaseSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
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
    this.databaseSecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow Lambda access to PostgreSQL'
    );

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