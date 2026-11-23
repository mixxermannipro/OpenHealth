import { create } from 'zustand';
import {
  AIPrivacySettings,
  AppExportPayload,
  AppLocale,
  BodyMeasurement,
  ConnectedSource,
  DailyActivitySummary,
  DashboardFocus,
  DemoScenarioId,
  DetailView,
  DeviceProviderId,
  FavoriteMeal,
  HRVObservation,
  HydrationEntry,
  JournalEntry,
  MealCategory,
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
import {
  clearAllLocalData,
  db,
  DEFAULT_AI_PRIVACY_SETTINGS,
  loadPersistedState,
  saveFullPersistedState,
  validateImportPayload,
} from '../db/database';
import {
  DeduplicationReport,
  mergeSyncedBatch,
  SimulatedWearableProvider,
} from '../providers/healthProviders';
import { FileImportResult } from '../providers/fileImporters';
import { addDaysToKey, toLocalDateKey } from '../utils/formatters';
import { getActiveLocale, setActiveLocaleSync } from '../i18n/translations';
import { calculateAgeFromBirthDate, estimateMaxHrTanaka } from '../utils/biometrics';

function mergeUniqueRecords<T extends { id: string; sourceRecordId?: string }>(
  existing: T[],
  incoming: T[]
): { merged: T[]; added: T[] } {
  const byId = new Map<string, T>();
  const seenSourceIds = new Set<string>();
  for (const item of existing) {
    byId.set(item.id, item);
    if (item.sourceRecordId) seenSourceIds.add(item.sourceRecordId);
  }
  const added: T[] = [];
  for (const item of incoming) {
    if (byId.has(item.id)) continue;
    if (item.sourceRecordId && seenSourceIds.has(item.sourceRecordId)) continue;
    byId.set(item.id, item);
    if (item.sourceRecordId) seenSourceIds.add(item.sourceRecordId);
    added.push(item);
  }
  return { merged: Array.from(byId.values()), added };
}

export interface ToastMessage {
  id: string;
  text: string;
  tone: 'neutral' | 'success' | 'warning';
}

const DEFAULT_SOURCE_PRIORITIES: SourcePriorityPreferences = {
  steps: 'health_connect',
  heartRate: 'coros',
  sleep: 'health_connect',
  workouts: 'coros',
  weight: 'withings',
  bodyComposition: 'withings',
};

export function createEmptyInitialSources(): ConnectedSource[] {
  return [
    {
      providerId: 'health_connect',
      name: 'Health Connect',
      connected: false,
      isDemoSimulation: false,
      lastSyncAt: null,
      supportedDataTypes: ['steps', 'workouts', 'sleep', 'hrv', 'rhr'],
      syncedRecordCount: 0,
    },
    {
      providerId: 'apple_health',
      name: 'Apple Health',
      connected: false,
      isDemoSimulation: false,
      lastSyncAt: null,
      supportedDataTypes: ['steps', 'workouts', 'sleep', 'hrv', 'rhr', 'body'],
      syncedRecordCount: 0,
    },
    {
      providerId: 'coros',
      name: 'COROS',
      connected: false,
      isDemoSimulation: false,
      lastSyncAt: null,
      supportedDataTypes: ['workouts', 'hrv', 'rhr', 'sleep', 'vo2max'],
      syncedRecordCount: 0,
    },
    {
      providerId: 'garmin',
      name: 'Garmin',
      connected: false,
      isDemoSimulation: false,
      lastSyncAt: null,
      supportedDataTypes: ['workouts', 'hrv', 'rhr', 'steps', 'vo2max', 'sleep'],
      syncedRecordCount: 0,
    },
    {
      providerId: 'polar',
      name: 'Polar',
      connected: false,
      isDemoSimulation: false,
      lastSyncAt: null,
      supportedDataTypes: ['workouts', 'hrv', 'rhr', 'sleep'],
      syncedRecordCount: 0,
    },
    {
      providerId: 'oura',
      name: 'Oura',
      connected: false,
      isDemoSimulation: false,
      lastSyncAt: null,
      supportedDataTypes: ['sleep', 'hrv', 'rhr'],
      syncedRecordCount: 0,
    },
  ];
}

export function createEmptyFreshProfile(todayKey: string = toLocalDateKey(new Date())): UserProfile {
  const defaultBirthDate = '1998-06-15';
  const computedAge = calculateAgeFromBirthDate(defaultBirthDate);
  return {
    id: 'user_local_1',
    displayName: '',
    birthDate: defaultBirthDate,
    age: computedAge,
    heightCm: 176,
    weightKg: 74,
    targetWeightKg: 74,
    weeklyWeightChangeKg: 0,
    biologicalSex: 'male',
    maxHr: estimateMaxHrTanaka(computedAge),
    hrZoneMethod: 'hrr',
    fitnessExperience: 'intermediate',
    primarySport: 'running',
    activityLevel: 'moderate',
    weeklyTrainingDays: 3,
    sleepTargetMinutes: 480,
    preferredBedtime: '23:00',
    preferredWakeTime: '07:00',
    nutritionGoalMode: 'maintain',
    nutritionGoalDeltaKcal: 0,
    usesWearableActiveCalories: true,
    dailyLifestyleNeat: 'sedentary',
    manualActivityPal: 'moderate',
    nutritionOnboardingCompleted: false,
    goals: ['long_term_health', 'improve_recovery'],
    runningTargets: {},
    dashboardFocus: 'general',
    onboardingCompleted: false,
    createdAt: `${todayKey}T07:00:00`,
    updatedAt: `${todayKey}T07:00:00`,
  };
}

function withDynamicAge(profile: UserProfile): UserProfile {
  if (!profile.birthDate) return profile;
  const freshAge = calculateAgeFromBirthDate(profile.birthDate, profile.age);
  if (freshAge === profile.age) return profile;
  return {
    ...profile,
    age: freshAge,
    maxHr: profile.maxHr || estimateMaxHrTanaka(freshAge),
  };
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
  locale: AppLocale;
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
  favoriteMeals: FavoriteMeal[];
  selectedWorkoutId: string | null;
  lastSyncReport: DeduplicationReport | null;
  toast: ToastMessage | null;

  initialize: () => Promise<void>;
  syncTodayRollover: () => void;
  setActiveTab: (tab: PrimaryTab) => void;
  setDetailView: (view: DetailView) => void;
  setSelectedDate: (dateKey: string) => void;
  setTimeRange: (range: TimeRange) => void;
  setTheme: (theme: ThemePreference) => void;
  setLocale: (locale: AppLocale) => void;
  setSelectedWorkoutId: (id: string | null) => void;
  showToast: (text: string, tone?: ToastMessage['tone']) => void;
  dismissToast: () => void;

  completeOnboarding: (updates: Partial<UserProfile>, selectedProviders: DeviceProviderId[]) => Promise<void>;
  redoOnboarding: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  setDashboardFocus: (focus: DashboardFocus) => Promise<void>;
  updateAIPrivacy: (updates: Partial<AIPrivacySettings>) => Promise<void>;

  saveJournalEntry: (entry: JournalEntry) => Promise<void>;
  addAppliedWorkout: (workout: WorkoutSession) => Promise<void>;
  deleteWorkout: (workoutId: string) => Promise<void>;
  removeSimulatedWorkouts: () => Promise<void>;
  addManualSleepSession: (session: SleepSession) => Promise<void>;
  logWeightMeasurement: (dateKey: string, weightKg: number) => Promise<void>;

  addMealEntry: (meal: MealEntry) => Promise<void>;
  updateMealEntry: (meal: MealEntry) => Promise<void>;
  deleteMealEntry: (mealId: string) => Promise<void>;
  toggleFavoriteMeal: (
    meal: Pick<
      MealEntry,
      'title' | 'category' | 'totalCalories' | 'proteinG' | 'carbsG' | 'fatG' | 'fiberG'
    >
  ) => Promise<boolean>;
  deleteFavoriteMeal: (favId: string) => Promise<void>;
  logFavoriteMeal: (
    fav: FavoriteMeal,
    dateKey: string,
    overrideCategory?: MealCategory
  ) => Promise<void>;
  copyMealsFromYesterday: (targetDateKey: string, category?: MealCategory) => Promise<number>;
  addWaterMl: (dateKey: string, deltaMl: number) => Promise<void>;

  connectSimulatedProvider: (providerId: DeviceProviderId) => Promise<void>;
  disconnectProvider: (providerId: DeviceProviderId) => Promise<void>;
  simulateProviderSync: (providerId: DeviceProviderId) => Promise<DeduplicationReport | null>;
  importExternalHealthFile: (result: FileImportResult) => Promise<void>;
  updateSourcePriority: (key: keyof SourcePriorityPreferences, providerId: DeviceProviderId) => Promise<void>;

  exportAllAsJson: () => AppExportPayload;
  importFromJson: (payload: unknown) => Promise<boolean>;
  resetAllData: () => Promise<void>;
}

const initialTodayKey = toLocalDateKey(new Date());
let initializeInFlight: Promise<void> | null = null;

export const useHealthStore = create<HealthStoreState>((set, get) => ({
  initialized: false,
  isSyncing: false,
  todayKey: initialTodayKey,
  selectedDate: initialTodayKey,
  activeTab: 'today',
  detailView: 'none',
  timeRange: '30d',
  theme: 'dark',
  locale: getActiveLocale(),
  scenarioId: 'balanced',
  aiPrivacy: DEFAULT_AI_PRIVACY_SETTINGS,
  profile: createEmptyFreshProfile(initialTodayKey),
  connectedSources: createEmptyInitialSources(),
  sourcePriorities: DEFAULT_SOURCE_PRIORITIES,
  hrvObservations: [],
  rhrObservations: [],
  sleepSessions: [],
  workouts: [],
  dailyActivities: [],
  bodyMeasurements: [],
  journalEntries: [],
  meals: [],
  hydrationEntries: [],
  favoriteMeals: [],
  selectedWorkoutId: null,
  lastSyncReport: null,
  toast: null,

  initialize: async () => {
    if (get().initialized) return;
    if (initializeInFlight) {
      await initializeInFlight;
      return;
    }

    initializeInFlight = (async () => {
      const persisted = await loadPersistedState();
      const todayKey = toLocalDateKey(new Date());

    if (persisted) {
      const hydratedLocale = persisted.locale || getActiveLocale();
      setActiveLocaleSync(hydratedLocale);
      const hydratedProfile = withDynamicAge(persisted.profile);
      if (hydratedProfile.age !== persisted.profile.age) {
        db.profiles.put(hydratedProfile).catch(() => {});
      }

      set({
        initialized: true,
        todayKey,
        selectedDate: todayKey,
        scenarioId: persisted.scenarioId || 'balanced',
        theme: persisted.theme || 'dark',
        locale: hydratedLocale,
        aiPrivacy: { ...DEFAULT_AI_PRIVACY_SETTINGS, ...(persisted.aiPrivacy || {}) },
        profile: hydratedProfile,
        connectedSources:
          persisted.connectedSources && persisted.connectedSources.length > 0
            ? persisted.connectedSources
            : createEmptyInitialSources(),
        sourcePriorities: persisted.sourcePriorities || DEFAULT_SOURCE_PRIORITIES,
        hrvObservations: persisted.hrvObservations || [],
        rhrObservations: persisted.rhrObservations || [],
        sleepSessions: persisted.sleepSessions || [],
        workouts: persisted.workouts || [],
        dailyActivities: persisted.dailyActivities || [],
        bodyMeasurements: persisted.bodyMeasurements || [],
        journalEntries: persisted.journalEntries || [],
        meals: persisted.meals || [],
        hydrationEntries: persisted.hydrationEntries || [],
        favoriteMeals: persisted.favoriteMeals || [],
      });
      return;
    }

    // Brand-new clean local-first installation: zero demo data, starts at full-app onboarding
    const freshProfile = createEmptyFreshProfile(todayKey);
    const emptySources = createEmptyInitialSources();
    const initialLocale = getActiveLocale();
    setActiveLocaleSync(initialLocale);

    await saveFullPersistedState({
      scenarioId: 'balanced',
      theme: 'dark',
      locale: initialLocale,
      aiPrivacy: DEFAULT_AI_PRIVACY_SETTINGS,
      profile: freshProfile,
      connectedSources: emptySources,
      sourcePriorities: DEFAULT_SOURCE_PRIORITIES,
      hrvObservations: [],
      rhrObservations: [],
      sleepSessions: [],
      workouts: [],
      dailyActivities: [],
      bodyMeasurements: [],
      journalEntries: [],
      meals: [],
      hydrationEntries: [],
      favoriteMeals: [],
    });

    set({
      initialized: true,
      todayKey,
      selectedDate: todayKey,
      theme: 'dark',
      locale: initialLocale,
      scenarioId: 'balanced',
      aiPrivacy: DEFAULT_AI_PRIVACY_SETTINGS,
      profile: freshProfile,
      connectedSources: emptySources,
      sourcePriorities: DEFAULT_SOURCE_PRIORITIES,
      hrvObservations: [],
      rhrObservations: [],
      sleepSessions: [],
      workouts: [],
      dailyActivities: [],
      bodyMeasurements: [],
      journalEntries: [],
      meals: [],
      hydrationEntries: [],
      favoriteMeals: [],
    });
    })().finally(() => {
      initializeInFlight = null;
    });

    await initializeInFlight;
  },

  syncTodayRollover: () => {
    const state = get();
    const freshToday = toLocalDateKey(new Date());
    if (freshToday === state.todayKey) return;
    const nextProfile = withDynamicAge(state.profile);
    if (nextProfile.age !== state.profile.age) {
      db.profiles.put(nextProfile).catch(() => {});
    }
    set({
      todayKey: freshToday,
      selectedDate: state.selectedDate === state.todayKey ? freshToday : state.selectedDate,
      profile: nextProfile,
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

  setLocale: (locale) => {
    setActiveLocaleSync(locale);
    set({ locale });
    db.meta.put({ key: 'locale', value: locale }).catch(() => {});
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
    const nowIso = new Date().toISOString();
    const nextBirthDate = updates.birthDate ?? state.profile.birthDate;
    const computedAge = calculateAgeFromBirthDate(
      nextBirthDate,
      updates.age ?? state.profile.age
    );
    const computedMaxHr = updates.maxHr ?? estimateMaxHrTanaka(computedAge);

    const updatedProfile: UserProfile = {
      ...state.profile,
      ...updates,
      birthDate: nextBirthDate,
      age: computedAge,
      maxHr: computedMaxHr,
      onboardingCompleted: true,
      nutritionOnboardingCompleted: true,
      updatedAt: nowIso,
    };

    const updatedSources = state.connectedSources.map((s) => ({
      ...s,
      connected: selectedProviders.includes(s.providerId),
      lastSyncAt: selectedProviders.includes(s.providerId) ? nowIso : null,
    }));

    // Record user's real initial body weight measurement for today
    const initialBody: BodyMeasurement = {
      id: `body_${state.todayKey}_initial`,
      date: state.todayKey,
      timestamp: nowIso,
      sourceProvider: 'other',
      sourceRecordId: `local_weight_${state.todayKey}`,
      dataQuality: 'high',
      provenance: 'measured',
      metricType: 'body_measurement',
      weightKg: updatedProfile.weightKg,
    };
    const nextBodyMeasurements = [
      ...state.bodyMeasurements.filter((b) => b.id !== initialBody.id),
      initialBody,
    ];

    set({
      profile: updatedProfile,
      connectedSources: updatedSources,
      bodyMeasurements: nextBodyMeasurements,
      activeTab: 'today',
      detailView: 'none',
    });

    await db.profiles.put(updatedProfile);
    await db.sources.bulkPut(updatedSources);
    await db.bodyMeasurements.put(initialBody);
  },

  redoOnboarding: async () => {
    const state = get();
    const updatedProfile = { ...state.profile, onboardingCompleted: false };
    set({ profile: updatedProfile });
    await db.profiles.put(updatedProfile);
  },

  updateProfile: async (updates) => {
    const state = get();
    const nowIso = new Date().toISOString();
    const nextBirthDate = updates.birthDate ?? state.profile.birthDate;
    const birthDateChanged =
      updates.birthDate !== undefined && updates.birthDate !== state.profile.birthDate;
    const computedAge = nextBirthDate
      ? calculateAgeFromBirthDate(nextBirthDate, updates.age ?? state.profile.age)
      : (updates.age ?? state.profile.age);

    const nextMaxHr =
      updates.maxHr !== undefined
        ? updates.maxHr
        : birthDateChanged
          ? estimateMaxHrTanaka(computedAge)
          : state.profile.maxHr;

    const updatedProfile: UserProfile = {
      ...state.profile,
      ...updates,
      birthDate: nextBirthDate,
      age: computedAge,
      maxHr: nextMaxHr,
      updatedAt: nowIso,
    };

    let nextBodyMeasurements = state.bodyMeasurements;
    if (
      typeof updates.weightKg === 'number' &&
      updates.weightKg !== state.profile.weightKg
    ) {
      const entry: BodyMeasurement = {
        id: `body_${state.todayKey}_manual`,
        date: state.todayKey,
        timestamp: nowIso,
        sourceProvider: 'other',
        sourceRecordId: `manual_weight_${state.todayKey}`,
        dataQuality: 'high',
        provenance: 'measured',
        metricType: 'body_measurement',
        weightKg: updates.weightKg,
      };
      nextBodyMeasurements = [
        ...state.bodyMeasurements.filter((b) => b.id !== entry.id),
        entry,
      ];
      await db.bodyMeasurements.put(entry);
    }

    set({ profile: updatedProfile, bodyMeasurements: nextBodyMeasurements });
    await db.profiles.put(updatedProfile);
    get().showToast('Profil lokal gespeichert.', 'success');
  },

  setDashboardFocus: async (dashboardFocus) => {
    await get().updateProfile({ dashboardFocus });
  },

  saveJournalEntry: async (entry) => {
    const state = get();
    const hydrationEntry = state.hydrationEntries.find((h) => h.date === entry.date);
    const enriched: JournalEntry = {
      ...entry,
      hydrationLiters:
        entry.hydrationLiters !== undefined
          ? entry.hydrationLiters
          : hydrationEntry
            ? Number((hydrationEntry.ml / 1000).toFixed(2))
            : undefined,
    };
    const filtered = state.journalEntries.filter((j) => j.date !== enriched.date);
    const next = [...filtered, enriched];
    set({ journalEntries: next });
    await db.journalEntries.put(enriched);
    get().showToast('Check-in gespeichert.', 'success');
  },

  addAppliedWorkout: async (workout) => {
    const state = get();
    const hasCollision = state.workouts.some((w) => w.id === workout.id);
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const persistedWorkout: WorkoutSession =
      hasCollision || workout.isSimulated
        ? {
            ...workout,
            id: `wk_${uniqueSuffix}`,
            sourceRecordId: `local_wk_${uniqueSuffix}`,
          }
        : workout;

    const next = [...state.workouts, persistedWorkout];
    set({ workouts: next });
    await db.workouts.put(persistedWorkout);
    get().showToast(
      persistedWorkout.isSimulated ? 'Vorschau-Training übernommen.' : 'Training gespeichert.',
      'success'
    );
  },

  deleteWorkout: async (workoutId) => {
    const state = get();
    const next = state.workouts.filter((w) => w.id !== workoutId);
    set({
      workouts: next,
      selectedWorkoutId: state.selectedWorkoutId === workoutId ? null : state.selectedWorkoutId,
    });
    await db.workouts.delete(workoutId);
    get().showToast('Training gelöscht.', 'neutral');
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

  addManualSleepSession: async (session) => {
    const state = get();
    const next = [
      ...state.sleepSessions.filter(
        (s) => s.id !== session.id && !(s.date === session.date && s.sourceProvider === 'other')
      ),
      session,
    ];
    set({ sleepSessions: next });
    await db.sleepSessions.put(session);
    get().showToast('Schlafeintrag gespeichert.', 'success');
  },

  logWeightMeasurement: async (dateKey, weightKg) => {
    const state = get();
    const rounded = Number(Math.max(30, Math.min(250, weightKg)).toFixed(1));
    const nowIso = new Date().toISOString();
    const entry: BodyMeasurement = {
      id: `body_${dateKey}_manual`,
      date: dateKey,
      timestamp: nowIso,
      sourceProvider: 'other',
      sourceRecordId: `manual_weight_${dateKey}`,
      dataQuality: 'high',
      provenance: 'measured',
      metricType: 'body_measurement',
      weightKg: rounded,
    };

    const nextBodyMeasurements = [
      ...state.bodyMeasurements.filter((b) => b.id !== entry.id && b.date !== dateKey),
      entry,
    ].sort((a, b) => a.date.localeCompare(b.date));

    const latestDate = nextBodyMeasurements[nextBodyMeasurements.length - 1]?.date ?? dateKey;
    const shouldUpdateProfile = dateKey >= state.todayKey || dateKey >= latestDate;
    const nextProfile = shouldUpdateProfile
      ? { ...state.profile, weightKg: rounded, updatedAt: nowIso }
      : state.profile;

    set({
      bodyMeasurements: nextBodyMeasurements,
      profile: nextProfile,
    });
    await db.bodyMeasurements.put(entry);
    if (shouldUpdateProfile) {
      await db.profiles.put(nextProfile);
    }
    get().showToast(`Gewicht (${rounded.toFixed(1).replace('.', ',')} kg) gespeichert.`, 'success');
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

  toggleFavoriteMeal: async (meal) => {
    const state = get();
    const normTitle = meal.title.trim().toLowerCase();
    const existing = state.favoriteMeals.find(
      (f) => f.title.trim().toLowerCase() === normTitle && f.totalCalories === meal.totalCalories
    );
    if (existing) {
      const next = state.favoriteMeals.filter((f) => f.id !== existing.id);
      set({ favoriteMeals: next });
      await db.favoriteMeals.delete(existing.id);
      get().showToast('Aus Favoriten entfernt.', 'neutral');
      return false;
    }

    const nowIso = new Date().toISOString();
    const fav: FavoriteMeal = {
      id: `fav_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: meal.title.trim(),
      category: meal.category,
      totalCalories: Math.round(meal.totalCalories),
      proteinG: Math.round(meal.proteinG),
      carbsG: Math.round(meal.carbsG),
      fatG: Math.round(meal.fatG),
      fiberG: Math.round(meal.fiberG || 0),
      useCount: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const next = [fav, ...state.favoriteMeals];
    set({ favoriteMeals: next });
    await db.favoriteMeals.put(fav);
    get().showToast(`„${fav.title}“ als Favorit gespeichert.`, 'success');
    return true;
  },

  deleteFavoriteMeal: async (favId) => {
    const next = get().favoriteMeals.filter((f) => f.id !== favId);
    set({ favoriteMeals: next });
    await db.favoriteMeals.delete(favId);
    get().showToast('Favorit entfernt.', 'neutral');
  },

  logFavoriteMeal: async (fav, dateKey, overrideCategory) => {
    const state = get();
    const nowIso = new Date().toISOString();
    const newMeal: MealEntry = {
      id: `meal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date: dateKey,
      timestamp: nowIso,
      category: overrideCategory ?? fav.category,
      title: fav.title,
      subtitle: 'Favorit · 1-Tap',
      items: [],
      totalCalories: fav.totalCalories,
      proteinG: fav.proteinG,
      carbsG: fav.carbsG,
      fatG: fav.fatG,
      fiberG: fav.fiberG,
    };
    const updatedFav: FavoriteMeal = {
      ...fav,
      useCount: (fav.useCount || 0) + 1,
      updatedAt: nowIso,
    };
    const nextFavs = state.favoriteMeals.map((f) => (f.id === fav.id ? updatedFav : f));
    set({ meals: [newMeal, ...state.meals], favoriteMeals: nextFavs });
    await Promise.all([db.meals.put(newMeal), db.favoriteMeals.put(updatedFav)]);
    get().showToast(`${fav.title} (+${fav.totalCalories} kcal) eingetragen.`, 'success');
  },

  copyMealsFromYesterday: async (targetDateKey, category) => {
    const state = get();
    const yesterdayKey = addDaysToKey(targetDateKey, -1);
    const sourceMeals = state.meals.filter(
      (m) => m.date === yesterdayKey && (!category || m.category === category)
    );
    if (sourceMeals.length === 0) {
      get().showToast('Keine Mahlzeiten vom Vortag gefunden.', 'neutral');
      return 0;
    }

    const nowIso = new Date().toISOString();
    const copies: MealEntry[] = sourceMeals.map((m, idx) => ({
      ...m,
      id: `meal_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      date: targetDateKey,
      timestamp: nowIso,
    }));

    const next = [...copies, ...state.meals];
    set({ meals: next });
    await db.meals.bulkPut(copies);
    const totalKcal = copies.reduce((acc, m) => acc + m.totalCalories, 0);
    get().showToast(
      `${copies.length} Mahlzeit${copies.length === 1 ? '' : 'en'} vom Vortag übernommen (+${totalKcal} kcal).`,
      'success'
    );
    return copies.length;
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
    const updatedSource: ConnectedSource = {
      ...source,
      connected: true,
      comingSoon: false,
      lastSyncAt: new Date().toISOString(),
    };
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
    await new Promise((res) => setTimeout(res, 350));

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
      locale: state.locale,
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
      favoriteMeals: state.favoriteMeals,
    });

    get().showToast(
      `${source.name}: ${merged.report.importedWorkouts} Training(s) synchronisiert.`,
      'success'
    );
    return merged.report;
  },

  importExternalHealthFile: async (result) => {
    const state = get();
    const wk = mergeUniqueRecords(state.workouts, result.workouts);
    const hrv = mergeUniqueRecords(state.hrvObservations, result.hrvObservations);
    const rhr = mergeUniqueRecords(state.rhrObservations, result.rhrObservations);
    const slp = mergeUniqueRecords(state.sleepSessions, result.sleepSessions);

    const addedTotal =
      wk.added.length + hrv.added.length + rhr.added.length + slp.added.length;

    set({
      workouts: wk.merged,
      hrvObservations: hrv.merged,
      rhrObservations: rhr.merged,
      sleepSessions: slp.merged,
    });

    await Promise.all([
      wk.added.length ? db.workouts.bulkPut(wk.added) : Promise.resolve(),
      hrv.added.length ? db.hrvObservations.bulkPut(hrv.added) : Promise.resolve(),
      rhr.added.length ? db.rhrObservations.bulkPut(rhr.added) : Promise.resolve(),
      slp.added.length ? db.sleepSessions.bulkPut(slp.added) : Promise.resolve(),
    ]);

    if (addedTotal === 0) {
      get().showToast('Alle Einträge dieser Datei waren bereits vorhanden.', 'neutral');
    } else {
      get().showToast(result.summary, 'success');
    }
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
      schemaVersion: 3,
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
      favoriteMeals: s.favoriteMeals,
    };
  },

  importFromJson: async (rawPayload) => {
    const validation = validateImportPayload(rawPayload);
    if (!validation.valid) {
      get().showToast(validation.error || 'Ungültige Backup-Datei.', 'warning');
      return false;
    }

    const payload = rawPayload as AppExportPayload;
    const state = get();
    const meals = payload.meals || [];
    const hydrationEntries = payload.hydrationEntries || [];
    const favoriteMeals = payload.favoriteMeals || [];
    const hydratedProfile = withDynamicAge(payload.profile);

    await saveFullPersistedState({
      scenarioId: payload.scenarioId || 'balanced',
      theme: state.theme,
      locale: state.locale,
      aiPrivacy: state.aiPrivacy,
      profile: hydratedProfile,
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
      favoriteMeals,
    });

    set({
      scenarioId: payload.scenarioId || 'balanced',
      profile: hydratedProfile,
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
      favoriteMeals,
    });
    get().showToast('Lokales Backup erfolgreich importiert.', 'success');
    return true;
  },

  resetAllData: async () => {
    await clearAllLocalData();
    const todayKey = toLocalDateKey(new Date());
    const freshProfile = createEmptyFreshProfile(todayKey);
    const emptySources = createEmptyInitialSources();
    const currentLocale = get().locale;

    await saveFullPersistedState({
      scenarioId: 'balanced',
      theme: 'dark',
      locale: currentLocale,
      aiPrivacy: DEFAULT_AI_PRIVACY_SETTINGS,
      profile: freshProfile,
      connectedSources: emptySources,
      sourcePriorities: DEFAULT_SOURCE_PRIORITIES,
      hrvObservations: [],
      rhrObservations: [],
      sleepSessions: [],
      workouts: [],
      dailyActivities: [],
      bodyMeasurements: [],
      journalEntries: [],
      meals: [],
      hydrationEntries: [],
      favoriteMeals: [],
    });

    set({
      todayKey,
      selectedDate: todayKey,
      activeTab: 'today',
      detailView: 'none',
      theme: 'dark',
      aiPrivacy: DEFAULT_AI_PRIVACY_SETTINGS,
      scenarioId: 'balanced',
      profile: freshProfile,
      connectedSources: emptySources,
      sourcePriorities: DEFAULT_SOURCE_PRIORITIES,
      hrvObservations: [],
      rhrObservations: [],
      sleepSessions: [],
      workouts: [],
      dailyActivities: [],
      bodyMeasurements: [],
      journalEntries: [],
      meals: [],
      hydrationEntries: [],
      favoriteMeals: [],
      lastSyncReport: null,
    });
    get().showToast('Alle lokalen Daten wurden gelöscht.', 'neutral');
  },
}));
