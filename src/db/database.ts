import Dexie, { Table } from 'dexie';
import {
  AIPrivacySettings,
  AppExportPayload,
  AppLocale,
  BodyMeasurement,
  ConnectedSource,
  DailyActivitySummary,
  DemoScenarioId,
  FavoriteMeal,
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
  favoriteMeals!: Table<FavoriteMeal, string>;

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
    this.version(3).stores({
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
      favoriteMeals: 'id, category, updatedAt',
    });
  }
}

export const db = new KadenzDatabase();

export const DEFAULT_AI_PRIVACY_SETTINGS: AIPrivacySettings = {
  localRecommendationsOnly: true,
  sendPhotosOnDemandOnly: true,
  localProcessingOnly: true,
  backgroundSync: true,
};

export interface PersistedHealthState {
  scenarioId: DemoScenarioId;
  theme: ThemePreference;
  locale?: AppLocale;
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
  favoriteMeals?: FavoriteMeal[];
}

export async function loadPersistedState(): Promise<PersistedHealthState | null> {
  try {
    const [
      storageModeMeta,
      scenarioMeta,
      themeMeta,
      localeMeta,
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
      favoriteMeals,
    ] = await Promise.all([
      db.meta.get('storageMode'),
      db.meta.get('scenarioId'),
      db.meta.get('theme'),
      db.meta.get('locale'),
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
      db.favoriteMeals.toArray().catch(() => []),
    ]);

    // Migrate cleanly away from legacy demo-seeded local storage once
    if (storageModeMeta?.value !== 'clean_v3') return null;
    if (profiles.length === 0) return null;

    const rawAiPrivacy = (aiPrivacyMeta?.value as Partial<AIPrivacySettings>) || {};

    return {
      scenarioId: (scenarioMeta?.value as DemoScenarioId) || 'balanced',
      theme: (themeMeta?.value as ThemePreference) || 'dark',
      locale: (localeMeta?.value as AppLocale) || undefined,
      aiPrivacy: {
        localRecommendationsOnly: rawAiPrivacy.localRecommendationsOnly ?? true,
        sendPhotosOnDemandOnly: rawAiPrivacy.sendPhotosOnDemandOnly ?? true,
        localProcessingOnly: rawAiPrivacy.localProcessingOnly ?? true,
        backgroundSync: rawAiPrivacy.backgroundSync ?? true,
      },
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
      favoriteMeals,
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
      db.favoriteMeals,
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
        db.favoriteMeals.clear(),
      ]);

      await db.meta.bulkPut([
        { key: 'storageMode', value: 'clean_v3' },
        { key: 'scenarioId', value: state.scenarioId },
        { key: 'theme', value: state.theme },
        { key: 'locale', value: state.locale || 'de' },
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
      if (state.favoriteMeals && state.favoriteMeals.length > 0) {
        await db.favoriteMeals.bulkPut(state.favoriteMeals);
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
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, error: 'Die JSON-Datei enthält kein gültiges Backup-Objekt.' };
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.schemaVersion !== 'number' || !Number.isFinite(obj.schemaVersion)) {
    return { valid: false, error: 'Pflichtfeld schemaVersion fehlt oder ist ungültig.' };
  }
  if (!obj.profile || typeof obj.profile !== 'object' || Array.isArray(obj.profile)) {
    return { valid: false, error: 'Pflichtfeld profile fehlt in der Backup-Datei.' };
  }
  const profile = obj.profile as Record<string, unknown>;
  if (typeof profile.id !== 'string' || typeof profile.weightKg !== 'number') {
    return { valid: false, error: 'Das Profil in der Backup-Datei ist unvollständig.' };
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

  const optionalArrays = ['bodyMeasurements', 'meals', 'hydrationEntries', 'favoriteMeals'];
  for (const key of optionalArrays) {
    if (obj[key] !== undefined && !Array.isArray(obj[key])) {
      return { valid: false, error: `Ungültiges optionales Datenfeld: ${key}.` };
    }
  }

  return { valid: true, payload: raw as AppExportPayload };
}
