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
import { WorkoutTimeSeriesPoint } from '../../types/health';
import { formatPace } from '../../utils/formatters';

interface WorkoutPaceHRChartProps {
  points: WorkoutTimeSeriesPoint[];
}

export const WorkoutPaceHRChart: React.FC<WorkoutPaceHRChartProps> = ({ points }) => {
  const hasPace = points.some((p) => p.paceSecPerKm !== undefined);

  return (
    <div style={{ width: '100%', height: 220 }} className="select-none">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-[0.06]" vertical={false} />
          <XAxis
            dataKey="minuteOffset"
            tickFormatter={(v) => `${v}m`}
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="hr"
            domain={['dataMin - 8', 'dataMax + 6']}
            tick={{ fontSize: 11, fill: 'var(--accent-strain)' }}
            axisLine={false}
            tickLine={false}
          />
          {hasPace && (
            <YAxis
              yAxisId="pace"
              orientation="right"
              reversed
              domain={['dataMin - 15', 'dataMax + 15']}
              tickFormatter={(v) => {
                const m = Math.floor(v / 60);
                const s = Math.round(v % 60);
                return `${m}:${String(s).padStart(2, '0')}`;
              }}
              tick={{ fontSize: 11, fill: 'var(--accent-sleep)' }}
              axisLine={false}
              tickLine={false}
            />
          )}
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const pt = payload[0].payload as WorkoutTimeSeriesPoint;
              return (
                <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] px-3 py-2 shadow-lg text-xs space-y-0.5">
                  <div className="text-[var(--text-secondary)]">Minute {pt.minuteOffset}</div>
                  <div className="font-mono tabular-nums text-[var(--accent-strain)] font-semibold">
                    Puls: {pt.hrBpm} /min
                  </div>
                  {pt.paceSecPerKm && (
                    <div className="font-mono tabular-nums text-[var(--accent-sleep)] font-semibold">
                      Tempo: {formatPace(pt.paceSecPerKm)}
                    </div>
                  )}
                </div>
              );
            }}
          />
          <Line
            yAxisId="hr"
            type="monotone"
            dataKey="hrBpm"
            stroke="var(--accent-strain)"
            strokeWidth={2}
            dot={false}
          />
          {hasPace && (
            <Line
              yAxisId="pace"
              type="monotone"
              dataKey="paceSecPerKm"
              stroke="var(--accent-sleep)"
              strokeWidth={2}
              dot={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
