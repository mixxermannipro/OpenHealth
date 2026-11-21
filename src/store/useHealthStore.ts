import { create } from 'zustand';
import {
  AIPrivacySettings,
  AppExportPayload,
  BodyMeasurement,
  ConnectedSource,
  DailyActivitySummary,
  DashboardFocus,
  DemoScenarioId,
  DetailView,
  DeviceProviderId,
  HRVObservation,
  HydrationEntry,
  JournalEntry,
  MealEntry,
  PrimaryTab,
  RestingHeartRateObservation,
  SleepSession,
  SourcePriorityPreferences,
  ThemePreference,
  TimeRange,
  UserProfile,
  WorkoutSession,
} from '../types/health';
import { createDefaultProfile, generateScenarioDataset } from '../data/mockGenerator';
import { createSeedMealsForDate } from '../engine/nutrition';
import {
  clearAllLocalData,
  db,
  DEFAULT_AI_PRIVACY_SETTINGS,
  loadPersistedState,
  saveFullPersistedState,
} from '../db/database';
import {
  DeduplicationReport,
  mergeSyncedBatch,
  SimulatedWearableProvider,
} from '../providers/healthProviders';
import { FileImportResult } from '../providers/fileImporters';
import { toLocalDateKey } from '../utils/formatters';

export interface ToastMessage {
  id: string;
  text: string;
  tone: 'neutral' | 'success' | 'warning';
}

interface HealthStoreState {
  initialized: boolean;
  isSyncing: boolean;
  todayKey: string;
  selectedDate: string;
  activeTab: PrimaryTab;
  detailView: DetailView;
  timeRange: TimeRange;
  theme: ThemePreference;
  scenarioId: DemoScenarioId;
  aiPrivacy: AIPrivacySettings;
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
  meals: MealEntry[];
  hydrationEntries: HydrationEntry[];
  selectedWorkoutId: string | null;
  lastSyncReport: DeduplicationReport | null;
  toast: ToastMessage | null;

  initialize: () => Promise<void>;
  setActiveTab: (tab: PrimaryTab) => void;
  setDetailView: (view: DetailView) => void;
  setSelectedDate: (dateKey: string) => void;
  setTimeRange: (range: TimeRange) => void;
  setTheme: (theme: ThemePreference) => void;
  setSelectedWorkoutId: (id: string | null) => void;
  showToast: (text: string, tone?: ToastMessage['tone']) => void;
  dismissToast: () => void;

  completeOnboarding: (updates: Partial<UserProfile>, selectedProviders: DeviceProviderId[]) => Promise<void>;
  exploreDemoQuickStart: () => Promise<void>;
  redoOnboarding: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  setDashboardFocus: (focus: DashboardFocus) => Promise<void>;
  updateAIPrivacy: (updates: Partial<AIPrivacySettings>) => Promise<void>;

  switchScenario: (scenarioId: DemoScenarioId) => Promise<void>;
  saveJournalEntry: (entry: JournalEntry) => Promise<void>;
  addAppliedWorkout: (workout: WorkoutSession) => Promise<void>;
  removeSimulatedWorkouts: () => Promise<void>;

  addMealEntry: (meal: MealEntry) => Promise<void>;
  updateMealEntry: (meal: MealEntry) => Promise<void>;
  deleteMealEntry: (mealId: string) => Promise<void>;
  addWaterMl: (dateKey: string, deltaMl: number) => Promise<void>;

  connectSimulatedProvider: (providerId: DeviceProviderId) => Promise<void>;
  disconnectProvider: (providerId: DeviceProviderId) => Promise<void>;
  simulateProviderSync: (providerId: DeviceProviderId) => Promise<DeduplicationReport | null>;
  importExternalHealthFile: (result: FileImportResult) => Promise<void>;
  updateSourcePriority: (key: keyof SourcePriorityPreferences, providerId: DeviceProviderId) => Promise<void>;

  exportAllAsJson: () => AppExportPayload;
  importFromJson: (payload: AppExportPayload) => Promise<void>;
  resetAllData: () => Promise<void>;
}

const initialTodayKey = toLocalDateKey(new Date());
const initialDataset = generateScenarioDataset('balanced', createDefaultProfile({ onboardingCompleted: true }, initialTodayKey));
const initialMeals = createSeedMealsForDate(initialTodayKey);

export const useHealthStore = create<HealthStoreState>((set, get) => ({
  initialized: false,
  isSyncing: false,
  todayKey: initialTodayKey,
  selectedDate: initialTodayKey,
  activeTab: 'today',
  detailView: 'none',
  timeRange: '30d',
  theme: 'dark',
  scenarioId: 'balanced',
  aiPrivacy: DEFAULT_AI_PRIVACY_SETTINGS,
  profile: initialDataset.profile,
  connectedSources: initialDataset.connectedSources,
  sourcePriorities: initialDataset.sourcePriorities,
  hrvObservations: initialDataset.hrvObservations,
  rhrObservations: initialDataset.rhrObservations,
  sleepSessions: initialDataset.sleepSessions,
  workouts: initialDataset.workouts,
  dailyActivities: initialDataset.dailyActivities,
  bodyMeasurements: initialDataset.bodyMeasurements,
  journalEntries: initialDataset.journalEntries,
  meals: initialMeals,
  hydrationEntries: [{ date: initialTodayKey, ml: 1500, updatedAt: new Date().toISOString() }],
  selectedWorkoutId: null,
  lastSyncReport: null,
  toast: null,

  initialize: async () => {
    const persisted = await loadPersistedState();
    const todayKey = toLocalDateKey(new Date());

    if (persisted) {
      const hasMealsToday = (persisted.meals || []).some((m) => m.date === todayKey);
      const meals =
        persisted.meals && persisted.meals.length > 0
          ? persisted.meals
          : createSeedMealsForDate(todayKey);
      const hydrationEntries =
        persisted.hydrationEntries && persisted.hydrationEntries.length > 0
          ? persisted.hydrationEntries
          : [{ date: todayKey, ml: 1500, updatedAt: new Date().toISOString() }];

      // Ensure freshly seeded meals are persisted on upgrade from v1 DB
      if (!hasMealsToday && (!persisted.meals || persisted.meals.length === 0)) {
        db.meals.bulkPut(meals).catch(() => {});
      }

      set({
        initialized: true,
        todayKey,
        selectedDate: todayKey,
        scenarioId: persisted.scenarioId,
        theme: persisted.theme || 'dark',
        aiPrivacy: { ...DEFAULT_AI_PRIVACY_SETTINGS, ...(persisted.aiPrivacy || {}) },
        profile: { ...persisted.profile, onboardingCompleted: true },
        connectedSources: persisted.connectedSources,
        sourcePriorities: persisted.sourcePriorities,
        hrvObservations: persisted.hrvObservations,
        rhrObservations: persisted.rhrObservations,
        sleepSessions: persisted.sleepSessions,
        workouts: persisted.workouts,
        dailyActivities: persisted.dailyActivities,
        bodyMeasurements: persisted.bodyMeasurements,
        journalEntries: persisted.journalEntries,
        meals,
        hydrationEntries,
      });
      return;
    }

    const fresh = generateScenarioDataset(
      'balanced',
      createDefaultProfile({ onboardingCompleted: true }, todayKey)
    );
    const seedMeals = createSeedMealsForDate(todayKey);
    const seedHydration: HydrationEntry[] = [
      { date: todayKey, ml: 1500, updatedAt: new Date().toISOString() },
    ];

    await saveFullPersistedState({
      scenarioId: fresh.scenarioId,
      theme: 'dark',
      aiPrivacy: DEFAULT_AI_PRIVACY_SETTINGS,
      profile: fresh.profile,
      connectedSources: fresh.connectedSources,
      sourcePriorities: fresh.sourcePriorities,
      hrvObservations: fresh.hrvObservations,
      rhrObservations: fresh.rhrObservations,
      sleepSessions: fresh.sleepSessions,
      workouts: fresh.workouts,
      dailyActivities: fresh.dailyActivities,
      bodyMeasurements: fresh.bodyMeasurements,
      journalEntries: fresh.journalEntries,
      meals: seedMeals,
      hydrationEntries: seedHydration,
    });

    set({
      initialized: true,
      todayKey,
      selectedDate: todayKey,
      theme: 'dark',
      scenarioId: fresh.scenarioId,
      aiPrivacy: DEFAULT_AI_PRIVACY_SETTINGS,
      profile: fresh.profile,
      connectedSources: fresh.connectedSources,
      sourcePriorities: fresh.sourcePriorities,
      hrvObservations: fresh.hrvObservations,
      rhrObservations: fresh.rhrObservations,
      sleepSessions: fresh.sleepSessions,
      workouts: fresh.workouts,
      dailyActivities: fresh.dailyActivities,
      bodyMeasurements: fresh.bodyMeasurements,
      journalEntries: fresh.journalEntries,
      meals: seedMeals,
      hydrationEntries: seedHydration,
    });
  },

  setActiveTab: (activeTab) => set({ activeTab, detailView: 'none' }),
  setDetailView: (detailView) => set({ detailView }),
  setSelectedDate: (selectedDate) => set({ selectedDate }),
  setTimeRange: (timeRange) => set({ timeRange }),
  setSelectedWorkoutId: (selectedWorkoutId) => set({ selectedWorkoutId }),

  setTheme: (theme) => {
    set({ theme });
    db.meta.put({ key: 'theme', value: theme }).catch(() => {});
  },

  updateAIPrivacy: async (updates) => {
    const next = { ...get().aiPrivacy, ...updates };
    set({ aiPrivacy: next });
    await db.meta.put({ key: 'aiPrivacy', value: next });
  },

  showToast: (text, tone = 'neutral') => {
    const id = `toast_${Date.now()}`;
    set({ toast: { id, text, tone } });
    setTimeout(() => {
      if (get().toast?.id === id) {
        set({ toast: null });
      }
    }, 3600);
  },

  dismissToast: () => set({ toast: null }),

  completeOnboarding: async (updates, selectedProviders) => {
    const state = get();
    const updatedProfile: UserProfile = {
      ...state.profile,
      ...updates,
      onboardingCompleted: true,
      updatedAt: new Date().toISOString(),
    };
    const nowIso = new Date().toISOString();
    const updatedSources = state.connectedSources.map((s) => ({
      ...s,
      connected: selectedProviders.includes(s.providerId),
      lastSyncAt: selectedProviders.includes(s.providerId) ? nowIso : s.lastSyncAt,
    }));

    set({ profile: updatedProfile, connectedSources: updatedSources });
    await db.profiles.put(updatedProfile);
    await db.sources.bulkPut(updatedSources);
    get().showToast('Dein persönliches Profil wurde eingerichtet.', 'success');
  },

  exploreDemoQuickStart: async () => {
    const state = get();
    const updatedProfile: UserProfile = {
      ...state.profile,
      onboardingCompleted: true,
      updatedAt: new Date().toISOString(),
    };
    set({ profile: updatedProfile });
    await db.profiles.put(updatedProfile);
  },

  redoOnboarding: async () => {
    const state = get();
    const updatedProfile = { ...state.profile, onboardingCompleted: false };
    set({ profile: updatedProfile });
    await db.profiles.put(updatedProfile);
  },

  updateProfile: async (updates) => {
    const state = get();
    const updatedProfile: UserProfile = {
      ...state.profile,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    set({ profile: updatedProfile });
    await db.profiles.put(updatedProfile);
    get().showToast('Profil gespeichert.', 'success');
  },

  setDashboardFocus: async (dashboardFocus) => {
    await get().updateProfile({ dashboardFocus });
  },

  switchScenario: async (scenarioId) => {
    const state = get();
    const regenerated = generateScenarioDataset(scenarioId, {
      ...state.profile,
      onboardingCompleted: true,
    });
    set({
      scenarioId,
      selectedDate: state.todayKey,
      profile: regenerated.profile,
      connectedSources: regenerated.connectedSources,
      sourcePriorities: regenerated.sourcePriorities,
      hrvObservations: regenerated.hrvObservations,
      rhrObservations: regenerated.rhrObservations,
      sleepSessions: regenerated.sleepSessions,
      workouts: regenerated.workouts,
      dailyActivities: regenerated.dailyActivities,
      bodyMeasurements: regenerated.bodyMeasurements,
      journalEntries: regenerated.journalEntries,
      lastSyncReport: null,
    });
    await saveFullPersistedState({
      scenarioId,
      theme: state.theme,
      aiPrivacy: state.aiPrivacy,
      profile: regenerated.profile,
      connectedSources: regenerated.connectedSources,
      sourcePriorities: regenerated.sourcePriorities,
      hrvObservations: regenerated.hrvObservations,
      rhrObservations: regenerated.rhrObservations,
      sleepSessions: regenerated.sleepSessions,
      workouts: regenerated.workouts,
      dailyActivities: regenerated.dailyActivities,
      bodyMeasurements: regenerated.bodyMeasurements,
      journalEntries: regenerated.journalEntries,
      meals: state.meals,
      hydrationEntries: state.hydrationEntries,
    });
    get().showToast('Szenario gewechselt — alle Scores aktualisiert.', 'success');
  },

  saveJournalEntry: async (entry) => {
    const state = get();
    const filtered = state.journalEntries.filter((j) => j.date !== entry.date);
    const next = [...filtered, entry];
    set({ journalEntries: next });
    await db.journalEntries.put(entry);
    get().showToast('Tagebuch gespeichert — Erholung aktualisiert.', 'success');
  },

  addAppliedWorkout: async (workout) => {
    const state = get();
    const next = [...state.workouts, workout];
    set({ workouts: next });
    await db.workouts.put(workout);
    get().showToast('Training übernommen.', 'success');
  },

  removeSimulatedWorkouts: async () => {
    const state = get();
    const simulatedIds = state.workouts.filter((w) => w.isSimulated).map((w) => w.id);
    const next = state.workouts.filter((w) => !w.isSimulated);
    set({ workouts: next });
    if (simulatedIds.length > 0) {
      await db.workouts.bulkDelete(simulatedIds);
    }
    get().showToast('Vorschau-Einheiten zurückgesetzt.', 'neutral');
  },

  addMealEntry: async (meal) => {
    const next = [meal, ...get().meals];
    set({ meals: next });
    await db.meals.put(meal);
    get().showToast(`${meal.title} (+${meal.totalCalories} kcal) gespeichert.`, 'success');
  },

  updateMealEntry: async (meal) => {
    const next = get().meals.map((m) => (m.id === meal.id ? meal : m));
    set({ meals: next });
    await db.meals.put(meal);
    get().showToast('Mahlzeit aktualisiert.', 'success');
  },

  deleteMealEntry: async (mealId) => {
    const next = get().meals.filter((m) => m.id !== mealId);
    set({ meals: next });
    await db.meals.delete(mealId);
    get().showToast('Mahlzeit entfernt.', 'neutral');
  },

  addWaterMl: async (dateKey, deltaMl) => {
    const state = get();
    const existing = state.hydrationEntries.find((h) => h.date === dateKey);
    const nextMl = Math.max(0, (existing?.ml ?? 0) + deltaMl);
    const updated: HydrationEntry = {
      date: dateKey,
      ml: nextMl,
      updatedAt: new Date().toISOString(),
    };
    const nextList = [...state.hydrationEntries.filter((h) => h.date !== dateKey), updated];
    set({ hydrationEntries: nextList });
    await db.hydrationEntries.put(updated);
  },

  connectSimulatedProvider: async (providerId) => {
    const state = get();
    const source = state.connectedSources.find((s) => s.providerId === providerId);
    if (!source) return;
    const adapter = new SimulatedWearableProvider(source);
    const updatedSource = { ...(await adapter.connect()), comingSoon: false };
    const nextSources = state.connectedSources.map((s) =>
      s.providerId === providerId ? updatedSource : s
    );
    set({ connectedSources: nextSources });
    await db.sources.put(updatedSource);
    get().showToast(`${source.name} verbunden.`, 'success');
  },

  disconnectProvider: async (providerId) => {
    const state = get();
    const source = state.connectedSources.find((s) => s.providerId === providerId);
    if (!source) return;
    const updatedSource = { ...source, connected: false };
    const nextSources = state.connectedSources.map((s) =>
      s.providerId === providerId ? updatedSource : s
    );
    set({ connectedSources: nextSources });
    await db.sources.put(updatedSource);
    get().showToast(`${source.name} getrennt.`, 'neutral');
  },

  simulateProviderSync: async (providerId) => {
    const state = get();
    const source = state.connectedSources.find((s) => s.providerId === providerId);
    if (!source) return null;

    set({ isSyncing: true });
    await new Promise((res) => setTimeout(res, 400));

    const adapter = new SimulatedWearableProvider({ ...source, connected: true });
    const batch = await adapter.sync(state.todayKey, state.profile);
    const merged = mergeSyncedBatch(
      {
        workouts: state.workouts,
        hrvObservations: state.hrvObservations,
        rhrObservations: state.rhrObservations,
        sleepSessions: state.sleepSessions,
        dailyActivities: state.dailyActivities,
      },
      batch,
      state.sourcePriorities
    );

    const updatedSources = state.connectedSources.map((s) =>
      s.providerId === providerId
        ? {
            ...s,
            connected: true,
            lastSyncAt: batch.syncedAt,
            syncedRecordCount:
              s.syncedRecordCount +
              merged.report.importedWorkouts +
              merged.report.importedObservations,
          }
        : s
    );

    set({
      isSyncing: false,
      connectedSources: updatedSources,
      workouts: merged.workouts,
      hrvObservations: merged.hrvObservations,
      rhrObservations: merged.rhrObservations,
      sleepSessions: merged.sleepSessions,
      dailyActivities: merged.dailyActivities,
      lastSyncReport: merged.report,
    });

    await saveFullPersistedState({
      scenarioId: state.scenarioId,
      theme: state.theme,
      aiPrivacy: state.aiPrivacy,
      profile: state.profile,
      connectedSources: updatedSources,
      sourcePriorities: state.sourcePriorities,
      hrvObservations: merged.hrvObservations,
      rhrObservations: merged.rhrObservations,
      sleepSessions: merged.sleepSessions,
      workouts: merged.workouts,
      dailyActivities: merged.dailyActivities,
      bodyMeasurements: state.bodyMeasurements,
      journalEntries: state.journalEntries,
      meals: state.meals,
      hydrationEntries: state.hydrationEntries,
    });

    get().showToast(
      `Sync (${source.name}): ${merged.report.importedWorkouts} Training(s) importiert, ${merged.report.deduplicatedWorkouts} Duplikat(e) bereinigt.`,
      'success'
    );
    return merged.report;
  },

  importExternalHealthFile: async (result) => {
    const state = get();
    const nextWorkouts = [...state.workouts, ...result.workouts];
    const nextHrv = [...state.hrvObservations, ...result.hrvObservations];
    const nextRhr = [...state.rhrObservations, ...result.rhrObservations];
    const nextSleep = [...state.sleepSessions, ...result.sleepSessions];

    set({
      workouts: nextWorkouts,
      hrvObservations: nextHrv,
      rhrObservations: nextRhr,
      sleepSessions: nextSleep,
    });

    await Promise.all([
      result.workouts.length ? db.workouts.bulkPut(result.workouts) : Promise.resolve(),
      result.hrvObservations.length ? db.hrvObservations.bulkPut(result.hrvObservations) : Promise.resolve(),
      result.rhrObservations.length ? db.rhrObservations.bulkPut(result.rhrObservations) : Promise.resolve(),
      result.sleepSessions.length ? db.sleepSessions.bulkPut(result.sleepSessions) : Promise.resolve(),
    ]);

    get().showToast(result.summary, 'success');
  },

  updateSourcePriority: async (key, providerId) => {
    const state = get();
    const nextPriorities = { ...state.sourcePriorities, [key]: providerId };
    set({ sourcePriorities: nextPriorities });
    await db.meta.put({ key: 'sourcePriorities', value: nextPriorities });
    get().showToast('Quellenpriorität aktualisiert.', 'success');
  },

  exportAllAsJson: () => {
    const s = get();
    return {
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      scenarioId: s.scenarioId,
      profile: s.profile,
      connectedSources: s.connectedSources,
      sourcePriorities: s.sourcePriorities,
      hrvObservations: s.hrvObservations,
      rhrObservations: s.rhrObservations,
      sleepSessions: s.sleepSessions,
      workouts: s.workouts,
      dailyActivities: s.dailyActivities,
      bodyMeasurements: s.bodyMeasurements,
      journalEntries: s.journalEntries,
      meals: s.meals,
      hydrationEntries: s.hydrationEntries,
    };
  },

  importFromJson: async (payload) => {
    const state = get();
    const meals = payload.meals || state.meals;
    const hydrationEntries = payload.hydrationEntries || state.hydrationEntries;
    await saveFullPersistedState({
      scenarioId: payload.scenarioId || 'balanced',
      theme: state.theme,
      aiPrivacy: state.aiPrivacy,
      profile: payload.profile,
      connectedSources: payload.connectedSources,
      sourcePriorities: payload.sourcePriorities || state.sourcePriorities,
      hrvObservations: payload.hrvObservations,
      rhrObservations: payload.rhrObservations,
      sleepSessions: payload.sleepSessions,
      workouts: payload.workouts,
      dailyActivities: payload.dailyActivities,
      bodyMeasurements: payload.bodyMeasurements || [],
      journalEntries: payload.journalEntries,
      meals,
      hydrationEntries,
    });

    set({
      scenarioId: payload.scenarioId || 'balanced',
      profile: payload.profile,
      connectedSources: payload.connectedSources,
      sourcePriorities: payload.sourcePriorities || state.sourcePriorities,
      hrvObservations: payload.hrvObservations,
      rhrObservations: payload.rhrObservations,
      sleepSessions: payload.sleepSessions,
      workouts: payload.workouts,
      dailyActivities: payload.dailyActivities,
      bodyMeasurements: payload.bodyMeasurements || [],
      journalEntries: payload.journalEntries,
      meals,
      hydrationEntries,
    });
    get().showToast('Gesundheitsdaten erfolgreich importiert.', 'success');
  },

  resetAllData: async () => {
    await clearAllLocalData();
    const todayKey = toLocalDateKey(new Date());
    const fresh = generateScenarioDataset(
      'balanced',
      createDefaultProfile({ onboardingCompleted: true }, todayKey)
    );
    const seedMeals = createSeedMealsForDate(todayKey);
    const seedHydration: HydrationEntry[] = [
      { date: todayKey, ml: 1500, updatedAt: new Date().toISOString() },
    ];

    await saveFullPersistedState({
      scenarioId: fresh.scenarioId,
      theme: 'dark',
      aiPrivacy: DEFAULT_AI_PRIVACY_SETTINGS,
      profile: fresh.profile,
      connectedSources: fresh.connectedSources,
      sourcePriorities: fresh.sourcePriorities,
      hrvObservations: fresh.hrvObservations,
      rhrObservations: fresh.rhrObservations,
      sleepSessions: fresh.sleepSessions,
      workouts: fresh.workouts,
      dailyActivities: fresh.dailyActivities,
      bodyMeasurements: fresh.bodyMeasurements,
      journalEntries: fresh.journalEntries,
      meals: seedMeals,
      hydrationEntries: seedHydration,
    });

    set({
      todayKey,
      selectedDate: todayKey,
      activeTab: 'today',
      detailView: 'none',
      theme: 'dark',
      aiPrivacy: DEFAULT_AI_PRIVACY_SETTINGS,
      scenarioId: fresh.scenarioId,
      profile: fresh.profile,
      connectedSources: fresh.connectedSources,
      sourcePriorities: fresh.sourcePriorities,
      hrvObservations: fresh.hrvObservations,
      rhrObservations: fresh.rhrObservations,
      sleepSessions: fresh.sleepSessions,
      workouts: fresh.workouts,
      dailyActivities: fresh.dailyActivities,
      bodyMeasurements: fresh.bodyMeasurements,
      journalEntries: fresh.journalEntries,
      meals: seedMeals,
      hydrationEntries: seedHydration,
      lastSyncReport: null,
    });
    get().showToast('Alle lokalen Daten wurden zurückgesetzt.', 'neutral');
  },
}));
