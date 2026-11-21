import React from 'react';
import { ChevronRight } from 'lucide-react';
import { InfoButton } from './InfoButton';

interface MetricCardProps {
  title: string;
  value: string;
  unit?: string;
  subtitle: string;
  meta?: string;
  sparkline?: number[];
  accentColor?: string;
  onClick?: () => void;
  onInfo?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  subtitle,
  meta,
  sparkline,
  accentColor = 'var(--accent-recovery)',
  onClick,
  onInfo,
}) => {
  const renderSparkline = () => {
    if (!sparkline || sparkline.length < 2) return null;
    const min = Math.min(...sparkline);
    const max = Math.max(...sparkline);
    const span = max - min || 1;
    const w = 56;
    const h = 22;
    const points = sparkline
      .map((val, idx) => {
        const x = (idx / (sparkline.length - 1)) * w;
        const y = h - 3 - ((val - min) / span) * (h - 6);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="shrink-0 opacity-90">
        <polyline
          fill="none"
          stroke={accentColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    );
  };

  const inner = (
    <div className="flex flex-col justify-between h-full text-left">
      <div className={`flex items-center justify-between gap-2 ${onInfo ? 'pr-8' : ''}`}>
        <span className="text-[13px] font-medium text-[var(--text-secondary)] truncate inline-flex items-center gap-1">
          <span className="truncate">{title}</span>
          {onClick && (
            <ChevronRight
              className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 transition-transform duration-150 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          )}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1">
            <span className="text-[26px] leading-none font-semibold tracking-tight tabular-nums text-[var(--text-primary)]">
              {value}
            </span>
            {unit && (
              <span className="text-xs font-medium text-[var(--text-muted)]">{unit}</span>
            )}
          </div>
          <p className="mt-2 text-xs text-[var(--text-secondary)] truncate">
            {subtitle}
            {meta ? ` · ${meta}` : ''}
          </p>
        </div>
        {renderSparkline()}
      </div>
    </div>
  );

  const baseClass =
    'group w-full rounded-[22px] bg-[var(--bg-surface)] shadow-[var(--surface-shadow)] p-4 sm:p-5 transition-transform duration-150';

  if (onClick) {
    return (
      <div className="relative min-h-[116px]">
        <button
          type="button"
          onClick={onClick}
          className={`${baseClass} h-full hover:opacity-95 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-sleep)] min-h-[116px]`}
        >
          {inner}
        </button>
        {onInfo && (
          <InfoButton
            label={title}
            onClick={onInfo}
            className="absolute top-2.5 right-2.5 z-10"
          />
        )}
      </div>
    );
  }

  return (
    <div className={`relative ${baseClass} min-h-[116px]`}>
      {inner}
      {onInfo && (
        <InfoButton
          label={title}
          onClick={onInfo}
          className="absolute top-2.5 right-2.5 z-10"
        />
      )}
    </div>
  );
};
