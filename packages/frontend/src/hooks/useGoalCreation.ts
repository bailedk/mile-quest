import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Waypoint, RouteData, RouteSegment } from '@mile-quest/shared';
import { 
  GoalFormData, 
  GoalCreationState, 
  GoalDraft, 
  GoalValidationErrors 
} from '@/types/goal.types';
import { goalValidation } from '@/utils/goalValidation';
import { localStorageUtils } from '@/utils/localStorage';
import { useToast } from '@/hooks/useToast';
import { mapService } from '@/services/map';

interface UseGoalCreationOptions {
  teamId?: string;
  onSuccess?: (goalId: string) => void;
}


// Simple ID generator for draft IDs
const generateId = () => `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export function useGoalCreation(options: UseGoalCreationOptions = {}) {
  const { teamId: defaultTeamId, onSuccess } = options;
  const { showToast } = useToast();
  const draftId = useRef(generateId());
  const routeCalculationTimeout = useRef<NodeJS.Timeout>();
  
  // Initialize state
  const [state, setState] = useState<GoalCreationState>(() => {
    const draft = localStorageUtils.getGoalDraft();
    
    if (draft && draft.id === draftId.current) {
      return {
        formData: {
          name: draft.name,
          description: draft.description,
          teamId: draft.teamId || defaultTeamId || '',
          startDate: draft.startDate,
          targetDate: draft.targetDate,
          waypoints: draft.waypoints,
          routeData: draft.routeData,
        },
        isCalculatingRoute: false,
        totalDistance: draft.routeData?.segments.reduce((sum, seg) => sum + seg.distance, 0) || 0,
        validationErrors: {},
        isDirty: false,
        lastSavedDraft: draft,
      };
    }
    
    return {
      formData: {
        name: '',
        description: '',
        teamId: defaultTeamId || '',
        startDate: undefined,
        targetDate: undefined,
        waypoints: [],
        routeData: undefined,
      },
      isCalculatingRoute: false,
      totalDistance: 0,
      validationErrors: {},
      isDirty: false,
    };
  });

  // Auto-save draft when form data changes
  useEffect(() => {
    if (state.isDirty && localStorageUtils.isAvailable()) {
      const draft: GoalDraft = {
        id: draftId.current,
        ...state.formData,
        lastSaved: new Date().toISOString(),
      };
      localStorageUtils.saveGoalDraft(draft);
      setState(prev => ({ ...prev, lastSavedDraft: draft }));
    }
  }, [state.formData, state.isDirty]);

  // Update form field
  const updateField = useCallback(<K extends keyof GoalFormData>(
    field: K,
    value: GoalFormData[K]
  ) => {
    setState(prev => ({
      ...prev,
      formData: { ...prev.formData, [field]: value },
      isDirty: true,
      validationErrors: { ...prev.validationErrors, [field]: undefined },
    }));
  }, []);

  // Add waypoint
  const addWaypoint = useCallback((waypoint: Waypoint) => {
    setState(prev => {
      const newWaypoints = [...prev.formData.waypoints, waypoint];
      return {
        ...prev,
        formData: { ...prev.formData, waypoints: newWaypoints },
        isDirty: true,
        validationErrors: { ...prev.validationErrors, waypoints: undefined },
      };
    });
  }, []);

  // Remove waypoint
  const removeWaypoint = useCallback((index: number) => {
    setState(prev => {
      const newWaypoints = prev.formData.waypoints.filter((_, i) => i !== index);
      return {
        ...prev,
        formData: { ...prev.formData, waypoints: newWaypoints, routeData: undefined },
        totalDistance: 0,
        isDirty: true,
      };
    });
  }, []);

  // Reorder waypoints (for drag-and-drop)
  const reorderWaypoints = useCallback((fromIndex: number, toIndex: number) => {
    setState(prev => {
      const newWaypoints = [...prev.formData.waypoints];
      const [removed] = newWaypoints.splice(fromIndex, 1);
      newWaypoints.splice(toIndex, 0, removed);
      
      return {
        ...prev,
        formData: { ...prev.formData, waypoints: newWaypoints, routeData: undefined },
        totalDistance: 0,
        isDirty: true,
      };
    });
  }, []);

  // Update single waypoint
  const updateWaypoint = useCallback((index: number, waypoint: Waypoint) => {
    setState(prev => {
      const newWaypoints = [...prev.formData.waypoints];
      newWaypoints[index] = waypoint;
      
      return {
        ...prev,
        formData: { ...prev.formData, waypoints: newWaypoints, routeData: undefined },
        totalDistance: 0,
        isDirty: true,
        validationErrors: { ...prev.validationErrors, waypoints: undefined },
      };
    });
  }, []);

  // Calculate route with debouncing
  const calculateRouteDebounced = useCallback(() => {
    // Clear existing timeout
    if (routeCalculationTimeout.current) {
      clearTimeout(routeCalculationTimeout.current);
    }

    // Only calculate if we have at least 2 waypoints
    if (state.formData.waypoints.length < 2) {
      setState(prev => ({
        ...prev,
        routeData: undefined,
        totalDistance: 0,
      }));
      return;
    }

    // Set loading state
    setState(prev => ({ ...prev, isCalculatingRoute: true, routeCalculationError: undefined }));

    // Debounce the calculation
    routeCalculationTimeout.current = setTimeout(async () => {
      try {
        const routeData = await mapService.calculateRoute(state.formData.waypoints);
        const totalDistance = routeData.segments.reduce((sum, seg) => sum + seg.distance, 0);
        
        setState(prev => ({
          ...prev,
          formData: { ...prev.formData, routeData },
          totalDistance,
          isCalculatingRoute: false,
        }));
      } catch (error) {
        setState(prev => ({
          ...prev,
          isCalculatingRoute: false,
          routeCalculationError: 'Failed to calculate route. Please try again.',
        }));
        showToast('Failed to calculate route', 'error');
      }
    }, 500);
  }, [state.formData.waypoints, showToast]);

  // Trigger route calculation when waypoints change
  useEffect(() => {
    calculateRouteDebounced();
    
    return () => {
      if (routeCalculationTimeout.current) {
        clearTimeout(routeCalculationTimeout.current);
      }
    };
  }, [calculateRouteDebounced]);

  // Validate form
  const validate = useCallback((): boolean => {
    const errors = goalValidation.validateForm(state.formData);
    setState(prev => ({ ...prev, validationErrors: errors }));
    return !goalValidation.hasErrors(errors);
  }, [state.formData]);

  // Clear draft
  const clearDraft = useCallback(() => {
    localStorageUtils.clearGoalDraft();
    setState({
      formData: {
        name: '',
        description: '',
        teamId: defaultTeamId || '',
        startDate: undefined,
        targetDate: undefined,
        waypoints: [],
        routeData: undefined,
      },
      isCalculatingRoute: false,
      totalDistance: 0,
      validationErrors: {},
      isDirty: false,
      lastSavedDraft: undefined,
    });
    draftId.current = generateId();
  }, [defaultTeamId]);

  // Create goal mutation
  const createGoalMutation = useMutation({
    mutationFn: async (data: GoalFormData) => {
      // Import goalService at the top of the file
      const { goalService } = await import('@/services/goal.service');
      const result = await goalService.createGoal(data.teamId, data);
      return result;
    },
    onSuccess: (result) => {
      clearDraft();
      showToast('Goal created successfully!', 'success');
      onSuccess?.(result.id);
    },
    onError: () => {
      showToast('Failed to create goal. Please try again.', 'error');
    },
  });

  // Submit form
  const submit = useCallback(async () => {
    // Prevent double submission
    if (createGoalMutation.isPending) {
      return;
    }

    if (!validate()) {
      showToast('Please fix validation errors', 'error');
      return;
    }

    if (!state.formData.routeData && state.totalDistance === 0) {
      showToast('Please wait for route calculation to complete', 'error');
      return;
    }

    await createGoalMutation.mutateAsync(state.formData);
  }, [validate, state.formData, createGoalMutation, showToast]);

  return {
    // State
    formData: state.formData,
    isCalculatingRoute: state.isCalculatingRoute,
    routeCalculationError: state.routeCalculationError,
    totalDistance: state.totalDistance,
    validationErrors: state.validationErrors,
    isDirty: state.isDirty,
    hasValidationErrors: goalValidation.hasErrors(state.validationErrors),
    isValid: (() => {
      const formValid = goalValidation.isFormValid(state.formData);
      const hasWaypoints = state.formData.waypoints.length >= 2;
      const hasDistance = state.totalDistance > 0;
      console.log('isValid calculation:', { formValid, hasWaypoints, hasDistance, waypoints: state.formData.waypoints.length, distance: state.totalDistance });
      return formValid && hasWaypoints && hasDistance;
    })(),
    
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
    isSubmitting: createGoalMutation.isPending,
    submitError: createGoalMutation.error,
  };
}