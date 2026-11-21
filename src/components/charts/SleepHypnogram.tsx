import React, { useState } from 'react';
import { SleepSession, SleepStageSegment } from '../../types/health';
import { formatClockFromIso, formatDurationMinutes } from '../../utils/formatters';

interface SleepHypnogramProps {
  session: SleepSession;
}

const STAGE_META: Record<
  SleepStageSegment['stage'],
  { label: string; row: number; color: string }
> = {
  awake: { label: 'Wach', row: 0, color: '#F59E0B' },
  rem: { label: 'Traumschlaf', row: 1, color: '#60A5FA' },
  light: { label: 'Leichtschlaf', row: 2, color: '#3B82F6' },
  deep: { label: 'Tiefschlaf', row: 3, color: '#1D4ED8' },
};

export const SleepHypnogram: React.FC<SleepHypnogramProps> = ({ session }) => {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (!session.hasStageData || session.stages.length === 0) {
    return (
      <div className="rounded-2xl bg-[var(--bg-well)] p-4 text-xs text-[var(--text-secondary)]">
        <p className="font-medium text-[var(--text-primary)]">
          Nur Schlafdauer und Timing verfügbar
        </p>
        <p className="mt-1">
          Für diese Nacht ({formatClockFromIso(session.bedtimeIso)} –{' '}
          {formatClockFromIso(session.wakeTimeIso)}) liegen keine verlässlichen Schlafphasen vor.
          Gesamtschlaf: {formatDurationMinutes(session.totalSleepMinutes)}.
        </p>
      </div>
    );
  }

  const totalMinutes = Math.max(
    1,
    session.stages.reduce((acc, s) => Math.max(acc, s.startOffsetMinutes + s.durationMinutes), 0)
  );
  const bedMs = new Date(session.bedtimeIso).getTime();
  const activeStage = selectedIdx !== null ? session.stages[selectedIdx] : null;

  const formatOffsetClock = (offsetMin: number) => {
    const dt = new Date(bedMs + offsetMin * 60000);
    return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(dt);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {(['awake', 'rem', 'light', 'deep'] as const).map((key) => (
            <span key={key} className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: STAGE_META[key].color }}
                aria-hidden="true"
              />
              {STAGE_META[key].label}
            </span>
          ))}
        </div>

        <span className="font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">
          {activeStage
            ? `${STAGE_META[activeStage.stage].label} · ${formatOffsetClock(
                activeStage.startOffsetMinutes
              )}–${formatOffsetClock(activeStage.startOffsetMinutes + activeStage.durationMinutes)} (${
                activeStage.durationMinutes
              } Min.)`
            : 'Phase antippen für Details'}
        </span>
      </div>

      <div className="relative rounded-2xl bg-[var(--bg-well)] p-3.5">
        <div className="grid grid-cols-[52px_1fr] gap-2 items-center">
          <div className="space-y-2.5 text-[11px] text-[var(--text-secondary)] select-none">
            <div className="h-6 flex items-center">Wach</div>
            <div className="h-6 flex items-center">Traum</div>
            <div className="h-6 flex items-center">Leicht</div>
            <div className="h-6 flex items-center">Tief</div>
          </div>

          <div className="relative h-[126px] w-full">
            {[0, 1, 2, 3].map((rowIdx) => (
              <div
                key={rowIdx}
                className="absolute left-0 right-0 border-b border-black/[0.04] dark:border-white/[0.05]"
                style={{ top: rowIdx * 34 + 14 }}
              />
            ))}

            {session.stages.map((seg, idx) => {
              const meta = STAGE_META[seg.stage];
              const leftPct = (seg.startOffsetMinutes / totalMinutes) * 100;
              const widthPct = Math.max(0.8, (seg.durationMinutes / totalMinutes) * 100);
              const isSelected = selectedIdx === idx;

              return (
                <button
                  key={`${seg.stage}_${idx}`}
                  type="button"
                  onClick={() => setSelectedIdx(isSelected ? null : idx)}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  aria-label={`${meta.label} von ${formatOffsetClock(
                    seg.startOffsetMinutes
                  )} für ${seg.durationMinutes} Minuten`}
                  className={`absolute h-6 rounded-sm transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)] ${
                    selectedIdx !== null && !isSelected ? 'opacity-50' : 'opacity-95'
                  }`}
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    top: meta.row * 34 + 2,
                    backgroundColor: meta.color,
                  }}
                />
              );
            })}
          </div>
        </div>

        <div className="mt-2 pl-[60px] flex items-center justify-between text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
          <span>{formatClockFromIso(session.bedtimeIso)}</span>
          <span>{formatOffsetClock(Math.round(totalMinutes * 0.5))}</span>
          <span>{formatClockFromIso(session.wakeTimeIso)}</span>
        </div>
      </div>
    </div>
  );
};
