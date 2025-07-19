import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { TeamService } from '../team.service';

// Mock Prisma
jest.mock('@/lib/database');

describe('TeamService', () => {
  let teamService: TeamService;
  let prismaMock: DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    // Create mock Prisma client
    prismaMock = mockDeep<PrismaClient>();
    
    // Inject mock into service
    teamService = new TeamService();
    (teamService as any).prisma = prismaMock;
  });

  describe('createTeam', () => {
    it('should create a new team with the creator as captain', async () => {
      const userId = 'user-123';
      const teamData = {
        name: 'Test Team',
        description: 'A test team',
        targetDistance: 100,
        targetDuration: 30,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        destinationLat: 40.7128,
        destinationLng: -74.0060,
        destinationName: 'New York City',
      };

      const mockTeam = {
        id: 'team-123',
        ...teamData,
        createdBy: userId,
        isActive: true,
        currentDistance: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.team.create.mockResolvedValue(mockTeam);

      const result = await teamService.createTeam(userId, teamData);

      expect(prismaMock.team.create).toHaveBeenCalledWith({
        data: {
          ...teamData,
          createdBy: userId,
          members: {
            create: {
              userId,
              role: 'CAPTAIN',
              joinedAt: expect.any(Date),
            },
          },
        },
        include: {
          members: {
            include: {
              user: true,
            },
          },
          _count: {
            select: {
              members: true,
            },
          },
        },
      });

      expect(result).toEqual(mockTeam);
    });

    it('should throw an error if team creation fails', async () => {
      const userId = 'user-123';
      const teamData = {
        name: 'Test Team',
        description: 'A test team',
        targetDistance: 100,
        targetDuration: 30,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        destinationLat: 40.7128,
        destinationLng: -74.0060,
        destinationName: 'New York City',
      };

      prismaMock.team.create.mockRejectedValue(new Error('Database error'));

      await expect(teamService.createTeam(userId, teamData)).rejects.toThrow('Database error');
    });
  });

  describe('joinTeam', () => {
    it('should add a user to a team', async () => {
      const userId = 'user-456';
      const teamId = 'team-123';
      const joinCode = 'ABC123';

      const mockTeam = {
        id: teamId,
        name: 'Test Team',
        joinCode,
        isActive: true,
      };

      const mockMembership = {
        id: 'member-123',
        teamId,
        userId,
        role: 'MEMBER' as const,
        joinedAt: new Date(),
      };

      prismaMock.team.findFirst.mockResolvedValue(mockTeam as any);
      prismaMock.teamMember.findFirst.mockResolvedValue(null);
      prismaMock.teamMember.create.mockResolvedValue(mockMembership);

      const result = await teamService.joinTeam(userId, joinCode);

      expect(prismaMock.team.findFirst).toHaveBeenCalledWith({
        where: {
          joinCode,
          isActive: true,
        },
      });

      expect(prismaMock.teamMember.create).toHaveBeenCalledWith({
        data: {
          teamId,
          userId,
          role: 'MEMBER',
        },
      });

      expect(result).toEqual(mockMembership);
    });

    it('should throw an error if team not found', async () => {
      const userId = 'user-456';
      const joinCode = 'INVALID';

      prismaMock.team.findFirst.mockResolvedValue(null);

      await expect(teamService.joinTeam(userId, joinCode)).rejects.toThrow('Team not found or inactive');
    });

    it('should throw an error if user is already a member', async () => {
      const userId = 'user-456';
      const teamId = 'team-123';
      const joinCode = 'ABC123';

      const mockTeam = {
        id: teamId,
        name: 'Test Team',
        joinCode,
        isActive: true,
      };

      const existingMembership = {
        id: 'member-existing',
        teamId,
        userId,
      };

      prismaMock.team.findFirst.mockResolvedValue(mockTeam as any);
      prismaMock.teamMember.findFirst.mockResolvedValue(existingMembership as any);

      await expect(teamService.joinTeam(userId, joinCode)).rejects.toThrow('User is already a member of this team');
    });
  });

  describe('getTeamById', () => {
    it('should return team details with members', async () => {
      const teamId = 'team-123';
      const mockTeam = {
        id: teamId,
        name: 'Test Team',
        description: 'A test team',
        targetDistance: 100,
        currentDistance: 50,
        members: [
          {
            userId: 'user-123',
            role: 'CAPTAIN',
            user: {
              id: 'user-123',
              name: 'John Doe',
              email: 'john@example.com',
            },
          },
          {
            userId: 'user-456',
            role: 'MEMBER',
            user: {
              id: 'user-456',
              name: 'Jane Smith',
              email: 'jane@example.com',
            },
          },
        ],
        _count: {
          members: 2,
        },
      };

      prismaMock.team.findUnique.mockResolvedValue(mockTeam as any);

      const result = await teamService.getTeamById(teamId);

      expect(prismaMock.team.findUnique).toHaveBeenCalledWith({
        where: { id: teamId },
        include: {
          members: {
            include: {
              user: true,
            },
          },
          _count: {
            select: {
              members: true,
            },
          },
        },
      });

      expect(result).toEqual(mockTeam);
    });

    it('should return null if team not found', async () => {
      const teamId = 'non-existent';

      prismaMock.team.findUnique.mockResolvedValue(null);

      const result = await teamService.getTeamById(teamId);

      expect(result).toBeNull();
    });
  });
});