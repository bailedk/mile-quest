import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import supertest from 'supertest';
import express, { Express } from 'express';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../index';
import { TeamService } from '@/services/team';
import { authMiddleware } from '@/middleware/auth.middleware';

// Mock dependencies
jest.mock('@/services/team');
jest.mock('@/middleware/auth.middleware');
jest.mock('@/lib/database');

describe('Teams API Handler', () => {
  let mockTeamService: jest.Mocked<TeamService>;
  let mockAuthMiddleware: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock auth middleware to always pass
    mockAuthMiddleware = authMiddleware as jest.Mock;
    mockAuthMiddleware.mockImplementation((req, res, next) => {
      req.user = { userId: 'test-user-123' };
      next();
    });

    // Mock TeamService
    mockTeamService = {
      createTeam: jest.fn(),
      joinTeam: jest.fn(),
      getTeamById: jest.fn(),
      getUserTeams: jest.fn(),
      updateTeam: jest.fn(),
      leaveTeam: jest.fn(),
    } as any;
    
    (TeamService as jest.Mock).mockImplementation(() => mockTeamService);
  });

  describe('POST /teams', () => {
    it('should create a new team', async () => {
      const newTeam = {
        name: 'Test Team',
        description: 'A test team',
        targetDistance: 100,
        targetDuration: 30,
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        destinationLat: 40.7128,
        destinationLng: -74.0060,
        destinationName: 'New York City',
      };

      const mockCreatedTeam = {
        id: 'team-123',
        ...newTeam,
        createdBy: 'test-user-123',
        isActive: true,
        currentDistance: 0,
        joinCode: 'ABC123',
      };

      mockTeamService.createTeam.mockResolvedValue(mockCreatedTeam);

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/teams',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer test-token',
        },
        body: JSON.stringify(newTeam),
      };

      const context = global.mockLambdaContext();
      const response = await handler(event as APIGatewayProxyEvent, context as Context);

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual(mockCreatedTeam);
      expect(mockTeamService.createTeam).toHaveBeenCalledWith('test-user-123', expect.objectContaining({
        ...newTeam,
        startDate: new Date(newTeam.startDate),
        endDate: new Date(newTeam.endDate),
      }));
    });

    it('should return 400 for invalid team data', async () => {
      const invalidTeam = {
        // Missing required fields
        name: 'Test Team',
      };

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/teams',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer test-token',
        },
        body: JSON.stringify(invalidTeam),
      };

      const context = global.mockLambdaContext();
      const response = await handler(event as APIGatewayProxyEvent, context as Context);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBeTruthy();
      expect(mockTeamService.createTeam).not.toHaveBeenCalled();
    });
  });

  describe('POST /teams/join', () => {
    it('should allow user to join a team with valid join code', async () => {
      const joinCode = 'ABC123';
      const mockMembership = {
        id: 'member-123',
        teamId: 'team-123',
        userId: 'test-user-123',
        role: 'MEMBER',
        joinedAt: new Date(),
      };

      mockTeamService.joinTeam.mockResolvedValue(mockMembership);

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/teams/join',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer test-token',
        },
        body: JSON.stringify({ joinCode }),
      };

      const context = global.mockLambdaContext();
      const response = await handler(event as APIGatewayProxyEvent, context as Context);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual(mockMembership);
      expect(mockTeamService.joinTeam).toHaveBeenCalledWith('test-user-123', joinCode);
    });

    it('should return 400 for missing join code', async () => {
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/teams/join',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer test-token',
        },
        body: JSON.stringify({}),
      };

      const context = global.mockLambdaContext();
      const response = await handler(event as APIGatewayProxyEvent, context as Context);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBeTruthy();
      expect(mockTeamService.joinTeam).not.toHaveBeenCalled();
    });
  });

  describe('GET /teams/:id', () => {
    it('should return team details', async () => {
      const teamId = 'team-123';
      const mockTeam = {
        id: teamId,
        name: 'Test Team',
        description: 'A test team',
        targetDistance: 100,
        currentDistance: 50,
        members: [
          {
            userId: 'test-user-123',
            role: 'CAPTAIN',
            user: {
              id: 'test-user-123',
              name: 'John Doe',
            },
          },
        ],
        _count: {
          members: 1,
        },
      };

      mockTeamService.getTeamById.mockResolvedValue(mockTeam);

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: `/teams/${teamId}`,
        pathParameters: { id: teamId },
        headers: {
          authorization: 'Bearer test-token',
        },
      };

      const context = global.mockLambdaContext();
      const response = await handler(event as APIGatewayProxyEvent, context as Context);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual(mockTeam);
      expect(mockTeamService.getTeamById).toHaveBeenCalledWith(teamId);
    });

    it('should return 404 for non-existent team', async () => {
      const teamId = 'non-existent';
      mockTeamService.getTeamById.mockResolvedValue(null);

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: `/teams/${teamId}`,
        pathParameters: { id: teamId },
        headers: {
          authorization: 'Bearer test-token',
        },
      };

      const context = global.mockLambdaContext();
      const response = await handler(event as APIGatewayProxyEvent, context as Context);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Team not found');
    });
  });

  describe('GET /teams', () => {
    it('should return user teams', async () => {
      const mockTeams = [
        {
          id: 'team-123',
          name: 'Team 1',
          role: 'CAPTAIN',
        },
        {
          id: 'team-456',
          name: 'Team 2',
          role: 'MEMBER',
        },
      ];

      mockTeamService.getUserTeams.mockResolvedValue(mockTeams);

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/teams',
        headers: {
          authorization: 'Bearer test-token',
        },
      };

      const context = global.mockLambdaContext();
      const response = await handler(event as APIGatewayProxyEvent, context as Context);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual(mockTeams);
      expect(mockTeamService.getUserTeams).toHaveBeenCalledWith('test-user-123');
    });
  });

  describe('Authentication', () => {
    it('should return 401 for missing authorization header', async () => {
      // Override auth middleware for this test
      mockAuthMiddleware.mockImplementationOnce((req, res, next) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/teams',
        headers: {}, // No auth header
      };

      const context = global.mockLambdaContext();
      const response = await handler(event as APIGatewayProxyEvent, context as Context);

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Unauthorized');
    });
  });
});