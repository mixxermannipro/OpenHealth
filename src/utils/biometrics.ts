import { NutritionGoalMode, UserProfile } from '../types/health';

/**
 * Exact chronological age from an ISO date of birth (YYYY-MM-DD).
 * Always recomputes cleanly against the current date so birthdays roll over automatically.
 */
export function calculateAgeFromBirthDate(
  birthDate?: string,
  fallbackAge = 25,
  referenceDate: Date = new Date()
): number {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return Math.max(14, Math.min(100, Math.round(fallbackAge || 25)));
  }

  const [yStr, mStr, dStr] = birthDate.split('-');
  const birthYear = Number(yStr);
  const birthMonth = Number(mStr);
  const birthDay = Number(dStr);

  if (
    !Number.isFinite(birthYear) ||
    !Number.isFinite(birthMonth) ||
    !Number.isFinite(birthDay) ||
    birthYear < 1915 ||
    birthYear > referenceDate.getFullYear()
  ) {
    return Math.max(14, Math.min(100, Math.round(fallbackAge || 25)));
  }

  let age = referenceDate.getFullYear() - birthYear;
  const currentMonth = referenceDate.getMonth() + 1;
  const currentDay = referenceDate.getDate();

  if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDay < birthDay)) {
    age -= 1;
  }

  return Math.max(14, Math.min(100, age));
}

export function getEffectiveAge(
  profile: Pick<UserProfile, 'birthDate' | 'age'>,
  referenceDate: Date = new Date()
): number {
  return calculateAgeFromBirthDate(profile.birthDate, profile.age, referenceDate);
}

/**
 * Tanaka et al. (JACC 2001) age-predicted Maximum Heart Rate:
 * HRmax = 208 − 0.7 × age (significantly more accurate than 220 − age across adult cohorts).
 */
export function estimateMaxHrTanaka(age: number): number {
  const safeAge = Math.max(14, Math.min(100, age || 25));
  return Math.max(140, Math.min(215, Math.round(208 - 0.7 * safeAge)));
}

export function calculateBmi(weightKg: number, heightCm: number): number {
  const hM = Math.max(1.2, (heightCm || 175) / 100);
  const w = Math.max(30, weightKg || 72);
  return Number((w / (hM * hM)).toFixed(1));
}

export interface WeightPlanEstimate {
  goalMode: NutritionGoalMode;
  weightDeltaKg: number; // target - current (negative when losing)
  weeklyWeightChangeKg: number; // signed kg/week
  dailyKcalDelta: number; // signed kcal/day (~1100 kcal/day per 1.0 kg/week using 7700 kcal/kg)
  estimatedWeeksToGoal: number | null;
  estimatedGoalDateIso: string | null;
}

const KCAL_PER_KG_TISSUE = 7700;

export function calculateWeightPlan(params: {
  currentWeightKg: number;
  targetWeightKg?: number;
  goalMode: NutritionGoalMode;
  weeklyRateKg?: number; // unsigned or signed kg/week
  referenceDate?: Date;
}): WeightPlanEstimate {
  const { currentWeightKg, goalMode, referenceDate = new Date() } = params;
  const current = Math.max(35, currentWeightKg || 72);
  const target =
    typeof params.targetWeightKg === 'number' && Number.isFinite(params.targetWeightKg)
      ? Math.max(35, Math.min(220, params.targetWeightKg))
      : current;

  if (goalMode === 'maintain') {
    return {
      goalMode: 'maintain',
      weightDeltaKg: 0,
      weeklyWeightChangeKg: 0,
      dailyKcalDelta: 0,
      estimatedWeeksToGoal: null,
      estimatedGoalDateIso: null,
    };
  }

  const rawRate = Math.abs(params.weeklyRateKg ?? (goalMode === 'cut' ? 0.5 : 0.25));
  const clampedRate =
    goalMode === 'cut'
      ? Math.max(0.15, Math.min(1.0, Number(rawRate.toFixed(2))))
      : Math.max(0.1, Math.min(0.6, Number(rawRate.toFixed(2))));

  const weeklyWeightChangeKg = goalMode === 'cut' ? -clampedRate : clampedRate;
  const dailyKcalDelta = Math.round((weeklyWeightChangeKg * KCAL_PER_KG_TISSUE) / 7);
  const weightDeltaKg = Number((target - current).toFixed(1));

  // Only estimate timeline when target direction matches goal direction
  const distanceInGoalDir =
    goalMode === 'cut' ? Math.max(0, current - target) : Math.max(0, target - current);

  if (distanceInGoalDir < 0.2) {
    return {
      goalMode,
      weightDeltaKg,
      weeklyWeightChangeKg,
      dailyKcalDelta,
      estimatedWeeksToGoal: null,
      estimatedGoalDateIso: null,
    };
  }

  const estimatedWeeksToGoal = Math.max(1, Math.round((distanceInGoalDir / clampedRate) * 10) / 10);
  const targetDate = new Date(referenceDate.getTime());
  targetDate.setDate(targetDate.getDate() + Math.round(estimatedWeeksToGoal * 7));
  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');

  return {
    goalMode,
    weightDeltaKg,
    weeklyWeightChangeKg,
    dailyKcalDelta,
    estimatedWeeksToGoal,
    estimatedGoalDateIso: `${y}-${m}-${d}`,
  };
}
