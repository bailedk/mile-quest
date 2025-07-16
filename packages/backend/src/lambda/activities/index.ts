// Activities Lambda handler
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createAuthResponse } from '../../lib/auth';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const { httpMethod, pathParameters } = event;
    const path = pathParameters?.proxy || '';

    // Handle CORS preflight
    if (httpMethod === 'OPTIONS') {
      return createAuthResponse(200, {});
    }

    switch (`${httpMethod}:${path}`) {
      case 'GET:':
        return createAuthResponse(200, { message: 'Activities list endpoint - not implemented yet' });
      default:
        return createAuthResponse(404, { error: 'Not found' });
    }
  } catch (error) {
    console.error('Activities handler error:', error);
    return createAuthResponse(500, { error: 'Internal server error' });
  }
}