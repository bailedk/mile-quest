'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/patterns/Button';
import { Card } from '@/components/patterns/Card';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { ArrowLeftIcon, CalendarIcon, ClockIcon, MapPinIcon, UsersIcon, LockIcon } from '@/components/icons';
import { useAuthStore } from '@/store/auth.store';
import { teamService } from '@/services/team.service';
import { activityService, validateDistance, validateDuration } from '@/services/activity.service';
import { ActivityFormData, ActivityFormErrors } from '@/types/activity.types';
import { TeamListItem } from '@/types/team.types';

export default function NewActivityPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<ActivityFormErrors>({});
  const [userTeams, setUserTeams] = useState<TeamListItem[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);

  const [formData, setFormData] = useState<ActivityFormData>({
    teamId: '',
    distance: '',
    duration: '',
    date: new Date().toISOString().split('T')[0], // Today's date
    startTime: '',
    endTime: '',
    notes: '',
    isPrivate: false,
  });

  // Load user's teams
  useEffect(() => {
    async function loadTeams() {
      if (!user) {
        router.push('/login');
        return;
      }

      try {
        const teams = await teamService.getUserTeams();
        setUserTeams(teams);
        
        // Pre-select team if only one
        if (teams.length === 1) {
          setFormData(prev => ({ ...prev, teamId: teams[0].id }));
        }
      } catch (error) {
        console.error('Failed to load teams:', error);
        setErrors({ general: 'Failed to load your teams' });
      } finally {
        setIsLoadingTeams(false);
      }
    }

    loadTeams();
  }, [user, router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    // Clear error when user starts typing
    if (errors[name as keyof ActivityFormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: ActivityFormErrors = {};

    // Team validation
    if (!formData.teamId) {
      newErrors.teamId = 'Please select a team';
    }

    // Distance validation
    if (!formData.distance) {
      newErrors.distance = 'Distance is required';
    } else {
      const distanceMeters = parseFloat(formData.distance) * 1609.34; // Convert miles to meters
      const distanceError = validateDistance(distanceMeters);
      if (distanceError) {
        newErrors.distance = distanceError;
      }
    }

    // Duration validation
    if (!formData.duration) {
      newErrors.duration = 'Duration is required';
    } else {
      const durationSeconds = parseInt(formData.duration) * 60; // Convert minutes to seconds
      const durationError = validateDuration(durationSeconds);
      if (durationError) {
        newErrors.duration = durationError;
      }
    }

    // Date validation
    if (!formData.date) {
      newErrors.date = 'Date is required';
    } else {
      const activityDate = new Date(formData.date);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      
      if (activityDate > today) {
        newErrors.date = 'Cannot log future activities';
      } else if (activityDate < new Date('2020-01-01')) {
        newErrors.date = 'Date seems too old';
      }
    }

    // Time validation
    if (!formData.startTime) {
      newErrors.startTime = 'Start time is required';
    }
    if (!formData.endTime) {
      newErrors.endTime = 'End time is required';
    }
    
    if (formData.startTime && formData.endTime) {
      const [startHour, startMin] = formData.startTime.split(':').map(Number);
      const [endHour, endMin] = formData.endTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      
      if (endMinutes <= startMinutes) {
        newErrors.endTime = 'End time must be after start time';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Convert form data to API format
      const distanceMeters = parseFloat(formData.distance) * 1609.34; // Miles to meters
      const durationSeconds = parseInt(formData.duration) * 60; // Minutes to seconds
      
      const startDateTime = new Date(`${formData.date}T${formData.startTime}:00`);
      const endDateTime = new Date(`${formData.date}T${formData.endTime}:00`);

      await activityService.createActivity({
        teamId: formData.teamId,
        distance: distanceMeters,
        duration: durationSeconds,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        notes: formData.notes || undefined,
        isPrivate: formData.isPrivate,
      });

      // Redirect to activities list
      router.push('/activities');
    } catch (error) {
      console.error('Failed to create activity:', error);
      setErrors({ general: 'Failed to log activity. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingTeams) {
    return (
      <MobileLayout title="Log Activity" showBack={true}>
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">Loading your teams...</div>
        </div>
      </MobileLayout>
    );
  }

  if (userTeams.length === 0) {
    return (
      <MobileLayout title="Log Activity" showBack={true}>
        <div className="max-w-md mx-auto px-4 py-6">
          <Card>
            <h2 className="text-2xl font-bold mb-2">No Teams Found</h2>
            <p className="text-gray-600 mb-4">
              You need to join a team before you can log activities.
            </p>
            <Button onClick={() => router.push('/teams/join')}>
              Join a Team
            </Button>
          </Card>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout title="Log Activity" showBack={true}>
      <div className="max-w-md mx-auto px-4 py-6">
        <Card>
          <form onSubmit={handleSubmit}>
          <h2 className="text-2xl font-bold mb-2">Log Activity</h2>
          <p className="text-gray-600 mb-6">
            Record your walking or running activity
          </p>

          {errors.general && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
              {errors.general}
            </div>
          )}

          {/* Team Selection */}
          <div className="mb-4">
            <label htmlFor="teamId" className="block text-sm font-medium text-gray-700 mb-1">
              <UsersIcon className="h-4 w-4 inline mr-1" />
              Team
            </label>
            <select
              id="teamId"
              name="teamId"
              value={formData.teamId}
              onChange={handleInputChange}
              className={`w-full px-4 py-3 border rounded-lg text-gray-900 text-base min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.teamId ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select a team</option>
              {userTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name} ({team.memberCount} members)
                </option>
              ))}
            </select>
            {errors.teamId && (
              <p className="mt-1 text-sm text-red-600">{errors.teamId}</p>
            )}
          </div>

          {/* Distance and Duration */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="distance" className="block text-sm font-medium text-gray-700 mb-1">
                <MapPinIcon className="h-4 w-4 inline mr-1" />
                Distance (miles)
              </label>
              <input
                type="number"
                id="distance"
                name="distance"
                step="0.01"
                placeholder="5.5"
                value={formData.distance}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 border rounded-lg text-gray-900 text-base min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.distance ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.distance && (
                <p className="mt-1 text-sm text-red-600">{errors.distance}</p>
              )}
            </div>

            <div>
              <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
                <ClockIcon className="h-4 w-4 inline mr-1" />
                Duration (minutes)
              </label>
              <input
                type="number"
                id="duration"
                name="duration"
                placeholder="45"
                value={formData.duration}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 border rounded-lg text-gray-900 text-base min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.duration ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.duration && (
                <p className="mt-1 text-sm text-red-600">{errors.duration}</p>
              )}
            </div>
          </div>

          {/* Date and Time */}
          <div className="mb-4">
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
              <CalendarIcon className="h-4 w-4 inline mr-1" />
              Date
            </label>
            <input
              type="date"
              id="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              max={new Date().toISOString().split('T')[0]}
              className={`w-full px-4 py-3 border rounded-lg text-gray-900 text-base min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.date ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.date && (
              <p className="mt-1 text-sm text-red-600">{errors.date}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-1">
                Start Time
              </label>
              <input
                type="time"
                id="startTime"
                name="startTime"
                value={formData.startTime}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 border rounded-lg text-gray-900 text-base min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.startTime ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.startTime && (
                <p className="mt-1 text-sm text-red-600">{errors.startTime}</p>
              )}
            </div>

            <div>
              <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-1">
                End Time
              </label>
              <input
                type="time"
                id="endTime"
                name="endTime"
                value={formData.endTime}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 border rounded-lg text-gray-900 text-base min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.endTime ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.endTime && (
                <p className="mt-1 text-sm text-red-600">{errors.endTime}</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="mb-4">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              id="notes"
              name="notes"
              placeholder="Beautiful morning walk in the park..."
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 text-base min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Privacy Toggle */}
          <div className="mb-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="isPrivate"
                checked={formData.isPrivate}
                onChange={handleInputChange}
                className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm font-medium text-gray-700">
                <LockIcon className="h-4 w-4 inline mr-1" />
                Private Activity
              </span>
            </label>
            <p className="text-sm text-gray-600 mt-1 ml-6">
              Private activities count toward team goals but are not visible to other members
            </p>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            isLoading={isSubmitting}
          >
            {isSubmitting ? 'Logging Activity...' : 'Log Activity'}
          </Button>
        </form>
        </Card>
      </div>
    </MobileLayout>
  );
}