import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Footprints,
  Dumbbell,
  Bike,
  Waves,
  Activity as ActivityIcon,
  ChevronRight,
  SlidersHorizontal,
  Plus,
  RotateCcw,
  Check,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { DailyDerivedSnapshot, SimulationInput, SportType } from '../../types/health';
import { useHealthStore } from '../../store/useHealthStore';
import { getHRZones, simulateWorkoutImpact } from '../../engine/calculations';
import { ExplanationTopic } from '../../i18n/de';
import { useI18n } from '../../i18n/useI18n';
import { InfoButton } from '../ui/InfoButton';
import { BottomSheet } from '../ui/BottomSheet';
import { StrainArcGauge } from '../ui/LiquidPrimitives';
import {
  AnimatedNumber,
  APPLE_EASE,
  SNAPPY_SPRING,
  staggerCardVariants,
  staggerParentVariants,
} from '../ui/MotionPrimitives';
import { formatNumberDE } from '../../utils/formatters';
import { haptics } from '../../utils/haptics';

interface ActivityScreenProps {
  snapshot: DailyDerivedSnapshot;
  onExplain: (topic: ExplanationTopic) => void;
  onOpenWorkout: (id: string) => void;
}

const ZONE_COLORS = ['#60A5FA', '#5CE17C', '#F5B82E', '#F59E0B', '#FB7B6B'];

export const ActivityScreen: React.FC<ActivityScreenProps> = ({
  snapshot,
  onExplain,
  onOpenWorkout,
}) => {
  const {
    profile,
    selectedDate,
    workouts,
    addAppliedWorkout,
    removeSimulatedWorkouts,
  } = useHealthStore(
    useShallow((s) => ({
      profile: s.profile,
      selectedDate: s.selectedDate,
      workouts: s.workouts,
      addAppliedWorkout: s.addAppliedWorkout,
      removeSimulatedWorkouts: s.removeSimulatedWorkouts,
    }))
  );

  const { t } = useI18n();
  const [zoneScope, setZoneScope] = useState<'today' | 'week'>('today');
  const [simOpen, setSimOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSport, setManualSport] = useState<SportType>('running');
  const [manualTitle, setManualTitle] = useState('');
  const [manualDuration, setManualDuration] = useState('45');
  const [manualDistance, setManualDistance] = useState('');
  const [manualAvgHr, setManualAvgHr] = useState('');
  const [manualRpe, setManualRpe] = useState(6);
  const [simInput, setSimInput] = useState<SimulationInput>({
    sport: 'running',
    durationMinutes: 50,
    distanceKm: 10,
    avgHrBpm: 158,
    rpe: 7,
  });

  const ewmaValue = snapshot.trainingLoad.ewmaAcwr ?? null;
  const ewmaStatusLabel =
    ewmaValue === null
      ? 'Im Aufbau'
      : ewmaValue < 0.75
        ? 'Unterlast / Pause'
        : ewmaValue <= 1.3
          ? t.activity.optimalRange
          : 'Überlastungsrisiko';
  const ewmaStatusColor =
    ewmaValue === null
      ? 'text-[var(--text-secondary)]'
      : ewmaValue < 0.75
        ? 'text-[var(--accent-calories)]'
        : ewmaValue <= 1.3
          ? 'text-[var(--accent-recovery)]'
          : 'text-[var(--accent-strain)]';

  const strain21 = snapshot.trainingLoad.dailyStrain21 ?? 0;
  const rawStrainLabel = (snapshot.trainingLoad.strainLabel ?? 'Ruhe') as
    | 'Ruhe'
    | 'Leicht'
    | 'Moderat'
    | 'Hoch'
    | 'Maximal';
  const strainLabel = t.activity.strainLabels[rawStrainLabel] ?? rawStrainLabel;

  const zones = useMemo(
    () => getHRZones(profile, snapshot.baseline.rhrMean28d ?? profile.restingHrBaselineManual ?? 52),
    [profile, snapshot.baseline.rhrMean28d]
  );

  const zoneMinutes =
    zoneScope === 'today'
      ? snapshot.trainingLoad.todayZoneMinutes ?? snapshot.trainingLoad.weeklyZoneMinutes
      : snapshot.trainingLoad.weeklyZoneMinutes;

  const maxZoneMin = Math.max(1, ...zoneMinutes);

  // Display Zone 5 down to Zone 1 matching IMG-20261121-WA0012
  const zoneRows = [4, 3, 2, 1, 0].map((idx) => ({
    zoneNum: idx + 1,
    label: `${t.activity.zone} ${idx + 1}`,
    bpmRange: `${zones[idx]?.minBpm ?? 100}–${zones[idx]?.maxBpm ?? 190} bpm`,
    minutes: Math.round(zoneMinutes[idx] ?? 0),
    color: ZONE_COLORS[idx],
    widthPct: Math.max(8, Math.round(((zoneMinutes[idx] ?? 0) / maxZoneMin) * 100)),
  }));

  const activeCalories = useMemo(() => {
    const workoutSum = snapshot.trainingLoad.workouts.reduce(
      (sum, w) => sum + (w.caloriesKcal ?? Math.round(w.durationMinutes * 9)),
      0
    );
    return snapshot.activity?.activeCaloriesKcal ?? workoutSum;
  }, [snapshot]);

  const simResult = useMemo(
    () => simulateWorkoutImpact(selectedDate, simInput, profile, snapshot, workouts),
    [selectedDate, simInput, profile, snapshot, workouts]
  );

  const hasSimulated = workouts.some((w) => w.isSimulated);

  const handleSaveManualWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    const durationMin = Math.max(5, Math.min(480, Math.round(Number(manualDuration) || 45)));
    const dist = manualDistance.trim() ? Math.max(0, Number(manualDistance)) : undefined;
    const hr = manualAvgHr.trim()
      ? Math.max(70, Math.min(220, Math.round(Number(manualAvgHr))))
      : undefined;

    const preview = simulateWorkoutImpact(
      selectedDate,
      {
        sport: manualSport,
        durationMinutes: durationMin,
        distanceKm: dist,
        avgHrBpm: hr,
        rpe: manualRpe,
      },
      profile,
      snapshot,
      workouts
    );

    const uniqueId = `wk_manual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await addAppliedWorkout({
      ...preview.simulatedWorkout,
      id: uniqueId,
      sourceRecordId: uniqueId,
      title: manualTitle.trim() || t.sports[manualSport],
      isSimulated: false,
      provenance: 'measured',
      dataQuality: hr ? 'high' : 'moderate',
    });

    haptics.success();
    setManualTitle('');
    setManualDistance('');
    setManualAvgHr('');
    setManualOpen(false);
  };

  const sportIcon = (sport: SportType) => {
    if (sport === 'running' || sport === 'walking' || sport === 'hiking') {
      return <Footprints className="w-5 h-5 text-[var(--accent-strain)]" />;
    }
    if (sport === 'strength' || sport === 'calisthenics') {
      return <Dumbbell className="w-5 h-5 text-[var(--accent-strain)]" />;
    }
    if (sport === 'cycling') return <Bike className="w-5 h-5 text-[var(--accent-strain)]" />;
    if (sport === 'swimming') return <Waves className="w-5 h-5 text-[var(--accent-strain)]" />;
    return <ActivityIcon className="w-5 h-5 text-[var(--accent-strain)]" />;
  };

  return (
    <motion.div
      variants={staggerParentVariants}
      initial="hidden"
      animate="show"
      className="space-y-4"
    >
      {/* Header matching IMG-20261121-WA0012 */}
      <motion.header variants={staggerCardVariants} className="flex items-center justify-between pt-1">
        <h1 className="text-[30px] font-bold tracking-tight text-[var(--text-primary)]">
          {t.activity.title}
        </h1>
        <InfoButton label={t.activity.title} onClick={() => onExplain('strain21')} />
      </motion.header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Top/Left: Coral 0–21 Arc Gauge (and on desktop, Active Calories below) */}
        <div className="lg:col-span-5 space-y-4">
          <motion.div variants={staggerCardVariants} className="py-1 flex flex-col items-center">
            <StrainArcGauge value={strain21} max={21} label={strainLabel} />
          </motion.div>

          <div className="hidden lg:block space-y-4">
            {/* Kalorien aktiv Card (Desktop Left) */}
            <motion.div
              variants={staggerCardVariants}
              className="apple-card p-5 flex items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-[14px] text-[var(--text-secondary)]">
                    {t.activity.activeCalories}
                  </p>
                  <InfoButton
                    label={t.activity.activeCalories}
                    onClick={() => onExplain('steps')}
                    className="!min-h-[28px] !min-w-[28px]"
                  />
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <AnimatedNumber
                    value={activeCalories}
                    className="serif-metric text-[40px] font-medium leading-none text-[var(--text-primary)]"
                  />
                  <span className="text-[16px] text-[var(--text-secondary)]">kcal</span>
                </div>
              </div>

              <div className="text-right">
                <p className="text-[11px] text-[var(--text-muted)]">{t.activity.ewmaBalance}</p>
                <p className={`mt-0.5 text-[18px] font-semibold tabular-nums ${ewmaStatusColor}`}>
                  {ewmaValue !== null ? formatNumberDE(ewmaValue, 2) : '—'}
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">{ewmaStatusLabel}</p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Right Column (and directly under Gauge on Mobile): Herzfrequenzzonen + Heutige Aktivitäten + Kalorien aktiv + Simulator */}
        <div className="lg:col-span-7 space-y-4">
          {/* Herzfrequenzzonen Card matching IMG-20261121-WA0012 */}
          <motion.div variants={staggerCardVariants} className="apple-card p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
                  {t.activity.hrZones}
                </h2>
                <InfoButton label={t.activity.hrZones} onClick={() => onExplain('hrZones')} />
              </div>

              <div className="inline-flex shrink-0 rounded-full bg-[var(--bg-well)] p-0.5">
                {(
                  [
                    { id: 'today', label: t.activity.todayScope },
                    { id: 'week', label: t.activity.weekScope },
                  ] as const
                ).map((s) => {
                  const active = zoneScope === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        if (!active) {
                          haptics.selection();
                          setZoneScope(s.id);
                        }
                      }}
                      className={`relative min-h-[28px] rounded-full px-3 text-[11.5px] font-medium whitespace-nowrap transition-colors ${
                        active
                          ? 'text-[var(--text-primary)]'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="activityZoneScope"
                          transition={SNAPPY_SPRING}
                          className="absolute inset-0 rounded-full bg-[var(--bg-elevated)] shadow-sm"
                        />
                      )}
                      <span className="relative z-10">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              {zoneRows.map((z) => (
                <div key={z.zoneNum} className="grid grid-cols-[54px_1fr_54px] items-center gap-3">
                  <span className="text-[13.5px] text-[var(--text-secondary)]">{z.label}</span>
                  <div className="h-[10px] w-full rounded-full bg-[var(--bg-well)] overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${z.minutes > 0 ? z.widthPct : 4}%` }}
                      transition={{ type: 'spring', stiffness: 170, damping: 24 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: z.color }}
                    />
                  </div>
                  <span className="text-right text-[13.5px] tabular-nums text-[var(--text-primary)]">
                    {String(z.minutes).padStart(2, '0')} {t.common.unitMin}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Heutige Aktivitäten Card matching IMG-20261121-WA0012 */}
          <motion.div variants={staggerCardVariants} className="apple-card p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
                  {t.activity.todaysActivities}
                </h2>
                <span className="text-xs text-[var(--text-muted)]">
                  {snapshot.trainingLoad.workouts.length}{' '}
                  {snapshot.trainingLoad.workouts.length === 1
                    ? t.activity.sessionSingular
                    : t.activity.sessionPlural}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  haptics.tick();
                  setManualOpen(true);
                }}
                className="min-h-[32px] inline-flex items-center gap-1 rounded-full bg-[var(--bg-well)] hover:bg-[var(--bg-elevated)] px-3 text-[11.5px] font-medium text-[var(--text-primary)] transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-[var(--accent-strain)]" />
                <span>Training eintragen</span>
              </button>
            </div>

            {snapshot.trainingLoad.workouts.length === 0 ? (
              <p className="py-4 text-sm text-[var(--text-secondary)]">{t.activity.noWorkouts}</p>
            ) : (
              <div className="divide-y divide-[var(--border-hairline)]">
                {snapshot.trainingLoad.workouts.map((wk) => {
                  const metaParts = [
                    wk.distanceKm ? `${formatNumberDE(wk.distanceKm, 1)} km` : null,
                    `${wk.durationMinutes} min`,
                    wk.avgHrBpm ? `Ø ${wk.avgHrBpm} bpm` : null,
                  ].filter(Boolean);

                  return (
                    <motion.button
                      key={wk.id}
                      type="button"
                      whileTap={{ scale: 0.985 }}
                      onClick={() => {
                        haptics.tick();
                        onOpenWorkout(wk.id);
                      }}
                      className="w-full py-3 first:pt-1 last:pb-0 flex items-center justify-between gap-3 text-left group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span className="w-11 h-11 rounded-[14px] bg-[var(--bg-elevated)] border border-[var(--border-hairline)] flex items-center justify-center shrink-0">
                          {sportIcon(wk.sport)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold text-[var(--text-primary)] truncate">
                            {wk.title || t.sports[wk.sport]}
                          </p>
                          <p className="text-[13px] text-[var(--text-secondary)] tabular-nums truncate">
                            {metaParts.join(' · ')}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] shrink-0" />
                    </motion.button>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Mobile Kalorien aktiv Card matching bottom of IMG-20261121-WA0012 */}
          <motion.div
            variants={staggerCardVariants}
            className="lg:hidden apple-card p-5 flex items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[14px] text-[var(--text-secondary)]">
                  {t.activity.activeCalories}
                </p>
                <InfoButton
                  label={t.activity.activeCalories}
                  onClick={() => onExplain('steps')}
                  className="!min-h-[28px] !min-w-[28px]"
                />
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <AnimatedNumber
                  value={activeCalories}
                  className="serif-metric text-[40px] font-medium leading-none text-[var(--text-primary)]"
                />
                <span className="text-[16px] text-[var(--text-secondary)]">kcal</span>
              </div>
            </div>

            <div className="text-right">
              <p className="text-[11px] text-[var(--text-muted)]">{t.activity.ewmaBalance}</p>
              <p className={`mt-0.5 text-[18px] font-semibold tabular-nums ${ewmaStatusColor}`}>
                {ewmaValue !== null ? formatNumberDE(ewmaValue, 2) : '—'}
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">{ewmaStatusLabel}</p>
            </div>
          </motion.div>

          {/* Interactive Workout Simulator */}
          <motion.div variants={staggerCardVariants} className="apple-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  haptics.tick();
                  setSimOpen((v) => !v);
                }}
                className="flex items-center gap-2.5 text-left"
              >
                <span className="w-8 h-8 rounded-full bg-[var(--accent-strain)]/15 text-[var(--accent-strain)] flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-[14px] font-semibold text-[var(--text-primary)]">
                    {t.activity.simulatorTitle}
                  </p>
                  <p className="text-[11.5px] text-[var(--text-muted)]">
                    {t.activity.simulatorSub}
                  </p>
                </div>
              </button>
              <div className="flex items-center gap-1">
                <InfoButton label={t.activity.simulatorTitle} onClick={() => onExplain('simulator')} />
                <button
                  type="button"
                  onClick={() => {
                    haptics.tick();
                    setSimOpen((v) => !v);
                  }}
                  className="text-xs font-medium text-[var(--accent-strain)] px-2 py-1"
                >
                  {simOpen ? t.common.close : t.common.open}
                </button>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {simOpen && (
                <motion.div
                  key="simulator-drawer"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.26, ease: APPLE_EASE }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 border-t border-[var(--border-hairline)] space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { id: 'running', label: t.activity.sportRun },
                          { id: 'strength', label: t.activity.sportStrength },
                          { id: 'cycling', label: t.activity.sportCycle },
                        ] as const
                      ).map((sp) => (
                        <motion.button
                          key={sp.id}
                          type="button"
                          whileTap={{ scale: 0.96 }}
                          onClick={() => {
                            haptics.selection();
                            setSimInput((p) => ({ ...p, sport: sp.id }));
                          }}
                          className={`min-h-[36px] rounded-xl text-xs font-medium transition-colors ${
                            simInput.sport === sp.id
                              ? 'bg-[var(--accent-strain)]/20 text-[var(--accent-strain)] border border-[var(--accent-strain)]/40'
                              : 'bg-[var(--bg-well)] text-[var(--text-secondary)]'
                          }`}
                        >
                          {sp.label}
                        </motion.button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3" data-no-tab-swipe="true">
                      <label className="block space-y-1">
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {t.activity.duration}: {simInput.durationMinutes} {t.common.unitMin}
                        </span>
                        <input
                          type="range"
                          min={15}
                          max={150}
                          step={5}
                          value={simInput.durationMinutes}
                          onChange={(e) =>
                            setSimInput((p) => ({ ...p, durationMinutes: Number(e.target.value) }))
                          }
                          className="w-full accent-[#FB7B6B]"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {t.activity.avgHr}: {simInput.avgHrBpm ?? 150} bpm
                        </span>
                        <input
                          type="range"
                          min={105}
                          max={190}
                          step={2}
                          value={simInput.avgHrBpm ?? 150}
                          onChange={(e) =>
                            setSimInput((p) => ({ ...p, avgHrBpm: Number(e.target.value) }))
                          }
                          className="w-full accent-[#FB7B6B]"
                        />
                      </label>
                    </div>

                    <div className="rounded-2xl bg-[var(--bg-well)] p-3 flex items-center justify-between text-xs">
                      <div>
                        <p className="text-[var(--text-muted)]">{t.activity.strainAfter}</p>
                        <p className="text-[16px] font-bold tabular-nums text-[var(--text-primary)]">
                          {(simResult.beforeStrain21 ?? strain21).toFixed(1)} →{' '}
                          <span className="text-[var(--accent-strain)]">
                            {(simResult.afterStrain21 ?? strain21).toFixed(1)}
                          </span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[var(--text-muted)]">{t.activity.recoveryTomorrow}</p>
                        <p className="text-[14px] font-semibold tabular-nums text-[var(--text-primary)]">
                          {simResult.estimatedNextDayRecoveryRange[0]}–
                          {simResult.estimatedNextDayRecoveryRange[1]} %
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          haptics.success();
                          addAppliedWorkout(simResult.simulatedWorkout);
                        }}
                        className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--text-primary)] text-[var(--bg-canvas)] text-xs font-semibold hover:opacity-90"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {t.activity.applyPreview}
                      </motion.button>
                      {hasSimulated && (
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.92 }}
                          onClick={() => {
                            haptics.light();
                            removeSimulatedWorkouts();
                          }}
                          aria-label={t.activity.resetPreview}
                          className="min-h-[40px] min-w-[40px] rounded-full bg-[var(--bg-well)] text-[var(--text-secondary)] flex items-center justify-center"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </motion.button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* Manual Workout Sheet (Wearable-Free Support) */}
      <BottomSheet
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        title="Training eintragen"
        subtitle="Funktioniert auch ohne Uhr · Berechnet Belastung (0–21) & Kalorien automatisch"
        maxWidthClass="sm:max-w-md"
      >
        <form onSubmit={handleSaveManualWorkout} className="space-y-4">
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: 'running', label: 'Laufen' },
                { id: 'strength', label: 'Kraft' },
                { id: 'cycling', label: 'Rad' },
                { id: 'walking', label: 'Gehen' },
                { id: 'swimming', label: 'Schwimmen' },
                { id: 'hiit', label: 'HIIT' },
              ] as { id: SportType; label: string }[]
            ).map((sp) => (
              <button
                key={sp.id}
                type="button"
                onClick={() => {
                  haptics.selection();
                  setManualSport(sp.id);
                }}
                className={`min-h-[38px] rounded-xl text-xs font-medium border transition-colors ${
                  manualSport === sp.id
                    ? 'bg-[var(--accent-strain)]/20 text-[var(--accent-strain)] border-[var(--accent-strain)]/45 font-semibold'
                    : 'bg-[var(--bg-well)] border-transparent text-[var(--text-secondary)]'
                }`}
              >
                {sp.label}
              </button>
            ))}
          </div>

          <label className="block space-y-1 text-xs text-[var(--text-secondary)]">
            <span>Bezeichnung (optional)</span>
            <input
              type="text"
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              placeholder={`z. B. ${t.sports[manualSport]}`}
              className="w-full min-h-[42px] rounded-xl bg-[var(--bg-well)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
          </label>

          <div className="grid grid-cols-3 gap-2.5">
            <label className="space-y-1 text-xs text-[var(--text-secondary)]">
              <span>Dauer (Min.)</span>
              <input
                type="number"
                required
                min={5}
                max={480}
                value={manualDuration}
                onChange={(e) => setManualDuration(e.target.value)}
                className="w-full min-h-[42px] rounded-xl bg-[var(--bg-well)] px-3 text-sm tabular-nums text-[var(--text-primary)]"
              />
            </label>
            <label className="space-y-1 text-xs text-[var(--text-secondary)]">
              <span>Distanz (km)</span>
              <input
                type="number"
                step="0.1"
                min={0}
                max={300}
                placeholder="opt."
                value={manualDistance}
                onChange={(e) => setManualDistance(e.target.value)}
                className="w-full min-h-[42px] rounded-xl bg-[var(--bg-well)] px-3 text-sm tabular-nums text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              />
            </label>
            <label className="space-y-1 text-xs text-[var(--text-secondary)]">
              <span>Ø Puls</span>
              <input
                type="number"
                min={70}
                max={220}
                placeholder="opt."
                value={manualAvgHr}
                onChange={(e) => setManualAvgHr(e.target.value)}
                className="w-full min-h-[42px] rounded-xl bg-[var(--bg-well)] px-3 text-sm tabular-nums text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
              />
            </label>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-secondary)]">Gefühlte Anstrengung (RPE)</span>
              <span className="font-semibold tabular-nums text-[var(--accent-strain)]">
                {manualRpe} / 10
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={manualRpe}
              onChange={(e) => setManualRpe(Number(e.target.value))}
              className="w-full accent-[#FB7B6B]"
            />
          </div>

          <motion.button
            type="submit"
            whileTap={{ scale: 0.98 }}
            className="w-full min-h-[48px] rounded-full bg-[var(--accent-strain)] text-[#090A0C] font-semibold text-sm inline-flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Training speichern</span>
          </motion.button>
        </form>
      </BottomSheet>
    </motion.div>
  );
};

