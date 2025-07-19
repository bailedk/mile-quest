import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { prisma } from '../../lib/database';

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Progress test handler called');
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    // Test database connection
    const teamCount = await prisma.team.count();
    console.log('Team count:', teamCount);
    
    const progressCount = await prisma.teamProgress.count();
    console.log('TeamProgress count:', progressCount);
    
    // Test getting a specific team progress
    const teamId = 'cm54pkjdd000913qq9z46l8j1';
    const teamGoals = await prisma.teamGoal.findMany({
      where: { teamId },
      include: { progress: true }
    });
    
    console.log('Team goals found:', teamGoals.length);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        teamCount,
        progressCount,
        teamGoals: teamGoals.length,
        firstGoal: teamGoals[0] ? {
          name: teamGoals[0].name,
          hasProgress: !!teamGoals[0].progress
        } : null
      })
    };
  } catch (error) {
    console.error('Test handler error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        stack: error.stack
      })
    };
  }
};