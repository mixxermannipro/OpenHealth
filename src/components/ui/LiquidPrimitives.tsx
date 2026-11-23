import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wind, X, Play, Pause, RotateCcw } from 'lucide-react';
import { SleepSession, SleepStageSegment } from '../../types/health';
import { formatClockFromIso } from '../../utils/formatters';
import { triggerHaptic } from '../../utils/haptics';
import { useI18n } from '../../i18n/useI18n';
import { getActiveBcp47 } from '../../i18n/translations';

/**
 * Circular Mini Progress Ring used inside Home Bento Cards & Erholung Hero
 */
export const CircularProgressRing: React.FC<{
  percent: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  trackClass?: string;
  children?: React.ReactNode;
}> = ({
  percent,
  size = 64,
  strokeWidth = 6,
  color,
  trackClass = 'text-black/[0.08] dark:text-white/[0.11]',
  children,
}) => {
  const clamped = Math.max(0, Math.min(100, percent));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className={trackClass}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ type: 'spring', stiffness: 75, damping: 18 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
};

/**
 * Coral Semi-Circular 0–21 Strain Arc Gauge matching IMG-20261121-WA0012
 */
export const StrainArcGauge: React.FC<{
  value: number; // 0 .. 21
  max?: number;
  label: string;
}> = ({ value, max = 21, label }) => {
  const width = 264;
  const height = 154;
  const cx = width / 2;
  const cy = 132;
  const r = 104;
  const strokeWidth = 13;

  // Sweep from 195 deg to -15 deg (210 deg total open arch matching screenshot)
  const startAngle = (195 * Math.PI) / 180;
  const endAngle = (-15 * Math.PI) / 180;
  const totalSweep = startAngle - endAngle; // positive radians

  const polar = (angle: number) => ({
    x: cx + r * Math.cos(angle),
    y: cy - r * Math.sin(angle),
  });

  const start = polar(startAngle);
  const end = polar(endAngle);
  const arcPath = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} A ${r} ${r} 0 1 1 ${end.x.toFixed(
    1
  )} ${end.y.toFixed(1)}`;

  const arcLen = r * totalSweep;
  const ratio = Math.max(0, Math.min(1, value / max));
  const dashOffset = arcLen * (1 - ratio);

  return (
    <div className="relative flex flex-col items-center justify-center select-none py-1">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        <defs>
          <linearGradient id="strainArcGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FB7B6B" />
            <stop offset="100%" stopColor="#F99B89" />
          </linearGradient>
        </defs>
        <path
          d={arcPath}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="text-black/[0.08] dark:text-[#2D2221]"
        />
        <motion.path
          d={arcPath}
          fill="none"
          stroke="url(#strainArcGrad)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={arcLen}
          initial={{ strokeDashoffset: arcLen }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ type: 'spring', stiffness: 68, damping: 18 }}
        />
      </svg>

      <div className="absolute top-[52px] inset-x-0 flex flex-col items-center">
        <span className="serif-metric text-[54px] font-medium leading-none text-[var(--text-primary)]">
          {value.toFixed(1)}
        </span>
        <span className="mt-2 text-sm font-medium text-[var(--accent-strain)]">{label}</span>
      </div>

      <div className="w-[216px] mt-1 flex items-center justify-between text-xs font-medium tabular-nums text-[var(--text-muted)]">
        <span>0</span>
        <span>{max}</span>
      </div>
    </div>
  );
};

/**
 * Smooth SVG Area Sparkline for Home Schlaf (Lavender) & HRV (Sky Blue) Bento Tiles
 */
export const MiniAreaSparkline: React.FC<{
  values: number[];
  color: string;
  leftLabel?: string;
  rightLabel?: string;
  height?: number;
}> = ({ values, color, leftLabel, rightLabel, height = 38 }) => {
  const safeVals = values.length >= 2 ? values : [50, 56, 52, 62, 58, 68, 64];
  const min = Math.min(...safeVals);
  const max = Math.max(...safeVals);
  const span = Math.max(1, max - min);
  const w = 160;
  const h = height;
  const padY = 4;

  const pts = safeVals.map((v, i) => {
    const x = (i / (safeVals.length - 1)) * w;
    const y = h - padY - ((v - min) / span) * (h - padY * 2);
    return { x, y };
  });

  let lineD = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cx = ((prev.x + curr.x) / 2).toFixed(1);
    lineD += ` C ${cx} ${prev.y.toFixed(1)}, ${cx} ${curr.y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
  }
  const areaD = `${lineD} L ${w} ${h} L 0 ${h} Z`;
  const gradId = `sp_${color.replace(/[^a-zA-Z0-9]/g, '')}_${values.length}`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full overflow-visible" style={{ height }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gradId})`} />
        <motion.path
          d={lineD}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0.4 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      {(leftLabel || rightLabel) && (
        <div className="mt-1 flex items-center justify-between text-[11px] tabular-nums text-[var(--text-muted)]">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}
    </div>
  );
};

/**
 * Step-Connected Apple/Whoop Sleep Hypnogram matching IMG-20261121-WA0014
 */
const STAGE_SPEC: Record<
  SleepStageSegment['stage'],
  { label: string; short: string; row: number; color: string }
> = {
  awake: { label: 'Wach', short: 'Wach', row: 0, color: '#FF9472' },
  rem: { label: 'REM', short: 'REM', row: 1, color: '#A78BFA' },
  light: { label: 'Leicht', short: 'Leicht', row: 2, color: '#617BA6' },
  deep: { label: 'Tiefschlaf', short: 'Tiefschlaf', row: 3, color: '#6273FF' },
};

export const StepHypnogram: React.FC<{ session: SleepSession }> = ({ session }) => {
  const { t, locale } = useI18n();
  const [activePhase, setActivePhase] = useState<SleepStageSegment['stage'] | null>(null);
  const [selectedSegIdx, setSelectedSegIdx] = useState<number | null>(null);

  const stageLabel = (stage: SleepStageSegment['stage']) => t.sleep.stages[stage];

  if (!session.hasStageData || session.stages.length === 0) {
    return (
      <div className="rounded-2xl bg-[var(--bg-well)] p-4 text-xs text-[var(--text-secondary)]">
        {t.sleep.noData}
      </div>
    );
  }

  const totalMin = Math.max(
    1,
    session.stages.reduce((acc, s) => Math.max(acc, s.startOffsetMinutes + s.durationMinutes), 0)
  );
  const bedMs = new Date(session.bedtimeIso).getTime();
  const formatOffset = (min: number) =>
    new Intl.DateTimeFormat(getActiveBcp47(locale), { hour: '2-digit', minute: '2-digit' }).format(
      new Date(bedMs + min * 60000)
    );

  const rowY = [14, 46, 78, 110];
  const barH = 18;
  const chartW = 320;
  const chartH = 136;

  const selectedSeg = selectedSegIdx !== null ? session.stages[selectedSegIdx] : null;

  const stageTotals: Record<SleepStageSegment['stage'], number> = {
    deep: session.deepMinutes ?? 0,
    rem: session.remMinutes ?? 0,
    light: session.lightMinutes ?? 0,
    awake: session.awakeMinutes ?? 0,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[64px_1fr] gap-2 items-stretch">
        <div className="relative h-[136px] text-[11px] text-[var(--text-muted)] select-none">
          <span className="absolute top-[6px] left-0">{stageLabel('awake')}</span>
          <span className="absolute top-[38px] left-0">{stageLabel('rem')}</span>
          <span className="absolute top-[70px] left-0">{stageLabel('light')}</span>
          <span className="absolute top-[102px] left-0">{stageLabel('deep')}</span>
        </div>

        <div className="relative">
          <svg
            viewBox={`0 0 ${chartW} ${chartH}`}
            preserveAspectRatio="none"
            className="w-full h-[136px] overflow-visible"
            role="img"
            aria-label="Schlafphasen-Hypnogramm"
          >
            {/* Vertical dashed grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <line
                key={f}
                x1={f * chartW}
                x2={f * chartW}
                y1={2}
                y2={chartH - 2}
                stroke="currentColor"
                strokeDasharray="3 3"
                className="text-black/[0.08] dark:text-white/[0.08]"
              />
            ))}
            <line
              x1={0}
              x2={chartW}
              y1={chartH - 2}
              y2={chartH - 2}
              stroke="currentColor"
              className="text-black/[0.10] dark:text-white/[0.10]"
            />

            {/* Connecting vertical step lines between consecutive segments */}
            {session.stages.map((seg, i) => {
              if (i === 0) return null;
              const prev = session.stages[i - 1];
              const x = (seg.startOffsetMinutes / totalMin) * chartW;
              const y1 = rowY[STAGE_SPEC[prev.stage].row];
              const y2 = rowY[STAGE_SPEC[seg.stage].row];
              return (
                <line
                  key={`conn_${i}`}
                  x1={x}
                  x2={x}
                  y1={y1}
                  y2={y2}
                  stroke={STAGE_SPEC[seg.stage].color}
                  strokeOpacity={activePhase && activePhase !== seg.stage ? 0.15 : 0.45}
                  strokeWidth={1.2}
                />
              );
            })}

            {/* Phase bars */}
            {session.stages.map((seg, idx) => {
              const spec = STAGE_SPEC[seg.stage];
              const x = (seg.startOffsetMinutes / totalMin) * chartW;
              const w = Math.max(3, (seg.durationMinutes / totalMin) * chartW);
              const y = rowY[spec.row] - barH / 2;
              const dimmed =
                (activePhase !== null && activePhase !== seg.stage) ||
                (selectedSegIdx !== null && selectedSegIdx !== idx);

              return (
                <motion.rect
                  key={`seg_${idx}`}
                  x={x}
                  y={y}
                  width={w}
                  height={barH}
                  rx={3.5}
                  fill={spec.color}
                  initial={{ opacity: 0, scaleY: 0.4 }}
                  animate={{ opacity: dimmed ? 0.25 : 0.96, scaleY: 1 }}
                  transition={{
                    duration: 0.34,
                    delay: Math.min(idx * 0.014, 0.22),
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  style={{ transformOrigin: `${x + w / 2}px ${y + barH / 2}px` }}
                  className="cursor-pointer"
                  onClick={() => {
                    triggerHaptic('tick');
                    setSelectedSegIdx(selectedSegIdx === idx ? null : idx);
                  }}
                />
              );
            })}
          </svg>

          <div className="mt-2 flex items-center justify-between text-xs tabular-nums text-[var(--text-muted)]">
            <span>{formatClockFromIso(session.bedtimeIso)}</span>
            {selectedSeg ? (
              <span className="text-[var(--text-primary)] font-medium">
                {stageLabel(selectedSeg.stage)} · {formatOffset(selectedSeg.startOffsetMinutes)}–
                {formatOffset(selectedSeg.startOffsetMinutes + selectedSeg.durationMinutes)} ({selectedSeg.durationMinutes} {t.common.unitMin})
              </span>
            ) : activePhase ? (
              <span className="text-[var(--text-primary)] font-medium">
                {stageLabel(activePhase)}: {Math.floor(stageTotals[activePhase] / 60)} h {stageTotals[activePhase] % 60} {t.common.unitMin}
              </span>
            ) : null}
            <span>{formatClockFromIso(session.wakeTimeIso)}</span>
          </div>
        </div>
      </div>

      {/* Interactive phase filter buttons matching screenshot bottom row */}
      <div className="flex flex-nowrap items-center justify-between gap-1.5">
        {(['deep', 'rem', 'light', 'awake'] as const).map((phase) => {
          const spec = STAGE_SPEC[phase];
          const isSelected = activePhase === phase;
          return (
            <motion.button
              key={phase}
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                triggerHaptic('selection');
                setSelectedSegIdx(null);
                setActivePhase(isSelected ? null : phase);
              }}
              className={`min-h-[32px] flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-black/10 dark:bg-white/[0.14] text-[var(--text-primary)] ring-1 ring-black/10 dark:ring-white/20'
                  : 'bg-[var(--bg-well)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: spec.color }}
                aria-hidden="true"
              />
              <span>{stageLabel(phase)}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Authentic Apple iOS Green Spring Toggle Switch
 */
export const IOSSwitch: React.FC<{
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}> = ({ checked, onChange, ariaLabel }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    onClick={() => {
      triggerHaptic('light');
      onChange(!checked);
    }}
    className={`relative inline-flex h-[31px] w-[51px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-recovery)] ${
      checked ? 'bg-[#34C759]' : 'bg-black/15 dark:bg-white/20'
    }`}
  >
    <motion.span
      layout
      transition={{ type: 'spring', stiffness: 520, damping: 32 }}
      className={`inline-block h-[27px] w-[27px] rounded-full bg-white shadow-md ${
        checked ? 'translate-x-[22px]' : 'translate-x-[2px]'
      }`}
    />
  </button>
);

/**
 * Interactive HRV Resonance Breathing Modal (5.5s In / 5.5s Out or 4-7-8)
 */
export const BreathworkModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [mode, setMode] = useState<'resonance' | '478'>('resonance');
  const [running, setRunning] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!open) {
      setRunning(false);
      setElapsedSec(0);
    }
  }, [open]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setElapsedSec((s) => s + 0.1), 100);
    return () => window.clearInterval(id);
  }, [running]);

  const cycleLen = mode === 'resonance' ? 11 : 19;
  const pos = elapsedSec % cycleLen;

  let phaseLabel = 'Bereit';
  let scale = 0.72;
  if (running) {
    if (mode === 'resonance') {
      if (pos < 5.5) {
        phaseLabel = 'Ruhig einatmen';
        scale = 0.72 + (pos / 5.5) * 0.42;
      } else {
        phaseLabel = 'Langsam ausatmen';
        scale = 1.14 - ((pos - 5.5) / 5.5) * 0.42;
      }
    } else {
      if (pos < 4) {
        phaseLabel = 'Einatmen (4 s)';
        scale = 0.72 + (pos / 4) * 0.42;
      } else if (pos < 11) {
        phaseLabel = 'Halten (7 s)';
        scale = 1.14;
      } else {
        phaseLabel = 'Ausatmen (8 s)';
        scale = 1.14 - ((pos - 11) / 8) * 0.42;
      }
    }
  }

  const lastPhaseRef = useRef<string>('Bereit');
  useEffect(() => {
    if (running && phaseLabel !== lastPhaseRef.current) {
      triggerHaptic('tick');
    }
    lastPhaseRef.current = phaseLabel;
  }, [phaseLabel, running]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="HRV-Atemübung"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-md"
          />
          <motion.div
            initial={{ y: 44, opacity: 0, scale: 0.985 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 44, opacity: 0, scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 370, damping: 33 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 480) {
                triggerHaptic('tick');
                onClose();
              }
            }}
            className="relative z-10 w-full sm:max-w-md rounded-t-[28px] sm:rounded-[28px] bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-6 pb-8 space-y-6"
          >
            <div className="sm:hidden flex justify-center -mt-3 pb-1 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1 rounded-full bg-black/15 dark:bg-white/25" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-full bg-[var(--accent-recovery)]/15 text-[var(--accent-recovery)] flex items-center justify-center">
                  <Wind className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">HRV-Atemübung</h2>
                  <p className="text-xs text-[var(--text-secondary)]">Vagusnerv aktiv beruhigen</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Schließen"
                className="min-h-[38px] min-w-[38px] rounded-full bg-[var(--bg-well)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1 p-1 rounded-full bg-[var(--bg-well)]">
              <button
                type="button"
                onClick={() => {
                  setMode('resonance');
                  setElapsedSec(0);
                }}
                className={`min-h-[36px] rounded-full text-xs font-medium transition-colors ${
                  mode === 'resonance'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                5,5 s Resonanz (HRV)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('478');
                  setElapsedSec(0);
                }}
                className={`min-h-[36px] rounded-full text-xs font-medium transition-colors ${
                  mode === '478'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                4-7-8 Einschlafen
              </button>
            </div>

            <div className="flex flex-col items-center justify-center py-6">
              <div className="relative w-44 h-44 flex items-center justify-center">
                <motion.div
                  animate={{ scale }}
                  transition={{ duration: 0.15, ease: 'linear' }}
                  className="absolute inset-4 rounded-full bg-[var(--accent-recovery)]/20 border border-[var(--accent-recovery)]/40"
                />
                <motion.div
                  animate={{ scale: scale * 0.8 }}
                  transition={{ duration: 0.15, ease: 'linear' }}
                  className="w-28 h-28 rounded-full bg-[var(--accent-recovery)]/25 backdrop-blur-xl flex flex-col items-center justify-center text-center px-3"
                >
                  <span className="serif-metric text-xl text-[var(--text-primary)]">
                    {Math.floor(elapsedSec / 60)}:{String(Math.floor(elapsedSec % 60)).padStart(2, '0')}
                  </span>
                </motion.div>
              </div>
              <p className="mt-4 text-base font-semibold text-[var(--text-primary)]">{phaseLabel}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)] text-center max-w-xs">
                {mode === 'resonance'
                  ? '5,5 Sekunden durch die Nase einatmen, 5,5 Sekunden sanft ausatmen (0,1 Hz Resonanz).'
                  : '4 Sekunden einatmen, 7 Sekunden halten, 8 Sekunden ruhig ausatmen.'}
              </p>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setRunning((r) => !r)}
                className="min-h-[46px] flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--text-primary)] text-[var(--bg-canvas)] font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {running ? 'Pausieren' : 'Übung starten'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRunning(false);
                  setElapsedSec(0);
                }}
                aria-label="Zurücksetzen"
                className="min-h-[46px] min-w-[46px] rounded-full bg-[var(--bg-well)] text-[var(--text-primary)] flex items-center justify-center hover:bg-[var(--bg-elevated)]"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
