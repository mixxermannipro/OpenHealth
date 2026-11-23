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
import { useShallow } from 'zustand/react/shallow';
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
  toLocalDateKey,
} from '../../utils/formatters';
import { getActiveBcp47 } from '../../i18n/translations';
import { useI18n } from '../../i18n/useI18n';
import { ONBOARDING_COPY } from '../../i18n/onboardingCopy';
import { haptics } from '../../utils/haptics';

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
    todayKey,
    selectedDate,
    setSelectedDate,
    hrvObservations,
    rhrObservations,
    sleepSessions,
    workouts,
    dailyActivities,
    meals,
    setActiveTab,
    setDetailView,
  } = useHealthStore(
    useShallow((s) => ({
      profile: s.profile,
      todayKey: s.todayKey,
      selectedDate: s.selectedDate,
      setSelectedDate: s.setSelectedDate,
      hrvObservations: s.hrvObservations,
      rhrObservations: s.rhrObservations,
      sleepSessions: s.sleepSessions,
      workouts: s.workouts,
      dailyActivities: s.dailyActivities,
      meals: s.meals,
      setActiveTab: s.setActiveTab,
      setDetailView: s.setDetailView,
    }))
  );
  const { t, locale } = useI18n();
  const bcp47 = getActiveBcp47(locale);
  const empty = (ONBOARDING_COPY[locale] ?? ONBOARDING_COPY.de).emptyState;
  const hasAnyWearableData =
    hrvObservations.length > 0 ||
    rhrObservations.length > 0 ||
    sleepSessions.length > 0 ||
    workouts.length > 0 ||
    dailyActivities.length > 0;

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
    return snapshot.activity?.activeCaloriesKcal ?? workoutCals;
  }, [snapshot]);

  const nutritionTargets = useMemo(
    () => calculateNutritionTargets(profile, activeCaloriesToday),
    [profile, activeCaloriesToday]
  );

  const hasRecovery = snapshot.recovery.score !== null;
  const recoveryScore = snapshot.recovery.score ?? 0;
  const baseRecoverySubtitle = !hasRecovery
    ? empty.noWearableYet
    : recoveryScore >= 70
      ? t.today.recoveryOptimal
      : recoveryScore >= 45
        ? t.today.recoveryModerate
        : t.today.recoveryLow;
  const recoverySubtitle =
    hasRecovery && snapshot.recovery.isSubjectiveFallback
      ? `${baseRecoverySubtitle} · Check-in`
      : baseRecoverySubtitle;
  const recoveryColor = !hasRecovery
    ? 'var(--text-muted)'
    : recoveryScore >= 70
      ? 'var(--accent-recovery)'
      : recoveryScore >= 45
        ? 'var(--accent-calories)'
        : 'var(--accent-strain)';

  // Sleep formatting "7 h 42 min" — zero fake fallback when no session exists
  const sleepMin = snapshot.sleep.durationMinutes ?? 0;
  const sleepH = Math.floor(sleepMin / 60);
  const sleepM = sleepMin % 60;
  const bedtimeLabel = snapshot.sleepSession
    ? formatClockFromIso(snapshot.sleepSession.bedtimeIso)
    : '—';
  const wakeLabel = snapshot.sleepSession
    ? formatClockFromIso(snapshot.sleepSession.wakeTimeIso)
    : '—';

  const sleepSparkVals = useMemo(() => {
    const stages = snapshot.sleepSession?.stages ?? [];
    if (stages.length >= 6) {
      const levelMap = { deep: 22, light: 54, rem: 78, awake: 95 };
      return stages.slice(0, 14).map((s) => levelMap[s.stage]);
    }
    return [];
  }, [snapshot.sleepSession]);

  const hrvSparkVals = useMemo(() => {
    const recent = hrvObservations
      .filter((h) => h.date <= selectedDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-12)
      .map((h) => h.value);
    return recent.length >= 2 ? recent : [];
  }, [hrvObservations, selectedDate]);

  const hasStrain =
    (snapshot.trainingLoad.dailyStrain21 ?? 0) > 0 ||
    snapshot.trainingLoad.workouts.length > 0 ||
    Boolean(snapshot.activity);
  const strain21 = snapshot.trainingLoad.dailyStrain21 ?? 0;
  const strainPercent = Math.min(100, (strain21 / 21) * 100);
  const strainSubLabel = !hasStrain
    ? empty.noStrainYet
    : strain21 >= 17
      ? t.today.strainHigh
      : strain21 >= 11
        ? t.today.strainModerate
        : t.today.strainLight;

  const caloriePct = Math.min(
    100,
    Math.round((mealSummary.totalCalories / Math.max(1, nutritionTargets.caloriesKcal)) * 100)
  );

  const hasRecRange = Boolean(snapshot.recovery.recommendedStrainRange) && hasRecovery;
  const [recLow, recHigh] = snapshot.recovery.recommendedStrainRange ?? [0, 0];
  const lowPosPct = Math.min(94, Math.max(6, (recLow / 21) * 100));
  const highPosPct = Math.min(96, Math.max(lowPosPct + 6, (recHigh / 21) * 100));

  const greeting = getDynamicGreeting();
  const formattedDate = formatGermanFullDate(selectedDate);

  const last7Days = useMemo(() => {
    const base = new Date(`${todayKey}T12:00:00`);
    const days: { key: string; weekday: string; dayNum: string; isToday: boolean }[] = [];
    for (let offset = -6; offset <= 0; offset += 1) {
      const d = new Date(base.getTime());
      d.setDate(base.getDate() + offset);
      const key = toLocalDateKey(d);
      const weekday = new Intl.DateTimeFormat(bcp47, { weekday: 'short' })
        .format(d)
        .replace('.', '')
        .slice(0, 2);
      days.push({
        key,
        weekday,
        dayNum: String(d.getDate()),
        isToday: key === todayKey,
      });
    }
    return days;
  }, [todayKey, bcp47]);

  const rhrToday = snapshot.rhr?.value ?? snapshot.recovery.rhrToday;
  const respRate = snapshot.activity?.respiratoryRateBpm ?? null;
  const ewmaRatio = snapshot.trainingLoad.ewmaAcwr ?? snapshot.trainingLoad.acuteChronicRatio;

  const fitDiff = fitnessAge.differenceYears ?? 0;
  const fitBadgeText =
    fitDiff < 0
      ? `${formatNumberDE(Math.abs(fitDiff), 1)} ${t.today.youngerThanAge}`
      : fitDiff > 0
        ? `${formatNumberDE(fitDiff, 1)} ${t.today.olderThanAge}`
        : t.today.matchesAge;

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
            aria-label={t.nav.breathworkAction}
            title={t.nav.breathworkAction}
            className="hidden sm:inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-hairline)] px-3.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Wind className="w-3.5 h-3.5 text-[var(--accent-recovery)]" />
            <span>{t.nav.breathworkAction}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('more')}
            aria-label={t.today.profileSettings}
            className="w-11 h-11 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <User className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Interactive 7-Day Date Strip */}
      <nav
        aria-label="Letzte 7 Tage"
        className="flex items-center justify-between gap-1.5"
      >
        <div className="grid grid-cols-7 gap-1 flex-1">
          {last7Days.map((day) => {
            const active = day.key === selectedDate;
            return (
              <button
                key={day.key}
                type="button"
                onClick={() => {
                  if (!active) {
                    haptics.tick();
                    setSelectedDate(day.key);
                  }
                }}
                aria-pressed={active}
                className={`min-h-[48px] rounded-2xl flex flex-col items-center justify-center transition-colors border ${
                  active
                    ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)] border-transparent'
                    : 'bg-[var(--bg-surface)]/80 text-[var(--text-secondary)] border-[var(--border-hairline)] hover:text-[var(--text-primary)]'
                }`}
              >
                <span className="text-[10px] uppercase tracking-wide opacity-75 leading-none">
                  {day.weekday}
                </span>
                <span className="mt-1 text-[13.5px] font-semibold tabular-nums leading-none">
                  {day.dayNum}
                </span>
              </button>
            );
          })}
        </div>
        {selectedDate !== todayKey && (
          <button
            type="button"
            onClick={() => {
              haptics.selection();
              setSelectedDate(todayKey);
            }}
            className="shrink-0 min-h-[48px] px-3 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--text-primary)] hover:border-white/25 transition-colors"
          >
            {t.common.today}
          </button>
        )}
      </nav>

      {/* Daily Subjective Check-In (Collapses to 1-line summary once logged today) */}
      <DailyCheckInCard
        snapshot={snapshot}
        onExplain={onExplain}
        onOpenJournal={onOpenJournal}
      />

      {/* Fresh-Install Quick Start Banner (only shown while no wearable streams exist yet) */}
      {!hasAnyWearableData && (
        <div className="apple-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="min-w-0">
            <p className="text-[14.5px] font-semibold text-[var(--text-primary)]">
              {empty.startCardTitle}
            </p>
            <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary)] leading-relaxed">
              {empty.startCardDesc}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setDetailView('sources')}
              className="min-h-[38px] px-4 rounded-full bg-[var(--text-primary)] text-[var(--bg-canvas)] text-xs font-semibold hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              {empty.connectSourceBtn}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('nutrition')}
              className="min-h-[38px] px-4 rounded-full bg-[var(--bg-well)] text-[var(--text-primary)] text-xs font-medium hover:bg-[var(--bg-elevated)] transition-colors whitespace-nowrap"
            >
              {empty.logMealBtn}
            </button>
          </div>
        </div>
      )}

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
                      {t.today.recovery}
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
            {/* Quiet Unboxed Recovery Telemetry */}
            <div className="mt-3 pt-2.5 border-t border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--text-secondary)] tabular-nums">
              <div className="flex items-center gap-3 flex-wrap">
                <span>
                  HRV{' '}
                  <strong className="font-semibold text-[var(--text-primary)]">
                    {snapshot.recovery.hrvToday !== null ? `${snapshot.recovery.hrvToday} ms` : '—'}
                  </strong>
                </span>
                <span className="opacity-35">·</span>
                <span>
                  Ruhepuls{' '}
                  <strong className="font-semibold text-[var(--text-primary)]">
                    {rhrToday !== null ? `${rhrToday} bpm` : '—'}
                  </strong>
                </span>
                <span className="opacity-35">·</span>
                <span>
                  Schlaf{' '}
                  <strong className="font-semibold text-[var(--text-primary)]">
                    {sleepMin > 0 ? `${sleepH}h ${String(sleepM).padStart(2, '0')}m` : '—'}
                  </strong>
                </span>
              </div>
              <div className="flex items-center gap-1 ml-auto">
                <button
                  type="button"
                  onClick={() => setDetailView('recovery')}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] inline-flex items-center gap-0.5 transition-colors"
                >
                  <span>{t.today.recoveryDetails}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <InfoButton label={t.today.recovery} onClick={() => onExplain('recovery')} />
              </div>
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
                  {t.today.fitnessAge}
                </span>
              </button>
              <div className="flex items-center gap-0.5">
                <InfoButton label={t.today.fitnessAge} onClick={() => onExplain('fitnessAge')} />
                <button
                  type="button"
                  onClick={() => setDetailView('fitnessAge')}
                  aria-label={t.today.fitnessAge}
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
                <span className="serif-metric text-[20px] text-[var(--text-secondary)]">
                  {t.common.years}
                </span>
              </div>

              {fitnessAge.estimatedFitnessAge !== null ? (
                <span className="inline-flex items-center rounded-full bg-[var(--accent-recovery)]/14 border border-[var(--accent-recovery)]/25 px-3.5 py-1.5 text-xs font-medium text-[var(--accent-recovery)]">
                  {fitBadgeText}
                </span>
              ) : (
                <span className="text-[12px] text-[var(--text-muted)] max-w-[200px] leading-snug">
                  {empty.noFitnessAgeYet}
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
              title={t.today.recommendedToday}
              hasRange={hasRecRange}
              targetLabel={
                hasRecRange
                  ? `${t.today.strainTargetPrefix} ${recLow} ${t.today.strainTargetTo} ${recHigh}`
                  : empty.waitingForData
              }
              recLow={recLow}
              recHigh={recHigh}
              lowPosPct={lowPosPct}
              highPosPct={highPosPct}
              summaryText={hasRecRange ? t.today.strainTargetHint : empty.noRecommendedYet}
              workoutCompass={
                hasRecovery && snapshot.recommendation.recommendedWorkoutTitle
                  ? `${snapshot.recommendation.recommendedWorkoutTitle} · ${snapshot.recommendation.suggestedDurationMinutes} min · ${snapshot.recommendation.suggestedZoneLabel}`
                  : undefined
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
                  {t.today.sleep}
                </span>
              </button>
              <InfoButton
                label={t.today.sleep}
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
                {sleepSparkVals.length >= 2 ? (
                  <MiniAreaSparkline
                    values={sleepSparkVals}
                    color="#A78BFA"
                    leftLabel={bedtimeLabel}
                    rightLabel={wakeLabel}
                    height={34}
                  />
                ) : (
                  <p className="text-[11.5px] text-[var(--text-muted)] leading-snug">
                    {empty.noSleepYet}
                  </p>
                )}
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
                  {t.today.strain}
                </span>
              </button>
              <InfoButton
                label={t.today.strain}
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
                {hasStrain ? strain21.toFixed(1) : '—'}
              </div>
              <div className="mt-2 flex items-end justify-between gap-1.5">
                <p className="text-[11.5px] leading-snug text-[var(--text-secondary)]">
                  {strainSubLabel}
                </p>
                <CircularProgressRing
                  percent={hasStrain ? strainPercent : 0}
                  size={54}
                  strokeWidth={5.5}
                  color="var(--accent-strain)"
                >
                  <span className="text-[12.5px] font-semibold tabular-nums text-[var(--text-primary)]">
                    {hasStrain ? strain21.toFixed(1) : '—'}
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
                {hrvSparkVals.length >= 2 ? (
                  <MiniAreaSparkline
                    values={hrvSparkVals}
                    color="#60A5FA"
                    leftLabel="00:00"
                    rightLabel="24:00"
                    height={34}
                  />
                ) : (
                  <p className="text-[11.5px] text-[var(--text-muted)] leading-snug">
                    {empty.noHrvYet}
                  </p>
                )}
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
                  {t.today.calories}
                </span>
              </button>
              <InfoButton
                label={t.today.calories}
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
                  {caloriePct}% {t.today.ofDailyGoal}
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
          {/* Tile 5 (Full Width of Right Column): Vitals & EWMA Balance Strip */}
          <motion.div
            variants={staggerCardVariants}
            className="col-span-2 apple-card p-4"
          >
            <div className="grid grid-cols-3 divide-x divide-[var(--border-hairline)]">
              <div className="pr-3">
                <p className="text-[11px] text-[var(--text-secondary)]">Ruhepuls</p>
                <p className="mt-1 text-[17px] font-bold tabular-nums text-[var(--text-primary)] leading-tight">
                  {rhrToday !== null ? (
                    <>
                      {rhrToday}{' '}
                      <span className="text-[11px] font-medium text-[var(--text-muted)]">bpm</span>
                    </>
                  ) : (
                    '—'
                  )}
                </p>
              </div>
              <div className="px-3">
                <p className="text-[11px] text-[var(--text-secondary)]">Atemfrequenz</p>
                <p className="mt-1 text-[17px] font-bold tabular-nums text-[var(--text-primary)] leading-tight">
                  {respRate !== null ? (
                    <>
                      {formatNumberDE(respRate, 1)}{' '}
                      <span className="text-[11px] font-medium text-[var(--text-muted)]">/min</span>
                    </>
                  ) : (
                    '—'
                  )}
                </p>
              </div>
              <div className="pl-3">
                <p className="text-[11px] text-[var(--text-secondary)]">EWMA Balance</p>
                <p className="mt-1 text-[17px] font-bold tabular-nums text-[var(--text-primary)] leading-tight">
                  {ewmaRatio !== null ? formatNumberDE(ewmaRatio, 2) : '—'}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Mobile Bottom Card: Heute empfohlen */}
      <div className="lg:hidden apple-card p-5 transition-colors hover:border-white/[0.13]">
        <RecommendedStrainCardBody
          title={t.today.recommendedToday}
          hasRange={hasRecRange}
          targetLabel={
            hasRecRange
              ? `${t.today.strainTargetPrefix} ${recLow} ${t.today.strainTargetTo} ${recHigh}`
              : empty.waitingForData
          }
          recLow={recLow}
          recHigh={recHigh}
          lowPosPct={lowPosPct}
          highPosPct={highPosPct}
          summaryText={hasRecRange ? t.today.strainTargetHint : empty.noRecommendedYet}
          workoutCompass={
            hasRecovery && snapshot.recommendation.recommendedWorkoutTitle
              ? `${snapshot.recommendation.recommendedWorkoutTitle} · ${snapshot.recommendation.suggestedDurationMinutes} min · ${snapshot.recommendation.suggestedZoneLabel}`
              : undefined
          }
          onOpen={() => setActiveTab('activity')}
          onExplain={() => onExplain('strain21')}
        />
      </div>

      {/* Quiet Daily Insights List (only when signals produce real insights) */}
      {snapshot.insights.length > 0 && (
        <section className="apple-card p-5 space-y-2.5">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Heutige Erkenntnisse
          </h2>
          <div className="divide-y divide-[var(--border-hairline)]">
            {snapshot.insights.slice(0, 3).map((ins) => (
              <div key={ins.id} className="py-2.5 first:pt-0 last:pb-0">
                <p className="text-[14px] font-medium text-[var(--text-primary)]">{ins.title}</p>
                <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary)] leading-relaxed">
                  {ins.detail}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </motion.div>
  );
};

const RecommendedStrainCardBody: React.FC<{
  title: string;
  hasRange: boolean;
  targetLabel: string;
  recLow: number;
  recHigh: number;
  lowPosPct: number;
  highPosPct: number;
  summaryText: string;
  workoutCompass?: string;
  onOpen: () => void;
  onExplain: () => void;
}> = ({
  title,
  hasRange,
  targetLabel,
  recLow,
  recHigh,
  lowPosPct,
  highPosPct,
  summaryText,
  workoutCompass,
  onOpen,
  onExplain,
}) => (
  <div>
    <div className="flex items-center justify-between">
      <button type="button" onClick={onOpen} className="flex items-center gap-2 text-left">
        <BarChart3 className="w-4 h-4 text-[var(--text-secondary)]" />
        <span className="text-[14px] font-medium text-[var(--text-secondary)]">{title}</span>
      </button>
      <div className="flex items-center gap-0.5">
        <InfoButton label={title} onClick={onExplain} />
        <button
          type="button"
          onClick={onOpen}
          aria-label={title}
          className="p-1 text-[var(--text-muted)]"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>

    <button type="button" onClick={onOpen} className="mt-1.5 w-full text-left focus-visible:outline-none">
      <p className="text-[20px] font-bold tracking-tight text-[var(--text-primary)]">
        {targetLabel}
      </p>
      <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
        {summaryText}
      </p>
      {workoutCompass && (
        <p className="mt-2 pt-2 border-t border-[var(--border-hairline)] text-[12.5px] font-medium text-[var(--text-primary)]">
          Kompass: <span className="font-normal text-[var(--text-secondary)]">{workoutCompass}</span>
        </p>
      )}

      {hasRange && (
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
      )}
    </button>
  </div>
);
