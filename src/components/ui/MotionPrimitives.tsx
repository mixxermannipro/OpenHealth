import React, { useEffect, useRef } from 'react';
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

function formatAnimatedVal(val: number, decimals: number): string {
  return decimals > 0
    ? formatNumberDE(Number(val.toFixed(decimals)), decimals)
    : formatNumberDE(Math.round(val), 0);
}

/**
 * Smooth spring-interpolated German number readout for Apple/Whoop hero metrics.
 * Updates DOM text directly via ref so animations run at 60–120 fps without React re-renders.
 */
export const AnimatedNumber: React.FC<{
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}> = ({ value, decimals = 0, suffix = '', prefix = '', className = '' }) => {
  const spring = useSpring(value, {
    stiffness: 135,
    damping: 24,
    mass: 0.65,
  });
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  useEffect(() => {
    const unsubscribe = spring.on('change', (latest) => {
      if (spanRef.current) {
        spanRef.current.textContent = `${prefix}${formatAnimatedVal(latest, decimals)}${suffix}`;
      }
    });
    return () => unsubscribe();
  }, [spring, decimals, prefix, suffix]);

  return (
    <span ref={spanRef} className={className}>
      {prefix}
      {formatAnimatedVal(value, decimals)}
      {suffix}
    </span>
  );
};

export const staggerParentVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.032,
      delayChildren: 0.01,
    },
  },
};

export const staggerCardVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.99 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.24,
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
