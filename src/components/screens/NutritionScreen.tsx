import React, { memo, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Barcode,
  Check,
  ClipboardPaste,
  Copy,
  Droplets,
  Edit3,
  Flame,
  Minus,
  Plus,
  RotateCw,
  Scale,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  Utensils,
  ChevronRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useShallow } from 'zustand/react/shallow';
import { DailyDerivedSnapshot, FavoriteMeal, MealCategory, MealEntry } from '../../types/health';
import { useHealthStore } from '../../store/useHealthStore';
import {
  calculateNutritionTargets,
  computeWeightTrendAndCoach,
  summarizeMealsForDate,
} from '../../engine/nutrition';
import { ExplanationTopic } from '../../i18n/de';
import { InfoButton } from '../ui/InfoButton';
import { CircularProgressRing } from '../ui/LiquidPrimitives';
import { AnimatedNumber, APPLE_EASE, SNAPPY_SPRING } from '../ui/MotionPrimitives';
import { MealModalMode } from './MealAnalyzeModal';
import { NutritionOnboarding } from './NutritionOnboarding';
import { addDaysToKey, formatGermanShortDate, formatNumberDE } from '../../utils/formatters';
import { useI18n } from '../../i18n/useI18n';
import { haptics } from '../../utils/haptics';

interface NutritionScreenProps {
  snapshot: DailyDerivedSnapshot;
  onExplain: (topic: ExplanationTopic) => void;
  onOpenMealModal: (mode: MealModalMode, category?: MealCategory, pastedText?: string) => void;
  onEditMeal: (meal: MealEntry) => void;
}

type NutritionSection = 'log' | 'capture' | 'plan';

const SLOTS: MealCategory[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const SECTION_ORDER: NutritionSection[] = ['log', 'capture', 'plan'];

export const NutritionScreen: React.FC<NutritionScreenProps> = ({
  snapshot,
  onExplain,
  onOpenMealModal,
  onEditMeal,
}) => {
  const {
    profile,
    selectedDate,
    meals,
    hydrationEntries,
    bodyMeasurements,
    favoriteMeals,
    addMealEntry,
    deleteMealEntry,
    toggleFavoriteMeal,
    deleteFavoriteMeal,
    logFavoriteMeal,
    copyMealsFromYesterday,
    logWeightMeasurement,
    updateProfile,
    addWaterMl,
    showToast,
  } = useHealthStore(
    useShallow((s) => ({
      profile: s.profile,
      selectedDate: s.selectedDate,
      meals: s.meals,
      hydrationEntries: s.hydrationEntries,
      bodyMeasurements: s.bodyMeasurements,
      favoriteMeals: s.favoriteMeals,
      addMealEntry: s.addMealEntry,
      deleteMealEntry: s.deleteMealEntry,
      toggleFavoriteMeal: s.toggleFavoriteMeal,
      deleteFavoriteMeal: s.deleteFavoriteMeal,
      logFavoriteMeal: s.logFavoriteMeal,
      copyMealsFromYesterday: s.copyMealsFromYesterday,
      logWeightMeasurement: s.logWeightMeasurement,
      updateProfile: s.updateProfile,
      addWaterMl: s.addWaterMl,
      showToast: s.showToast,
    }))
  );

  const { t } = useI18n();
  const [section, setSection] = useState<NutritionSection>('log');
  const [sectionDir, setSectionDir] = useState(0);
  const [planOpen, setPlanOpen] = useState(false);

  const todayMeasurement = useMemo(
    () => bodyMeasurements.find((b) => b.date === selectedDate) ?? null,
    [bodyMeasurements, selectedDate]
  );
  const [weightDraft, setWeightDraft] = useState<string>(
    String(todayMeasurement?.weightKg ?? profile.weightKg)
  );

  useEffect(() => {
    setWeightDraft(String(todayMeasurement?.weightKg ?? profile.weightKg));
  }, [todayMeasurement?.weightKg, profile.weightKg, selectedDate]);

  const switchSection = (next: NutritionSection) => {
    if (next === section) return;
    haptics.selection();
    setSectionDir(SECTION_ORDER.indexOf(next) > SECTION_ORDER.indexOf(section) ? 1 : -1);
    setSection(next);
  };

  const activeCaloriesToday = useMemo(() => {
    const workoutCals = snapshot.trainingLoad.workouts.reduce(
      (sum, w) => sum + (w.caloriesKcal ?? Math.round(w.durationMinutes * 9)),
      0
    );
    return snapshot.activity?.activeCaloriesKcal ?? workoutCals;
  }, [snapshot]);

  const targets = useMemo(
    () => calculateNutritionTargets(profile, activeCaloriesToday),
    [profile, activeCaloriesToday]
  );

  const summary = useMemo(
    () => summarizeMealsForDate(meals, selectedDate),
    [meals, selectedDate]
  );

  const waterMl = useMemo(
    () => hydrationEntries.find((h) => h.date === selectedDate)?.ml ?? 0,
    [hydrationEntries, selectedDate]
  );
  const waterGoalMl = Math.max(2000, Math.round(profile.weightKg * 35));
  const waterPct = Math.min(100, Math.round((waterMl / Math.max(1, waterGoalMl)) * 100));

  const remainingKcal = targets.caloriesKcal - summary.totalCalories;
  const isOver = remainingKcal < 0;
  const progressPct = Math.min(
    100,
    Math.round((summary.totalCalories / Math.max(1, targets.caloriesKcal)) * 100)
  );

  const handleQuickClipboardImport = async () => {
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim().length > 0) {
          haptics.success();
          onOpenMealModal('ai', undefined, text);
          return;
        }
      }
    } catch {
      // Fallback: open AI Import sheet cleanly for manual paste
    }
    haptics.tick();
    onOpenMealModal('ai');
  };

  const handleRepeatMeal = async (meal: MealEntry) => {
    haptics.success();
    await addMealEntry({
      ...meal,
      id: `meal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date: selectedDate,
      timestamp: new Date().toISOString(),
    });
  };

  const handleDeleteMeal = async (mealId: string) => {
    haptics.warning();
    await deleteMealEntry(mealId);
  };

  const yesterdayKey = useMemo(() => addDaysToKey(selectedDate, -1), [selectedDate]);
  const yesterdaySummary = useMemo(
    () => summarizeMealsForDate(meals, yesterdayKey),
    [meals, yesterdayKey]
  );
  const yesterdayTotalCount = useMemo(
    () => meals.filter((m) => m.date === yesterdayKey).length,
    [meals, yesterdayKey]
  );

  const favoriteKeySet = useMemo(
    () =>
      new Set(
        favoriteMeals.map((f) => `${f.title.trim().toLowerCase()}|${f.totalCalories}`)
      ),
    [favoriteMeals]
  );

  const isMealFavorited = (meal: MealEntry) =>
    favoriteKeySet.has(`${meal.title.trim().toLowerCase()}|${meal.totalCalories}`);

  const recentUniqueMeals = useMemo(() => {
    const seen = new Set<string>();
    const list: MealEntry[] = [];
    for (const m of meals) {
      const key = `${m.title.trim().toLowerCase()}|${m.totalCalories}`;
      if (seen.has(key) || favoriteKeySet.has(key)) continue;
      seen.add(key);
      list.push(m);
      if (list.length >= 5) break;
    }
    return list;
  }, [meals, favoriteKeySet]);

  const weightCoach = useMemo(
    () => computeWeightTrendAndCoach(bodyMeasurements, meals, profile, selectedDate, 21),
    [bodyMeasurements, meals, profile, selectedDate]
  );

  const weightChartData = useMemo(
    () =>
      weightCoach.points.map((pt) => ({
        ...pt,
        label: pt.label || formatGermanShortDate(pt.date),
      })),
    [weightCoach.points]
  );

  const handleSaveWeight = async () => {
    const val = Number(weightDraft.replace(',', '.'));
    if (!Number.isFinite(val) || val < 30 || val > 250) {
      haptics.warning();
      showToast('Bitte ein gültiges Gewicht zwischen 30 und 250 kg eingeben.', 'warning');
      return;
    }
    haptics.success();
    await logWeightMeasurement(selectedDate, val);
  };

  const handleStepWeight = (delta: number) => {
    const current = Number(weightDraft.replace(',', '.'));
    const base = Number.isFinite(current) ? current : profile.weightKg;
    const next = Math.max(30, Math.min(250, Number((base + delta).toFixed(1))));
    haptics.tick();
    setWeightDraft(next.toFixed(1));
  };

  const handleApplyCoachTarget = async () => {
    if (weightCoach.suggestedDailyTargetKcal === null) return;
    haptics.success();
    await updateProfile({ customCalorieTarget: weightCoach.suggestedDailyTargetKcal });
  };

  const handleWater = async (delta: number) => {
    haptics.tick();
    await addWaterMl(selectedDate, delta);
    if (delta > 0) {
      showToast(`+${delta} ml Wasser gespeichert.`, 'neutral');
    }
  };

  const subTabs: { id: NutritionSection; label: string; icon: React.FC<{ className?: string }> }[] =
    [
      { id: 'log', label: 'Tagebuch', icon: Utensils },
      { id: 'capture', label: 'Erfassen', icon: Sparkles },
      { id: 'plan', label: 'Gewicht & Plan', icon: Scale },
    ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: APPLE_EASE }}
      className="space-y-4"
    >
      {/* Minimalist Header */}
      <header className="flex items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight text-[var(--text-primary)] leading-tight">
            {t.nutrition.title}
          </h1>
          <p className="mt-0.5 text-[13.5px] text-[var(--text-secondary)]">
            Kalorien, Makros & 0 € KI-Import
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <InfoButton label={t.nutrition.title} onClick={() => onExplain('nutrition')} />
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              haptics.medium();
              onOpenMealModal('ai');
            }}
            className="min-h-[38px] px-3.5 rounded-full bg-[var(--text-primary)] text-[var(--bg-canvas)] text-xs font-semibold inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Mahlzeit</span>
          </motion.button>
        </div>
      </header>

      {/* Top Hero Budget Summary (Always calm & visible across all 3 separated sections) */}
      <section className="apple-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-[var(--accent-calories)]" />
              <span className="text-[13.5px] font-medium text-[var(--text-secondary)]">
                {isOver ? t.nutrition.overBudget : t.nutrition.remaining}
              </span>
            </div>
            <div className="mt-1.5 serif-metric text-[46px] sm:text-[52px] font-medium leading-none text-[var(--text-primary)]">
              <AnimatedNumber value={Math.abs(remainingKcal)} />
            </div>
            <p className="mt-2 text-[12.5px] text-[var(--text-secondary)] tabular-nums">
              {formatNumberDE(summary.totalCalories)} {t.nutrition.eaten} · Ziel{' '}
              {formatNumberDE(targets.caloriesKcal)} kcal
            </p>
          </div>

          <CircularProgressRing
            percent={progressPct}
            size={96}
            strokeWidth={8}
            color={isOver ? 'var(--accent-strain)' : 'var(--accent-calories)'}
          >
            <span className="text-[18px] font-semibold tabular-nums text-[var(--text-primary)] leading-none">
              {progressPct}%
            </span>
            <span className="text-[10px] text-[var(--text-muted)] mt-0.5">Ziel</span>
          </CircularProgressRing>
        </div>

        {/* Quiet Unboxed Formula Telemetry */}
        <div className="pt-3 border-t border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--text-secondary)] tabular-nums">
          <span>
            Basis {formatNumberDE(targets.baseNeedKcal)}
            {targets.usesWearableActiveCalories && (
              <>
                {' + '}
                <span className="text-[var(--accent-recovery)] font-medium">
                  {formatNumberDE(targets.activeBonusKcal)} Aktiv
                </span>
              </>
            )}
            {targets.goalDeltaKcal !== 0 && (
              <>
                {' '}
                {targets.goalDeltaKcal > 0 ? '+' : '−'}{' '}
                {formatNumberDE(Math.abs(targets.goalDeltaKcal))}{' '}
                {targets.goalMode === 'cut' ? 'Defizit' : 'Aufbau'}
              </>
            )}
          </span>
          <span className="text-[var(--text-muted)]">
            Wasser {formatNumberDE(waterMl)} ml
          </span>
        </div>

        {/* Smooth Animated Macro Bars */}
        <div className="grid grid-cols-3 gap-3.5 pt-0.5">
          <MacroProgress
            label={t.nutrition.protein}
            value={summary.proteinG}
            target={targets.proteinG}
            color="var(--accent-recovery)"
          />
          <MacroProgress
            label={t.nutrition.carbs}
            value={summary.carbsG}
            target={targets.carbsG}
            color="var(--accent-hrv)"
          />
          <MacroProgress
            label={t.nutrition.fat}
            value={summary.fatG}
            target={targets.fatG}
            color="var(--accent-calories)"
          />
        </div>
      </section>

      {/* Clear 3-Way Section Switcher (Butter-Smooth Shared Pill) */}
      <div
        role="tablist"
        aria-label="Ernährungsbereiche"
        className="grid grid-cols-3 gap-1 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-1"
      >
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          const active = section === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => switchSection(tab.id)}
              className={`relative min-h-[40px] rounded-[13px] flex items-center justify-center gap-1.5 text-[13px] font-medium transition-colors ${
                active
                  ? 'text-[var(--bg-canvas)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="nutritionSubTabPill"
                  transition={SNAPPY_SPRING}
                  className="absolute inset-0 rounded-[13px] bg-[var(--text-primary)]"
                />
              )}
              <Icon className="w-3.5 h-3.5 relative z-10 shrink-0" />
              <span className="relative z-10 truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Separated Section Content with Smooth Directional Spring Motion */}
      <AnimatePresence mode="wait" initial={false} custom={sectionDir}>
        {section === 'log' && (
          <motion.div
            key="log"
            initial={{ opacity: 0, x: sectionDir * 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: sectionDir * -14 }}
            transition={{ duration: 0.22, ease: APPLE_EASE }}
            className="space-y-3"
          >
            {/* Yazio-style 1-Tap Copy Yesterday Bar */}
            {yesterdayTotalCount > 0 && (
              <div className="apple-card px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                    Vortag übernehmen ({yesterdayTotalCount}{' '}
                    {yesterdayTotalCount === 1 ? 'Mahlzeit' : 'Mahlzeiten'})
                  </p>
                  <p className="text-[11.5px] text-[var(--text-muted)] tabular-nums">
                    {formatNumberDE(yesterdaySummary.totalCalories)} kcal ·{' '}
                    {yesterdaySummary.proteinG}g E
                  </p>
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={async () => {
                    haptics.success();
                    await copyMealsFromYesterday(selectedDate);
                  }}
                  className="shrink-0 min-h-[34px] rounded-full bg-[var(--bg-elevated)] border border-[var(--border-hairline)] hover:border-white/25 px-3.5 text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-[var(--accent-calories)]" />
                  <span>Gestern kopieren</span>
                </motion.button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {SLOTS.map((slot) => (
                <MealSlotCard
                  key={slot}
                  title={t.nutrition.slots[slot]}
                  emptyText={t.nutrition.nothingLogged}
                  meals={summary.byCategory[slot]}
                  yesterdaySlotCount={yesterdaySummary.byCategory[slot].length}
                  isFavorited={isMealFavorited}
                  onAdd={() => {
                    haptics.tick();
                    onOpenMealModal('ai', slot);
                  }}
                  onCopySlotFromYesterday={async () => {
                    haptics.success();
                    await copyMealsFromYesterday(selectedDate, slot);
                  }}
                  onEdit={(meal) => {
                    haptics.tick();
                    onEditMeal(meal);
                  }}
                  onToggleFavorite={async (meal) => {
                    haptics.selection();
                    await toggleFavoriteMeal(meal);
                  }}
                  onRepeat={handleRepeatMeal}
                  onDelete={handleDeleteMeal}
                />
              ))}
            </div>
          </motion.div>
        )}

        {section === 'capture' && (
          <motion.div
            key="capture"
            initial={{ opacity: 0, x: sectionDir * 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: sectionDir * -14 }}
            transition={{ duration: 0.22, ease: APPLE_EASE }}
            className="space-y-3.5"
          >
            {/* Yazio-style Favorites & Recent 1-Tap Quick-Log */}
            {(favoriteMeals.length > 0 || recentUniqueMeals.length > 0) && (
              <div className="space-y-2">
                <div className="px-1 flex items-center justify-between">
                  <p className="text-[12px] font-medium text-[var(--text-secondary)]">
                    Favoriten & Zuletzt gegessen (1-Tap)
                  </p>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {favoriteMeals.length} Favorit{favoriteMeals.length === 1 ? '' : 'en'}
                  </span>
                </div>
                <div className="apple-card divide-y divide-[var(--border-hairline)] overflow-hidden">
                  {favoriteMeals.map((fav: FavoriteMeal) => (
                    <div
                      key={fav.id}
                      className="px-4 py-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Star className="w-4 h-4 text-[var(--accent-calories)] fill-[var(--accent-calories)] shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[14px] font-medium text-[var(--text-primary)] truncate">
                            {fav.title}
                          </p>
                          <p className="text-[11.5px] text-[var(--text-secondary)] tabular-nums truncate">
                            {formatNumberDE(fav.totalCalories)} kcal · {fav.proteinG}g E ·{' '}
                            {fav.carbsG}g KH · {fav.fatG}g F
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.92 }}
                          onClick={async () => {
                            haptics.success();
                            await logFavoriteMeal(fav, selectedDate);
                          }}
                          className="min-h-[32px] px-3 rounded-full bg-[var(--text-primary)] text-[var(--bg-canvas)] text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Loggen</span>
                        </motion.button>
                        <button
                          type="button"
                          aria-label={`${fav.title} aus Favoriten entfernen`}
                          onClick={() => deleteFavoriteMeal(fav.id)}
                          className="w-8 h-8 rounded-full text-[var(--text-muted)] hover:text-[var(--accent-strain)] hover:bg-[var(--accent-strain)]/10 flex items-center justify-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {recentUniqueMeals.map((recent) => (
                    <div
                      key={`recent_${recent.id}`}
                      className="px-4 py-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-[var(--text-primary)] truncate">
                          {recent.title}
                        </p>
                        <p className="text-[11.5px] text-[var(--text-secondary)] tabular-nums truncate">
                          Zuletzt · {formatNumberDE(recent.totalCalories)} kcal · {recent.proteinG}g E
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          aria-label={`${recent.title} als Favorit merken`}
                          onClick={() => toggleFavoriteMeal(recent)}
                          className="w-8 h-8 rounded-full text-[var(--text-muted)] hover:text-[var(--accent-calories)] hover:bg-[var(--bg-well)] flex items-center justify-center"
                        >
                          <Star className="w-3.5 h-3.5" />
                        </button>
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.92 }}
                          onClick={() => handleRepeatMeal(recent)}
                          className="min-h-[32px] px-3 rounded-full bg-[var(--bg-well)] hover:bg-[var(--bg-elevated)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+</span>
                        </motion.button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Zero-Cost AI Capture Group */}
            <div className="space-y-2">
              <p className="px-1 text-[12px] font-medium text-[var(--text-secondary)]">
                0 € KI-Import (Gemini, ChatGPT, Claude)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    haptics.medium();
                    onOpenMealModal('ai');
                  }}
                  className="apple-card p-4 text-left border-[var(--accent-calories)]/30 hover:border-[var(--accent-calories)]/60 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="w-9 h-9 rounded-xl bg-[var(--accent-calories)]/15 text-[var(--accent-calories)] flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </span>
                    <span className="text-[11px] font-medium text-[var(--accent-recovery)]">
                      0 € · Lokal
                    </span>
                  </div>
                  <p className="mt-3 text-[15px] font-semibold text-[var(--text-primary)]">
                    KI-Import & Prompt
                  </p>
                  <p className="mt-0.5 text-[12px] text-[var(--text-secondary)] leading-relaxed">
                    Prompt kopieren, Foto in deiner KI-App schätzen und direkt teilen oder einfügen.
                  </p>
                </motion.button>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={handleQuickClipboardImport}
                  className="apple-card p-4 text-left hover:border-white/20 transition-colors"
                >
                  <span className="w-9 h-9 rounded-xl bg-[var(--accent-recovery)]/15 text-[var(--accent-recovery)] flex items-center justify-center">
                    <ClipboardPaste className="w-4 h-4" />
                  </span>
                  <p className="mt-3 text-[15px] font-semibold text-[var(--text-primary)]">
                    Aus Zwischenablage
                  </p>
                  <p className="mt-0.5 text-[12px] text-[var(--text-secondary)] leading-relaxed">
                    Kopierte KI-Antwort oder Link mit 1 Tipp automatisch auswerten.
                  </p>
                </motion.button>
              </div>
            </div>

            {/* Classic Free Tracking Group */}
            <div className="space-y-2">
              <p className="px-1 text-[12px] font-medium text-[var(--text-secondary)]">
                Klassisch erfassen (kostenlos & offline-fähig)
              </p>
              <div className="apple-card divide-y divide-[var(--border-hairline)] overflow-hidden">
                <CaptureRow
                  icon={Barcode}
                  title="Barcode scannen"
                  subtitle="Kamera-Scanner & EAN-Suche über Open Food Facts"
                  onClick={() => {
                    haptics.tick();
                    onOpenMealModal('scan');
                  }}
                />
                <CaptureRow
                  icon={Search}
                  title="Lebensmittel suchen"
                  subtitle="Open Food Facts & integrierte Offline-Basis"
                  onClick={() => {
                    haptics.tick();
                    onOpenMealModal('search');
                  }}
                />
                <CaptureRow
                  icon={Edit3}
                  title="Manuell eintragen"
                  subtitle="Kalorien und Makros direkt eingeben"
                  onClick={() => {
                    haptics.tick();
                    onOpenMealModal('manual');
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}

        {section === 'plan' && (
          <motion.div
            key="plan"
            initial={{ opacity: 0, x: sectionDir * 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: sectionDir * -14 }}
            transition={{ duration: 0.22, ease: APPLE_EASE }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-3.5"
          >
            {/* MacroFactor-inspired Daily Weight Quick-Log & EWMA Trend */}
            <div className="apple-card p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-[var(--accent-recovery)]/15 text-[var(--accent-recovery)] flex items-center justify-center shrink-0">
                    <Scale className="w-5 h-5" />
                  </span>
                  <div>
                    <h2 className="text-[15.5px] font-semibold text-[var(--text-primary)]">
                      Gewichtstrend (EWMA)
                    </h2>
                    <p className="text-[12px] text-[var(--text-secondary)]">
                      Glättet tägliche Wasserschwankungen
                    </p>
                  </div>
                </div>
              </div>

              {/* Daily Quick Weigh-In Row */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="0,1 kg weniger"
                  onClick={() => handleStepWeight(-0.1)}
                  className="w-10 h-10 rounded-xl bg-[var(--bg-well)] hover:bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-primary)] shrink-0"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="relative flex-1">
                  <input
                    type="number"
                    step="0.1"
                    min="30"
                    max="250"
                    aria-label="Heutiges Gewicht in kg"
                    value={weightDraft}
                    onChange={(e) => setWeightDraft(e.target.value)}
                    className="w-full min-h-[40px] rounded-xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-3 pr-9 text-center text-[15px] font-semibold tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-white/25"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)]">
                    kg
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="0,1 kg mehr"
                  onClick={() => handleStepWeight(0.1)}
                  className="w-10 h-10 rounded-xl bg-[var(--bg-well)] hover:bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-primary)] shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={handleSaveWeight}
                  className="min-h-[40px] px-3.5 rounded-xl bg-[var(--text-primary)] text-[var(--bg-canvas)] text-xs font-semibold inline-flex items-center gap-1 shrink-0"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Wiegen</span>
                </motion.button>
              </div>

              {/* Trend KPIs */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-[var(--bg-well)]/65 py-2 px-2">
                  <p className="text-[10.5px] text-[var(--text-muted)]">Waage</p>
                  <p className="text-[14px] font-semibold tabular-nums text-[var(--text-primary)] mt-0.5">
                    {weightCoach.latestRawWeightKg !== null
                      ? `${formatNumberDE(weightCoach.latestRawWeightKg, 1)} kg`
                      : `${formatNumberDE(profile.weightKg, 1)} kg`}
                  </p>
                </div>
                <div className="rounded-xl bg-[var(--bg-well)]/65 py-2 px-2">
                  <p className="text-[10.5px] text-[var(--text-muted)]">EWMA-Trend</p>
                  <p className="text-[14px] font-semibold tabular-nums text-[var(--accent-recovery)] mt-0.5">
                    {weightCoach.latestTrendWeightKg !== null
                      ? `${formatNumberDE(weightCoach.latestTrendWeightKg, 1)} kg`
                      : '—'}
                  </p>
                </div>
                <div className="rounded-xl bg-[var(--bg-well)]/65 py-2 px-2">
                  <p className="text-[10.5px] text-[var(--text-muted)]">Wochentempo</p>
                  <p className="text-[14px] font-semibold tabular-nums text-[var(--text-primary)] mt-0.5">
                    {weightCoach.weeklyTrendRateKg !== null
                      ? `${weightCoach.weeklyTrendRateKg > 0 ? '+' : ''}${formatNumberDE(weightCoach.weeklyTrendRateKg, 2)} kg`
                      : '—'}
                  </p>
                </div>
              </div>

              {/* EWMA vs Raw Scale Chart */}
              {weightChartData.length >= 2 && (
                <div className="h-[150px] w-full pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={weightChartData}
                      margin={{ top: 6, right: 6, left: -24, bottom: 0 }}
                    >
                      <CartesianGrid
                        vertical={false}
                        stroke="var(--border-hairline)"
                        strokeDasharray="3 3"
                      />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#717580', fontSize: 10 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#717580', fontSize: 10 }}
                        domain={['dataMin - 0.8', 'dataMax + 0.8']}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--bg-elevated)',
                          border: '1px solid var(--border-hairline)',
                          borderRadius: 12,
                          fontSize: 11.5,
                          color: 'var(--text-primary)',
                        }}
                        formatter={(val: unknown, name: unknown) => [
                          `${formatNumberDE(Number(val), 1)} kg`,
                          name === 'trendWeightKg' ? 'EWMA-Trend' : 'Waage',
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="trendWeightKg"
                        stroke="#5CE17C"
                        strokeWidth={2.5}
                        dot={false}
                      />
                      <Scatter dataKey="rawWeightKg" fill="#9CA3AF" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Neutral MacroFactor-style Adaptive Calorie Coach */}
            <div className="apple-card p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[15.5px] font-semibold text-[var(--text-primary)]">
                    Adaptiver Kalorien-Coach
                  </h2>
                  <p className="text-[12px] text-[var(--text-secondary)]">
                    Neutral & dynamisch · vergleicht Trendgewicht mit gegessenen kcal
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    weightCoach.hasEnoughData
                      ? 'bg-[var(--accent-recovery)]/15 text-[var(--accent-recovery)]'
                      : 'bg-[var(--bg-well)] text-[var(--text-secondary)]'
                  }`}
                >
                  {weightCoach.hasEnoughData ? 'Aktiv' : 'Lernt'}
                </span>
              </div>

              <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
                {weightCoach.summary}
              </p>

              {!weightCoach.hasEnoughData ? (
                <div className="grid grid-cols-2 gap-2 text-xs tabular-nums">
                  <div className="rounded-xl bg-[var(--bg-well)]/65 px-3 py-2.5">
                    <p className="text-[var(--text-muted)] text-[11px]">Wiege-Tage (14 T.)</p>
                    <p className="font-semibold text-[var(--text-primary)] mt-0.5">
                      {weightCoach.loggedWeightDays14d} / {weightCoach.minRequiredDays} Tage
                    </p>
                  </div>
                  <div className="rounded-xl bg-[var(--bg-well)]/65 px-3 py-2.5">
                    <p className="text-[var(--text-muted)] text-[11px]">Essenstage (14 T.)</p>
                    <p className="font-semibold text-[var(--text-primary)] mt-0.5">
                      {weightCoach.loggedMealDays14d} / {weightCoach.minRequiredDays} Tage
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs tabular-nums">
                    <div className="rounded-xl bg-[var(--bg-well)]/65 px-3 py-2.5">
                      <p className="text-[var(--text-muted)] text-[11px]">Beobachteter Verbrauch</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">
                        {weightCoach.estimatedTdeeKcal
                          ? `${formatNumberDE(weightCoach.estimatedTdeeKcal)} kcal`
                          : '—'}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[var(--bg-well)]/65 px-3 py-2.5">
                      <p className="text-[var(--text-muted)] text-[11px]">Ø Zufuhr (14 T.)</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">
                        {weightCoach.avgDailyIntakeKcal
                          ? `${formatNumberDE(weightCoach.avgDailyIntakeKcal)} kcal`
                          : '—'}
                      </p>
                    </div>
                  </div>

                  {weightCoach.suggestedAdjustmentKcal !== 0 &&
                    weightCoach.suggestedDailyTargetKcal !== null && (
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        onClick={handleApplyCoachTarget}
                        className="w-full min-h-[42px] rounded-full bg-[var(--accent-recovery)] text-[#090A0C] text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>
                          Neues Ziel übernehmen ({formatNumberDE(weightCoach.suggestedDailyTargetKcal)}{' '}
                          kcal)
                        </span>
                      </motion.button>
                    )}

                  {profile.customCalorieTarget && (
                    <button
                      type="button"
                      onClick={() => updateProfile({ customCalorieTarget: undefined })}
                      className="w-full text-[11.5px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      Zurück zur Formel-Berechnung ({formatNumberDE(targets.baseNeedKcal)} Basis)
                    </button>
                  )}
                </div>
              )}
            </div>
            {/* Dedicated Hydration Card */}
            <div className="apple-card p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-[var(--accent-hrv)]/15 text-[var(--accent-hrv)] flex items-center justify-center">
                    <Droplets className="w-5 h-5" />
                  </span>
                  <div>
                    <h2 className="text-[15.5px] font-semibold text-[var(--text-primary)]">
                      {t.nutrition.water}
                    </h2>
                    <p className="text-[12.5px] text-[var(--text-secondary)] tabular-nums">
                      {formatNumberDE(waterMl)} / {formatNumberDE(waterGoalMl)} ml ({waterPct}%)
                    </p>
                  </div>
                </div>
              </div>

              <div className="h-2 rounded-full bg-[var(--bg-well)] overflow-hidden">
                <motion.div
                  initial={false}
                  animate={{ width: `${waterPct}%` }}
                  transition={SNAPPY_SPRING}
                  className="h-full rounded-full bg-[var(--accent-hrv)]"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleWater(-250)}
                  aria-label="250 ml entfernen"
                  className="min-h-[42px] rounded-2xl bg-[var(--bg-well)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center justify-center gap-1"
                >
                  <Minus className="w-3.5 h-3.5" />
                  <span>250 ml</span>
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleWater(250)}
                  className="min-h-[42px] rounded-2xl bg-[var(--bg-well)] hover:bg-[var(--bg-elevated)] text-xs font-semibold tabular-nums text-[var(--text-primary)]"
                >
                  +250 ml
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleWater(500)}
                  className="min-h-[42px] rounded-2xl bg-[var(--accent-hrv)]/18 hover:bg-[var(--accent-hrv)]/28 text-xs font-semibold tabular-nums text-[var(--accent-hrv)]"
                >
                  +500 ml
                </motion.button>
              </div>
            </div>

            {/* Dedicated Calorie Plan Card */}
            <div className="apple-card p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[15.5px] font-semibold text-[var(--text-primary)]">
                    Dein Kalorienplan
                  </h2>
                  <p className="text-[12px] text-[var(--text-secondary)]">
                    {targets.usesWearableActiveCalories
                      ? 'Wearable-Modus: +100 % Aktivkalorien'
                      : 'Aktivitätsfaktor ohne Wearable'}
                  </p>
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    haptics.tick();
                    setPlanOpen(true);
                  }}
                  className="min-h-[36px] px-3.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5 hover:border-white/25 transition-colors"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--accent-calories)]" />
                  <span>Anpassen</span>
                </motion.button>
              </div>

              <div className="divide-y divide-[var(--border-hairline)] text-[13px] tabular-nums">
                <div className="py-2 flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">Grundumsatz (Mifflin-St Jeor)</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {formatNumberDE(targets.bmrKcal)} kcal
                  </span>
                </div>
                <div className="py-2 flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">Alltagsbedarf (Basis)</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {formatNumberDE(targets.baseNeedKcal)} kcal
                  </span>
                </div>
                {targets.usesWearableActiveCalories && (
                  <div className="py-2 flex items-center justify-between">
                    <span className="text-[var(--text-secondary)]">Aktivkalorien heute (100 %)</span>
                    <span className="font-medium text-[var(--accent-recovery)]">
                      +{formatNumberDE(targets.activeBonusKcal)} kcal
                    </span>
                  </div>
                )}
                <div className="py-2 flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">
                    Ziel ({targets.goalMode === 'cut' ? 'Abnehmen' : targets.goalMode === 'build' ? 'Aufbau' : 'Halten'})
                  </span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {targets.goalDeltaKcal > 0
                      ? `+${formatNumberDE(targets.goalDeltaKcal)}`
                      : formatNumberDE(targets.goalDeltaKcal)}{' '}
                    kcal
                  </span>
                </div>
                <div className="py-2 flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">{t.nutrition.fiber}</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {summary.fiberG} / {targets.fiberG} g
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <NutritionOnboarding
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        activeCaloriesToday={activeCaloriesToday}
      />
    </motion.div>
  );
};

const MacroProgress = memo<{
  label: string;
  value: number;
  target: number;
  color: string;
}>(({ label, value, target, color }) => {
  const pct = Math.min(100, Math.round((value / Math.max(1, target)) * 100));
  return (
    <div className="space-y-1.5 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5">
        <span className="text-[11px] text-[var(--text-secondary)] truncate">{label}</span>
        <span className="text-[12px] font-semibold tabular-nums text-[var(--text-primary)] whitespace-nowrap">
          {value}
          <span className="text-[var(--text-muted)] font-normal">/{target}g</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--bg-well)] overflow-hidden">
        <motion.div
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={SNAPPY_SPRING}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
});

const CaptureRow = memo<{
  icon: React.FC<{ className?: string }>;
  title: string;
  subtitle: string;
  onClick: () => void;
}>(({ icon: Icon, title, subtitle, onClick }) => (
  <motion.button
    type="button"
    whileTap={{ scale: 0.985 }}
    onClick={onClick}
    className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-white/[0.025] transition-colors"
  >
    <div className="flex items-center gap-3.5 min-w-0">
      <span className="w-9 h-9 rounded-xl bg-[var(--bg-well)] text-[var(--text-primary)] flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[14.5px] font-medium text-[var(--text-primary)] truncate">{title}</p>
        <p className="text-[12px] text-[var(--text-secondary)] truncate">{subtitle}</p>
      </div>
    </div>
    <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
  </motion.button>
));

const MealSlotCard = memo<{
  title: string;
  emptyText: string;
  meals: MealEntry[];
  yesterdaySlotCount: number;
  isFavorited: (meal: MealEntry) => boolean;
  onAdd: () => void;
  onCopySlotFromYesterday: () => void;
  onEdit: (meal: MealEntry) => void;
  onToggleFavorite: (meal: MealEntry) => void;
  onRepeat: (meal: MealEntry) => void;
  onDelete: (id: string) => void;
}>(
  ({
    title,
    emptyText,
    meals,
    yesterdaySlotCount,
    isFavorited,
    onAdd,
    onCopySlotFromYesterday,
    onEdit,
    onToggleFavorite,
    onRepeat,
    onDelete,
  }) => {
    const slotKcal = meals.reduce((acc, m) => acc + m.totalCalories, 0);

    return (
      <section className="apple-card overflow-hidden">
        <div className="px-4 py-3.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">{title}</h2>
            <p className="text-[12px] text-[var(--text-secondary)] tabular-nums">
              {slotKcal > 0 ? `${formatNumberDE(slotKcal)} kcal` : emptyText}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {yesterdaySlotCount > 0 && meals.length === 0 && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={onCopySlotFromYesterday}
                className="min-h-[32px] px-2.5 rounded-full bg-[var(--bg-well)] hover:bg-[var(--bg-elevated)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1 transition-colors"
              >
                <Copy className="w-3 h-3 text-[var(--accent-calories)]" />
                <span>Gestern</span>
              </motion.button>
            )}
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              aria-label={`${title} hinzufügen`}
              onClick={onAdd}
              className="w-9 h-9 rounded-full bg-[var(--bg-well)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] flex items-center justify-center transition-colors"
            >
              <Plus className="w-4 h-4" />
            </motion.button>
          </div>
        </div>

        {meals.length > 0 && (
          <div className="divide-y divide-[var(--border-hairline)] border-t border-[var(--border-hairline)]">
            {meals.map((meal) => {
              const fav = isFavorited(meal);
              return (
                <div key={meal.id} className="px-4 py-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(meal)}
                    className="flex-1 min-w-0 text-left group focus-visible:outline-none"
                  >
                    <p className="text-[14px] font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-calories)] truncate transition-colors">
                      {meal.title}
                    </p>
                    <p className="text-[11.5px] text-[var(--text-secondary)] tabular-nums truncate">
                      {meal.proteinG}g E · {meal.carbsG}g KH · {meal.fatG}g F
                    </p>
                  </button>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <span className="text-[13px] font-semibold tabular-nums text-[var(--text-primary)] mr-1">
                      {formatNumberDE(meal.totalCalories)} kcal
                    </span>
                    <button
                      type="button"
                      aria-label={fav ? `${meal.title} aus Favoriten entfernen` : `${meal.title} als Favorit speichern`}
                      onClick={() => onToggleFavorite(meal)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                        fav
                          ? 'text-[var(--accent-calories)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--accent-calories)] hover:bg-[var(--bg-well)]'
                      }`}
                    >
                      <Star className={`w-3.5 h-3.5 ${fav ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      type="button"
                      aria-label={`${meal.title} wiederholen`}
                      onClick={() => onRepeat(meal)}
                      className="w-8 h-8 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-well)] flex items-center justify-center"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`${meal.title} löschen`}
                      onClick={() => onDelete(meal.id)}
                      className="w-8 h-8 rounded-full text-[var(--text-muted)] hover:text-[var(--accent-strain)] hover:bg-[var(--accent-strain)]/10 flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  }
);
