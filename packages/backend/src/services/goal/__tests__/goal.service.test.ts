/**
 * Goal Service Tests
 */

import { GoalService } from '../goal.service';
import { PrismaClient } from '@prisma/client';
import { MapService, MapServiceError, MapErrorCode } from '../../map/types';
import { GoalServiceError, GoalErrorCode, GOAL_VALIDATION } from '../types';

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
      ).rejects.toThrow(GoalServiceError);
      
      try {
        await goalService.createTeamGoal('invalid-team', 'user-1', input);
      } catch (error) {
        expect(error).toBeInstanceOf(GoalServiceError);
        expect((error as GoalServiceError).code).toBe(GoalErrorCode.USER_NOT_MEMBER);
      }
    });

    it('should create goal with waypoints', async () => {
      (mockPrisma.team.findFirst as jest.Mock).mockResolvedValue({
        id: 'team-1',
        name: 'Test Team',
      });

      const routeWithWaypoints = {
        id: 'route-1',
        waypoints: [
          { id: 'start', position: { lat: 40.7589, lng: -73.9851 }, order: 0, isLocked: true },
          { id: 'waypoint-1', position: { lat: 40.7484, lng: -73.9857 }, order: 1, isLocked: false },
          { id: 'waypoint-2', position: { lat: 40.7061, lng: -74.0087 }, order: 2, isLocked: false },
          { id: 'end', position: { lat: 40.6892, lng: -74.0445 }, order: 3, isLocked: true },
        ],
        segments: [],
        totalDistance: 15000,
        totalDuration: 10800,
        bounds: { southwest: { lat: 40.6892, lng: -74.0445 }, northeast: { lat: 40.7589, lng: -73.9851 } },
        encodedPolyline: 'encoded_route_with_waypoints',
      };

      (mockMapService.calculateRoute as jest.Mock).mockResolvedValue(routeWithWaypoints);
      (mockPrisma.teamGoal.create as jest.Mock).mockResolvedValue({
        id: 'goal-1',
        teamId: 'team-1',
        name: 'Multi-stop NYC Tour',
        waypoints: routeWithWaypoints.waypoints,
        targetDistance: 15000,
        status: 'DRAFT',
        team: { name: 'Test Team' },
      });

      const input = {
        name: 'Multi-stop NYC Tour',
        startLocation: { lat: 40.7589, lng: -73.9851, address: 'Times Square' },
        endLocation: { lat: 40.6892, lng: -74.0445, address: 'Statue of Liberty' },
        waypoints: [
          { id: 'waypoint-1', position: { lat: 40.7484, lng: -73.9857 }, address: 'Empire State Building', order: 1 },
          { id: 'waypoint-2', position: { lat: 40.7061, lng: -74.0087 }, address: 'Brooklyn Bridge', order: 2 },
        ],
      };

      const result = await goalService.createTeamGoal('team-1', 'user-1', input);

      expect(result).toBeDefined();
      expect(mockMapService.calculateRoute).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'start' }),
          expect.objectContaining({ id: 'waypoint-1' }),
          expect.objectContaining({ id: 'waypoint-2' }),
          expect.objectContaining({ id: 'end' }),
        ]),
        { profile: 'walking', steps: true }
      );
    });

    it('should create goal as draft by default', async () => {
      (mockPrisma.team.findFirst as jest.Mock).mockResolvedValue({ id: 'team-1' });
      (mockMapService.calculateRoute as jest.Mock).mockResolvedValue({
        totalDistance: 10000,
        encodedPolyline: 'encoded',
        waypoints: [],
        route: {},
      });
      (mockPrisma.teamGoal.create as jest.Mock).mockResolvedValue({
        id: 'goal-1',
        status: 'DRAFT',
        team: { name: 'Test Team' },
      });

      const input = {
        name: 'Test Goal',
        startLocation: { lat: 0, lng: 0 },
        endLocation: { lat: 1, lng: 1 },
      };

      await goalService.createTeamGoal('team-1', 'user-1', input);

      expect(mockPrisma.teamGoal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DRAFT',
          }),
        })
      );
    });

    it('should create goal as active when specified', async () => {
      (mockPrisma.team.findFirst as jest.Mock).mockResolvedValue({ id: 'team-1' });
      (mockMapService.calculateRoute as jest.Mock).mockResolvedValue({
        totalDistance: 10000,
        encodedPolyline: 'encoded',
        waypoints: [],
        route: {},
      });
      (mockPrisma.teamGoal.create as jest.Mock).mockResolvedValue({
        id: 'goal-1',
        status: 'ACTIVE',
        team: { name: 'Test Team' },
      });

      const input = {
        name: 'Test Goal',
        startLocation: { lat: 0, lng: 0 },
        endLocation: { lat: 1, lng: 1 },
        status: 'ACTIVE' as const,
      };

      await goalService.createTeamGoal('team-1', 'user-1', input);

      expect(mockPrisma.teamGoal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ACTIVE',
            startedAt: expect.any(Date),
          }),
        })
      );
    });

    describe('validation', () => {
      beforeEach(() => {
        (mockPrisma.team.findFirst as jest.Mock).mockResolvedValue({ id: 'team-1' });
      });

      it('should reject empty goal name', async () => {
        const input = {
          name: '',
          startLocation: { lat: 0, lng: 0 },
          endLocation: { lat: 1, lng: 1 },
        };

        await expect(
          goalService.createTeamGoal('team-1', 'user-1', input)
        ).rejects.toThrow(GoalServiceError);

        try {
          await goalService.createTeamGoal('team-1', 'user-1', input);
        } catch (error) {
          expect((error as GoalServiceError).code).toBe(GoalErrorCode.INVALID_NAME);
        }
      });

      it('should reject invalid coordinates', async () => {
        const input = {
          name: 'Test Goal',
          startLocation: { lat: 91, lng: 0 }, // Invalid latitude
          endLocation: { lat: 0, lng: 0 },
        };

        await expect(
          goalService.createTeamGoal('team-1', 'user-1', input)
        ).rejects.toThrow(GoalServiceError);

        try {
          await goalService.createTeamGoal('team-1', 'user-1', input);
        } catch (error) {
          expect((error as GoalServiceError).code).toBe(GoalErrorCode.INVALID_COORDINATES);
        }
      });

      it('should reject too many waypoints', async () => {
        const waypoints = Array.from({ length: GOAL_VALIDATION.MAX_WAYPOINTS }, (_, i) => ({
          id: `wp-${i}`,
          position: { lat: i * 0.1, lng: i * 0.1 },
          order: i + 1,
        }));

        const input = {
          name: 'Test Goal',
          startLocation: { lat: 0, lng: 0 },
          endLocation: { lat: 10, lng: 10 },
          waypoints, // This will exceed max when including start/end
        };

        await expect(
          goalService.createTeamGoal('team-1', 'user-1', input)
        ).rejects.toThrow(GoalServiceError);

        try {
          await goalService.createTeamGoal('team-1', 'user-1', input);
        } catch (error) {
          expect((error as GoalServiceError).code).toBe(GoalErrorCode.INVALID_WAYPOINT_COUNT);
        }
      });

      it('should reject duplicate waypoints', async () => {
        const input = {
          name: 'Test Goal',
          startLocation: { lat: 0, lng: 0 },
          endLocation: { lat: 1, lng: 1 },
          waypoints: [
            { id: 'wp1', position: { lat: 0.5, lng: 0.5 }, order: 1 },
            { id: 'wp2', position: { lat: 0.5, lng: 0.5 }, order: 2 }, // Duplicate
          ],
        };

        await expect(
          goalService.createTeamGoal('team-1', 'user-1', input)
        ).rejects.toThrow(GoalServiceError);

        try {
          await goalService.createTeamGoal('team-1', 'user-1', input);
        } catch (error) {
          expect((error as GoalServiceError).code).toBe(GoalErrorCode.DUPLICATE_WAYPOINT);
        }
      });

      it('should reject routes exceeding maximum distance', async () => {
        (mockMapService.calculateRoute as jest.Mock).mockResolvedValue({
          totalDistance: (GOAL_VALIDATION.MAX_DISTANCE_KM + 1) * 1000, // Over limit in meters
          encodedPolyline: 'encoded',
          waypoints: [],
          route: {},
        });

        const input = {
          name: 'Ultra Long Route',
          startLocation: { lat: 0, lng: 0 },
          endLocation: { lat: 89, lng: 179 },
        };

        await expect(
          goalService.createTeamGoal('team-1', 'user-1', input)
        ).rejects.toThrow(GoalServiceError);

        try {
          await goalService.createTeamGoal('team-1', 'user-1', input);
        } catch (error) {
          expect((error as GoalServiceError).code).toBe(GoalErrorCode.DISTANCE_TOO_LONG);
        }
      });

      it('should reject past target dates', async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const input = {
          name: 'Test Goal',
          startLocation: { lat: 0, lng: 0 },
          endLocation: { lat: 1, lng: 1 },
          targetDate: yesterday,
        };

        await expect(
          goalService.createTeamGoal('team-1', 'user-1', input)
        ).rejects.toThrow(GoalServiceError);

        try {
          await goalService.createTeamGoal('team-1', 'user-1', input);
        } catch (error) {
          expect((error as GoalServiceError).code).toBe(GoalErrorCode.INVALID_TARGET_DATE);
        }
      });

      it('should handle map service errors gracefully', async () => {
        (mockMapService.calculateRoute as jest.Mock).mockRejectedValue(
          new MapServiceError('No route found', MapErrorCode.NO_ROUTE_FOUND)
        );

        const input = {
          name: 'Test Goal',
          startLocation: { lat: 0, lng: 0 },
          endLocation: { lat: 1, lng: 1 },
        };

        await expect(
          goalService.createTeamGoal('team-1', 'user-1', input)
        ).rejects.toThrow(GoalServiceError);

        try {
          await goalService.createTeamGoal('team-1', 'user-1', input);
        } catch (error) {
          expect((error as GoalServiceError).code).toBe(GoalErrorCode.NO_ROUTE_FOUND);
          expect(error.message).toContain('No walking route found');
        }
      });
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