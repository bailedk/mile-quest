'use client';

import React, { useRef, useEffect, useState, useCallback, useId } from 'react';

// ============================================================================
// ARIA Landmark Components
// ============================================================================

interface AriaLandmarkProps {
  children: React.ReactNode;
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  className?: string;
}

export function AriaMain({ children, label, labelledBy, describedBy, className = '' }: AriaLandmarkProps) {
  return (
    <main 
      className={className}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      role="main"
    >
      {children}
    </main>
  );
}

export function AriaNavigation({ children, label, labelledBy, describedBy, className = '' }: AriaLandmarkProps) {
  return (
    <nav 
      className={className}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      role="navigation"
    >
      {children}
    </nav>
  );
}

export function AriaAside({ children, label, labelledBy, describedBy, className = '' }: AriaLandmarkProps) {
  return (
    <aside 
      className={className}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      role="complementary"
    >
      {children}
    </aside>
  );
}

export function AriaSection({ children, label, labelledBy, describedBy, className = '' }: AriaLandmarkProps) {
  return (
    <section 
      className={className}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      role="region"
    >
      {children}
    </section>
  );
}

export function AriaBanner({ children, label, labelledBy, describedBy, className = '' }: AriaLandmarkProps) {
  return (
    <header 
      className={className}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      role="banner"
    >
      {children}
    </header>
  );
}

export function AriaContentInfo({ children, label, labelledBy, describedBy, className = '' }: AriaLandmarkProps) {
  return (
    <footer 
      className={className}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      role="contentinfo"
    >
      {children}
    </footer>
  );
}

// ============================================================================
// ARIA Live Regions
// ============================================================================

interface AriaLiveRegionProps {
  children: React.ReactNode;
  politeness?: 'polite' | 'assertive' | 'off';
  atomic?: boolean;
  relevant?: 'additions' | 'removals' | 'text' | 'all';
  busy?: boolean;
  className?: string;
  label?: string;
}

export function AriaLiveRegion({ 
  children, 
  politeness = 'polite', 
  atomic = false,
  relevant = 'additions text',
  busy = false,
  className = '',
  label
}: AriaLiveRegionProps) {
  const liveRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={liveRef}
      className={className}
      aria-live={politeness}
      aria-atomic={atomic}
      aria-relevant={relevant}
      aria-busy={busy}
      aria-label={label}
      role="status"
    >
      {children}
    </div>
  );
}

export function AriaStatus({ children, label, className = '' }: { children: React.ReactNode; label?: string; className?: string }) {
  return (
    <AriaLiveRegion 
      politeness="polite" 
      atomic={true}
      className={className}
      label={label || "Status update"}
    >
      <span className="sr-only">Status: </span>
      {children}
    </AriaLiveRegion>
  );
}

export function AriaAlert({ children, label, className = '' }: { children: React.ReactNode; label?: string; className?: string }) {
  return (
    <AriaLiveRegion 
      politeness="assertive" 
      atomic={true}
      className={className}
      label={label || "Alert"}
    >
      <span className="sr-only">Alert: </span>
      {children}
    </AriaLiveRegion>
  );
}

// ============================================================================
// ARIA Interactive Components
// ============================================================================

interface AriaButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  expanded?: boolean;
  controls?: string;
  describedBy?: string;
  pressed?: boolean;
  haspopup?: boolean | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog';
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
}

export function AriaButton({ 
  children, 
  expanded, 
  controls, 
  describedBy, 
  pressed, 
  haspopup,
  disabled = false,
  loading = false,
  loadingText = "Loading",
  className = '',
  ...props 
}: AriaButtonProps) {
  return (
    <button
      {...props}
      className={`${className} ${loading ? 'cursor-wait' : ''}`}
      aria-expanded={expanded}
      aria-controls={controls}
      aria-describedby={describedBy}
      aria-pressed={pressed}
      aria-haspopup={haspopup}
      aria-busy={loading}
      aria-label={loading ? loadingText : props['aria-label']}
      disabled={disabled || loading}
    >
      {loading && (
        <span aria-hidden="true" className="inline-block animate-spin mr-2">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
            <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
        </span>
      )}
      <span className={loading ? 'sr-only' : undefined}>
        {children}
      </span>
      {loading && (
        <span aria-live="polite" className="sr-only">
          {loadingText}
        </span>
      )}
    </button>
  );
}

// ============================================================================
// ARIA Disclosure/Collapsible Component
// ============================================================================

interface AriaDisclosureProps {
  children: React.ReactNode;
  title: string;
  defaultOpen?: boolean;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  contentClassName?: string;
  onToggle?: (isOpen: boolean) => void;
}

export function AriaDisclosure({
  children,
  title,
  defaultOpen = false,
  disabled = false,
  className = '',
  buttonClassName = '',
  contentClassName = '',
  onToggle
}: AriaDisclosureProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const baseId = useId();
  const contentId = `${baseId}-content`;
  const buttonId = `${baseId}-button`;

  const handleToggle = useCallback(() => {
    if (disabled) return;
    const newState = !isOpen;
    setIsOpen(newState);
    onToggle?.(newState);
  }, [isOpen, disabled, onToggle]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle();
    }
  }, [handleToggle]);

  return (
    <div className={className}>
      <AriaButton
        id={buttonId}
        expanded={isOpen}
        controls={contentId}
        disabled={disabled}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={`flex items-center justify-between w-full text-left ${buttonClassName}`}
        aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${title}`}
      >
        <span>{title}</span>
        <span aria-hidden="true" className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </AriaButton>
      
      <div
        id={contentId}
        role="region"
        aria-labelledby={buttonId}
        className={`${contentClassName} ${isOpen ? 'block' : 'hidden'}`}
        aria-hidden={!isOpen}
      >
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// ARIA Skip Links
// ============================================================================

interface SkipLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export function SkipLink({ href, children, className = '' }: SkipLinkProps) {
  return (
    <a
      href={href}
      className={`
        sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 
        bg-blue-600 text-white px-4 py-2 rounded-md font-medium z-50
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        ${className}
      `}
    >
      {children}
    </a>
  );
}

export function SkipLinks() {
  return (
    <div className="sr-only focus-within:not-sr-only">
      <SkipLink href="#main-content">Skip to main content</SkipLink>
      <SkipLink href="#main-navigation">Skip to navigation</SkipLink>
      <SkipLink href="#search">Skip to search</SkipLink>
    </div>
  );
}

// ============================================================================
// ARIA Progress Components
// ============================================================================

interface AriaProgressProps {
  value: number;
  max?: number;
  label?: string;
  valueText?: string;
  className?: string;
  showPercentage?: boolean;
  variant?: 'bar' | 'circular';
}

export function AriaProgress({
  value,
  max = 100,
  label,
  valueText,
  className = '',
  showPercentage = true,
  variant = 'bar'
}: AriaProgressProps) {
  const percentage = Math.round((value / max) * 100);
  const baseId = useId();
  const progressId = `${baseId}-progress`;
  const labelId = `${baseId}-label`;

  const displayValue = valueText || (showPercentage ? `${percentage}%` : `${value} of ${max}`);

  if (variant === 'circular') {
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;

    return (
      <div className={`relative inline-flex items-center justify-center ${className}`}>
        {label && (
          <div id={labelId} className="sr-only">
            {label}
          </div>
        )}
        <svg
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={displayValue}
          aria-labelledby={label ? labelId : undefined}
          className="w-16 h-16 transform -rotate-90"
        >
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke="currentColor"
            strokeWidth="4"
            fill="transparent"
            className="text-gray-200"
          />
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke="currentColor"
            strokeWidth="4"
            fill="transparent"
            strokeDasharray={strokeDasharray}
            className="text-blue-600 transition-all duration-500 ease-out"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-medium">
          {showPercentage ? `${percentage}%` : value}
        </span>
      </div>
    );
  }

  return (
    <div className={className}>
      {label && (
        <div id={labelId} className="flex justify-between text-sm font-medium text-gray-700 mb-1">
          <span>{label}</span>
          <span>{displayValue}</span>
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={displayValue}
          aria-labelledby={label ? labelId : undefined}
          className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// ARIA List Components
// ============================================================================

interface AriaListProps {
  children: React.ReactNode;
  label?: string;
  className?: string;
  multiSelectable?: boolean;
  orientation?: 'vertical' | 'horizontal';
}

export function AriaList({ 
  children, 
  label, 
  className = '',
  multiSelectable = false,
  orientation = 'vertical'
}: AriaListProps) {
  return (
    <ul
      role="list"
      aria-label={label}
      aria-multiselectable={multiSelectable}
      aria-orientation={orientation}
      className={className}
    >
      {children}
    </ul>
  );
}

interface AriaListItemProps {
  children: React.ReactNode;
  selected?: boolean;
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
}

export function AriaListItem({ 
  children, 
  selected = false, 
  disabled = false,
  className = '',
  onClick
}: AriaListItemProps) {
  return (
    <li
      role="listitem"
      aria-selected={selected}
      aria-disabled={disabled}
      className={`${className} ${onClick ? 'cursor-pointer' : ''}`}
      onClick={disabled ? undefined : onClick}
      tabIndex={disabled ? -1 : 0}
    >
      {children}
    </li>
  );
}

// ============================================================================
// ARIA Tabs Component
// ============================================================================

interface AriaTabsProps {
  children: React.ReactNode;
  defaultTab?: number;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  onTabChange?: (index: number) => void;
}

interface AriaTabsContextType {
  activeTab: number;
  setActiveTab: (index: number) => void;
  orientation: 'horizontal' | 'vertical';
}

const AriaTabsContext = React.createContext<AriaTabsContextType | null>(null);

export function AriaTabs({ 
  children, 
  defaultTab = 0, 
  orientation = 'horizontal',
  className = '',
  onTabChange
}: AriaTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  const handleTabChange = useCallback((index: number) => {
    setActiveTab(index);
    onTabChange?.(index);
  }, [onTabChange]);

  return (
    <AriaTabsContext.Provider value={{ activeTab, setActiveTab: handleTabChange, orientation }}>
      <div className={className}>
        {children}
      </div>
    </AriaTabsContext.Provider>
  );
}

interface AriaTabListProps {
  children: React.ReactNode;
  label?: string;
  className?: string;
}

export function AriaTabList({ children, label, className = '' }: AriaTabListProps) {
  const context = React.useContext(AriaTabsContext);
  if (!context) throw new Error('AriaTabList must be used within AriaTabs');

  return (
    <div
      role="tablist"
      aria-label={label}
      aria-orientation={context.orientation}
      className={className}
    >
      {children}
    </div>
  );
}

interface AriaTabProps {
  children: React.ReactNode;
  index: number;
  disabled?: boolean;
  className?: string;
}

export function AriaTab({ children, index, disabled = false, className = '' }: AriaTabProps) {
  const context = React.useContext(AriaTabsContext);
  if (!context) throw new Error('AriaTab must be used within AriaTabs');

  const isSelected = context.activeTab === index;
  const panelId = `tabpanel-${index}`;
  const tabId = `tab-${index}`;

  return (
    <button
      id={tabId}
      role="tab"
      aria-selected={isSelected}
      aria-controls={panelId}
      aria-disabled={disabled}
      tabIndex={isSelected ? 0 : -1}
      className={className}
      onClick={() => !disabled && context.setActiveTab(index)}
    >
      {children}
    </button>
  );
}

interface AriaTabPanelProps {
  children: React.ReactNode;
  index: number;
  className?: string;
}

export function AriaTabPanel({ children, index, className = '' }: AriaTabPanelProps) {
  const context = React.useContext(AriaTabsContext);
  if (!context) throw new Error('AriaTabPanel must be used within AriaTabs');

  const isSelected = context.activeTab === index;
  const panelId = `tabpanel-${index}`;
  const tabId = `tab-${index}`;

  return (
    <div
      id={panelId}
      role="tabpanel"
      aria-labelledby={tabId}
      hidden={!isSelected}
      className={className}
      tabIndex={0}
    >
      {isSelected && children}
    </div>
  );
}