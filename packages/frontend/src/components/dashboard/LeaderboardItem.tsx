'use client';

interface LeaderboardItemProps {
  rank: number;
  name: string;
  distance: number;
  isCurrentUser: boolean;
  formatDistance: (distance: number, units: 'miles' | 'kilometers') => string;
  userPreferredUnits: 'miles' | 'kilometers';
}

export function LeaderboardItem({
  rank,
  name,
  distance,
  isCurrentUser,
  formatDistance,
  userPreferredUnits
}: LeaderboardItemProps) {
  const rankColors = {
    1: 'bg-yellow-100 text-yellow-700',
    2: 'bg-gray-100 text-gray-700',
    3: 'bg-orange-100 text-orange-700',
    default: 'bg-gray-100 text-gray-600'
  };

  const getRankColor = () => {
    return rankColors[rank as keyof typeof rankColors] || rankColors.default;
  };

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center space-x-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${getRankColor()}`}>
          {rank}
        </div>
        <span className={`font-medium ${isCurrentUser ? 'text-blue-600' : 'text-gray-900'}`}>
          {isCurrentUser ? `${name} (You)` : name}
        </span>
      </div>
      <span className="text-gray-600 font-medium">
        {formatDistance(distance, userPreferredUnits)}
      </span>
    </div>
  );
}