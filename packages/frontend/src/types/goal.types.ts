import { Waypoint, RouteSegment, RouteData } from '@mile-quest/shared';

export interface GoalFormData {
  name: string;
  description: string;
  teamId: string;
  targetDate?: string;
  waypoints: Waypoint[];
  routeData?: RouteData;
}

export interface GoalDraft extends GoalFormData {
  id: string;
  lastSaved: string;
}

export interface GoalValidationErrors {
  name?: string;
  description?: string;
  teamId?: string;
  targetDate?: string;
  waypoints?: string;
  general?: string;
}

export interface GoalCreationState {
  formData: GoalFormData;
  isCalculatingRoute: boolean;
  routeCalculationError?: string;
  totalDistance: number;
  validationErrors: GoalValidationErrors;
  isDirty: boolean;
  lastSavedDraft?: GoalDraft;
}

export interface WaypointDragData {
  index: number;
  waypoint: Waypoint;
}