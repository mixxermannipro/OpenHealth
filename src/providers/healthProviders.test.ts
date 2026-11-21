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
