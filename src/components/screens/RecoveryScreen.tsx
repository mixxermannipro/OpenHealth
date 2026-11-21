import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronLeft,
  HeartPulse,
  Heart,
  Wind,
  NotebookPen,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { DailyDerivedSnapshot } from '../../types/health';
import { useHealthStore } from '../../store/useHealthStore';
import { computeHabitCorrelations } from '../../engine/calculations';
import { ExplanationTopic } from '../../i18n/de';
import { InfoButton } from '../ui/InfoButton';
import { CircularProgressRing } from '../ui/LiquidPrimitives';
import { AnimatedNumber, SNAPPY_SPRING } from '../ui/MotionPrimitives';
import { addDaysToKey, formatNumberDE } from '../../utils/formatters';
import { haptics } from '../../utils/haptics';

interface RecoveryScreenProps {
  snapshot: DailyDerivedSnapshot;
  onExplain: (topic: ExplanationTopic) => void;
  onOpenBreathwork: () => void;
  onOpenJournal: () => void;
}

type HrvWindow = 'week' | 'month' | 'year';

export const RecoveryScreen: React.FC<RecoveryScreenProps> = ({
  snapshot,
  onExplain,
  onOpenBreathwork,
  onOpenJournal,
}) => {
  const {
    selectedDate,
    hrvObservations,
    sleepSessions,
    journalEntries,
    setDetailView,
  } = useHealthStore();

  const [hrvWindow, setHrvWindow] = useState<HrvWindow>('week');

  const score = snapshot.recovery.score ?? 0;
  const readiness = snapshot.recovery.readinessCategory;
  const isOptimal = score >= 70 || readiness === 'high_intensity_ok';
  const isLow = score < 45 || readiness === 'easy_recovery' || readiness === 'rest_considered';
  const ringColor = isOptimal
    ? 'var(--accent-recovery)'
    : isLow
      ? 'var(--accent-strain)'
      : 'var(--accent-calories)';
  const statusLabel = isOptimal
    ? 'Optimal'
    : readiness === 'rest_considered'
      ? 'Schonung'
      : isLow
        ? 'Niedrig'
        : 'Moderat';

  const hrvDeltaStr =
    snapshot.recovery.hrvDeltaPct !== null
      ? `${snapshot.recovery.hrvDeltaPct >= 0 ? '+' : ''}${snapshot.recovery.hrvDeltaPct} %`
      : 'Normal';
  const rhrDeltaStr =
    snapshot.recovery.rhrDeltaBpm !== null
      ? `${snapshot.recovery.rhrDeltaBpm > 0 ? '+' : ''}${snapshot.recovery.rhrDeltaBpm} bpm`
      : 'Normal';
  const respRate = snapshot.activity?.respiratoryRateBpm ?? 13.8;

  const hrvChartData = useMemo(() => {
    const days = hrvWindow === 'week' ? 7 : hrvWindow === 'month' ? 30 : 120;
    const start = addDaysToKey(selectedDate, -(days - 1));
    const filtered = hrvObservations
      .filter((h) => h.date >= start && h.date <= selectedDate)
      .sort((a, b) => a.date.localeCompare(b.date));

    const wdFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });
    const dtFmt = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' });

    return filtered.map((obs) => {
      const dt = new Date(`${obs.date}T12:00:00`);
      return {
        date: obs.date,
        label:
          hrvWindow === 'week'
            ? wdFmt.format(dt).replace('.', '').slice(0, 2)
            : dtFmt.format(dt),
        hrv: obs.value,
      };
    });
  }, [hrvObservations, selectedDate, hrvWindow]);

  const habitImpacts = useMemo(
    () => computeHabitCorrelations(journalEntries, hrvObservations, sleepSessions),
    [journalEntries, hrvObservations, sleepSessions]
  );

  const chartTitle =
    hrvWindow === 'week'
      ? 'HRV, 7 Tage'
      : hrvWindow === 'month'
        ? 'HRV, 30 Tage'
        : 'HRV, Verlauf';

  return (
    <motion.div
      initial={{ opacity: 0, x: 14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-5"
    >
      {/* Top Bar matching IMG-20261121-WA0016 */}
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              haptics.tick();
              setDetailView('none');
            }}
            aria-label="Zurück zur Übersicht"
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--bg-well)] transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </motion.button>
          <h1 className="text-[28px] font-bold tracking-tight text-[var(--text-primary)]">
            Erholung
          </h1>
        </div>
        <InfoButton label="Erholung" onClick={() => onExplain('recovery')} />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Hero Ring + Core Biometrics Rows */}
        <div className="lg:col-span-5 space-y-5">
          <div className="flex flex-col items-center justify-center py-3">
            <CircularProgressRing
              percent={score}
              size={194}
              strokeWidth={11}
              color={ringColor}
            >
              <span className="serif-metric text-[54px] font-medium leading-none text-[var(--text-primary)]">
                {snapshot.recovery.score !== null ? (
                  <AnimatedNumber value={snapshot.recovery.score} suffix="%" />
                ) : (
                  '—'
                )}
              </span>
              <span
                className={`mt-2 inline-flex items-center rounded-full px-3.5 py-1 text-xs font-semibold ${
                  isOptimal
                    ? 'bg-[var(--accent-recovery)]/16 text-[var(--accent-recovery)]'
                    : isLow
                      ? 'bg-[var(--accent-strain)]/16 text-[var(--accent-strain)]'
                      : 'bg-[var(--accent-calories)]/16 text-[var(--accent-calories)]'
                }`}
              >
                {statusLabel}
              </span>
            </CircularProgressRing>
          </div>

          {/* 3-Row Biometrics Inset Card matching IMG-20261121-WA0016 */}
          <div className="apple-card divide-y divide-[var(--border-hairline)] overflow-hidden">
            <div className="px-4 py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-full bg-[var(--accent-hrv)]/12 flex items-center justify-center shrink-0">
                  <HeartPulse className="w-4 h-4 text-[var(--accent-hrv)]" />
                </span>
                <span className="text-[14.5px] font-medium text-[var(--text-primary)] truncate">
                  Herzfrequenzvariabilität
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <p className="text-[16px] font-semibold tabular-nums text-[var(--text-primary)] leading-tight">
                    {snapshot.recovery.hrvToday !== null ? `${snapshot.recovery.hrvToday} ms` : '—'}
                  </p>
                  <p className="text-[12px] font-medium text-[var(--accent-recovery)]">
                    {hrvDeltaStr}
                  </p>
                </div>
                <InfoButton
                  label="HRV"
                  onClick={() => onExplain('hrv')}
                  className="!min-h-[30px] !min-w-[30px]"
                />
              </div>
            </div>

            <div className="px-4 py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-full bg-[var(--accent-strain)]/12 flex items-center justify-center shrink-0">
                  <Heart className="w-4 h-4 text-[var(--accent-strain)]" />
                </span>
                <span className="text-[14.5px] font-medium text-[var(--text-primary)] truncate">
                  Ruhepuls
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <p className="text-[16px] font-semibold tabular-nums text-[var(--text-primary)] leading-tight">
                    {snapshot.recovery.rhrToday !== null ? `${snapshot.recovery.rhrToday} bpm` : '—'}
                  </p>
                  <p className="text-[12px] font-medium text-[var(--accent-recovery)]">
                    {rhrDeltaStr}
                  </p>
                </div>
                <InfoButton
                  label="Ruhepuls"
                  onClick={() => onExplain('rhr')}
                  className="!min-h-[30px] !min-w-[30px]"
                />
              </div>
            </div>

            <div className="px-4 py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-full bg-[var(--accent-recovery)]/12 flex items-center justify-center shrink-0">
                  <Wind className="w-4 h-4 text-[var(--accent-recovery)]" />
                </span>
                <span className="text-[14.5px] font-medium text-[var(--text-primary)] truncate">
                  Atemfrequenz
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <p className="text-[16px] font-semibold tabular-nums text-[var(--text-primary)] leading-tight">
                    {formatNumberDE(respRate, 1)} /min
                  </p>
                  <p className="text-[12px] font-medium text-[var(--text-secondary)]">Normal</p>
                </div>
                <InfoButton
                  label="Atemfrequenz"
                  onClick={() => onExplain('biometrics')}
                  className="!min-h-[30px] !min-w-[30px]"
                />
              </div>
            </div>
          </div>

          {/* Quick Actions: Resonance Breathing & Journal */}
          <div className="grid grid-cols-2 gap-2.5">
            <motion.button
              type="button"
              whileTap={{ scale: 0.975 }}
              onClick={() => {
                haptics.light();
                onOpenBreathwork();
              }}
              className="apple-card p-3.5 flex items-center gap-2.5 text-left hover:border-[var(--accent-recovery)]/40 transition-colors"
            >
              <span className="w-8 h-8 rounded-full bg-[var(--accent-recovery)]/15 text-[var(--accent-recovery)] flex items-center justify-center shrink-0">
                <Wind className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                  HRV-Atmung
                </p>
                <p className="text-[11px] text-[var(--text-muted)] truncate">5,5 s Resonanz</p>
              </div>
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.975 }}
              onClick={() => {
                haptics.tick();
                onOpenJournal();
              }}
              className="apple-card p-3.5 flex items-center gap-2.5 text-left hover:border-white/20 transition-colors"
            >
              <span className="w-8 h-8 rounded-full bg-[var(--bg-well)] text-[var(--text-primary)] flex items-center justify-center shrink-0">
                <NotebookPen className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                  Gefühl heute
                </p>
                <p className="text-[11px] text-[var(--text-muted)] truncate">
                  {snapshot.journal ? 'Check-in anpassen' : 'Jetzt bewerten (18 %)'}
                </p>
              </div>
            </motion.button>
          </div>

          {/* Objective vs Subjective Alignment Card */}
          {snapshot.recovery.subjectiveAlignmentNote && (
            <div className="apple-card p-4 space-y-1.5 border-[var(--accent-calories)]/25">
              <p className="text-xs font-semibold text-[var(--accent-calories)]">
                Objektiv vs. Dein Gefühl
              </p>
              <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                {snapshot.recovery.subjectiveAlignmentNote}
              </p>
            </div>
          )}
        </div>

        {/* Right Column: HRV Area Chart + Factors + Habit Impact */}
        <div className="lg:col-span-7 space-y-4">
          {/* HRV Chart Card matching IMG-20261121-WA0016 */}
          <div className="apple-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
                  {chartTitle}
                </h2>
                <InfoButton label="HRV-Verlauf" onClick={() => onExplain('recoveryTrend')} />
              </div>

              <div className="inline-flex rounded-full bg-[var(--bg-well)] p-1">
                {(
                  [
                    { id: 'week', label: 'Woche' },
                    { id: 'month', label: 'Monat' },
                    { id: 'year', label: 'Jahr' },
                  ] as const
                ).map((tab) => {
                  const active = hrvWindow === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        if (!active) {
                          haptics.selection();
                          setHrvWindow(tab.id);
                        }
                      }}
                      className={`relative min-h-[30px] rounded-full px-3 text-xs font-medium transition-colors ${
                        active
                          ? 'text-[var(--text-primary)]'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="recoveryHrvWindow"
                          transition={SNAPPY_SPRING}
                          className="absolute inset-0 rounded-full bg-[var(--bg-elevated)] shadow-sm"
                        />
                      )}
                      <span className="relative z-10">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="h-[196px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hrvChartData} margin={{ top: 8, right: 6, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="hrvGreenFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5CE17C" stopOpacity={0.32} />
                      <stop offset="100%" stopColor="#5CE17C" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--border-hairline)"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#717580', fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#717580', fontSize: 11 }}
                    domain={['dataMin - 8', 'dataMax + 6']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-hairline)',
                      borderRadius: 14,
                      fontSize: 12,
                      color: 'var(--text-primary)',
                    }}
                    formatter={(val: unknown) => [`${val} ms`, 'HRV (RMSSD)']}
                  />
                  <Area
                    type="monotone"
                    dataKey="hrv"
                    stroke="#5CE17C"
                    strokeWidth={2.5}
                    fill="url(#hrvGreenFill)"
                    dot={false}
                    activeDot={{ r: 4.5, fill: '#5CE17C', stroke: 'var(--bg-canvas)', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Einflussfaktoren Breakdown (fixed weightUsed percentage!) */}
          <div className="apple-card p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
                Zusammensetzung heute
              </h2>
              <InfoButton label="Einflussfaktoren" onClick={() => onExplain('recoveryFactors')} />
            </div>

            <div className="space-y-3">
              {snapshot.recovery.factors.map((f) => (
                <div key={f.key} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-[var(--text-primary)]">{f.label}</span>
                    <span className="tabular-nums text-[var(--text-secondary)] text-right">
                      {f.deltaText}
                      {f.available ? ` · ${Math.round(f.weightUsed)} %` : ''}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--bg-well)] overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: f.available ? `${Math.max(4, Math.min(100, f.score ?? 0))}%` : '0%',
                      }}
                      transition={{ type: 'spring', stiffness: 170, damping: 24 }}
                      className={`h-full rounded-full ${
                        f.available ? 'bg-[var(--accent-recovery)]' : 'bg-[var(--text-muted)]/25'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Habit Impact Correlations */}
          {habitImpacts.length > 0 && (
            <div className="apple-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[var(--accent-recovery)]" />
                  <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
                    Was deine Erholung beeinflusst
                  </h2>
                </div>
                <InfoButton label="Gewohnheiten" onClick={() => onExplain('correlations')} />
              </div>

              <div className="divide-y divide-[var(--border-hairline)]">
                {habitImpacts.map((h) => (
                  <div key={h.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium text-[var(--text-primary)]">
                        {h.habit}
                      </p>
                      <p className="text-[11.5px] text-[var(--text-muted)]">{h.explanation}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
                        h.impactPct >= 0
                          ? 'bg-[var(--accent-recovery)]/15 text-[var(--accent-recovery)]'
                          : 'bg-[var(--accent-strain)]/15 text-[var(--accent-strain)]'
                      }`}
                    >
                      {h.impactPct >= 0 ? `+${h.impactPct}%` : `${h.impactPct}%`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
