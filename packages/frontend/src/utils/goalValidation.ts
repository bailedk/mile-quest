import { GoalFormData, GoalValidationErrors } from '@/types/goal.types';

export const goalValidation = {
  /**
   * Validate the entire goal form
   */
  validateForm: (formData: GoalFormData): GoalValidationErrors => {
    const errors: GoalValidationErrors = {};

    // Validate name
    if (!formData.name || formData.name.trim().length === 0) {
      errors.name = 'Goal name is required';
    } else if (formData.name.length > 100) {
      errors.name = 'Goal name must be 100 characters or less';
    }

    // Validate description
    if (formData.description && formData.description.length > 500) {
      errors.description = 'Description must be 500 characters or less';
    }

    // Validate team
    if (!formData.teamId) {
      errors.teamId = 'Please select a team';
    }

    // Validate target date
    if (formData.targetDate) {
      const targetDate = new Date(formData.targetDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (targetDate < today) {
        errors.targetDate = 'Target date must be in the future';
      }
    }

    // Validate waypoints
    if (!formData.waypoints || formData.waypoints.length < 2) {
      errors.waypoints = 'At least 2 waypoints are required to create a route';
    } else if (formData.waypoints.length > 10) {
      errors.waypoints = 'Maximum 10 waypoints allowed';
    }

    return errors;
  },

  /**
   * Check if the form has any validation errors
   */
  hasErrors: (errors: GoalValidationErrors): boolean => {
    return Object.keys(errors).length > 0;
  },

  /**
   * Check if the form is valid for submission
   */
  isFormValid: (formData: GoalFormData): boolean => {
    const errors = goalValidation.validateForm(formData);
    return !goalValidation.hasErrors(errors);
  },

  /**
   * Validate a single waypoint
   */
  validateWaypoint: (waypoint: { lat: number; lng: number; address: string }) => {
    if (!waypoint.address || waypoint.address.trim().length === 0) {
      return 'Address is required';
    }
    
    if (typeof waypoint.lat !== 'number' || waypoint.lat < -90 || waypoint.lat > 90) {
      return 'Invalid latitude';
    }
    
    if (typeof waypoint.lng !== 'number' || waypoint.lng < -180 || waypoint.lng > 180) {
      return 'Invalid longitude';
    }
    
    return null;
  },
};