import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { ProgressLineChart, GoalProgressChart, ActivityBarChart } from '../index';
import { generateDailyProgressData, generateActivityBreakdownData } from '@/utils/chartMockData';

// Mock recharts to avoid canvas issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  Legend: () => <div data-testid="legend" />,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
}));

describe('Chart Components', () => {
  describe('ProgressLineChart', () => {
    it('renders with data', () => {
      const mockData = generateDailyProgressData();
      render(
        <ProgressLineChart 
          data={mockData} 
          userPreferredUnits="miles" 
        />
      );
      
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('shows loading state when no data', () => {
      render(
        <ProgressLineChart 
          data={[]} 
          userPreferredUnits="miles" 
        />
      );
      
      expect(screen.getByText('Loading chart data...')).toBeInTheDocument();
    });

    it('shows empty state when all data is zero', () => {
      const emptyData = [
        { date: 'Jan 01', distance: 0, cumulative: 0 },
        { date: 'Jan 02', distance: 0, cumulative: 0 },
      ];
      
      render(
        <ProgressLineChart 
          data={emptyData} 
          userPreferredUnits="miles" 
        />
      );
      
      expect(screen.getByText('No activity data yet')).toBeInTheDocument();
    });
  });

  describe('GoalProgressChart', () => {
    it('renders progress chart', () => {
      render(
        <GoalProgressChart 
          currentDistance={50000} 
          targetDistance={100000} 
          userPreferredUnits="kilometers" 
        />
      );
      
      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    it('shows goal achieved state', () => {
      render(
        <GoalProgressChart 
          currentDistance={100000} 
          targetDistance={100000} 
          userPreferredUnits="miles" 
        />
      );
      
      expect(screen.getByText('Goal Achieved!')).toBeInTheDocument();
    });

    it('shows loading state with zero target', () => {
      render(
        <GoalProgressChart 
          currentDistance={0} 
          targetDistance={0} 
          userPreferredUnits="miles" 
        />
      );
      
      expect(screen.getByText('Loading goal data...')).toBeInTheDocument();
    });
  });

  describe('ActivityBarChart', () => {
    it('renders activity breakdown', () => {
      const mockData = generateActivityBreakdownData();
      render(
        <ActivityBarChart 
          data={mockData} 
          userPreferredUnits="miles" 
        />
      );
      
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      expect(screen.getByText('Total Distance')).toBeInTheDocument();
      expect(screen.getByText('Total Activities')).toBeInTheDocument();
      expect(screen.getByText('Active Days')).toBeInTheDocument();
    });

    it('shows empty state when no activities', () => {
      const emptyData = [
        { day: 'Mon', distance: 0, activities: 0 },
        { day: 'Tue', distance: 0, activities: 0 },
      ];
      
      render(
        <ActivityBarChart 
          data={emptyData} 
          userPreferredUnits="miles" 
        />
      );
      
      expect(screen.getByText('No recent activities')).toBeInTheDocument();
    });
  });
});