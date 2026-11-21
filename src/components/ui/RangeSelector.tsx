import React from 'react';
import { TimeRange } from '../../types/health';

interface RangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  options?: TimeRange[];
}

const LABELS: Record<TimeRange, string> = {
  '7d': '7T',
  '30d': '30T',
  '90d': '90T',
  '6m': '6M',
};

export const RangeSelector: React.FC<RangeSelectorProps> = ({
  value,
  onChange,
  options = ['7d', '30d', '90d', '6m'],
}) => {
  return (
    <div
      className="inline-flex items-center gap-0.5 p-1 rounded-full bg-[var(--bg-well)]"
      role="group"
      aria-label="Zeitraum wählen"
    >
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            aria-pressed={active}
            className={`min-h-[32px] px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-all ${
              active
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {LABELS[opt]}
          </button>
        );
      })}
    </div>
  );
};
