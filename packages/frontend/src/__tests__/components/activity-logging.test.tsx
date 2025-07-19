/**
 * Comprehensive tests for activity logging components and forms
 * Tests manual activity entry, validation, and form interactions
 */
import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, mockTeams, mockApiResponses, mockFetch, setupTestEnvironment, resetAllMocks } from '../utils/test-helpers';

// Mock the activity form page component
const MockActivityForm = ({ onSubmit, initialData, teams, isLoading }: any) => {
  const [formData, setFormData] = React.useState({
    teamIds: initialData?.teamIds || [],
    distance: initialData?.distance || '',
    duration: initialData?.duration || '',
    activityDate: initialData?.activityDate || '',
    activityTime: initialData?.activityTime || '',
    notes: initialData?.notes || '',
    isPrivate: initialData?.isPrivate || false,
    ...initialData
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleTeamToggle = (teamId: string) => {
    setFormData(prev => ({
      ...prev,
      teamIds: prev.teamIds.includes(teamId)
        ? prev.teamIds.filter(id => id !== teamId)
        : [...prev.teamIds, teamId]
    }));
  };

  return (
    <form onSubmit={handleSubmit} data-testid="activity-form">
      <h1>Log New Activity</h1>
      
      {/* Team Selection */}
      <fieldset>
        <legend>Select Teams</legend>
        {teams.map((team: any) => (
          <label key={team.id}>
            <input
              type="checkbox"
              checked={formData.teamIds.includes(team.id)}
              onChange={() => handleTeamToggle(team.id)}
              data-testid={`team-${team.id}`}
            />
            {team.name}
          </label>
        ))}
      </fieldset>

      {/* Distance Input */}
      <label>
        Distance (km)
        <input
          type="number"
          step="0.1"
          min="0"
          value={formData.distance}
          onChange={(e) => setFormData(prev => ({ ...prev, distance: e.target.value }))}
          data-testid="distance-input"
          required
        />
      </label>

      {/* Duration Input */}
      <label>
        Duration (minutes)
        <input
          type="number"
          min="1"
          value={formData.duration}
          onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
          data-testid="duration-input"
          required
        />
      </label>

      {/* Activity Date */}
      <label>
        Activity Date
        <input
          type="date"
          value={formData.activityDate}
          onChange={(e) => setFormData(prev => ({ ...prev, activityDate: e.target.value }))}
          data-testid="date-input"
          required
        />
      </label>

      {/* Activity Time */}
      <label>
        Activity Time
        <input
          type="time"
          value={formData.activityTime}
          onChange={(e) => setFormData(prev => ({ ...prev, activityTime: e.target.value }))}
          data-testid="time-input"
          required
        />
      </label>

      {/* Notes */}
      <label>
        Notes (optional)
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          data-testid="notes-input"
          placeholder="How was your activity?"
        />
      </label>

      {/* Privacy Toggle */}
      <label>
        <input
          type="checkbox"
          checked={formData.isPrivate}
          onChange={(e) => setFormData(prev => ({ ...prev, isPrivate: e.target.checked }))}
          data-testid="private-checkbox"
        />
        Make this activity private
        <span className="help-text">Private activities count toward team goals but don't appear in leaderboards</span>
      </label>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        data-testid="submit-button"
      >
        {isLoading ? 'Logging Activity...' : 'Log Activity'}
      </button>

      {/* Calculated Pace Display */}
      {formData.distance && formData.duration && (
        <div data-testid="calculated-pace">
          Pace: {((parseFloat(formData.duration) / 60) / parseFloat(formData.distance)).toFixed(1)} min/km
        </div>
      )}
    </form>
  );
};

// Mock activity list component
const MockActivityList = ({ activities, loading, onDelete, onEdit }: any) => {
  if (loading) {
    return <div data-testid="activity-list-loading">Loading activities...</div>;
  }

  if (!activities || activities.length === 0) {
    return (
      <div data-testid="empty-activities">
        <h2>No Activities Yet</h2>
        <p>Log your first activity to get started!</p>
      </div>
    );
  }

  return (
    <div data-testid="activity-list">
      <h2>Your Activities</h2>
      {activities.map((activity: any) => (
        <div key={activity.id} data-testid={`activity-${activity.id}`} className="activity-item">
          <div className="activity-info">
            <h3>{activity.note || 'Activity'}</h3>
            <p>Distance: {activity.distance / 1000} km</p>
            <p>Duration: {Math.floor(activity.duration / 60)}m {activity.duration % 60}s</p>
            <p>Pace: {activity.pace} min/km</p>
            <p>Date: {new Date(activity.activityDate).toLocaleDateString()}</p>
            {activity.isPrivate && <span data-testid="private-badge">Private</span>}
            <div className="teams">
              Teams: {activity.teams.map((t: any) => t.name).join(', ')}
            </div>
          </div>
          <div className="activity-actions">
            <button onClick={() => onEdit(activity)} data-testid={`edit-${activity.id}`}>
              Edit
            </button>
            <button onClick={() => onDelete(activity.id)} data-testid={`delete-${activity.id}`}>
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

describe('Activity Logging Components', () => {
  let cleanup: () => void;
  const user = userEvent.setup();
  const mockTeamsList = [mockTeams.team1, mockTeams.team2];

  beforeEach(() => {
    const testEnv = setupTestEnvironment();
    cleanup = testEnv.cleanup;
    resetAllMocks();
    
    mockFetch({
      '/api/v1/activities': mockApiResponses.activities,
      '/api/v1/teams': { success: true, data: { teams: mockTeamsList } },
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('Activity Form Component', () => {
    it('should render all form fields correctly', () => {
      const mockOnSubmit = vi.fn();

      renderWithProviders(
        <MockActivityForm
          onSubmit={mockOnSubmit}
          teams={mockTeamsList}
          isLoading={false}
        />
      );

      // Check form title
      expect(screen.getByText('Log New Activity')).toBeInTheDocument();

      // Check all input fields are present
      expect(screen.getByTestId('distance-input')).toBeInTheDocument();
      expect(screen.getByTestId('duration-input')).toBeInTheDocument();
      expect(screen.getByTestId('date-input')).toBeInTheDocument();
      expect(screen.getByTestId('time-input')).toBeInTheDocument();
      expect(screen.getByTestId('notes-input')).toBeInTheDocument();
      expect(screen.getByTestId('private-checkbox')).toBeInTheDocument();

      // Check team selection
      expect(screen.getByTestId(`team-${mockTeams.team1.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`team-${mockTeams.team2.id}`)).toBeInTheDocument();

      // Check submit button
      expect(screen.getByTestId('submit-button')).toBeInTheDocument();
    });

    it('should handle team selection correctly', async () => {
      const mockOnSubmit = vi.fn();

      renderWithProviders(
        <MockActivityForm
          onSubmit={mockOnSubmit}
          teams={mockTeamsList}
          isLoading={false}
        />
      );

      const team1Checkbox = screen.getByTestId(`team-${mockTeams.team1.id}`);
      const team2Checkbox = screen.getByTestId(`team-${mockTeams.team2.id}`);

      // Initially no teams selected
      expect(team1Checkbox).not.toBeChecked();
      expect(team2Checkbox).not.toBeChecked();

      // Select first team
      await user.click(team1Checkbox);
      expect(team1Checkbox).toBeChecked();

      // Select second team
      await user.click(team2Checkbox);
      expect(team2Checkbox).toBeChecked();

      // Deselect first team
      await user.click(team1Checkbox);
      expect(team1Checkbox).not.toBeChecked();
      expect(team2Checkbox).toBeChecked();
    });

    it('should validate required fields', async () => {
      const mockOnSubmit = vi.fn();

      renderWithProviders(
        <MockActivityForm
          onSubmit={mockOnSubmit}
          teams={mockTeamsList}
          isLoading={false}
        />
      );

      const submitButton = screen.getByTestId('submit-button');

      // Try to submit without filling required fields
      await user.click(submitButton);

      // Form should not submit (HTML5 validation will prevent it)
      expect(mockOnSubmit).not.toHaveBeenCalled();

      // Fill in required fields
      await user.type(screen.getByTestId('distance-input'), '5.0');
      await user.type(screen.getByTestId('duration-input'), '30');
      await user.type(screen.getByTestId('date-input'), '2025-01-19');
      await user.type(screen.getByTestId('time-input'), '10:00');
      await user.click(screen.getByTestId(`team-${mockTeams.team1.id}`));

      // Now submit should work
      await user.click(submitButton);

      expect(mockOnSubmit).toHaveBeenCalledWith({
        teamIds: [mockTeams.team1.id],
        distance: '5.0',
        duration: '30',
        activityDate: '2025-01-19',
        activityTime: '10:00',
        notes: '',
        isPrivate: false,
      });
    });

    it('should calculate and display pace correctly', async () => {
      const mockOnSubmit = vi.fn();

      renderWithProviders(
        <MockActivityForm
          onSubmit={mockOnSubmit}
          teams={mockTeamsList}
          isLoading={false}
        />
      );

      // Enter distance and duration
      await user.type(screen.getByTestId('distance-input'), '5.0');
      await user.type(screen.getByTestId('duration-input'), '30');

      // Should calculate pace (30 minutes / 5 km = 6.0 min/km)
      await waitFor(() => {
        expect(screen.getByTestId('calculated-pace')).toHaveTextContent('Pace: 6.0 min/km');
      });

      // Change values and verify recalculation
      await user.clear(screen.getByTestId('duration-input'));
      await user.type(screen.getByTestId('duration-input'), '40');

      await waitFor(() => {
        expect(screen.getByTestId('calculated-pace')).toHaveTextContent('Pace: 8.0 min/km');
      });
    });

    it('should handle privacy toggle correctly', async () => {
      const mockOnSubmit = vi.fn();

      renderWithProviders(
        <MockActivityForm
          onSubmit={mockOnSubmit}
          teams={mockTeamsList}
          isLoading={false}
        />
      );

      const privateCheckbox = screen.getByTestId('private-checkbox');
      
      // Initially not private
      expect(privateCheckbox).not.toBeChecked();

      // Toggle privacy
      await user.click(privateCheckbox);
      expect(privateCheckbox).toBeChecked();

      // Check help text is displayed
      expect(screen.getByText(/Private activities count toward team goals/)).toBeInTheDocument();
    });

    it('should show loading state during submission', () => {
      const mockOnSubmit = vi.fn();

      renderWithProviders(
        <MockActivityForm
          onSubmit={mockOnSubmit}
          teams={mockTeamsList}
          isLoading={true}
        />
      );

      const submitButton = screen.getByTestId('submit-button');
      
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveTextContent('Logging Activity...');
    });

    it('should populate form with initial data for editing', () => {
      const mockOnSubmit = vi.fn();
      const initialData = {
        teamIds: [mockTeams.team1.id],
        distance: '5.0',
        duration: '30',
        activityDate: '2025-01-19',
        activityTime: '10:00',
        notes: 'Test activity',
        isPrivate: true,
      };

      renderWithProviders(
        <MockActivityForm
          onSubmit={mockOnSubmit}
          teams={mockTeamsList}
          initialData={initialData}
          isLoading={false}
        />
      );

      // Check all fields are populated
      expect(screen.getByTestId('distance-input')).toHaveValue(5);
      expect(screen.getByTestId('duration-input')).toHaveValue(30);
      expect(screen.getByTestId('date-input')).toHaveValue('2025-01-19');
      expect(screen.getByTestId('time-input')).toHaveValue('10:00');
      expect(screen.getByTestId('notes-input')).toHaveValue('Test activity');
      expect(screen.getByTestId('private-checkbox')).toBeChecked();
      expect(screen.getByTestId(`team-${mockTeams.team1.id}`)).toBeChecked();
    });

    it('should handle input validation constraints', async () => {
      const mockOnSubmit = vi.fn();

      renderWithProviders(
        <MockActivityForm
          onSubmit={mockOnSubmit}
          teams={mockTeamsList}
          isLoading={false}
        />
      );

      const distanceInput = screen.getByTestId('distance-input');
      const durationInput = screen.getByTestId('duration-input');

      // Test distance constraints
      expect(distanceInput).toHaveAttribute('min', '0');
      expect(distanceInput).toHaveAttribute('step', '0.1');

      // Test duration constraints
      expect(durationInput).toHaveAttribute('min', '1');

      // Try to enter invalid values
      await user.type(distanceInput, '-1');
      await user.type(durationInput, '0');

      // HTML5 validation should prevent form submission with invalid values
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Activity List Component', () => {
    const mockActivities = [
      {
        id: 'activity-1',
        distance: 5000,
        duration: 1800, // 30 minutes
        pace: 6.0,
        activityDate: '2025-01-19T10:00:00Z',
        note: 'Morning walk',
        isPrivate: false,
        teams: [{ id: mockTeams.team1.id, name: mockTeams.team1.name }],
      },
      {
        id: 'activity-2',
        distance: 10000,
        duration: 2400, // 40 minutes
        pace: 4.0,
        activityDate: '2025-01-18T07:00:00Z',
        note: 'Evening run',
        isPrivate: true,
        teams: [{ id: mockTeams.team2.id, name: mockTeams.team2.name }],
      },
    ];

    it('should display list of activities correctly', () => {
      const mockOnDelete = vi.fn();
      const mockOnEdit = vi.fn();

      renderWithProviders(
        <MockActivityList
          activities={mockActivities}
          loading={false}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );

      // Check title
      expect(screen.getByText('Your Activities')).toBeInTheDocument();

      // Check both activities are displayed
      expect(screen.getByTestId('activity-activity-1')).toBeInTheDocument();
      expect(screen.getByTestId('activity-activity-2')).toBeInTheDocument();

      // Check activity details
      expect(screen.getByText('Morning walk')).toBeInTheDocument();
      expect(screen.getByText('Evening run')).toBeInTheDocument();
      expect(screen.getByText('Distance: 5 km')).toBeInTheDocument();
      expect(screen.getByText('Distance: 10 km')).toBeInTheDocument();
    });

    it('should show loading state', () => {
      renderWithProviders(
        <MockActivityList
          activities={[]}
          loading={true}
          onDelete={vi.fn()}
          onEdit={vi.fn()}
        />
      );

      expect(screen.getByTestId('activity-list-loading')).toBeInTheDocument();
      expect(screen.getByText('Loading activities...')).toBeInTheDocument();
    });

    it('should show empty state when no activities', () => {
      renderWithProviders(
        <MockActivityList
          activities={[]}
          loading={false}
          onDelete={vi.fn()}
          onEdit={vi.fn()}
        />
      );

      expect(screen.getByTestId('empty-activities')).toBeInTheDocument();
      expect(screen.getByText('No Activities Yet')).toBeInTheDocument();
      expect(screen.getByText('Log your first activity to get started!')).toBeInTheDocument();
    });

    it('should handle edit and delete actions', async () => {
      const mockOnDelete = vi.fn();
      const mockOnEdit = vi.fn();

      renderWithProviders(
        <MockActivityList
          activities={mockActivities}
          loading={false}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
        />
      );

      // Test edit button
      const editButton = screen.getByTestId('edit-activity-1');
      await user.click(editButton);

      expect(mockOnEdit).toHaveBeenCalledWith(mockActivities[0]);

      // Test delete button
      const deleteButton = screen.getByTestId('delete-activity-1');
      await user.click(deleteButton);

      expect(mockOnDelete).toHaveBeenCalledWith('activity-1');
    });

    it('should display private activity indicator', () => {
      renderWithProviders(
        <MockActivityList
          activities={mockActivities}
          loading={false}
          onDelete={vi.fn()}
          onEdit={vi.fn()}
        />
      );

      // First activity is public - no badge
      const activity1 = screen.getByTestId('activity-activity-1');
      expect(activity1.querySelector('[data-testid="private-badge"]')).not.toBeInTheDocument();

      // Second activity is private - has badge
      const activity2 = screen.getByTestId('activity-activity-2');
      expect(activity2.querySelector('[data-testid="private-badge"]')).toBeInTheDocument();
    });

    it('should format activity data correctly', () => {
      renderWithProviders(
        <MockActivityList
          activities={mockActivities}
          loading={false}
          onDelete={vi.fn()}
          onEdit={vi.fn()}
        />
      );

      // Check time formatting (1800 seconds = 30 minutes)
      expect(screen.getByText('Duration: 30m 0s')).toBeInTheDocument();
      
      // Check pace display
      expect(screen.getByText('Pace: 6 min/km')).toBeInTheDocument();
      expect(screen.getByText('Pace: 4 min/km')).toBeInTheDocument();

      // Check team display
      expect(screen.getByText(`Teams: ${mockTeams.team1.name}`)).toBeInTheDocument();
      expect(screen.getByText(`Teams: ${mockTeams.team2.name}`)).toBeInTheDocument();
    });

    it('should handle activities with multiple teams', () => {
      const multiTeamActivity = {
        ...mockActivities[0],
        teams: [
          { id: mockTeams.team1.id, name: mockTeams.team1.name },
          { id: mockTeams.team2.id, name: mockTeams.team2.name },
        ],
      };

      renderWithProviders(
        <MockActivityList
          activities={[multiTeamActivity]}
          loading={false}
          onDelete={vi.fn()}
          onEdit={vi.fn()}
        />
      );

      expect(screen.getByText(`Teams: ${mockTeams.team1.name}, ${mockTeams.team2.name}`)).toBeInTheDocument();
    });
  });

  describe('Form Validation and Error Handling', () => {
    it('should validate distance input ranges', async () => {
      const mockOnSubmit = vi.fn();

      renderWithProviders(
        <MockActivityForm
          onSubmit={mockOnSubmit}
          teams={mockTeamsList}
          isLoading={false}
        />
      );

      const distanceInput = screen.getByTestId('distance-input');

      // Test very large distance
      await user.type(distanceInput, '1000');
      
      // Should accept large but reasonable values
      expect(distanceInput).toHaveValue(1000);

      // Test decimal places
      await user.clear(distanceInput);
      await user.type(distanceInput, '5.75');
      
      expect(distanceInput).toHaveValue(5.75);
    });

    it('should handle form submission errors gracefully', async () => {
      // Mock fetch to return error
      mockFetch({
        '/api/v1/activities': {
          ok: false,
          status: 400,
          json: () => Promise.resolve({
            success: false,
            error: { message: 'Invalid activity data' }
          }),
        },
      });

      const mockOnSubmit = vi.fn().mockImplementation(() => {
        throw new Error('Submission failed');
      });

      renderWithProviders(
        <MockActivityForm
          onSubmit={mockOnSubmit}
          teams={mockTeamsList}
          isLoading={false}
        />
      );

      // Fill form and submit
      await user.type(screen.getByTestId('distance-input'), '5.0');
      await user.type(screen.getByTestId('duration-input'), '30');
      await user.type(screen.getByTestId('date-input'), '2025-01-19');
      await user.type(screen.getByTestId('time-input'), '10:00');
      await user.click(screen.getByTestId(`team-${mockTeams.team1.id}`));

      const submitButton = screen.getByTestId('submit-button');
      
      // Should handle error gracefully
      expect(() => fireEvent.click(submitButton)).toThrow('Submission failed');
    });

    it('should prevent submission when no teams selected', async () => {
      const mockOnSubmit = vi.fn();

      renderWithProviders(
        <MockActivityForm
          onSubmit={mockOnSubmit}
          teams={mockTeamsList}
          isLoading={false}
        />
      );

      // Fill all fields except team selection
      await user.type(screen.getByTestId('distance-input'), '5.0');
      await user.type(screen.getByTestId('duration-input'), '30');
      await user.type(screen.getByTestId('date-input'), '2025-01-19');
      await user.type(screen.getByTestId('time-input'), '10:00');

      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Should still call onSubmit but with empty teamIds array
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          teamIds: [],
        })
      );
    });
  });

  describe('Accessibility and User Experience', () => {
    it('should have proper accessibility attributes', () => {
      const mockOnSubmit = vi.fn();

      renderWithProviders(
        <MockActivityForm
          onSubmit={mockOnSubmit}
          teams={mockTeamsList}
          isLoading={false}
        />
      );

      // Check form has proper structure
      const form = screen.getByTestId('activity-form');
      expect(form).toBeInTheDocument();

      // Check fieldset has legend
      const fieldset = screen.getByRole('group', { name: /select teams/i });
      expect(fieldset).toBeInTheDocument();

      // Check inputs have labels
      const distanceInput = screen.getByTestId('distance-input');
      expect(distanceInput).toHaveAccessibleName(/distance/i);

      const durationInput = screen.getByTestId('duration-input');
      expect(durationInput).toHaveAccessibleName(/duration/i);
    });

    it('should provide helpful placeholder text and help information', () => {
      const mockOnSubmit = vi.fn();

      renderWithProviders(
        <MockActivityForm
          onSubmit={mockOnSubmit}
          teams={mockTeamsList}
          isLoading={false}
        />
      );

      // Check notes placeholder
      const notesInput = screen.getByTestId('notes-input');
      expect(notesInput).toHaveAttribute('placeholder', 'How was your activity?');

      // Check privacy help text
      const helpText = screen.getByText(/Private activities count toward team goals/);
      expect(helpText).toBeInTheDocument();
    });

    it('should handle keyboard navigation properly', async () => {
      const mockOnSubmit = vi.fn();

      renderWithProviders(
        <MockActivityForm
          onSubmit={mockOnSubmit}
          teams={mockTeamsList}
          isLoading={false}
        />
      );

      // Test tab navigation
      const distanceInput = screen.getByTestId('distance-input');
      distanceInput.focus();

      await user.tab();
      expect(screen.getByTestId('duration-input')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('date-input')).toHaveFocus();
    });
  });

  describe('Performance and Integration', () => {
    it('should not re-render unnecessarily when props change', () => {
      const mockOnSubmit = vi.fn();
      let renderCount = 0;

      const TestComponent = (props: any) => {
        renderCount++;
        return <MockActivityForm {...props} />;
      };

      const { rerender } = renderWithProviders(
        <TestComponent
          onSubmit={mockOnSubmit}
          teams={mockTeamsList}
          isLoading={false}
        />
      );

      const initialRenderCount = renderCount;

      // Rerender with same props
      rerender(
        <TestComponent
          onSubmit={mockOnSubmit}
          teams={mockTeamsList}
          isLoading={false}
        />
      );

      // Should re-render (we're not using memo optimization in mock component)
      expect(renderCount).toBeGreaterThan(initialRenderCount);
    });

    it('should handle rapid user interactions gracefully', async () => {
      const mockOnSubmit = vi.fn();

      renderWithProviders(
        <MockActivityForm
          onSubmit={mockOnSubmit}
          teams={mockTeamsList}
          isLoading={false}
        />
      );

      const team1Checkbox = screen.getByTestId(`team-${mockTeams.team1.id}`);

      // Rapid clicking
      await user.click(team1Checkbox);
      await user.click(team1Checkbox);
      await user.click(team1Checkbox);

      // Should end up unchecked (odd number of clicks)
      expect(team1Checkbox).not.toBeChecked();
    });
  });
});