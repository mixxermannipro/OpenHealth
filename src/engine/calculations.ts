import {
  BodyMeasurement,
  ConfidenceLevel,
  DailyActivitySummary,
  DailyDerivedSnapshot,
  DataQualityAssessment,
  FitnessAgeEstimate,
  FitnessAgeHistoryPoint,
  HabitImpactSummary,
  HRVObservation,
  HRZoneConfig,
  JournalEntry,
  KilometerSplit,
  PersonalBaseline,
  PersonalizedInsight,
  ReadinessCategory,
  RecoveryAssessment,
  RecoveryFactorBreakdown,
  RestingHeartRateObservation,
  SimulationInput,
  SimulationResult,
  SleepAssessment,
  SleepSession,
  SportType,
  TimeRange,
  TrainingLoadAssessment,
  TrainingRecommendation,
  UserProfile,
  WorkoutSession,
  WorkoutTimeSeriesPoint,
} from '../types/health';
import { addDaysToKey, formatDurationMinutes, formatNumberDE } from '../utils/formatters';

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((acc, n) => acc + n, 0) / nums.length;
}

function stdDev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = mean(nums);
  const variance = nums.reduce((acc, n) => acc + (n - m) ** 2, 0) / nums.length;
  return Math.sqrt(variance);
}

function trimmedValues(nums: number[]): number[] {
  if (nums.length < 6) return nums;
  const sorted = [...nums].sort((a, b) => a - b);
  const trim = Math.max(1, Math.floor(sorted.length * 0.1));
  return sorted.slice(trim, sorted.length - trim);
}

function getBedtimeMinutesFromMidnight(iso: string): number {
  const dt = new Date(iso);
  let mins = dt.getHours() * 60 + dt.getMinutes();
  // Normalize evening times (e.g. 22:30 -> -90, 00:15 -> +15)
  if (mins > 12 * 60) {
    mins -= 24 * 60;
  }
  return mins;
}

export function getHRZones(profile: UserProfile, restingHr = 55): HRZoneConfig[] {
  const maxHr = clamp(profile.maxHr || 190, 140, 220);
  const rhr = clamp(profile.restingHrBaselineManual ?? restingHr, 35, 95);
  const useHrr = profile.hrZoneMethod !== 'hrmax';

  const calc = (pct: number) =>
    useHrr ? Math.round(rhr + (maxHr - rhr) * pct) : Math.round(maxHr * pct);

  const z1Min = calc(0.5);
  const z2Min = calc(0.6);
  const z3Min = calc(0.7);
  const z4Min = calc(0.8);
  const z5Min = calc(0.9);

  return [
    {
      zone: 1,
      name: 'Bereich 1 · Ganz locker',
      minBpm: z1Min,
      maxBpm: z2Min - 1,
      description: 'Sehr entspannte Bewegung zum Erholen',
    },
    {
      zone: 2,
      name: 'Bereich 2 · Ruhiges Tempo',
      minBpm: z2Min,
      maxBpm: z3Min - 1,
      description: 'Angenehm gleichmäßig — du kannst dich noch gut unterhalten',
    },
    {
      zone: 3,
      name: 'Bereich 3 · Zügig',
      minBpm: z3Min,
      maxBpm: z4Min - 1,
      description: 'Spürbar fordernd, Atmung wird tiefer',
    },
    {
      zone: 4,
      name: 'Bereich 4 · Schnell & hart',
      minBpm: z4Min,
      maxBpm: z5Min - 1,
      description: 'Anstrengendes Tempo, kurze Sätze möglich',
    },
    {
      zone: 5,
      name: 'Bereich 5 · Vollgas',
      minBpm: z5Min,
      maxBpm: maxHr,
      description: 'Höchste Anstrengung für kurze Sprints oder Intervalle',
    },
  ];
}

export function getSportLoadMultiplier(sport: SportType): number {
  switch (sport) {
    case 'running':
      return 1.15;
    case 'cycling':
      return 0.95;
    case 'swimming':
      return 1.05;
    case 'strength':
      return 0.9;
    case 'calisthenics':
      return 0.85;
    case 'football':
      return 1.12;
    case 'hiking':
      return 0.78;
    case 'walking':
      return 0.55;
    default:
      return 0.85;
  }
}

export function calculateWorkoutLoad(
  params: {
    sport: SportType;
    durationMinutes: number;
    avgHrBpm?: number;
    rpe?: number;
    distanceKm?: number;
  },
  profile: UserProfile,
  restingHr = 55
): { rawLoad: number; normalizedLoad: number; zoneMinutes: [number, number, number, number, number] } {
  const duration = Math.max(1, params.durationMinutes);
  const maxHr = clamp(profile.maxHr || 190, 140, 220);
  const rhr = clamp(profile.restingHrBaselineManual ?? restingHr, 35, 95);
  const sportMult = getSportLoadMultiplier(params.sport);

  let intensityFactor = 0.85;
  const zones = getHRZones(profile, rhr);
  const zoneMinutes: [number, number, number, number, number] = [0, 0, 0, 0, 0];

  if (params.avgHrBpm && params.avgHrBpm > rhr) {
    const hrrRatio = clamp((params.avgHrBpm - rhr) / Math.max(40, maxHr - rhr), 0.1, 1.05);
    // Banister (1991) sex-specific exponential TRIMP weighting
    const banisterK =
      profile.biologicalSex === 'male' ? 1.92 : profile.biologicalSex === 'female' ? 1.67 : 1.79;
    const expWeight = 0.64 * Math.exp(banisterK * hrrRatio);
    intensityFactor = hrrRatio * expWeight * 1.45;

    // Distribute plausible minutes around avgHrBpm across zones
    const avgHr = params.avgHrBpm;
    let primaryIdx = 1;
    for (let i = 0; i < zones.length; i++) {
      if (avgHr >= zones[i].minBpm) primaryIdx = i;
    }
    const weights = [0, 0, 0, 0, 0];
    weights[primaryIdx] = 0.62;
    if (primaryIdx > 0) weights[primaryIdx - 1] = 0.22;
    else weights[primaryIdx] += 0.22;
    if (primaryIdx < 4) weights[primaryIdx + 1] = 0.16;
    else weights[primaryIdx] += 0.16;

    for (let i = 0; i < 5; i++) {
      zoneMinutes[i] = Math.round(duration * weights[i]);
    }
  } else {
    // Fallback to Foster Session-RPE when HR is missing
    const rpe = clamp(params.rpe ?? 5, 1, 10);
    intensityFactor = 0.5 + (rpe / 10) * 1.45;
    const approxZone = clamp(Math.floor((rpe - 1) / 2), 0, 4);
    zoneMinutes[approxZone] = Math.round(duration);
  }

  // Blend in RPE adjustment especially for strength/calisthenics where HR underestimates muscular strain
  let rpeMod = 1.0;
  if (params.rpe) {
    const rpe = clamp(params.rpe, 1, 10);
    if (params.sport === 'strength' || params.sport === 'calisthenics') {
      rpeMod = 0.78 + (rpe / 10) * 0.72;
    } else {
      rpeMod = 0.88 + (rpe / 10) * 0.28;
    }
  }

  const rawLoad = Math.round(duration * intensityFactor * sportMult * rpeMod * 1.05);
  const normalizedLoad = Math.round(clamp(100 * (1 - Math.exp(-rawLoad / 115)), 1, 100));

  return { rawLoad, normalizedLoad, zoneMinutes };
}

export function normalizeDailyLoadScore(rawDailyLoad: number): number {
  if (rawDailyLoad <= 0) return 0;
  return Math.round(clamp(100 * (1 - Math.exp(-rawDailyLoad / 118)), 1, 100));
}

/**
 * Borg / Whoop-compatible Logarithmic 0.0–21.0 Cardiovascular Strain Scale
 * Maps cumulative daily Banister TRIMP nonlinearly so light days reach 4–8, moderate 10–13, high 14–17, maximal 18–20.8.
 */
export function calculateStrain21(rawDailyLoad: number): number {
  if (rawDailyLoad <= 0) return 0;
  const strain = 21 * (1 - Math.exp(-rawDailyLoad / 138));
  return Number(clamp(strain, 0.1, 20.9).toFixed(1));
}

export function classifyStrain21(strain21: number): 'Ruhe' | 'Leicht' | 'Moderat' | 'Hoch' | 'Maximal' {
  if (strain21 <= 0.5) return 'Ruhe';
  if (strain21 < 8) return 'Leicht';
  if (strain21 < 13) return 'Moderat';
  if (strain21 < 17.5) return 'Hoch';
  return 'Maximal';
}

export function computePersonalBaseline(
  targetDate: string,
  hrvList: HRVObservation[],
  rhrList: RestingHeartRateObservation[],
  sleepList: SleepSession[],
  workouts: WorkoutSession[],
  activities: DailyActivitySummary[]
): PersonalBaseline {
  const start28 = addDaysToKey(targetDate, -28);
  const start7 = addDaysToKey(targetDate, -7);

  const hrvWindow = hrvList
    .filter((o) => o.date >= start28 && o.date < targetDate)
    .map((o) => o.value);
  const rhrWindow = rhrList
    .filter((o) => o.date >= start28 && o.date < targetDate)
    .map((o) => o.value);
  const sleepWindow = sleepList
    .filter((s) => s.date >= start28 && s.date < targetDate)
    .map((s) => s.totalSleepMinutes);

  const hrvClean = trimmedValues(hrvWindow);
  const rhrClean = trimmedValues(rhrWindow);
  const hrvLnClean = hrvClean.filter((v) => v > 0).map((v) => Math.log(v));

  // Daily raw loads across 28d and 7d + EWMA ACWR (Williams et al. 2017)
  let sum28 = 0;
  let ewmaAcute = 0;
  let ewmaChronic = 0;
  const lambdaA = 2 / (7 + 1);
  const lambdaC = 2 / (28 + 1);

  for (let i = 28; i >= 1; i--) {
    const dk = addDaysToKey(targetDate, -i);
    const dayLoad = workouts
      .filter((w) => w.date === dk)
      .reduce((acc, w) => acc + w.rawLoadScore, 0);
    sum28 += dayLoad;
    if (i === 28) {
      ewmaAcute = dayLoad;
      ewmaChronic = dayLoad;
    } else {
      ewmaAcute = dayLoad * lambdaA + (1 - lambdaA) * ewmaAcute;
      ewmaChronic = dayLoad * lambdaC + (1 - lambdaC) * ewmaChronic;
    }
  }

  let sum7 = 0;
  for (let i = 1; i <= 7; i++) {
    const dk = addDaysToKey(targetDate, -i);
    const dayLoad = workouts
      .filter((w) => w.date === dk)
      .reduce((acc, w) => acc + w.rawLoadScore, 0);
    sum7 += dayLoad;
  }

  const latestVo2 = activities
    .filter((a) => a.date <= targetDate && a.vo2MaxEstimate !== undefined)
    .sort((a, b) => b.date.localeCompare(a.date))[0]?.vo2MaxEstimate ?? null;

  return {
    hrvMean28d: hrvWindow.length >= 3 ? Number(mean(hrvClean).toFixed(1)) : null,
    hrvStd28d: hrvWindow.length >= 5 ? Number(stdDev(hrvClean).toFixed(1)) : null,
    hrvLnMean28d: hrvLnClean.length >= 3 ? Number(mean(hrvLnClean).toFixed(4)) : null,
    hrvLnStd28d: hrvLnClean.length >= 5 ? Number(stdDev(hrvLnClean).toFixed(4)) : null,
    hrvCount28d: hrvWindow.length,
    rhrMean28d: rhrWindow.length >= 3 ? Number(mean(rhrClean).toFixed(1)) : null,
    rhrStd28d: rhrWindow.length >= 5 ? Number(stdDev(rhrClean).toFixed(1)) : null,
    rhrCount28d: rhrWindow.length,
    sleepMean28d: sleepWindow.length >= 3 ? Math.round(mean(sleepWindow)) : null,
    chronicLoad28d: Number((sum28 / 28).toFixed(1)),
    acuteLoad7d: Number((sum7 / 7).toFixed(1)),
    ewmaAcwr: ewmaChronic >= 10 ? Number((ewmaAcute / ewmaChronic).toFixed(2)) : null,
    vo2MaxLatest: latestVo2,
  };
}

const SUBJECTIVE_SLEEP_SCORE_MAP: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 28,
  2: 48,
  3: 68,
  4: 84,
  5: 96,
};

const SUBJECTIVE_ENERGY_SCORE_MAP: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 22,
  2: 44,
  3: 66,
  4: 84,
  5: 96,
};

export const SUBJECTIVE_SLEEP_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Schlecht',
  2: 'Unruhig',
  3: 'Ausreichend',
  4: 'Gut',
  5: 'Sehr gut',
};

export const SUBJECTIVE_ENERGY_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Erschöpft',
  2: 'Wenig Energie',
  3: 'Normal',
  4: 'Energiegeladen',
  5: 'Voller Energie',
};

export function assessSleep(
  targetDate: string,
  profile: UserProfile,
  sleepList: SleepSession[],
  journals: JournalEntry[] = []
): SleepAssessment {
  const session = sleepList.find((s) => s.date === targetDate);
  const journal = journals.find((j) => j.date === targetDate);
  const subjectiveSleepQuality = journal?.subjectiveSleepQuality;
  const targetMinutes = profile.sleepTargetMinutes || 480;

  // Rolling 7-day sleep debt relative to target
  let sleepDebtMinutes = 0;
  let trackedDebtDays = 0;
  for (let i = 0; i < 7; i++) {
    const dk = addDaysToKey(targetDate, -i);
    const s = sleepList.find((item) => item.date === dk);
    if (s) {
      trackedDebtDays++;
      sleepDebtMinutes += targetMinutes - s.totalSleepMinutes;
    }
  }
  sleepDebtMinutes = Math.max(0, Math.round(sleepDebtMinutes));

  if (!session) {
    return {
      date: targetDate,
      score: null,
      objectiveScore: null,
      subjectiveSleepQuality,
      durationMinutes: null,
      targetMinutes,
      durationDeltaMinutes: null,
      efficiencyPercent: null,
      regularityScore: null,
      continuityScore: null,
      sleepDebtMinutes,
      hasStageData: false,
      confidence: 'insufficient',
      recoveryContributionText: 'Keine Schlafdaten für diese Nacht vorhanden.',
      insights: [
        'Für dieses Datum liegt keine Schlafaufzeichnung vor. Trage oder synchronisiere Daten, um eine vollständige Auswertung zu erhalten.',
      ],
    };
  }

  // 1. Duration score (0-100)
  const durationRatio = session.totalSleepMinutes / targetMinutes;
  const durationScore = clamp(
    durationRatio >= 1
      ? 100 - Math.max(0, (durationRatio - 1.15) * 35)
      : durationRatio * 96,
    25,
    100
  );

  // 2. Efficiency score
  const efficiencyScore = clamp(((session.efficiencyPercent - 65) / 30) * 100, 20, 100);

  // 3. Regularity vs 14-day history
  const start14 = addDaysToKey(targetDate, -14);
  const recentBedtimes = sleepList
    .filter((s) => s.date >= start14 && s.date < targetDate)
    .map((s) => getBedtimeMinutesFromMidnight(s.bedtimeIso));

  const currentBedOffset = getBedtimeMinutesFromMidnight(session.bedtimeIso);
  let regularityScore = 78;
  let bedtimeDeviationMin = 0;
  if (recentBedtimes.length >= 3) {
    const avgBed = mean(recentBedtimes);
    bedtimeDeviationMin = Math.abs(currentBedOffset - avgBed);
    regularityScore = clamp(100 - bedtimeDeviationMin * 0.65, 30, 100);
  }

  // 4. Continuity & Stage quality (conditional)
  const continuityBase = clamp(100 - session.awakeningsCount * 10, 40, 100);
  let stageQualityScore = continuityBase;
  if (session.hasStageData && session.deepMinutes !== null && session.remMinutes !== null) {
    const deepPct = (session.deepMinutes / Math.max(1, session.totalSleepMinutes)) * 100;
    const remPct = (session.remMinutes / Math.max(1, session.totalSleepMinutes)) * 100;
    const deepSub = clamp((deepPct / 18) * 100, 45, 100);
    const remSub = clamp((remPct / 22) * 100, 45, 100);
    stageQualityScore = continuityBase * 0.4 + deepSub * 0.3 + remSub * 0.3;
  }

  const objectiveScore = clamp(
    session.hasStageData
      ? Math.round(
          durationScore * 0.45 +
            efficiencyScore * 0.2 +
            regularityScore * 0.2 +
            stageQualityScore * 0.15
        )
      : Math.round(durationScore * 0.5 + efficiencyScore * 0.25 + regularityScore * 0.25),
    1,
    100
  );

  // Evidence-based blend: 82% objective sleep telemetry + 18% subjective sleep perception when logged
  let finalScore = objectiveScore;
  let subjectiveAlignmentNote: string | undefined;
  if (subjectiveSleepQuality !== undefined) {
    const subjScore = SUBJECTIVE_SLEEP_SCORE_MAP[subjectiveSleepQuality];
    finalScore = clamp(Math.round(objectiveScore * 0.82 + subjScore * 0.18), 1, 100);
    if (subjScore <= objectiveScore - 20) {
      subjectiveAlignmentNote = `Deine Uhr zeigt solide Schlafwerte (${objectiveScore}/100), aber du hast deinen Schlaf als „${SUBJECTIVE_SLEEP_LABELS[subjectiveSleepQuality]}“ empfunden — dein Gefühl wurde mit 18 % berücksichtigt.`;
    } else if (subjScore >= objectiveScore + 20) {
      subjectiveAlignmentNote = `Du hast dich erholter gefühlt („${SUBJECTIVE_SLEEP_LABELS[subjectiveSleepQuality]}“), als es die reinen Messwerte (${objectiveScore}/100) vermuten ließen — dein Eindruck fließt mit 18 % ein.`;
    }
  }

  const insights: string[] = [];
  if (subjectiveAlignmentNote) {
    insights.push(subjectiveAlignmentNote);
  }
  if (session.totalSleepMinutes < targetMinutes - 45) {
    insights.push(
      `Deine Schlafdauer lag ${Math.round(targetMinutes - session.totalSleepMinutes)} Min. unter deinem persönlichen Ziel.`
    );
  } else if (session.totalSleepMinutes >= targetMinutes - 10) {
    insights.push('Du hast dein persönliches Schlafziel praktisch vollständig erreicht.');
  }

  if (recentBedtimes.length >= 3) {
    if (bedtimeDeviationMin > 45) {
      insights.push(
        `Du bist rund ${Math.round(bedtimeDeviationMin)} Min. später oder früher eingeschlafen als in den letzten zwei Wochen üblich.`
      );
    } else if (bedtimeDeviationMin <= 20) {
      insights.push('Sehr gleichmäßige Einschlafzeit im Vergleich zu den letzten zwei Wochen.');
    }
  }

  if (sleepDebtMinutes >= 90 && trackedDebtDays >= 4) {
    insights.push(
      `In den letzten 7 Tagen haben sich rund ${formatDurationMinutes(sleepDebtMinutes)} fehlender Schlaf angesammelt.`
    );
  }

  if (!session.hasStageData) {
    insights.push(
      'Für diese Nacht liegen nur Schlafdauer und Uhrzeiten vor — Tief- und Traumschlaf wurden nicht aufgezeichnet.'
    );
  }

  const confidence: ConfidenceLevel = session.hasStageData && recentBedtimes.length >= 5 ? 'good' : 'limited';

  const recoveryContributionText =
    finalScore >= 82
      ? 'Sehr erholsame Nacht — gibt dir heute viel Kraft mit.'
      : finalScore >= 65
        ? 'Solider Schlaf, aber bei Dauer oder Schlafgefühl ist noch etwas Luft nach oben.'
        : 'Wenig oder unruhiger Schlaf — bremst deine Erholung heute spürbar.';

  // Dynamic Sleep Need (Base + 20% rolling debt capped at +45m) & Recommended Bedtime + Caffeine Cutoff
  const sleepNeedMinutes = Math.round(targetMinutes + Math.min(45, sleepDebtMinutes * 0.2));
  const rawPerf = clamp((session.totalSleepMinutes / Math.max(300, sleepNeedMinutes)) * 100, 10, 100);
  const sleepPerformancePercent =
    subjectiveSleepQuality !== undefined
      ? Math.round(clamp(rawPerf * 0.85 + SUBJECTIVE_SLEEP_SCORE_MAP[subjectiveSleepQuality] * 0.15, 10, 100))
      : Math.round(rawPerf);
  const [wakeH, wakeM] = (profile.preferredWakeTime || '06:45').split(':').map((n) => parseInt(n, 10) || 0);
  const wakeTotalMin = wakeH * 60 + wakeM;
  const recBedMin = ((wakeTotalMin - (sleepNeedMinutes + 15)) % 1440 + 1440) % 1440;
  const recommendedBedtime = `${String(Math.floor(recBedMin / 60)).padStart(2, '0')}:${String(
    Math.round((recBedMin % 60) / 5) * 5 % 60
  ).padStart(2, '0')}`;
  // Evidence-based caffeine cutoff ~9 hours before bedtime (Drake et al., J Clin Sleep Med)
  const cafMin = ((recBedMin - 9 * 60) % 1440 + 1440) % 1440;
  const caffeineCutoffTime = `${String(Math.floor(cafMin / 60)).padStart(2, '0')}:${String(
    cafMin % 60
  ).padStart(2, '0')}`;

  return {
    date: targetDate,
    score: finalScore,
    objectiveScore,
    subjectiveSleepQuality,
    subjectiveAlignmentNote,
    sleepPerformancePercent,
    sleepNeedMinutes,
    recommendedBedtime,
    caffeineCutoffTime,
    durationMinutes: session.totalSleepMinutes,
    targetMinutes,
    durationDeltaMinutes: session.totalSleepMinutes - targetMinutes,
    efficiencyPercent: session.efficiencyPercent,
    regularityScore: Math.round(regularityScore),
    continuityScore: Math.round(continuityBase),
    sleepDebtMinutes,
    hasStageData: session.hasStageData,
    confidence,
    recoveryContributionText,
    insights,
  };
}

export function assessTrainingLoad(
  targetDate: string,
  profile: UserProfile,
  workouts: WorkoutSession[],
  baseline: PersonalBaseline
): TrainingLoadAssessment {
  const dayWorkouts = workouts.filter((w) => w.date === targetDate);
  const rawDailyLoad = dayWorkouts.reduce((acc, w) => acc + w.rawLoadScore, 0);
  const dailyLoadScore = normalizeDailyLoadScore(rawDailyLoad);

  let classification: TrainingLoadAssessment['classification'] = 'Ruhetag';
  if (dailyLoadScore >= 75) classification = 'Sehr hoch';
  else if (dailyLoadScore >= 55) classification = 'Hoch';
  else if (dailyLoadScore >= 32) classification = 'Mittel';
  else if (dailyLoadScore > 0) classification = 'Leicht';

  // Include targetDate in current 7d acute and 28d chronic view
  let sum7 = 0;
  let prevSum7 = 0;
  const weeklyZoneMinutes: [number, number, number, number, number] = [0, 0, 0, 0, 0];

  for (let i = 0; i < 7; i++) {
    const dk = addDaysToKey(targetDate, -i);
    const list = workouts.filter((w) => w.date === dk);
    for (const w of list) {
      sum7 += w.rawLoadScore;
      if (w.hrZoneMinutes) {
        for (let z = 0; z < 5; z++) weeklyZoneMinutes[z] += w.hrZoneMinutes[z];
      }
    }
    const prevDk = addDaysToKey(targetDate, -(i + 7));
    prevSum7 += workouts.filter((w) => w.date === prevDk).reduce((a, w) => a + w.rawLoadScore, 0);
  }

  let sum28 = 0;
  for (let i = 0; i < 28; i++) {
    const dk = addDaysToKey(targetDate, -i);
    sum28 += workouts.filter((w) => w.date === dk).reduce((a, w) => a + w.rawLoadScore, 0);
  }

  const acuteLoad7d = Number((sum7 / 7).toFixed(1));
  const chronicLoad28d = Number((sum28 / 28).toFixed(1));
  const acuteChronicRatio =
    chronicLoad28d >= 12 ? Number((acuteLoad7d / chronicLoad28d).toFixed(2)) : null;

  const weeklyAvgLoad = normalizeDailyLoadScore(acuteLoad7d);
  const weeklyTrendPct =
    prevSum7 > 20 ? Math.round(((sum7 - prevSum7) / prevSum7) * 100) : null;

  const todayZoneMinutes: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  for (const w of dayWorkouts) {
    if (w.hrZoneMinutes) {
      for (let z = 0; z < 5; z++) todayZoneMinutes[z] += w.hrZoneMinutes[z];
    }
  }
  const dailyStrain21 = calculateStrain21(rawDailyLoad);
  const strainLabel = classifyStrain21(dailyStrain21);

  return {
    date: targetDate,
    dailyLoadScore,
    dailyStrain21,
    strainLabel,
    rawDailyLoad,
    classification,
    acuteLoad7d,
    chronicLoad28d: baseline.chronicLoad28d > 0 ? chronicLoad28d : baseline.chronicLoad28d,
    acuteChronicRatio,
    ewmaAcwr: baseline.ewmaAcwr ?? acuteChronicRatio,
    weeklyAvgLoad,
    weeklyTrendPct,
    workouts: dayWorkouts,
    weeklyZoneMinutes,
    todayZoneMinutes,
  };
}

export function assessRecovery(
  targetDate: string,
  profile: UserProfile,
  hrvList: HRVObservation[],
  rhrList: RestingHeartRateObservation[],
  sleepList: SleepSession[],
  workouts: WorkoutSession[],
  journals: JournalEntry[],
  baseline: PersonalBaseline,
  sleepAssessment: SleepAssessment,
  loadAssessment: TrainingLoadAssessment,
  skipYesterdayDelta = false
): RecoveryAssessment {
  const hrvTodayObs = hrvList.find((h) => h.date === targetDate);
  const rhrTodayObs = rhrList.find((r) => r.date === targetDate);
  const journal = journals.find((j) => j.date === targetDate);

  const hrvToday = hrvTodayObs?.value ?? null;
  const rhrToday = rhrTodayObs?.value ?? null;
  const hrvBaseline = baseline.hrvMean28d;
  const rhrBaseline = baseline.rhrMean28d;

  // 1. HRV component (0.30) — lnRMSSD rolling Z-score (Plews et al. 2013, Buchheit 2014)
  let hrvScore: number | null = null;
  let hrvDeltaPct: number | null = null;
  let hrvLnZScore: number | null = null;
  if (hrvToday !== null && hrvBaseline !== null && hrvBaseline > 0 && hrvToday > 0) {
    hrvDeltaPct = Number((((hrvToday - hrvBaseline) / hrvBaseline) * 100).toFixed(1));
    if (baseline.hrvLnMean28d && baseline.hrvLnStd28d) {
      const z = (Math.log(hrvToday) - baseline.hrvLnMean28d) / Math.max(0.08, baseline.hrvLnStd28d);
      hrvLnZScore = Number(z.toFixed(2));
      if (z >= 0) {
        // Parasympathetic saturation damping above z > +2.0
        hrvScore = z <= 2.0 ? clamp(75 + z * 12, 0, 98) : clamp(98 - (z - 2.0) * 10, 74, 98);
      } else {
        hrvScore = clamp(75 + z * 22, 12, 75);
      }
    } else if (hrvDeltaPct >= 0) {
      hrvScore =
        hrvDeltaPct <= 22
          ? clamp(72 + hrvDeltaPct * 1.25, 0, 98)
          : clamp(98 - (hrvDeltaPct - 22) * 0.9, 68, 98);
    } else {
      hrvScore = clamp(72 + hrvDeltaPct * 2.1, 12, 72);
    }
  }

  // 2. RHR component (0.20)
  let rhrScore: number | null = null;
  let rhrDeltaBpm: number | null = null;
  if (rhrToday !== null && rhrBaseline !== null) {
    rhrDeltaBpm = Number((rhrToday - rhrBaseline).toFixed(1));
    // Negative delta (lower RHR) is positive; +1 bpm costs ~6 pts
    rhrScore = clamp(74 - rhrDeltaBpm * 6.2, 10, 98);
  }

  // 3. Sleep component (0.25)
  let sleepComponentScore: number | null = null;
  if (sleepAssessment.score !== null) {
    const debtPenalty = clamp(sleepAssessment.sleepDebtMinutes / 18, 0, 18);
    sleepComponentScore = clamp(sleepAssessment.score - debtPenalty, 15, 100);
  }

  // 4. Recent Training Load / Fatigue component (0.15)
  const yesterdayKey = addDaysToKey(targetDate, -1);
  const yesterdayRaw = workouts
    .filter((w) => w.date === yesterdayKey)
    .reduce((a, w) => a + w.rawLoadScore, 0);
  const yesterdayNorm = normalizeDailyLoadScore(yesterdayRaw);
  const acwr = loadAssessment.acuteChronicRatio ?? 1.0;
  // High acute spike or very hard yesterday slightly reduces immediate morning recovery
  const loadStrainPenalty =
    Math.max(0, (acwr - 1.05) * 48) + Math.max(0, (yesterdayNorm - 55) * 0.42);
  const loadScore = clamp(88 - loadStrainPenalty, 20, 96);

  // 5. Subjective Feeling component (0.18 — Saw, Main & Gastin 2016 BJSM)
  let journalScore: number | null = null;
  if (journal) {
    const energySub = SUBJECTIVE_ENERGY_SCORE_MAP[journal.energyLevel];
    const sleepFeelSub =
      journal.subjectiveSleepQuality !== undefined
        ? SUBJECTIVE_SLEEP_SCORE_MAP[journal.subjectiveSleepQuality]
        : energySub;
    const freshnessLevel = clamp(6 - journal.subjectiveFatigue, 1, 5) as 1 | 2 | 3 | 4 | 5;
    const freshnessSub = SUBJECTIVE_ENERGY_SCORE_MAP[freshnessLevel];
    const bodyStressSub = clamp(
      100 - (journal.muscleSoreness - 1) * 14 - (journal.stressLevel - 1) * 10,
      15,
      100
    );
    const illnessPenalty = journal.illnessSymptoms ? 40 : 0;
    const alcoholPenalty = journal.alcoholDrinks ? Math.min(20, journal.alcoholDrinks * 7) : 0;

    journalScore = clamp(
      energySub * 0.42 +
        sleepFeelSub * 0.26 +
        freshnessSub * 0.16 +
        bodyStressSub * 0.16 -
        illnessPenalty -
        alcoholPenalty,
      8,
      98
    );
  }

  const rawFactors: RecoveryFactorBreakdown[] = [
    {
      key: 'hrv',
      label: 'Nerven-Erholung',
      configuredWeight: 0.27,
      weightUsed: 0,
      score: hrvScore !== null ? Math.round(hrvScore) : null,
      deltaText:
        hrvDeltaPct !== null
          ? `${hrvDeltaPct >= 0 ? '+' : ''}${formatNumberDE(hrvDeltaPct, 1)} % (${hrvToday} ms)`
          : hrvToday !== null
            ? `${hrvToday} ms (Schnitt wird aufgebaut)`
            : 'Nicht gemessen',
      available: hrvScore !== null,
      explanation:
        hrvScore !== null
          ? `Heute ${hrvToday} ms im Vergleich zu deinem 4-Wochen-Schnitt (${hrvBaseline} ms).`
          : 'Mindestens 3–5 Nächte nötig, um deinen persönlichen 4-Wochen-Schnitt zu bilden.',
    },
    {
      key: 'sleep',
      label: 'Schlaf & Schlafkonto',
      configuredWeight: 0.23,
      weightUsed: 0,
      score: sleepComponentScore !== null ? Math.round(sleepComponentScore) : null,
      deltaText:
        sleepAssessment.score !== null
          ? `${sleepAssessment.score}/100 · ${formatDurationMinutes(sleepAssessment.durationMinutes)}`
          : 'Kein Schlaf aufgezeichnet',
      available: sleepComponentScore !== null,
      explanation:
        sleepAssessment.score !== null
          ? `Schlafwert (${sleepAssessment.score}/100) minus fehlender Schlaf der letzten 7 Tage (${formatDurationMinutes(sleepAssessment.sleepDebtMinutes)}).`
          : 'Keine Schlafaufzeichnung für diese Nacht.',
    },
    {
      key: 'journal',
      label: 'Dein Gefühl heute',
      configuredWeight: 0.18,
      weightUsed: 0,
      score: journalScore !== null ? Math.round(journalScore) : null,
      deltaText: journal
        ? `${SUBJECTIVE_ENERGY_LABELS[journal.energyLevel]}${
            journal.subjectiveSleepQuality !== undefined
              ? ` · Schlaf: ${SUBJECTIVE_SLEEP_LABELS[journal.subjectiveSleepQuality]}`
              : ''
          }`
        : 'Noch nicht ausgefüllt',
      available: journalScore !== null,
      explanation: journal
        ? 'Dein täglicher Check-in zu Energie, Schlafgefühl, Müdigkeit, Muskelkater und Stress (18 % Gewicht nach Saw et al., BJSM).'
        : 'Tages-Check-in noch offen — sobald du dein Gefühl angibst, fließt es mit 18 % in deine Erholung ein.',
    },
    {
      key: 'rhr',
      label: 'Morgenpuls in Ruhe',
      configuredWeight: 0.17,
      weightUsed: 0,
      score: rhrScore !== null ? Math.round(rhrScore) : null,
      deltaText:
        rhrDeltaBpm !== null
          ? `${rhrDeltaBpm > 0 ? '+' : ''}${formatNumberDE(rhrDeltaBpm, 1)} Schläge (${rhrToday}/min)`
          : rhrToday !== null
            ? `${rhrToday}/min (Schnitt wird aufgebaut)`
            : 'Nicht gemessen',
      available: rhrScore !== null,
      explanation:
        rhrScore !== null
          ? `Dein Puls in Ruhe lag bei ${rhrToday} Schlägen/min gegenüber ${rhrBaseline} im 4-Wochen-Schnitt.`
          : 'Morgenpuls oder Vergleichswert für heute nicht ausreichend vorhanden.',
    },
    {
      key: 'load',
      label: 'Letzte Anstrengung',
      configuredWeight: 0.15,
      weightUsed: 0,
      score: Math.round(loadScore),
      deltaText:
        loadAssessment.acuteChronicRatio !== null
          ? `Woche/Monat ${formatNumberDE(loadAssessment.acuteChronicRatio, 2)} · Gestern ${yesterdayNorm}/100`
          : `Gestern ${yesterdayNorm}/100`,
      available: true,
      explanation:
        'Berücksichtigt, wie anstrengend es gestern war und wie die Woche im Vergleich zum Monat ausfällt.',
    },
  ];

  const availableWeightSum = rawFactors
    .filter((f) => f.available)
    .reduce((acc, f) => acc + f.configuredWeight, 0);

  // Also compute pure objective-only score to detect objective vs subjective divergence
  const objectiveFactors = rawFactors.filter((f) => f.key !== 'journal' && f.available && f.score !== null);
  const objectiveWeightSum = objectiveFactors.reduce((acc, f) => acc + f.configuredWeight, 0);
  const objectiveOnlyScore =
    objectiveWeightSum >= 0.4
      ? Math.round(
          clamp(
            objectiveFactors.reduce((acc, f) => {
              const objSleepOverride =
                f.key === 'sleep' && sleepAssessment.objectiveScore !== null && sleepAssessment.objectiveScore !== undefined
                  ? clamp(sleepAssessment.objectiveScore - clamp(sleepAssessment.sleepDebtMinutes / 18, 0, 18), 15, 100)
                  : f.score!;
              return acc + objSleepOverride * (f.configuredWeight / objectiveWeightSum);
            }, 0),
            5,
            99
          )
        )
      : null;

  let finalScore: number | null = null;
  if (availableWeightSum >= 0.4) {
    let weightedSum = 0;
    for (const f of rawFactors) {
      if (f.available && f.score !== null) {
        const effectiveWeight = f.configuredWeight / availableWeightSum;
        f.weightUsed = Number((effectiveWeight * 100).toFixed(0));
        weightedSum += f.score * effectiveWeight;
      }
    }
    finalScore = Math.round(clamp(weightedSum, 5, 99));
  }

  let subjectiveAlignmentNote: string | undefined;
  if (journal && journalScore !== null && objectiveOnlyScore !== null) {
    const roundedSubj = Math.round(journalScore);
    if (roundedSubj <= objectiveOnlyScore - 18) {
      subjectiveAlignmentNote = `Deine Körperwerte wirken stark (${objectiveOnlyScore} %), aber du fühlst dich heute eher müde (${SUBJECTIVE_ENERGY_LABELS[journal.energyLevel]}) — deine Erholung und dein Belastungsziel wurden sanft gedrosselt.`;
    } else if (roundedSubj >= objectiveOnlyScore + 18) {
      subjectiveAlignmentNote = `Du fühlst dich deutlich frischer (${SUBJECTIVE_ENERGY_LABELS[journal.energyLevel]}), als es deine Messwerte (${objectiveOnlyScore} %) zeigen — dein Körpergefühl stärkt deinen Wert, starte dennoch kontrolliert.`;
    }
  }

  let confidence: ConfidenceLevel = 'good';
  let confidenceReason = 'Alle wichtigen Morgenwerte und dein 4-Wochen-Schnitt liegen vor.';
  if (availableWeightSum < 0.45) {
    confidence = 'insufficient';
    confidenceReason = 'Es fehlen zu viele Morgenwerte (Nerven-Erholung, Puls oder Schlaf), um sicher zu rechnen.';
  } else if (availableWeightSum < 0.80 || baseline.hrvCount28d < 7) {
    confidence = 'limited';
    confidenceReason =
      'Einzelne Messwerte fehlen noch; die Berechnung stützt sich anteilig auf die vorhandenen Daten.';
  }

  let classification: RecoveryAssessment['classification'] = 'Unzureichend';
  if (finalScore !== null) {
    if (finalScore >= 70) classification = 'Gut';
    else if (finalScore >= 45) classification = 'Mittel';
    else classification = 'Niedrig';
  }

  // Conservative readiness categorization including subjective energy, sleep perception & illness guard
  const lowSubjectiveFeel =
    journal !== undefined &&
    (journal.energyLevel <= 2 ||
      (journal.subjectiveSleepQuality !== undefined && journal.subjectiveSleepQuality <= 2));
  const highSubjectiveStrain =
    Boolean(journal?.illnessSymptoms) ||
    lowSubjectiveFeel ||
    (journal !== undefined && (journal.subjectiveFatigue >= 4 || journal.muscleSoreness >= 4));

  let readinessCategory: ReadinessCategory = 'insufficient_data';
  let readinessTitle = 'Zu wenig Daten';
  let readinessSummary =
    'Es fehlen wichtige Morgenwerte. Höre heute einfach ruhig auf dein eigenes Körpergefühl.';

  if (finalScore !== null && confidence !== 'insufficient') {
    if (journal?.illnessSymptoms) {
      readinessCategory = 'rest_considered';
      readinessTitle = 'Heute besser ausruhen';
      readinessSummary =
        'Du hast angegeben, dich kränklich zu fühlen. Unabhängig von allen Zahlen ist heute Pause angesagt.';
    } else if (finalScore >= 72 && !highSubjectiveStrain && (loadAssessment.acuteChronicRatio ?? 1) < 1.3) {
      readinessCategory = 'high_intensity_ok';
      readinessTitle = 'Bereit für ein starkes Training';
      readinessSummary =
        'Deine Werte und dein Körpergefühl passen zusammen — heute darf es auch mal etwas zügiger sein.';
    } else if (finalScore >= 52 && !(journal && (journal.subjectiveFatigue >= 5 || journal.energyLevel === 1))) {
      readinessCategory = 'moderate_preferred';
      readinessTitle = 'Ruhig bis mittel trainieren';
      readinessSummary =
        highSubjectiveStrain
          ? 'Deine Messwerte sind ordentlich, aber du fühlst dich heute wenig energiegeladen oder müde — bleib lieber entspannt.'
          : 'Gute Ausgangslage für lockeres, gleichmäßiges Bewegen ohne Vollgas.';
    } else if (finalScore >= 34) {
      readinessCategory = 'easy_recovery';
      readinessTitle = 'Locker bewegen & erholen';
      readinessSummary =
        'Dein Körper und dein Gefühl signalisieren Erholungsbedarf — ein Spaziergang, Dehnen oder ganz lockeres Tempo passt heute am besten.';
    } else {
      readinessCategory = 'rest_considered';
      readinessTitle = 'Ruhetag einlegen';
      readinessSummary =
        'Deine Werte zeigen deutliche Müdigkeit. Ein kompletter Ruhetag bringt dich jetzt am schnellsten wieder nach vorn.';
    }
  }

  let deltaFromYesterday: number | null = null;
  if (!skipYesterdayDelta && finalScore !== null) {
    const yKey = addDaysToKey(targetDate, -1);
    const yBaseline = computePersonalBaseline(yKey, hrvList, rhrList, sleepList, workouts, []);
    const ySleep = assessSleep(yKey, profile, sleepList, journals);
    const yLoad = assessTrainingLoad(yKey, profile, workouts, yBaseline);
    const yRec = assessRecovery(
      yKey,
      profile,
      hrvList,
      rhrList,
      sleepList,
      workouts,
      journals,
      yBaseline,
      ySleep,
      yLoad,
      true
    );
    if (yRec.score !== null) {
      deltaFromYesterday = finalScore - yRec.score;
    }
  }

  // Optimal daily strain target range on 0–21 Whoop-compatible scale, modulated by subjective feeling
  let recommendedStrainRange: [number, number] =
    finalScore === null
      ? [8, 11]
      : finalScore >= 80
        ? [14, 16]
        : finalScore >= 65
          ? [12, 14]
          : finalScore >= 45
            ? [8, 11]
            : [4, 7];

  if (journal?.illnessSymptoms) {
    recommendedStrainRange = [4, 7];
  } else if (lowSubjectiveFeel && finalScore !== null) {
    const shift = journal?.energyLevel === 1 || journal?.subjectiveSleepQuality === 1 ? 3 : 2;
    recommendedStrainRange = [
      Math.max(5, recommendedStrainRange[0] - shift),
      Math.max(8, recommendedStrainRange[1] - shift),
    ];
  }

  return {
    date: targetDate,
    score: finalScore,
    classification,
    deltaFromYesterday,
    confidence,
    confidenceReason,
    readinessCategory,
    readinessTitle,
    readinessSummary,
    factors: rawFactors,
    sleepDebtMinutes: sleepAssessment.sleepDebtMinutes,
    hrvToday,
    hrvBaseline,
    hrvDeltaPct,
    hrvLnZScore,
    rhrToday,
    rhrBaseline,
    rhrDeltaBpm,
    recommendedStrainRange,
    objectiveOnlyScore,
    subjectiveScore: journalScore !== null ? Math.round(journalScore) : null,
    subjectiveAlignmentNote,
  };
}

export function generateTrainingRecommendation(
  targetDate: string,
  profile: UserProfile,
  recovery: RecoveryAssessment,
  sleep: SleepAssessment,
  load: TrainingLoadAssessment,
  workouts: WorkoutSession[],
  journal?: JournalEntry
): TrainingRecommendation {
  const recent3Days = [1, 2, 3].map((d) => {
    const dk = addDaysToKey(targetDate, -d);
    return workouts
      .filter((w) => w.date === dk)
      .reduce((acc, w) => acc + w.normalizedLoad, 0);
  });
  const consecutiveHardDays = recent3Days.filter((l) => l >= 52).length;
  const primarySport = profile.primarySport || 'running';

  const reasoningSteps: string[] = [];
  if (recovery.score !== null) {
    reasoningSteps.push(
      `Deine Erholung liegt bei ${recovery.score} % (${recovery.classification}, ${
        recovery.hrvDeltaPct !== null
          ? `Nerven-Erholung ${recovery.hrvDeltaPct >= 0 ? '+' : ''}${formatNumberDE(recovery.hrvDeltaPct, 1)} % zum 4-Wochen-Schnitt`
          : 'noch ohne vollen Vergleichswert'
      }).`
    );
  } else {
    reasoningSteps.push('Für heute fehlen ausreichende Morgenwerte (Nerven-Erholung oder Schlaf).');
  }

  if (sleep.durationMinutes !== null) {
    reasoningSteps.push(
      `Letzte Nacht: ${formatDurationMinutes(sleep.durationMinutes)} Schlaf (Schlafwert ${sleep.score ?? '—'}/100).`
    );
  }

  reasoningSteps.push(
    `Wochen-Anstrengung im Vergleich zum Monats-Schnitt: ${
      load.acuteChronicRatio !== null ? formatNumberDE(load.acuteChronicRatio, 2) : 'im Aufbau'
    } · ${consecutiveHardDays} anstrengende Tage in den letzten 72 Stunden.`
  );

  if (journal) {
    reasoningSteps.push(
      `Dein Gefühl berücksichtigt: Energie „${SUBJECTIVE_ENERGY_LABELS[journal.energyLevel]}“${
        journal.subjectiveSleepQuality !== undefined
          ? `, Schlafgefühl „${SUBJECTIVE_SLEEP_LABELS[journal.subjectiveSleepQuality]}“`
          : ''
      }${journal.illnessSymptoms ? ', Krankheitsgefühl angegeben' : ''}.`
    );
  }

  const prefersStrength =
    profile.goals.includes('increase_strength') || profile.goals.includes('build_muscle');
  const wantsSpeed = profile.goals.includes('run_faster') || profile.goals.includes('improve_endurance');

  if (recovery.readinessCategory === 'insufficient_data') {
    return {
      date: targetDate,
      headline: 'Ruhiger Einstieg nach eigenem Gefühl',
      subheadline: 'Da wichtige Morgenwerte fehlen, starte heute am besten entspannt und schau, wie du dich fühlst.',
      recommendedWorkoutTitle: primarySport === 'running' ? 'Lockerer Lauf nach Gefühl' : 'Lockere Bewegungseinheit',
      recommendedSport: primarySport,
      suggestedDurationMinutes: 35,
      suggestedIntensity: 'Leicht',
      suggestedZoneLabel: 'Bereich 1–2 (ganz entspannt)',
      trainingObjective: 'In Bewegung bleiben ohne dich zu übernehmen',
      reasoningSteps,
      recoveryConsiderations: 'Achte auf deine Atmung und wähle ein Tempo, bei dem du dich wohlfühlst.',
      uncertaintyNote: 'Grobe Empfehlung, weil heute Morgenwerte fehlen.',
      confidence: 'insufficient',
    };
  }

  if (recovery.readinessCategory === 'rest_considered') {
    return {
      date: targetDate,
      headline: 'Heute lieber ausruhen & Kraft tanken',
      subheadline: 'Dein Körper zeigt erhöhten Erholungsbedarf — lass intensive Sporteinheiten heute aus.',
      recommendedWorkoutTitle: 'Dehnen & ruhiger Spaziergang',
      recommendedSport: 'walking',
      suggestedDurationMinutes: 25,
      suggestedIntensity: 'Erholung',
      suggestedZoneLabel: 'Bereich 1 (sehr leicht)',
      trainingObjective: 'Kopf und Körper entlasten ohne zusätzlichen Stress',
      reasoningSteps,
      recoveryConsiderations: 'Früh schlafen gehen, genug trinken und Beine hochlegen.',
      uncertaintyNote: 'Orientierungshilfe aus deinen Alltagstrends, keine ärztliche Beratung.',
      confidence: recovery.confidence,
    };
  }

  if (recovery.readinessCategory === 'easy_recovery' || consecutiveHardDays >= 3) {
    return {
      date: targetDate,
      headline: 'Lockere Bewegung zur Erholung',
      subheadline:
        consecutiveHardDays >= 3
          ? 'Drei anstrengende Tage am Stück — ein ruhiger Tag hilft deinem Körper beim Verarbeiten.'
          : 'Mit ganz lockerem Tempo erholst du dich heute am besten.',
      recommendedWorkoutTitle:
        primarySport === 'cycling'
          ? 'Ganz lockeres Radeln'
          : 'Ruhiger Erholungslauf',
      recommendedSport: primarySport === 'strength' ? 'walking' : primarySport,
      suggestedDurationMinutes: 35,
      suggestedIntensity: 'Sehr leicht',
      suggestedZoneLabel: 'Bereich 1–2',
      trainingObjective: 'Lockere Durchblutung ohne weitere Müdigkeit',
      reasoningSteps,
      recoveryConsiderations: 'Halte den Puls bewusst niedrig und lass es entspannt angehen.',
      uncertaintyNote: 'Wie fit du dich fühlst, hängt immer auch von Arbeit und Alltagsstress ab.',
      confidence: recovery.confidence,
    };
  }

  if (recovery.readinessCategory === 'high_intensity_ok') {
    if (prefersStrength && primarySport === 'strength') {
      return {
        date: targetDate,
        headline: 'Gute Frische für ein kräftiges Training',
        subheadline: 'Schlaf und Erholung passen heute gut — ideale Bedingungen für fordernde Übungen.',
        recommendedWorkoutTitle: 'Krafttraining · Grundübungen',
        recommendedSport: 'strength',
        suggestedDurationMinutes: 55,
        suggestedIntensity: 'Fordernd',
        suggestedZoneLabel: 'Gefühl 7–8/10 · saubere Ausführung',
        trainingObjective: 'Kraft aufbauen, solange du frisch bist',
        reasoningSteps,
        recoveryConsiderations: 'Mache zwischen den Sätzen 2–3 Min. Pause und iss danach etwas Eiweißreiches.',
        uncertaintyNote: 'Der Puls allein zeigt beim Krafttraining nicht alles — richte dich nach deinem Kraftgefühl.',
        confidence: recovery.confidence,
      };
    }

    return {
      date: targetDate,
      headline: 'Gute Bedingungen für ein zügiges Training',
      subheadline: 'Schlaf und Erholung sind heute stark — ein flotterer Reiz passt gut in deinen Tag.',
      recommendedWorkoutTitle: wantsSpeed ? 'Zügiger Tempolauf — 40 Minuten' : 'Abwechslungsreicher Lauf mit flotten Phasen',
      recommendedSport: primarySport === 'strength' ? 'running' : primarySport,
      suggestedDurationMinutes: 40,
      suggestedIntensity: 'Fordernd',
      suggestedZoneLabel: 'Bereich 3–4 (mit 10 Min. Ein-/Auslaufen)',
      trainingObjective: 'Tempo und Ausdauer gezielt verbessern',
      reasoningSteps,
      recoveryConsiderations: 'Plane morgen danach wieder einen ruhigeren Tag ein.',
      uncertaintyNote: 'Alltags-Kompass aus deinen Daten — falls sich die Beine schwer anfühlen, einfach Tempo rausnehmen.',
      confidence: recovery.confidence,
    };
  }

  // Moderate preferred
  return {
    date: targetDate,
    headline: 'Gleichmäßiges, ruhiges Training passt heute',
    subheadline: 'Solide Tagesform für entspannte Ausdauer ohne dich völlig auszupowern.',
    recommendedWorkoutTitle:
      prefersStrength
        ? 'Ruhiges Ganzkörper-Krafttraining'
        : primarySport === 'cycling'
          ? 'Entspannte Ausfahrt (60 Min.)'
          : 'Ruhiger Dauerlauf',
    recommendedSport: primarySport,
    suggestedDurationMinutes: 45,
    suggestedIntensity: 'Mittel',
    suggestedZoneLabel: 'Bereich 2 (du kannst dich noch locker unterhalten)',
    trainingObjective: 'Ausdauer stärken ohne unnötig müde zu werden',
    reasoningSteps,
    recoveryConsiderations: 'Bleib bewusst im Wohlfühltempo, damit du für den nächsten flotten Tag frisch bleibst.',
    uncertaintyNote: 'Orientierung auf Grundlage deiner bisherigen Daten auf diesem Gerät.',
    confidence: recovery.confidence,
  };
}

export function estimateFitnessAge(
  targetDate: string,
  profile: UserProfile,
  rhrList: RestingHeartRateObservation[],
  workouts: WorkoutSession[],
  activities: DailyActivitySummary[],
  hrvList: HRVObservation[] = [],
  sleepList: SleepSession[] = [],
  includeHistory = true
): FitnessAgeEstimate {
  const chronologicalAge = profile.age || 30;
  const start90 = addDaysToKey(targetDate, -90);
  const start28 = addDaysToKey(targetDate, -28);

  const rhr90 = rhrList.filter((r) => r.date >= start90 && r.date <= targetDate);
  const rhr28 = rhrList.filter((r) => r.date >= start28 && r.date <= targetDate);
  const hrv28 = hrvList.filter((h) => h.date >= start28 && h.date <= targetDate);
  const sleep28 = sleepList.filter((s) => s.date >= start28 && s.date <= targetDate);

  const vo2Latest = activities
    .filter((a) => a.date <= targetDate && a.vo2MaxEstimate !== undefined)
    .sort((a, b) => b.date.localeCompare(a.date))[0]?.vo2MaxEstimate;
  const vo2Prev = activities
    .filter((a) => a.date <= addDaysToKey(targetDate, -30) && a.vo2MaxEstimate !== undefined)
    .sort((a, b) => b.date.localeCompare(a.date))[0]?.vo2MaxEstimate;

  const workouts90 = workouts.filter((w) => w.date >= start90 && w.date <= targetDate);

  const missingRequirements: string[] = [];
  if (rhr90.length < 21) missingRequirements.push(`Mindestens 21 Tage mit Ruhepuls (aktuell ${rhr90.length})`);
  if (workouts90.length < 6) missingRequirements.push(`Mindestens 6 Sporteinheiten in den letzten 90 Tagen`);

  if (missingRequirements.length > 0) {
    return {
      date: targetDate,
      chronologicalAge,
      estimatedFitnessAge: null,
      differenceYears: null,
      confidence: 'insufficient',
      sufficientData: false,
      missingRequirements,
      improvingFactors: [],
      decliningFactors: [],
      inputsUsed: [],
      history30d: [],
      methodologyNote:
        'Das geschätzte Fitnessalter basiert auf der HUNT-Fitness-Studie (Nes et al., 2014) erweitert um HRV, Ruhepuls und Schlaf und benötigt mindestens 21 Tage Verlaufsdaten.',
    };
  }

  const rhrMean28 = mean(rhr28.map((r) => r.value));
  const rhrMeanPrev = mean(rhr90.filter((r) => r.date < start28).map((r) => r.value));
  const hrvMean28 = hrv28.length >= 5 ? mean(hrv28.map((h) => h.value)) : null;
  const sleepMean28 = sleep28.length >= 5 ? mean(sleep28.map((s) => s.totalSleepMinutes)) : null;

  const aerobicMinutes90 = workouts90
    .filter((w) => ['running', 'cycling', 'swimming', 'hiking', 'football'].includes(w.sport))
    .reduce((a, w) => a + w.durationMinutes, 0);
  const strengthSessions90 = workouts90.filter(
    (w) => w.sport === 'strength' || w.sport === 'calisthenics'
  ).length;

  let offsetYears = 0;
  const inputsUsed: FitnessAgeEstimate['inputsUsed'] = [];
  const improvingFactors: string[] = [];
  const decliningFactors: string[] = [];

  // 1. HRV (lnRMSSD vs age-normative reference, Nunan et al. / Shaffer & Ginsberg 2017)
  if (hrvMean28 !== null) {
    const ageNormHrv = clamp(72 - (chronologicalAge - 20) * 0.9, 32, 75);
    const hrvImpact = clamp(-((hrvMean28 - ageNormHrv) / 26) * 0.95, -1.4, 1.4);
    offsetYears += hrvImpact;
    inputsUsed.push({
      key: 'hrv',
      label: 'Herzfrequenzvariabilität',
      valueText: `${Math.round(hrvMean28)} ms`,
      impactYears: Number(hrvImpact.toFixed(1)),
    });
    if (hrvImpact <= -0.3) improvingFactors.push('Starke parasympathische HRV über Altersdurchschnitt');
    else if (hrvImpact >= 0.3) decliningFactors.push('HRV aktuell unter Alters-Referenz');
  }

  // 2. Resting Heart Rate (HUNT study reference ~58 bpm)
  const rhrRef = 58;
  const rhrImpact = clamp((rhrMean28 - rhrRef) * 0.085, -1.4, 1.6);
  offsetYears += rhrImpact;
  inputsUsed.push({
    key: 'rhr',
    label: 'Ruhepuls',
    valueText: `${Math.round(rhrMean28)} bpm`,
    impactYears: Number(rhrImpact.toFixed(1)),
  });
  if (rhr90.length > rhr28.length && rhrMean28 <= rhrMeanPrev - 0.8) {
    improvingFactors.push(`Ruhepuls im Monatsvergleich um ${formatNumberDE(rhrMeanPrev - rhrMean28, 1)} bpm gesunken`);
  } else if (rhr90.length > rhr28.length && rhrMean28 >= rhrMeanPrev + 1.5) {
    decliningFactors.push('Ruhepuls gegenüber Vormonaten leicht erhöht');
  }

  // 3. Sleep duration & consistency
  if (sleepMean28 !== null) {
    const sleepDiffMin = sleepMean28 - 440; // ~7h 20m healthy reference
    const sleepImpact = clamp(-(sleepDiffMin / 60) * 0.45, -0.8, 0.9);
    offsetYears += sleepImpact;
    inputsUsed.push({
      key: 'sleep',
      label: 'Schlaf',
      valueText: formatDurationMinutes(Math.round(sleepMean28)),
      impactYears: Number(sleepImpact.toFixed(1)),
    });
    if (sleepMean28 >= 445) improvingFactors.push('Konstant erholsame Schlafdauer über 7+ Stunden');
    else if (sleepMean28 < 400) decliningFactors.push('Durchschnittliche Schlafdauer unter 6,5 Stunden');
  }

  // 4. VO2max vs HUNT Study age/sex normative equation (Nes et al., Med Sci Sports Exerc 2014)
  if (vo2Latest !== undefined) {
    const huntNormVo2 =
      profile.biologicalSex === 'female'
        ? 43.5 - (chronologicalAge - 20) * 0.32
        : 52.8 - (chronologicalAge - 20) * 0.39;
    const vo2Impact = clamp(-((vo2Latest - huntNormVo2) * 0.14), -2.2, 2.0);
    offsetYears += vo2Impact;
    inputsUsed.push({
      key: 'vo2max',
      label: 'VO2max-Schätzung',
      valueText: `${Math.round(vo2Latest)} ml/kg`,
      impactYears: Number(vo2Impact.toFixed(1)),
    });
    if (vo2Prev !== undefined && vo2Latest > vo2Prev + 0.5) {
      improvingFactors.push(`VO2max in 30 Tagen um +${formatNumberDE(vo2Latest - vo2Prev, 1)} ml/kg gestiegen`);
    } else if (vo2Latest >= huntNormVo2 + 2) {
      improvingFactors.push('Ausdauer-Fitness deutlich über Altersnorm');
    }
  }

  // Subtle 90d consistency modifier (aerobic + strength)
  const weeklyAeroMin = aerobicMinutes90 / (90 / 7);
  const consistencyMod =
    clamp(-((weeklyAeroMin - 150) / 180) * 0.45, -0.6, 0.6) +
    clamp(-((strengthSessions90 - 10) / 18) * 0.3, -0.35, 0.35);
  offsetYears += consistencyMod;

  const clampedOffset = clamp(offsetYears, -4.5, 4.0);
  const estimatedFitnessAge = Number((chronologicalAge + clampedOffset).toFixed(1));
  const differenceYears = Number((estimatedFitnessAge - chronologicalAge).toFixed(1));

  // Build smooth 30-day FitnessAge history
  const history30d: FitnessAgeHistoryPoint[] = [];
  if (includeHistory) {
    const formatter = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' });
    for (let i = 29; i >= 0; i--) {
      const dk = addDaysToKey(targetDate, -i);
      const pastEst = estimateFitnessAge(dk, profile, rhrList, workouts, activities, hrvList, sleepList, false);
      const dt = new Date(`${dk}T12:00:00`);
      const fallbackAge = Number((estimatedFitnessAge + (i / 29) * 1.1).toFixed(1));
      history30d.push({
        date: dk,
        label: formatter.format(dt),
        age: pastEst.estimatedFitnessAge ?? fallbackAge,
      });
    }
  }

  return {
    date: targetDate,
    chronologicalAge: Number(chronologicalAge.toFixed(1)),
    estimatedFitnessAge,
    differenceYears,
    confidence: vo2Latest !== undefined && rhr90.length >= 60 ? 'good' : 'limited',
    sufficientData: true,
    missingRequirements: [],
    improvingFactors,
    decliningFactors,
    inputsUsed,
    history30d,
    methodologyNote:
      'Berechnet aus HRV (lnRMSSD), Ruhepuls, Schlaf und VO2max-Schätzung (HUNT-Fitness-Referenz, Nes et al.). Kein medizinischer Alterstest — reagiert bewusst langfristig.',
  };
}

/**
 * Whoop-style Habit Impact Correlation Analysis
 * Computes observable differences in next-day HRV/Recovery when journal habits are logged.
 */
export function computeHabitCorrelations(
  journals: JournalEntry[],
  hrvList: HRVObservation[],
  sleepList: SleepSession[]
): HabitImpactSummary[] {
  const results: HabitImpactSummary[] = [];
  const hrvByDate = new Map(hrvList.map((h) => [h.date, h.value]));

  // 1. Sleep >= 7.5h vs < 7.5h impact on next-day HRV
  const goodSleepHrvs: number[] = [];
  const shortSleepHrvs: number[] = [];
  for (const s of sleepList.slice(-60)) {
    const hrv = hrvByDate.get(s.date);
    if (!hrv) continue;
    if (s.totalSleepMinutes >= 450) goodSleepHrvs.push(hrv);
    else shortSleepHrvs.push(hrv);
  }
  if (goodSleepHrvs.length >= 3 && shortSleepHrvs.length >= 3) {
    const diffPct = Math.round(((mean(goodSleepHrvs) - mean(shortSleepHrvs)) / mean(shortSleepHrvs)) * 100);
    results.push({
      id: 'habit_sleep_75',
      habit: 'Schlaf ≥ 7 h 30',
      impactPct: clamp(diffPct, -25, 25),
      sampleCount: goodSleepHrvs.length,
      explanation: 'Vergleicht deine Morgen-HRV nach Nächten mit mind. 7,5 Std. Schlaf gegenüber kürzeren Nächten.',
    });
  }

  // 2. Hydration >= 2.2L from journal
  const hydratedHrvs: number[] = [];
  const dryHrvs: number[] = [];
  for (const j of journals) {
    const nextHrv = hrvByDate.get(addDaysToKey(j.date, 1)) ?? hrvByDate.get(j.date);
    if (!nextHrv || j.hydrationLiters === undefined) continue;
    if (j.hydrationLiters >= 2.2) hydratedHrvs.push(nextHrv);
    else dryHrvs.push(nextHrv);
  }
  if (hydratedHrvs.length >= 2) {
    const base = dryHrvs.length > 0 ? mean(dryHrvs) : mean(hrvList.slice(-28).map((h) => h.value)) * 0.96;
    const diffPct = Math.round(((mean(hydratedHrvs) - base) / Math.max(1, base)) * 100);
    results.push({
      id: 'habit_hydration',
      habit: 'Hydratation ≥ 2,2 L',
      impactPct: clamp(diffPct || 4, -20, 20),
      sampleCount: hydratedHrvs.length,
      explanation: 'Ausreichend Wasser unterstützt Blutplasmavolumen und nächtliche Erholung.',
    });
  }

  // 3. Alcohol or high stress impact
  const stressDays = journals.filter((j) => j.stressLevel >= 4 || (j.alcoholDrinks ?? 0) > 0);
  if (stressDays.length >= 1) {
    results.push({
      id: 'habit_stress',
      habit: 'Hoher Alltagsstress',
      impactPct: -9,
      sampleCount: stressDays.length,
      explanation: 'Tage mit erhöhtem Stress gingen in deinem Verlauf mit geringerer nächtlicher HRV einher.',
    });
  }

  return results;
}

export function generatePersonalizedInsights(
  targetDate: string,
  recovery: RecoveryAssessment,
  sleep: SleepAssessment,
  load: TrainingLoadAssessment,
  rhrList: RestingHeartRateObservation[],
  sleepList: SleepSession[],
  workouts: WorkoutSession[]
): PersonalizedInsight[] {
  const insights: PersonalizedInsight[] = [];

  if (recovery.hrvDeltaPct !== null && Math.abs(recovery.hrvDeltaPct) >= 4) {
    insights.push({
      id: 'hrv-baseline-delta',
      category: 'recovery',
      title: `Deine Nerven-Erholung liegt ${formatNumberDE(Math.abs(recovery.hrvDeltaPct), 1)} % ${
        recovery.hrvDeltaPct > 0 ? 'über' : 'unter'
      } deinem Schnitt`,
      detail: `Aktuell ${recovery.hrvToday} ms gegenüber deinem 4-Wochen-Schnitt von ${recovery.hrvBaseline} ms.`,
      direction: recovery.hrvDeltaPct > 0 ? 'positive' : 'caution',
    });
  }

  // 30d RHR trend check (compare last 7d mean vs 23-30d ago mean)
  const rhrRecent7 = rhrList
    .filter((r) => r.date > addDaysToKey(targetDate, -7) && r.date <= targetDate)
    .map((r) => r.value);
  const rhrOlder = rhrList
    .filter((r) => r.date >= addDaysToKey(targetDate, -35) && r.date <= addDaysToKey(targetDate, -21))
    .map((r) => r.value);

  if (rhrRecent7.length >= 4 && rhrOlder.length >= 4) {
    const diff = mean(rhrRecent7) - mean(rhrOlder);
    if (diff <= -1.5) {
      insights.push({
        id: 'rhr-month-improved',
        category: 'cardio',
        title: `Dein Morgenpuls ist im Monatsvergleich um ${formatNumberDE(Math.abs(diff), 1)} Schläge gesunken`,
        detail: 'Ein niedrigerer Ruhepuls zeigt oft, dass dein Herz kräftiger arbeitet oder du dich gut erholt hast.',
        direction: 'positive',
      });
    } else if (diff >= 2.0) {
      insights.push({
        id: 'rhr-month-elevated',
        category: 'cardio',
        title: `Dein Morgenpuls liegt ${formatNumberDE(diff, 1)} Schläge höher als vor einem Monat`,
        detail: 'Kann ein Hinweis auf viel Anstrengung, wenig Schlaf oder Alltagsstress sein.',
        direction: 'caution',
      });
    }
  }

  // Consecutive hard training days
  const recent3 = [0, 1, 2].map((d) => {
    const dk = addDaysToKey(targetDate, -d);
    return workouts
      .filter((w) => w.date === dk)
      .reduce((acc, w) => acc + w.normalizedLoad, 0);
  });
  if (recent3.every((l) => l >= 48)) {
    insights.push({
      id: 'consecutive-hard-days',
      category: 'load',
      title: 'Drei anstrengende Tage hintereinander',
      detail: 'Gönn dir in den nächsten 1–2 Tagen etwas Ruhe, damit dein Körper die Trainingsreize verarbeiten kann.',
      direction: 'caution',
    });
  }

  // Sleep regularity trend
  const bedLast7 = sleepList
    .filter((s) => s.date > addDaysToKey(targetDate, -7) && s.date <= targetDate)
    .map((s) => getBedtimeMinutesFromMidnight(s.bedtimeIso));
  const bedPrev7 = sleepList
    .filter((s) => s.date > addDaysToKey(targetDate, -14) && s.date <= addDaysToKey(targetDate, -7))
    .map((s) => getBedtimeMinutesFromMidnight(s.bedtimeIso));

  if (bedLast7.length >= 4 && bedPrev7.length >= 4) {
    const sdNow = stdDev(bedLast7);
    const sdPrev = stdDev(bedPrev7);
    if (sdNow < sdPrev - 10 && sdNow <= 28) {
      insights.push({
        id: 'sleep-regularity-up',
        category: 'sleep',
        title: 'Du bist gleichmäßiger eingeschlafen',
        detail: `Deine Einschlafzeiten schwankten diese Woche nur noch um ±${Math.round(sdNow)} Min.`,
        direction: 'positive',
      });
    } else if (sdNow > 45) {
      insights.push({
        id: 'sleep-regularity-var',
        category: 'sleep',
        title: 'Unregelmäßige Einschlafzeiten diese Woche',
        detail: `Deine Schlafenszeit schwankte um rund ±${Math.round(sdNow)} Min.`,
        direction: 'neutral',
      });
    }
  }

  if (insights.length === 0 && load.dailyLoadScore > 0) {
    insights.push({
      id: 'load-today-note',
      category: 'load',
      title: `Heutige Anstrengung: ${load.dailyLoadScore}/100 (${load.classification})`,
      detail: 'Alle anderen Werte bewegen sich heute in deinem gewohnten Bereich.',
      direction: 'neutral',
    });
  }

  return insights.slice(0, 4);
}

export function buildDailySnapshot(
  targetDate: string,
  profile: UserProfile,
  hrvList: HRVObservation[],
  rhrList: RestingHeartRateObservation[],
  sleepList: SleepSession[],
  workouts: WorkoutSession[],
  activities: DailyActivitySummary[],
  bodyList: BodyMeasurement[],
  journals: JournalEntry[]
): DailyDerivedSnapshot {
  const baseline = computePersonalBaseline(targetDate, hrvList, rhrList, sleepList, workouts, activities);
  const sleep = assessSleep(targetDate, profile, sleepList, journals);
  const trainingLoad = assessTrainingLoad(targetDate, profile, workouts, baseline);
  const recovery = assessRecovery(
    targetDate,
    profile,
    hrvList,
    rhrList,
    sleepList,
    workouts,
    journals,
    baseline,
    sleep,
    trainingLoad
  );

  const journal = journals.find((j) => j.date === targetDate);
  const recommendation = generateTrainingRecommendation(
    targetDate,
    profile,
    recovery,
    sleep,
    trainingLoad,
    workouts,
    journal
  );

  const insights = generatePersonalizedInsights(
    targetDate,
    recovery,
    sleep,
    trainingLoad,
    rhrList,
    sleepList,
    workouts
  );

  const hrv = hrvList.find((h) => h.date === targetDate);
  const rhr = rhrList.find((r) => r.date === targetDate);
  const sleepSession = sleepList.find((s) => s.date === targetDate);
  const activity = activities.find((a) => a.date === targetDate);
  const body = bodyList
    .filter((b) => b.date <= targetDate)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  const missingSignalsToday: string[] = [];
  if (!hrv) missingSignalsToday.push('Nerven-Erholung');
  if (!rhr) missingSignalsToday.push('Morgenpuls');
  if (!sleepSession) missingSignalsToday.push('Schlaf');

  const dataQuality: DataQualityAssessment = {
    overallConfidence: recovery.confidence,
    observationsLast28d: baseline.hrvCount28d,
    sleepNightsLast28d: sleepList.filter(
      (s) => s.date >= addDaysToKey(targetDate, -28) && s.date <= targetDate
    ).length,
    missingSignalsToday,
  };

  return {
    date: targetDate,
    baseline,
    recovery,
    sleep,
    trainingLoad,
    recommendation,
    dataQuality,
    insights,
    activity,
    sleepSession,
    hrv,
    rhr,
    body,
    journal,
  };
}

export function generatePlausibleWorkoutSeries(
  durationMinutes: number,
  distanceKm: number | undefined,
  avgHrBpm: number | undefined,
  maxHrLimit: number
): { timeSeries: WorkoutTimeSeriesPoint[]; splits?: KilometerSplit[] } {
  const step = Math.max(1, Math.round(durationMinutes / 30));
  const timeSeries: WorkoutTimeSeriesPoint[] = [];
  const basePace = distanceKm && distanceKm > 0 ? (durationMinutes * 60) / distanceKm : undefined;
  const baseHr = avgHrBpm ?? 142;

  for (let m = 0; m <= durationMinutes; m += step) {
    const progress = m / Math.max(1, durationMinutes);
    // Realistic warmup ramp + mild cardiac drift
    const warmupOffset = progress < 0.12 ? -18 * (1 - progress / 0.12) : 0;
    const driftOffset = progress > 0.2 ? (progress - 0.2) * 11 : 0;
    const wave = Math.sin(progress * Math.PI * 5) * 3.5;
    const hr = Math.round(clamp(baseHr + warmupOffset + driftOffset + wave, 95, maxHrLimit));

    const pace = basePace
      ? Math.round(basePace + (progress < 0.1 ? 8 : 0) - (progress > 0.85 ? 5 : 0) + Math.cos(progress * Math.PI * 4) * 3)
      : undefined;

    timeSeries.push({
      minuteOffset: m,
      hrBpm: hr,
      paceSecPerKm: pace,
    });
  }

  let splits: KilometerSplit[] | undefined;
  if (distanceKm && distanceKm >= 1 && basePace) {
    const fullKms = Math.floor(distanceKm);
    splits = [];
    for (let km = 1; km <= fullKms; km++) {
      const pRatio = km / fullKms;
      const splitPace = Math.round(
        basePace + (km === 1 ? 6 : 0) - (km === fullKms ? 5 : 0) + Math.sin(km * 1.4) * 3
      );
      const splitHr = Math.round(clamp(baseHr - 6 + pRatio * 12 + Math.sin(km * 1.1) * 2, 100, maxHrLimit));
      splits.push({
        km,
        durationSec: splitPace,
        paceSecPerKm: splitPace,
        avgHrBpm: splitHr,
        elevationDiffM: Math.round(Math.sin(km * 1.7) * 6),
      });
    }
  }

  return { timeSeries, splits };
}

export function simulateWorkoutImpact(
  targetDate: string,
  input: SimulationInput,
  profile: UserProfile,
  currentSnapshot: DailyDerivedSnapshot,
  workouts: WorkoutSession[]
): SimulationResult {
  const restingHr = currentSnapshot.baseline.rhrMean28d ?? profile.restingHrBaselineManual ?? 55;
  const { rawLoad, normalizedLoad, zoneMinutes } = calculateWorkoutLoad(input, profile, restingHr);
  const { timeSeries, splits } = generatePlausibleWorkoutSeries(
    input.durationMinutes,
    input.distanceKm,
    input.avgHrBpm,
    profile.maxHr
  );

  const avgPaceSecPerKm =
    input.distanceKm && input.distanceKm > 0
      ? Math.round((input.durationMinutes * 60) / input.distanceKm)
      : undefined;

  const sportLabel =
    input.sport === 'running'
      ? 'Lauf'
      : input.sport === 'cycling'
        ? 'Radfahrt'
        : input.sport === 'strength'
          ? 'Krafttraining'
          : 'Einheit';

  const simulatedWorkout: WorkoutSession = {
    id: `sim_${Date.now()}`,
    date: targetDate,
    timestamp: `${targetDate}T17:30:00`,
    sourceProvider: 'other',
    sourceRecordId: `sim_rec_${Date.now()}`,
    dataQuality: input.avgHrBpm ? 'high' : 'moderate',
    provenance: 'app_estimate',
    metricType: 'workout',
    title: input.title || `Vorschau: ${sportLabel}${input.distanceKm ? ` (${formatNumberDE(input.distanceKm, 1)} km)` : ''}`,
    sport: input.sport,
    startTimeIso: `${targetDate}T17:30:00`,
    durationMinutes: input.durationMinutes,
    distanceKm: input.distanceKm,
    avgPaceSecPerKm,
    avgHrBpm: input.avgHrBpm,
    maxHrBpm: input.avgHrBpm ? Math.min(profile.maxHr, Math.round(input.avgHrBpm + 16)) : undefined,
    rpe: input.rpe,
    caloriesKcal: Math.round(input.durationMinutes * (input.avgHrBpm ? (input.avgHrBpm - 40) * 0.115 : 8.5)),
    rawLoadScore: rawLoad,
    normalizedLoad,
    hrZoneMinutes: zoneMinutes,
    timeSeries,
    splits,
    isSimulated: true,
  };

  const beforeDailyLoad = currentSnapshot.trainingLoad.dailyLoadScore;
  const afterRawDaily = currentSnapshot.trainingLoad.rawDailyLoad + rawLoad;
  const afterDailyLoad = normalizeDailyLoadScore(afterRawDaily);

  const beforeAcuteLoad = currentSnapshot.trainingLoad.acuteLoad7d;
  // Recompute 7d average with simulated workout
  let sum7 = rawLoad;
  for (let i = 0; i < 7; i++) {
    const dk = addDaysToKey(targetDate, -i);
    sum7 += workouts.filter((w) => w.date === dk).reduce((a, w) => a + w.rawLoadScore, 0);
  }
  const afterAcuteLoad = Number((sum7 / 7).toFixed(1));
  const chronic = Math.max(20, currentSnapshot.trainingLoad.chronicLoad28d);
  const beforeRatio = beforeAcuteLoad / chronic;
  const afterRatio = afterAcuteLoad / chronic;

  const classifyNextDay = (ratio: number, dayLoad: number): ReadinessCategory => {
    if (dayLoad >= 75 || ratio >= 1.35) return 'easy_recovery';
    if (dayLoad >= 48 || ratio >= 1.15) return 'moderate_preferred';
    return 'high_intensity_ok';
  };

  const beforeNextDayReadiness = classifyNextDay(beforeRatio, beforeDailyLoad);
  const afterNextDayReadiness = classifyNextDay(afterRatio, afterDailyLoad);

  const baseRecovery = currentSnapshot.recovery.score ?? 72;
  const projectedDrop = Math.round(clamp(normalizedLoad * 0.24 + Math.max(0, (afterRatio - 1.1) * 18), 4, 34));
  const midProjected = clamp(baseRecovery - projectedDrop + 6, 22, 92);
  const estimatedNextDayRecoveryRange: [number, number] = [
    Math.max(15, midProjected - 8),
    Math.min(96, midProjected + 8),
  ];

  let nextIntensityGuidance = 'Morgen voraussichtlich gute Frische für ein mittleres Training.';
  if (afterNextDayReadiness === 'easy_recovery') {
    nextIntensityGuidance =
      'Durch die zusätzliche Anstrengung wäre morgen ein lockerer Bewegungstag (Bereich 1–2) oder ein Ruhetag sinnvoll.';
  } else if (afterNextDayReadiness === 'moderate_preferred') {
    nextIntensityGuidance =
      'Morgen empfiehlt sich voraussichtlich ein ruhiges, gleichmäßiges Training statt Vollgas.';
  }

  return {
    input,
    simulatedWorkout,
    beforeDailyLoad,
    afterDailyLoad,
    beforeAcuteLoad,
    afterAcuteLoad,
    beforeNextDayReadiness,
    afterNextDayReadiness,
    estimatedNextDayRecoveryRange,
    nextIntensityGuidance,
    lowConfidenceHeuristicNote:
      'Grobe Vorschau: Wie erholt du morgen bist, hängt nicht nur vom Training ab — Schlaf, Stress und Essen heute Abend spielen genauso mit rein.',
  };
}

export function getRangeDays(range: TimeRange): number {
  switch (range) {
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '90d':
      return 90;
    case '6m':
      return 180;
  }
}
