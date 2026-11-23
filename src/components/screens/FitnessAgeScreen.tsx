import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ChevronLeft,
  HeartPulse,
  Heart,
  Moon,
  Flame,
  Info,
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
import { useShallow } from 'zustand/react/shallow';
import { useHealthStore } from '../../store/useHealthStore';
import { estimateFitnessAge } from '../../engine/calculations';
import { ExplanationTopic } from '../../i18n/de';
import { InfoButton } from '../ui/InfoButton';
import { formatNumberDE } from '../../utils/formatters';

interface FitnessAgeScreenProps {
  onExplain: (topic: ExplanationTopic) => void;
}

export const FitnessAgeScreen: React.FC<FitnessAgeScreenProps> = ({ onExplain }) => {
  const {
    selectedDate,
    profile,
    hrvObservations,
    rhrObservations,
    sleepSessions,
    workouts,
    dailyActivities,
    setDetailView,
  } = useHealthStore(
    useShallow((s) => ({
      selectedDate: s.selectedDate,
      profile: s.profile,
      hrvObservations: s.hrvObservations,
      rhrObservations: s.rhrObservations,
      sleepSessions: s.sleepSessions,
      workouts: s.workouts,
      dailyActivities: s.dailyActivities,
      setDetailView: s.setDetailView,
    }))
  );

  const estimate = useMemo(
    () =>
      estimateFitnessAge(
        selectedDate,
        profile,
        rhrObservations,
        workouts,
        dailyActivities,
        hrvObservations,
        sleepSessions,
        true
      ),
    [selectedDate, profile, rhrObservations, workouts, dailyActivities, hrvObservations, sleepSessions]
  );

  const chrono = estimate.chronologicalAge;
  const hasEstimate = estimate.estimatedFitnessAge !== null;
  const fit = estimate.estimatedFitnessAge ?? chrono;
  const diff = estimate.differenceYears ?? 0;

  const badgeText =
    diff < 0
      ? `${formatNumberDE(Math.abs(diff), 1)} Jahre jünger als dein Alter`
      : diff > 0
        ? `${formatNumberDE(diff, 1)} Jahre über deinem Alter`
        : 'Entspricht deinem Alter';

  const maxAgeBar = Math.max(chrono, fit) * 1.08;
  const chronoWidthPct = Math.min(100, Math.round((chrono / maxAgeBar) * 100));
  const fitWidthPct = hasEstimate ? Math.min(100, Math.round((fit / maxAgeBar) * 100)) : 0;

  const iconForKey = (key?: string) => {
    if (key === 'hrv') return <HeartPulse className="w-4 h-4 text-[var(--accent-hrv)]" />;
    if (key === 'rhr') return <Heart className="w-4 h-4 text-[var(--accent-strain)]" />;
    if (key === 'sleep') return <Moon className="w-4 h-4 text-[var(--accent-sleep)]" />;
    return <Flame className="w-4 h-4 text-[var(--accent-calories)]" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-5"
    >
      {/* Top Bar matching IMG-20261121-WA0013 */}
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDetailView('none')}
            aria-label="Zurück zur Übersicht"
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--bg-well)] transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-[28px] font-bold tracking-tight text-[var(--text-primary)]">
            Fitnessalter
          </h1>
        </div>
        <InfoButton label="Fitnessalter" onClick={() => onExplain('fitnessAge')} />
      </header>

      {/* Hero Numeral */}
      <section className="flex flex-col items-center justify-center py-2 text-center">
        <div className="flex items-baseline gap-2.5">
          <span className="serif-metric text-[64px] sm:text-[72px] font-medium leading-none text-[var(--text-primary)]">
            {estimate.estimatedFitnessAge !== null ? formatNumberDE(fit, 1) : '—'}
          </span>
          <span className="serif-metric text-[26px] text-[var(--text-secondary)]">Jahre</span>
        </div>

        {estimate.estimatedFitnessAge !== null && (
          <span className="mt-3 inline-flex items-center rounded-full bg-[var(--accent-recovery)]/15 border border-[var(--accent-recovery)]/25 px-4 py-1.5 text-[13px] font-medium text-[var(--accent-recovery)]">
            {badgeText}
          </span>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-6 space-y-4">
          {/* Im Vergleich Card */}
          <div className="apple-card p-5 space-y-4">
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Im Vergleich</h2>

            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[13.5px]">
                  <span className="text-[var(--text-secondary)]">Tatsächliches Alter</span>
                  <span className="font-semibold tabular-nums text-[var(--text-primary)]">
                    {formatNumberDE(chrono, 0)} Jahre
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-[var(--bg-well)] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${chronoWidthPct}%` }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full rounded-full bg-[#A1A4AE]/70"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[13.5px]">
                  <span className="text-[var(--text-secondary)]">Fitnessalter</span>
                  <span className="font-semibold tabular-nums text-[var(--accent-recovery)]">
                    {hasEstimate ? `${formatNumberDE(fit, 1)} Jahre` : '—'}
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-[var(--bg-well)] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${fitWidthPct}%` }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full rounded-full bg-[var(--accent-recovery)]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* So setzt es sich zusammen */}
          <div className="apple-card p-5 space-y-2">
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
                So setzt es sich zusammen
              </h2>
              <InfoButton label="Einflussfaktoren Fitnessalter" onClick={() => onExplain('fitnessAge')} />
            </div>

            <div className="divide-y divide-[var(--border-hairline)]">
              {estimate.inputsUsed.map((row) => {
                const isBetter = row.impactYears <= 0;
                const impactFormatted = `${row.impactYears > 0 ? '+' : ''}${formatNumberDE(
                  row.impactYears,
                  1
                )} Jahre`;
                return (
                  <div
                    key={row.label}
                    className="py-3 first:pt-1 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-full bg-[var(--bg-well)] flex items-center justify-center shrink-0">
                        {iconForKey(row.key)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-[var(--text-primary)] truncate">
                          {row.label}
                        </p>
                        <p className="text-[11.5px] text-[var(--text-muted)]">{row.valueText}</p>
                      </div>
                    </div>

                    <span
                      className={`shrink-0 text-[13.5px] font-semibold tabular-nums ${
                        isBetter ? 'text-[var(--accent-recovery)]' : 'text-[var(--accent-strain)]'
                      }`}
                    >
                      {impactFormatted}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: 30-day chart + info strip */}
        <div className="lg:col-span-6 space-y-4">
          <div className="apple-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
                Fitnessalter, 30 Tage
              </h2>
              <span className="text-xs text-[var(--text-muted)]">HUNT-Referenzmodell</span>
            </div>

            <div className="h-[196px] w-full">
              {!estimate.history30d || estimate.history30d.length === 0 ? (
                <div className="h-full rounded-2xl bg-[var(--bg-well)]/45 border border-dashed border-[var(--border-hairline)] flex flex-col items-center justify-center px-5 text-center">
                  <p className="text-sm font-medium text-[var(--text-primary)]">Noch keine Verlaufswerte</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)] max-w-xs">
                    Verbinde deine Datenquelle oder importiere Schlaf- und Pulsdaten, damit dein
                    30-Tage-Verlauf berechnet werden kann.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={estimate.history30d}
                    margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="fitAgeGreen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#5CE17C" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#5CE17C" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      vertical={false}
                      stroke="rgba(255,255,255,0.06)"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#717580', fontSize: 11 }}
                      interval={6}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#717580', fontSize: 11 }}
                      domain={['dataMin - 0.8', 'dataMax + 0.8']}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1D1F24',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 14,
                        fontSize: 12,
                        color: '#F5F6F8',
                      }}
                      formatter={(val: unknown) => [`${formatNumberDE(Number(val), 1)} Jahre`, 'Fitnessalter']}
                    />
                    <Area
                      type="monotone"
                      dataKey="age"
                      stroke="#5CE17C"
                      strokeWidth={2.5}
                      fill="url(#fitAgeGreen)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onExplain('fitnessAge')}
            className="w-full apple-card p-4 flex items-center gap-3 text-left hover:border-white/[0.14] transition-colors"
          >
            <Info className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
            <p className="text-[12.5px] text-[var(--text-secondary)] leading-snug">
              Berechnet aus HRV, Ruhepuls, Schlaf und Ausdauerwerten (HUNT-Studie). Tippen für die
              vollständige Formel.
            </p>
          </button>
        </div>
      </div>
    </motion.div>
  );
};
