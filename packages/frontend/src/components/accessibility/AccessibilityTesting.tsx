'use client';

import React, { useEffect, useState, useCallback } from 'react';

// ============================================================================
// Accessibility Validation Rules
// ============================================================================

export interface AccessibilityIssue {
  type: 'error' | 'warning' | 'info';
  rule: string;
  message: string;
  element?: HTMLElement;
  selector?: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  wcagLevel: 'A' | 'AA' | 'AAA';
  suggestion?: string;
}

export interface AccessibilityValidationResult {
  issues: AccessibilityIssue[];
  score: number; // 0-100
  summary: {
    errors: number;
    warnings: number;
    infos: number;
  };
}

// ============================================================================
// Core Accessibility Validator
// ============================================================================

export class AccessibilityValidator {
  private rules: AccessibilityRule[] = [];

  constructor() {
    this.loadDefaultRules();
  }

  private loadDefaultRules() {
    this.rules = [
      // WCAG 1.1.1 - Non-text Content
      {
        id: 'img-alt',
        name: 'Images must have alt text',
        wcagLevel: 'A',
        check: (container: HTMLElement): AccessibilityIssue[] => {
          const issues: AccessibilityIssue[] = [];
          const images = container.querySelectorAll('img');
          
          images.forEach(img => {
            const hasAlt = img.hasAttribute('alt');
            const hasAriaLabel = img.hasAttribute('aria-label');
            const hasAriaLabelledby = img.hasAttribute('aria-labelledby');
            const isDecorative = img.getAttribute('role') === 'presentation' || img.getAttribute('alt') === '';
            
            if (!hasAlt && !hasAriaLabel && !hasAriaLabelledby && !isDecorative) {
              issues.push({
                type: 'error',
                rule: 'img-alt',
                message: 'Image missing alternative text',
                element: img,
                impact: 'serious',
                wcagLevel: 'A',
                suggestion: 'Add alt attribute, aria-label, or mark as decorative with alt=""'
              });
            }
          });
          
          return issues;
        }
      },

      // WCAG 1.3.1 - Info and Relationships
      {
        id: 'headings-order',
        name: 'Headings must follow logical order',
        wcagLevel: 'A',
        check: (container: HTMLElement): AccessibilityIssue[] => {
          const issues: AccessibilityIssue[] = [];
          const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
          let previousLevel = 0;
          
          headings.forEach(heading => {
            const currentLevel = parseInt(heading.tagName.charAt(1));
            
            if (currentLevel > previousLevel + 1) {
              issues.push({
                type: 'error',
                rule: 'headings-order',
                message: `Heading level ${currentLevel} skips level ${previousLevel + 1}`,
                element: heading,
                impact: 'moderate',
                wcagLevel: 'A',
                suggestion: 'Use heading levels in sequential order (h1, h2, h3, etc.)'
              });
            }
            
            previousLevel = currentLevel;
          });
          
          return issues;
        }
      },

      // WCAG 1.3.1 - Form Labels
      {
        id: 'form-labels',
        name: 'Form inputs must have labels',
        wcagLevel: 'A',
        check: (container: HTMLElement): AccessibilityIssue[] => {
          const issues: AccessibilityIssue[] = [];
          const inputs = container.querySelectorAll('input:not([type="hidden"]), textarea, select');
          
          inputs.forEach(input => {
            const hasLabel = container.querySelector(`label[for="${input.id}"]`);
            const hasAriaLabel = input.hasAttribute('aria-label');
            const hasAriaLabelledby = input.hasAttribute('aria-labelledby');
            const hasTitle = input.hasAttribute('title');
            
            if (!hasLabel && !hasAriaLabel && !hasAriaLabelledby && !hasTitle) {
              issues.push({
                type: 'error',
                rule: 'form-labels',
                message: 'Form input missing accessible name',
                element: input,
                impact: 'serious',
                wcagLevel: 'A',
                suggestion: 'Add a label element, aria-label, aria-labelledby, or title attribute'
              });
            }
          });
          
          return issues;
        }
      },

      // WCAG 2.1.1 - Keyboard Navigation
      {
        id: 'keyboard-access',
        name: 'Interactive elements must be keyboard accessible',
        wcagLevel: 'A',
        check: (container: HTMLElement): AccessibilityIssue[] => {
          const issues: AccessibilityIssue[] = [];
          const interactive = container.querySelectorAll('[onclick], [role="button"], [role="link"]');
          
          interactive.forEach(element => {
            const isButton = element.tagName === 'BUTTON';
            const isLink = element.tagName === 'A' && element.hasAttribute('href');
            const hasTabIndex = element.hasAttribute('tabindex');
            const tabIndexValue = element.getAttribute('tabindex');
            
            if (!isButton && !isLink && (!hasTabIndex || tabIndexValue === '-1')) {
              issues.push({
                type: 'error',
                rule: 'keyboard-access',
                message: 'Interactive element not keyboard accessible',
                element: element,
                impact: 'serious',
                wcagLevel: 'A',
                suggestion: 'Use button/link elements or add tabindex="0"'
              });
            }
          });
          
          return issues;
        }
      },

      // WCAG 2.4.3 - Focus Order
      {
        id: 'focus-order',
        name: 'Focus order must be logical',
        wcagLevel: 'A',
        check: (container: HTMLElement): AccessibilityIssue[] => {
          const issues: AccessibilityIssue[] = [];
          const focusableElements = container.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          );
          
          const customTabIndexElements = Array.from(focusableElements).filter(el => {
            const tabIndex = el.getAttribute('tabindex');
            return tabIndex && parseInt(tabIndex) > 0;
          });
          
          if (customTabIndexElements.length > 0) {
            issues.push({
              type: 'warning',
              rule: 'focus-order',
              message: 'Positive tabindex values can disrupt focus order',
              element: customTabIndexElements[0] as HTMLElement,
              impact: 'moderate',
              wcagLevel: 'A',
              suggestion: 'Use tabindex="0" or rely on DOM order for focus management'
            });
          }
          
          return issues;
        }
      },

      // WCAG 3.2.2 - No Context Change on Input
      {
        id: 'no-auto-context-change',
        name: 'Avoid automatic context changes',
        wcagLevel: 'A',
        check: (container: HTMLElement): AccessibilityIssue[] => {
          const issues: AccessibilityIssue[] = [];
          const autoSubmitForms = container.querySelectorAll('select[onchange*="submit"], input[onchange*="submit"]');
          
          autoSubmitForms.forEach(element => {
            issues.push({
              type: 'warning',
              rule: 'no-auto-context-change',
              message: 'Form automatically submits on input change',
              element: element,
              impact: 'moderate',
              wcagLevel: 'A',
              suggestion: 'Provide a submit button instead of auto-submission'
            });
          });
          
          return issues;
        }
      },

      // WCAG 4.1.2 - Name, Role, Value
      {
        id: 'aria-roles',
        name: 'ARIA roles must be valid',
        wcagLevel: 'A',
        check: (container: HTMLElement): AccessibilityIssue[] => {
          const issues: AccessibilityIssue[] = [];
          const validRoles = [
            'alert', 'alertdialog', 'application', 'article', 'banner', 'button',
            'cell', 'checkbox', 'columnheader', 'combobox', 'complementary',
            'contentinfo', 'definition', 'dialog', 'directory', 'document',
            'feed', 'figure', 'form', 'grid', 'gridcell', 'group', 'heading',
            'img', 'link', 'list', 'listbox', 'listitem', 'log', 'main',
            'marquee', 'math', 'menu', 'menubar', 'menuitem', 'menuitemcheckbox',
            'menuitemradio', 'navigation', 'none', 'note', 'option', 'presentation',
            'progressbar', 'radio', 'radiogroup', 'region', 'row', 'rowgroup',
            'rowheader', 'scrollbar', 'search', 'searchbox', 'separator',
            'slider', 'spinbutton', 'status', 'switch', 'tab', 'table',
            'tablist', 'tabpanel', 'term', 'textbox', 'timer', 'toolbar',
            'tooltip', 'tree', 'treegrid', 'treeitem'
          ];
          
          const elementsWithRoles = container.querySelectorAll('[role]');
          
          elementsWithRoles.forEach(element => {
            const role = element.getAttribute('role');
            if (role && !validRoles.includes(role)) {
              issues.push({
                type: 'error',
                rule: 'aria-roles',
                message: `Invalid ARIA role: "${role}"`,
                element: element,
                impact: 'serious',
                wcagLevel: 'A',
                suggestion: 'Use a valid ARIA role or remove the role attribute'
              });
            }
          });
          
          return issues;
        }
      },

      // Color Contrast (simplified check)
      {
        id: 'color-contrast',
        name: 'Text must have sufficient color contrast',
        wcagLevel: 'AA',
        check: (container: HTMLElement): AccessibilityIssue[] => {
          const issues: AccessibilityIssue[] = [];
          // This is a simplified check - in a real implementation,
          // you'd need to calculate actual contrast ratios
          const lightColorTexts = container.querySelectorAll('[style*="color: #"]');
          
          lightColorTexts.forEach(element => {
            const style = element.getAttribute('style') || '';
            const colorMatch = style.match(/color:\s*#([a-fA-F0-9]{6})/);
            if (colorMatch) {
              const color = colorMatch[1];
              // Simple heuristic for light colors (this is not accurate contrast calculation)
              const isLight = parseInt(color, 16) > 0x888888;
              if (isLight) {
                issues.push({
                  type: 'warning',
                  rule: 'color-contrast',
                  message: 'Text color may have insufficient contrast',
                  element: element,
                  impact: 'moderate',
                  wcagLevel: 'AA',
                  suggestion: 'Verify color contrast meets WCAG AA standards (4.5:1)'
                });
              }
            }
          });
          
          return issues;
        }
      },

      // Touch Target Size
      {
        id: 'touch-targets',
        name: 'Touch targets must be at least 44px',
        wcagLevel: 'AA',
        check: (container: HTMLElement): AccessibilityIssue[] => {
          const issues: AccessibilityIssue[] = [];
          const interactive = container.querySelectorAll('button, [role="button"], a, input, select, textarea');
          
          interactive.forEach(element => {
            const rect = element.getBoundingClientRect();
            const minSize = 44;
            
            if (rect.width > 0 && rect.height > 0 && (rect.width < minSize || rect.height < minSize)) {
              issues.push({
                type: 'warning',
                rule: 'touch-targets',
                message: `Touch target too small: ${Math.round(rect.width)}x${Math.round(rect.height)}px`,
                element: element,
                impact: 'moderate',
                wcagLevel: 'AA',
                suggestion: 'Ensure interactive elements are at least 44x44px'
              });
            }
          });
          
          return issues;
        }
      }
    ];
  }

  public validate(container: HTMLElement = document.body): AccessibilityValidationResult {
    const allIssues: AccessibilityIssue[] = [];
    
    this.rules.forEach(rule => {
      const issues = rule.check(container);
      allIssues.push(...issues);
    });

    const summary = {
      errors: allIssues.filter(i => i.type === 'error').length,
      warnings: allIssues.filter(i => i.type === 'warning').length,
      infos: allIssues.filter(i => i.type === 'info').length
    };

    // Calculate score based on issues
    const totalPossiblePoints = this.rules.length * 10;
    const errorPenalty = summary.errors * 10;
    const warningPenalty = summary.warnings * 5;
    const infoPenalty = summary.infos * 1;
    
    const score = Math.max(0, Math.round(
      ((totalPossiblePoints - errorPenalty - warningPenalty - infoPenalty) / totalPossiblePoints) * 100
    ));

    return {
      issues: allIssues,
      score,
      summary
    };
  }
}

interface AccessibilityRule {
  id: string;
  name: string;
  wcagLevel: 'A' | 'AA' | 'AAA';
  check: (container: HTMLElement) => AccessibilityIssue[];
}

// ============================================================================
// Accessibility Testing Hook
// ============================================================================

export function useAccessibilityTesting() {
  const [validator] = useState(() => new AccessibilityValidator());
  const [isTestingEnabled, setIsTestingEnabled] = useState(false);
  const [results, setResults] = useState<AccessibilityValidationResult | null>(null);

  const runTests = useCallback((container?: HTMLElement) => {
    const result = validator.validate(container);
    setResults(result);
    return result;
  }, [validator]);

  const enableContinuousTesting = useCallback((container?: HTMLElement) => {
    setIsTestingEnabled(true);
    
    const runContinuousTests = () => {
      if (isTestingEnabled) {
        runTests(container);
        setTimeout(runContinuousTests, 5000); // Test every 5 seconds
      }
    };
    
    runContinuousTests();
  }, [isTestingEnabled, runTests]);

  const disableContinuousTesting = useCallback(() => {
    setIsTestingEnabled(false);
  }, []);

  return {
    runTests,
    enableContinuousTesting,
    disableContinuousTesting,
    isTestingEnabled,
    results
  };
}

// ============================================================================
// Accessibility Testing Panel
// ============================================================================

interface AccessibilityTestingPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccessibilityTestingPanel({ isOpen, onClose }: AccessibilityTestingPanelProps) {
  const { runTests, results, enableContinuousTesting, disableContinuousTesting, isTestingEnabled } = useAccessibilityTesting();
  const [selectedIssue, setSelectedIssue] = useState<AccessibilityIssue | null>(null);

  const handleRunTests = () => {
    runTests();
  };

  const handleToggleContinuous = () => {
    if (isTestingEnabled) {
      disableContinuousTesting();
    } else {
      enableContinuousTesting();
    }
  };

  const handleIssueClick = (issue: AccessibilityIssue) => {
    setSelectedIssue(issue);
    if (issue.element) {
      // Highlight the element
      issue.element.style.outline = '3px solid red';
      issue.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Remove highlight after 3 seconds
      setTimeout(() => {
        issue.element!.style.outline = '';
      }, 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      <div className="absolute right-0 top-0 h-full w-96 bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Accessibility Testing</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Controls */}
        <div className="p-4 border-b space-y-3">
          <button
            onClick={handleRunTests}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Run Accessibility Tests
          </button>
          
          <button
            onClick={handleToggleContinuous}
            className={`w-full px-4 py-2 rounded-md ${
              isTestingEnabled 
                ? 'bg-red-600 text-white hover:bg-red-700' 
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isTestingEnabled ? 'Stop Continuous Testing' : 'Start Continuous Testing'}
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {results ? (
            <div className="space-y-4">
              {/* Score */}
              <div className="text-center">
                <div className={`text-3xl font-bold ${
                  results.score >= 90 ? 'text-green-600' :
                  results.score >= 70 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {results.score}%
                </div>
                <div className="text-sm text-gray-600">Accessibility Score</div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-red-50 p-2 rounded">
                  <div className="text-lg font-semibold text-red-600">{results.summary.errors}</div>
                  <div className="text-xs text-red-600">Errors</div>
                </div>
                <div className="bg-yellow-50 p-2 rounded">
                  <div className="text-lg font-semibold text-yellow-600">{results.summary.warnings}</div>
                  <div className="text-xs text-yellow-600">Warnings</div>
                </div>
                <div className="bg-blue-50 p-2 rounded">
                  <div className="text-lg font-semibold text-blue-600">{results.summary.infos}</div>
                  <div className="text-xs text-blue-600">Infos</div>
                </div>
              </div>

              {/* Issues List */}
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900">Issues</h3>
                {results.issues.length === 0 ? (
                  <p className="text-green-600">No accessibility issues found!</p>
                ) : (
                  <div className="space-y-2">
                    {results.issues.map((issue, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-md border cursor-pointer hover:bg-gray-50 ${
                          issue.type === 'error' ? 'border-red-200 bg-red-50' :
                          issue.type === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                          'border-blue-200 bg-blue-50'
                        }`}
                        onClick={() => handleIssueClick(issue)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className={`text-sm font-medium ${
                              issue.type === 'error' ? 'text-red-800' :
                              issue.type === 'warning' ? 'text-yellow-800' :
                              'text-blue-800'
                            }`}>
                              {issue.message}
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              WCAG {issue.wcagLevel} • {issue.impact} impact
                            </div>
                            {issue.suggestion && (
                              <div className="text-xs text-gray-700 mt-2 font-medium">
                                💡 {issue.suggestion}
                              </div>
                            )}
                          </div>
                          <div className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                            issue.type === 'error' ? 'bg-red-100 text-red-800' :
                            issue.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {issue.type}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500">
              <p>Run tests to see accessibility analysis</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Development Accessibility Helper
// ============================================================================

export function AccessibilityDevTools() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  
  // Only show in development
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (!isDevelopment) return null;

  return (
    <>
      {/* Accessibility Testing Button */}
      <div className="fixed bottom-20 right-4 z-40">
        <button
          onClick={() => setIsPanelOpen(true)}
          className="w-12 h-12 bg-purple-600 text-white rounded-full hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 shadow-lg transition-all"
          aria-label="Open accessibility testing panel"
          title="Accessibility Testing"
        >
          <svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>

      <AccessibilityTestingPanel 
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
      />
    </>
  );
}