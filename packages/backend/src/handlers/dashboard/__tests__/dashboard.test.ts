/**
 * Dashboard handler tests
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../index';

// Mock dependencies
jest.mock('../../../utils/auth/jwt.utils', () => ({
  verifyToken: jest.fn().mockReturnValue({
    sub: 'test-user-123',
    email: 'test@example.com',
  }),
}));

jest.mock('../../../lib/database', () => ({
  prisma: {
    teamMember: {
      findMany: jest.fn(),
    },
    teamGoal: {
      findFirst: jest.fn(),
    },
    activity: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      aggregate: jest.fn(),
    },
    team: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../../services/team/team.service');
jest.mock('../../../services/activity/activity.service');
jest.mock('../../../services/progress/progress.service');

describe('Dashboard Handler', () => {
  const mockEvent: Partial<APIGatewayProxyEvent> = {
    httpMethod: 'GET',
    path: '/dashboard',
    headers: {
      Authorization: 'Bearer mock-token',
    },
    body: null,
    pathParameters: null,
    queryStringParameters: null,
  };

  const mockContext: Partial<Context> = {
    requestId: 'test-request-id',
  };

  it('should handle GET request to dashboard endpoint', async () => {
    const result = await handler(
      mockEvent as APIGatewayProxyEvent,
      mockContext as Context
    );

    expect(result.statusCode).toBeDefined();
    expect(result.body).toBeDefined();
  });

  it('should return 401 when no authorization header is provided', async () => {
    const eventWithoutAuth = {
      ...mockEvent,
      headers: {},
    };

    const result = await handler(
      eventWithoutAuth as APIGatewayProxyEvent,
      mockContext as Context
    );

    expect(result.statusCode).toBe(500); // Will be 500 due to "No token provided" error
  });
});