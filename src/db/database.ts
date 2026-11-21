import Dexie, { Table } from 'dexie';
import {
  AIPrivacySettings,
  AppExportPayload,
  BodyMeasurement,
  ConnectedSource,
  DailyActivitySummary,
  DemoScenarioId,
  HRVObservation,
  HydrationEntry,
  JournalEntry,
  MealEntry,
  RestingHeartRateObservation,
  SleepSession,
  SourcePriorityPreferences,
  ThemePreference,
  UserProfile,
  WorkoutSession,
} from '../types/health';

export interface AppMetaRecord {
  key: string;
  value: unknown;
}

class KadenzDatabase extends Dexie {
  meta!: Table<AppMetaRecord, string>;
  profiles!: Table<UserProfile, string>;
  sources!: Table<ConnectedSource, string>;
  hrvObservations!: Table<HRVObservation, string>;
  rhrObservations!: Table<RestingHeartRateObservation, string>;
  sleepSessions!: Table<SleepSession, string>;
  workouts!: Table<WorkoutSession, string>;
  dailyActivities!: Table<DailyActivitySummary, string>;
  bodyMeasurements!: Table<BodyMeasurement, string>;
  journalEntries!: Table<JournalEntry, string>;
  meals!: Table<MealEntry, string>;
  hydrationEntries!: Table<HydrationEntry, string>;

  constructor() {
    super('KadenzHealthDB');
    this.version(1).stores({
      meta: 'key',
      profiles: 'id',
      sources: 'providerId',
      hrvObservations: 'id, date, sourceProvider',
      rhrObservations: 'id, date, sourceProvider',
      sleepSessions: 'id, date, sourceProvider',
      workouts: 'id, date, sport, sourceProvider',
      dailyActivities: 'id, date, sourceProvider',
      bodyMeasurements: 'id, date, sourceProvider',
      journalEntries: 'date',
    });
    this.version(2).stores({
      meta: 'key',
      profiles: 'id',
      sources: 'providerId',
      hrvObservations: 'id, date, sourceProvider',
      rhrObservations: 'id, date, sourceProvider',
      sleepSessions: 'id, date, sourceProvider',
      workouts: 'id, date, sport, sourceProvider',
      dailyActivities: 'id, date, sourceProvider',
      bodyMeasurements: 'id, date, sourceProvider',
      journalEntries: 'date',
      meals: 'id, date, category',
      hydrationEntries: 'date',
    });
  }
}

export const db = new KadenzDatabase();

export const DEFAULT_AI_PRIVACY_SETTINGS: AIPrivacySettings = {
  provider: 'gemini',
  apiKey: '',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'llava',
  localRecommendationsOnly: true,
  sendPhotosOnDemandOnly: true,
  localProcessingOnly: true,
  backgroundSync: true,
};

export interface PersistedHealthState {
  scenarioId: DemoScenarioId;
  theme: ThemePreference;
  aiPrivacy?: AIPrivacySettings;
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
  meals?: MealEntry[];
  hydrationEntries?: HydrationEntry[];
}

export async function loadPersistedState(): Promise<PersistedHealthState | null> {
  try {
    const [
      scenarioMeta,
      themeMeta,
      prioritiesMeta,
      aiPrivacyMeta,
      profiles,
      sources,
      hrvObservations,
      rhrObservations,
      sleepSessions,
      workouts,
      dailyActivities,
      bodyMeasurements,
      journalEntries,
      meals,
      hydrationEntries,
    ] = await Promise.all([
      db.meta.get('scenarioId'),
      db.meta.get('theme'),
      db.meta.get('sourcePriorities'),
      db.meta.get('aiPrivacy'),
      db.profiles.toArray(),
      db.sources.toArray(),
      db.hrvObservations.toArray(),
      db.rhrObservations.toArray(),
      db.sleepSessions.toArray(),
      db.workouts.toArray(),
      db.dailyActivities.toArray(),
      db.bodyMeasurements.toArray(),
      db.journalEntries.toArray(),
      db.meals.toArray().catch(() => []),
      db.hydrationEntries.toArray().catch(() => []),
    ]);

    if (profiles.length === 0) return null;

    return {
      scenarioId: (scenarioMeta?.value as DemoScenarioId) || 'balanced',
      theme: (themeMeta?.value as ThemePreference) || 'dark',
      aiPrivacy: (aiPrivacyMeta?.value as AIPrivacySettings) || DEFAULT_AI_PRIVACY_SETTINGS,
      sourcePriorities: (prioritiesMeta?.value as SourcePriorityPreferences) || {
        steps: 'health_connect',
        heartRate: 'coros',
        sleep: 'health_connect',
        workouts: 'coros',
        weight: 'withings',
        bodyComposition: 'withings',
      },
      profile: profiles[0],
      connectedSources: sources,
      hrvObservations,
      rhrObservations,
      sleepSessions,
      workouts,
      dailyActivities,
      bodyMeasurements,
      journalEntries,
      meals,
      hydrationEntries,
    };
  } catch (err) {
    console.warn('IndexedDB read fallback triggered:', err);
    return null;
  }
}

export async function saveFullPersistedState(state: PersistedHealthState): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.meta,
      db.profiles,
      db.sources,
      db.hrvObservations,
      db.rhrObservations,
      db.sleepSessions,
      db.workouts,
      db.dailyActivities,
      db.bodyMeasurements,
      db.journalEntries,
      db.meals,
      db.hydrationEntries,
    ],
    async () => {
      await Promise.all([
        db.meta.clear(),
        db.profiles.clear(),
        db.sources.clear(),
        db.hrvObservations.clear(),
        db.rhrObservations.clear(),
        db.sleepSessions.clear(),
        db.workouts.clear(),
        db.dailyActivities.clear(),
        db.bodyMeasurements.clear(),
        db.journalEntries.clear(),
        db.meals.clear(),
        db.hydrationEntries.clear(),
      ]);

      await db.meta.bulkPut([
        { key: 'scenarioId', value: state.scenarioId },
        { key: 'theme', value: state.theme },
        { key: 'sourcePriorities', value: state.sourcePriorities },
        { key: 'aiPrivacy', value: state.aiPrivacy || DEFAULT_AI_PRIVACY_SETTINGS },
      ]);
      await db.profiles.put(state.profile);
      await db.sources.bulkPut(state.connectedSources);
      await db.hrvObservations.bulkPut(state.hrvObservations);
      await db.rhrObservations.bulkPut(state.rhrObservations);
      await db.sleepSessions.bulkPut(state.sleepSessions);
      await db.workouts.bulkPut(state.workouts);
      await db.dailyActivities.bulkPut(state.dailyActivities);
      await db.bodyMeasurements.bulkPut(state.bodyMeasurements);
      await db.journalEntries.bulkPut(state.journalEntries);
      if (state.meals && state.meals.length > 0) {
        await db.meals.bulkPut(state.meals);
      }
      if (state.hydrationEntries && state.hydrationEntries.length > 0) {
        await db.hydrationEntries.bulkPut(state.hydrationEntries);
      }
    }
  );
}

export async function clearAllLocalData(): Promise<void> {
  await db.delete();
  await db.open();
}

export function validateImportPayload(
  raw: unknown
): { valid: true; payload: AppExportPayload } | { valid: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Die JSON-Datei enthält kein gültiges Objekt.' };
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.schemaVersion !== 'number' || !obj.profile || typeof obj.profile !== 'object') {
    return { valid: false, error: 'Pflichtfelder (schemaVersion, profile) fehlen in der Export-Datei.' };
  }
  const requiredArrays = [
    'connectedSources',
    'hrvObservations',
    'rhrObservations',
    'sleepSessions',
    'workouts',
    'dailyActivities',
    'journalEntries',
  ];
  for (const key of requiredArrays) {
    if (!Array.isArray(obj[key])) {
      return { valid: false, error: `Ungültiges oder fehlendes Datenfeld: ${key}.` };
    }
  }
  return { valid: true, payload: raw as AppExportPayload };
}
