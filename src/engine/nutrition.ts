import {
  AdaptiveCalorieCoach,
  BodyMeasurement,
  DailyLifestyleNeat,
  ManualActivityPal,
  MealCategory,
  MealEntry,
  NutritionTargets,
  UserProfile,
  WeightTrendPoint,
} from '../types/health';
import { calculateWeightPlan, getEffectiveAge } from '../utils/biometrics';
import { addDaysToKey, formatGermanShortDate, formatNumberDE } from '../utils/formatters';

export const NEAT_MULTIPLIERS: Record<DailyLifestyleNeat, number> = {
  sedentary: 1.2,
  mixed: 1.35,
  active_job: 1.5,
};

export const MANUAL_PAL_MULTIPLIERS: Record<ManualActivityPal, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
  athlete: 1.9,
};

/**
 * Standard Atwater calorie formula (4 kcal/g protein, 4 kcal/g carbs, 9 kcal/g fat).
 * Used as fallback when a user enters macros without typing explicit calories.
 */
export function computeAtwaterCalories(proteinG: number, carbsG: number, fatG: number): number {
  const p = Math.max(0, Number(proteinG) || 0);
  const c = Math.max(0, Number(carbsG) || 0);
  const f = Math.max(0, Number(fatG) || 0);
  return Math.round(p * 4 + c * 4 + f * 9);
}

/**
 * Mifflin-St Jeor (1990) Basal Metabolic Rate (BMR) in kcal/day.
 * Clinically validated gold-standard equation using exact auto-computed age.
 */
export function calculateMifflinStJeorBMR(
  profile: Pick<UserProfile, 'weightKg' | 'heightCm' | 'age' | 'birthDate' | 'biologicalSex'>,
  referenceDate: Date = new Date()
): number {
  const weight = Math.max(35, profile.weightKg || 72);
  const height = Math.max(130, profile.heightCm || 175);
  const age = getEffectiveAge(profile, referenceDate);

  const base = 10 * weight + 6.25 * height - 5 * age;
  if (profile.biologicalSex === 'male') return Math.round(base + 5);
  if (profile.biologicalSex === 'female') return Math.round(base - 161);
  return Math.round(base - 78);
}

/**
 * Evidence-based Daily Calorie & Macro Targets:
 * - Wearable Mode (`usesWearableActiveCalories !== false`):
 *   Base Need (BMR * NEAT) + 100% of active calories burned from sports/movement + Goal Delta (-deficit / 0 / +surplus).
 *   Guarantees the user hits their exact chosen deficit or surplus even on hard training days.
 * - No-Tracker Mode (`usesWearableActiveCalories === false`):
 *   BMR * Manual PAL + Goal Delta (no double counting).
 * - Protein: ISSN Position Stand (1.8–2.1 g/kg; higher in deficit to preserve lean mass).
 * - Fat: ~27–30% of calories (minimum 0.7 g/kg for hormonal health).
 * - Carbs: Remaining calories.
 * - Fiber: 14 g per 1,000 kcal (DGE / IOM guideline).
 */
export function calculateNutritionTargets(
  profile: UserProfile,
  activeCaloriesToday = 0,
  referenceDate: Date = new Date()
): NutritionTargets {
  const bmrKcal = calculateMifflinStJeorBMR(profile, referenceDate);
  const goalMode = profile.nutritionGoalMode ?? 'maintain';
  const usesWearableActiveCalories = profile.usesWearableActiveCalories !== false;
  const safeActive = Math.max(0, Math.round(activeCaloriesToday || 0));

  const neat: DailyLifestyleNeat = profile.dailyLifestyleNeat ?? 'sedentary';
  const pal: ManualActivityPal = profile.manualActivityPal ?? 'moderate';

  const baseNeedKcal = usesWearableActiveCalories
    ? Math.round(bmrKcal * NEAT_MULTIPLIERS[neat])
    : Math.round(bmrKcal * MANUAL_PAL_MULTIPLIERS[pal]);

  const activeBonusKcal = usesWearableActiveCalories ? safeActive : 0;
  const totalExpenditureKcal = baseNeedKcal + activeBonusKcal;

  const weightPlan = calculateWeightPlan({
    currentWeightKg: profile.weightKg,
    targetWeightKg: profile.targetWeightKg,
    goalMode,
    weeklyRateKg: profile.weeklyWeightChangeKg,
    referenceDate,
  });

  const rawGoalDelta =
    typeof profile.nutritionGoalDeltaKcal === 'number' && Number.isFinite(profile.nutritionGoalDeltaKcal)
      ? Math.round(profile.nutritionGoalDeltaKcal)
      : weightPlan.dailyKcalDelta;

  const goalDeltaKcal =
    goalMode === 'maintain'
      ? 0
      : goalMode === 'cut'
        ? -Math.abs(rawGoalDelta)
        : Math.abs(rawGoalDelta);

  // Safety floor: 1,200 kcal base + 100% active calories so intense training is still fueled safely
  const safetyFloor = 1200 + activeBonusKcal;
  const computedTarget = Math.max(safetyFloor, totalExpenditureKcal + goalDeltaKcal);
  const caloriesKcal =
    typeof profile.customCalorieTarget === 'number' && profile.customCalorieTarget >= 1200
      ? Math.round(profile.customCalorieTarget) + activeBonusKcal
      : computedTarget;

  const weight = Math.max(40, profile.weightKg || 72);
  const proteinPerKg = goalMode === 'cut' ? 2.1 : goalMode === 'build' ? 1.9 : 1.8;
  const proteinG = Math.round(weight * proteinPerKg);

  const minFatG = Math.round(weight * 0.7);
  const targetFatG = Math.round((caloriesKcal * 0.27) / 9);
  const fatG = Math.max(minFatG, targetFatG);

  const remainingForCarbsKcal = Math.max(0, caloriesKcal - proteinG * 4 - fatG * 9);
  const carbsG = Math.round(remainingForCarbsKcal / 4);
  const fiberG = Math.max(20, Math.round((caloriesKcal / 1000) * 14));

  return {
    caloriesKcal,
    proteinG,
    carbsG,
    fatG,
    fiberG,
    bmrKcal,
    baseNeedKcal,
    activeBonusKcal,
    totalExpenditureKcal,
    goalDeltaKcal,
    usesWearableActiveCalories,
    goalMode,
    weeklyWeightChangeKg: weightPlan.weeklyWeightChangeKg,
    estimatedWeeksToGoal: weightPlan.estimatedWeeksToGoal,
    estimatedGoalDateIso: weightPlan.estimatedGoalDateIso,
  };
}

export interface DailyMealSummary {
  totalCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  byCategory: Record<MealCategory, MealEntry[]>;
  mealCount: number;
}

export function summarizeMealsForDate(meals: MealEntry[], dateKey: string): DailyMealSummary {
  const byCategory: Record<MealCategory, MealEntry[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };

  let totalCalories = 0;
  let proteinG = 0;
  let carbsG = 0;
  let fatG = 0;
  let fiberG = 0;

  const todaysMeals = meals
    .filter((m) => m.date === dateKey)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  for (const meal of todaysMeals) {
    const cat: MealCategory = byCategory[meal.category] ? meal.category : 'snack';
    byCategory[cat].push(meal);
    totalCalories += Math.max(0, Math.round(meal.totalCalories || 0));
    proteinG += Math.max(0, Number(meal.proteinG || 0));
    carbsG += Math.max(0, Number(meal.carbsG || 0));
    fatG += Math.max(0, Number(meal.fatG || 0));
    fiberG += Math.max(0, Number(meal.fiberG || 0));
  }

  return {
    totalCalories: Math.round(totalCalories),
    proteinG: Math.round(proteinG),
    carbsG: Math.round(carbsG),
    fatG: Math.round(fatG),
    fiberG: Math.round(fiberG),
    byCategory,
    mealCount: todaysMeals.length,
  };
}

export function inferMealCategoryByHour(date: Date = new Date()): MealCategory {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 17 && hour < 22) return 'dinner';
  return 'snack';
}

/**
 * MacroFactor-inspired EWMA Weight Trend & Neutral, Guilt-Free Adaptive Calorie Coach.
 * - Smooths noisy daily scale weights with Exponentially Weighted Moving Average (alpha = 0.25)
 * - Estimates real weekly weight trend rate & adaptive TDEE once >= 7 weight + 7 meal days exist
 * - Suggests damped, neutral calorie adjustments clamped to ±200 kcal/week (requires user tap)
 */
export function computeWeightTrendAndCoach(
  bodyMeasurements: BodyMeasurement[],
  meals: MealEntry[],
  profile: UserProfile,
  referenceDateKey: string,
  windowDays = 21
): AdaptiveCalorieCoach {
  const minRequiredDays = 7;
  const targets = calculateNutritionTargets(profile, 0);
  const targetWeeklyRateKg =
    profile.nutritionGoalMode === 'maintain'
      ? 0
      : targets.weeklyWeightChangeKg;

  // Deduplicate measurements per date (keep latest timestamp)
  const weightByDate = new Map<string, BodyMeasurement>();
  for (const m of bodyMeasurements) {
    if (!Number.isFinite(m.weightKg) || m.weightKg < 30 || m.weightKg > 300) continue;
    if (m.date > referenceDateKey) continue;
    const prev = weightByDate.get(m.date);
    if (!prev || m.timestamp >= prev.timestamp) {
      weightByDate.set(m.date, m);
    }
  }

  const allSortedDates = Array.from(weightByDate.keys()).sort();
  if (allSortedDates.length === 0) {
    return {
      points: [],
      latestRawWeightKg: null,
      latestTrendWeightKg: null,
      weeklyTrendRateKg: null,
      targetWeeklyRateKg,
      loggedWeightDays14d: 0,
      loggedMealDays14d: 0,
      minRequiredDays,
      hasEnoughData: false,
      avgDailyIntakeKcal: null,
      estimatedTdeeKcal: null,
      suggestedAdjustmentKcal: 0,
      suggestedDailyTargetKcal: null,
      status: 'collecting',
      headline: 'Gewichtstrend wird aufgebaut',
      summary:
        'Wiege dich regelmäßig (mind. 7 Tage) und erfasse deine Mahlzeiten — dann glättet KADENZ Wasserschwankungen und berechnet deinen realen Bedarf.',
    };
  }

  // Compute daily EWMA trend across the full observed span up to referenceDateKey
  const startDate = allSortedDates[0];
  const alpha = 0.25;
  let ewma = weightByDate.get(startDate)!.weightKg;
  const trendByDate = new Map<string, number>();

  // Cap iteration span to 120 days prior to referenceDateKey for performance
  const earliestAllowed = addDaysToKey(referenceDateKey, -120);
  const iterStart = startDate < earliestAllowed ? earliestAllowed : startDate;

  // Seed EWMA from the latest weight on or before iterStart
  const seedDate = allSortedDates.filter((d) => d <= iterStart).pop() ?? startDate;
  ewma = weightByDate.get(seedDate)!.weightKg;

  let cursor = iterStart;
  let guard = 0;
  while (cursor <= referenceDateKey && guard < 150) {
    const obs = weightByDate.get(cursor);
    if (obs) {
      ewma = alpha * obs.weightKg + (1 - alpha) * ewma;
    }
    trendByDate.set(cursor, Number(ewma.toFixed(2)));
    cursor = addDaysToKey(cursor, 1);
    guard++;
  }

  // Build display points for the last `windowDays`
  const points: WeightTrendPoint[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const dk = addDaysToKey(referenceDateKey, -i);
    const trend = trendByDate.get(dk);
    if (trend === undefined) continue;
    points.push({
      date: dk,
      label: formatGermanShortDate(dk),
      rawWeightKg: weightByDate.get(dk)?.weightKg ?? null,
      trendWeightKg: trend,
    });
  }

  const latestDate = allSortedDates[allSortedDates.length - 1];
  const latestRawWeightKg = weightByDate.get(latestDate)?.weightKg ?? null;
  const latestTrendWeightKg = trendByDate.get(referenceDateKey) ?? trendByDate.get(latestDate) ?? null;

  // Count distinct logged weight & meal days in the last 14 days
  const start14 = addDaysToKey(referenceDateKey, -13);
  const loggedWeightDays14d = allSortedDates.filter(
    (d) => d >= start14 && d <= referenceDateKey
  ).length;

  const dailyKcalMap = new Map<string, number>();
  for (const meal of meals) {
    if (meal.date < start14 || meal.date > referenceDateKey) continue;
    dailyKcalMap.set(meal.date, (dailyKcalMap.get(meal.date) ?? 0) + Math.max(0, meal.totalCalories));
  }
  const mealDayValues = Array.from(dailyKcalMap.values()).filter((v) => v >= 400);
  const loggedMealDays14d = mealDayValues.length;

  // Weekly trend rate: prefer 14-day delta / 2, fallback to 7-day delta
  const trend7Ago = trendByDate.get(addDaysToKey(referenceDateKey, -7));
  const trend14Ago = trendByDate.get(addDaysToKey(referenceDateKey, -14));
  let weeklyTrendRateKg: number | null = null;
  if (latestTrendWeightKg !== null) {
    if (trend14Ago !== undefined && loggedWeightDays14d >= 5) {
      weeklyTrendRateKg = Number(((latestTrendWeightKg - trend14Ago) / 2).toFixed(2));
    } else if (trend7Ago !== undefined && loggedWeightDays14d >= 3) {
      weeklyTrendRateKg = Number((latestTrendWeightKg - trend7Ago).toFixed(2));
    }
  }

  const hasEnoughData =
    loggedWeightDays14d >= minRequiredDays &&
    loggedMealDays14d >= minRequiredDays &&
    weeklyTrendRateKg !== null;

  if (!hasEnoughData) {
    return {
      points,
      latestRawWeightKg,
      latestTrendWeightKg,
      weeklyTrendRateKg,
      targetWeeklyRateKg,
      loggedWeightDays14d,
      loggedMealDays14d,
      minRequiredDays,
      hasEnoughData: false,
      avgDailyIntakeKcal:
        mealDayValues.length > 0
          ? Math.round(mealDayValues.reduce((a, b) => a + b, 0) / mealDayValues.length)
          : null,
      estimatedTdeeKcal: null,
      suggestedAdjustmentKcal: 0,
      suggestedDailyTargetKcal: null,
      status: 'collecting',
      headline: `Noch ${Math.max(
        0,
        minRequiredDays - Math.min(loggedWeightDays14d, loggedMealDays14d)
      )} Tage bis zur adaptiven Anpassung`,
      summary: `Erfasst in 14 Tagen: ${loggedWeightDays14d}/${minRequiredDays} Gewichtstage · ${loggedMealDays14d}/${minRequiredDays} Essenstage. Ab 7 Tagen berechnet der Coach deinen realen Umsatz neutral nach.`,
    };
  }

  const avgDailyIntakeKcal = Math.round(
    mealDayValues.reduce((a, b) => a + b, 0) / mealDayValues.length
  );
  // 1 kg body weight change ≈ 7,700 kcal => daily balance = weeklyRate * 1100 kcal/day
  const observedDailyBalanceKcal = Math.round(weeklyTrendRateKg! * 1100);
  const estimatedTdeeKcal = Math.max(
    1200,
    Math.min(5500, avgDailyIntakeKcal - observedDailyBalanceKcal)
  );

  // Neutral adaptive adjustment: compare actual weekly trend vs target weekly rate
  // Negative diff means losing faster than planned (or gaining slower) => suggest positive kcal adjustment
  const rateErrorKgPerWeek = targetWeeklyRateKg - weeklyTrendRateKg!;
  const rawAdjustmentKcal = Math.round((rateErrorKgPerWeek * 1100) / 10) * 10;
  // Deadband ±50 kcal to avoid noise; damp maximum step to ±200 kcal/week
  const suggestedAdjustmentKcal =
    Math.abs(rawAdjustmentKcal) < 50
      ? 0
      : Math.max(-200, Math.min(200, rawAdjustmentKcal));

  const currentBaseTarget = Math.max(1200, targets.caloriesKcal);
  const suggestedDailyTargetKcal = Math.max(1200, currentBaseTarget + suggestedAdjustmentKcal);

  let status: AdaptiveCalorieCoach['status'] = 'on_track';
  let headline = 'Perfekt auf Kurs';
  let summary = `Dein geglätteter Trend liegt bei ${weeklyTrendRateKg! >= 0 ? '+' : ''}${formatNumberDE(
    weeklyTrendRateKg!,
    2
  )} kg/Woche — genau passend zu deinem Ziel (${targetWeeklyRateKg >= 0 ? '+' : ''}${formatNumberDE(
    targetWeeklyRateKg,
    2
  )} kg/Wo.). Keine Anpassung nötig.`;

  if (suggestedAdjustmentKcal > 0) {
    status = profile.nutritionGoalMode === 'cut' ? 'faster_than_goal' : 'slower_than_goal';
    headline = `Vorschlag: +${suggestedAdjustmentKcal} kcal / Tag`;
    summary =
      profile.nutritionGoalMode === 'cut'
        ? `Dein Trend sinkt schneller als geplant (${formatNumberDE(
            weeklyTrendRateKg!,
            2
          )} statt ${formatNumberDE(
            targetWeeklyRateKg,
            2
          )} kg/Wo.). +${suggestedAdjustmentKcal} kcal/Tag schützen Muskelmasse und Energie.`
        : `Dein Gewichtstrend liegt unter deinem Zieltempo (${formatNumberDE(
            weeklyTrendRateKg!,
            2
          )} statt +${formatNumberDE(
            targetWeeklyRateKg,
            2
          )} kg/Wo.). +${suggestedAdjustmentKcal} kcal/Tag bringen dich entspannt ins Ziel.`;
  } else if (suggestedAdjustmentKcal < 0) {
    status = profile.nutritionGoalMode === 'build' ? 'faster_than_goal' : 'slower_than_goal';
    headline = `Vorschlag: ${suggestedAdjustmentKcal} kcal / Tag`;
    summary = `Dein geglätteter Trend liegt bei ${weeklyTrendRateKg! >= 0 ? '+' : ''}${formatNumberDE(
      weeklyTrendRateKg!,
      2
    )} kg/Wo. (Ziel: ${targetWeeklyRateKg >= 0 ? '+' : ''}${formatNumberDE(
      targetWeeklyRateKg,
      2
    )} kg/Wo.). Eine ruhige Anpassung um ${suggestedAdjustmentKcal} kcal/Tag hält deinen Plan präzise.`;
  }

  return {
    points,
    latestRawWeightKg,
    latestTrendWeightKg,
    weeklyTrendRateKg,
    targetWeeklyRateKg,
    loggedWeightDays14d,
    loggedMealDays14d,
    minRequiredDays,
    hasEnoughData: true,
    avgDailyIntakeKcal,
    estimatedTdeeKcal,
    suggestedAdjustmentKcal,
    suggestedDailyTargetKcal,
    status,
    headline,
    summary,
  };
}
