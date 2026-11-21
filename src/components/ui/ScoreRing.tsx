import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface ScoreRingProps {
  score: number | null;
  label: string;
  sublabel?: string;
  size?: number;
  strokeWidth?: number;
  accentColor?: string;
  unit?: string;
}

export const ScoreRing: React.FC<ScoreRingProps> = ({
  score,
  label,
  sublabel,
  size = 186,
  strokeWidth = 11,
  accentColor = 'var(--accent-recovery)',
  unit = '%',
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = score === null ? 0 : Math.max(0, Math.min(100, score));
  const dashOffset = circumference - (clamped / 100) * circumference;

  const [displayNum, setDisplayNum] = useState(score ?? 0);

  useEffect(() => {
    if (score === null) return;
    const start = displayNum;
    const end = score;
    if (start === end) return;
    let frame = 0;
    const totalFrames = 18;
    let rafId = 0;
    const tick = () => {
      frame++;
      const progress = 1 - Math.pow(1 - frame / totalFrames, 3);
      setDisplayNum(Math.round(start + (end - start) * progress));
      if (frame < totalFrames) {
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [score]);

  const titleCaseLabel =
    label.length > 1
      ? label.charAt(0).toUpperCase() + label.slice(1).toLowerCase()
      : label;

  return (
    <div
      className="relative inline-flex items-center justify-center select-none"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${titleCaseLabel}: ${score !== null ? `${score}${unit}` : 'Nicht genügend Daten'}${sublabel ? `, ${sublabel}` : ''}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-black/[0.06] dark:text-white/[0.10]"
        />
        {score !== null && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={accentColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ type: 'spring', stiffness: 75, damping: 18 }}
          />
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
        <span className="text-xs font-medium text-[var(--text-secondary)]">
          {titleCaseLabel}
        </span>
        <span className="mt-1 text-[42px] font-semibold tracking-tight tabular-nums leading-none text-[var(--text-primary)]">
          {score !== null ? (
            <>
              {displayNum}
              <span className="text-lg font-medium text-[var(--text-secondary)] ml-0.5">{unit}</span>
            </>
          ) : (
            '—'
          )}
        </span>
        {sublabel && (
          <span className="mt-1.5 text-xs font-medium text-[var(--text-muted)] max-w-[132px] truncate">
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
};
