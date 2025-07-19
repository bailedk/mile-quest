import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  padding?: 'sm' | 'md' | 'lg';
}

/**
 * Card Component Pattern
 * 
 * Demonstrates:
 * - Consistent shadow and border styling
 * - Hover states for interactive cards
 * - Flexible padding options
 * - Composable design
 */
export function Card({
  children,
  className = '',
  hoverable = false,
  padding = 'md',
}: CardProps) {
  const baseClasses = `
    bg-white rounded-lg border border-gray-200
    shadow-sm
  `;

  const paddingClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const hoverClasses = hoverable
    ? 'transition-all duration-200 hover:shadow-lg hover:border-primary cursor-pointer'
    : '';

  return (
    <div
      className={`
        ${baseClasses}
        ${paddingClasses[padding]}
        ${hoverClasses}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

interface TeamCardProps {
  teamName: string;
  progress: number;
  goalDistance: number;
  currentDistance: number;
  memberCount: number;
  isActive?: boolean;
}

/**
 * Team Card Pattern
 * 
 * Demonstrates:
 * - Complex component built with Tailwind
 * - Progress bar implementation
 * - Conditional styling
 * - Semantic HTML structure
 */
export function TeamCard({
  teamName,
  progress,
  goalDistance,
  currentDistance,
  memberCount,
  isActive = false,
}: TeamCardProps) {
  return (
    <Card
      hoverable
      className={isActive ? 'border-primary shadow-lg' : ''}
    >
      <article className="relative">
        {/* Active badge */}
        {isActive && (
          <div className="absolute -top-2 -right-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary text-white">
              Active
            </span>
          </div>
        )}

        {/* Team header */}
        <header className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{teamName}</h3>
          <p className="text-sm text-gray-500">{memberCount} members</p>
        </header>

        {/* Progress section */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-gray-700">Progress</span>
            <span className="text-gray-500">{progress}%</span>
          </div>
          
          {/* Progress bar */}
          <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            >
              {/* Animated shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
            </div>
          </div>

          {/* Distance info */}
          <div className="flex justify-between text-sm mt-3">
            <span className="text-gray-600">
              {currentDistance.toLocaleString()} miles
            </span>
            <span className="text-gray-600">
              Goal: {goalDistance.toLocaleString()} miles
            </span>
          </div>
        </div>

        {/* Action area */}
        <div className="mt-6 pt-4 border-t border-gray-100">
          <button className="text-sm font-medium text-primary hover:text-primary-dark transition-colors">
            View Details →
          </button>
        </div>
      </article>
    </Card>
  );
}

// Example usage
export function CardExamples() {
  return (
    <div className="space-y-6 p-8 bg-gray-50">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold mb-2">Basic Card</h3>
          <p className="text-gray-600">
            This is a simple card with default styling and padding.
          </p>
        </Card>

        <Card hoverable>
          <h3 className="text-lg font-semibold mb-2">Hoverable Card</h3>
          <p className="text-gray-600">
            This card has hover effects for interactive elements.
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TeamCard
          teamName="Walking Warriors"
          progress={65}
          goalDistance={500}
          currentDistance={325}
          memberCount={12}
        />

        <TeamCard
          teamName="Mile Crushers"
          progress={89}
          goalDistance={1000}
          currentDistance={890}
          memberCount={24}
          isActive
        />
      </div>
    </div>
  );
}