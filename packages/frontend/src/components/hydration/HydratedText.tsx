'use client';

import { useHydrated } from '@/hooks/useHydrated';

interface HydratedTextProps {
  children: React.ReactNode;
  placeholder?: React.ReactNode;
  className?: string;
}

/**
 * Component that shows a placeholder during SSR/hydration
 * and the actual content after hydration completes
 */
export function HydratedText({ 
  children, 
  placeholder = '—', 
  className 
}: HydratedTextProps) {
  const hydrated = useHydrated();
  
  return (
    <span className={className}>
      {hydrated ? children : placeholder}
    </span>
  );
}

interface HydratedDateProps {
  date: string | Date;
  format: (date: string | Date) => string;
  placeholder?: string;
  className?: string;
}

/**
 * Specialized component for rendering dates with hydration safety
 */
export function HydratedDate({
  date,
  format,
  placeholder = '—',
  className
}: HydratedDateProps) {
  const hydrated = useHydrated();
  
  if (!hydrated) {
    return <span className={className}>{placeholder}</span>;
  }
  
  try {
    const formatted = format(date);
    return <span className={className}>{formatted || placeholder}</span>;
  } catch {
    return <span className={className}>{placeholder}</span>;
  }
}