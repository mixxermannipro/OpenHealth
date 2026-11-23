import React, { useEffect, useMemo, useState } from 'react';
import { TrendingDown, Scale, TrendingUp, Watch, Activity } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import {
  DailyLifestyleNeat,
  ManualActivityPal,
  NutritionGoalMode,
} from '../../types/health';
import { useHealthStore } from '../../store/useHealthStore';
import { calculateNutritionTargets } from '../../engine/nutrition';
import { calculateWeightPlan } from '../../utils/biometrics';
import { BottomSheet } from '../ui/BottomSheet';
import { LiquidSlider } from '../ui/LiquidSlider';
import { useI18n } from '../../i18n/useI18n';
import { haptics } from '../../utils/haptics';
import { formatNumberDE } from '../../utils/formatters';

interface NutritionOnboardingProps {
  open: boolean;
  onClose: () => void;
  activeCaloriesToday?: number;
}

export const NutritionOnboarding: React.FC<NutritionOnboardingProps> = ({
  open,
  onClose,
  activeCaloriesToday = 0,
}) => {
  const { profile, updateProfile } = useHealthStore(
    useShallow((s) => ({
      profile: s.profile,
      updateProfile: s.updateProfile,
    }))
  );
  const { t } = useI18n();
  const no = t.nutritionOnboarding;

  const [goalMode, setGoalMode] = useState<NutritionGoalMode>(
    profile.nutritionGoalMode ?? 'maintain'
  );
  const [targetWeightKg, setTargetWeightKg] = useState<number>(
    profile.targetWeightKg ?? profile.weightKg
  );
  const [weeklyPaceKg, setWeeklyPaceKg] = useState<number>(
    Math.abs(profile.weeklyWeightChangeKg ?? (goalMode === 'cut' ? 0.5 : 0.25))
  );
  const [usesWearable, setUsesWearable] = useState<boolean>(
    profile.usesWearableActiveCalories !== false
  );
  const [neat, setNeat] = useState<DailyLifestyleNeat>(
    profile.dailyLifestyleNeat ?? 'sedentary'
  );
  const [pal, setPal] = useState<ManualActivityPal>(
    profile.manualActivityPal ?? 'moderate'
  );

  // Re-sync local state whenever the sheet opens or the user profile updates
  useEffect(() => {
    if (!open) return;
    const nextGoal = profile.nutritionGoalMode ?? 'maintain';
    setGoalMode(nextGoal);
    setTargetWeightKg(profile.targetWeightKg ?? profile.weightKg);
    setWeeklyPaceKg(
      Math.abs(profile.weeklyWeightChangeKg ?? (nextGoal === 'cut' ? 0.5 : 0.25))
    );
    setUsesWearable(profile.usesWearableActiveCalories !== false);
    setNeat(profile.dailyLifestyleNeat ?? 'sedentary');
    setPal(profile.manualActivityPal ?? 'moderate');
  }, [open, profile]);

  const plan = useMemo(
    () =>
      calculateWeightPlan({
        currentWeightKg: profile.weightKg,
        targetWeightKg,
        goalMode,
        weeklyRateKg: weeklyPaceKg,
      }),
    [profile.weightKg, targetWeightKg, goalMode, weeklyPaceKg]
  );

  const previewTargets = useMemo(
    () =>
      calculateNutritionTargets(
        {
          ...profile,
          nutritionGoalMode: goalMode,
          targetWeightKg,
          weeklyWeightChangeKg: plan.weeklyWeightChangeKg,
          nutritionGoalDeltaKcal: plan.dailyKcalDelta,
          usesWearableActiveCalories: usesWearable,
          dailyLifestyleNeat: neat,
          manualActivityPal: pal,
        },
        activeCaloriesToday
      ),
    [profile, goalMode, targetWeightKg, plan, usesWearable, neat, pal, activeCaloriesToday]
  );

  const handleSave = async () => {
    haptics.success();
    await updateProfile({
      nutritionGoalMode: goalMode,
      targetWeightKg,
      weeklyWeightChangeKg: plan.weeklyWeightChangeKg,
      nutritionGoalDeltaKcal: plan.dailyKcalDelta,
      customCalorieTarget: undefined,
      usesWearableActiveCalories: usesWearable,
      dailyLifestyleNeat: neat,
      manualActivityPal: pal,
      nutritionOnboardingCompleted: true,
    });
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t.nutrition.adjustPlan}
      subtitle="Mifflin-St Jeor + 100 % Aktivkalorien-Regel"
    >
      <div className="space-y-5">
        {/* Goal Mode */}
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: 'cut', label: no.goalCut, icon: TrendingDown },
              { id: 'maintain', label: no.goalMaintain, icon: Scale },
              { id: 'build', label: no.goalBuild, icon: TrendingUp },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = goalMode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  haptics.selection();
                  setGoalMode(item.id);
                  if (item.id === 'cut' && targetWeightKg >= profile.weightKg) {
                    setTargetWeightKg(Math.max(45, profile.weightKg - 4));
                  } else if (item.id === 'build' && targetWeightKg <= profile.weightKg) {
                    setTargetWeightKg(Math.min(180, profile.weightKg + 4));
                  }
                }}
                className={`p-3 rounded-2xl border text-left transition-colors ${
                  active
                    ? 'bg-[var(--bg-elevated)] border-white/25 text-[var(--text-primary)]'
                    : 'bg-[var(--bg-well)]/60 border-[var(--border-hairline)] text-[var(--text-secondary)]'
                }`}
              >
                <Icon className="w-4 h-4 mb-1.5 text-[var(--accent-calories)]" />
                <p className="text-[13px] font-semibold leading-tight">{item.label}</p>
              </button>
            );
          })}
        </div>

        {/* Target weight & weekly pace when cut or build */}
        {goalMode !== 'maintain' && (
          <div className="space-y-3">
            <LiquidSlider
              label="Zielgewicht"
              unit="kg"
              decimals={1}
              min={40}
              max={160}
              step={0.5}
              value={targetWeightKg}
              onChange={setTargetWeightKg}
            />
            <LiquidSlider
              label="Tempo pro Woche"
              unit="kg / Woche"
              decimals={2}
              valuePrefix={goalMode === 'cut' ? '−' : '+'}
              subtitle={`${plan.dailyKcalDelta >= 0 ? `+${plan.dailyKcalDelta}` : plan.dailyKcalDelta} kcal/Tag`}
              min={goalMode === 'cut' ? 0.2 : 0.1}
              max={goalMode === 'cut' ? 1.0 : 0.5}
              step={0.05}
              value={weeklyPaceKg}
              onChange={setWeeklyPaceKg}
            />
          </div>
        )}

        {/* Wearable Active Calories Toggle */}
        <div className="space-y-2.5">
          <p className="text-[12.5px] font-medium text-[var(--text-secondary)]">
            Wie sollen Aktivkalorien berechnet werden?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                haptics.selection();
                setUsesWearable(true);
              }}
              className={`p-3 rounded-2xl border text-left transition-colors ${
                usesWearable
                  ? 'bg-[var(--bg-elevated)] border-[var(--accent-recovery)]/40 text-[var(--text-primary)]'
                  : 'bg-[var(--bg-well)]/60 border-[var(--border-hairline)] text-[var(--text-secondary)]'
              }`}
            >
              <Watch className="w-4 h-4 text-[var(--accent-recovery)] mb-1" />
              <p className="text-[13px] font-semibold">Mit Wearable</p>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                +100 % Aktivkalorien von Uhr/Health
              </p>
            </button>
            <button
              type="button"
              onClick={() => {
                haptics.selection();
                setUsesWearable(false);
              }}
              className={`p-3 rounded-2xl border text-left transition-colors ${
                !usesWearable
                  ? 'bg-[var(--bg-elevated)] border-white/25 text-[var(--text-primary)]'
                  : 'bg-[var(--bg-well)]/60 border-[var(--border-hairline)] text-[var(--text-secondary)]'
              }`}
            >
              <Activity className="w-4 h-4 text-[var(--accent-calories)] mb-1" />
              <p className="text-[13px] font-semibold">Ohne Wearable</p>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                Fester Aktivitätsfaktor (PAL)
              </p>
            </button>
          </div>
        </div>

        {/* NEAT or Manual PAL */}
        {usesWearable ? (
          <div className="space-y-2">
            <p className="text-[12px] text-[var(--text-secondary)]">{no.neatQuestion}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'sedentary', label: no.neatSedentary },
                  { id: 'mixed', label: no.neatMixed },
                  { id: 'active_job', label: no.neatActive },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    haptics.tick();
                    setNeat(opt.id);
                  }}
                  className={`min-h-[38px] px-2 rounded-xl border text-[12px] font-medium transition-colors ${
                    neat === opt.id
                      ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)] border-transparent'
                      : 'bg-[var(--bg-well)] border-[var(--border-hairline)] text-[var(--text-secondary)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[12px] text-[var(--text-secondary)]">{no.palQuestion}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'sedentary', label: no.palSedentary },
                  { id: 'light', label: no.palLight },
                  { id: 'moderate', label: no.palModerate },
                  { id: 'very_active', label: no.palVeryActive },
                  { id: 'athlete', label: no.palAthlete },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    haptics.tick();
                    setPal(opt.id);
                  }}
                  className={`min-h-[38px] px-2.5 rounded-xl border text-[12px] font-medium transition-colors ${
                    pal === opt.id
                      ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)] border-transparent'
                      : 'bg-[var(--bg-well)] border-[var(--border-hairline)] text-[var(--text-secondary)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Live Calculation Summary */}
        <div className="rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-hairline)] p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11.5px] text-[var(--text-secondary)]">Heutiges Tagesziel</p>
            <p className="text-[11.5px] text-[var(--text-muted)] tabular-nums mt-0.5">
              Basis {previewTargets.baseNeedKcal}
              {usesWearable ? ` + Aktiv ${previewTargets.activeBonusKcal}` : ''}
              {previewTargets.goalDeltaKcal !== 0
                ? ` ${previewTargets.goalDeltaKcal > 0 ? '+' : '−'} ${Math.abs(previewTargets.goalDeltaKcal)}`
                : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="serif-metric text-[32px] leading-none text-[var(--text-primary)]">
              {formatNumberDE(previewTargets.caloriesKcal)}
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">kcal / Tag</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="w-full min-h-[48px] rounded-full bg-[var(--text-primary)] text-[var(--bg-canvas)] text-[14.5px] font-semibold hover:opacity-90 transition-opacity"
        >
          Kalorienplan speichern
        </button>
      </div>
    </BottomSheet>
  );
};
