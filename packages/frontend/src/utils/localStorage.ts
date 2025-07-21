import { GoalDraft } from '@/types/goal.types';

const GOAL_DRAFT_KEY = 'mile-quest-goal-draft';
const DRAFT_EXPIRY_HOURS = 24;

export const localStorageUtils = {
  /**
   * Save a goal draft to local storage
   */
  saveGoalDraft: (draft: GoalDraft): void => {
    try {
      localStorage.setItem(GOAL_DRAFT_KEY, JSON.stringify(draft));
    } catch (error) {
      console.error('Failed to save goal draft to localStorage:', error);
    }
  },

  /**
   * Retrieve the goal draft from local storage
   */
  getGoalDraft: (): GoalDraft | null => {
    try {
      const stored = localStorage.getItem(GOAL_DRAFT_KEY);
      if (!stored) return null;

      const draft = JSON.parse(stored) as GoalDraft;
      
      // Check if draft has expired
      const lastSaved = new Date(draft.lastSaved);
      const now = new Date();
      const hoursSinceLastSave = (now.getTime() - lastSaved.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastSave > DRAFT_EXPIRY_HOURS) {
        localStorageUtils.clearGoalDraft();
        return null;
      }

      return draft;
    } catch (error) {
      console.error('Failed to retrieve goal draft from localStorage:', error);
      return null;
    }
  },

  /**
   * Clear the goal draft from local storage
   */
  clearGoalDraft: (): void => {
    try {
      localStorage.removeItem(GOAL_DRAFT_KEY);
    } catch (error) {
      console.error('Failed to clear goal draft from localStorage:', error);
    }
  },

  /**
   * Check if localStorage is available
   */
  isAvailable: (): boolean => {
    try {
      const testKey = '__localStorage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  },
};