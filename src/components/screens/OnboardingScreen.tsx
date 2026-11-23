import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  Flame,
  HeartPulse,
  Scale,
  TrendingDown,
  TrendingUp,
  UserRound,
  Watch,
  Droplets,
  Moon,
} from 'lucide-react';
import {
  DailyLifestyleNeat,
  DeviceProviderId,
  ManualActivityPal,
  NutritionGoalMode,
  UserProfile,
} from '../../types/health';
import { useHealthStore } from '../../store/useHealthStore';
import {
  calculateMifflinStJeorBMR,
  calculateNutritionTargets,
  MANUAL_PAL_MULTIPLIERS,
  NEAT_MULTIPLIERS,
} from '../../engine/nutrition';
import {
  calculateAgeFromBirthDate,
  calculateBmi,
  calculateWeightPlan,
  estimateMaxHrTanaka,
} from '../../utils/biometrics';
import { SUPPORTED_LOCALES, getActiveBcp47 } from '../../i18n/translations';
import { ONBOARDING_COPY } from '../../i18n/onboardingCopy';
import { useI18n } from '../../i18n/useI18n';
import { formatNumberDE } from '../../utils/formatters';
import { haptics } from '../../utils/haptics';
import { LiquidSlider } from '../ui/LiquidSlider';
import { AnimatedNumber, APPLE_EASE, SNAPPY_SPRING } from '../ui/MotionPrimitives';

const CUT_PACE_VALUES = [0.25, 0.5, 0.75, 1.0];
const BUILD_PACE_VALUES = [0.15, 0.25, 0.4];

const QUICK_PLATFORMS: { id: DeviceProviderId; label: string }[] = [
  { id: 'health_connect', label: 'Health Connect' },
  { id: 'apple_health', label: 'Apple Health' },
  { id: 'coros', label: 'COROS' },
  { id: 'garmin', label: 'Garmin' },
  { id: 'polar', label: 'Polar' },
];

export const OnboardingScreen: React.FC = () => {
  const { profile, completeOnboarding } = useHealthStore();
  const { t, locale, setLocale } = useI18n();
  const no = t.nutritionOnboarding;
  const copy = ONBOARDING_COPY[locale] ?? ONBOARDING_COPY.de;

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [direction, setDirection] = useState<1 | -1>(1);

  // Step 1: Identity & BirthDate
  const [displayName, setDisplayName] = useState<string>(profile.displayName || '');
  const [biologicalSex, setBiologicalSex] = useState<UserProfile['biologicalSex']>(
    profile.biologicalSex || 'male'
  );
  const [birthDate, setBirthDate] = useState<string>(profile.birthDate || '1998-06-15');

  // Step 2: Height & Current Weight (Liquid Sliders)
  const [heightCm, setHeightCm] = useState<number>(profile.heightCm || 176);
  const [weightKg, setWeightKg] = useState<number>(profile.weightKg || 74);

  // Step 3: Goal, Target Weight & Pace
  const [goalMode, setGoalMode] = useState<NutritionGoalMode>(
    profile.nutritionGoalMode || 'maintain'
  );
  const [targetWeightKg, setTargetWeightKg] = useState<number>(
    profile.targetWeightKg ?? profile.weightKg ?? 74
  );
  const [weeklyPaceKg, setWeeklyPaceKg] = useState<number>(() => {
    const abs = Math.abs(profile.weeklyWeightChangeKg ?? 0);
    if (abs > 0) return abs;
    return profile.nutritionGoalMode === 'build' ? 0.25 : 0.5;
  });

  // Step 4: Wearable Branch + NEAT / PAL
  const [usesWearable, setUsesWearable] = useState<boolean>(
    profile.usesWearableActiveCalories ?? true
  );
  const [dailyNeat, setDailyNeat] = useState<DailyLifestyleNeat>(
    profile.dailyLifestyleNeat || 'sedentary'
  );
  const [manualPal, setManualPal] = useState<ManualActivityPal>(
    profile.manualActivityPal || 'moderate'
  );
  const [selectedPlatforms, setSelectedPlatforms] = useState<DeviceProviderId[]>([]);

  const computedAge = useMemo(
    () => calculateAgeFromBirthDate(birthDate, profile.age || 25),
    [birthDate, profile.age]
  );
  const estimatedMaxHr = useMemo(() => estimateMaxHrTanaka(computedAge), [computedAge]);
  const liveBmi = useMemo(() => calculateBmi(weightKg, heightCm), [weightKg, heightCm]);
  const waterGoalLiters = useMemo(
    () => Number((Math.max(2200, Math.round(weightKg * 33)) / 1000).toFixed(1)),
    [weightKg]
  );

  const weightPlan = useMemo(
    () =>
      calculateWeightPlan({
        currentWeightKg: weightKg,
        targetWeightKg: goalMode === 'maintain' ? weightKg : targetWeightKg,
        goalMode,
        weeklyRateKg: goalMode === 'maintain' ? 0 : weeklyPaceKg,
      }),
    [weightKg, targetWeightKg, goalMode, weeklyPaceKg]
  );

  const draftProfile: UserProfile = useMemo(
    () => ({
      ...profile,
      displayName: displayName.trim() || 'Athlet',
      birthDate,
      age: computedAge,
      maxHr: estimatedMaxHr,
      biologicalSex,
      heightCm,
      weightKg,
      targetWeightKg: goalMode === 'maintain' ? weightKg : targetWeightKg,
      weeklyWeightChangeKg: weightPlan.weeklyWeightChangeKg,
      nutritionGoalMode: goalMode,
      nutritionGoalDeltaKcal: weightPlan.dailyKcalDelta,
      usesWearableActiveCalories: usesWearable,
      dailyLifestyleNeat: dailyNeat,
      manualActivityPal: manualPal,
      customCalorieTarget: undefined,
      goals:
        goalMode === 'build'
          ? ['build_muscle', 'increase_strength', 'improve_recovery']
          : goalMode === 'cut'
            ? ['long_term_health', 'improve_recovery', 'general_fitness']
            : ['long_term_health', 'improve_recovery'],
    }),
    [
      profile,
      displayName,
      birthDate,
      computedAge,
      estimatedMaxHr,
      biologicalSex,
      heightCm,
      weightKg,
      goalMode,
      targetWeightKg,
      weightPlan.weeklyWeightChangeKg,
      weightPlan.dailyKcalDelta,
      usesWearable,
      dailyNeat,
      manualPal,
    ]
  );

  const liveBmr = useMemo(() => calculateMifflinStJeorBMR(draftProfile), [draftProfile]);
  // Fresh install has 0 active calories until wearable syncs -> show honest base target
  const liveTargets = useMemo(
    () => calculateNutritionTargets(draftProfile, 0),
    [draftProfile]
  );

  const formattedGoalDate = useMemo(() => {
    if (!weightPlan.estimatedGoalDateIso) return null;
    const dt = new Date(`${weightPlan.estimatedGoalDateIso}T12:00:00`);
    return new Intl.DateTimeFormat(getActiveBcp47(locale), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(dt);
  }, [weightPlan.estimatedGoalDateIso, locale]);

  const rawUnclampedTarget = liveTargets.totalExpenditureKcal + liveTargets.goalDeltaKcal;
  const hitSafetyFloor = goalMode === 'cut' && rawUnclampedTarget < 1200;

  const handleSelectGoalMode = (mode: NutritionGoalMode) => {
    haptics.selection();
    setGoalMode(mode);
    if (mode === 'cut') {
      if (targetWeightKg >= weightKg) {
        setTargetWeightKg(Math.max(42, Number((weightKg - 5).toFixed(1))));
      }
      setWeeklyPaceKg(0.5);
    } else if (mode === 'build') {
      if (targetWeightKg <= weightKg) {
        setTargetWeightKg(Math.min(180, Number((weightKg + 4).toFixed(1))));
      }
      setWeeklyPaceKg(0.25);
    } else {
      setTargetWeightKg(weightKg);
      setWeeklyPaceKg(0);
    }
  };

  const togglePlatform = (id: DeviceProviderId) => {
    haptics.tick();
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const goTo = (next: 1 | 2 | 3 | 4 | 5) => {
    haptics.selection();
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const handleFinish = async () => {
    haptics.success();
    await completeOnboarding(
      {
        displayName: draftProfile.displayName,
        birthDate: draftProfile.birthDate,
        age: draftProfile.age,
        maxHr: draftProfile.maxHr,
        biologicalSex: draftProfile.biologicalSex,
        heightCm: draftProfile.heightCm,
        weightKg: draftProfile.weightKg,
        targetWeightKg: draftProfile.targetWeightKg,
        weeklyWeightChangeKg: draftProfile.weeklyWeightChangeKg,
        nutritionGoalMode: draftProfile.nutritionGoalMode,
        nutritionGoalDeltaKcal: draftProfile.nutritionGoalDeltaKcal,
        usesWearableActiveCalories: draftProfile.usesWearableActiveCalories,
        dailyLifestyleNeat: draftProfile.dailyLifestyleNeat,
        manualActivityPal: draftProfile.manualActivityPal,
        goals: draftProfile.goals,
        customCalorieTarget: undefined,
      },
      usesWearable ? selectedPlatforms : []
    );
  };

  const neatOptions: {
    id: DailyLifestyleNeat;
    title: string;
    desc: string;
    factor: number;
  }[] = [
    {
      id: 'sedentary',
      title: no.neatSedentary,
      desc: no.neatSedentaryDesc,
      factor: NEAT_MULTIPLIERS.sedentary,
    },
    {
      id: 'mixed',
      title: no.neatMixed,
      desc: no.neatMixedDesc,
      factor: NEAT_MULTIPLIERS.mixed,
    },
    {
      id: 'active_job',
      title: no.neatActive,
      desc: no.neatActiveDesc,
      factor: NEAT_MULTIPLIERS.active_job,
    },
  ];

  const palOptions: {
    id: ManualActivityPal;
    title: string;
    factor: number;
  }[] = [
    { id: 'sedentary', title: no.palSedentary, factor: MANUAL_PAL_MULTIPLIERS.sedentary },
    { id: 'light', title: no.palLight, factor: MANUAL_PAL_MULTIPLIERS.light },
    { id: 'moderate', title: no.palModerate, factor: MANUAL_PAL_MULTIPLIERS.moderate },
    { id: 'very_active', title: no.palVeryActive, factor: MANUAL_PAL_MULTIPLIERS.very_active },
    { id: 'athlete', title: no.palAthlete, factor: MANUAL_PAL_MULTIPLIERS.athlete },
  ];

  // Slider bounds for target weight depending on goal
  const targetMin = goalMode === 'build' ? Math.min(179, weightKg + 0.5) : 40;
  const targetMax = goalMode === 'cut' ? Math.max(41, weightKg - 0.5) : 180;
  const targetDiffKg = Number((targetWeightKg - weightKg).toFixed(1));

  return (
    <div className="min-h-dvh bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col">
      <div className="mx-auto w-full max-w-xl flex-1 flex flex-col justify-between px-4 sm:px-6 py-6 sm:py-10">
        {/* Top Brand, Step Progress & Compact Language Selector */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[12.5px] font-medium text-[var(--text-secondary)]">
              <span className="font-editorial text-[17px] font-semibold tracking-tight text-[var(--text-primary)]">
                KADENZ
              </span>
              <span className="text-[var(--text-muted)]">·</span>
              <span className="text-[var(--text-muted)] tabular-nums">
                {no.stepOf} {step} / 5
              </span>
            </div>

            {/* Quiet 5-language switcher right at first launch */}
            <div
              className="inline-flex items-center rounded-full bg-[var(--bg-well)] p-0.5 border border-[var(--border-hairline)]"
              role="radiogroup"
              aria-label={t.more.languageLabel}
            >
              {SUPPORTED_LOCALES.map((loc) => {
                const active = locale === loc.id;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      if (!active) {
                        haptics.selection();
                        setLocale(loc.id);
                      }
                    }}
                    className={`relative min-h-[28px] px-2.5 rounded-full text-[11px] font-semibold transition-colors ${
                      active
                        ? 'text-[var(--bg-canvas)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="onboardingLocalePill"
                        transition={SNAPPY_SPRING}
                        className="absolute inset-0 rounded-full bg-[var(--text-primary)]"
                      />
                    )}
                    <span className="relative z-10">{loc.shortCode}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5-segment progress track */}
          <div className="grid grid-cols-5 gap-1.5" aria-hidden="true">
            {([1, 2, 3, 4, 5] as const).map((n) => (
              <div
                key={n}
                className="h-[3px] rounded-full bg-[var(--bg-well)] overflow-hidden"
              >
                <motion.div
                  initial={false}
                  animate={{ scaleX: n <= step ? 1 : 0 }}
                  transition={{ duration: 0.32, ease: APPLE_EASE }}
                  style={{ transformOrigin: '0% 50%' }}
                  className="h-full w-full rounded-full bg-[var(--accent-calories)]"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Main Step Viewport */}
        <div className="flex-1 py-6">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            {/* ======================================================= */}
            {/* STEP 1: Welcome, Name, Sex & Date of Birth (Auto Age)   */}
            {/* ======================================================= */}
            {step === 1 && (
              <motion.div
                key="ob-step-1"
                custom={direction}
                initial={{ opacity: 0, x: direction * 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -18 }}
                transition={{ duration: 0.25, ease: APPLE_EASE }}
                className="space-y-5"
              >
                <div className="space-y-1.5">
                  <p className="text-[12px] font-medium text-[var(--accent-recovery)]">
                    {copy.welcomeKicker}
                  </p>
                  <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight text-[var(--text-primary)] leading-tight text-balance">
                    {copy.step1Title}
                  </h1>
                  <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
                    {copy.step1Sub}
                  </p>
                </div>

                <div className="apple-card p-5 space-y-5">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="ob-name"
                      className="block text-[12.5px] font-medium text-[var(--text-secondary)]"
                    >
                      {copy.nameLabel}
                    </label>
                    <input
                      id="ob-name"
                      type="text"
                      value={displayName}
                      placeholder={copy.namePlaceholder}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full min-h-[46px] rounded-2xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-4 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)]/40 transition-colors"
                    />
                  </div>

                  {/* Biological Sex */}
                  <div className="space-y-2">
                    <span className="block text-[12.5px] font-medium text-[var(--text-secondary)]">
                      {no.sex}
                    </span>
                    <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-[var(--bg-well)] p-1">
                      {(
                        [
                          { id: 'male', label: no.sexMale },
                          { id: 'female', label: no.sexFemale },
                          { id: 'diverse', label: no.sexDiverse },
                        ] as { id: UserProfile['biologicalSex']; label: string }[]
                      ).map((opt) => {
                        const active = biologicalSex === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              haptics.selection();
                              setBiologicalSex(opt.id);
                            }}
                            className={`relative min-h-[40px] rounded-[13px] text-xs font-semibold transition-colors ${
                              active
                                ? 'text-[var(--bg-canvas)]'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            {active && (
                              <motion.span
                                layoutId="obSexPill"
                                transition={SNAPPY_SPRING}
                                className="absolute inset-0 rounded-[13px] bg-[var(--text-primary)]"
                              />
                            )}
                            <span className="relative z-10">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Date of Birth -> Dynamic Age + Tanaka Max HR */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="ob-birthdate"
                        className="text-[12.5px] font-medium text-[var(--text-secondary)] inline-flex items-center gap-1.5"
                      >
                        <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        {copy.birthDateLabel}
                      </label>
                      <span className="text-[12px] font-semibold tabular-nums text-[var(--accent-recovery)]">
                        {computedAge} {copy.ageYearsSuffix}
                      </span>
                    </div>

                    <input
                      id="ob-birthdate"
                      type="date"
                      value={birthDate}
                      min="1930-01-01"
                      max="2012-12-31"
                      onChange={(e) => {
                        if (e.target.value) {
                          haptics.tick();
                          setBirthDate(e.target.value);
                        }
                      }}
                      className="w-full min-h-[48px] rounded-2xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-4 text-[15px] font-medium tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-[var(--text-primary)]/40 transition-colors"
                    />

                    <div className="flex items-center justify-between gap-2 pt-1 text-[11.5px] text-[var(--text-muted)]">
                      <span>{copy.autoAgeNote}</span>
                      <span className="tabular-nums text-[var(--text-secondary)]">
                        {copy.maxHrAutoLabel}: {estimatedMaxHr} bpm
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ======================================================= */}
            {/* STEP 2: Height & Current Weight (Liquid Glass Sliders)  */}
            {/* ======================================================= */}
            {step === 2 && (
              <motion.div
                key="ob-step-2"
                custom={direction}
                initial={{ opacity: 0, x: direction * 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -18 }}
                transition={{ duration: 0.25, ease: APPLE_EASE }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <h1 className="text-[28px] sm:text-[30px] font-bold tracking-tight text-[var(--text-primary)] leading-tight text-balance">
                    {copy.step2Title}
                  </h1>
                  <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
                    {copy.step2Sub}
                  </p>
                </div>

                <LiquidSlider
                  label={copy.heightLabel}
                  value={heightCm}
                  min={130}
                  max={225}
                  step={1}
                  unit="cm"
                  accentColor="var(--accent-hrv)"
                  onChange={setHeightCm}
                />

                <LiquidSlider
                  label={copy.weightLabel}
                  value={weightKg}
                  min={40}
                  max={180}
                  step={0.5}
                  decimals={1}
                  unit="kg"
                  accentColor="var(--accent-calories)"
                  onChange={(nextW) => {
                    setWeightKg(nextW);
                    if (goalMode === 'maintain') {
                      setTargetWeightKg(nextW);
                    } else if (goalMode === 'cut' && targetWeightKg >= nextW) {
                      setTargetWeightKg(Math.max(40, Number((nextW - 4).toFixed(1))));
                    } else if (goalMode === 'build' && targetWeightKg <= nextW) {
                      setTargetWeightKg(Math.min(180, Number((nextW + 4).toFixed(1))));
                    }
                  }}
                />

                {/* Quiet Live Biometric Readout */}
                <div className="apple-card p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[12px] text-[var(--text-muted)]">{no.liveBmrLabel}</p>
                    <p className="mt-0.5 text-[11.5px] text-[var(--text-secondary)] tabular-nums">
                      {copy.bmiLabel} {formatNumberDE(liveBmi, 1)} · {copy.waterGoalLabel}{' '}
                      {formatNumberDE(waterGoalLiters, 1)} L
                    </p>
                  </div>
                  <div className="flex items-baseline gap-1 shrink-0">
                    <AnimatedNumber
                      value={liveBmr}
                      className="serif-metric text-[30px] font-medium text-[var(--text-primary)] leading-none"
                    />
                    <span className="text-xs text-[var(--text-secondary)]">kcal</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ======================================================= */}
            {/* STEP 3: Goal, Target Weight & Pace Sliders              */}
            {/* ======================================================= */}
            {step === 3 && (
              <motion.div
                key="ob-step-3"
                custom={direction}
                initial={{ opacity: 0, x: direction * 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -18 }}
                transition={{ duration: 0.25, ease: APPLE_EASE }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <h1 className="text-[28px] sm:text-[30px] font-bold tracking-tight text-[var(--text-primary)] leading-tight text-balance">
                    {copy.step3Title}
                  </h1>
                  <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
                    {copy.step3Sub}
                  </p>
                </div>

                {/* 3 Goal Mode Cards */}
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      {
                        id: 'cut',
                        title: no.goalCut.split(' (')[0],
                        icon: TrendingDown,
                        accent: 'var(--accent-recovery)',
                      },
                      {
                        id: 'maintain',
                        title: no.goalMaintain.split(' ')[0],
                        icon: Scale,
                        accent: 'var(--accent-hrv)',
                      },
                      {
                        id: 'build',
                        title: no.goalBuild.split(' (')[0],
                        icon: TrendingUp,
                        accent: 'var(--accent-calories)',
                      },
                    ] as const
                  ).map((item) => {
                    const Icon = item.icon;
                    const active = goalMode === item.id;
                    return (
                      <motion.button
                        key={item.id}
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleSelectGoalMode(item.id)}
                        className={`apple-card p-3.5 flex flex-col items-center justify-center gap-2 text-center transition-colors ${
                          active
                            ? 'border-[var(--accent-calories)]/60 bg-[var(--bg-elevated)]'
                            : 'hover:border-white/[0.14]'
                        }`}
                      >
                        <span
                          className="w-9 h-9 rounded-2xl flex items-center justify-center"
                          style={{
                            backgroundColor: active
                              ? `color-mix(in srgb, ${item.accent} 18%, transparent)`
                              : 'var(--bg-well)',
                            color: active ? item.accent : 'var(--text-secondary)',
                          }}
                        >
                          <Icon className="w-4 h-4" />
                        </span>
                        <span className="text-[13px] font-semibold text-[var(--text-primary)] leading-tight">
                          {item.title}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Target Weight & Weekly Pace Sliders (for Cut / Build) */}
                <AnimatePresence initial={false}>
                  {goalMode !== 'maintain' && (
                    <motion.div
                      key={`goal-sliders-${goalMode}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.22, ease: APPLE_EASE }}
                      className="space-y-3.5"
                    >
                      <LiquidSlider
                        label={copy.targetWeightLabel}
                        subtitle={
                          Math.abs(targetDiffKg) < 0.2
                            ? copy.targetWeightReached
                            : `${targetDiffKg > 0 ? '+' : '−'}${formatNumberDE(Math.abs(targetDiffKg), 1)} kg ${
                                goalMode === 'cut'
                                  ? copy.targetWeightDiffCut
                                  : copy.targetWeightDiffBuild
                              }`
                        }
                        value={Math.max(targetMin, Math.min(targetMax, targetWeightKg))}
                        min={targetMin}
                        max={targetMax}
                        step={0.5}
                        decimals={1}
                        unit="kg"
                        accentColor={
                          goalMode === 'cut'
                            ? 'var(--accent-recovery)'
                            : 'var(--accent-calories)'
                        }
                        onChange={setTargetWeightKg}
                      />

                      <div className="space-y-2.5">
                        <LiquidSlider
                          label={goalMode === 'cut' ? copy.paceLabelCut : copy.paceLabelBuild}
                          subtitle={`${copy.dailyAdjustmentLabel}: ${
                            weightPlan.dailyKcalDelta < 0 ? '−' : '+'
                          }${formatNumberDE(Math.abs(weightPlan.dailyKcalDelta))} kcal`}
                          value={weeklyPaceKg}
                          valuePrefix={goalMode === 'cut' ? '−' : '+'}
                          min={goalMode === 'cut' ? 0.2 : 0.1}
                          max={goalMode === 'cut' ? 1.0 : 0.5}
                          step={0.05}
                          decimals={2}
                          unit={copy.paceUnit}
                          accentColor={
                            goalMode === 'cut'
                              ? 'var(--accent-recovery)'
                              : 'var(--accent-calories)'
                          }
                          onChange={setWeeklyPaceKg}
                        />

                        {/* Quick Pace Presets */}
                        <div
                          className={`grid gap-1.5 ${
                            goalMode === 'cut' ? 'grid-cols-4' : 'grid-cols-3'
                          }`}
                        >
                          {(goalMode === 'cut' ? CUT_PACE_VALUES : BUILD_PACE_VALUES).map(
                            (val, idx) => {
                              const active = Math.abs(weeklyPaceKg - val) < 0.03;
                              const label =
                                goalMode === 'cut'
                                  ? copy.pacePresetsCut[idx]
                                  : copy.pacePresetsBuild[idx];
                              return (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() => {
                                    haptics.selection();
                                    setWeeklyPaceKg(val);
                                  }}
                                  className={`min-h-[38px] rounded-xl px-2 py-1.5 text-[11.5px] font-medium transition-colors flex flex-col items-center justify-center ${
                                    active
                                      ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)]'
                                      : 'bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                  }`}
                                >
                                  <span className="leading-none">{label}</span>
                                  <span
                                    className={`text-[10px] tabular-nums mt-0.5 leading-none ${
                                      active
                                        ? 'text-[var(--bg-canvas)]/75'
                                        : 'text-[var(--text-muted)]'
                                    }`}
                                  >
                                    {formatNumberDE(val, 2)} kg
                                  </span>
                                </button>
                              );
                            }
                          )}
                        </div>

                        {/* Projected Goal Date Strip */}
                        {weightPlan.estimatedWeeksToGoal && formattedGoalDate && (
                          <div className="apple-card px-4 py-3 flex items-center justify-between gap-3 text-[12.5px]">
                            <span className="text-[var(--text-secondary)]">
                              {copy.projectedDurationLabel}
                            </span>
                            <span className="font-semibold tabular-nums text-[var(--text-primary)]">
                              ~{formatNumberDE(weightPlan.estimatedWeeksToGoal, 0)} {copy.weeksUnit}{' '}
                              · <span className="text-[var(--accent-recovery)]">{copy.projectedDatePrefix} {formattedGoalDate}</span>
                            </span>
                          </div>
                        )}

                        {hitSafetyFloor && (
                          <p className="px-1 text-[11.5px] text-[var(--accent-calories)] leading-snug">
                            {copy.floorSafetyNote}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* ======================================================= */}
            {/* STEP 4: Wearable vs. Manual PAL (Conditional Branching) */}
            {/* ======================================================= */}
            {step === 4 && (
              <motion.div
                key="ob-step-4"
                custom={direction}
                initial={{ opacity: 0, x: direction * 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -18 }}
                transition={{ duration: 0.25, ease: APPLE_EASE }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <h1 className="text-[28px] sm:text-[30px] font-bold tracking-tight text-[var(--text-primary)] leading-tight text-balance">
                    {copy.step4Title}
                  </h1>
                  <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
                    {copy.step4Sub}
                  </p>
                </div>

                {/* Binary Tracker Toggle */}
                <div className="space-y-2.5">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.985 }}
                    onClick={() => {
                      haptics.selection();
                      setUsesWearable(true);
                    }}
                    className={`w-full apple-card p-4 text-left transition-colors ${
                      usesWearable
                        ? 'border-[var(--accent-recovery)]/55 bg-[var(--bg-elevated)]'
                        : 'hover:border-white/[0.14]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                            usesWearable
                              ? 'bg-[var(--accent-recovery)]/18 text-[var(--accent-recovery)]'
                              : 'bg-[var(--bg-well)] text-[var(--text-secondary)]'
                          }`}
                        >
                          <Watch className="w-5 h-5" />
                        </span>
                        <div>
                          <p className="text-[15px] font-semibold text-[var(--text-primary)]">
                            {no.hasWearableTitle}
                          </p>
                          <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary)] leading-snug">
                            {no.hasWearableDesc}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${
                          usesWearable
                            ? 'bg-[var(--accent-recovery)] border-[var(--accent-recovery)] text-black'
                            : 'border-[var(--border-hairline)]'
                        }`}
                      >
                        {usesWearable && <Check className="w-3 h-3 stroke-[3]" />}
                      </span>
                    </div>
                  </motion.button>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.985 }}
                    onClick={() => {
                      haptics.selection();
                      setUsesWearable(false);
                    }}
                    className={`w-full apple-card p-4 text-left transition-colors ${
                      !usesWearable
                        ? 'border-[var(--accent-calories)]/55 bg-[var(--bg-elevated)]'
                        : 'hover:border-white/[0.14]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                            !usesWearable
                              ? 'bg-[var(--accent-calories)]/18 text-[var(--accent-calories)]'
                              : 'bg-[var(--bg-well)] text-[var(--text-secondary)]'
                          }`}
                        >
                          <UserRound className="w-5 h-5" />
                        </span>
                        <div>
                          <p className="text-[15px] font-semibold text-[var(--text-primary)]">
                            {no.noWearableTitle}
                          </p>
                          <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary)] leading-snug">
                            {no.noWearableDesc}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${
                          !usesWearable
                            ? 'bg-[var(--accent-calories)] border-[var(--accent-calories)] text-black'
                            : 'border-[var(--border-hairline)]'
                        }`}
                      >
                        {!usesWearable && <Check className="w-3 h-3 stroke-[3]" />}
                      </span>
                    </div>
                  </motion.button>
                </div>

                {/* Conditional Branch: NEAT (if wearable) vs PAL (only if NO wearable) */}
                <AnimatePresence mode="wait">
                  {usesWearable ? (
                    <motion.div
                      key="ob-branch-wearable"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.22, ease: APPLE_EASE }}
                      className="space-y-3"
                    >
                      <div className="apple-card p-4 space-y-2.5">
                        <div>
                          <p className="text-[14px] font-semibold text-[var(--text-primary)]">
                            {no.neatQuestion}
                          </p>
                          <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                            {no.neatHint}
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          {neatOptions.map((opt) => {
                            const active = dailyNeat === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  haptics.selection();
                                  setDailyNeat(opt.id);
                                }}
                                className={`w-full rounded-2xl px-3.5 py-2.5 text-left flex items-center justify-between gap-3 transition-colors ${
                                  active
                                    ? 'bg-[var(--accent-recovery)]/14 border border-[var(--accent-recovery)]/40'
                                    : 'bg-[var(--bg-well)] border border-transparent hover:border-[var(--border-hairline)]'
                                }`}
                              >
                                <div className="min-w-0">
                                  <p className="text-[13.5px] font-semibold text-[var(--text-primary)]">
                                    {opt.title}
                                  </p>
                                  <p className="text-[11.5px] text-[var(--text-secondary)]">
                                    {opt.desc}
                                  </p>
                                </div>
                                <span className="text-[11.5px] tabular-nums text-[var(--text-muted)] shrink-0">
                                  ×{formatNumberDE(opt.factor, 2)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Optional Platform Hint Selection */}
                      <div className="apple-card p-4 space-y-2.5">
                        <div>
                          <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                            {copy.preferredDevicesLabel}
                          </p>
                          <p className="text-[11.5px] text-[var(--text-muted)] mt-0.5">
                            {copy.preferredDevicesHint}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {QUICK_PLATFORMS.map((p) => {
                            const active = selectedPlatforms.includes(p.id);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => togglePlatform(p.id)}
                                className={`min-h-[34px] px-3 rounded-full text-[12px] font-medium transition-colors inline-flex items-center gap-1.5 ${
                                  active
                                    ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)]'
                                    : 'bg-[var(--bg-well)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                }`}
                              >
                                {active && <Check className="w-3 h-3" />}
                                <span>{p.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="ob-branch-manual"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.22, ease: APPLE_EASE }}
                      className="apple-card p-4 space-y-2.5"
                    >
                      <div>
                        <p className="text-[14px] font-semibold text-[var(--text-primary)]">
                          {no.palQuestion}
                        </p>
                        <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                          {no.palHint}
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        {palOptions.map((opt) => {
                          const active = manualPal === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                haptics.selection();
                                setManualPal(opt.id);
                              }}
                              className={`w-full rounded-2xl px-3.5 py-2.5 text-left flex items-center justify-between gap-3 transition-colors ${
                                active
                                  ? 'bg-[var(--accent-calories)]/14 border border-[var(--accent-calories)]/40'
                                  : 'bg-[var(--bg-well)] border border-transparent hover:border-[var(--border-hairline)]'
                              }`}
                            >
                              <span className="text-[13px] font-medium text-[var(--text-primary)]">
                                {opt.title}
                              </span>
                              <span className="text-[11.5px] tabular-nums text-[var(--text-muted)] shrink-0">
                                PAL {formatNumberDE(opt.factor, 2)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* ======================================================= */}
            {/* STEP 5: Complete Personal Plan Summary                  */}
            {/* ======================================================= */}
            {step === 5 && (
              <motion.div
                key="ob-step-5"
                custom={direction}
                initial={{ opacity: 0, x: direction * 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -18 }}
                transition={{ duration: 0.25, ease: APPLE_EASE }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <h1 className="text-[28px] sm:text-[30px] font-bold tracking-tight text-[var(--text-primary)] leading-tight text-balance">
                    {copy.step5Title}
                  </h1>
                  <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
                    {copy.step5Sub}
                  </p>
                </div>

                {/* Main Calorie & Macro Plan Card */}
                <div className="apple-card p-5 space-y-4">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-medium text-[var(--text-muted)]">
                        {usesWearable ? copy.basePlanLabel : no.formulaTotal}
                      </p>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <AnimatedNumber
                          value={liveTargets.caloriesKcal}
                          className="serif-metric text-[46px] font-medium leading-none text-[var(--text-primary)]"
                        />
                        <span className="serif-metric text-[17px] text-[var(--text-secondary)]">
                          kcal
                        </span>
                      </div>
                    </div>
                    <span className="text-[12px] font-semibold tabular-nums text-[var(--accent-recovery)]">
                      {liveTargets.goalDeltaKcal === 0
                        ? t.nutrition.maintainLabel
                        : `${liveTargets.goalDeltaKcal > 0 ? '+' : '−'}${formatNumberDE(
                            Math.abs(liveTargets.goalDeltaKcal)
                          )} kcal`}
                    </span>
                  </div>

                  {/* Transparent Formula Breakdown */}
                  <div className="pt-3 border-t border-[var(--border-hairline)] space-y-2 text-[13px] tabular-nums">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-secondary)]">{no.formulaBase}</span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {formatNumberDE(liveTargets.baseNeedKcal)} kcal
                      </span>
                    </div>
                    {usesWearable && (
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--text-secondary)]">{no.formulaActive}</span>
                        <span className="font-semibold text-[var(--accent-recovery)]">
                          +100 % live
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-secondary)]">{no.formulaGoal}</span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {liveTargets.goalDeltaKcal === 0
                          ? '±0 kcal'
                          : `${liveTargets.goalDeltaKcal > 0 ? '+' : '−'}${formatNumberDE(
                              Math.abs(liveTargets.goalDeltaKcal)
                            )} kcal`}
                      </span>
                    </div>
                  </div>

                  {/* 3 Macro Blocks */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="rounded-2xl bg-[var(--bg-well)] p-3 text-center">
                      <p className="text-[11px] text-[var(--text-muted)]">{t.nutrition.protein}</p>
                      <p className="mt-1 text-[16px] font-bold tabular-nums text-[var(--accent-recovery)]">
                        {liveTargets.proteinG} g
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[var(--bg-well)] p-3 text-center">
                      <p className="text-[11px] text-[var(--text-muted)]">{t.nutrition.carbs}</p>
                      <p className="mt-1 text-[16px] font-bold tabular-nums text-[var(--accent-hrv)]">
                        {liveTargets.carbsG} g
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[var(--bg-well)] p-3 text-center">
                      <p className="text-[11px] text-[var(--text-muted)]">{t.nutrition.fat}</p>
                      <p className="mt-1 text-[16px] font-bold tabular-nums text-[var(--accent-calories)]">
                        {liveTargets.fatG} g
                      </p>
                    </div>
                  </div>

                  {usesWearable && (
                    <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                      {copy.wearableLiveBonusNote}
                    </p>
                  )}
                </div>

                {/* Weight Roadmap & Biometric Profile Card */}
                <div className="apple-card p-4 divide-y divide-[var(--border-hairline)] text-[13px]">
                  {goalMode !== 'maintain' && (
                    <div className="pb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 text-[var(--text-secondary)]">
                        <Flame className="w-4 h-4 text-[var(--accent-calories)] shrink-0" />
                        <span>{copy.weightRoadmapTitle}</span>
                      </div>
                      <div className="text-right tabular-nums">
                        <span className="font-semibold text-[var(--text-primary)]">
                          {formatNumberDE(weightKg, 1)} → {formatNumberDE(targetWeightKg, 1)} kg
                        </span>
                        {formattedGoalDate && (
                          <p className="text-[11px] text-[var(--accent-recovery)]">
                            {copy.projectedDatePrefix} {formattedGoalDate}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div
                    className={`${
                      goalMode !== 'maintain' ? 'pt-3' : ''
                    } flex items-center justify-between gap-3`}
                  >
                    <div className="flex items-center gap-2.5 text-[var(--text-secondary)]">
                      <HeartPulse className="w-4 h-4 text-[var(--accent-strain)] shrink-0" />
                      <span>{copy.healthProfileTitle}</span>
                    </div>
                    <span className="font-medium tabular-nums text-[var(--text-primary)]">
                      {computedAge} {copy.ageYearsSuffix} · {heightCm} cm · Max-HF {estimatedMaxHr}
                    </span>
                  </div>

                  <div className="pt-3 mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-4 text-[var(--text-secondary)]">
                      <span className="inline-flex items-center gap-1.5">
                        <Droplets className="w-3.5 h-3.5 text-[var(--accent-hrv)]" />
                        {formatNumberDE(waterGoalLiters, 1)} L
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Moon className="w-3.5 h-3.5 text-[var(--accent-sleep)]" />
                        8,0 h
                      </span>
                    </div>
                    <span className="text-[11.5px] text-[var(--text-muted)]">
                      {t.nutrition.fiber} {liveTargets.fiberG} g
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sticky Ergonomic Bottom Action Bar */}
        <div className="pt-2 pb-safe flex items-center justify-between gap-3">
          {step > 1 ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => goTo((step - 1) as 1 | 2 | 3 | 4 | 5)}
              className="min-h-[48px] px-5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t.common.back}</span>
            </motion.button>
          ) : (
            <div />
          )}

          {step < 5 ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => goTo((step + 1) as 1 | 2 | 3 | 4 | 5)}
              className="min-h-[48px] px-7 rounded-full bg-[var(--text-primary)] text-[var(--bg-canvas)] text-sm font-semibold inline-flex items-center gap-2 hover:opacity-92 transition-opacity"
            >
              <span>{t.common.next}</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          ) : (
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={handleFinish}
              className="min-h-[50px] px-7 rounded-full bg-[var(--accent-calories)] text-[#090A0C] text-sm font-bold inline-flex items-center gap-2 shadow-lg shadow-[var(--accent-calories)]/20 hover:opacity-95 transition-opacity"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{copy.startAppCta}</span>
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
};
