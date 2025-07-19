'use client';

import { motion, useSpring, useTransform } from 'framer-motion';
import { ReactNode, useEffect, useRef, useState } from 'react';

interface NumberCounterProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  formatNumber?: (value: number) => string;
  delay?: number;
  startFrom?: number;
}

export function NumberCounter({
  value,
  duration = 2,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
  formatNumber,
  delay = 0,
  startFrom = 0
}: NumberCounterProps) {
  const [hasAnimated, setHasAnimated] = useState(false);
  const springValue = useSpring(startFrom, { duration: duration * 1000 });
  
  const displayValue = useTransform(springValue, (latest) => {
    const formatted = formatNumber 
      ? formatNumber(latest)
      : latest.toFixed(decimals);
    return `${prefix}${formatted}${suffix}`;
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasAnimated) {
        springValue.set(value);
        setHasAnimated(true);
      }
    }, delay * 1000);

    return () => clearTimeout(timer);
  }, [value, springValue, hasAnimated, delay]);

  return (
    <motion.span className={className}>
      {displayValue}
    </motion.span>
  );
}

interface AnimatedStatProps {
  label: string;
  value: number;
  icon?: ReactNode;
  color?: string;
  formatValue?: (value: number) => string;
  className?: string;
}

export function AnimatedStat({
  label,
  value,
  icon,
  color = 'primary',
  formatValue,
  className = ''
}: AnimatedStatProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <motion.div
      className={`text-center ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {icon && (
        <motion.div
          className={`mx-auto mb-2 text-${color}`}
          initial={{ scale: 0 }}
          animate={{ scale: isVisible ? 1 : 0 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        >
          {icon}
        </motion.div>
      )}
      <div className="text-2xl font-bold">
        <NumberCounter 
          value={value} 
          formatNumber={formatValue}
          delay={0.3}
        />
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </motion.div>
  );
}

interface ProgressNumberProps {
  current: number;
  total: number;
  showPercentage?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ProgressNumber({
  current,
  total,
  showPercentage = true,
  className = '',
  size = 'md'
}: ProgressNumberProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0;
  
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      <span className="font-semibold">
        <NumberCounter value={current} />
      </span>
      <span className="text-muted-foreground"> / {total}</span>
      {showPercentage && (
        <span className="ml-2 text-muted-foreground">
          (<NumberCounter value={percentage} decimals={1} suffix="%" />)
        </span>
      )}
    </div>
  );
}

interface CountUpOnScrollProps {
  value: number;
  threshold?: number;
  className?: string;
  formatNumber?: (value: number) => string;
}

export function CountUpOnScroll({
  value,
  threshold = 0.5,
  className = '',
  formatNumber
}: CountUpOnScrollProps) {
  const [isInView, setIsInView] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setIsInView(true);
          setHasAnimated(true);
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [threshold, hasAnimated]);

  return (
    <div ref={ref} className={className}>
      <NumberCounter
        value={isInView ? value : 0}
        formatNumber={formatNumber}
        duration={1.5}
      />
    </div>
  );
}