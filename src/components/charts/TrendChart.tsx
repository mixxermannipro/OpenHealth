import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface TrendPoint {
  date: string;
  label: string;
  value: number | null;
  secondaryValue?: number | null;
}

interface TrendChartProps {
  data: TrendPoint[];
  unit: string;
  color: string;
  baselineValue?: number | null;
  baselineLabel?: string;
  type?: 'area' | 'bar';
  height?: number;
  yDomain?: [number | 'auto', number | 'auto'];
  valueName?: string;
}

export const TrendChart: React.FC<TrendChartProps> = ({
  data,
  unit,
  color,
  baselineValue,
  baselineLabel,
  type = 'area',
  height = 220,
  yDomain = ['auto', 'auto'],
  valueName = 'Wert',
}) => {
  const gradId = `grad_${valueName.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div style={{ width: '100%', height }} className="select-none">
      <ResponsiveContainer width="100%" height="100%">
        {type === 'bar' ? (
          <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-[0.06]" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
              minTickGap={22}
            />
            <YAxis
              domain={yDomain}
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: 'rgba(128,128,128,0.08)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const pt = payload[0].payload as TrendPoint;
                return (
                  <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] px-3 py-2 shadow-lg text-xs">
                    <div className="text-[var(--text-secondary)]">{pt.label}</div>
                    <div className="mt-0.5 font-mono font-semibold tabular-nums text-[var(--text-primary)]">
                      {pt.value !== null ? `${pt.value} ${unit}` : 'Keine Daten'}
                    </div>
                  </div>
                );
              }}
            />
            {baselineValue !== null && baselineValue !== undefined && (
              <ReferenceLine
                y={baselineValue}
                stroke="var(--text-muted)"
                strokeDasharray="4 4"
                label={{
                  value: baselineLabel || `Basis ${baselineValue}`,
                  position: 'insideTopRight',
                  fill: 'var(--text-muted)',
                  fontSize: 10,
                }}
              />
            )}
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        ) : (
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.28} />
                <stop offset="95%" stopColor={color} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-[0.06]" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
              minTickGap={22}
            />
            <YAxis
              domain={yDomain}
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const pt = payload[0].payload as TrendPoint;
                return (
                  <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] px-3 py-2 shadow-lg text-xs">
                    <div className="text-[var(--text-secondary)]">{pt.label}</div>
                    <div className="mt-0.5 font-mono font-semibold tabular-nums text-[var(--text-primary)]">
                      {pt.value !== null ? `${pt.value} ${unit}` : 'Keine Daten'}
                    </div>
                  </div>
                );
              }}
            />
            {baselineValue !== null && baselineValue !== undefined && (
              <ReferenceLine
                y={baselineValue}
                stroke="var(--text-muted)"
                strokeDasharray="4 4"
              />
            )}
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradId})`}
              connectNulls
              activeDot={{ r: 4, strokeWidth: 0, fill: color }}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};
