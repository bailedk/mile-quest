'use client';

import React, { useRef, useEffect, useState, useCallback, createContext, useContext } from 'react';

// ============================================================================
// Keyboard Event Constants
// ============================================================================

export const KEYBOARD_KEYS = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown',
  DELETE: 'Delete',
  BACKSPACE: 'Backspace'
} as const;

// ============================================================================
// Focus Management Utilities
// ============================================================================

export function useFocusManagement() {
  const [focusedElement, setFocusedElement] = useState<HTMLElement | null>(null);
  const focusHistoryRef = useRef<HTMLElement[]>([]);

  const storeFocus = useCallback(() => {
    const currentFocus = document.activeElement as HTMLElement;
    if (currentFocus && currentFocus !== document.body) {
      setFocusedElement(currentFocus);
      focusHistoryRef.current.unshift(currentFocus);
      // Keep only last 10 focus elements
      if (focusHistoryRef.current.length > 10) {
        focusHistoryRef.current = focusHistoryRef.current.slice(0, 10);
      }
    }
  }, []);

  const restoreFocus = useCallback(() => {
    if (focusedElement && document.contains(focusedElement)) {
      focusedElement.focus();
    } else {
      // Try to find a focusable element from history
      const validElement = focusHistoryRef.current.find(el => 
        document.contains(el) && el.offsetParent !== null
      );
      if (validElement) {
        validElement.focus();
      }
    }
  }, [focusedElement]);

  const focusFirst = useCallback((container: HTMLElement) => {
    const focusableElement = getFocusableElements(container)[0];
    if (focusableElement) {
      focusableElement.focus();
      return true;
    }
    return false;
  }, []);

  const focusLast = useCallback((container: HTMLElement) => {
    const focusableElements = getFocusableElements(container);
    const lastElement = focusableElements[focusableElements.length - 1];
    if (lastElement) {
      lastElement.focus();
      return true;
    }
    return false;
  }, []);

  return {
    storeFocus,
    restoreFocus,
    focusFirst,
    focusLast,
    focusedElement
  };
}

// ============================================================================
// Focus Trap Component
// ============================================================================

interface FocusTrapProps {
  children: React.ReactNode;
  enabled?: boolean;
  restoreFocus?: boolean;
  allowOutsideClick?: boolean;
  onEscape?: () => void;
  className?: string;
}

export function FocusTrap({
  children,
  enabled = true,
  restoreFocus = true,
  allowOutsideClick = false,
  onEscape,
  className = ''
}: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { storeFocus, restoreFocus: restore } = useFocusManagement();

  useEffect(() => {
    if (!enabled) return;

    // Store the currently focused element
    if (restoreFocus) {
      storeFocus();
    }

    const container = containerRef.current;
    if (!container) return;

    // Focus the first focusable element
    const firstFocusable = getFocusableElements(container)[0];
    if (firstFocusable) {
      firstFocusable.focus();
    }

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== KEYBOARD_KEYS.TAB) return;

      const focusableElements = getFocusableElements(container);
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };

    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === KEYBOARD_KEYS.ESCAPE && onEscape) {
        onEscape();
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (!allowOutsideClick && container && !container.contains(e.target as Node)) {
        e.preventDefault();
        // Return focus to container
        const firstFocusable = getFocusableElements(container)[0];
        if (firstFocusable) {
          firstFocusable.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTabKey);
    document.addEventListener('keydown', handleEscapeKey);
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('keydown', handleTabKey);
      document.removeEventListener('keydown', handleEscapeKey);
      document.removeEventListener('click', handleClick, true);
      
      if (restoreFocus) {
        restore();
      }
    };
  }, [enabled, restoreFocus, allowOutsideClick, onEscape, storeFocus, restore]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}

// ============================================================================
// Roving Tabindex Hook
// ============================================================================

export function useRovingTabindex<T extends HTMLElement>() {
  const [activeIndex, setActiveIndex] = useState(0);
  const itemsRef = useRef<T[]>([]);

  const registerItem = useCallback((item: T | null, index: number) => {
    if (item) {
      itemsRef.current[index] = item;
    }
  }, []);

  const moveToIndex = useCallback((newIndex: number) => {
    const items = itemsRef.current.filter(Boolean);
    if (newIndex >= 0 && newIndex < items.length) {
      setActiveIndex(newIndex);
      items[newIndex]?.focus();
    }
  }, []);

  const moveNext = useCallback(() => {
    const items = itemsRef.current.filter(Boolean);
    const nextIndex = (activeIndex + 1) % items.length;
    moveToIndex(nextIndex);
  }, [activeIndex, moveToIndex]);

  const movePrevious = useCallback(() => {
    const items = itemsRef.current.filter(Boolean);
    const prevIndex = activeIndex === 0 ? items.length - 1 : activeIndex - 1;
    moveToIndex(prevIndex);
  }, [activeIndex, moveToIndex]);

  const moveToFirst = useCallback(() => {
    moveToIndex(0);
  }, [moveToIndex]);

  const moveToLast = useCallback(() => {
    const items = itemsRef.current.filter(Boolean);
    moveToIndex(items.length - 1);
  }, [moveToIndex]);

  const getItemProps = useCallback((index: number) => ({
    ref: (item: T | null) => registerItem(item, index),
    tabIndex: index === activeIndex ? 0 : -1,
    onFocus: () => setActiveIndex(index),
    onKeyDown: (e: React.KeyboardEvent) => {
      switch (e.key) {
        case KEYBOARD_KEYS.ARROW_DOWN:
        case KEYBOARD_KEYS.ARROW_RIGHT:
          e.preventDefault();
          moveNext();
          break;
        case KEYBOARD_KEYS.ARROW_UP:
        case KEYBOARD_KEYS.ARROW_LEFT:
          e.preventDefault();
          movePrevious();
          break;
        case KEYBOARD_KEYS.HOME:
          e.preventDefault();
          moveToFirst();
          break;
        case KEYBOARD_KEYS.END:
          e.preventDefault();
          moveToLast();
          break;
      }
    }
  }), [activeIndex, registerItem, moveNext, movePrevious, moveToFirst, moveToLast]);

  return {
    activeIndex,
    moveToIndex,
    moveNext,
    movePrevious,
    moveToFirst,
    moveToLast,
    getItemProps
  };
}

// ============================================================================
// Keyboard Shortcuts Hook
// ============================================================================

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  callback: (e: KeyboardEvent) => void;
  description?: string;
  preventDefault?: boolean;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled = true) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const shortcut = shortcutsRef.current.find(s => 
        s.key.toLowerCase() === e.key.toLowerCase() &&
        !!s.ctrlKey === e.ctrlKey &&
        !!s.metaKey === e.metaKey &&
        !!s.shiftKey === e.shiftKey &&
        !!s.altKey === e.altKey
      );

      if (shortcut) {
        if (shortcut.preventDefault !== false) {
          e.preventDefault();
        }
        shortcut.callback(e);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);

  return {
    shortcuts: shortcutsRef.current
  };
}

// ============================================================================
// Keyboard Navigation Context
// ============================================================================

interface KeyboardNavigationContextType {
  isKeyboardUser: boolean;
  focusMethod: 'mouse' | 'keyboard' | 'programmatic';
}

const KeyboardNavigationContext = createContext<KeyboardNavigationContextType>({
  isKeyboardUser: false,
  focusMethod: 'mouse'
});

export function KeyboardNavigationProvider({ children }: { children: React.ReactNode }) {
  const [isKeyboardUser, setIsKeyboardUser] = useState(false);
  const [focusMethod, setFocusMethod] = useState<'mouse' | 'keyboard' | 'programmatic'>('mouse');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === KEYBOARD_KEYS.TAB) {
        setIsKeyboardUser(true);
        setFocusMethod('keyboard');
      }
    };

    const handleMouseDown = () => {
      setIsKeyboardUser(false);
      setFocusMethod('mouse');
    };

    const handleFocus = (e: FocusEvent) => {
      // If focus event wasn't triggered by mouse or keyboard, it's programmatic
      if (!isKeyboardUser && e.target === document.activeElement) {
        setFocusMethod('programmatic');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('focus', handleFocus, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('focus', handleFocus, true);
    };
  }, [isKeyboardUser]);

  return (
    <KeyboardNavigationContext.Provider value={{ isKeyboardUser, focusMethod }}>
      {children}
    </KeyboardNavigationContext.Provider>
  );
}

export function useKeyboardNavigation() {
  return useContext(KeyboardNavigationContext);
}

// ============================================================================
// Accessible Menu Component
// ============================================================================

interface AccessibleMenuProps {
  trigger: React.ReactElement;
  children: React.ReactNode;
  placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
  className?: string;
  menuClassName?: string;
  onOpen?: () => void;
  onClose?: () => void;
}

export function AccessibleMenu({
  trigger,
  children,
  placement = 'bottom-start',
  className = '',
  menuClassName = '',
  onOpen,
  onClose
}: AccessibleMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { activeIndex, getItemProps, moveToFirst } = useRovingTabindex<HTMLElement>();

  const menuId = `menu-${Math.random().toString(36).substr(2, 9)}`;

  const openMenu = useCallback(() => {
    setIsOpen(true);
    onOpen?.();
    // Focus first item after menu opens
    setTimeout(() => moveToFirst(), 0);
  }, [onOpen, moveToFirst]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    onClose?.();
    // Return focus to trigger
    triggerRef.current?.focus();
  }, [onClose]);

  const handleTriggerKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case KEYBOARD_KEYS.ENTER:
      case KEYBOARD_KEYS.SPACE:
      case KEYBOARD_KEYS.ARROW_DOWN:
        e.preventDefault();
        openMenu();
        break;
      case KEYBOARD_KEYS.ARROW_UP:
        e.preventDefault();
        openMenu();
        // Move to last item
        setTimeout(() => {
          const items = menuRef.current?.querySelectorAll('[role="menuitem"]');
          if (items && items.length > 0) {
            (items[items.length - 1] as HTMLElement).focus();
          }
        }, 0);
        break;
    }
  }, [openMenu]);

  const handleMenuKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case KEYBOARD_KEYS.ESCAPE:
        e.preventDefault();
        closeMenu();
        break;
      case KEYBOARD_KEYS.TAB:
        e.preventDefault();
        closeMenu();
        break;
    }
  }, [closeMenu]);

  // Clone trigger to add accessibility props
  const accessibleTrigger = React.cloneElement(trigger, {
    ref: triggerRef,
    'aria-haspopup': 'menu',
    'aria-expanded': isOpen,
    'aria-controls': menuId,
    onClick: (e: React.MouseEvent) => {
      trigger.props.onClick?.(e);
      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      trigger.props.onKeyDown?.(e);
      handleTriggerKeyDown(e);
    }
  });

  return (
    <div className={`relative ${className}`}>
      {accessibleTrigger}
      
      {isOpen && (
        <FocusTrap
          enabled={isOpen}
          onEscape={closeMenu}
          className={`
            absolute z-50 bg-white border border-gray-200 rounded-md shadow-lg
            ${placement.includes('bottom') ? 'top-full mt-1' : 'bottom-full mb-1'}
            ${placement.includes('end') ? 'right-0' : 'left-0'}
            ${menuClassName}
          `}
        >
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-orientation="vertical"
            onKeyDown={handleMenuKeyDown}
            className="py-1"
          >
            {children}
          </div>
        </FocusTrap>
      )}
    </div>
  );
}

interface AccessibleMenuItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  index: number;
}

export function AccessibleMenuItem({
  children,
  onClick,
  disabled = false,
  className = '',
  index
}: AccessibleMenuItemProps) {
  const { getItemProps } = useRovingTabindex<HTMLDivElement>();
  
  const handleClick = useCallback(() => {
    if (!disabled && onClick) {
      onClick();
    }
  }, [disabled, onClick]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === KEYBOARD_KEYS.ENTER || e.key === KEYBOARD_KEYS.SPACE) {
      e.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  return (
    <div
      {...getItemProps(index)}
      role="menuitem"
      aria-disabled={disabled}
      className={`
        px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:outline-none
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelector = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contentEditable="true"]'
  ].join(', ');

  const elements = Array.from(container.querySelectorAll(focusableSelector)) as HTMLElement[];
  
  return elements.filter(element => {
    // Check if element is visible
    const style = window.getComputedStyle(element);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      element.offsetParent !== null
    );
  });
}

export function isElementInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

export function scrollElementIntoView(element: HTMLElement, behavior: ScrollBehavior = 'smooth'): void {
  if (!isElementInViewport(element)) {
    element.scrollIntoView({ 
      behavior, 
      block: 'nearest', 
      inline: 'nearest' 
    });
  }
}