/**
 * Virtual scrolling list component for large datasets
 */

import React, { memo, useMemo } from 'react';
import { useVirtualScroll } from '@/hooks/usePerformance';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  height: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  overscan?: number;
  getItemKey?: (item: T, index: number) => string | number;
}

function VirtualListComponent<T>({
  items,
  itemHeight,
  height,
  renderItem,
  className = '',
  overscan = 5,
  getItemKey,
}: VirtualListProps<T>) {
  const {
    items: visibleItems,
    startIndex,
    totalHeight,
    offsetY,
    onScroll,
  } = useVirtualScroll({
    items,
    itemHeight,
    containerHeight: height,
    overscan,
  });

  const renderedItems = useMemo(() => {
    return visibleItems.map((item, index) => {
      const absoluteIndex = startIndex + index;
      const key = getItemKey ? getItemKey(item, absoluteIndex) : absoluteIndex;
      
      return (
        <div
          key={key}
          style={{
            height: itemHeight,
            position: 'absolute',
            top: offsetY + index * itemHeight,
            left: 0,
            right: 0,
          }}
        >
          {renderItem(item, absoluteIndex)}
        </div>
      );
    });
  }, [visibleItems, startIndex, itemHeight, offsetY, renderItem, getItemKey]);

  return (
    <div
      className={`relative overflow-auto ${className}`}
      style={{ height }}
      onScroll={onScroll}
    >
      <div
        style={{
          height: totalHeight,
          position: 'relative',
        }}
      >
        {renderedItems}
      </div>
    </div>
  );
}

// Memoize the component
export const VirtualList = memo(VirtualListComponent) as <T>(
  props: VirtualListProps<T>
) => React.ReactElement;

// Specialized version for activity lists
interface ActivityItem {
  id: string;
  type: string;
  distance: number;
  date: string;
  user: {
    name: string;
    avatar?: string;
  };
}

interface VirtualActivityListProps {
  activities: ActivityItem[];
  className?: string;
  onActivityClick?: (activity: ActivityItem) => void;
}

export const VirtualActivityList = memo<VirtualActivityListProps>(({
  activities,
  className,
  onActivityClick,
}) => {
  const renderActivity = useMemo(() => 
    (activity: ActivityItem, index: number) => (
      <div
        className="flex items-center p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={() => onActivityClick?.(activity)}
      >
        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
          {activity.user.avatar ? (
            <img
              src={activity.user.avatar}
              alt={activity.user.name}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <span className="text-blue-600 font-medium text-sm">
              {activity.user.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-900">{activity.user.name}</span>
            <span className="text-sm text-gray-500">
              {new Date(activity.date).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm text-gray-600 capitalize">{activity.type}</span>
            <span className="font-medium text-blue-600">
              {activity.distance.toFixed(1)} miles
            </span>
          </div>
        </div>
      </div>
    ), [onActivityClick]);

  const getActivityKey = useMemo(() => 
    (activity: ActivityItem, index: number) => activity.id, []);

  return (
    <VirtualList
      items={activities}
      itemHeight={80}
      height={400}
      renderItem={renderActivity}
      getItemKey={getActivityKey}
      className={className}
    />
  );
});

VirtualActivityList.displayName = 'VirtualActivityList';

// Specialized version for team member lists
interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  totalDistance: number;
  weeklyDistance: number;
  isOnline: boolean;
}

interface VirtualTeamListProps {
  members: TeamMember[];
  className?: string;
  onMemberClick?: (member: TeamMember) => void;
}

export const VirtualTeamList = memo<VirtualTeamListProps>(({
  members,
  className,
  onMemberClick,
}) => {
  const renderMember = useMemo(() => 
    (member: TeamMember, index: number) => (
      <div
        className="flex items-center p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={() => onMemberClick?.(member)}
      >
        <div className="relative w-12 h-12 mr-4">
          {member.avatar ? (
            <img
              src={member.avatar}
              alt={member.name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-gray-600 font-medium">
                {member.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          
          {member.isOnline && (
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
          )}
        </div>
        
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">{member.name}</h3>
            <span className="text-sm font-medium text-blue-600">
              {member.totalDistance.toFixed(1)} total
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-sm text-gray-600">{member.email}</p>
            <span className="text-sm text-gray-500">
              {member.weeklyDistance.toFixed(1)} this week
            </span>
          </div>
        </div>
      </div>
    ), [onMemberClick]);

  const getMemberKey = useMemo(() => 
    (member: TeamMember, index: number) => member.id, []);

  return (
    <VirtualList
      items={members}
      itemHeight={88}
      height={400}
      renderItem={renderMember}
      getItemKey={getMemberKey}
      className={className}
    />
  );
});

VirtualTeamList.displayName = 'VirtualTeamList';