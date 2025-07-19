'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocketContext } from '@/contexts/WebSocketContext';
import type { TeamProgressData, RouteData } from '@mile-quest/shared';

interface Contributor {
  userId: string;
  name: string;
  avatarUrl?: string;
  distance: number;
  percentage: number;
}

interface Milestone {
  id: string;
  name: string;
  distance: number;
  reached: boolean;
  reachedAt?: string;
}

interface LiveProgressState {
  progress: TeamProgressData;
  recentContributors: Contributor[];
  currentPace: number; // miles/kilometers per day
  estimatedCompletion: Date | null;
  milestones: Milestone[];
  isLoading: boolean;
}

interface UseLiveProgressOptions {
  teamId: string;
  goalId: string;
  targetDistance: number;
  initialProgress?: TeamProgressData;
  routeData?: RouteData;
}

export function useLiveProgress({
  teamId,
  goalId,
  targetDistance,
  initialProgress,
  routeData,
}: UseLiveProgressOptions): LiveProgressState {
  const queryClient = useQueryClient();
  const { isConnected } = useWebSocketContext();
  const animationFrameRef = useRef<number>();
  const targetDistanceRef = useRef<number>(0);
  const currentDistanceRef = useRef<number>(0);

  const [state, setState] = useState<LiveProgressState>({
    progress: initialProgress || {
      totalDistance: 0,
      totalActivities: 0,
      totalDuration: 0,
      currentSegmentIndex: 0,
      segmentProgress: 0,
    },
    recentContributors: [],
    currentPace: 0,
    estimatedCompletion: null,
    milestones: generateMilestones(targetDistance, routeData),
    isLoading: !initialProgress,
  });

  // Generate milestones based on target distance and route
  function generateMilestones(target: number, route?: RouteData): Milestone[] {
    const milestones: Milestone[] = [];
    
    // Add percentage-based milestones
    [25, 50, 75, 100].forEach(percent => {
      milestones.push({
        id: `percent-${percent}`,
        name: `${percent}% Complete`,
        distance: (target * percent) / 100,
        reached: false,
      });
    });

    // Add waypoint milestones if route data exists
    if (route?.waypoints) {
      let cumulativeDistance = 0;
      route.waypoints.forEach((waypoint, index) => {
        if (index > 0 && route.segments[index - 1]) {
          cumulativeDistance += route.segments[index - 1].distance;
          milestones.push({
            id: `waypoint-${index}`,
            name: waypoint.address.split(',')[0], // First part of address
            distance: cumulativeDistance,
            reached: false,
          });
        }
      });
    }

    return milestones.sort((a, b) => a.distance - b.distance);
  }

  // Smooth animation for distance updates
  const animateDistanceUpdate = useCallback((targetDistance: number) => {
    const startDistance = currentDistanceRef.current;
    const difference = targetDistance - startDistance;
    const duration = 1000; // 1 second animation
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentDistance = startDistance + (difference * easeOutQuart);
      
      currentDistanceRef.current = currentDistance;
      targetDistanceRef.current = targetDistance;

      setState(prev => ({
        ...prev,
        progress: {
          ...prev.progress,
          totalDistance: currentDistance,
        },
      }));

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    // Cancel any existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animate();
  }, []);

  // Calculate current pace based on recent activities
  const calculatePace = useCallback((progress: TeamProgressData): number => {
    if (!progress.lastActivityAt || progress.totalActivities === 0) return 0;
    
    const daysSinceStart = Math.ceil(
      (Date.now() - new Date(progress.lastActivityAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    return daysSinceStart > 0 ? progress.totalDistance / daysSinceStart : 0;
  }, []);

  // Estimate completion date based on current pace
  const estimateCompletion = useCallback((
    currentDistance: number,
    target: number,
    pace: number
  ): Date | null => {
    if (pace <= 0 || currentDistance >= target) return null;
    
    const remainingDistance = target - currentDistance;
    const daysToComplete = Math.ceil(remainingDistance / pace);
    
    const completionDate = new Date();
    completionDate.setDate(completionDate.getDate() + daysToComplete);
    
    return completionDate;
  }, []);

  // Update milestones based on current progress
  const updateMilestones = useCallback((
    milestones: Milestone[],
    currentDistance: number
  ): Milestone[] => {
    return milestones.map(milestone => ({
      ...milestone,
      reached: currentDistance >= milestone.distance,
      reachedAt: milestone.reached || currentDistance < milestone.distance
        ? milestone.reachedAt
        : new Date().toISOString(),
    }));
  }, []);

  // Handle real-time progress updates
  useEffect(() => {
    if (!isConnected) return;

    // Subscribe to progress updates via WebSocket context
    const handleProgressUpdate = (data: any) => {
      if (data.teamGoalId === goalId) {
        // Animate distance update
        animateDistanceUpdate(data.totalDistance);

        // Update other progress data
        setState(prev => {
          const pace = calculatePace(data);
          const completion = estimateCompletion(data.totalDistance, targetDistance, pace);
          const updatedMilestones = updateMilestones(prev.milestones, data.totalDistance);

          return {
            ...prev,
            progress: {
              ...prev.progress,
              totalActivities: data.totalActivities || prev.progress.totalActivities,
              totalDuration: data.totalDuration || prev.progress.totalDuration,
              currentSegmentIndex: data.currentSegmentIndex || prev.progress.currentSegmentIndex,
              segmentProgress: data.segmentProgress || prev.progress.segmentProgress,
              lastActivityAt: data.lastActivityAt,
            },
            recentContributors: data.topContributors || prev.recentContributors,
            currentPace: pace,
            estimatedCompletion: completion,
            milestones: updatedMilestones,
            isLoading: false,
          };
        });
      }
    };

    // Listen for updates through React Query invalidations
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.query?.queryKey?.[0] === 'team-progress' && 
          event?.query?.queryKey?.[1] === teamId) {
        const data = event.query.state.data;
        if (data) {
          handleProgressUpdate(data);
        }
      }
    });

    return () => {
      unsubscribe();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isConnected, teamId, goalId, targetDistance, queryClient, animateDistanceUpdate, calculatePace, estimateCompletion, updateMilestones]);

  // Load initial data
  useEffect(() => {
    if (!initialProgress && teamId && goalId) {
      // Fetch initial progress data
      queryClient.fetchQuery({
        queryKey: ['team-progress', teamId],
        queryFn: async () => {
          // This would be replaced with actual API call
          return {
            totalDistance: 0,
            totalActivities: 0,
            totalDuration: 0,
            currentSegmentIndex: 0,
            segmentProgress: 0,
          };
        },
      }).then(data => {
        if (data) {
          setState(prev => ({
            ...prev,
            progress: data,
            isLoading: false,
          }));
          currentDistanceRef.current = data.totalDistance;
        }
      });
    } else if (initialProgress) {
      currentDistanceRef.current = initialProgress.totalDistance;
    }
  }, [teamId, goalId, initialProgress, queryClient]);

  return state;
}