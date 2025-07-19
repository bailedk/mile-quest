'use client';

import { useState } from 'react';
import { LiveProgressVisualization, VisualizationMode } from '@/components/progress';
import type { TeamProgressData, RouteData } from '@mile-quest/shared';

export default function ProgressDemo() {
  const [mode, setMode] = useState<VisualizationMode>('bar');
  
  // Mock data for demonstration
  const mockProgress: TeamProgressData = {
    totalDistance: 125000, // 125km in meters
    totalActivities: 42,
    totalDuration: 15400, // minutes
    currentSegmentIndex: 1,
    segmentProgress: 0.65,
    lastActivityAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
  };

  const mockRouteData: RouteData = {
    waypoints: [
      { lat: 37.7749, lng: -122.4194, address: 'San Francisco, CA' },
      { lat: 37.3382, lng: -121.8863, address: 'San Jose, CA' },
      { lat: 36.7783, lng: -119.4179, address: 'Fresno, CA' },
      { lat: 34.0522, lng: -118.2437, address: 'Los Angeles, CA' },
    ],
    segments: [
      { from: 0, to: 1, distance: 48 },
      { from: 1, to: 2, distance: 151 },
      { from: 2, to: 3, distance: 219 },
    ],
  };

  const targetDistance = 418000; // 418km total route in meters

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Live Progress Visualization Demo
        </h1>

        <div className="grid gap-8">
          {/* Full-featured visualization */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Full-Featured Progress Visualization
            </h2>
            <LiveProgressVisualization
              teamId="demo-team-1"
              goalId="demo-goal-1"
              goalName="California Coast Challenge"
              targetDistance={targetDistance}
              targetDate={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()}
              routeData={mockRouteData}
              initialProgress={mockProgress}
              userPreferredUnits="kilometers"
              showStats={true}
              defaultMode={mode}
            />
          </section>

          {/* Compact mode */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Compact Mode (Mobile-friendly)
            </h2>
            <LiveProgressVisualization
              teamId="demo-team-2"
              goalId="demo-goal-2"
              goalName="Quick Sprint Goal"
              targetDistance={50000} // 50km
              initialProgress={{
                totalDistance: 35000,
                totalActivities: 12,
                totalDuration: 4200,
                currentSegmentIndex: 0,
                segmentProgress: 0.7,
              }}
              compactMode={true}
              showStats={false}
              defaultMode="bar"
            />
          </section>

          {/* Multiple team example */}
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Multiple Teams Dashboard
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <LiveProgressVisualization
                teamId="demo-team-3"
                goalId="demo-goal-3"
                goalName="Team Alpha Goal"
                targetDistance={100000}
                initialProgress={{
                  totalDistance: 75000,
                  totalActivities: 25,
                  totalDuration: 8400,
                  currentSegmentIndex: 0,
                  segmentProgress: 0.75,
                }}
                compactMode={true}
                showStats={false}
                defaultMode="circular"
              />
              <LiveProgressVisualization
                teamId="demo-team-4"
                goalId="demo-goal-4"
                goalName="Team Beta Goal"
                targetDistance={100000}
                initialProgress={{
                  totalDistance: 45000,
                  totalActivities: 18,
                  totalDuration: 5600,
                  currentSegmentIndex: 0,
                  segmentProgress: 0.45,
                }}
                compactMode={true}
                showStats={false}
                defaultMode="circular"
              />
            </div>
          </section>

          {/* Visualization mode selector */}
          <section className="border-t pt-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Try Different Visualization Modes
            </h2>
            <div className="flex gap-2 mb-4">
              {(['bar', 'circular', 'route', 'contributions'] as VisualizationMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    mode === m
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-600">
              The visualization above will update when you select a different mode.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}