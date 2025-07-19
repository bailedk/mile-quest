'use client';

import { motion, useAnimation } from 'framer-motion';
import { ReactNode, useState } from 'react';

interface RippleButtonProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export function RippleButton({
  children,
  onClick,
  className = '',
  variant = 'primary',
  size = 'md',
  disabled = false
}: RippleButtonProps) {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; size: number }>>([]);

  const createRipple = (event: React.MouseEvent<HTMLButtonElement>) => {
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    const newRipple = { x, y, size };
    setRipples([...ripples, newRipple]);

    // Remove ripple after animation
    setTimeout(() => {
      setRipples(ripples => ripples.slice(1));
    }, 600);
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    createRipple(event);
    onClick?.();
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  const variantClasses = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    ghost: 'hover:bg-accent hover:text-accent-foreground'
  };

  return (
    <motion.button
      className={`relative overflow-hidden rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      onClick={handleClick}
      disabled={disabled}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
    >
      {children}
      <span className="absolute inset-0 pointer-events-none">
        {ripples.map((ripple, index) => (
          <span
            key={index}
            className="absolute rounded-full bg-white/30 animate-ripple"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: ripple.size,
              height: ripple.size,
            }}
          />
        ))}
      </span>
    </motion.button>
  );
}

interface MagneticButtonProps {
  children: ReactNode;
  className?: string;
  strength?: number;
}

export function MagneticButton({
  children,
  className = '',
  strength = 0.3
}: MagneticButtonProps) {
  const controls = useAnimation();
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isHovered) return;

    const { currentTarget, clientX, clientY } = e;
    const { left, top, width, height } = currentTarget.getBoundingClientRect();
    const x = (clientX - left - width / 2) * strength;
    const y = (clientY - top - height / 2) * strength;

    controls.start({ x, y });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    controls.start({ x: 0, y: 0 });
  };

  return (
    <div
      className={`inline-block ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div animate={controls} transition={{ type: 'spring', stiffness: 150, damping: 15 }}>
        {children}
      </motion.div>
    </div>
  );
}

interface PulseButtonProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  pulseColor?: string;
}

export function PulseButton({
  children,
  className = '',
  onClick,
  pulseColor = 'rgb(var(--primary))'
}: PulseButtonProps) {
  return (
    <button
      className={`relative group ${className}`}
      onClick={onClick}
    >
      <span className="relative z-10">{children}</span>
      <motion.span
        className="absolute inset-0 rounded-lg"
        style={{ backgroundColor: pulseColor }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0, 0.3],
        }}
        transition={{
          duration: 2,
          ease: "easeInOut",
          repeat: Infinity,
        }}
      />
    </button>
  );
}

interface HoverScaleButtonProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  scaleAmount?: number;
}

export function HoverScaleButton({
  children,
  className = '',
  onClick,
  scaleAmount = 1.05
}: HoverScaleButtonProps) {
  return (
    <motion.button
      className={`transform-gpu ${className}`}
      onClick={onClick}
      whileHover={{ 
        scale: scaleAmount,
        transition: { type: 'spring', stiffness: 400, damping: 10 }
      }}
      whileTap={{ scale: 0.95 }}
    >
      {children}
    </motion.button>
  );
}