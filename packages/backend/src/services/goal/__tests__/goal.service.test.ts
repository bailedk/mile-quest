/**
 * Goal Service Tests
 */

import { GoalService } from '../goal.service';
import { PrismaClient } from '@prisma/client';
import { MapService } from '../../map/types';

// Mock Prisma
const mockPrisma = {
  team: {
    findFirst: jest.fn(),
  },
  teamGoal: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  activity: {
    aggregate: jest.fn(),
    findFirst: jest.fn(),
  },
} as unknown as PrismaClient;

// Mock Map Service
const mockMapService: MapService = {
  calculateRoute: jest.fn(),
  searchAddress: jest.fn(),
  reverseGeocode: jest.fn(),
  optimizeWaypoints: jest.fn(),
  calculateDistance: jest.fn(),
  calculateRouteDistance: jest.fn(),
  getBounds: jest.fn(),
  encodePolyline: jest.fn(),
  decodePolyline: jest.fn(),
};

describe('GoalService', () => {
  let goalService: GoalService;

  beforeEach(() => {
    goalService = new GoalService(mockPrisma, mockMapService);
    jest.clearAllMocks();
  });

  describe('createTeamGoal', () => {
    it('should create a team goal with route calculation', async () => {
      // Mock team exists and user is member
      (mockPrisma.team.findFirst as jest.Mock).mockResolvedValue({
        id: 'team-1',
        name: 'Test Team',
      });

      // Mock route calculation
      (mockMapService.calculateRoute as jest.Mock).mockResolvedValue({
        id: 'route-1',
        waypoints: [
          {
            id: 'start',
            position: { lat: 40.7589, lng: -73.9851 },
            address: 'Times Square, NYC',
            order: 0,
            isLocked: true,
          },
          {
            id: 'end',
            position: { lat: 40.6892, lng: -74.0445 },
            address: 'Statue of Liberty, NYC',
            order: 1,
            isLocked: true,
          },
        ],
        segments: [
          {
            startWaypoint: {
              id: 'start',
              position: { lat: 40.7589, lng: -73.9851 },
              order: 0,
            },
            endWaypoint: {
              id: 'end',
              position: { lat: 40.6892, lng: -74.0445 },
              order: 1,
            },
            distance: 10000, // 10km
            duration: 7200, // 2 hours
            polyline: 'encoded_polyline_segment',
            coordinates: [],
          },
        ],
        totalDistance: 10000,
        totalDuration: 7200,
        bounds: {
          southwest: { lat: 40.6892, lng: -74.0445 },
          northeast: { lat: 40.7589, lng: -73.9851 },
        },
        encodedPolyline: 'encoded_full_route',
      });

      // Mock goal creation
      (mockPrisma.teamGoal.create as jest.Mock).mockResolvedValue({
        id: 'goal-1',
        teamId: 'team-1',
        name: 'NYC Walking Challenge',
        description: 'Walk from Times Square to Statue of Liberty',
        targetDistance: 10000,
        targetDate: new Date('2024-12-31'),
        startLocation: { lat: 40.7589, lng: -73.9851, address: 'Times Square, NYC' },
        endLocation: { lat: 40.6892, lng: -74.0445, address: 'Statue of Liberty, NYC' },
        waypoints: [
          {
            id: 'start',
            position: { lat: 40.7589, lng: -73.9851 },
            address: 'Times Square, NYC',
            order: 0,
            isLocked: true,
          },
          {
            id: 'end',
            position: { lat: 40.6892, lng: -74.0445 },
            address: 'Statue of Liberty, NYC',
            order: 1,
            isLocked: true,
          },
        ],
        routePolyline: 'encoded_full_route',
        routeData: {
          // mock route data
        },
        status: 'DRAFT',
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: null,
        completedAt: null,
        progress: null,
        team: {
          name: 'Test Team',
        },
      });

      const input = {
        name: 'NYC Walking Challenge',
        description: 'Walk from Times Square to Statue of Liberty',
        startLocation: {
          lat: 40.7589,
          lng: -73.9851,
          address: 'Times Square, NYC',
        },
        endLocation: {
          lat: 40.6892,
          lng: -74.0445,
          address: 'Statue of Liberty, NYC',
        },
        targetDate: new Date('2024-12-31'),
      };

      const result = await goalService.createTeamGoal('team-1', 'user-1', input);

      expect(result).toBeDefined();
      expect(result.id).toBe('goal-1');
      expect(result.name).toBe('NYC Walking Challenge');
      expect(result.targetDistance).toBe(10000);
      expect(mockMapService.calculateRoute).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'start',
            position: expect.objectContaining({
              lat: 40.7589,
              lng: -73.9851,
            }),
          }),
          expect.objectContaining({
            id: 'end',
            position: expect.objectContaining({
              lat: 40.6892,
              lng: -74.0445,
            }),
          }),
        ]),
        { profile: 'walking', steps: true }
      );
    });

    it('should throw error if team not found', async () => {
      (mockPrisma.team.findFirst as jest.Mock).mockResolvedValue(null);

      const input = {
        name: 'Test Goal',
        startLocation: { lat: 0, lng: 0 },
        endLocation: { lat: 1, lng: 1 },
      };

      await expect(
        goalService.createTeamGoal('invalid-team', 'user-1', input)
      ).rejects.toThrow('Team not found or user is not a member');
    });
  });

  describe('getGoalProgress', () => {
    it('should calculate goal progress correctly', async () => {
      const mockGoal = {
        id: 'goal-1',
        teamId: 'team-1',
        name: 'Test Goal',
        description: 'Test Description',
        targetDistance: 20000,
        targetDate: new Date('2024-12-31'),
        startLocation: { lat: 0, lng: 0, address: 'Start' },
        endLocation: { lat: 1, lng: 1, address: 'End' },
        waypoints: [],
        routePolyline: 'encoded_route',
        routeData: {
          segments: [
            { distance: 10000 },
            { distance: 10000 },
          ],
          bounds: {
            southwest: { lat: 0, lng: 0 },
            northeast: { lat: 1, lng: 1 },
          },
        },
        status: 'ACTIVE',
        team: { name: 'Test Team' },
        progress: {
          totalDistance: 5000,
          totalActivities: 10,
          totalDuration: 3600,
          currentSegmentIndex: 0,
          segmentProgress: 0.5,
          lastActivityAt: new Date(),
        },
      };

      (mockPrisma.teamGoal.findFirst as jest.Mock).mockResolvedValue(mockGoal);
      
      (mockPrisma.activity.aggregate as jest.Mock).mockResolvedValue({
        _sum: {
          distance: 5000,
          duration: 3600,
        },
        _count: {
          id: 10,
        },
      });

      (mockPrisma.activity.findFirst as jest.Mock).mockResolvedValue({
        createdAt: new Date(),
      });

      const result = await goalService.getGoalProgress('goal-1', 'user-1');

      expect(result).toBeDefined();
      expect(result.goalId).toBe('goal-1');
      expect(result.teamTotalDistance).toBe(5000);
      expect(result.progressPercentage).toBe(25); // 5000/20000 * 100
      expect(result.totalActivities).toBe(10);
    });
  });
});