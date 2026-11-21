import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Leaf,
  HeartPulse,
  Moon,
  Flame,
  ChevronRight,
  User,
  BarChart3,
  Footprints,
  Wind,
} from 'lucide-react';
import { DailyDerivedSnapshot } from '../../types/health';
import { useHealthStore } from '../../store/useHealthStore';
import { estimateFitnessAge } from '../../engine/calculations';
import { calculateNutritionTargets, summarizeMealsForDate } from '../../engine/nutrition';
import { ExplanationTopic } from '../../i18n/de';
import { InfoButton } from '../ui/InfoButton';
import { DailyCheckInCard } from '../ui/DailyCheckInCard';
import { CircularProgressRing, MiniAreaSparkline } from '../ui/LiquidPrimitives';
import {
  AnimatedNumber,
  staggerCardVariants,
  staggerParentVariants,
} from '../ui/MotionPrimitives';
import {
  formatClockFromIso,
  formatGermanFullDate,
  formatNumberDE,
  getDynamicGreeting,
} from '../../utils/formatters';

interface TodayScreenProps {
  snapshot: DailyDerivedSnapshot;
  onExplain: (topic: ExplanationTopic) => void;
  onOpenBreathwork: () => void;
  onOpenJournal: () => void;
}

export const TodayScreen: React.FC<TodayScreenProps> = ({
  snapshot,
  onExplain,
  onOpenBreathwork,
  onOpenJournal,
}) => {
  const {
    profile,
    selectedDate,
    hrvObservations,
    rhrObservations,
    sleepSessions,
    workouts,
    dailyActivities,
    meals,
    setActiveTab,
    setDetailView,
  } = useHealthStore();

  const fitnessAge = useMemo(
    () =>
      estimateFitnessAge(
        selectedDate,
        profile,
        rhrObservations,
        workouts,
        dailyActivities,
        hrvObservations,
        sleepSessions,
        false
      ),
    [selectedDate, profile, rhrObservations, workouts, dailyActivities, hrvObservations, sleepSessions]
  );

  const mealSummary = useMemo(
    () => summarizeMealsForDate(meals, selectedDate),
    [meals, selectedDate]
  );

  const activeCaloriesToday = useMemo(() => {
    const workoutCals = snapshot.trainingLoad.workouts.reduce(
      (sum, w) => sum + (w.caloriesKcal ?? Math.round(w.durationMinutes * 9)),
      0
    );
    return snapshot.activity?.activeCaloriesKcal ?? Math.max(380, workoutCals);
  }, [snapshot]);

  const nutritionTargets = useMemo(
    () => calculateNutritionTargets(profile, activeCaloriesToday),
    [profile, activeCaloriesToday]
  );

  const recoveryScore = snapshot.recovery.score ?? 0;
  const recoverySubtitle =
    recoveryScore >= 70
      ? 'Optimal, bereit für Belastung.'
      : recoveryScore >= 45
        ? 'Ausgeglichen, locker bis moderat.'
        : 'Heute bewusst regenerieren.';
  const recoveryColor =
    recoveryScore >= 70
      ? 'var(--accent-recovery)'
      : recoveryScore >= 45
        ? 'var(--accent-calories)'
        : 'var(--accent-strain)';

  // Sleep formatting "7 h 42 min"
  const sleepMin = snapshot.sleep.durationMinutes ?? 0;
  const sleepH = Math.floor(sleepMin / 60);
  const sleepM = sleepMin % 60;
  const bedtimeLabel = snapshot.sleepSession
    ? formatClockFromIso(snapshot.sleepSession.bedtimeIso)
    : '23:12';
  const wakeLabel = snapshot.sleepSession
    ? formatClockFromIso(snapshot.sleepSession.wakeTimeIso)
    : '06:54';

  // Overnight sleep curve for lavender sparkline
  const sleepSparkVals = useMemo(() => {
    const stages = snapshot.sleepSession?.stages ?? [];
    if (stages.length >= 6) {
      const levelMap = { deep: 22, light: 54, rem: 78, awake: 95 };
      return stages.slice(0, 14).map((s) => levelMap[s.stage]);
    }
    return [42, 68, 52, 61, 34, 48, 72, 92, 66, 78];
  }, [snapshot.sleepSession]);

  // Recent HRV series for sky-blue sparkline
  const hrvSparkVals = useMemo(() => {
    const recent = hrvObservations
      .filter((h) => h.date <= selectedDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-12)
      .map((h) => h.value);
    return recent.length >= 4 ? recent : [74, 80, 76, 84, 82, 88, 91, 96];
  }, [hrvObservations, selectedDate]);

  const strain21 = snapshot.trainingLoad.dailyStrain21 ?? 14.2;
  const strainPercent = Math.min(100, (strain21 / 21) * 100);
  const strainSubLabel =
    strain21 >= 17
      ? 'Hohe Belastung heute.'
      : strain21 >= 11
        ? 'Moderate Belastung heute.'
        : strain21 >= 5
          ? 'Lockere Bewegung heute.'
          : 'Ruhiger Regenerationstag.';

  const caloriePct = Math.min(
    100,
    Math.round((mealSummary.totalCalories / Math.max(1, nutritionTargets.caloriesKcal)) * 100)
  );

  const [recLow, recHigh] = snapshot.recovery.recommendedStrainRange ?? [14, 16];
  const lowPosPct = Math.min(94, Math.max(6, (recLow / 21) * 100));
  const highPosPct = Math.min(96, Math.max(lowPosPct + 6, (recHigh / 21) * 100));

  const greeting = getDynamicGreeting();
  const formattedDate = formatGermanFullDate(selectedDate);

  const fitDiff = fitnessAge.differenceYears ?? 0;
  const fitBadgeText =
    fitDiff < 0
      ? `${formatNumberDE(Math.abs(fitDiff), 1)} Jahre jünger als dein Alter`
      : fitDiff > 0
        ? `${formatNumberDE(fitDiff, 1)} Jahre über deinem Alter`
        : 'Entspricht deinem Alter';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-3.5"
    >
      {/* Header matching IMG-20261121-WA0018 */}
      <header className="flex items-start justify-between gap-3 pt-1 pb-1">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight text-[var(--text-primary)] leading-[1.12]">
            {greeting}, {profile.displayName}
          </h1>
          <p className="mt-1 text-[15px] text-[var(--text-secondary)] capitalize">
            {formattedDate}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenBreathwork}
            aria-label="HRV-Atemübung starten"
            title="HRV-Atemübung"
            className="hidden sm:inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-hairline)] px-3.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Wind className="w-3.5 h-3.5 text-[var(--accent-recovery)]" />
            <span>Atmen</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('more')}
            aria-label="Profil und Einstellungen"
            className="w-11 h-11 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <User className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Daily Subjective Check-In (Collapses to 1-line summary once logged today) */}
      <DailyCheckInCard
        snapshot={snapshot}
        onExplain={onExplain}
        onOpenJournal={onOpenJournal}
      />

      {/* Responsive Desktop Layout: 2-column Bento on lg+, exact vertical stack on mobile */}
      <motion.div
        variants={staggerParentVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-12 gap-3.5"
      >
        {/* Left/Top Primary Column: Erholung + Fitnessalter + Heute empfohlen */}
        <div className="lg:col-span-6 space-y-3.5">
          {/* Card 1: Erholung Hero Card */}
          <motion.div
            variants={staggerCardVariants}
            whileTap={{ scale: 0.99 }}
            className="apple-card p-5 transition-colors hover:border-white/[0.13]"
          >
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setDetailView('recovery')}
                className="flex-1 text-left flex items-center justify-between gap-4 focus-visible:outline-none group"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Leaf className="w-4 h-4 text-[var(--accent-recovery)] shrink-0" />
                    <span className="text-[15px] font-medium text-[var(--text-primary)]">
                      Erholung
                    </span>
                  </div>
                  <div className="mt-2 serif-metric text-[54px] sm:text-[58px] font-medium leading-none text-[var(--text-primary)]">
                    {snapshot.recovery.score !== null ? (
                      <AnimatedNumber value={snapshot.recovery.score} suffix="%" />
                    ) : (
                      '—'
                    )}
                  </div>
                  <p className="mt-2.5 text-[13.5px] text-[var(--text-secondary)]">
                    {recoverySubtitle}
                  </p>
                </div>

                <CircularProgressRing
                  percent={recoveryScore}
                  size={104}
                  strokeWidth={9}
                  color={recoveryColor}
                >
                  <Leaf className="w-4 h-4 text-[var(--accent-recovery)] mb-0.5" />
                  <span className="text-[19px] font-semibold tabular-nums text-[var(--text-primary)] leading-none">
                    {snapshot.recovery.score !== null ? (
                      <AnimatedNumber value={snapshot.recovery.score} suffix="%" />
                    ) : (
                      '—'
                    )}
                  </span>
                </CircularProgressRing>
              </button>
            </div>
            <div className="mt-2 -mb-1 flex items-center justify-between border-t border-[var(--border-hairline)] pt-2">
              <button
                type="button"
                onClick={() => setDetailView('recovery')}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] inline-flex items-center gap-1 transition-colors"
              >
                <span>Details &amp; HRV-Verlauf ansehen</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <InfoButton label="Erholung" onClick={() => onExplain('recovery')} />
            </div>
          </motion.div>

          {/* Card 2: Fitnessalter Card */}
          <motion.div
            variants={staggerCardVariants}
            whileTap={{ scale: 0.99 }}
            className="apple-card p-5 transition-colors hover:border-white/[0.13]"
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setDetailView('fitnessAge')}
                className="flex items-center gap-2 text-left focus-visible:outline-none"
              >
                <HeartPulse className="w-4 h-4 text-[var(--accent-recovery)]" />
                <span className="text-[15px] font-medium text-[var(--text-primary)]">
                  Fitnessalter
                </span>
              </button>
              <div className="flex items-center gap-0.5">
                <InfoButton label="Fitnessalter" onClick={() => onExplain('fitnessAge')} />
                <button
                  type="button"
                  onClick={() => setDetailView('fitnessAge')}
                  aria-label="Fitnessalter Details öffnen"
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setDetailView('fitnessAge')}
              className="mt-2 w-full flex flex-wrap items-center justify-between gap-3 text-left focus-visible:outline-none"
            >
              <div className="flex items-baseline gap-2">
                <span className="serif-metric text-[44px] font-medium leading-none text-[var(--text-primary)]">
                  {fitnessAge.estimatedFitnessAge !== null
                    ? formatNumberDE(fitnessAge.estimatedFitnessAge, 1)
                    : '—'}
                </span>
                <span className="serif-metric text-[20px] text-[var(--text-secondary)]">Jahre</span>
              </div>

              {fitnessAge.estimatedFitnessAge !== null && (
                <span className="inline-flex items-center rounded-full bg-[var(--accent-recovery)]/14 border border-[var(--accent-recovery)]/25 px-3.5 py-1.5 text-xs font-medium text-[var(--accent-recovery)]">
                  {fitBadgeText}
                </span>
              )}
            </button>
          </motion.div>

          {/* Card 3 (Desktop stays under Fitnessalter, Mobile sits at bottom via order): Heute empfohlen */}
          <motion.div
            variants={staggerCardVariants}
            className="hidden lg:block apple-card p-5 transition-colors hover:border-white/[0.13]"
          >
            <RecommendedStrainCardBody
              recLow={recLow}
              recHigh={recHigh}
              lowPosPct={lowPosPct}
              highPosPct={highPosPct}
              summaryText={
                snapshot.journal?.illnessSymptoms
                  ? 'Schonung empfohlen — Krankheitsgefühl im Tages-Check-in erkannt.'
                  : snapshot.journal &&
                      (snapshot.journal.energyLevel <= 2 ||
                        (snapshot.journal.subjectiveSleepQuality !== undefined &&
                          snapshot.journal.subjectiveSleepQuality <= 2))
                    ? 'Dein Belastungsziel wurde anhand deines heutigen Energie- & Schlafgefühls sanft reduziert.'
                    : 'Bleibe in der grünen Zone für optimale Fortschritte.'
              }
              onOpen={() => setActiveTab('activity')}
              onExplain={() => onExplain('strain21')}
            />
          </motion.div>
        </div>

        {/* Right/Middle 2x2 Bento Grid */}
        <div className="lg:col-span-6 grid grid-cols-2 gap-3 content-start">
          {/* Tile 1: Schlaf */}
          <motion.div
            variants={staggerCardVariants}
            whileTap={{ scale: 0.985 }}
            className="apple-card p-3.5 sm:p-4 flex flex-col justify-between min-h-[164px] transition-colors hover:border-white/[0.13]"
          >
            <div className="flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('sleep')}
                className="flex items-center gap-1.5 text-left min-w-0"
              >
                <Moon className="w-4 h-4 text-[var(--accent-sleep)] fill-[var(--accent-sleep)]/20 shrink-0" />
                <span className="text-[13.5px] font-medium text-[var(--text-primary)] whitespace-nowrap">
                  Schlaf
                </span>
              </button>
              <InfoButton
                label="Schlaf"
                onClick={() => onExplain('sleep')}
                className="!min-h-[26px] !min-w-[26px]"
              />
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('sleep')}
              className="mt-2 text-left w-full flex-1 flex flex-col justify-between focus-visible:outline-none"
            >
              <div className="text-[23px] sm:text-[26px] font-bold tracking-tight text-[var(--text-primary)] tabular-nums leading-tight">
                {sleepMin > 0 ? (
                  <>
                    {sleepH} <span className="text-[15px] font-medium text-[var(--text-secondary)]">h</span>{' '}
                    {String(sleepM).padStart(2, '0')}{' '}
                    <span className="text-[14px] font-medium text-[var(--text-secondary)]">min</span>
                  </>
                ) : (
                  '—'
                )}
              </div>
              <div className="mt-2.5">
                <MiniAreaSparkline
                  values={sleepSparkVals}
                  color="#A78BFA"
                  leftLabel={bedtimeLabel}
                  rightLabel={wakeLabel}
                  height={34}
                />
              </div>
            </button>
          </motion.div>

          {/* Tile 2: Belastung (0–21) */}
          <motion.div
            variants={staggerCardVariants}
            whileTap={{ scale: 0.985 }}
            className="apple-card p-3.5 sm:p-4 flex flex-col justify-between min-h-[164px] transition-colors hover:border-white/[0.13]"
          >
            <div className="flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('activity')}
                className="flex items-center gap-1.5 text-left min-w-0"
              >
                <Footprints className="w-4 h-4 text-[var(--accent-strain)] shrink-0" />
                <span className="text-[13.5px] font-medium text-[var(--text-primary)] whitespace-nowrap">
                  Belastung
                </span>
              </button>
              <InfoButton
                label="Belastung"
                onClick={() => onExplain('strain21')}
                className="!min-h-[26px] !min-w-[26px]"
              />
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('activity')}
              className="mt-2 text-left w-full flex-1 flex flex-col justify-between focus-visible:outline-none"
            >
              <div className="text-[25px] font-bold tracking-tight tabular-nums text-[var(--text-primary)] leading-tight">
                {strain21.toFixed(1)}
              </div>
              <div className="mt-2 flex items-end justify-between gap-1.5">
                <p className="text-[11.5px] leading-snug text-[var(--text-secondary)]">
                  {strainSubLabel}
                </p>
                <CircularProgressRing
                  percent={strainPercent}
                  size={54}
                  strokeWidth={5.5}
                  color="var(--accent-strain)"
                >
                  <span className="text-[12.5px] font-semibold tabular-nums text-[var(--text-primary)]">
                    {strain21.toFixed(1)}
                  </span>
                </CircularProgressRing>
              </div>
            </button>
          </motion.div>

          {/* Tile 3: HRV */}
          <motion.div
            variants={staggerCardVariants}
            whileTap={{ scale: 0.985 }}
            className="apple-card p-3.5 sm:p-4 flex flex-col justify-between min-h-[164px] transition-colors hover:border-white/[0.13]"
          >
            <div className="flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => setDetailView('recovery')}
                className="flex items-center gap-1.5 text-left min-w-0"
              >
                <HeartPulse className="w-4 h-4 text-[var(--accent-hrv)] shrink-0" />
                <span className="text-[13.5px] font-medium text-[var(--text-primary)] whitespace-nowrap">
                  HRV
                </span>
              </button>
              <InfoButton
                label="HRV"
                onClick={() => onExplain('hrv')}
                className="!min-h-[26px] !min-w-[26px]"
              />
            </div>

            <button
              type="button"
              onClick={() => setDetailView('recovery')}
              className="mt-2 text-left w-full flex-1 flex flex-col justify-between focus-visible:outline-none"
            >
              <div className="text-[25px] font-bold tracking-tight tabular-nums text-[var(--text-primary)] leading-tight">
                {snapshot.recovery.hrvToday !== null ? (
                  <>
                    {snapshot.recovery.hrvToday}{' '}
                    <span className="text-[15px] font-medium text-[var(--text-secondary)]">ms</span>
                  </>
                ) : (
                  '—'
                )}
              </div>
              <div className="mt-2.5">
                <MiniAreaSparkline
                  values={hrvSparkVals}
                  color="#60A5FA"
                  leftLabel="00:00"
                  rightLabel="24:00"
                  height={34}
                />
              </div>
            </button>
          </motion.div>

          {/* Tile 4: Kalorien */}
          <motion.div
            variants={staggerCardVariants}
            whileTap={{ scale: 0.985 }}
            className="apple-card p-3.5 sm:p-4 flex flex-col justify-between min-h-[164px] transition-colors hover:border-white/[0.13]"
          >
            <div className="flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('nutrition')}
                className="flex items-center gap-1.5 text-left min-w-0"
              >
                <Flame className="w-4 h-4 text-[var(--accent-calories)] fill-[var(--accent-calories)]/25 shrink-0" />
                <span className="text-[13.5px] font-medium text-[var(--text-primary)] whitespace-nowrap">
                  Kalorien
                </span>
              </button>
              <InfoButton
                label="Kalorien"
                onClick={() => onExplain('nutrition')}
                className="!min-h-[26px] !min-w-[26px]"
              />
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('nutrition')}
              className="mt-2 text-left w-full flex-1 flex flex-col justify-between focus-visible:outline-none"
            >
              <div className="text-[22px] sm:text-[25px] font-bold tracking-tight tabular-nums text-[var(--text-primary)] leading-tight">
                <AnimatedNumber value={mealSummary.totalCalories} />{' '}
                <span className="text-[13.5px] font-medium text-[var(--text-secondary)]">kcal</span>
              </div>
              <div className="mt-2 flex items-end justify-between gap-1.5">
                <p className="text-[11.5px] leading-snug text-[var(--text-secondary)]">
                  {caloriePct} % deines Tagesziels.
                </p>
                <CircularProgressRing
                  percent={caloriePct}
                  size={54}
                  strokeWidth={5.5}
                  color="var(--accent-calories)"
                >
                  <span className="text-[12px] font-semibold tabular-nums text-[var(--text-primary)]">
                    {caloriePct}%
                  </span>
                </CircularProgressRing>
              </div>
            </button>
          </motion.div>
        </div>
      </motion.div>

      {/* Mobile Bottom Card: Heute empfohlen */}
      <div className="lg:hidden apple-card p-5 transition-colors hover:border-white/[0.13]">
        <RecommendedStrainCardBody
          recLow={recLow}
          recHigh={recHigh}
          lowPosPct={lowPosPct}
          highPosPct={highPosPct}
          summaryText={
            snapshot.journal?.illnessSymptoms
              ? 'Schonung empfohlen — Krankheitsgefühl im Tages-Check-in erkannt.'
              : snapshot.journal &&
                  (snapshot.journal.energyLevel <= 2 ||
                    (snapshot.journal.subjectiveSleepQuality !== undefined &&
                      snapshot.journal.subjectiveSleepQuality <= 2))
                ? 'Dein Belastungsziel wurde anhand deines heutigen Energie- & Schlafgefühls sanft reduziert.'
                : 'Bleibe in der grünen Zone für optimale Fortschritte.'
          }
          onOpen={() => setActiveTab('activity')}
          onExplain={() => onExplain('strain21')}
        />
      </div>
    </motion.div>
  );
};

const RecommendedStrainCardBody: React.FC<{
  recLow: number;
  recHigh: number;
  lowPosPct: number;
  highPosPct: number;
  summaryText: string;
  onOpen: () => void;
  onExplain: () => void;
}> = ({ recLow, recHigh, lowPosPct, highPosPct, summaryText, onOpen, onExplain }) => (
  <div>
    <div className="flex items-center justify-between">
      <button type="button" onClick={onOpen} className="flex items-center gap-2 text-left">
        <BarChart3 className="w-4 h-4 text-[var(--text-secondary)]" />
        <span className="text-[14px] font-medium text-[var(--text-secondary)]">Heute empfohlen</span>
      </button>
      <div className="flex items-center gap-0.5">
        <InfoButton label="Belastungsempfehlung" onClick={onExplain} />
        <button
          type="button"
          onClick={onOpen}
          aria-label="Belastungsansicht öffnen"
          className="p-1 text-[var(--text-muted)]"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>

    <button type="button" onClick={onOpen} className="mt-1.5 w-full text-left focus-visible:outline-none">
      <p className="text-[20px] font-bold tracking-tight text-[var(--text-primary)]">
        Belastung {recLow} bis {recHigh}
      </p>
      <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
        {summaryText}
      </p>

      {/* Multi-zone gradient bar with smoothly gliding spring range dots */}
      <div className="mt-4 relative pt-1 pb-6">
        <div
          className="h-[6px] w-full rounded-full"
          style={{
            background:
              'linear-gradient(90deg, #5CE17C 0%, #5CE17C 54%, #F5B82E 76%, #FB7B6B 100%)',
          }}
        />
        <motion.span
          animate={{ left: `${lowPosPct}%` }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          className="absolute top-[0px] w-3.5 h-3.5 -translate-x-1/2 rounded-full bg-white shadow-md ring-2 ring-black/40"
        />
        <motion.span
          animate={{ left: `${highPosPct}%` }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          className="absolute top-[0px] w-3.5 h-3.5 -translate-x-1/2 rounded-full bg-white shadow-md ring-2 ring-black/40"
        />

        <span className="absolute bottom-0 left-0 text-[11px] tabular-nums text-[var(--text-muted)]">
          0
        </span>
        <motion.span
          animate={{ left: `${lowPosPct}%` }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          className="absolute bottom-0 -translate-x-1/2 text-[11px] font-semibold tabular-nums text-[var(--text-secondary)]"
        >
          {recLow}
        </motion.span>
        <motion.span
          animate={{ left: `${highPosPct}%` }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          className="absolute bottom-0 -translate-x-1/2 text-[11px] font-semibold tabular-nums text-[var(--text-secondary)]"
        >
          {recHigh}
        </motion.span>
        <span className="absolute bottom-0 right-0 text-[11px] tabular-nums text-[var(--text-muted)]">
          21
        </span>
      </div>
    </button>
  </div>
);
