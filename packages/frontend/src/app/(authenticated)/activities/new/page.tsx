'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { TouchCard, TouchButton } from '@/components/mobile/TouchInteractions';
import { useAuthStore } from '@/store/auth.store';
import { activityService, formatDistance, formatDuration } from '@/services/activity.service';
import { useHydration } from '@/contexts/HydrationContext';
import { withAuth } from '@/components/auth/withAuth';
import { getDefaultDateInputValue, getDefaultTimeInputValue } from '@/utils/date-formatting';

interface ActivityFormData {
  distance: string;
  duration: string;
  date: string;
  time: string;
  notes: string;
  isPrivate: boolean;
}

function NewActivityPage() {
  const router = useRouter();
  const { isHydrated } = useHydration();
  const { user } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quickDistance, setQuickDistance] = useState<number | null>(null);
  
  // Initialize with empty values to avoid hydration mismatch
  const [formData, setFormData] = useState<ActivityFormData>({
    distance: '',
    duration: '',
    date: '',
    time: '',
    notes: '',
    isPrivate: false,
  });

  // Set current date/time after hydration
  useEffect(() => {
    if (isHydrated) {
      setFormData(prev => ({
        ...prev,
        date: getDefaultDateInputValue(true),
        time: getDefaultTimeInputValue(true),
      }));
    }
  }, [isHydrated]);

  const [errors, setErrors] = useState<Partial<ActivityFormData>>({});

  // Quick distance buttons
  const quickDistances = [1, 3, 5, 10]; // miles

  const handleQuickDistance = (miles: number) => {
    setQuickDistance(miles);
    setFormData(prev => ({ ...prev, distance: miles.toString() }));
    setErrors(prev => ({ ...prev, distance: '' }));
  };

  const handleInputChange = (field: keyof ActivityFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    // Clear quick distance selection if manually editing
    if (field === 'distance' && quickDistance !== null) {
      setQuickDistance(null);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<ActivityFormData> = {};

    if (!formData.distance || parseFloat(formData.distance) <= 0) {
      newErrors.distance = 'Please enter a valid distance';
    }

    if (!formData.duration || parseInt(formData.duration) <= 0) {
      newErrors.duration = 'Please enter a valid duration';
    }

    // Only validate date if we have both date and time
    if (formData.date && formData.time) {
      const activityDateTime = new Date(`${formData.date}T${formData.time}`);
      const now = new Date();
      if (activityDateTime > now) {
        newErrors.date = 'Cannot log future activities';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !user) return;

    setIsSubmitting(true);

    try {
      const distanceMeters = parseFloat(formData.distance) * 1609.34; // Miles to meters
      const durationSeconds = parseInt(formData.duration) * 60; // Minutes to seconds
      const timestamp = new Date(`${formData.date}T${formData.time}`);

      await activityService.createActivity({
        distance: distanceMeters,
        duration: durationSeconds,
        timestamp: timestamp.toISOString(),
        notes: formData.notes || undefined,
        isPrivate: formData.isPrivate,
      });

      // Redirect to dashboard
      // The cache has already been cleared in activityService.createActivity
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to create activity:', error);
      setErrors({ notes: 'Failed to log activity. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get user preferred units, default to miles during SSR
  const userPreferredUnits = isHydrated ? (user?.preferredUnits || 'miles') : 'miles';

  return (
    <MobileLayout title="Log Walk" showBack={true}>
      <div className="space-y-4 pb-20">
        {/* Quick Distance Selection */}
        <TouchCard>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Select Distance</h3>
          <div className="grid grid-cols-4 gap-2">
            {quickDistances.map((miles) => (
              <TouchButton
                key={miles}
                onClick={() => handleQuickDistance(miles)}
                variant={quickDistance === miles ? 'primary' : 'secondary'}
                size="sm"
                className="text-center"
              >
                {miles} mi
              </TouchButton>
            ))}
          </div>
        </TouchCard>

        {/* Main Form */}
        <TouchCard>
          <div className="space-y-4">
            {/* Distance Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Distance ({userPreferredUnits})
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.distance}
                onChange={(e) => handleInputChange('distance', e.target.value)}
                placeholder="0.0"
                className={`w-full px-4 py-3 border rounded-lg text-lg font-medium ${
                  errors.distance ? 'border-red-500' : 'border-gray-300'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              {errors.distance && (
                <p className="mt-1 text-sm text-red-600">{errors.distance}</p>
              )}
            </div>

            {/* Duration Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duration (minutes)
              </label>
              <input
                type="number"
                value={formData.duration}
                onChange={(e) => handleInputChange('duration', e.target.value)}
                placeholder="0"
                className={`w-full px-4 py-3 border rounded-lg text-lg font-medium ${
                  errors.duration ? 'border-red-500' : 'border-gray-300'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              {errors.duration && (
                <p className="mt-1 text-sm text-red-600">{errors.duration}</p>
              )}
              {formData.duration && parseFloat(formData.duration) > 0 && (
                <p className="mt-1 text-sm text-gray-500">
                  {formatDuration(parseInt(formData.duration) * 60)}
                </p>
              )}
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  max={getDefaultDateInputValue(isHydrated) || undefined}
                  className={`w-full px-4 py-3 border rounded-lg ${
                    errors.date ? 'border-red-500' : 'border-gray-300'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time
                </label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => handleInputChange('time', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            {errors.date && (
              <p className="mt-1 text-sm text-red-600">{errors.date}</p>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="How was your walk?"
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Privacy Toggle */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Private Activity</p>
                <p className="text-sm text-gray-600">
                  Hide from team leaderboards
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleInputChange('isPrivate', !formData.isPrivate)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.isPrivate ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.isPrivate ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </TouchCard>

        {/* Activity Summary */}
        {formData.distance && formData.duration && (
          <TouchCard className="bg-blue-50 border-blue-200">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Activity Summary</h3>
            <div className="space-y-1 text-sm text-blue-800">
              <div className="flex justify-between">
                <span>Distance:</span>
                <span className="font-medium">
                  {formatDistance(parseFloat(formData.distance) * 1609.34, userPreferredUnits)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Duration:</span>
                <span className="font-medium">
                  {formatDuration(parseInt(formData.duration) * 60)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Pace:</span>
                <span className="font-medium">
                  {Math.round(parseInt(formData.duration) / parseFloat(formData.distance))} min/mi
                </span>
              </div>
            </div>
          </TouchCard>
        )}

        {/* Error Message */}
        {errors.notes && (
          <TouchCard className="bg-red-50 border-red-200">
            <p className="text-red-800">{errors.notes}</p>
          </TouchCard>
        )}

        {/* Submit Button */}
        <TouchButton
          onClick={handleSubmit}
          variant="primary"
          size="lg"
          className="w-full"
          disabled={isSubmitting || !formData.distance || !formData.duration}
          hapticFeedback={true}
        >
          {isSubmitting ? 'Logging Activity...' : 'Log Activity'}
        </TouchButton>
      </div>
    </MobileLayout>
  );
}

export default withAuth(NewActivityPage);