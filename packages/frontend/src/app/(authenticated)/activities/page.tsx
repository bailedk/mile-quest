'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/patterns/Button';
import { Card } from '@/components/patterns/Card';
import { PlusIcon, CalendarIcon, ClockIcon, MapPinIcon, LockIcon } from '@/components/icons';
import { useAuthStore } from '@/store/auth.store';
import { activityService, formatDistance, formatDuration, calculatePace } from '@/services/activity.service';
import { ActivityListItem, ActivityStats } from '@/types/activity.types';
import { useHydration } from '@/contexts/HydrationContext';
import { formatDateSafe, dateFormats } from '@/utils/date-formatting';
import { MobileLayout, useMobileLayout } from '@/components/layout/MobileLayout';
import { TouchButton, TouchCard, PullToRefresh } from '@/components/mobile/TouchInteractions';

export default function ActivitiesPage() {
  return <ActivitiesContent />;
}

function ActivitiesContent() {
  const router = useRouter();
  const { isHydrated } = useHydration();
  const { user } = useAuthStore();
  const { isMobile } = useMobileLayout();
  const [activities, setActivities] = useState<ActivityListItem[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadActivities = async () => {
    try {
      setIsLoading(true);
      const [activitiesData, statsData] = await Promise.all([
        activityService.getUserActivities(),
        activityService.getUserStats(),
      ]);
      
      console.log('Activities data received:', activitiesData);
      setActivities(Array.isArray(activitiesData) ? activitiesData : []);
      setStats(statsData);
      setError(null);
    } catch (error) {
      console.error('Failed to load activities:', error);
      setError('Failed to load activities. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, []);

  // Use hydration-safe date formatting
  const formatDate = (dateString: string) => {
    return formatDateSafe(dateString, dateFormats.dateWithDay, isHydrated);
  };

  const formatTime = (dateString: string) => {
    return formatDateSafe(dateString, dateFormats.time12, isHydrated);
  };

  const loadingContent = (
    <div className={isMobile ? "px-4 py-6" : "container mx-auto px-4 py-8"}>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className={isMobile ? "text-2xl font-bold" : "text-3xl font-bold"}>My Activities</h1>
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

  if (isLoading) {
    return isMobile ? (
      <MobileLayout title="Activities">
        {loadingContent}
      </MobileLayout>
    ) : loadingContent;
  }

  const errorContent = (
    <div className={isMobile ? "px-4 py-6" : "container mx-auto px-4 py-8"}>
      <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded">
        {error}
      </div>
    </div>
  );

  if (error) {
    return isMobile ? (
      <MobileLayout title="Activities">
        {errorContent}
      </MobileLayout>
    ) : errorContent;
  }

  const mainContent = (
    <div className={isMobile ? "px-4 py-6 pb-20" : "container mx-auto px-4 py-8"}>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className={isMobile ? "text-2xl font-bold" : "text-3xl font-bold"}>My Activities</h1>
          <p className="text-gray-600">Track your walking and running progress</p>
        </div>
        {isMobile ? (
          <TouchButton onClick={() => router.push('/activities/new')} variant="primary" size="sm">
            <PlusIcon className="h-4 w-4" />
          </TouchButton>
        ) : (
          <Button onClick={() => router.push('/activities/new')} leftIcon={<PlusIcon />}>
            Log Activity
          </Button>
        )}
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className={`grid gap-4 mb-8 ${isMobile ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-4'}`}>
          {isMobile ? (
            <>
              <TouchCard className="p-4 bg-white rounded-lg border border-gray-100 shadow-sm">
                <p className="text-sm text-gray-600 mb-1">Total Distance</p>
                <p className="text-xl font-bold">
                  {formatDistance(stats.totalDistance)}
                </p>
              </TouchCard>
              <TouchCard className="p-4 bg-white rounded-lg border border-gray-100 shadow-sm">
                <p className="text-sm text-gray-600 mb-1">Total Activities</p>
                <p className="text-xl font-bold">{stats.totalActivities}</p>
              </TouchCard>
              <TouchCard className="p-4 bg-white rounded-lg border border-gray-100 shadow-sm">
                <p className="text-sm text-gray-600 mb-1">Current Streak</p>
                <p className="text-xl font-bold">{stats.currentStreak} days</p>
              </TouchCard>
              <TouchCard className="p-4 bg-white rounded-lg border border-gray-100 shadow-sm">
                <p className="text-sm text-gray-600 mb-1">Average Distance</p>
                <p className="text-xl font-bold">
                  {formatDistance(stats.averageDistance)}
                </p>
              </TouchCard>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}

      {/* Activities List */}
      {!activities || activities.length === 0 ? (
        isMobile ? (
          <TouchCard className="text-center p-6 bg-white rounded-lg border border-gray-100 shadow-sm">
            <h3 className="text-lg font-semibold mb-2">No Activities Yet</h3>
            <p className="text-gray-600 mb-4">
              Start logging your activities to track your progress
            </p>
            <TouchButton onClick={() => router.push('/activities/new')} variant="primary" className="w-full">
              <PlusIcon className="h-4 w-4 mr-2" />
              Log Your First Activity
            </TouchButton>
          </TouchCard>
        ) : (
          <Card className="text-center">
            <h3 className="text-lg font-semibold mb-2">No Activities Yet</h3>
            <p className="text-gray-600 mb-4">
              Start logging your activities to track your progress
            </p>
            <Button onClick={() => router.push('/activities/new')} leftIcon={<PlusIcon />}>
              Log Your First Activity
            </Button>
          </Card>
        )
      ) : (
        <div className="space-y-4">
          {activities && activities.map((activity) => (
            isMobile ? (
              <div key={activity.id} className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
                <ActivityItem activity={activity} formatDate={formatDate} formatTime={formatTime} />
              </div>
            ) : (
              <Card key={activity.id} hoverable>
                <ActivityItem activity={activity} formatDate={formatDate} formatTime={formatTime} />
              </Card>
            )
          ))}
        </div>
      )}
    </div>
  );

  // Helper component to avoid code duplication
  function ActivityItem({ activity, formatDate, formatTime }: { activity: ActivityListItem; formatDate: (date: string) => string; formatTime: (date: string) => string }) {
    return (
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-2">
            <h3 className="font-semibold text-lg">
              {formatDistance(activity.distance)}
            </h3>
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
              {formatDate(activity.timestamp)}
            </div>
            
            <div className="flex items-center">
              <ClockIcon className="h-4 w-4 mr-1" />
              {formatTime(activity.timestamp)}
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

        </div>

        <div className="text-right text-sm text-gray-600">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {activity.source}
          </span>
        </div>
      </div>
    );
  }

  return isMobile ? (
    <MobileLayout title="Activities">
      <PullToRefresh onRefresh={loadActivities}>
        {mainContent}
      </PullToRefresh>
    </MobileLayout>
  ) : mainContent;
}