import React, { useEffect, useState } from 'react';
import { motion, useSpring } from 'motion/react';
import { formatNumberDE } from '../../utils/formatters';

export const APPLE_EASE = [0.22, 1, 0.36, 1] as const;

export const APPLE_SPRING = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 32,
  mass: 0.85,
};

export const SNAPPY_SPRING = {
  type: 'spring' as const,
  stiffness: 480,
  damping: 34,
};

export const PAGE_TRANSITION = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.24, ease: APPLE_EASE },
};

/**
 * Smooth spring-interpolated German number readout for Apple/Whoop hero metrics.
 * Animates live whenever the numeric value updates (e.g. after logging check-in or meal).
 */
export const AnimatedNumber: React.FC<{
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}> = ({ value, decimals = 0, suffix = '', prefix = '', className = '' }) => {
  const spring = useSpring(value, {
    stiffness: 110,
    damping: 22,
    mass: 0.7,
  });
  const [display, setDisplay] = useState<number>(value);

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  useEffect(() => {
    const unsubscribe = spring.on('change', (latest) => {
      setDisplay(latest);
    });
    return () => unsubscribe();
  }, [spring]);

  const formatted =
    decimals > 0
      ? formatNumberDE(Number(display.toFixed(decimals)), decimals)
      : formatNumberDE(Math.round(display), 0);

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};

export const staggerParentVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.045,
      delayChildren: 0.02,
    },
  },
};

export const staggerCardVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.99 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.34,
      ease: APPLE_EASE,
    },
  },
};

/**
 * Tactile Apple Liquid Glass Card Wrapper with gentle spring hover & press response
 */
export const MotionCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
}> = ({ children, className = '', interactive = false }) => (
  <motion.div
    variants={staggerCardVariants}
    whileTap={interactive ? { scale: 0.986 } : undefined}
    transition={{ type: 'spring', stiffness: 460, damping: 32 }}
    className={`apple-card ${className}`}
  >
    {children}
  </motion.div>
);
