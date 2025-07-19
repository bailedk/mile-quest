'use client';

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ReactNode, useRef, useState } from 'react';

interface Card3DHoverProps {
  children: ReactNode;
  className?: string;
  intensity?: number;
}

export function Card3DHover({
  children,
  className = '',
  intensity = 10
}: Card3DHoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);

  const rotateX = useTransform(
    mouseYSpring,
    [-0.5, 0.5],
    [`${intensity}deg`, `-${intensity}deg`]
  );
  const rotateY = useTransform(
    mouseXSpring,
    [-0.5, 0.5],
    [`-${intensity}deg`, `${intensity}deg`]
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    x.set((mouseX - width / 2) / width);
    y.set((mouseY - height / 2) / height);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className={`transform-gpu ${className}`}
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      <div style={{ transform: 'translateZ(75px)' }}>
        {children}
      </div>
    </motion.div>
  );
}

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: string;
}

export function GlowCard({
  children,
  className = '',
  glowColor = 'rgba(var(--primary-rgb), 0.4)'
}: GlowCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    setMouseX(e.clientX - rect.left);
    setMouseY(e.clientY - rect.top);
  };

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden ${className}`}
      onMouseMove={handleMouseMove}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(600px circle at ${mouseX}px ${mouseY}px, ${glowColor}, transparent 40%)`,
        }}
      />
      {children}
    </div>
  );
}

interface LiftCardProps {
  children: ReactNode;
  className?: string;
  liftHeight?: number;
}

export function LiftCard({
  children,
  className = '',
  liftHeight = 8
}: LiftCardProps) {
  return (
    <motion.div
      className={`transition-shadow ${className}`}
      whileHover={{
        y: -liftHeight,
        transition: { type: 'spring', stiffness: 300, damping: 20 }
      }}
      initial={{ boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
      whileHover={{
        boxShadow: `0 ${liftHeight + 12}px 25px -5px rgba(0, 0, 0, 0.1), 0 ${liftHeight + 8}px 10px -5px rgba(0, 0, 0, 0.04)`
      }}
    >
      {children}
    </motion.div>
  );
}

interface ParallaxCardProps {
  children: ReactNode;
  className?: string;
  layers?: number;
}

export function ParallaxCard({
  children,
  className = '',
  layers = 3
}: ParallaxCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const percentX = (e.clientX - centerX) / (rect.width / 2);
    const percentY = (e.clientY - centerY) / (rect.height / 2);

    setRotateX(-percentY * 10);
    setRotateY(percentX * 10);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <div
      ref={ref}
      className={`relative preserve-3d ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        transition: 'transform 0.2s ease-out',
      }}
    >
      {Array.from({ length: layers }).map((_, index) => (
        <div
          key={index}
          className="absolute inset-0"
          style={{
            transform: `translateZ(${index * 20}px)`,
            opacity: index === 0 ? 1 : 0.1,
          }}
        >
          {index === 0 ? children : <div className="h-full w-full bg-primary/10 rounded-lg" />}
        </div>
      ))}
    </div>
  );
}