import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform } from 'motion/react';
import {
  Flame,
  Camera,
  ScanBarcode,
  Search,
  Mic,
  Droplets,
  Plus,
  Minus,
  Trash2,
  Copy,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Utensils,
  Sun,
  Coffee,
  Moon,
  Apple,
} from 'lucide-react';
import { DailyDerivedSnapshot, MealCategory, MealEntry } from '../../types/health';
import { useHealthStore } from '../../store/useHealthStore';
import {
  buildMealEntryFromItems,
  calculateNutritionTargets,
  summarizeMealsForDate,
} from '../../engine/nutrition';
import { ExplanationTopic } from '../../i18n/de';
import { InfoButton } from '../ui/InfoButton';
import { CircularProgressRing } from '../ui/LiquidPrimitives';
import {
  AnimatedNumber,
  APPLE_EASE,
  SNAPPY_SPRING,
  staggerCardVariants,
  staggerParentVariants,
} from '../ui/MotionPrimitives';
import {
  addDaysToKey,
  formatGermanShortDate,
  formatNumberDE,
} from '../../utils/formatters';
import { haptics } from '../../utils/haptics';
import { MealModalMode } from './MealAnalyzeModal';

interface NutritionScreenProps {
  snapshot: DailyDerivedSnapshot;
  onExplain: (topic: ExplanationTopic) => void;
  onOpenMealModal: (mode: MealModalMode, category?: MealCategory) => void;
}

const MEAL_SLOTS: {
  id: MealCategory;
  label: string;
  hint: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  { id: 'breakfast', label: 'Frühstück', hint: 'Morgens', icon: Coffee },
  { id: 'lunch', label: 'Mittagessen', hint: 'Mittags', icon: Sun },
  { id: 'dinner', label: 'Abendessen', hint: 'Abends', icon: Moon },
  { id: 'snack', label: 'Snacks', hint: 'Zwischendurch', icon: Apple },
];

interface SwipeableMealRowProps {
  meal: MealEntry;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRepeat: () => void;
  onDelete: () => void;
}

const SwipeableMealRow: React.FC<SwipeableMealRowProps> = ({
  meal,
  isExpanded,
  onToggleExpand,
  onRepeat,
  onDelete,
}) => {
  const [swipedOpen, setSwipedOpen] = useState(false);
  const x = useMotionValue(0);
  const actionsOpacity = useTransform(x, [-18, -2], [1, 0]);
  const draggingRef = useRef(false);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const shouldOpen = info.offset.x < -52 || info.velocity.x < -280;
    const shouldClose = info.offset.x > 36 || info.velocity.x > 240;

    if (shouldOpen && !swipedOpen) {
      haptics.tick();
      setSwipedOpen(true);
    } else if (shouldClose && swipedOpen) {
      haptics.tick();
      setSwipedOpen(false);
    }
    setTimeout(() => {
      draggingRef.current = false;
    }, 60);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.24, ease: APPLE_EASE }}
      className="relative overflow-hidden"
      data-no-tab-swipe="true"
    >
      {/* Revealed iOS Swipe Actions Behind Row */}
      <div className="relative overflow-hidden">
        <motion.div
          aria-hidden={!swipedOpen}
          style={{ opacity: actionsOpacity }}
          className="absolute inset-y-0 right-0 flex items-stretch"
        >
          <button
            type="button"
            tabIndex={swipedOpen ? 0 : -1}
            onClick={() => {
              setSwipedOpen(false);
              onRepeat();
            }}
            className="w-[62px] bg-[var(--bg-elevated)] text-[var(--text-primary)] flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium hover:brightness-110 transition-all"
          >
            <Copy className="w-3.5 h-3.5 text-[var(--accent-hrv)]" />
            <span>Nochmal</span>
          </button>
          <button
            type="button"
            tabIndex={swipedOpen ? 0 : -1}
            onClick={() => {
              setSwipedOpen(false);
              onDelete();
            }}
            className="w-[62px] bg-[var(--accent-strain)] text-white flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold hover:brightness-105 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Löschen</span>
          </button>
        </motion.div>

        {/* Draggable Foreground Row */}
        <motion.div
          drag="x"
          dragDirectionLock
          dragConstraints={{ left: -124, right: 0 }}
          dragElastic={0.14}
          style={{ x }}
          animate={{ x: swipedOpen ? -124 : 0 }}
          transition={SNAPPY_SPRING}
          onDragStart={() => {
            draggingRef.current = true;
          }}
          onDragEnd={handleDragEnd}
          className="relative z-10 bg-[var(--bg-surface)]"
        >
          <button
            type="button"
            onClick={() => {
              if (draggingRef.current) return;
              if (swipedOpen) {
                haptics.tick();
                setSwipedOpen(false);
                return;
              }
              haptics.tick();
              onToggleExpand();
            }}
            className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-[var(--bg-well)]/40 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-[12px] bg-[var(--bg-elevated)] border border-[var(--border-hairline)] overflow-hidden shrink-0 flex items-center justify-center">
                {meal.imageUrl ? (
                  <img
                    src={meal.imageUrl}
                    alt={meal.subtitle || meal.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Utensils className="w-4 h-4 text-[var(--accent-calories)]" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-[var(--text-primary)] truncate">
                  {meal.subtitle || meal.title}
                </p>
                <p className="text-[11.5px] tabular-nums text-[var(--text-muted)]">
                  P {Math.round(meal.proteinG)}g · K {Math.round(meal.carbsG)}g · F{' '}
                  {Math.round(meal.fatG)}g
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[14.5px] font-semibold tabular-nums text-[var(--text-primary)]">
                {formatNumberDE(meal.totalCalories)}{' '}
                <span className="text-[11.5px] font-normal text-[var(--text-muted)]">kcal</span>
              </span>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
              )}
            </div>
          </button>
        </motion.div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="meal-details"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: APPLE_EASE }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3.5 pt-2 bg-[var(--bg-well)]/30 space-y-2.5">
              <div className="divide-y divide-[var(--border-hairline)]">
                {meal.items.map((item) => (
                  <div
                    key={item.id}
                    className="py-1.5 flex items-center justify-between text-xs gap-2"
                  >
                    <span className="text-[var(--text-primary)] truncate">
                      {item.name}
                      {item.brand ? ` (${item.brand})` : ''}
                    </span>
                    <span className="shrink-0 tabular-nums text-[var(--text-secondary)]">
                      {item.grams} g · {item.calories} kcal
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-[var(--text-muted)] truncate">
                  {meal.analysisNote || 'Lokal gespeichert'}
                </span>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={onRepeat}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Nochmal
                  </button>
                  <button
                    type="button"
                    onClick={onDelete}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-strain)] hover:underline"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Entfernen
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export const NutritionScreen: React.FC<NutritionScreenProps> = ({
  snapshot,
  onExplain,
  onOpenMealModal,
}) => {
  const {
    profile,
    todayKey,
    selectedDate,
    setSelectedDate,
    meals,
    hydrationEntries,
    addMealEntry,
    deleteMealEntry,
    addWaterMl,
  } = useHealthStore();

  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);
  const heroSwipeRef = useRef<{ x: number; y: number } | null>(null);

  const activeCaloriesToday = useMemo(() => {
    const wkSum = snapshot.trainingLoad.workouts.reduce(
      (s, w) => s + (w.caloriesKcal ?? Math.round(w.durationMinutes * 9)),
      0
    );
    return snapshot.activity?.activeCaloriesKcal ?? Math.max(380, wkSum);
  }, [snapshot]);

  const targets = useMemo(
    () => calculateNutritionTargets(profile, activeCaloriesToday),
    [profile, activeCaloriesToday]
  );

  const summary = useMemo(
    () => summarizeMealsForDate(meals, selectedDate),
    [meals, selectedDate]
  );

  const remainingKcal = Math.max(0, targets.caloriesKcal - summary.totalCalories);
  const overKcal = Math.max(0, summary.totalCalories - targets.caloriesKcal);
  const pct = Math.min(
    100,
    Math.round((summary.totalCalories / Math.max(1, targets.caloriesKcal)) * 100)
  );

  const waterMl = hydrationEntries.find((h) => h.date === selectedDate)?.ml ?? 1500;
  const waterGoalMl = Math.max(2200, Math.round((profile.weightKg || 75) * 33));
  const waterPct = Math.min(100, Math.round((waterMl / waterGoalMl) * 100));

  const activeDateLabel =
    selectedDate === todayKey
      ? 'Heute'
      : selectedDate === addDaysToKey(todayKey, -1)
        ? 'Gestern'
        : formatGermanShortDate(selectedDate);

  const isToday = selectedDate === todayKey;

  const coreMacros = [
    {
      label: 'Protein',
      current: summary.proteinG,
      target: targets.proteinG,
      color: '#5CE17C',
    },
    {
      label: 'Kohlenh.',
      current: summary.carbsG,
      target: targets.carbsG,
      color: '#60A5FA',
    },
    {
      label: 'Fett',
      current: summary.fatG,
      target: targets.fatG,
      color: '#F5B82E',
    },
  ];

  const handleDayStep = (delta: -1 | 1) => {
    if (delta === 1 && isToday) return;
    haptics.selection();
    setSelectedDate(addDaysToKey(selectedDate, delta));
  };

  const handleHeroTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    heroSwipeRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleHeroTouchEnd = (e: React.TouchEvent) => {
    const start = heroSwipeRef.current;
    heroSwipeRef.current = null;
    if (!start || e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
    if (dx > 0) handleDayStep(-1);
    else if (!isToday) handleDayStep(1);
  };

  const handleWaterDelta = (delta: number) => {
    const nextMl = Math.max(0, waterMl + delta);
    if (delta > 0 && waterMl < waterGoalMl && nextMl >= waterGoalMl) {
      haptics.success();
    } else {
      haptics.light();
    }
    addWaterMl(selectedDate, delta);
  };

  const handleRepeatMeal = async (meal: MealEntry) => {
    haptics.success();
    const duplicate = buildMealEntryFromItems({
      date: selectedDate,
      category: meal.category,
      items: meal.items.map((item) => ({
        ...item,
        id: `${item.id}_${Date.now()}`,
      })),
      imageUrl: meal.imageUrl,
      analysisNote: 'Wiederholt hinzugefügt',
    });
    await addMealEntry(duplicate);
  };

  const handleDeleteMeal = async (mealId: string) => {
    haptics.warning();
    if (expandedMealId === mealId) setExpandedMealId(null);
    await deleteMealEntry(mealId);
  };

  return (
    <motion.div
      variants={staggerParentVariants}
      initial="hidden"
      animate="show"
      className="space-y-4"
    >
      {/* Minimalist Top Bar with Day Switcher */}
      <motion.header
        variants={staggerCardVariants}
        className="flex items-center justify-between gap-3 pt-1"
      >
        <div className="flex items-center gap-1.5">
          <h1 className="text-[30px] font-bold tracking-tight text-[var(--text-primary)]">
            Essen
          </h1>
          <InfoButton label="Kalorien & Makros" onClick={() => onExplain('nutrition')} />
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-full bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-0.5">
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => handleDayStep(-1)}
              aria-label="Vorheriger Tag"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-well)] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </motion.button>
            <span className="px-2.5 text-[13px] font-medium text-[var(--text-primary)] min-w-[66px] text-center">
              {activeDateLabel}
            </span>
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              disabled={isToday}
              onClick={() => handleDayStep(1)}
              aria-label="Nächster Tag"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-well)] disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              haptics.light();
              onOpenMealModal('ai');
            }}
            className="hidden lg:inline-flex min-h-[38px] items-center gap-2 rounded-full bg-[#F5B82E] text-[#111215] px-4 text-xs font-semibold shadow-md shadow-[#F5B82E]/20 hover:brightness-105 transition-all"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Mahlzeit erfassen</span>
          </motion.button>
        </div>
      </motion.header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: Unified Calories & Macros Card + Compact Quick-Capture + Slim Water Bar */}
        <div className="lg:col-span-5 space-y-3.5">
          {/* Unified Hero Budget & Macros Surface (supports horizontal day-swipe) */}
          <motion.div
            variants={staggerCardVariants}
            data-no-tab-swipe="true"
            onTouchStart={handleHeroTouchStart}
            onTouchEnd={handleHeroTouchEnd}
            className="apple-card p-5 space-y-5"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-[var(--text-muted)]">
                  {overKcal > 0 ? 'Über Tagesbudget' : 'Noch verfügbar'}
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <AnimatedNumber
                    value={overKcal > 0 ? overKcal : remainingKcal}
                    prefix={overKcal > 0 ? '+' : ''}
                    className="serif-metric text-[50px] font-medium leading-none text-[var(--text-primary)]"
                  />
                  <span className="serif-metric text-[18px] text-[var(--text-secondary)]">
                    kcal
                  </span>
                </div>

                {/* Calm 3-number triad: Gegessen · Aktiv · Ziel */}
                <div className="mt-3 flex items-center gap-4 text-[12px] tabular-nums">
                  <div>
                    <p className="text-[var(--text-muted)] text-[10.5px]">Gegessen</p>
                    <p className="font-semibold text-[var(--text-primary)]">
                      <AnimatedNumber value={summary.totalCalories} />
                    </p>
                  </div>
                  <div className="h-5 w-px bg-[var(--border-hairline)]" />
                  <div>
                    <p className="text-[var(--text-muted)] text-[10.5px]">Aktiv</p>
                    <p className="font-semibold text-[var(--accent-recovery)]">
                      +{formatNumberDE(targets.activeBonusKcal)}
                    </p>
                  </div>
                  <div className="h-5 w-px bg-[var(--border-hairline)]" />
                  <div>
                    <p className="text-[var(--text-muted)] text-[10.5px]">Ziel</p>
                    <p className="font-semibold text-[var(--text-secondary)]">
                      {formatNumberDE(targets.caloriesKcal)}
                    </p>
                  </div>
                </div>
              </div>

              <CircularProgressRing
                percent={pct}
                size={98}
                strokeWidth={8}
                color={overKcal > 0 ? 'var(--accent-strain)' : 'var(--accent-calories)'}
              >
                <Flame
                  className="w-4 h-4 mb-0.5"
                  style={{
                    color: overKcal > 0 ? 'var(--accent-strain)' : 'var(--accent-calories)',
                  }}
                />
                <span className="text-[16px] font-bold tabular-nums text-[var(--text-primary)] leading-none">
                  {pct}%
                </span>
              </CircularProgressRing>
            </div>

            {/* Integrated 3-Column Macro Bars */}
            <div className="pt-4 border-t border-[var(--border-hairline)] space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {coreMacros.map((m) => {
                  const widthPct = Math.min(
                    100,
                    Math.round((m.current / Math.max(1, m.target)) * 100)
                  );
                  return (
                    <div key={m.label} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-1 text-[11.5px]">
                        <span className="font-medium text-[var(--text-secondary)] truncate">
                          {m.label}
                        </span>
                      </div>
                      <div className="h-[5px] w-full rounded-full bg-[var(--bg-well)] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(4, widthPct)}%` }}
                          transition={{ type: 'spring', stiffness: 170, damping: 24 }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: m.color }}
                        />
                      </div>
                      <p className="text-[11.5px] tabular-nums text-[var(--text-muted)]">
                        <span className="font-semibold text-[var(--text-primary)]">
                          {m.current}
                        </span>
                        /{m.target}g
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-[11.5px] text-[var(--text-muted)] pt-0.5">
                <span>Ballaststoffe</span>
                <span className="tabular-nums">
                  <strong className="font-medium text-[var(--text-secondary)]">
                    {summary.fiberG}
                  </strong>{' '}
                  / {targets.fiberG} g
                </span>
              </div>
            </div>
          </motion.div>

          {/* Single-Row Minimalist Capture Strip */}
          <motion.div variants={staggerCardVariants} className="apple-card p-1.5 grid grid-cols-4 gap-1">
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                haptics.light();
                onOpenMealModal('ai');
              }}
              className="min-h-[42px] rounded-[16px] bg-[#F5B82E] text-[#111215] flex items-center justify-center gap-1.5 text-xs font-semibold hover:brightness-105 transition-all"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>KI-Foto</span>
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                haptics.selection();
                onOpenMealModal('barcode');
              }}
              className="min-h-[42px] rounded-[16px] hover:bg-[var(--bg-well)] text-[var(--text-primary)] flex items-center justify-center gap-1.5 text-xs font-medium transition-colors"
            >
              <ScanBarcode className="w-3.5 h-3.5 text-[var(--accent-calories)]" />
              <span>Scan</span>
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                haptics.selection();
                onOpenMealModal('search');
              }}
              className="min-h-[42px] rounded-[16px] hover:bg-[var(--bg-well)] text-[var(--text-primary)] flex items-center justify-center gap-1.5 text-xs font-medium transition-colors"
            >
              <Search className="w-3.5 h-3.5 text-[var(--accent-hrv)]" />
              <span>Suche</span>
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                haptics.selection();
                onOpenMealModal('voice');
              }}
              className="min-h-[42px] rounded-[16px] hover:bg-[var(--bg-well)] text-[var(--text-primary)] flex items-center justify-center gap-1.5 text-xs font-medium transition-colors"
            >
              <Mic className="w-3.5 h-3.5 text-[var(--accent-sleep)]" />
              <span>Sprache</span>
            </motion.button>
          </motion.div>

          {/* Minimalist 1-Line Hydration Strip */}
          <motion.div variants={staggerCardVariants} className="apple-card px-4 py-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <Droplets className="w-4 h-4 text-[var(--accent-hrv)] shrink-0" />
                <span className="text-[13.5px] font-medium text-[var(--text-primary)]">Wasser</span>
                <span className="text-[12.5px] tabular-nums text-[var(--text-secondary)]">
                  {formatNumberDE(waterMl / 1000, 2)} / {formatNumberDE(waterGoalMl / 1000, 1)} L
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleWaterDelta(-250)}
                  aria-label="250 ml Wasser abziehen"
                  className="w-8 h-8 rounded-full bg-[var(--bg-well)] hover:bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <Minus className="w-3.5 h-3.5" />
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => handleWaterDelta(250)}
                  aria-label="250 ml Wasser hinzufügen"
                  className="min-h-[32px] inline-flex items-center gap-1 rounded-full bg-[var(--accent-hrv)]/16 text-[var(--accent-hrv)] hover:bg-[var(--accent-hrv)]/24 px-3 text-xs font-semibold transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  250 ml
                </motion.button>
              </div>
            </div>
            <div className="h-[4px] w-full rounded-full bg-[var(--bg-well)] overflow-hidden">
              <motion.div
                initial={false}
                animate={{ width: `${waterPct}%` }}
                transition={{ type: 'spring', stiffness: 180, damping: 24 }}
                className="h-full rounded-full bg-[var(--accent-hrv)]"
              />
            </div>
          </motion.div>
        </div>

        {/* Right Column: Clean Grouped Meal Slots with iOS Swipe-to-Act Rows */}
        <div className="lg:col-span-7 space-y-3">
          {MEAL_SLOTS.map((slot) => {
            const SlotIcon = slot.icon;
            const slotMeals = summary.dayMeals.filter((m) => m.category === slot.id);
            const slotCalories = slotMeals.reduce((sum, m) => sum + m.totalCalories, 0);

            return (
              <motion.section
                key={slot.id}
                variants={staggerCardVariants}
                className="apple-card overflow-hidden"
              >
                {/* Slot Header */}
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-full bg-[var(--bg-well)] flex items-center justify-center shrink-0">
                      <SlotIcon className="w-4 h-4 text-[var(--text-secondary)]" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-[14.5px] font-semibold text-[var(--text-primary)] leading-tight">
                        {slot.label}
                      </h2>
                      <p className="text-[11.5px] tabular-nums text-[var(--text-muted)]">
                        {slotMeals.length > 0
                          ? `${formatNumberDE(slotCalories)} kcal`
                          : 'Noch nichts erfasst'}
                      </p>
                    </div>
                  </div>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      haptics.tick();
                      onOpenMealModal('ai', slot.id);
                    }}
                    aria-label={`${slot.label} hinzufügen`}
                    className="w-8 h-8 rounded-full bg-[var(--bg-well)] hover:bg-[var(--text-primary)] text-[var(--text-primary)] hover:text-[var(--bg-canvas)] flex items-center justify-center transition-colors shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                  </motion.button>
                </div>

                {/* Slot Meals (Swipe left for Nochmal / Löschen) */}
                {slotMeals.length > 0 && (
                  <div className="border-t border-[var(--border-hairline)] divide-y divide-[var(--border-hairline)]">
                    <AnimatePresence initial={false}>
                      {slotMeals.map((meal) => (
                        <SwipeableMealRow
                          key={meal.id}
                          meal={meal}
                          isExpanded={expandedMealId === meal.id}
                          onToggleExpand={() =>
                            setExpandedMealId(expandedMealId === meal.id ? null : meal.id)
                          }
                          onRepeat={() => handleRepeatMeal(meal)}
                          onDelete={() => handleDeleteMeal(meal.id)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </motion.section>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

