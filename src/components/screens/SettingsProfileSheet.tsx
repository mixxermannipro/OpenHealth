import React, { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { BottomSheet } from '../ui/BottomSheet';
import { useHealthStore } from '../../store/useHealthStore';
import { DashboardFocus } from '../../types/health';
import {
  calculateAgeFromBirthDate,
  calculateWeightPlan,
  estimateMaxHrTanaka,
  getEffectiveAge,
} from '../../utils/biometrics';
import { useI18n } from '../../i18n/useI18n';
import { ONBOARDING_COPY } from '../../i18n/onboardingCopy';
import { haptics } from '../../utils/haptics';

interface SettingsProfileSheetProps {
  open: boolean;
  onClose: () => void;
}

export const SettingsProfileSheet: React.FC<SettingsProfileSheetProps> = ({ open, onClose }) => {
  const { profile, updateProfile, setDashboardFocus, redoOnboarding } = useHealthStore(
    useShallow((s) => ({
      profile: s.profile,
      updateProfile: s.updateProfile,
      setDashboardFocus: s.setDashboardFocus,
      redoOnboarding: s.redoOnboarding,
    }))
  );

  const { locale } = useI18n();
  const obCopy = ONBOARDING_COPY[locale];

  const [nameInput, setNameInput] = useState(profile.displayName);
  const [birthDateInput, setBirthDateInput] = useState(profile.birthDate ?? '1997-06-15');
  const [heightInput, setHeightInput] = useState(String(profile.heightCm));
  const [weightInput, setWeightInput] = useState(String(profile.weightKg));
  const [targetWeightInput, setTargetWeightInput] = useState(
    String(profile.targetWeightKg ?? profile.weightKg)
  );
  const [maxHrInput, setMaxHrInput] = useState(String(profile.maxHr));
  const [sleepHoursInput, setSleepHoursInput] = useState(
    String(Number((profile.sleepTargetMinutes / 60).toFixed(1)))
  );
  const [wakeTimeInput, setWakeTimeInput] = useState(profile.preferredWakeTime ?? '07:00');

  useEffect(() => {
    if (!open) return;
    setNameInput(profile.displayName);
    setBirthDateInput(profile.birthDate ?? '1997-06-15');
    setHeightInput(String(profile.heightCm));
    setWeightInput(String(profile.weightKg));
    setTargetWeightInput(String(profile.targetWeightKg ?? profile.weightKg));
    setMaxHrInput(String(profile.maxHr));
    setSleepHoursInput(String(Number((profile.sleepTargetMinutes / 60).toFixed(1))));
    setWakeTimeInput(profile.preferredWakeTime ?? '07:00');
  }, [open, profile]);

  const computedAge =
    calculateAgeFromBirthDate(birthDateInput) ?? getEffectiveAge(profile);
  const suggestedTanakaHr = estimateMaxHrTanaka(computedAge);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    haptics.success();
    const parsedHeight = Math.max(130, Math.min(225, Number(heightInput) || profile.heightCm));
    const parsedWeight = Math.max(35, Math.min(220, Number(weightInput) || profile.weightKg));
    const parsedTarget = Math.max(
      35,
      Math.min(220, Number(targetWeightInput) || parsedWeight)
    );

    const weightOrTargetChanged =
      parsedWeight !== profile.weightKg ||
      parsedTarget !== (profile.targetWeightKg ?? profile.weightKg);

    const planPatch = weightOrTargetChanged
      ? (() => {
          const inferredGoal =
            parsedTarget < parsedWeight - 0.4
              ? 'cut'
              : parsedTarget > parsedWeight + 0.4
                ? 'build'
                : 'maintain';
          const pace =
            Math.abs(profile.weeklyWeightChangeKg ?? 0) > 0
              ? Math.abs(profile.weeklyWeightChangeKg ?? 0.5)
              : inferredGoal === 'cut'
                ? 0.5
                : 0.25;
          const recalculated = calculateWeightPlan({
            currentWeightKg: parsedWeight,
            targetWeightKg: parsedTarget,
            goalMode: inferredGoal,
            weeklyRateKg: pace,
          });
          return {
            nutritionGoalMode: inferredGoal as 'cut' | 'maintain' | 'build',
            weeklyWeightChangeKg: recalculated.weeklyWeightChangeKg,
            nutritionGoalDeltaKcal: recalculated.dailyKcalDelta,
          };
        })()
      : {};

    await updateProfile({
      displayName: nameInput.trim() || profile.displayName,
      birthDate: birthDateInput || profile.birthDate,
      age: computedAge,
      heightCm: parsedHeight,
      weightKg: parsedWeight,
      targetWeightKg: parsedTarget,
      ...planPatch,
      maxHr: Math.max(140, Math.min(220, Number(maxHrInput) || suggestedTanakaHr)),
      sleepTargetMinutes: Math.round((Number(sleepHoursInput) || 8) * 60),
      preferredWakeTime: wakeTimeInput || '07:00',
    });
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Mein Profil"
      subtitle="Wird lokal gespeichert und für alle Formeln genutzt"
      maxWidthClass="sm:max-w-lg"
    >
      <form onSubmit={handleSave} className="space-y-5">
        {/* Group 1: Über dich */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-[var(--text-secondary)]">Über dich</h3>
            <span className="text-[11.5px] text-[var(--accent-recovery)] tabular-nums">
              {computedAge} {obCopy.ageYearsSuffix}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <label className="space-y-1 text-xs text-[var(--text-secondary)]">
              <span>Vorname</span>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full min-h-[42px] rounded-xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-white/25"
              />
            </label>
            <label className="space-y-1 text-xs text-[var(--text-secondary)]">
              <span>{obCopy.birthDateLabel}</span>
              <input
                type="date"
                value={birthDateInput}
                min="1930-01-01"
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => {
                  const val = e.target.value;
                  setBirthDateInput(val);
                  const nextAge = calculateAgeFromBirthDate(val);
                  if (nextAge !== null) {
                    setMaxHrInput(String(estimateMaxHrTanaka(nextAge)));
                  }
                }}
                className="w-full min-h-[42px] rounded-xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-3 text-sm tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-white/25"
              />
            </label>
          </div>
        </section>

        {/* Group 2: Körper & Gewichtsziel */}
        <section className="space-y-2.5 pt-3 border-t border-[var(--border-hairline)]">
          <h3 className="text-xs font-medium text-[var(--text-secondary)]">Körper & Ziel</h3>
          <div className="grid grid-cols-3 gap-2.5">
            <label className="space-y-1 text-xs text-[var(--text-secondary)]">
              <span>Größe (cm)</span>
              <input
                type="number"
                value={heightInput}
                onChange={(e) => setHeightInput(e.target.value)}
                className="w-full min-h-[42px] rounded-xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-3 text-sm tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-white/25"
              />
            </label>
            <label className="space-y-1 text-xs text-[var(--text-secondary)]">
              <span>Gewicht (kg)</span>
              <input
                type="number"
                step="0.5"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="w-full min-h-[42px] rounded-xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-3 text-sm tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-white/25"
              />
            </label>
            <label className="space-y-1 text-xs text-[var(--text-secondary)]">
              <span>Ziel (kg)</span>
              <input
                type="number"
                step="0.5"
                value={targetWeightInput}
                onChange={(e) => setTargetWeightInput(e.target.value)}
                className="w-full min-h-[42px] rounded-xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-3 text-sm tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-white/25"
              />
            </label>
          </div>
        </section>

        {/* Group 3: Schlaf & Herz */}
        <section className="space-y-2.5 pt-3 border-t border-[var(--border-hairline)]">
          <h3 className="text-xs font-medium text-[var(--text-secondary)]">Schlaf & Puls</h3>
          <div className="grid grid-cols-3 gap-2.5">
            <label className="space-y-1 text-xs text-[var(--text-secondary)]">
              <span>Schlafziel (Std.)</span>
              <input
                type="number"
                step="0.5"
                min="4"
                max="12"
                value={sleepHoursInput}
                onChange={(e) => setSleepHoursInput(e.target.value)}
                className="w-full min-h-[42px] rounded-xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-3 text-sm tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-white/25"
              />
            </label>
            <label className="space-y-1 text-xs text-[var(--text-secondary)]">
              <span>Aufstehzeit</span>
              <input
                type="time"
                value={wakeTimeInput}
                onChange={(e) => setWakeTimeInput(e.target.value)}
                className="w-full min-h-[42px] rounded-xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-2.5 text-sm tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-white/25"
              />
            </label>
            <label className="space-y-1 text-xs text-[var(--text-secondary)]">
              <span>Max-Puls ({suggestedTanakaHr})</span>
              <input
                type="number"
                min="140"
                max="220"
                value={maxHrInput}
                onChange={(e) => setMaxHrInput(e.target.value)}
                className="w-full min-h-[42px] rounded-xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-3 text-sm tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-white/25"
              />
            </label>
          </div>
        </section>

        {/* Group 4: Schwerpunkt */}
        <section className="space-y-2.5 pt-3 border-t border-[var(--border-hairline)]">
          <h3 className="text-xs font-medium text-[var(--text-secondary)]">
            Schwerpunkt auf „Heute“
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {(
              [
                ['general', 'Gesundheit'],
                ['recovery', 'Erholung'],
                ['endurance', 'Ausdauer'],
                ['sleep', 'Schlaf'],
              ] as [DashboardFocus, string][]
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  haptics.tick();
                  setDashboardFocus(val);
                }}
                aria-pressed={profile.dashboardFocus === val}
                className={`min-h-[36px] rounded-xl text-xs font-medium transition-colors ${
                  profile.dashboardFocus === val
                    ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)]'
                    : 'bg-[var(--bg-well)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Actions */}
        <div className="space-y-2.5 pt-2">
          <button
            type="submit"
            className="w-full min-h-[46px] rounded-full bg-[var(--text-primary)] text-[var(--bg-canvas)] text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Profil speichern
          </button>

          <button
            type="button"
            onClick={async () => {
              haptics.tick();
              onClose();
              await redoOnboarding();
            }}
            className="w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Ersteinrichtung erneut durchlaufen</span>
          </button>
        </div>
      </form>
    </BottomSheet>
  );
};
