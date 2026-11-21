import React from 'react';
import { HRZoneConfig } from '../../types/health';

interface HRZonesChartProps {
  zones: HRZoneConfig[];
  zoneMinutes: [number, number, number, number, number];
}

const ZONE_COLORS = ['#94A3B8', '#3B82F6', '#10B981', '#F59E0B', '#E11D48'];

export const HRZonesChart: React.FC<HRZonesChartProps> = ({ zones, zoneMinutes }) => {
  const total = zoneMinutes.reduce((acc, m) => acc + m, 0);

  return (
    <div className="space-y-2.5">
      {zones.map((z, idx) => {
        const mins = zoneMinutes[idx] || 0;
        const pct = total > 0 ? Math.round((mins / total) * 100) : 0;
        return (
          <div key={z.zone} className="space-y-1">
            <div className="flex items-center justify-between text-xs gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: ZONE_COLORS[idx] }}
                  aria-hidden="true"
                />
                <span className="font-medium text-[var(--text-primary)] truncate">{z.name}</span>
                <span className="font-mono text-[11px] text-[var(--text-muted)] tabular-nums shrink-0">
                  {z.minBpm}–{z.maxBpm} /min
                </span>
              </div>
              <div className="font-mono tabular-nums text-[var(--text-secondary)] shrink-0">
                {mins} Min. · {pct} %
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-[var(--bg-well)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.max(pct, mins > 0 ? 3 : 0)}%`,
                  backgroundColor: ZONE_COLORS[idx],
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
