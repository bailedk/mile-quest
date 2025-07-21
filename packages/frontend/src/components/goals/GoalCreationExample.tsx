'use client';

import { useState } from 'react';
import { useGoalCreation } from '@/hooks/useGoalCreation';
import { Waypoint } from '@mile-quest/shared';

/**
 * Example component demonstrating how to use the useGoalCreation hook
 * This shows all the features including:
 * - Form field management
 * - Waypoint CRUD operations
 * - Drag-and-drop reordering
 * - Validation
 * - Route calculation
 * - Draft persistence
 */
export function GoalCreationExample() {
  const {
    // State
    formData,
    isCalculatingRoute,
    routeCalculationError,
    totalDistance,
    validationErrors,
    isDirty,
    hasValidationErrors,
    isValid,
    
    // Actions
    updateField,
    addWaypoint,
    removeWaypoint,
    reorderWaypoints,
    updateWaypoint,
    validate,
    submit,
    clearDraft,
    
    // Mutation state
    isSubmitting,
    submitError,
  } = useGoalCreation({
    teamId: 'default-team-id',
    onSuccess: (goalId) => {
      console.log('Goal created:', goalId);
      // Navigate to goal details page
    },
  });

  // Example: Add waypoint from address search
  const handleAddWaypoint = () => {
    const newWaypoint: Waypoint = {
      lat: 40.7128,
      lng: -74.0060,
      address: 'New York, NY',
    };
    addWaypoint(newWaypoint);
  };

  // Example: Handle drag end for reordering
  const handleDragEnd = (fromIndex: number, toIndex: number) => {
    reorderWaypoints(fromIndex, toIndex);
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Create Team Goal</h1>
      
      {/* Goal Name */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">
          Goal Name
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => updateField('name', e.target.value)}
          className="w-full p-2 border rounded"
          placeholder="e.g., Walk to Chicago"
        />
        {validationErrors.name && (
          <p className="text-red-500 text-sm mt-1">{validationErrors.name}</p>
        )}
      </div>

      {/* Description */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">
          Description
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => updateField('description', e.target.value)}
          className="w-full p-2 border rounded"
          rows={3}
          placeholder="Describe your team's journey..."
        />
        {validationErrors.description && (
          <p className="text-red-500 text-sm mt-1">{validationErrors.description}</p>
        )}
      </div>

      {/* Target Date */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">
          Target Date (Optional)
        </label>
        <input
          type="date"
          value={formData.targetDate || ''}
          onChange={(e) => updateField('targetDate', e.target.value)}
          className="w-full p-2 border rounded"
        />
        {validationErrors.targetDate && (
          <p className="text-red-500 text-sm mt-1">{validationErrors.targetDate}</p>
        )}
      </div>

      {/* Waypoints */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          Route Waypoints
        </label>
        
        {formData.waypoints.length === 0 ? (
          <p className="text-gray-500 mb-2">No waypoints added yet</p>
        ) : (
          <div className="space-y-2 mb-4">
            {formData.waypoints.map((waypoint, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 border rounded"
                draggable
                onDragEnd={() => handleDragEnd(index, index + 1)}
              >
                <span className="text-sm font-medium">#{index + 1}</span>
                <span className="flex-1">{waypoint.address}</span>
                <button
                  onClick={() => removeWaypoint(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        
        <button
          onClick={handleAddWaypoint}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Add Waypoint
        </button>
        
        {validationErrors.waypoints && (
          <p className="text-red-500 text-sm mt-1">{validationErrors.waypoints}</p>
        )}
      </div>

      {/* Route Info */}
      {isCalculatingRoute && (
        <div className="mb-4 p-4 bg-blue-50 rounded">
          <p className="text-blue-700">Calculating route...</p>
        </div>
      )}
      
      {routeCalculationError && (
        <div className="mb-4 p-4 bg-red-50 rounded">
          <p className="text-red-700">{routeCalculationError}</p>
        </div>
      )}
      
      {totalDistance > 0 && !isCalculatingRoute && (
        <div className="mb-4 p-4 bg-green-50 rounded">
          <p className="text-green-700">
            Total Distance: {totalDistance.toFixed(1)} miles
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={() => submit()}
          disabled={!isValid || isSubmitting}
          className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Creating...' : 'Create Goal'}
        </button>
        
        {isDirty && (
          <button
            onClick={clearDraft}
            className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Clear Draft
          </button>
        )}
      </div>

      {/* Submit Error */}
      {submitError && (
        <div className="mt-4 p-4 bg-red-50 rounded">
          <p className="text-red-700">
            Failed to create goal. Please try again.
          </p>
        </div>
      )}
    </div>
  );
}