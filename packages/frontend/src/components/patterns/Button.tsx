import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'text';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Button Component Pattern
 * 
 * Demonstrates:
 * - Tailwind CSS for all styling
 * - Composable className pattern
 * - Proper TypeScript types
 * - Accessibility with disabled states
 * - Loading state handling
 */
export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  // Base classes applied to all buttons
  const baseClasses = `
    inline-flex items-center justify-center
    font-semibold rounded-lg
    transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
    select-none touch-manipulation
    active:transform active:scale-95
  `;

  // Size variants with mobile-friendly minimum touch targets (44px)
  const sizeClasses = {
    sm: 'px-3 py-2.5 text-sm min-h-[44px]',  // Ensure 44px minimum touch target
    md: 'px-4 py-3 text-base min-h-[44px]',   // Ensure 44px minimum touch target
    lg: 'px-6 py-3.5 text-lg min-h-[48px]',  // Larger for better mobile UX
  };

  // Style variants
  const variantClasses = {
    primary: `
      bg-primary text-white
      hover:bg-primary-dark
      focus:ring-primary
      active:bg-primary-dark
    `,
    secondary: `
      bg-gray-100 text-gray-700
      hover:bg-gray-200
      focus:ring-gray-500
      active:bg-gray-300
    `,
    text: `
      bg-transparent text-primary
      hover:bg-primary/10
      focus:ring-primary
      active:bg-primary/20
    `,
  };

  // Loading spinner
  const loadingSpinner = (
    <svg
      className="animate-spin -ml-1 mr-2 h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );

  return (
    <button
      className={`
        ${baseClasses}
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && loadingSpinner}
      {!isLoading && leftIcon && (
        <span className="mr-2 -ml-1">{leftIcon}</span>
      )}
      {children}
      {!isLoading && rightIcon && (
        <span className="ml-2 -mr-1">{rightIcon}</span>
      )}
    </button>
  );
}

// Example usage
export function ButtonExamples() {
  return (
    <div className="space-y-4 p-8">
      <div className="space-x-4">
        <Button>Primary Button</Button>
        <Button variant="secondary">Secondary Button</Button>
        <Button variant="text">Text Button</Button>
      </div>

      <div className="space-x-4">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
      </div>

      <div className="space-x-4">
        <Button isLoading>Loading...</Button>
        <Button disabled>Disabled</Button>
        <Button
          leftIcon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }
        >
          With Icon
        </Button>
      </div>
    </div>
  );
}