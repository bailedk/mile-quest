'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { useGoalCreation } from '@/hooks/useGoalCreation';
import { teamService } from '@/services/team.service';
import { mapService } from '@/services/map';
import { Button } from '@/components/patterns/Button';
import { Team } from '@/types/team.types';
import { Waypoint } from '@mile-quest/shared';
import { MapSearchResult } from '@/services/map/mapService.interface';

export default function GoalCreationPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const teamId = params.id as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MapSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const {
    formData,
    isCalculatingRoute,
    routeCalculationError,
    totalDistance,
    validationErrors,
    isDirty,
    hasValidationErrors,
    isValid,
    updateField,
    addWaypoint,
    removeWaypoint,
    reorderWaypoints,
    validate,
    submit,
    isSubmitting,
  } = useGoalCreation({
    teamId,
    onSuccess: (goalId) => {
      router.push(`/teams/${teamId}`);
    },
  });

  // Load team data
  useEffect(() => {
    if (!user) {
      router.push('/signin');
      return;
    }

    loadTeam();
  }, [user, router, teamId]);

  const loadTeam = async () => {
    try {
      setIsLoading(true);
      const teamData = await teamService.getTeam(teamId);
      setTeam(teamData);
      
      // Check if user is admin
      const currentUserMember = teamData.members.find(m => m.user.email === user?.email);
      if (currentUserMember?.role !== 'ADMIN') {
        router.push(`/teams/${teamId}`);
      }
    } catch (err) {
      router.push('/teams');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await mapService.searchLocation(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddSearchResult = (result: MapSearchResult) => {
    const waypoint: Waypoint = {
      name: result.name,
      address: result.address,
      coordinates: result.coordinates,
      order: formData.waypoints.length,
    };
    addWaypoint(waypoint);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSubmit = async () => {
    try {
      await submit();
    } catch (error) {
      console.error('Failed to create goal:', error);
    }
  };

  // Debug logging
  console.log('Form validation state:', {
    isValid,
    isSubmitting,
    isCalculatingRoute,
    formData,
    totalDistance,
    validationErrors,
    hasValidationErrors,
  });

  if (!user || isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!team) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push(`/teams/${teamId}`)}
          className="inline-flex items-center mb-4 text-blue-600 hover:underline"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to {team.name}
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Create Team Goal</h1>
        <p className="mt-2 text-gray-600">Set a geographic destination for your team to reach together.</p>
      </div>

      {/* Form */}
      <div className="bg-white shadow-md rounded-lg p-6 space-y-6">
        {/* Goal Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Goal Name *
          </label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
              validationErrors.name ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="e.g., Walk to New York City"
          />
          {validationErrors.name && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.name}</p>
          )}
        </div>

        {/* Goal Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => updateField('description', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="Describe your team's journey and what you hope to achieve..."
          />
        </div>

        {/* Target Date */}
        <div>
          <label htmlFor="targetDate" className="block text-sm font-medium text-gray-700 mb-1">
            Target Completion Date
          </label>
          <input
            id="targetDate"
            type="date"
            value={formData.targetDate || ''}
            onChange={(e) => updateField('targetDate', e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
              validationErrors.targetDate ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          {validationErrors.targetDate && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.targetDate}</p>
          )}
        </div>

        {/* Waypoints */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Route Waypoints</h3>
          
          {/* Search */}
          <div className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search for a location..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <Button
                onClick={handleSearch}
                disabled={isSearching}
                variant="secondary"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </Button>
            </div>
            
            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded-md shadow-sm">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleAddSearchResult(result)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-200 last:border-0"
                  >
                    <p className="font-medium text-gray-900">{result.name}</p>
                    <p className="text-sm text-gray-600">{result.address}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Waypoint List */}
          {formData.waypoints.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Add at least 2 waypoints to create a route
            </p>
          ) : (
            <div className="space-y-2">
              {formData.waypoints.map((waypoint, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-md"
                >
                  <span className="text-sm font-medium text-gray-500 w-8">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{waypoint.name}</p>
                    <p className="text-sm text-gray-600">{waypoint.address}</p>
                  </div>
                  <button
                    onClick={() => removeWaypoint(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {validationErrors.waypoints && (
            <p className="mt-2 text-sm text-red-600">{validationErrors.waypoints}</p>
          )}
        </div>

        {/* Route Summary */}
        {totalDistance > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Route Summary</h4>
            <p className="text-blue-800">
              Total Distance: <span className="font-bold">{totalDistance.toFixed(1)} miles</span>
            </p>
            <p className="text-sm text-blue-700 mt-1">
              (straight-line distance between waypoints)
            </p>
            {isCalculatingRoute && (
              <p className="text-sm text-blue-600 mt-1">Calculating distance...</p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="secondary"
            onClick={() => router.push(`/teams/${teamId}`)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting || isCalculatingRoute}
          >
            {isSubmitting ? 'Creating...' : 'Create Goal'}
          </Button>
        </div>
      </div>
    </div>
  );
}