'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ReactNode, useState } from 'react';

interface FABAction {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  color?: string;
}

interface FloatingActionButtonProps {
  icon: ReactNode;
  actions?: FABAction[];
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  className?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function FloatingActionButton({
  icon,
  actions = [],
  position = 'bottom-right',
  className = '',
  color = 'rgb(var(--primary))',
  size = 'md'
}: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4'
  };

  const sizeClasses = {
    sm: 'h-12 w-12',
    md: 'h-14 w-14',
    lg: 'h-16 w-16'
  };

  const actionSizeClasses = {
    sm: 'h-10 w-10',
    md: 'h-12 w-12',
    lg: 'h-14 w-14'
  };

  const getActionPosition = (index: number) => {
    const spacing = size === 'sm' ? 48 : size === 'md' ? 56 : 64;
    
    if (position.includes('bottom')) {
      return { bottom: (index + 1) * spacing + spacing };
    } else {
      return { top: (index + 1) * spacing + spacing };
    }
  };

  return (
    <div className={`fixed z-50 ${positionClasses[position]} ${className}`}>
      <AnimatePresence>
        {isOpen && actions.length > 0 && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              style={{ zIndex: -1 }}
            />
            
            {/* Action buttons */}
            {actions.map((action, index) => (
              <motion.button
                key={index}
                className={`absolute ${actionSizeClasses[size]} rounded-full shadow-lg flex items-center justify-center text-white hover:scale-110 transition-transform`}
                style={{
                  backgroundColor: action.color || color,
                  ...getActionPosition(index),
                  right: position.includes('right') ? 0 : undefined,
                  left: position.includes('left') ? 0 : undefined,
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ 
                  scale: 1, 
                  opacity: 1,
                  transition: { delay: index * 0.05 }
                }}
                exit={{ 
                  scale: 0, 
                  opacity: 0,
                  transition: { delay: (actions.length - index - 1) * 0.05 }
                }}
                onClick={() => {
                  action.onClick();
                  setIsOpen(false);
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                {action.icon}
                
                {/* Label tooltip */}
                <span className={`absolute ${position.includes('right') ? 'right-full mr-3' : 'left-full ml-3'} whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity`}>
                  {action.label}
                </span>
              </motion.button>
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Main FAB button */}
      <motion.button
        className={`${sizeClasses[size]} rounded-full shadow-lg flex items-center justify-center text-white relative overflow-hidden`}
        style={{ backgroundColor: color }}
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={{ rotate: isOpen ? 45 : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        {icon}
        
        {/* Ripple effect on click */}
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.3)' }}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{ duration: 0.6 }}
          key={Date.now()} // Force re-render for each click
        />
      </motion.button>
    </div>
  );
}

interface SpeedDialProps {
  children: ReactNode;
  actions: FABAction[];
  direction?: 'up' | 'down' | 'left' | 'right';
  className?: string;
}

export function SpeedDial({
  children,
  actions,
  direction = 'up',
  className = ''
}: SpeedDialProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getTransform = (index: number) => {
    const spacing = 60;
    const distance = (index + 1) * spacing;

    switch (direction) {
      case 'up':
        return { x: 0, y: -distance };
      case 'down':
        return { x: 0, y: distance };
      case 'left':
        return { x: -distance, y: 0 };
      case 'right':
        return { x: distance, y: 0 };
    }
  };

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Action items */}
      <AnimatePresence>
        {isOpen && (
          <>
            {actions.map((action, index) => (
              <motion.div
                key={index}
                className="absolute inset-0 flex items-center justify-center"
                initial={{ opacity: 0, scale: 0.3, ...getTransform(0) }}
                animate={{ 
                  opacity: 1, 
                  scale: 1, 
                  ...getTransform(index),
                  transition: { delay: index * 0.05 }
                }}
                exit={{ 
                  opacity: 0, 
                  scale: 0.3, 
                  ...getTransform(0),
                  transition: { delay: (actions.length - index - 1) * 0.05 }
                }}
              >
                <button
                  className="group relative h-12 w-12 rounded-full bg-background shadow-md border flex items-center justify-center hover:scale-110 transition-transform"
                  onClick={() => {
                    action.onClick();
                    setIsOpen(false);
                  }}
                >
                  {action.icon}
                  
                  {/* Tooltip */}
                  <span className="absolute bottom-full mb-2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    {action.label}
                  </span>
                </button>
              </motion.div>
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Main trigger */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        animate={{ rotate: isOpen ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        {children}
      </motion.button>
    </div>
  );
}

interface MiniFABProps {
  icon: ReactNode;
  onClick: () => void;
  className?: string;
  color?: string;
}

export function MiniFAB({
  icon,
  onClick,
  className = '',
  color = 'rgb(var(--primary))'
}: MiniFABProps) {
  return (
    <motion.button
      className={`h-10 w-10 rounded-full shadow-md flex items-center justify-center text-white ${className}`}
      style={{ backgroundColor: color }}
      onClick={onClick}
      whileHover={{ scale: 1.1, boxShadow: '0 8px 16px rgba(0,0,0,0.2)' }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
    >
      {icon}
    </motion.button>
  );
}