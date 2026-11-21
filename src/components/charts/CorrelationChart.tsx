import React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface CorrelationPoint {
  label: string;
  primary: number | null;
  secondary: number | null;
}

interface CorrelationChartProps {
  data: CorrelationPoint[];
  primaryLabel: string;
  primaryUnit: string;
  primaryColor: string;
  secondaryLabel: string;
  secondaryUnit: string;
  secondaryColor: string;
}

export const CorrelationChart: React.FC<CorrelationChartProps> = ({
  data,
  primaryLabel,
  primaryUnit,
  primaryColor,
  secondaryLabel,
  secondaryUnit,
  secondaryColor,
}) => {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-secondary)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: primaryColor }} />
          {primaryLabel} ({primaryUnit})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: secondaryColor }} />
          {secondaryLabel} ({secondaryUnit})
        </span>
      </div>

      <div style={{ width: '100%', height: 220 }} className="select-none">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-[0.06]" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
              minTickGap={20}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: primaryColor }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: secondaryColor }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const pt = payload[0].payload as CorrelationPoint;
                return (
                  <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] px-3 py-2 shadow-lg text-xs space-y-1">
                    <div className="text-[var(--text-secondary)]">{pt.label}</div>
                    <div className="font-mono tabular-nums" style={{ color: primaryColor }}>
                      {primaryLabel}: {pt.primary ?? '—'} {primaryUnit}
                    </div>
                    <div className="font-mono tabular-nums" style={{ color: secondaryColor }}>
                      {secondaryLabel}: {pt.secondary ?? '—'} {secondaryUnit}
                    </div>
                  </div>
                );
              }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="primary"
              stroke={primaryColor}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="secondary"
              stroke={secondaryColor}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
