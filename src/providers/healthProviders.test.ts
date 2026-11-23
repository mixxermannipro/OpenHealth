import test from 'node:test';
import assert from 'node:assert/strict';
import { generateScenarioDataset } from '../data/mockGenerator';
import { isDuplicateWorkout, mergeSyncedBatch, SimulatedWearableProvider } from './healthProviders';
import { addDaysToKey, toLocalDateKey } from '../utils/formatters';

test('cross-provider duplicate detection prevents double counting the 10 km run', async () => {
  const refDate = new Date('2026-11-17T08:00:00');
  const todayKey = toLocalDateKey(refDate);
  const twoDaysAgo = addDaysToKey(todayKey, -2);
  const dataset = generateScenarioDataset('balanced', undefined, refDate);

  const existing10k = dataset.workouts.find((w) => w.date === twoDaysAgo && w.distanceKm === 10.0);
  assert.ok(existing10k, 'Special 10 km demo workout should exist two days ago');

  const healthConnectSource = dataset.connectedSources.find((s) => s.providerId === 'health_connect')!;
  const provider = new SimulatedWearableProvider(healthConnectSource);
  const batch = await provider.sync(todayKey, dataset.profile);

  const dupCandidate = batch.workouts.find((w) => w.date === twoDaysAgo && w.distanceKm === 10.0);
  assert.ok(dupCandidate);
  assert.equal(isDuplicateWorkout(existing10k!, dupCandidate!), true);

  const merged = mergeSyncedBatch(
    {
      workouts: dataset.workouts,
      hrvObservations: dataset.hrvObservations,
      rhrObservations: dataset.rhrObservations,
      sleepSessions: dataset.sleepSessions,
      dailyActivities: dataset.dailyActivities,
    },
    batch,
    dataset.sourcePriorities
  );

  assert.equal(merged.report.deduplicatedWorkouts, 1);
  assert.equal(merged.report.importedWorkouts, 1);
  const countTwoDaysAgo = merged.workouts.filter((w) => w.date === twoDaysAgo && w.distanceKm === 10.0).length;
  assert.equal(countTwoDaysAgo, 1, 'Duplicate 10 km workout must appear only once');
});

test('mergeSyncedBatch merges and deduplicates Health Connect sleep, body measurements, and hydration', () => {
  const todayKey = '2026-11-23';
  const merged = mergeSyncedBatch(
    {
      workouts: [],
      hrvObservations: [],
      rhrObservations: [],
      sleepSessions: [],
      dailyActivities: [],
      bodyMeasurements: [],
      hydrationEntries: [{ date: todayKey, ml: 1000, updatedAt: '2026-11-23T10:00:00Z' }],
    },
    {
      providerId: 'health_connect',
      syncedAt: '2026-11-23T12:00:00Z',
      workouts: [],
      hrvObservations: [],
      rhrObservations: [],
      sleepSessions: [
        {
          id: 'hc_sleep_1',
          date: todayKey,
          timestamp: '2026-11-23T06:45:00Z',
          sourceProvider: 'health_connect',
          sourceRecordId: 'hc_sleep_1',
          dataQuality: 'high',
          provenance: 'measured',
          metricType: 'sleep_session',
          bedtimeIso: '2026-11-22T22:50:00Z',
          wakeTimeIso: '2026-11-23T06:45:00Z',
          timeInBedMinutes: 475,
          totalSleepMinutes: 445,
          awakeMinutes: 30,
          lightMinutes: 235,
          deepMinutes: 105,
          remMinutes: 105,
          hasStageData: true,
          efficiencyPercent: 94,
          awakeningsCount: 2,
          stages: [],
        },
      ],
      dailyActivities: [],
      bodyMeasurements: [
        {
          id: 'hc_body_1',
          date: todayKey,
          timestamp: '2026-11-23T07:00:00Z',
          sourceProvider: 'health_connect',
          sourceRecordId: 'hc_body_1',
          dataQuality: 'high',
          provenance: 'measured',
          metricType: 'body_measurement',
          weightKg: 75.4,
        },
      ],
      hydrationEntries: [{ date: todayKey, ml: 1800, updatedAt: '2026-11-23T12:00:00Z' }],
    },
    {
      steps: 'health_connect',
      heartRate: 'coros',
      sleep: 'health_connect',
      workouts: 'coros',
      weight: 'health_connect',
      bodyComposition: 'health_connect',
    }
  );

  assert.equal(merged.sleepSessions.length, 1);
  assert.equal(merged.sleepSessions[0].deepMinutes, 105);
  assert.equal(merged.bodyMeasurements.length, 1);
  assert.equal(merged.bodyMeasurements[0].weightKg, 75.4);
  assert.equal(merged.hydrationEntries[0].ml, 1800);
  assert.equal(merged.report.importedObservations, 2);
});

test('mergeSyncedBatch merges external meals, skin temperature, muscle mass, and prefers measured RHR over wearable estimates', () => {
  const todayKey = '2026-11-23';
  const merged = mergeSyncedBatch(
    {
      workouts: [],
      hrvObservations: [],
      rhrObservations: [
        {
          id: 'hc_rhr_est_2026-11-23',
          date: todayKey,
          timestamp: '2026-11-23T06:00:00Z',
          sourceProvider: 'health_connect',
          sourceRecordId: 'hc_rhr_est_2026-11-23',
          dataQuality: 'moderate',
          provenance: 'wearable_estimate',
          metricType: 'resting_hr',
          unit: 'bpm',
          value: 51,
          recordingContext: 'overnight_min',
        },
      ],
      sleepSessions: [],
      dailyActivities: [],
      bodyMeasurements: [],
      hydrationEntries: [],
      meals: [],
    },
    {
      providerId: 'health_connect',
      syncedAt: '2026-11-23T12:30:00Z',
      workouts: [],
      hrvObservations: [],
      rhrObservations: [
        {
          id: 'hc_rhr_measured_1',
          date: todayKey,
          timestamp: '2026-11-23T06:30:00Z',
          sourceProvider: 'health_connect',
          sourceRecordId: 'hc_rhr_measured_1',
          dataQuality: 'high',
          provenance: 'measured',
          metricType: 'resting_hr',
          unit: 'bpm',
          value: 49,
          recordingContext: 'morning_rest',
        },
      ],
      sleepSessions: [],
      dailyActivities: [
        {
          id: 'hc_act_1',
          date: todayKey,
          timestamp: '2026-11-23T12:00:00Z',
          sourceProvider: 'health_connect',
          sourceRecordId: 'hc_act_1',
          dataQuality: 'high',
          provenance: 'measured',
          metricType: 'daily_activity',
          steps: 9420,
          activeMinutes: 48,
          activeCaloriesKcal: 520,
          estimatedEnergyKcal: 2350,
          skinTempDeviationC: 0.3,
        },
      ],
      bodyMeasurements: [
        {
          id: 'hc_body_2',
          date: todayKey,
          timestamp: '2026-11-23T07:10:00Z',
          sourceProvider: 'health_connect',
          sourceRecordId: 'hc_body_2',
          dataQuality: 'high',
          provenance: 'measured',
          metricType: 'body_measurement',
          weightKg: 75.2,
          muscleMassKg: 61.8,
        },
      ],
      meals: [
        {
          id: 'hc_meal_1',
          date: todayKey,
          timestamp: '2026-11-23T08:15:00Z',
          category: 'breakfast',
          title: 'Haferflocken mit Beeren',
          subtitle: 'Health Connect Import',
          items: [
            {
              id: 'hc_meal_1_item',
              name: 'Haferflocken mit Beeren',
              grams: 300,
              calories: 480,
              proteinG: 24,
              carbsG: 68,
              fatG: 12,
              fiberG: 9,
              source: 'manual',
            },
          ],
          totalCalories: 480,
          proteinG: 24,
          carbsG: 68,
          fatG: 12,
          fiberG: 9,
        },
      ],
    },
    {
      steps: 'health_connect',
      heartRate: 'health_connect',
      sleep: 'health_connect',
      workouts: 'health_connect',
      weight: 'health_connect',
      bodyComposition: 'health_connect',
    }
  );

  assert.equal(merged.rhrObservations.length, 1);
  assert.equal(merged.rhrObservations[0].value, 49);
  assert.equal(merged.rhrObservations[0].provenance, 'measured');
  assert.equal(merged.dailyActivities[0].skinTempDeviationC, 0.3);
  assert.equal(merged.bodyMeasurements[0].muscleMassKg, 61.8);
  assert.equal(merged.meals.length, 1);
  assert.equal(merged.meals[0].title, 'Haferflocken mit Beeren');
});

