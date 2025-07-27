'use client';

import React, { useState, useEffect, useContext, createContext, useCallback } from 'react';

// ============================================================================
// Visual Accessibility Context
// ============================================================================

interface VisualAccessibilityState {
  highContrastMode: boolean;
  reducedMotion: boolean;
  increasedTextSize: boolean;
  colorBlindFriendly: boolean;
  fontSize: number; // Scale factor: 1 = normal, 1.25 = 125%, etc.
}

interface VisualAccessibilityContextType extends VisualAccessibilityState {
  toggleHighContrast: () => void;
  toggleReducedMotion: () => void;
  toggleIncreasedTextSize: () => void;
  toggleColorBlindFriendly: () => void;
  setFontSize: (scale: number) => void;
  resetAllSettings: () => void;
}

const defaultState: VisualAccessibilityState = {
  highContrastMode: false,
  reducedMotion: false,
  increasedTextSize: false,
  colorBlindFriendly: false,
  fontSize: 1,
};

const VisualAccessibilityContext = createContext<VisualAccessibilityContextType>({
  ...defaultState,
  toggleHighContrast: () => {},
  toggleReducedMotion: () => {},
  toggleIncreasedTextSize: () => {},
  toggleColorBlindFriendly: () => {},
  setFontSize: () => {},
  resetAllSettings: () => {},
});

// ============================================================================
// Visual Accessibility Provider
// ============================================================================

export function VisualAccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<VisualAccessibilityState>(defaultState);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('visual-accessibility-preferences');
      if (saved) {
        const parsed = JSON.parse(saved);
        setState(prev => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      console.warn('Failed to load accessibility preferences:', error);
    }

    // Check system preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
    
    setState(prev => ({
      ...prev,
      reducedMotion: prev.reducedMotion || prefersReducedMotion,
      highContrastMode: prev.highContrastMode || prefersHighContrast
    }));
  }, []);

  // Save preferences to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('visual-accessibility-preferences', JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to save accessibility preferences:', error);
    }
  }, [state]);

  // Apply CSS classes and custom properties to document
  useEffect(() => {
    const root = document.documentElement;
    
    // High contrast mode
    if (state.highContrastMode) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Reduced motion
    if (state.reducedMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }

    // Increased text size
    if (state.increasedTextSize) {
      root.classList.add('large-text');
    } else {
      root.classList.remove('large-text');
    }

    // Color blind friendly
    if (state.colorBlindFriendly) {
      root.classList.add('colorblind-friendly');
    } else {
      root.classList.remove('colorblind-friendly');
    }

    // Font size scale
    root.style.setProperty('--font-size-scale', state.fontSize.toString());
  }, [state]);

  const toggleHighContrast = useCallback(() => {
    setState(prev => ({ ...prev, highContrastMode: !prev.highContrastMode }));
  }, []);

  const toggleReducedMotion = useCallback(() => {
    setState(prev => ({ ...prev, reducedMotion: !prev.reducedMotion }));
  }, []);

  const toggleIncreasedTextSize = useCallback(() => {
    setState(prev => ({ ...prev, increasedTextSize: !prev.increasedTextSize }));
  }, []);

  const toggleColorBlindFriendly = useCallback(() => {
    setState(prev => ({ ...prev, colorBlindFriendly: !prev.colorBlindFriendly }));
  }, []);

  const setFontSize = useCallback((scale: number) => {
    setState(prev => ({ ...prev, fontSize: Math.max(0.75, Math.min(2.5, scale)) }));
  }, []);

  const resetAllSettings = useCallback(() => {
    setState(defaultState);
  }, []);


  return (
    <VisualAccessibilityContext.Provider value={{
      ...state,
      toggleHighContrast,
      toggleReducedMotion,
      toggleIncreasedTextSize,
      toggleColorBlindFriendly,
      setFontSize,
      resetAllSettings
    }}>
      {children}
    </VisualAccessibilityContext.Provider>
  );
}

export function useVisualAccessibility() {
  return useContext(VisualAccessibilityContext);
}

// ============================================================================
// Accessibility Settings Panel
// ============================================================================

interface AccessibilityPanelProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function AccessibilityPanel({ isOpen, onClose, className = '' }: AccessibilityPanelProps) {
  const {
    highContrastMode,
    reducedMotion,
    increasedTextSize,
    colorBlindFriendly,
    fontSize,
    toggleHighContrast,
    toggleReducedMotion,
    toggleIncreasedTextSize,
    toggleColorBlindFriendly,
    setFontSize,
    resetAllSettings
  } = useVisualAccessibility();

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 overflow-hidden ${className}`}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-80 bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Accessibility Settings
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Close accessibility settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Visual Settings */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Visual</h3>
            <div className="space-y-4">
              <ToggleOption
                label="High Contrast Mode"
                description="Increases contrast for better visibility"
                checked={highContrastMode}
                onChange={toggleHighContrast}
              />
              
              <ToggleOption
                label="Reduce Motion"
                description="Minimizes animations and transitions"
                checked={reducedMotion}
                onChange={toggleReducedMotion}
              />
              
              <ToggleOption
                label="Large Text"
                description="Increases text size for better readability"
                checked={increasedTextSize}
                onChange={toggleIncreasedTextSize}
              />
              
              <ToggleOption
                label="Color Blind Friendly"
                description="Uses patterns and shapes in addition to color"
                checked={colorBlindFriendly}
                onChange={toggleColorBlindFriendly}
              />
            </div>
          </div>

          {/* Font Size Slider */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Font Size: {Math.round(fontSize * 100)}%
            </label>
            <input
              type="range"
              min="0.75"
              max="2.5"
              step="0.25"
              value={fontSize}
              onChange={(e) => setFontSize(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              aria-label="Font size scale"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>75%</span>
              <span>100%</span>
              <span>250%</span>
            </div>
          </div>

          {/* Reset Button */}
          <button
            onClick={resetAllSettings}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            Reset All Settings
          </button>
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// Helper Components
// ============================================================================

interface ToggleOptionProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}

function ToggleOption({ label, description, checked, onChange }: ToggleOptionProps) {
  const id = `toggle-${label.toLowerCase().replace(/\s+/g, '-')}`;
  
  return (
    <div className="flex items-start">
      <div className="flex items-center h-5">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
        />
      </div>
      <div className="ml-3">
        <label htmlFor={id} className="text-sm font-medium text-gray-900 cursor-pointer">
          {label}
        </label>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Responsive Typography Hook
// ============================================================================

export function useResponsiveTypography() {
  const [screenSize, setScreenSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const { fontSize } = useVisualAccessibility();

  useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setScreenSize('mobile');
      } else if (width < 1024) {
        setScreenSize('tablet');
      } else {
        setScreenSize('desktop');
      }
    };

    updateScreenSize();
    window.addEventListener('resize', updateScreenSize);
    return () => window.removeEventListener('resize', updateScreenSize);
  }, []);

  const getTypographyClasses = useCallback((variant: 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'small') => {
    const baseClasses = {
      h1: 'font-bold leading-tight',
      h2: 'font-bold leading-tight',
      h3: 'font-semibold leading-snug',
      h4: 'font-semibold leading-snug',
      body: 'font-normal leading-relaxed',
      small: 'font-normal leading-normal'
    };

    const sizeClasses = {
      mobile: {
        h1: 'text-2xl',
        h2: 'text-xl',
        h3: 'text-lg',
        h4: 'text-base',
        body: 'text-base',
        small: 'text-sm'
      },
      tablet: {
        h1: 'text-3xl',
        h2: 'text-2xl',
        h3: 'text-xl',
        h4: 'text-lg',
        body: 'text-base',
        small: 'text-sm'
      },
      desktop: {
        h1: 'text-4xl',
        h2: 'text-3xl',
        h3: 'text-2xl',
        h4: 'text-xl',
        body: 'text-base',
        small: 'text-sm'
      }
    };

    return `${baseClasses[variant]} ${sizeClasses[screenSize][variant]}`;
  }, [screenSize]);

  const getScaledFontSize = useCallback((baseSizePx: number) => {
    return `${baseSizePx * fontSize}px`;
  }, [fontSize]);

  return {
    screenSize,
    fontSize,
    getTypographyClasses,
    getScaledFontSize
  };
}

// ============================================================================
// Color Blind Friendly Utilities
// ============================================================================

export function useColorBlindFriendly() {
  const { colorBlindFriendly } = useVisualAccessibility();

  const getAccessibleColor = useCallback((colorType: 'success' | 'warning' | 'error' | 'info') => {
    if (!colorBlindFriendly) {
      return {
        success: 'text-green-600 bg-green-50 border-green-200',
        warning: 'text-yellow-600 bg-yellow-50 border-yellow-200',
        error: 'text-red-600 bg-red-50 border-red-200',
        info: 'text-blue-600 bg-blue-50 border-blue-200'
      }[colorType];
    }

    // Color blind friendly alternatives with patterns
    return {
      success: 'text-green-800 bg-green-100 border-green-300 pattern-checkmark',
      warning: 'text-amber-800 bg-amber-100 border-amber-300 pattern-triangle',
      error: 'text-red-800 bg-red-100 border-red-300 pattern-x',
      info: 'text-blue-800 bg-blue-100 border-blue-300 pattern-circle'
    }[colorType];
  }, [colorBlindFriendly]);

  const getPatternIndicator = useCallback((type: 'success' | 'warning' | 'error' | 'info') => {
    if (!colorBlindFriendly) return null;

    const patterns = {
      success: '✓',
      warning: '⚠',
      error: '✗',
      info: 'ⓘ'
    };

    return (
      <span className="mr-1 font-bold" aria-hidden="true">
        {patterns[type]}
      </span>
    );
  }, [colorBlindFriendly]);

  return {
    colorBlindFriendly,
    getAccessibleColor,
    getPatternIndicator
  };
}