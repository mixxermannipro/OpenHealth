import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { ChevronLeft } from 'lucide-react';
import { useHealthStore } from './store/useHealthStore';
import { useThemeEffect } from './hooks/useTheme';
import { buildDailySnapshot } from './engine/calculations';
import { OnboardingScreen } from './components/screens/OnboardingScreen';
import { TodayScreen } from './components/screens/TodayScreen';
import { RecoveryScreen } from './components/screens/RecoveryScreen';
import { FitnessAgeScreen } from './components/screens/FitnessAgeScreen';
import { SleepScreen } from './components/screens/SleepScreen';
import { ActivityScreen } from './components/screens/ActivityScreen';
import { NutritionScreen } from './components/screens/NutritionScreen';
import { MealAnalyzeModal, MealModalMode } from './components/screens/MealAnalyzeModal';
import { MoreScreen } from './components/screens/MoreScreen';
import { HealthScreen } from './components/screens/HealthScreen';
import { WorkoutDetailSheet } from './components/screens/WorkoutDetailSheet';
import { JournalSheet } from './components/screens/JournalSheet';
import { SettingsProfileSheet } from './components/screens/SettingsProfileSheet';
import { ExplanationSheet, ExplanationTopic } from './components/ui/ExplanationSheet';
import { BreathworkModal } from './components/ui/LiquidPrimitives';
import { OfflineIndicator } from './components/ui/PWAInstallButton';
import { AppShell } from './components/layout/AppShell';

import { MealCategory, PrimaryTab } from './types/health';

export default function App() {
  const {
    initialized,
    initialize,
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
  } = useHealthStore();

  const [explainTopic, setExplainTopic] = useState<ExplanationTopic | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [breathworkOpen, setBreathworkOpen] = useState(false);
  const [mealModalOpen, setMealModalOpen] = useState(false);
  const [mealModalMode, setMealModalMode] = useState<MealModalMode>('ai');
  const [mealModalCategory, setMealModalCategory] = useState<MealCategory | undefined>(undefined);

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
    initialize();
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab') as PrimaryTab | null;
    if (tabParam && ['today', 'activity', 'sleep', 'nutrition', 'more'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [initialize, setActiveTab]);

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

  const openMealModal = (mode: MealModalMode, category?: MealCategory) => {
    setMealModalMode(mode);
    setMealModalCategory(category);
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
            {renderScreen()}
          </motion.div>
        </AnimatePresence>
      </AppShell>

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
        onClose={() => setMealModalOpen(false)}
      />
      <BreathworkModal open={breathworkOpen} onClose={() => setBreathworkOpen(false)} />
      <ExplanationSheet topic={explainTopic} onClose={() => setExplainTopic(null)} />
      <OfflineIndicator />
    </MotionConfig>
  );
}
