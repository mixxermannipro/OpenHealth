import {
  ConnectedSource,
  DailyActivitySummary,
  DeviceProviderId,
  HRVObservation,
  RestingHeartRateObservation,
  SleepSession,
  SourcePriorityPreferences,
  UserProfile,
  WorkoutSession,
} from '../types/health';
import { addDaysToKey, toLocalDateKey } from '../utils/formatters';
import { calculateWorkoutLoad, generatePlausibleWorkoutSeries } from '../engine/calculations';

export interface SyncBatchPayload {
  providerId: DeviceProviderId;
  syncedAt: string;
  workouts: WorkoutSession[];
  hrvObservations: HRVObservation[];
  rhrObservations: RestingHeartRateObservation[];
  sleepSessions: SleepSession[];
  dailyActivities: DailyActivitySummary[];
}

export interface DeduplicationReport {
  importedWorkouts: number;
  deduplicatedWorkouts: number;
  importedObservations: number;
  deduplicatedObservations: number;
  notes: string[];
}

/**
 * Clean future-proof HealthDataProvider interface.
 * Production implementations require native SDKs (Apple HealthKit, Android Health Connect)
 * or server-backed OAuth2 vendor APIs (Garmin Health, Polar AccessLink, COROS, etc.).
 */
export interface HealthDataProvider {
  readonly providerId: DeviceProviderId;
  readonly displayName: string;
  readonly isSimulation: true;
  connect(): Promise<ConnectedSource>;
  disconnect(): Promise<void>;
  getConnectionStatus(): boolean;
  getCapabilities(): ConnectedSource['supportedDataTypes'];
  sync(todayKey: string, profile: UserProfile): Promise<SyncBatchPayload>;
  getLastSyncTime(): string | null;
}

export class SimulatedWearableProvider implements HealthDataProvider {
  public readonly providerId: DeviceProviderId;
  public readonly displayName: string;
  public readonly isSimulation = true as const;
  private sourceState: ConnectedSource;

  constructor(source: ConnectedSource) {
    this.providerId = source.providerId;
    this.displayName = source.name;
    this.sourceState = { ...source };
  }

  async connect(): Promise<ConnectedSource> {
    const nowIso = new Date().toISOString();
    this.sourceState = {
      ...this.sourceState,
      connected: true,
      lastSyncAt: nowIso,
    };
    return this.sourceState;
  }

  async disconnect(): Promise<void> {
    this.sourceState = {
      ...this.sourceState,
      connected: false,
    };
  }

  getConnectionStatus(): boolean {
    return this.sourceState.connected;
  }

  getCapabilities(): ConnectedSource['supportedDataTypes'] {
    return this.sourceState.supportedDataTypes;
  }

  getLastSyncTime(): string | null {
    return this.sourceState.lastSyncAt;
  }

  async sync(todayKey: string, profile: UserProfile): Promise<SyncBatchPayload> {
    const nowIso = new Date().toISOString();
    const workouts: WorkoutSession[] = [];
    const hrvObservations: HRVObservation[] = [];
    const rhrObservations: RestingHeartRateObservation[] = [];
    const sleepSessions: SleepSession[] = [];
    const dailyActivities: DailyActivitySummary[] = [];

    // Generate a realistic sync batch including:
    // 1) A potentially overlapping workout from 2 days ago (to test duplicate detection!)
    // 2) A fresh recovery/mobility or aerobic workout today
    const twoDaysAgo = addDaysToKey(todayKey, -2);
    const { rawLoad: dupRaw, normalizedLoad: dupNorm, zoneMinutes: dupZones } = calculateWorkoutLoad(
      { sport: 'running', durationMinutes: 45, avgHrBpm: 150, rpe: 6, distanceKm: 10.0 },
      profile,
      52
    );
    const dupSeries = generatePlausibleWorkoutSeries(45, 10.0, 150, profile.maxHr);

    workouts.push({
      id: `sync_${this.providerId}_dup_${twoDaysAgo}`,
      date: twoDaysAgo,
      timestamp: `${twoDaysAgo}T07:17:00`,
      sourceProvider: this.providerId,
      sourceRecordId: `${this.providerId}_10k_${twoDaysAgo}`,
      dataQuality: 'high',
      provenance: 'measured',
      metricType: 'workout',
      title: `10-km-Lauf (${this.displayName})`,
      sport: 'running',
      startTimeIso: `${twoDaysAgo}T07:17:00`,
      durationMinutes: 45,
      distanceKm: 10.0,
      avgPaceSecPerKm: 270,
      avgHrBpm: 150,
      maxHrBpm: 168,
      rpe: 6,
      caloriesKcal: 610,
      rawLoadScore: dupRaw,
      normalizedLoad: dupNorm,
      hrZoneMinutes: dupZones,
      timeSeries: dupSeries.timeSeries,
      splits: dupSeries.splits,
    });

    // Fresh today workout from this provider
    const freshDuration = this.providerId === 'garmin' || this.providerId === 'coros' ? 32 : 25;
    const freshDist = this.providerId === 'garmin' || this.providerId === 'coros' ? 5.6 : undefined;
    const freshSport = freshDist ? 'running' : 'calisthenics';
    const freshHr = freshDist ? 138 : 114;
    const { rawLoad, normalizedLoad, zoneMinutes } = calculateWorkoutLoad(
      { sport: freshSport, durationMinutes: freshDuration, avgHrBpm: freshHr, rpe: 4, distanceKm: freshDist },
      profile,
      52
    );
    const series = generatePlausibleWorkoutSeries(freshDuration, freshDist, freshHr, profile.maxHr);

    workouts.push({
      id: `sync_${this.providerId}_today_${todayKey}`,
      date: todayKey,
      timestamp: `${todayKey}T12:15:00`,
      sourceProvider: this.providerId,
      sourceRecordId: `${this.providerId}_sync_${todayKey}_fresh`,
      dataQuality: 'high',
      provenance: 'measured',
      metricType: 'workout',
      title: freshDist ? `Mittagslauf (${this.displayName})` : `Mobilität & Rumpf (${this.displayName})`,
      sport: freshSport,
      startTimeIso: `${todayKey}T12:15:00`,
      durationMinutes: freshDuration,
      distanceKm: freshDist,
      avgPaceSecPerKm: freshDist ? Math.round((freshDuration * 60) / freshDist) : undefined,
      avgHrBpm: freshHr,
      maxHrBpm: freshHr + 12,
      rpe: 4,
      caloriesKcal: freshDist ? 360 : 180,
      rawLoadScore: rawLoad,
      normalizedLoad,
      hrZoneMinutes: zoneMinutes,
      timeSeries: series.timeSeries,
      splits: series.splits,
    });

    if (this.sourceState.supportedDataTypes.includes('hrv')) {
      hrvObservations.push({
        id: `sync_${this.providerId}_hrv_${todayKey}`,
        date: todayKey,
        timestamp: `${todayKey}T06:40:00`,
        sourceProvider: this.providerId,
        sourceRecordId: `${this.providerId}_hrv_${todayKey}`,
        dataQuality: 'high',
        provenance: 'measured',
        metricType: 'hrv_rmssd',
        unit: 'ms',
        value: 67,
        recordingContext: 'overnight_avg',
      });
    }

    if (this.sourceState.supportedDataTypes.includes('rhr')) {
      rhrObservations.push({
        id: `sync_${this.providerId}_rhr_${todayKey}`,
        date: todayKey,
        timestamp: `${todayKey}T06:35:00`,
        sourceProvider: this.providerId,
        sourceRecordId: `${this.providerId}_rhr_${todayKey}`,
        dataQuality: 'high',
        provenance: 'measured',
        metricType: 'resting_hr',
        unit: 'bpm',
        value: 52,
        recordingContext: 'overnight_min',
      });
    }

    if (this.sourceState.supportedDataTypes.includes('steps')) {
      dailyActivities.push({
        id: `sync_${this.providerId}_act_${todayKey}`,
        date: todayKey,
        timestamp: nowIso,
        sourceProvider: this.providerId,
        sourceRecordId: `${this.providerId}_act_${todayKey}`,
        dataQuality: 'high',
        provenance: 'measured',
        metricType: 'daily_activity',
        steps: 7940,
        activeMinutes: 46,
        estimatedEnergyKcal: 2420,
        vo2MaxEstimate: 54.3,
      });
    }

    return {
      providerId: this.providerId,
      syncedAt: nowIso,
      workouts,
      hrvObservations,
      rhrObservations,
      sleepSessions,
      dailyActivities,
    };
  }
}

export function isDuplicateWorkout(existing: WorkoutSession, candidate: WorkoutSession): boolean {
  // 1. Exact source record identity match
  if (
    existing.sourceProvider === candidate.sourceProvider &&
    existing.sourceRecordId === candidate.sourceRecordId
  ) {
    return true;
  }

  // 2. Cross-provider duplicate heuristic:
  // Same date, same sport, start time within 20 minutes, duration within 15% (or <= 4 min),
  // and if distance exists on both, within 0.4 km.
  if (existing.date !== candidate.date || existing.sport !== candidate.sport) {
    return false;
  }

  const t1 = new Date(existing.startTimeIso).getTime();
  const t2 = new Date(candidate.startTimeIso).getTime();
  const timeDiffMin = Math.abs(t1 - t2) / 60000;
  const durDiffMin = Math.abs(existing.durationMinutes - candidate.durationMinutes);
  const maxDurTol = Math.max(4, existing.durationMinutes * 0.15);

  if (timeDiffMin > 20 || durDiffMin > maxDurTol) {
    return false;
  }

  if (existing.distanceKm !== undefined && candidate.distanceKm !== undefined) {
    if (Math.abs(existing.distanceKm - candidate.distanceKm) > 0.45) {
      return false;
    }
  }

  return true;
}

export function mergeSyncedBatch(
  current: {
    workouts: WorkoutSession[];
    hrvObservations: HRVObservation[];
    rhrObservations: RestingHeartRateObservation[];
    sleepSessions: SleepSession[];
    dailyActivities: DailyActivitySummary[];
  },
  batch: SyncBatchPayload,
  priorities: SourcePriorityPreferences
): {
  workouts: WorkoutSession[];
  hrvObservations: HRVObservation[];
  rhrObservations: RestingHeartRateObservation[];
  sleepSessions: SleepSession[];
  dailyActivities: DailyActivitySummary[];
  report: DeduplicationReport;
} {
  const nextWorkouts = [...current.workouts];
  const nextHrv = [...current.hrvObservations];
  const nextRhr = [...current.rhrObservations];
  const nextSleep = [...current.sleepSessions];
  const nextActivities = [...current.dailyActivities];

  let importedWorkouts = 0;
  let deduplicatedWorkouts = 0;
  let importedObservations = 0;
  let deduplicatedObservations = 0;
  const notes: string[] = [];

  for (const w of batch.workouts) {
    const dupIdx = nextWorkouts.findIndex((ex) => isDuplicateWorkout(ex, w));
    if (dupIdx !== -1) {
      deduplicatedWorkouts++;
      const existing = nextWorkouts[dupIdx];
      if (w.sourceProvider === priorities.workouts && existing.sourceProvider !== priorities.workouts) {
        nextWorkouts[dupIdx] = w;
        notes.push(
          `Training „${w.title}“ am ${w.date} wurde mit priorisierter Quelle (${w.sourceProvider}) zusammengeführt (keine Doppelzählung).`
        );
      } else {
        notes.push(
          `Duplikat erkannt: „${w.title}“ am ${w.date} bereits durch ${existing.sourceProvider} erfasst — Belastung nicht doppelt gezählt.`
        );
      }
    } else {
      nextWorkouts.push(w);
      importedWorkouts++;
    }
  }

  for (const h of batch.hrvObservations) {
    const idx = nextHrv.findIndex((ex) => ex.date === h.date);
    if (idx !== -1) {
      deduplicatedObservations++;
      if (h.sourceProvider === priorities.heartRate) nextHrv[idx] = h;
    } else {
      nextHrv.push(h);
      importedObservations++;
    }
  }

  for (const r of batch.rhrObservations) {
    const idx = nextRhr.findIndex((ex) => ex.date === r.date);
    if (idx !== -1) {
      deduplicatedObservations++;
      if (r.sourceProvider === priorities.heartRate) nextRhr[idx] = r;
    } else {
      nextRhr.push(r);
      importedObservations++;
    }
  }

  for (const a of batch.dailyActivities) {
    const idx = nextActivities.findIndex((ex) => ex.date === a.date);
    if (idx !== -1) {
      deduplicatedObservations++;
      if (a.sourceProvider === priorities.steps) {
        nextActivities[idx] = { ...nextActivities[idx], ...a };
      }
    } else {
      nextActivities.push(a);
      importedObservations++;
    }
  }

  return {
    workouts: nextWorkouts,
    hrvObservations: nextHrv,
    rhrObservations: nextRhr,
    sleepSessions: nextSleep,
    dailyActivities: nextActivities,
    report: {
      importedWorkouts,
      deduplicatedWorkouts,
      importedObservations,
      deduplicatedObservations,
      notes,
    },
  };
}
