import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessRecovery,
  assessSleep,
  buildDailySnapshot,
  calculateWorkoutLoad,
  computePersonalBaseline,
  estimateFitnessAge,
  normalizeDailyLoadScore,
  simulateWorkoutImpact,
} from './calculations';
import { createDefaultProfile, generateScenarioDataset } from '../data/mockGenerator';
import { toLocalDateKey } from '../utils/formatters';

test('deterministic scenario datasets produce consistent, differentiated readiness profiles', () => {
  const refDate = new Date('2026-11-17T08:00:00');
  const todayKey = toLocalDateKey(refDate);

  const balanced = generateScenarioDataset('balanced', undefined, refDate);
  const fatigued = generateScenarioDataset('fatigued', undefined, refDate);
  const recovering = generateScenarioDataset('recovering', undefined, refDate);

  const snapBalanced = buildDailySnapshot(
    todayKey,
    balanced.profile,
    balanced.hrvObservations,
    balanced.rhrObservations,
    balanced.sleepSessions,
    balanced.workouts,
    balanced.dailyActivities,
    balanced.bodyMeasurements,
    balanced.journalEntries
  );

  const snapFatigued = buildDailySnapshot(
    todayKey,
    fatigued.profile,
    fatigued.hrvObservations,
    fatigued.rhrObservations,
    fatigued.sleepSessions,
    fatigued.workouts,
    fatigued.dailyActivities,
    fatigued.bodyMeasurements,
    fatigued.journalEntries
  );

  const snapRecovering = buildDailySnapshot(
    todayKey,
    recovering.profile,
    recovering.hrvObservations,
    recovering.rhrObservations,
    recovering.sleepSessions,
    recovering.workouts,
    recovering.dailyActivities,
    recovering.bodyMeasurements,
    recovering.journalEntries
  );

  assert.ok(snapBalanced.recovery.score !== null && snapBalanced.recovery.score >= 68);
  assert.ok(snapFatigued.recovery.score !== null && snapFatigued.recovery.score <= 52);
  assert.ok(snapRecovering.recovery.score !== null);
  assert.ok(snapBalanced.recovery.score! > snapFatigued.recovery.score!);
  assert.notEqual(snapFatigued.recovery.readinessCategory, 'high_intensity_ok');
});

test('missing observations explicitly lower confidence and do not fabricate scores', () => {
  const todayKey = '2026-11-17';
  const profile = createDefaultProfile({}, todayKey);

  const baseline = computePersonalBaseline(todayKey, [], [], [], [], []);
  const sleep = assessSleep(todayKey, profile, []);
  const load = {
    date: todayKey,
    dailyLoadScore: 0,
    rawDailyLoad: 0,
    classification: 'Ruhetag' as const,
    acuteLoad7d: 0,
    chronicLoad28d: 0,
    acuteChronicRatio: null,
    weeklyAvgLoad: 0,
    weeklyTrendPct: null,
    workouts: [],
    weeklyZoneMinutes: [0, 0, 0, 0, 0] as [number, number, number, number, number],
  };

  const recovery = assessRecovery(
    todayKey,
    profile,
    [],
    [],
    [],
    [],
    [],
    baseline,
    sleep,
    load,
    true
  );

  assert.equal(sleep.score, null);
  assert.equal(sleep.confidence, 'insufficient');
  assert.equal(recovery.score, null);
  assert.equal(recovery.confidence, 'insufficient');
  assert.equal(recovery.readinessCategory, 'insufficient_data');
});

test('10 km @ 4:30/km @ 150 bpm simulation updates daily load, acute load, and next-day guidance', () => {
  const refDate = new Date('2026-11-17T08:00:00');
  const todayKey = toLocalDateKey(refDate);
  const balanced = generateScenarioDataset('balanced', undefined, refDate);

  const snap = buildDailySnapshot(
    todayKey,
    balanced.profile,
    balanced.hrvObservations,
    balanced.rhrObservations,
    balanced.sleepSessions,
    balanced.workouts,
    balanced.dailyActivities,
    balanced.bodyMeasurements,
    balanced.journalEntries
  );

  const loadCheck = calculateWorkoutLoad(
    { sport: 'running', durationMinutes: 45, avgHrBpm: 150, rpe: 6, distanceKm: 10.0 },
    balanced.profile,
    52
  );
  assert.ok(loadCheck.rawLoad > 40);
  assert.ok(loadCheck.normalizedLoad >= 30 && loadCheck.normalizedLoad <= 95);

  const sim = simulateWorkoutImpact(
    todayKey,
    { sport: 'running', durationMinutes: 45, distanceKm: 10.0, avgHrBpm: 150, rpe: 6 },
    balanced.profile,
    snap,
    balanced.workouts
  );

  assert.equal(sim.simulatedWorkout.distanceKm, 10.0);
  assert.equal(sim.simulatedWorkout.avgPaceSecPerKm, 270);
  assert.equal(sim.simulatedWorkout.avgHrBpm, 150);
  assert.ok(sim.afterDailyLoad > sim.beforeDailyLoad);
  assert.ok(sim.afterAcuteLoad > sim.beforeAcuteLoad);
  assert.ok(sim.estimatedNextDayRecoveryRange[0] < sim.estimatedNextDayRecoveryRange[1]);
});

test('fitness age reports insufficient data when history is too short and responds slowly when populated', () => {
  const refDate = new Date('2026-11-17T08:00:00');
  const todayKey = toLocalDateKey(refDate);
  const profile = createDefaultProfile({ age: 30 }, todayKey);

  const emptyEstimate = estimateFitnessAge(todayKey, profile, [], [], []);
  assert.equal(emptyEstimate.sufficientData, false);
  assert.equal(emptyEstimate.estimatedFitnessAge, null);

  const balanced = generateScenarioDataset('balanced', profile, refDate);
  const richEstimate = estimateFitnessAge(
    todayKey,
    balanced.profile,
    balanced.rhrObservations,
    balanced.workouts,
    balanced.dailyActivities
  );
  assert.equal(richEstimate.sufficientData, true);
  assert.ok(richEstimate.estimatedFitnessAge !== null);
  assert.ok(Math.abs(richEstimate.differenceYears!) <= 5.0);
});

test('daily load normalization never exceeds 100 and handles zero load', () => {
  assert.equal(normalizeDailyLoadScore(0), 0);
  assert.equal(normalizeDailyLoadScore(10000), 100);
});

test('subjective sleep and energy feelings blend cleanly into sleep, recovery, and strain target', () => {
  const refDate = new Date('2026-11-17T08:00:00');
  const todayKey = toLocalDateKey(refDate);
  const balanced = generateScenarioDataset('balanced', undefined, refDate);
  const baseJournals = balanced.journalEntries.filter((j) => j.date !== todayKey);

  // 1. Unlogged today: 100% objective re-weighting, factor weights sum to ~100 (0..100 scale)
  const snapObjective = buildDailySnapshot(
    todayKey,
    balanced.profile,
    balanced.hrvObservations,
    balanced.rhrObservations,
    balanced.sleepSessions,
    balanced.workouts,
    balanced.dailyActivities,
    balanced.bodyMeasurements,
    baseJournals
  );
  const objWeightSum = snapObjective.recovery.factors
    .filter((f) => f.available)
    .reduce((acc, f) => acc + f.weightUsed, 0);
  assert.ok(objWeightSum >= 98 && objWeightSum <= 102, `expected ~100 weight sum, got ${objWeightSum}`);
  assert.equal(snapObjective.sleep.score, snapObjective.sleep.objectiveScore);

  // 2. Poor subjective sleep (1) + exhausted energy (1): pulls sleep & recovery down and lowers strain target
  const snapLowFeel = buildDailySnapshot(
    todayKey,
    balanced.profile,
    balanced.hrvObservations,
    balanced.rhrObservations,
    balanced.sleepSessions,
    balanced.workouts,
    balanced.dailyActivities,
    balanced.bodyMeasurements,
    [
      ...baseJournals,
      {
        date: todayKey,
        updatedAt: `${todayKey}T08:10:00`,
        subjectiveSleepQuality: 1,
        energyLevel: 1,
        subjectiveFatigue: 5,
        muscleSoreness: 4,
        stressLevel: 4,
        mood: 2,
        illnessSymptoms: false,
      },
    ]
  );

  // 3. Great subjective sleep (5) + peak energy (5)
  const snapHighFeel = buildDailySnapshot(
    todayKey,
    balanced.profile,
    balanced.hrvObservations,
    balanced.rhrObservations,
    balanced.sleepSessions,
    balanced.workouts,
    balanced.dailyActivities,
    balanced.bodyMeasurements,
    [
      ...baseJournals,
      {
        date: todayKey,
        updatedAt: `${todayKey}T08:10:00`,
        subjectiveSleepQuality: 5,
        energyLevel: 5,
        subjectiveFatigue: 1,
        muscleSoreness: 1,
        stressLevel: 1,
        mood: 5,
        illnessSymptoms: false,
      },
    ]
  );

  assert.ok(snapLowFeel.sleep.score! < snapObjective.sleep.score!, 'low subjective sleep should lower sleep score');
  assert.ok(snapHighFeel.sleep.score! > snapLowFeel.sleep.score!, 'high subjective sleep should exceed low subjective sleep');
  assert.ok(snapLowFeel.recovery.score! <= snapObjective.recovery.score! - 8, 'exhausted feeling should meaningfully lower recovery');
  assert.ok(snapHighFeel.recovery.score! > snapLowFeel.recovery.score! + 12, 'peak energy should exceed exhausted recovery');
  assert.ok(
    snapLowFeel.recovery.recommendedStrainRange![1] < snapHighFeel.recovery.recommendedStrainRange![1],
    'low subjective feeling must reduce recommended daily strain range'
  );
  assert.ok(snapLowFeel.recovery.subjectiveAlignmentNote, 'divergence should emit plain-German alignment note');
  assert.ok(snapLowFeel.sleep.subjectiveAlignmentNote, 'sleep divergence should emit plain-German alignment note');

  // Verify 18% subjective factor weight when all 5 factors are present
  const journalFactor = snapHighFeel.recovery.factors.find((f) => f.key === 'journal');
  assert.equal(journalFactor?.weightUsed, 18);
});
