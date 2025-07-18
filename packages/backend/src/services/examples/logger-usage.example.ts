/**
 * Example: Using the Logger Service in Lambda Handlers
 */

import { createHandler, EnhancedContext } from '../../utils/lambda-handler';
import { APIGatewayProxyEvent } from 'aws-lambda';

/**
 * Example handler showing logger usage patterns
 */
async function exampleHandler(
  event: APIGatewayProxyEvent,
  context: EnhancedContext
) {
  const { logger } = context;
  
  // 1. Basic logging at different levels
  logger.debug('Debug message - detailed information');
  logger.info('Info message - general information');
  logger.warn('Warning message - something to watch');
  logger.error('Error message - something went wrong');
  
  // 2. Logging with additional context
  logger.info('User action', {
    action: 'create_team',
    userId: 'user-123',
    teamName: 'Awesome Walkers',
  });
  
  // 3. Setting user context (persists for entire request)
  logger.setUserContext('user-123', 'team-456');
  logger.info('This log will include userId and teamId automatically');
  
  // 4. Performance tracking
  const timer = logger.startTimer('database-operation');
  // ... do some work ...
  await new Promise(resolve => setTimeout(resolve, 100));
  timer(); // Logs operation with duration
  
  // 5. Logging database queries
  logger.logQuery('SELECT', 'users', 25);
  
  // 6. Error logging with context
  try {
    throw new Error('Something went wrong!');
  } catch (error) {
    logger.error('Failed to process request', error, {
      userId: 'user-123',
      operation: 'team_creation',
    });
  }
  
  // 7. Creating child loggers for sub-operations
  const teamLogger = logger.createChild({ 
    module: 'team-service',
    teamId: 'team-456' 
  });
  
  teamLogger.info('Team operation completed');
  
  return {
    statusCode: 200,
    body: { message: 'Example completed' },
  };
}

// Export handler with logging enabled
export const handler = createHandler(exampleHandler, {
  functionName: 'example-handler',
  enableCors: true,
});

/**
 * Example: Manual logger usage in services
 */
import { createLogger } from '../logger';

export class TeamService {
  private logger = createLogger('team-service');
  
  async createTeam(name: string, creatorId: string) {
    this.logger.info('Creating team', { name, creatorId });
    
    try {
      // ... team creation logic ...
      
      this.logger.info('Team created successfully', { 
        teamId: 'team-123',
        name,
        creatorId,
      });
      
      return { id: 'team-123', name };
    } catch (error) {
      this.logger.error('Failed to create team', error as Error, {
        name,
        creatorId,
      });
      throw error;
    }
  }
}

/**
 * Logger output in CloudWatch will be structured JSON:
 * 
 * {
 *   "level": "INFO",
 *   "message": "User action",
 *   "timestamp": "2025-01-18T23:30:00.000Z",
 *   "serviceName": "mile-quest-api",
 *   "functionName": "example-handler",
 *   "correlationId": "abc-123-def",
 *   "userId": "user-123",
 *   "teamId": "team-456",
 *   "action": "create_team",
 *   "teamName": "Awesome Walkers"
 * }
 */