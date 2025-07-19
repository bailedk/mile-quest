'use client';

interface ActivityFeedItemProps {
  userName: string;
  distance: number;
  timestamp: string;
  isCurrentUser: boolean;
  formatDistance: (distance: number, units: 'miles' | 'kilometers') => string;
  userPreferredUnits: 'miles' | 'kilometers';
  getRelativeTime: (timestamp: string) => string;
}

export function ActivityFeedItem({
  userName,
  distance,
  timestamp,
  isCurrentUser,
  formatDistance,
  userPreferredUnits,
  getRelativeTime
}: ActivityFeedItemProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <div className="flex-1">
        <span className="font-medium text-gray-900">
          {isCurrentUser ? 'You' : userName}
        </span>
        <span className="text-gray-600"> - </span>
        <span className="text-gray-600">
          {formatDistance(distance, userPreferredUnits)}
        </span>
        <span className="text-gray-600"> - </span>
        <span className="text-gray-500 text-sm">{getRelativeTime(timestamp)}</span>
      </div>
    </div>
  );
}