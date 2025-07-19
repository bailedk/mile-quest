'use client';

interface TeamProgressCardProps {
  teamName: string;
  currentDistance: number;
  targetDistance: number;
  percentageComplete: number;
  formatDistance: (distance: number, units: 'miles' | 'kilometers') => string;
  userPreferredUnits: 'miles' | 'kilometers';
}

export function TeamProgressCard({
  teamName,
  currentDistance,
  targetDistance,
  percentageComplete,
  formatDistance,
  userPreferredUnits
}: TeamProgressCardProps) {
  // Determine progress bar color based on percentage
  const progressBarColor = 
    percentageComplete >= 75 ? 'bg-green-500' : 
    percentageComplete >= 50 ? 'bg-yellow-500' : 
    'bg-blue-500';

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">{teamName}</h2>
      
      {/* Progress Bar with inline labels - matching wireframe */}
      <div className="mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600 whitespace-nowrap">
            {formatDistance(currentDistance, userPreferredUnits)}
          </span>
          <div className="flex-1 bg-gray-200 rounded-full h-3 relative overflow-hidden">
            <div 
              className={`absolute left-0 top-0 h-full ${progressBarColor} transition-all duration-500 ease-out`}
              style={{ width: `${Math.min(percentageComplete, 100)}%` }}
            />
          </div>
          <span className="text-sm text-gray-600 whitespace-nowrap">
            {formatDistance(targetDistance, userPreferredUnits)}
          </span>
        </div>
        <p className="text-xs text-gray-500 text-center mt-1">
          {percentageComplete.toFixed(0)}% complete
        </p>
      </div>
    </div>
  );
}