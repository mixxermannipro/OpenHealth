import {
  BodyMeasurement,
  ConnectedSource,
  DailyActivitySummary,
  DemoScenarioId,
  DeviceProviderId,
  HRVObservation,
  JournalEntry,
  RestingHeartRateObservation,
  SleepSession,
  SleepStageSegment,
  SourcePriorityPreferences,
  UserProfile,
  WorkoutSession,
} from '../types/health';
import { addDaysToKey, toLocalDateKey } from '../utils/formatters';
import { calculateWorkoutLoad, generatePlausibleWorkoutSeries } from '../engine/calculations';

// Deterministic Mulberry32 PRNG
function createRng(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GeneratedDataset {
  scenarioId: DemoScenarioId;
  profile: UserProfile;
  connectedSources: ConnectedSource[];
  sourcePriorities: SourcePriorityPreferences;
  hrvObservations: HRVObservation[];
  rhrObservations: RestingHeartRateObservation[];
  sleepSessions: SleepSession[];
  workouts: WorkoutSession[];
  dailyActivities: DailyActivitySummary[];
  bodyMeasurements: BodyMeasurement[];
  journalEntries: JournalEntry[];
}

function buildSleepStages(
  totalSleepMin: number,
  awakeMin: number,
  rng: () => number
): {
  stages: SleepStageSegment[];
  deepMin: number;
  remMin: number;
  lightMin: number;
} {
  const deepRatio = 0.16 + rng() * 0.06;
  const remRatio = 0.2 + rng() * 0.06;
  const deepMin = Math.round(totalSleepMin * deepRatio);
  const remMin = Math.round(totalSleepMin * remRatio);
  const lightMin = Math.max(30, totalSleepMin - deepMin - remMin);

  // Build 4-5 realistic ultradian sleep cycles
  const cycles = 5;
  const stages: SleepStageSegment[] = [];
  let offset = 0;

  let remLeft = remMin;
  let deepLeft = deepMin;
  let lightLeft = lightMin;
  let awakeLeft = awakeMin;

  for (let c = 0; c < cycles; c++) {
    const isEarly = c < 2;
    const isLast = c === cycles - 1;

    const lChunk = isLast ? lightLeft : Math.round(lightLeft / (cycles - c));
    const l1 = Math.max(8, Math.round(lChunk * 0.65));
    const l2 = Math.max(5, lChunk - l1);
    lightLeft = Math.max(0, lightLeft - (l1 + l2));

    const dShare = isEarly ? 0.36 : isLast ? 0.06 : 0.15;
    const dChunk = isLast ? deepLeft : Math.min(deepLeft, Math.round(deepMin * dShare));
    deepLeft = Math.max(0, deepLeft - dChunk);

    const rShare = isEarly ? 0.12 : isLast ? 0.32 : 0.24;
    const rChunk = isLast ? remLeft : Math.min(remLeft, Math.round(remMin * rShare));
    remLeft = Math.max(0, remLeft - rChunk);

    const aChunk = isLast ? awakeLeft : Math.min(awakeLeft, Math.round(awakeMin * (c === 2 ? 0.45 : 0.2)));
    awakeLeft = Math.max(0, awakeLeft - aChunk);

    if (l1 > 0) {
      stages.push({ stage: 'light', startOffsetMinutes: offset, durationMinutes: l1 });
      offset += l1;
    }
    if (dChunk > 0) {
      stages.push({ stage: 'deep', startOffsetMinutes: offset, durationMinutes: dChunk });
      offset += dChunk;
    }
    if (l2 > 0) {
      stages.push({ stage: 'light', startOffsetMinutes: offset, durationMinutes: l2 });
      offset += l2;
    }
    if (rChunk > 0) {
      stages.push({ stage: 'rem', startOffsetMinutes: offset, durationMinutes: rChunk });
      offset += rChunk;
    }
    if (aChunk > 0) {
      stages.push({ stage: 'awake', startOffsetMinutes: offset, durationMinutes: aChunk });
      offset += aChunk;
    }
  }

  return { stages, deepMin, remMin, lightMin };
}

export function createDefaultProfile(
  overrides?: Partial<UserProfile>,
  todayKey: string = toLocalDateKey(new Date())
): UserProfile {
  return {
    id: 'user_local_1',
    displayName: 'Manuel',
    age: 21,
    heightCm: 180,
    weightKg: 75.5,
    biologicalSex: 'male',
    restingHrBaselineManual: 48,
    maxHr: 196,
    hrZoneMethod: 'hrr',
    fitnessExperience: 'advanced',
    primarySport: 'running',
    activityLevel: 'very_active',
    weeklyTrainingDays: 5,
    sleepTargetMinutes: 480,
    preferredBedtime: '22:45',
    preferredWakeTime: '06:55',
    nutritionGoalMode: 'maintain',
    goals: ['improve_endurance', 'run_faster', 'improve_recovery', 'long_term_health'],
    runningTargets: {
      target10kSec: 42 * 60 + 30,
      targetHalfSec: 94 * 60,
    },
    dashboardFocus: 'endurance',
    onboardingCompleted: true,
    createdAt: `${todayKey}T07:00:00`,
    updatedAt: `${todayKey}T07:00:00`,
    ...overrides,
  };
}

export function generateScenarioDataset(
  scenarioId: DemoScenarioId,
  existingProfile?: UserProfile,
  referenceDate: Date = new Date()
): GeneratedDataset {
  const todayKey = toLocalDateKey(referenceDate);
  const seedMap: Record<DemoScenarioId, number> = {
    balanced: 20261117,
    fatigued: 88441209,
    recovering: 55193041,
  };
  const rng = createRng(seedMap[scenarioId]);
  const profile = existingProfile
    ? { ...existingProfile }
    : createDefaultProfile({ onboardingCompleted: false }, todayKey);

  const primaryProvider: DeviceProviderId = 'coros';
  const secondaryProvider: DeviceProviderId = 'health_connect';

  const connectedSources: ConnectedSource[] = [
    {
      providerId: 'health_connect',
      name: 'Health Connect',
      connected: true,
      isDemoSimulation: true,
      lastSyncAt: `${todayKey}T07:45:00`,
      supportedDataTypes: ['steps', 'workouts', 'sleep', 'hrv', 'rhr'],
      syncedRecordCount: 540,
    },
    {
      providerId: 'coros',
      name: 'Coros Uhr',
      connected: true,
      isDemoSimulation: true,
      lastSyncAt: `${todayKey}T07:42:00`,
      supportedDataTypes: ['workouts', 'hrv', 'rhr', 'sleep', 'vo2max'],
      syncedRecordCount: 412,
    },
    {
      providerId: 'garmin',
      name: 'Garmin',
      connected: false,
      isDemoSimulation: true,
      lastSyncAt: null,
      supportedDataTypes: ['workouts', 'hrv', 'rhr', 'steps', 'vo2max', 'sleep'],
      syncedRecordCount: 0,
    },
    {
      providerId: 'polar',
      name: 'Polar',
      connected: false,
      isDemoSimulation: true,
      lastSyncAt: null,
      supportedDataTypes: ['workouts', 'hrv', 'rhr', 'sleep'],
      syncedRecordCount: 0,
    },
    {
      providerId: 'apple_health',
      name: 'Apple Health',
      connected: false,
      isDemoSimulation: true,
      comingSoon: true,
      lastSyncAt: null,
      supportedDataTypes: ['steps', 'workouts', 'sleep', 'hrv', 'rhr', 'body'],
      syncedRecordCount: 0,
    },
    {
      providerId: 'oura',
      name: 'Oura',
      connected: false,
      isDemoSimulation: true,
      lastSyncAt: null,
      supportedDataTypes: ['sleep', 'hrv', 'rhr'],
      syncedRecordCount: 0,
    },
    {
      providerId: 'suunto',
      name: 'Suunto',
      connected: false,
      isDemoSimulation: true,
      lastSyncAt: null,
      supportedDataTypes: ['workouts', 'steps', 'sleep'],
      syncedRecordCount: 0,
    },
    {
      providerId: 'withings',
      name: 'Withings',
      connected: false,
      isDemoSimulation: true,
      lastSyncAt: null,
      supportedDataTypes: ['body'],
      syncedRecordCount: 0,
    },
  ];

  const sourcePriorities: SourcePriorityPreferences = {
    steps: 'health_connect',
    heartRate: 'coros',
    sleep: 'health_connect',
    workouts: 'coros',
    weight: 'withings',
    bodyComposition: 'withings',
  };

  const hrvObservations: HRVObservation[] = [];
  const rhrObservations: RestingHeartRateObservation[] = [];
  const sleepSessions: SleepSession[] = [];
  const workouts: WorkoutSession[] = [];
  const dailyActivities: DailyActivitySummary[] = [];
  const bodyMeasurements: BodyMeasurement[] = [];
  const journalEntries: JournalEntry[] = [];

  const totalDays = 180; // 6 months
  let prevAcuteFatigue = 0;

  for (let offset = -(totalDays - 1); offset <= 0; offset++) {
    const dk = addDaysToKey(todayKey, offset);
    const dayIndex = offset + totalDays - 1; // 0 .. 179
    const daysFromEnd = -offset; // 179 .. 0

    // Long-term positive adaptation curve across 180 days
    const adaptationProgress = dayIndex / totalDays;
    let baseHrv = 78 + adaptationProgress * 12;
    let baseRhr = 51.5 - adaptationProgress * 3.0;
    let baseVo2 = 50.8 + adaptationProgress * 2.2;

    // Occasional realistic missing sensor days (not in last 2 days so today is rich)
    const missingHrv = daysFromEnd === 11 || daysFromEnd === 34 || daysFromEnd === 78;
    const missingSleepStages = daysFromEnd === 6 || daysFromEnd === 23;
    const missingSleepEntirely = daysFromEnd === 42;

    // Scenario modulation in the final 10 days
    let scenarioSleepShift = 0;
    let scenarioHrvShift = 0;
    let scenarioRhrShift = 0;
    let forceHardWorkout = false;
    let forceRest = false;

    if (scenarioId === 'balanced') {
      if (daysFromEnd === 0) {
        scenarioHrvShift = 6;
        scenarioRhrShift = -1.5;
        scenarioSleepShift = 22;
      } else if (daysFromEnd === 1) {
        scenarioHrvShift = 2;
        scenarioSleepShift = 10;
      }
    } else if (scenarioId === 'fatigued') {
      if (daysFromEnd <= 5) {
        const intensity = (6 - daysFromEnd) / 6;
        scenarioHrvShift = -14 * intensity;
        scenarioRhrShift = 5.5 * intensity;
        scenarioSleepShift = -85 * intensity;
        if (daysFromEnd >= 1 && daysFromEnd <= 3) forceHardWorkout = true;
      }
    } else if (scenarioId === 'recovering') {
      if (daysFromEnd <= 9 && daysFromEnd >= 5) {
        scenarioHrvShift = -10;
        scenarioRhrShift = 3.5;
        scenarioSleepShift = -45;
      } else if (daysFromEnd < 5) {
        const rebound = (5 - daysFromEnd) / 5;
        scenarioHrvShift = -3 + rebound * 9;
        scenarioRhrShift = 1.5 - rebound * 2.5;
        scenarioSleepShift = 25 * rebound;
        if (daysFromEnd === 1 || daysFromEnd === 2) forceRest = true;
      }
    }

    // Generate workout schedule
    const weekday = new Date(`${dk}T12:00:00`).getDay(); // 0 Sun .. 6 Sat
    let dayRawLoad = 0;

    // Rich today workouts on balanced scenario (Laufen 8.2 km · 42 min + Krafttraining 35 min -> Strain ~14.2)
    if (scenarioId === 'balanced' && daysFromEnd === 0) {
      const runCalc = calculateWorkoutLoad(
        { sport: 'running', durationMinutes: 42, avgHrBpm: 154, rpe: 7, distanceKm: 8.2 },
        profile,
        48
      );
      const runSeries = generatePlausibleWorkoutSeries(42, 8.2, 154, profile.maxHr);
      workouts.push({
        id: `wk_today_run_${dk}`,
        date: dk,
        timestamp: `${dk}T07:35:00`,
        sourceProvider: primaryProvider,
        sourceRecordId: `coros_run_${dk}`,
        dataQuality: 'high',
        provenance: 'measured',
        metricType: 'workout',
        title: 'Laufen',
        sport: 'running',
        startTimeIso: `${dk}T07:35:00`,
        durationMinutes: 42,
        distanceKm: 8.2,
        avgPaceSecPerKm: Math.round((42 * 60) / 8.2),
        avgHrBpm: 154,
        maxHrBpm: 178,
        cadenceSpm: 178,
        elevationGainM: 58,
        rpe: 7,
        caloriesKcal: 420,
        rawLoadScore: runCalc.rawLoad,
        normalizedLoad: runCalc.normalizedLoad,
        hrZoneMinutes: [4, 10, 15, 10, 3],
        timeSeries: runSeries.timeSeries,
        splits: runSeries.splits,
      });
      dayRawLoad += runCalc.rawLoad;

      const strCalc = calculateWorkoutLoad(
        { sport: 'strength', durationMinutes: 35, avgHrBpm: 122, rpe: 7 },
        profile,
        48
      );
      workouts.push({
        id: `wk_today_str_${dk}`,
        date: dk,
        timestamp: `${dk}T13:15:00`,
        sourceProvider: primaryProvider,
        sourceRecordId: `coros_str_${dk}`,
        dataQuality: 'high',
        provenance: 'measured',
        metricType: 'workout',
        title: 'Krafttraining',
        sport: 'strength',
        startTimeIso: `${dk}T13:15:00`,
        durationMinutes: 35,
        avgHrBpm: 122,
        maxHrBpm: 148,
        rpe: 7,
        caloriesKcal: 200,
        rawLoadScore: strCalc.rawLoad,
        normalizedLoad: strCalc.normalizedLoad,
        hrZoneMinutes: [6, 12, 10, 5, 2],
        hasDetailedExerciseLog: true,
        exercises: [
          { name: 'Kniebeugen (Langhantel)', sets: 4, reps: 6, weightKg: 95 },
          { name: 'Klimmzüge', sets: 4, reps: 10 },
          { name: 'Rumänisches Kreuzheben', sets: 3, reps: 8, weightKg: 85 },
        ],
      });
      dayRawLoad += strCalc.rawLoad;
    }

    // Special 10.0 km @ 4:30 min/km @ 150 bpm demo workout on 2 days ago (balanced/recovering) or 1 day ago (fatigued)
    const isSpecialRunDay =
      (scenarioId === 'balanced' && daysFromEnd === 2) ||
      (scenarioId === 'fatigued' && daysFromEnd === 1) ||
      (scenarioId === 'recovering' && daysFromEnd === 4);

    if (scenarioId === 'balanced' && daysFromEnd === 0) {
      // Already populated today's balanced workouts above
    } else if (isSpecialRunDay) {
      const { rawLoad, normalizedLoad, zoneMinutes } = calculateWorkoutLoad(
        { sport: 'running', durationMinutes: 45, avgHrBpm: 150, rpe: 6, distanceKm: 10.0 },
        profile,
        52
      );
      const { timeSeries, splits } = generatePlausibleWorkoutSeries(45, 10.0, 150, profile.maxHr);
      workouts.push({
        id: `wk_special_${dk}`,
        date: dk,
        timestamp: `${dk}T07:15:00`,
        sourceProvider: primaryProvider,
        sourceRecordId: `garmin_10k_${dk}`,
        dataQuality: 'high',
        provenance: 'measured',
        metricType: 'workout',
        title: 'Zügiger 10-km-Lauf',
        sport: 'running',
        startTimeIso: `${dk}T07:15:00`,
        durationMinutes: 45,
        distanceKm: 10.0,
        avgPaceSecPerKm: 270, // 4:30 min/km
        avgHrBpm: 150,
        maxHrBpm: 168,
        cadenceSpm: 176,
        elevationGainM: 64,
        rpe: 6,
        caloriesKcal: 615,
        rawLoadScore: rawLoad,
        normalizedLoad,
        hrZoneMinutes: zoneMinutes,
        timeSeries,
        splits,
      });
      dayRawLoad += rawLoad;
    } else if (!forceRest) {
      const shouldTrain = forceHardWorkout || [1, 2, 4, 5, 6].includes(weekday);
      if (shouldTrain && (rng() > 0.14 || forceHardWorkout)) {
        const roll = rng();
        if (forceHardWorkout || (weekday === 2 && roll > 0.25)) {
          // Tempo or intervals run
          const dur = forceHardWorkout ? 58 : 42 + Math.round(rng() * 14);
          const dist = Number((dur / 4.45).toFixed(1));
          const hr = forceHardWorkout ? 164 : 152 + Math.round(rng() * 10);
          const { rawLoad, normalizedLoad, zoneMinutes } = calculateWorkoutLoad(
            { sport: 'running', durationMinutes: dur, avgHrBpm: hr, rpe: forceHardWorkout ? 8 : 7, distanceKm: dist },
            profile,
            53
          );
          const { timeSeries, splits } = generatePlausibleWorkoutSeries(dur, dist, hr, profile.maxHr);
          workouts.push({
            id: `wk_${dk}`,
            date: dk,
            timestamp: `${dk}T17:40:00`,
            sourceProvider: primaryProvider,
            sourceRecordId: `garmin_run_${dk}`,
            dataQuality: 'high',
            provenance: 'measured',
            metricType: 'workout',
            title: forceHardWorkout ? 'Flotte Laufintervalle' : 'Zügiger Tempolauf',
            sport: 'running',
            startTimeIso: `${dk}T17:40:00`,
            durationMinutes: dur,
            distanceKm: dist,
            avgPaceSecPerKm: Math.round((dur * 60) / dist),
            avgHrBpm: hr,
            maxHrBpm: Math.min(profile.maxHr, hr + 16),
            cadenceSpm: 178,
            elevationGainM: Math.round(40 + rng() * 65),
            rpe: forceHardWorkout ? 8 : 7,
            caloriesKcal: Math.round(dur * 13.4),
            rawLoadScore: rawLoad,
            normalizedLoad,
            hrZoneMinutes: zoneMinutes,
            timeSeries,
            splits,
          });
          dayRawLoad += rawLoad;
        } else if (weekday === 4) {
          // Strength session
          const dur = 50;
          const { rawLoad, normalizedLoad, zoneMinutes } = calculateWorkoutLoad(
            { sport: 'strength', durationMinutes: dur, avgHrBpm: 118, rpe: 7 },
            profile,
            53
          );
          workouts.push({
            id: `wk_${dk}`,
            date: dk,
            timestamp: `${dk}T18:10:00`,
            sourceProvider: primaryProvider,
            sourceRecordId: `garmin_str_${dk}`,
            dataQuality: 'high',
            provenance: 'measured',
            metricType: 'workout',
            title: 'Krafttraining · Beine & Rumpf',
            sport: 'strength',
            startTimeIso: `${dk}T18:10:00`,
            durationMinutes: dur,
            avgHrBpm: 118,
            maxHrBpm: 146,
            rpe: 7,
            caloriesKcal: 360,
            rawLoadScore: rawLoad,
            normalizedLoad,
            hrZoneMinutes: zoneMinutes,
            hasDetailedExerciseLog: true,
            exercises: [
              { name: 'Kniebeugen (Langhantel)', sets: 4, reps: 6, weightKg: 90 },
              { name: 'Rumänisches Kreuzheben', sets: 3, reps: 8, weightKg: 85 },
              { name: 'Ausfallschritte gehend', sets: 3, reps: 12, weightKg: 32 },
              { name: 'Unterarmstütz (Plank)', sets: 3, reps: 60 },
            ],
          });
          dayRawLoad += rawLoad;
        } else if (weekday === 6 && roll > 0.45) {
          // Long run or cycling
          const isCycling = roll > 0.72;
          const dur = isCycling ? 95 : 72;
          const dist = isCycling ? 42.5 : 14.2;
          const hr = isCycling ? 136 : 142;
          const { rawLoad, normalizedLoad, zoneMinutes } = calculateWorkoutLoad(
            { sport: isCycling ? 'cycling' : 'running', durationMinutes: dur, avgHrBpm: hr, rpe: 6, distanceKm: dist },
            profile,
            53
          );
          const { timeSeries, splits } = generatePlausibleWorkoutSeries(dur, dist, hr, profile.maxHr);
          workouts.push({
            id: `wk_${dk}`,
            date: dk,
            timestamp: `${dk}T09:00:00`,
            sourceProvider: primaryProvider,
            sourceRecordId: `garmin_end_${dk}`,
            dataQuality: 'high',
            provenance: 'measured',
            metricType: 'workout',
            title: isCycling ? 'Ruhige Ausfahrt Rad' : 'Langer ruhiger Lauf',
            sport: isCycling ? 'cycling' : 'running',
            startTimeIso: `${dk}T09:00:00`,
            durationMinutes: dur,
            distanceKm: dist,
            avgPaceSecPerKm: isCycling ? undefined : Math.round((dur * 60) / dist),
            avgHrBpm: hr,
            maxHrBpm: hr + 15,
            cadenceSpm: isCycling ? 88 : 172,
            elevationGainM: isCycling ? 420 : 125,
            rpe: 6,
            caloriesKcal: Math.round(dur * 11.2),
            rawLoadScore: rawLoad,
            normalizedLoad,
            hrZoneMinutes: zoneMinutes,
            timeSeries,
            splits: isCycling ? undefined : splits,
          });
          dayRawLoad += rawLoad;
        } else {
          // Easy aerobic run
          const dur = daysFromEnd === 0 ? 0 : 36;
          if (dur > 0) {
            const dist = 6.5;
            const hr = 135;
            const { rawLoad, normalizedLoad, zoneMinutes } = calculateWorkoutLoad(
              { sport: 'running', durationMinutes: dur, avgHrBpm: hr, rpe: 4, distanceKm: dist },
              profile,
              53
            );
            const { timeSeries, splits } = generatePlausibleWorkoutSeries(dur, dist, hr, profile.maxHr);
            workouts.push({
              id: `wk_${dk}`,
              date: dk,
              timestamp: `${dk}T07:30:00`,
              sourceProvider: primaryProvider,
              sourceRecordId: `garmin_easy_${dk}`,
              dataQuality: 'high',
              provenance: 'measured',
              metricType: 'workout',
              title: 'Ruhiger Dauerlauf',
              sport: 'running',
              startTimeIso: `${dk}T07:30:00`,
              durationMinutes: dur,
              distanceKm: dist,
              avgPaceSecPerKm: Math.round((dur * 60) / dist),
              avgHrBpm: hr,
              maxHrBpm: 149,
              cadenceSpm: 170,
              elevationGainM: 32,
              rpe: 4,
              caloriesKcal: 430,
              rawLoadScore: rawLoad,
              normalizedLoad,
              hrZoneMinutes: zoneMinutes,
              timeSeries,
              splits,
            });
            dayRawLoad += rawLoad;
          }
        }
      }
    }

    // Sleep session (crossing midnight from prevDay to dk)
    if (!missingSleepEntirely) {
      const prevDay = addDaysToKey(dk, -1);
      const bedHour = 22;
      const bedMinNoise = Math.round((rng() - 0.5) * 46 + (scenarioSleepShift < -30 ? 48 : 0));
      const bedTotalMin = bedHour * 60 + 40 + bedMinNoise;
      const actualBedH = Math.floor(bedTotalMin / 60) % 24;
      const actualBedM = ((bedTotalMin % 60) + 60) % 60;
      const bedtimeDateStr = bedTotalMin >= 24 * 60 ? dk : prevDay;
      const bedtimeIso = `${bedtimeDateStr}T${String(actualBedH).padStart(2, '0')}:${String(actualBedM).padStart(2, '0')}:00`;

      const targetSleep = 472 + Math.round((rng() - 0.45) * 48) + Math.round(scenarioSleepShift);
      const totalSleepMinutes = Math.max(290, Math.min(555, targetSleep));
      const awakeMinutes = Math.round(14 + rng() * 20 + (scenarioSleepShift < -30 ? 18 : 0));
      const timeInBedMinutes = totalSleepMinutes + awakeMinutes;
      const wakeDate = new Date(new Date(bedtimeIso).getTime() + timeInBedMinutes * 60000);
      const wakeTimeIso = `${toLocalDateKey(wakeDate)}T${String(wakeDate.getHours()).padStart(2, '0')}:${String(wakeDate.getMinutes()).padStart(2, '0')}:00`;
      const efficiencyPercent = Math.round((totalSleepMinutes / timeInBedMinutes) * 100);

      const stageResult = missingSleepStages
        ? null
        : buildSleepStages(totalSleepMinutes, awakeMinutes, rng);

      sleepSessions.push({
        id: `slp_${dk}`,
        date: dk,
        timestamp: wakeTimeIso,
        sourceProvider: secondaryProvider,
        sourceRecordId: `oura_slp_${dk}`,
        dataQuality: missingSleepStages ? 'moderate' : 'high',
        provenance: 'wearable_estimate',
        metricType: 'sleep_session',
        bedtimeIso,
        wakeTimeIso,
        timeInBedMinutes,
        totalSleepMinutes,
        awakeMinutes,
        lightMinutes: stageResult ? stageResult.lightMin : null,
        deepMinutes: stageResult ? stageResult.deepMin : null,
        remMinutes: stageResult ? stageResult.remMin : null,
        hasStageData: !missingSleepStages,
        efficiencyPercent,
        awakeningsCount: Math.max(1, Math.round(awakeMinutes / 11)),
        stages: stageResult ? stageResult.stages : [],
      });
    }

    // Physiological response to previous day load & sleep
    const sleepDeltaFactor = scenarioSleepShift * 0.06;
    const fatiguePenalty = prevAcuteFatigue * 0.075;

    if (!missingHrv) {
      const hrvVal = Math.round(
        Math.max(28, baseHrv + scenarioHrvShift + sleepDeltaFactor - fatiguePenalty + (rng() - 0.5) * 8)
      );
      hrvObservations.push({
        id: `hrv_${dk}`,
        date: dk,
        timestamp: `${dk}T06:35:00`,
        sourceProvider: secondaryProvider,
        sourceRecordId: `oura_hrv_${dk}`,
        dataQuality: 'high',
        provenance: 'measured',
        metricType: 'hrv_rmssd',
        unit: 'ms',
        value: hrvVal,
        recordingContext: 'overnight_avg',
      });
    }

    const rhrVal = Math.round(
      Math.max(41, baseRhr + scenarioRhrShift + fatiguePenalty * 0.35 + (rng() - 0.5) * 2.4)
    );
    rhrObservations.push({
      id: `rhr_${dk}`,
      date: dk,
      timestamp: `${dk}T06:30:00`,
      sourceProvider: secondaryProvider,
      sourceRecordId: `oura_rhr_${dk}`,
      dataQuality: 'high',
      provenance: 'measured',
      metricType: 'resting_hr',
      unit: 'bpm',
      value: rhrVal,
      recordingContext: 'overnight_min',
    });

    // Update rolling fatigue carryover for next day
    prevAcuteFatigue = prevAcuteFatigue * 0.62 + (dayRawLoad > 0 ? dayRawLoad * 0.55 : 0);

    // Daily Activity Summary
    const stepsBase = dayRawLoad > 0 ? 9200 + dayRawLoad * 38 : 6400;
    const steps = Math.round(
      (daysFromEnd === 0 ? 4820 : stepsBase) + (rng() - 0.5) * 1800
    );
    dailyActivities.push({
      id: `act_${dk}`,
      date: dk,
      timestamp: `${dk}T21:00:00`,
      sourceProvider: primaryProvider,
      sourceRecordId: `garmin_act_${dk}`,
      dataQuality: 'high',
      provenance: 'measured',
      metricType: 'daily_activity',
      steps: Math.max(2100, steps),
      activeMinutes: dayRawLoad > 0 ? Math.round(45 + dayRawLoad * 0.4) : 28,
      sedentaryMinutes: 460 + Math.round(rng() * 90),
      estimatedEnergyKcal: Math.round(2150 + steps * 0.036 + dayRawLoad * 4.5),
      vo2MaxEstimate: Number((baseVo2 + (scenarioId === 'fatigued' && daysFromEnd < 4 ? -0.3 : 0)).toFixed(1)),
      respiratoryRateBpm: Number((14.2 + (scenarioId === 'fatigued' && daysFromEnd < 4 ? 0.9 : 0) + (rng() - 0.5) * 0.6).toFixed(1)),
      spo2Percent: daysFromEnd % 9 === 0 ? undefined : Math.round(97 + rng() * 2),
      skinTempDeviationC: Number(((scenarioId === 'fatigued' && daysFromEnd < 3 ? 0.35 : 0) + (rng() - 0.5) * 0.35).toFixed(2)),
    });

    // Weekly body measurements
    if (daysFromEnd % 7 === 0 || daysFromEnd === 0) {
      bodyMeasurements.push({
        id: `body_${dk}`,
        date: dk,
        timestamp: `${dk}T07:10:00`,
        sourceProvider: 'withings',
        sourceRecordId: `withings_${dk}`,
        dataQuality: 'high',
        provenance: 'measured',
        metricType: 'body_measurement',
        weightKg: Number((73.2 - adaptationProgress * 0.9 + (rng() - 0.5) * 0.4).toFixed(1)),
        bodyFatPercent: Number((14.6 - adaptationProgress * 0.7).toFixed(1)),
        muscleMassKg: 59.2,
      });
    }

    // Recent journal entries (leave balanced today open so the daily subjective check-in invites interaction)
    const shouldSeedJournalToday = daysFromEnd > 0 || scenarioId !== 'balanced';
    if (daysFromEnd <= 4 && shouldSeedJournalToday) {
      journalEntries.push({
        date: dk,
        updatedAt: `${dk}T08:05:00`,
        subjectiveSleepQuality: scenarioId === 'fatigued' ? 2 : scenarioId === 'recovering' ? 3 : 4,
        stressLevel: scenarioId === 'fatigued' ? 4 : 2,
        energyLevel: scenarioId === 'fatigued' ? 2 : scenarioId === 'recovering' ? 3 : 4,
        muscleSoreness: scenarioId === 'fatigued' ? 4 : 2,
        mood: scenarioId === 'fatigued' ? 3 : 4,
        subjectiveFatigue: scenarioId === 'fatigued' ? 4 : scenarioId === 'recovering' && daysFromEnd > 2 ? 3 : 2,
        hydrationLiters: 2.4,
        caffeineMg: 140,
        alcoholDrinks: 0,
        illnessSymptoms: false,
        notes:
          daysFromEnd === 0
            ? scenarioId === 'fatigued'
              ? 'Beine fühlen sich nach den letzten flotten Läufen noch schwer an.'
              : 'Ruhig aufgewacht, bereit für den Tag.'
            : undefined,
      });
    }
  }

  return {
    scenarioId,
    profile,
    connectedSources,
    sourcePriorities,
    hrvObservations,
    rhrObservations,
    sleepSessions,
    workouts,
    dailyActivities,
    bodyMeasurements,
    journalEntries,
  };
}
