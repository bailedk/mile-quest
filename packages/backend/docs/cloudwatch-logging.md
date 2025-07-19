# CloudWatch Logging Configuration

This document describes the CloudWatch logging infrastructure for Mile Quest backend services.

## Overview

Mile Quest uses AWS Lambda Powertools for structured logging with CloudWatch integration. All Lambda functions automatically log to CloudWatch with proper retention policies and structured JSON formatting.

## Configuration

### Log Groups

Each Lambda function has its own CloudWatch Log Group with the following naming convention:
```
/aws/lambda/{StackName}-{Stage}-{FunctionName}
```

For example:
- `/aws/lambda/mile-quest-dev-HealthFunction`
- `/aws/lambda/mile-quest-prod-AuthFunction`

### Retention Policies

Log retention is environment-specific:
- **Development/Staging**: 7 days
- **Production**: 30 days

### Log Format

All logs use structured JSON format for easy querying in CloudWatch Insights:

```json
{
  "level": "INFO",
  "message": "API Request",
  "timestamp": "2025-01-19T12:00:00.000Z",
  "serviceName": "mile-quest-api",
  "functionName": "teams-handler",
  "correlationId": "abc-123-def",
  "userId": "user-123",
  "teamId": "team-456",
  "httpMethod": "POST",
  "path": "/teams",
  "statusCode": 201,
  "duration": 125
}
```

## Logger Service

The logger service (`src/services/logger/`) provides:

### Features
- Structured logging with AWS Lambda Powertools
- Request correlation tracking
- Performance metrics
- Error context capture
- User/team context tracking
- Child loggers for sub-operations

### Usage Example

```typescript
import { createHandler, EnhancedContext } from '../../utils/lambda-handler';

async function myHandler(event: APIGatewayProxyEvent, context: EnhancedContext) {
  const { logger } = context;
  
  // Basic logging
  logger.info('Processing request', { action: 'create_team' });
  
  // Set user context
  logger.setUserContext('user-123', 'team-456');
  
  // Performance tracking
  const timer = logger.startTimer('database-operation');
  await performDatabaseOperation();
  timer(); // Automatically logs duration
  
  // Error logging
  try {
    await riskyOperation();
  } catch (error) {
    logger.error('Operation failed', error, { 
      operation: 'risky_operation',
      userId: 'user-123' 
    });
  }
}

export const handler = createHandler(myHandler, {
  functionName: 'my-function',
  enableCors: true
});
```

## CloudWatch Dashboard

A CloudWatch dashboard is automatically created for monitoring:
- **Name**: `{StackName}-{Stage}-Dashboard`
- **URL**: Available in CloudFormation outputs as `CloudWatchDashboard`

Dashboard includes:
- Lambda invocation metrics
- Error rates
- Average duration
- Invocations over time

## CloudWatch Insights Queries

Common queries for debugging and monitoring:

### Find all errors in the last hour
```
fields @timestamp, @message
| filter level = "ERROR"
| sort @timestamp desc
| limit 100
```

### Track specific user activity
```
fields @timestamp, functionName, message, path, statusCode
| filter userId = "user-123"
| sort @timestamp desc
```

### Performance analysis
```
stats avg(duration), max(duration), count() by functionName
| filter @type = "REPORT"
```

### Find slow requests
```
fields @timestamp, functionName, duration, path
| filter duration > 1000
| sort duration desc
| limit 50
```

## Environment Variables

The following environment variables control logging behavior:

- `LOG_LEVEL`: Sets the minimum log level (DEBUG, INFO, WARN, ERROR)
- `AWS_LAMBDA_LOG_FORMAT`: Set to "JSON" for structured logging
- `AWS_LAMBDA_LOG_LEVEL`: Lambda runtime log level

## Best Practices

1. **Always use the injected logger** from the context rather than console.log
2. **Set correlation IDs** for request tracking across services
3. **Include relevant context** in log messages (userId, teamId, etc.)
4. **Use appropriate log levels**:
   - DEBUG: Detailed information for debugging
   - INFO: General operational information
   - WARN: Warning conditions that should be investigated
   - ERROR: Error conditions that need immediate attention
5. **Measure performance** of critical operations using timers
6. **Don't log sensitive information** (passwords, tokens, PII)

## Monitoring and Alerts

Consider setting up CloudWatch Alarms for:
- High error rates (> 1% of invocations)
- Increased latency (> 1000ms average)
- Lambda throttling
- Memory usage > 80%

## Local Development

In local development, the logger automatically adjusts output for console readability while maintaining the same API. Set `LOG_LEVEL=DEBUG` in your `.env` file for verbose logging during development.