import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMifflinStJeorBMR,
  calculateNutritionTargets,
  computeAtwaterCalories,
  computeWeightTrendAndCoach,
  summarizeMealsForDate,
} from './nutrition';
import { BodyMeasurement, MealEntry, UserProfile } from '../types/health';

const baseProfile: UserProfile = {
  id: 'u1',
  displayName: 'Alex',
  birthDate: '1996-05-10',
  age: 30,
  heightCm: 180,
  weightKg: 75,
  biologicalSex: 'male',
  maxHr: 187,
  hrZoneMethod: 'hrr',
  fitnessExperience: 'intermediate',
  primarySport: 'running',
  activityLevel: 'moderate',
  weeklyTrainingDays: 4,
  sleepTargetMinutes: 480,
  preferredBedtime: '23:00',
  preferredWakeTime: '07:00',
  nutritionGoalMode: 'cut',
  nutritionGoalDeltaKcal: -500,
  usesWearableActiveCalories: true,
  dailyLifestyleNeat: 'sedentary',
  manualActivityPal: 'moderate',
  goals: ['long_term_health'],
  runningTargets: {},
  dashboardFocus: 'general',
  onboardingCompleted: true,
  createdAt: '2026-11-01T07:00:00',
  updatedAt: '2026-11-01T07:00:00',
};

test('Mifflin-St Jeor BMR uses auto-computed age accurately', () => {
  const ref = new Date('2026-11-22T12:00:00');
  // 10*75 + 6.25*180 - 5*30 + 5 = 750 + 1125 - 150 + 5 = 1730
  assert.equal(calculateMifflinStJeorBMR(baseProfile, ref), 1730);
});

test('Wearable mode adds 100% of active calories on top regardless of cut, maintain, or build', () => {
  const ref = new Date('2026-11-22T12:00:00');
  const restCut = calculateNutritionTargets(baseProfile, 0, ref);
  const activeCut = calculateNutritionTargets(baseProfile, 620, ref);
  assert.equal(activeCut.caloriesKcal - restCut.caloriesKcal, 620);
  assert.equal(activeCut.activeBonusKcal, 620);

  const buildProfile: UserProfile = {
    ...baseProfile,
    nutritionGoalMode: 'build',
    nutritionGoalDeltaKcal: 300,
  };
  const restBuild = calculateNutritionTargets(buildProfile, 0, ref);
  const activeBuild = calculateNutritionTargets(buildProfile, 450, ref);
  assert.equal(activeBuild.caloriesKcal - restBuild.caloriesKcal, 450);
});

test('No-wearable mode relies on manual PAL without double-counting active calories', () => {
  const ref = new Date('2026-11-22T12:00:00');
  const noWearable: UserProfile = {
    ...baseProfile,
    usesWearableActiveCalories: false,
    manualActivityPal: 'moderate',
    nutritionGoalMode: 'maintain',
    nutritionGoalDeltaKcal: 0,
  };
  const t0 = calculateNutritionTargets(noWearable, 0, ref);
  const t500 = calculateNutritionTargets(noWearable, 500, ref);
  assert.equal(t0.caloriesKcal, t500.caloriesKcal);
  assert.equal(t500.activeBonusKcal, 0);
});

test('summarizeMealsForDate aggregates calories and macros by meal slot', () => {
  const meals: MealEntry[] = [
    {
      id: 'm1',
      date: '2026-11-22',
      timestamp: '2026-11-22T08:00:00',
      category: 'breakfast',
      title: 'Skyr Bowl',
      subtitle: 'KI-Import',
      items: [],
      totalCalories: 420,
      proteinG: 38,
      carbsG: 48,
      fatG: 7,
      fiberG: 8,
    },
    {
      id: 'm2',
      date: '2026-11-22',
      timestamp: '2026-11-22T13:00:00',
      category: 'lunch',
      title: 'Hähnchenbrust mit Reis',
      subtitle: 'KI-Import',
      items: [],
      totalCalories: 540,
      proteinG: 55,
      carbsG: 60,
      fatG: 8,
      fiberG: 4,
    },
  ];
  const summary = summarizeMealsForDate(meals, '2026-11-22');
  assert.equal(summary.totalCalories, 960);
  assert.equal(summary.proteinG, 93);
  assert.equal(summary.carbsG, 108);
  assert.equal(summary.fatG, 15);
  assert.equal(summary.byCategory.lunch.length, 1);
});

test('computeAtwaterCalories derives kcal cleanly from macros and ignores negative inputs', () => {
  assert.equal(computeAtwaterCalories(40, 50, 10), 450);
  assert.equal(computeAtwaterCalories(0, 0, 0), 0);
  assert.equal(computeAtwaterCalories(-5, 25, 10), 190);
});

test('computeWeightTrendAndCoach dampens 1-day water spikes and stays in collecting state below 7 days', () => {
  const mkWeight = (id: string, date: string, weightKg: number): BodyMeasurement => ({
    id,
    date,
    timestamp: `${date}T07:00:00`,
    metricType: 'body_measurement',
    weightKg,
    sourceProvider: 'other',
    sourceRecordId: id,
    dataQuality: 'high',
    provenance: 'measured',
  });
  const measurements: BodyMeasurement[] = [
    mkWeight('w1', '2026-11-18', 80.0),
    mkWeight('w2', '2026-11-19', 80.1),
    mkWeight('w3', '2026-11-20', 80.0),
    mkWeight('w4', '2026-11-21', 81.6), // sudden +1.6 kg water spike
  ];

  const coach = computeWeightTrendAndCoach(measurements, [], baseProfile, '2026-11-21');
  assert.equal(coach.hasEnoughData, false);
  assert.equal(coach.status, 'collecting');
  assert.equal(coach.latestRawWeightKg, 81.6);
  // EWMA (alpha = 0.25) should strongly dampen the +1.6 kg spike
  assert.ok(coach.latestTrendWeightKg !== null && coach.latestTrendWeightKg < 80.6);
  assert.ok(coach.latestTrendWeightKg! > 80.2);
});

test('computeWeightTrendAndCoach computes observed TDEE and damped ±200 kcal adjustment with >= 7 weight & meal days', () => {
  const measurements: BodyMeasurement[] = [];
  const meals: MealEntry[] = [];
  // 14 days where user eats 2200 kcal/day on a cut goal (-500 kcal/day = -0.45 kg/wk),
  // but weight stays completely flat at 80.0 kg -> coach should suggest a damped reduction (<= 0, >= -200)
  for (let i = 0; i < 14; i++) {
    const day = String(9 + i).padStart(2, '0');
    const dateKey = `2026-11-${day}`;
    measurements.push({
      id: `w_${i}`,
      date: dateKey,
      timestamp: `${dateKey}T07:00:00`,
      metricType: 'body_measurement',
      weightKg: 80.0,
      sourceProvider: 'other',
      sourceRecordId: `w_${i}`,
      dataQuality: 'high',
      provenance: 'measured',
    });
    meals.push({
      id: `m_${i}`,
      date: dateKey,
      timestamp: `${dateKey}T13:00:00`,
      category: 'lunch',
      title: 'Standard Tag',
      subtitle: 'Test',
      items: [],
      totalCalories: 2200,
      proteinG: 150,
      carbsG: 220,
      fatG: 70,
      fiberG: 30,
    });
  }

  const coach = computeWeightTrendAndCoach(measurements, meals, baseProfile, '2026-11-22');
  assert.equal(coach.hasEnoughData, true);
  assert.equal(coach.avgDailyIntakeKcal, 2200);
  assert.ok(coach.estimatedTdeeKcal !== null && Math.abs(coach.estimatedTdeeKcal - 2200) <= 100);
  assert.ok(coach.suggestedAdjustmentKcal <= -50 && coach.suggestedAdjustmentKcal >= -200);
  assert.ok(coach.suggestedDailyTargetKcal !== null && coach.suggestedDailyTargetKcal < 2200);
});

