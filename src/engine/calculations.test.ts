import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessRecovery,
  assessSleep,
  assessTrainingLoad,
  buildDailySnapshot,
  calculateWorkoutLoad,
  computeBedtimeAndCaffeine,
  computeHabitCorrelations,
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

test('wearable-free check-in produces honest subjective fallback recovery score when journal exists', () => {
  const todayKey = '2026-11-22';
  const profile = createDefaultProfile({}, todayKey);

  // Without journal -> still null (no fabricated score)
  const snapEmpty = buildDailySnapshot(todayKey, profile, [], [], [], [], [], [], []);
  assert.equal(snapEmpty.recovery.score, null);
  assert.equal(Boolean(snapEmpty.recovery.isSubjectiveFallback), false);

  // With journal only -> honest subjective fallback
  const snapCheckin = buildDailySnapshot(todayKey, profile, [], [], [], [], [], [], [
    {
      date: todayKey,
      updatedAt: `${todayKey}T08:00:00`,
      subjectiveSleepQuality: 4,
      energyLevel: 4,
      subjectiveFatigue: 2,
      muscleSoreness: 2,
      stressLevel: 2,
      mood: 4,
      illnessSymptoms: false,
    },
  ]);

  assert.ok(snapCheckin.recovery.score !== null && snapCheckin.recovery.score >= 60);
  assert.equal(snapCheckin.recovery.isSubjectiveFallback, true);
  assert.equal(snapCheckin.recovery.confidence, 'limited');
  assert.ok(snapCheckin.recovery.recommendedStrainRange !== undefined);
});

test('computeBedtimeAndCaffeine rounds cleanly across hour boundaries (never 22:60) and works without today sleep', () => {
  // Wake at 07:13, target 480 + 15 min latency = 495 min -> 07:13 - 8h15m = 22:58 -> rounds to 23:00!
  const edge = computeBedtimeAndCaffeine(480, 0, '07:13');
  assert.equal(edge.recommendedBedtime, '23:00');
  assert.equal(edge.caffeineCutoffTime, '14:00');

  // Wake at 08:13 -> 23:58 -> rounds cleanly to 00:00!
  const midnight = computeBedtimeAndCaffeine(480, 0, '08:13');
  assert.equal(midnight.recommendedBedtime, '00:00');
  assert.equal(midnight.caffeineCutoffTime, '15:00');

  // assessSleep still returns recommendedBedtime & caffeineCutoffTime with zero logged sleep sessions
  const profile = createDefaultProfile({ sleepTargetMinutes: 480, preferredWakeTime: '06:45' }, '2026-11-22');
  const emptySleep = assessSleep('2026-11-22', profile, []);
  assert.equal(emptySleep.score, null);
  assert.ok(emptySleep.recommendedBedtime && /^\d{2}:\d{2}$/.test(emptySleep.recommendedBedtime));
  assert.ok(emptySleep.caffeineCutoffTime && /^\d{2}:\d{2}$/.test(emptySleep.caffeineCutoffTime));
  assert.ok(!emptySleep.recommendedBedtime.endsWith(':60'));
});

test('simulateWorkoutImpact returns real beforeStrain21 and afterStrain21 strictly greater than before', () => {
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

  const sim = simulateWorkoutImpact(
    todayKey,
    { sport: 'running', durationMinutes: 50, distanceKm: 10, avgHrBpm: 155, rpe: 7 },
    balanced.profile,
    snap,
    balanced.workouts
  );

  assert.ok(typeof sim.beforeStrain21 === 'number');
  assert.ok(typeof sim.afterStrain21 === 'number');
  assert.ok(sim.afterStrain21! > sim.beforeStrain21!, `expected afterStrain21 (${sim.afterStrain21}) > beforeStrain21 (${sim.beforeStrain21})`);
});

test('assessTrainingLoad produces non-zero chronicLoad28d on the very first workout', () => {
  const todayKey = '2026-11-22';
  const profile = createDefaultProfile({}, todayKey);
  const firstWorkout = {
    id: 'w_first',
    date: todayKey,
    timestamp: `${todayKey}T08:00:00`,
    sourceProvider: 'other' as const,
    sourceRecordId: 'w_first',
    dataQuality: 'high' as const,
    provenance: 'measured' as const,
    metricType: 'workout' as const,
    sport: 'running' as const,
    title: 'Erster Lauf',
    startTimeIso: `${todayKey}T08:00:00`,
    durationMinutes: 40,
    distanceKm: 7.5,
    avgHrBpm: 148,
    rpe: 6,
    rawLoadScore: 55,
    normalizedLoad: 58,
    caloriesBurned: 480,
    hrZoneMinutes: [5, 20, 12, 3, 0] as [number, number, number, number, number],
  };
  const baseline = computePersonalBaseline(todayKey, [], [], [], [firstWorkout], []);
  const load = assessTrainingLoad(todayKey, profile, [firstWorkout], baseline);
  assert.ok(load.acuteLoad7d > 0);
  assert.ok(load.chronicLoad28d > 0);
});

test('computeHabitCorrelations never returns hardcoded -9% and computes real statistical impact when >= 2 days per group exist', () => {
  // Only 1 alcohol day + 1 non-alcohol day -> must NOT fabricate -9%, must be ready: false
  const sparseJournals = [
    {
      date: '2026-11-18',
      updatedAt: '2026-11-18T21:00:00',
      subjectiveSleepQuality: 3 as const,
      energyLevel: 3 as const,
      subjectiveFatigue: 3 as const,
      muscleSoreness: 2 as const,
      stressLevel: 2 as const,
      mood: 3 as const,
      illnessSymptoms: false,
      alcoholDrinks: 2,
      habitTags: ['alcohol' as const],
    },
    {
      date: '2026-11-19',
      updatedAt: '2026-11-19T21:00:00',
      subjectiveSleepQuality: 4 as const,
      energyLevel: 4 as const,
      subjectiveFatigue: 2 as const,
      muscleSoreness: 2 as const,
      stressLevel: 2 as const,
      mood: 4 as const,
      illnessSymptoms: false,
      alcoholDrinks: 0,
      habitTags: [],
    },
  ];
  const sparseCorrs = computeHabitCorrelations(sparseJournals, [], []);
  assert.ok(sparseCorrs.every((c) => !c.ready || c.impactPct !== -9));

  // Now build 6 consecutive days with HRV: 3 alcohol days followed by low HRV (45 ms), 3 clean days followed by high HRV (75 ms)
  const richJournals = [];
  const richHrv = [];
  for (let i = 0; i < 6; i++) {
    const day = String(10 + i).padStart(2, '0');
    const nextDay = String(11 + i).padStart(2, '0');
    const isAlcohol = i % 2 === 0;
    richJournals.push({
      date: `2026-11-${day}`,
      updatedAt: `2026-11-${day}T21:00:00`,
      subjectiveSleepQuality: 4 as const,
      energyLevel: 4 as const,
      subjectiveFatigue: 2 as const,
      muscleSoreness: 2 as const,
      stressLevel: 2 as const,
      mood: 4 as const,
      illnessSymptoms: false,
      alcoholDrinks: isAlcohol ? 2 : 0,
      habitTags: isAlcohol ? (['alcohol'] as const) : ([] as const),
    });
    richHrv.push({
      id: `hrv_${i}`,
      date: `2026-11-${nextDay}`,
      timestamp: `2026-11-${nextDay}T07:00:00`,
      sourceProvider: 'garmin' as const,
      sourceRecordId: `hrv_${i}`,
      dataQuality: 'high' as const,
      provenance: 'measured' as const,
      metricType: 'hrv_rmssd' as const,
      unit: 'ms' as const,
      value: isAlcohol ? 45 : 75,
      recordingContext: 'overnight_avg' as const,
    });
  }

  const richCorrs = computeHabitCorrelations(
    richJournals.map((j) => ({ ...j, habitTags: [...j.habitTags] })),
    richHrv,
    []
  );
  const alc = richCorrs.find((c) => c.id === 'habit_alcohol');
  assert.ok(alc && alc.ready, 'alcohol correlation should be ready with 3 with + 3 without');
  assert.ok(alc!.impactPct !== null && alc!.impactPct <= -20, `expected strong negative impact, got ${alc!.impactPct}`);
});

