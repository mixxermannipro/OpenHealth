import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Minus, Plus } from 'lucide-react';
import { haptics } from '../../utils/haptics';
import { formatNumberDE } from '../../utils/formatters';

interface LiquidSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  decimals?: number;
  accentColor?: string;
  subtitle?: string;
  valuePrefix?: string;
  minLabel?: string;
  midLabel?: string;
  maxLabel?: string;
  onChange: (next: number) => void;
}

export const LiquidSlider: React.FC<LiquidSliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  decimals = 0,
  accentColor = 'var(--accent-calories)',
  subtitle,
  valuePrefix = '',
  minLabel,
  midLabel,
  maxLabel,
  onChange,
}) => {
  const [dragging, setDragging] = useState(false);
  const lastHapticValRef = useRef<number>(value);

  const clamped = Math.max(min, Math.min(max, value));
  const pct = max > min ? ((clamped - min) / (max - min)) * 100 : 0;

  const roundToStep = (v: number) => {
    const safe = Math.max(min, Math.min(max, v));
    const factor = decimals > 0 ? Math.pow(10, decimals) : 1;
    return Math.round(safe * factor) / factor;
  };

  const commit = (raw: number) => {
    const next = roundToStep(raw);
    if (next !== lastHapticValRef.current) {
      haptics.tick();
      lastHapticValRef.current = next;
    }
    onChange(next);
  };

  const formattedValue = formatNumberDE(clamped, decimals);
  const defaultMid = roundToStep((min + max) / 2);

  return (
    <div className="apple-card p-4 sm:p-5 space-y-3.5 select-none" data-no-tab-swipe="true">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[var(--text-secondary)]">{label}</p>
          {subtitle && (
            <p className="mt-0.5 text-[11.5px] text-[var(--text-muted)] leading-snug">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-baseline gap-1.5 shrink-0">
          <span className="serif-metric text-[36px] sm:text-[40px] font-medium leading-none tabular-nums text-[var(--text-primary)]">
            {valuePrefix}
            {formattedValue}
          </span>
          <span className="text-[13.5px] font-medium text-[var(--text-secondary)]">{unit}</span>
        </div>
      </div>

      {/* Tactile Track + Fine Stepper Controls */}
      <div className="flex items-center gap-2.5">
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          aria-label={`${label} −${step} ${unit}`}
          onClick={() => commit(clamped - step)}
          disabled={clamped <= min}
          className="w-9 h-9 rounded-full bg-[var(--bg-well)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-35 shrink-0 transition-colors"
        >
          <Minus className="w-3.5 h-3.5" />
        </motion.button>

        <div className="relative flex-1 h-11 flex items-center">
          {/* Background glass track */}
          <div className="w-full h-[7px] rounded-full bg-[var(--bg-well)] border border-[var(--border-hairline)] overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-75"
              style={{
                width: `${pct}%`,
                background: `linear-gradient(90deg, color-mix(in srgb, ${accentColor} 65%, transparent), ${accentColor})`,
              }}
            />
          </div>

          {/* Subtle center notch */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-[2px] h-2.5 rounded-full bg-[var(--text-muted)]/30"
          />

          {/* Liquid Glass Thumb */}
          <motion.div
            aria-hidden="true"
            animate={{
              scale: dragging ? 1.18 : 1,
            }}
            transition={{ type: 'spring', stiffness: 460, damping: 28 }}
            style={{
              left: `${pct}%`,
              boxShadow: dragging
                ? `0 0 0 6px color-mix(in srgb, ${accentColor} 22%, transparent), 0 4px 14px rgba(0,0,0,0.45)`
                : '0 3px 10px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.85)',
            }}
            className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white border border-black/15 flex items-center justify-center"
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
          </motion.div>

          {/* Accessible Native Range Input Overlay (44px vertical touch target) */}
          <input
            type="range"
            aria-label={label}
            min={min}
            max={max}
            step={step}
            value={clamped}
            onPointerDown={() => setDragging(true)}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
            onBlur={() => setDragging(false)}
            onChange={(e) => commit(Number(e.target.value))}
            className="liquid-range-input absolute inset-0 w-full h-full opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)]/40 rounded-full"
          />
        </div>

        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          aria-label={`${label} +${step} ${unit}`}
          onClick={() => commit(clamped + step)}
          disabled={clamped >= max}
          className="w-9 h-9 rounded-full bg-[var(--bg-well)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-35 shrink-0 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </motion.button>
      </div>

      {/* Quiet numeric scale markers */}
      <div className="flex items-center justify-between px-11 text-[10.5px] tabular-nums text-[var(--text-muted)]">
        <span>{minLabel ?? `${formatNumberDE(min, decimals)} ${unit}`}</span>
        <span>{midLabel ?? `${formatNumberDE(defaultMid, decimals)} ${unit}`}</span>
        <span>{maxLabel ?? `${formatNumberDE(max, decimals)} ${unit}`}</span>
      </div>
    </div>
  );
};
