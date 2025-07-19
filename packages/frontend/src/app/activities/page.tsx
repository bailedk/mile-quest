'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/patterns/Button';
import { Card } from '@/components/patterns/Card';
import { PlusIcon, CalendarIcon, ClockIcon, MapPinIcon, UsersIcon, LockIcon } from '@/components/icons';
import { useAuthStore } from '@/store/auth.store';
import { activityService, formatDistance, formatDuration, calculatePace } from '@/services/activity.service';
import { ActivityListItem, ActivityStats } from '@/types/activity.types';

export default function ActivitiesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [activities, setActivities] = useState<ActivityListItem[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadActivities() {
      if (!user) {
        router.push('/login');
        return;
      }

      try {
        const [activitiesData, statsData] = await Promise.all([
          activityService.getUserActivities(),
          activityService.getUserStats(),
        ]);
        
        setActivities(activitiesData);
        setStats(statsData);
      } catch (error) {
        console.error('Failed to load activities:', error);
        setError('Failed to load activities. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }

    loadActivities();
  }, [user, router]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">My Activities</h1>
            <p className="text-gray-600">Track your walking and running progress</p>
          </div>
          <div className="w-32 h-10 bg-gray-200 rounded animate-pulse" />
        </div>

        {/* Stats Loading */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>

        {/* Activities Loading */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">My Activities</h1>
          <p className="text-gray-600">Track your walking and running progress</p>
        </div>
        <Button onClick={() => router.push('/activities/new')} leftIcon={<PlusIcon />}>
          Log Activity
        </Button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card padding="sm">
            <p className="text-sm text-gray-600 mb-1">Total Distance</p>
            <p className="text-2xl font-bold">
              {formatDistance(stats.totalDistance)}
            </p>
          </Card>

          <Card padding="sm">
            <p className="text-sm text-gray-600 mb-1">Total Activities</p>
            <p className="text-2xl font-bold">{stats.totalActivities}</p>
          </Card>

          <Card padding="sm">
            <p className="text-sm text-gray-600 mb-1">Current Streak</p>
            <p className="text-2xl font-bold">{stats.currentStreak} days</p>
          </Card>

          <Card padding="sm">
            <p className="text-sm text-gray-600 mb-1">Average Distance</p>
            <p className="text-2xl font-bold">
              {formatDistance(stats.averageDistance)}
            </p>
          </Card>
        </div>
      )}

      {/* Activities List */}
      {activities.length === 0 ? (
        <Card className="text-center">
          <h3 className="text-lg font-semibold mb-2">No Activities Yet</h3>
          <p className="text-gray-600 mb-4">
            Start logging your activities to track your progress
          </p>
          <Button onClick={() => router.push('/activities/new')} leftIcon={<PlusIcon />}>
            Log Your First Activity
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {activities.map((activity) => (
            <Card key={activity.id} hoverable>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-2">
                    <h3 className="font-semibold text-lg">
                      {formatDistance(activity.distance)}
                    </h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      <UsersIcon className="h-3 w-3 mr-1" />
                      {activity.team.name}
                    </span>
                    {activity.isPrivate && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        <LockIcon className="h-3 w-3 mr-1" />
                        Private
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <CalendarIcon className="h-4 w-4 mr-1" />
                      {formatDate(activity.startTime)}
                    </div>
                    
                    <div className="flex items-center">
                      <ClockIcon className="h-4 w-4 mr-1" />
                      {formatTime(activity.startTime)} - {formatTime(activity.endTime)}
                      <span className="ml-2">({formatDuration(activity.duration)})</span>
                    </div>
                    
                    <div className="flex items-center">
                      <MapPinIcon className="h-4 w-4 mr-1" />
                      Pace: {calculatePace(activity.distance, activity.duration)}/mi
                    </div>
                  </div>

                  {activity.notes && (
                    <p className="mt-3 text-sm">{activity.notes}</p>
                  )}

                  {activity.teamGoal && (
                    <div className="mt-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Goal: {activity.teamGoal.name}
                      </span>
                    </div>
                  )}
                </div>

                <div className="text-right text-sm text-gray-600">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {activity.source}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}