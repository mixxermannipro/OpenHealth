import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { ChevronLeft } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useHealthStore } from './store/useHealthStore';
import { useThemeEffect } from './hooks/useTheme';
import { buildDailySnapshot } from './engine/calculations';
import { OnboardingScreen } from './components/screens/OnboardingScreen';
import { TodayScreen } from './components/screens/TodayScreen';
import type { MealModalMode } from './components/screens/MealAnalyzeModal';
import type { ExplanationTopic } from './components/ui/ExplanationSheet';
import { BreathworkModal } from './components/ui/LiquidPrimitives';
import { OfflineIndicator } from './components/ui/PWAInstallButton';
import { AppShell } from './components/layout/AppShell';
import {
  IncomingSharePayload,
  subscribeToIncomingMealShares,
} from './services/mealShareReceiver';
import {
  initNativeSafeAreaInsets,
  isNativeAndroid,
  minimizeNativeApp,
  subscribeToNativeBackButton,
} from './services/androidBridge';
import { MealCategory, MealEntry, PrimaryTab } from './types/health';

const RecoveryScreen = lazy(() =>
  import('./components/screens/RecoveryScreen').then((m) => ({ default: m.RecoveryScreen }))
);
const FitnessAgeScreen = lazy(() =>
  import('./components/screens/FitnessAgeScreen').then((m) => ({ default: m.FitnessAgeScreen }))
);
const SleepScreen = lazy(() =>
  import('./components/screens/SleepScreen').then((m) => ({ default: m.SleepScreen }))
);
const ActivityScreen = lazy(() =>
  import('./components/screens/ActivityScreen').then((m) => ({ default: m.ActivityScreen }))
);
const NutritionScreen = lazy(() =>
  import('./components/screens/NutritionScreen').then((m) => ({ default: m.NutritionScreen }))
);
const MoreScreen = lazy(() =>
  import('./components/screens/MoreScreen').then((m) => ({ default: m.MoreScreen }))
);
const HealthScreen = lazy(() =>
  import('./components/screens/HealthScreen').then((m) => ({ default: m.HealthScreen }))
);
const MealAnalyzeModal = lazy(() =>
  import('./components/screens/MealAnalyzeModal').then((m) => ({ default: m.MealAnalyzeModal }))
);
const WorkoutDetailSheet = lazy(() =>
  import('./components/screens/WorkoutDetailSheet').then((m) => ({ default: m.WorkoutDetailSheet }))
);
const JournalSheet = lazy(() =>
  import('./components/screens/JournalSheet').then((m) => ({ default: m.JournalSheet }))
);
const SettingsProfileSheet = lazy(() =>
  import('./components/screens/SettingsProfileSheet').then((m) => ({
    default: m.SettingsProfileSheet,
  }))
);
const ExplanationSheet = lazy(() =>
  import('./components/ui/ExplanationSheet').then((m) => ({ default: m.ExplanationSheet }))
);

const ScreenFallback = () => (
  <div className="space-y-3.5 animate-pulse pt-2">
    <div className="h-8 w-40 rounded-xl bg-[var(--bg-elevated)]" />
    <div className="h-44 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-hairline)]" />
    <div className="h-32 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)]" />
  </div>
);

export default function App() {
  const {
    initialized,
    initialize,
    syncTodayRollover,
    completeOnboarding,
    theme,
    profile,
    activeTab,
    setActiveTab,
    detailView,
    setDetailView,
    selectedDate,
    hrvObservations,
    rhrObservations,
    sleepSessions,
    workouts,
    dailyActivities,
    bodyMeasurements,
    journalEntries,
    selectedWorkoutId,
    setSelectedWorkoutId,
    aiPrivacy,
    connectedSources,
    syncHealthConnect,
  } = useHealthStore(
    useShallow((s) => ({
      initialized: s.initialized,
      initialize: s.initialize,
      syncTodayRollover: s.syncTodayRollover,
      completeOnboarding: s.completeOnboarding,
      theme: s.theme,
      profile: s.profile,
      activeTab: s.activeTab,
      setActiveTab: s.setActiveTab,
      detailView: s.detailView,
      setDetailView: s.setDetailView,
      selectedDate: s.selectedDate,
      hrvObservations: s.hrvObservations,
      rhrObservations: s.rhrObservations,
      sleepSessions: s.sleepSessions,
      workouts: s.workouts,
      dailyActivities: s.dailyActivities,
      bodyMeasurements: s.bodyMeasurements,
      journalEntries: s.journalEntries,
      selectedWorkoutId: s.selectedWorkoutId,
      setSelectedWorkoutId: s.setSelectedWorkoutId,
      aiPrivacy: s.aiPrivacy,
      connectedSources: s.connectedSources,
      syncHealthConnect: s.syncHealthConnect,
    }))
  );

  const [explainTopic, setExplainTopic] = useState<ExplanationTopic | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [breathworkOpen, setBreathworkOpen] = useState(false);
  const [mealModalOpen, setMealModalOpen] = useState(false);
  const [mealModalMode, setMealModalMode] = useState<MealModalMode>('ai');
  const [mealModalCategory, setMealModalCategory] = useState<MealCategory | undefined>(undefined);
  const [editingMeal, setEditingMeal] = useState<MealEntry | null>(null);
  const [pendingSharePayload, setPendingSharePayload] = useState<IncomingSharePayload | null>(null);
  const autostartConsumedRef = useRef(false);
  const lastAutoSyncMsRef = useRef(0);

  // Direction-aware transition tracking (left/right between tabs, push/pop for detail views)
  const TAB_ORDER: PrimaryTab[] = ['today', 'activity', 'sleep', 'nutrition', 'more'];
  const prevNavRef = useRef<{ tab: PrimaryTab; detail: string }>({
    tab: activeTab,
    detail: detailView,
  });
  let navDir = 0;
  if (prevNavRef.current.detail !== detailView) {
    navDir = detailView !== 'none' ? 1 : -1;
  } else if (prevNavRef.current.tab !== activeTab) {
    navDir = TAB_ORDER.indexOf(activeTab) > TAB_ORDER.indexOf(prevNavRef.current.tab) ? 1 : -1;
  }
  useEffect(() => {
    prevNavRef.current = { tab: activeTab, detail: detailView };
  }, [activeTab, detailView]);

  useThemeEffect(theme);

  useEffect(() => {
    const cleanupInsets = initNativeSafeAreaInsets();
    initialize();
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab') as PrimaryTab | null;
    if (tabParam && ['today', 'activity', 'sleep', 'nutrition', 'more'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
    return cleanupInsets;
  }, [initialize, setActiveTab]);

  // Keep todayKey fresh across midnight & auto-sync Android Health Connect on resume
  useEffect(() => {
    const maybeAutoSyncHealthConnect = () => {
      if (!isNativeAndroid() || !aiPrivacy.backgroundSync) return;
      const hcConnected = connectedSources.some(
        (s) => s.providerId === 'health_connect' && s.connected
      );
      if (!hcConnected) return;
      const now = Date.now();
      if (now - lastAutoSyncMsRef.current < 10 * 60 * 1000) return;
      lastAutoSyncMsRef.current = now;
      syncHealthConnect({ silent: true, daysBack: 14 }).catch(() => {});
    };

    const checkDate = () => {
      syncTodayRollover();
      maybeAutoSyncHealthConnect();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkDate();
    };
    window.addEventListener('focus', checkDate);
    document.addEventListener('visibilitychange', onVisibility);

    let midnightTimer: number | undefined;
    const scheduleNextMidnight = () => {
      const now = new Date();
      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        2
      );
      const delayMs = Math.max(1000, nextMidnight.getTime() - now.getTime());
      midnightTimer = window.setTimeout(() => {
        checkDate();
        scheduleNextMidnight();
      }, delayMs);
    };
    scheduleNextMidnight();

    return () => {
      window.removeEventListener('focus', checkDate);
      document.removeEventListener('visibilitychange', onVisibility);
      if (midnightTimer !== undefined) window.clearTimeout(midnightTimer);
    };
  }, [syncTodayRollover, aiPrivacy.backgroundSync, connectedSources, syncHealthConnect]);

  // Listen for Android Share-Intents (ACTION_SEND / /share-meal), Deep-Links (caltrack:// / kadenz://),
  // and native Launcher App Shortcuts on both cold start and while app is already running
  useEffect(() => {
    return subscribeToIncomingMealShares(
      (payload) => {
        setPendingSharePayload(payload);
      },
      (shortcutTab) => {
        if (['today', 'activity', 'sleep', 'nutrition', 'more'].includes(shortcutTab)) {
          setActiveTab(shortcutTab as PrimaryTab);
        }
      }
    );
  }, [setActiveTab]);

  // Native Android Hardware / Gesture Back button handler
  useEffect(() => {
    return subscribeToNativeBackButton(() => {
      if (explainTopic) {
        setExplainTopic(null);
        return;
      }
      if (mealModalOpen) {
        setMealModalOpen(false);
        setEditingMeal(null);
        setPendingSharePayload(null);
        return;
      }
      if (selectedWorkoutId) {
        setSelectedWorkoutId(null);
        return;
      }
      if (journalOpen) {
        setJournalOpen(false);
        return;
      }
      if (settingsOpen) {
        setSettingsOpen(false);
        return;
      }
      if (breathworkOpen) {
        setBreathworkOpen(false);
        return;
      }
      if (detailView !== 'none') {
        setDetailView('none');
        return;
      }
      if (activeTab !== 'today') {
        setActiveTab('today');
        return;
      }
      minimizeNativeApp();
    });
  }, [
    explainTopic,
    mealModalOpen,
    selectedWorkoutId,
    setSelectedWorkoutId,
    journalOpen,
    settingsOpen,
    breathworkOpen,
    detailView,
    setDetailView,
    activeTab,
    setActiveTab,
  ]);

  // Optional testability hook (?autostart=1) to bypass first-launch onboarding in automated checks
  useEffect(() => {
    if (!initialized || profile.onboardingCompleted || autostartConsumedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      autostartConsumedRef.current = true;
      completeOnboarding(
        {
          displayName: 'Manuel',
          birthDate: '1997-04-12',
          heightCm: 180,
          weightKg: 76,
          targetWeightKg: 74,
          nutritionGoalMode: 'cut',
          weeklyWeightChangeKg: -0.5,
          nutritionGoalDeltaKcal: -550,
          usesWearableActiveCalories: true,
        },
        []
      );
    }
  }, [initialized, profile.onboardingCompleted, completeOnboarding]);

  // Automatically open Zero-Cost KI-Import modal when an incoming Share-Intent or Deep-Link arrives
  useEffect(() => {
    if (!initialized || !profile.onboardingCompleted || !pendingSharePayload) return;
    setActiveTab('nutrition');
    setMealModalMode('ai');
    setMealModalCategory(undefined);
    setMealModalOpen(true);
  }, [initialized, profile.onboardingCompleted, pendingSharePayload, setActiveTab]);

  const snapshot = useMemo(
    () =>
      buildDailySnapshot(
        selectedDate,
        profile,
        hrvObservations,
        rhrObservations,
        sleepSessions,
        workouts,
        dailyActivities,
        bodyMeasurements,
        journalEntries
      ),
    [
      selectedDate,
      profile,
      hrvObservations,
      rhrObservations,
      sleepSessions,
      workouts,
      dailyActivities,
      bodyMeasurements,
      journalEntries,
    ]
  );

  const selectedWorkout = useMemo(
    () => workouts.find((w) => w.id === selectedWorkoutId) || null,
    [workouts, selectedWorkoutId]
  );

  const openMealModal = (mode: MealModalMode, category?: MealCategory, pastedText?: string) => {
    setEditingMeal(null);
    setMealModalMode(mode);
    setMealModalCategory(category);
    if (pastedText) {
      setPendingSharePayload({
        rawText: pastedText,
        origin: 'share_intent',
        receivedAt: Date.now(),
      });
    }
    setMealModalOpen(true);
  };

  const openEditMealModal = (meal: MealEntry) => {
    setEditingMeal(meal);
    setMealModalMode('manual');
    setMealModalCategory(meal.category);
    setMealModalOpen(true);
  };

  if (!initialized) {
    return (
      <div className="min-h-dvh bg-[var(--bg-canvas)] flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4 animate-pulse">
          <div className="h-7 w-40 rounded-xl bg-[var(--bg-elevated)]" />
          <div className="h-44 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-hairline)]" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-32 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)]" />
            <div className="h-32 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)]" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile.onboardingCompleted) {
    return (
      <>
        <OnboardingScreen />
        <OfflineIndicator />
      </>
    );
  }

  const renderScreen = () => {
    if (detailView === 'recovery') {
      return (
        <RecoveryScreen
          snapshot={snapshot}
          onExplain={setExplainTopic}
          onOpenBreathwork={() => setBreathworkOpen(true)}
          onOpenJournal={() => setJournalOpen(true)}
        />
      );
    }

    if (detailView === 'fitnessAge') {
      return <FitnessAgeScreen onExplain={setExplainTopic} />;
    }

    if (detailView === 'healthTrends') {
      return (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setDetailView('none')}
            className="inline-flex items-center gap-1 -ml-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Zurück zu Mehr</span>
          </button>
          <HealthScreen snapshot={snapshot} onExplain={setExplainTopic} />
        </div>
      );
    }

    if (detailView === 'sources' || detailView === 'aiPrivacy') {
      return (
        <MoreScreen
          onOpenJournal={() => setJournalOpen(true)}
          onOpenBreathwork={() => setBreathworkOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      );
    }

    switch (activeTab) {
      case 'today':
        return (
          <TodayScreen
            snapshot={snapshot}
            onExplain={setExplainTopic}
            onOpenBreathwork={() => setBreathworkOpen(true)}
            onOpenJournal={() => setJournalOpen(true)}
          />
        );
      case 'activity':
        return (
          <ActivityScreen
            snapshot={snapshot}
            onExplain={setExplainTopic}
            onOpenWorkout={(id) => setSelectedWorkoutId(id)}
          />
        );
      case 'sleep':
        return (
          <SleepScreen
            snapshot={snapshot}
            onExplain={setExplainTopic}
            onOpenBreathwork={() => setBreathworkOpen(true)}
            onOpenJournal={() => setJournalOpen(true)}
          />
        );
      case 'nutrition':
        return (
          <NutritionScreen
            snapshot={snapshot}
            onExplain={setExplainTopic}
            onOpenMealModal={openMealModal}
            onEditMeal={openEditMealModal}
          />
        );
      case 'more':
        return (
          <MoreScreen
            onOpenJournal={() => setJournalOpen(true)}
            onOpenBreathwork={() => setBreathworkOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        );
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <AppShell
        onOpenJournal={() => setJournalOpen(true)}
        onOpenBreathwork={() => setBreathworkOpen(true)}
      >
        <AnimatePresence mode="wait" initial={false} custom={navDir}>
          <motion.div
            key={`${activeTab}:${detailView}`}
            custom={navDir}
            initial={{ opacity: 0, x: navDir === 0 ? 0 : navDir * 22, y: navDir === 0 ? 8 : 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: navDir === 0 ? 0 : navDir * -16, y: navDir === 0 ? -4 : 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <Suspense fallback={<ScreenFallback />}>{renderScreen()}</Suspense>
          </motion.div>
        </AnimatePresence>
      </AppShell>

      <Suspense fallback={null}>
        <WorkoutDetailSheet
          workout={selectedWorkout}
          onClose={() => setSelectedWorkoutId(null)}
        />
        <JournalSheet open={journalOpen} onClose={() => setJournalOpen(false)} />
        <SettingsProfileSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <MealAnalyzeModal
          open={mealModalOpen}
          initialMode={mealModalMode}
          initialCategory={mealModalCategory}
          editingMeal={editingMeal}
          initialSharePayload={pendingSharePayload}
          onConsumeSharePayload={() => setPendingSharePayload(null)}
          onClose={() => {
            setMealModalOpen(false);
            setEditingMeal(null);
            setPendingSharePayload(null);
          }}
        />
        <ExplanationSheet topic={explainTopic} onClose={() => setExplainTopic(null)} />
      </Suspense>
      <BreathworkModal open={breathworkOpen} onClose={() => setBreathworkOpen(false)} />
      <OfflineIndicator />
    </MotionConfig>
  );
}
