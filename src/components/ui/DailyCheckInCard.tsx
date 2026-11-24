import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, ChevronRight } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { DailyDerivedSnapshot, JournalEntry } from '../../types/health';
import { useHealthStore } from '../../store/useHealthStore';
import { ExplanationTopic } from '../../i18n/de';
import { useI18n } from '../../i18n/useI18n';
import { InfoButton } from './InfoButton';
import { triggerHaptic } from '../../utils/haptics';

interface DailyCheckInCardProps {
  snapshot: DailyDerivedSnapshot;
  onExplain: (topic: ExplanationTopic) => void;
  onOpenJournal: () => void;
}

export const DailyCheckInCard: React.FC<DailyCheckInCardProps> = ({
  snapshot,
  onExplain,
  onOpenJournal,
}) => {
  const { selectedDate, saveJournalEntry } = useHealthStore(
    useShallow((s) => ({
      selectedDate: s.selectedDate,
      saveJournalEntry: s.saveJournalEntry,
    }))
  );
  const { t } = useI18n();
  const existing = snapshot.journal;

  const sleepOptions: { value: 1 | 2 | 3 | 4 | 5; short: string }[] = [1, 2, 3, 4, 5].map((v) => ({
    value: v as 1 | 2 | 3 | 4 | 5,
    short: t.checkin.sleepOptions[v - 1],
  }));

  const energyOptions: { value: 1 | 2 | 3 | 4 | 5; short: string }[] = [1, 2, 3, 4, 5].map((v) => ({
    value: v as 1 | 2 | 3 | 4 | 5,
    short: t.checkin.energyOptions[v - 1],
  }));

  const [sleepFeel, setSleepFeel] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [energyFeel, setEnergyFeel] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [saving, setSaving] = useState(false);

  const handleQuickSave = async () => {
    if (sleepFeel === null && energyFeel === null) return;
    setSaving(true);
    const chosenEnergy = (energyFeel ?? 3) as 1 | 2 | 3 | 4 | 5;
    const chosenSleep = (sleepFeel ?? 3) as 1 | 2 | 3 | 4 | 5;
    const derivedFatigue = Math.max(1, Math.min(5, 6 - chosenEnergy)) as 1 | 2 | 3 | 4 | 5;

    const entry: JournalEntry = {
      date: selectedDate,
      updatedAt: new Date().toISOString(),
      subjectiveSleepQuality: chosenSleep,
      energyLevel: chosenEnergy,
      subjectiveFatigue: existing?.subjectiveFatigue ?? derivedFatigue,
      muscleSoreness: existing?.muscleSoreness ?? 2,
      stressLevel: existing?.stressLevel ?? 2,
      mood: existing?.mood ?? chosenEnergy,
      hydrationLiters: existing?.hydrationLiters,
      caffeineMg: existing?.caffeineMg,
      alcoholDrinks: existing?.alcoholDrinks ?? 0,
      illnessSymptoms: existing?.illnessSymptoms ?? false,
      habitTags: existing?.habitTags,
      notes: existing?.notes,
    };

    await saveJournalEntry(entry);
    triggerHaptic('success');
    setSleepFeel(null);
    setEnergyFeel(null);
    setSaving(false);
  };

  const canSave = sleepFeel !== null || energyFeel !== null;

  return (
    <AnimatePresence mode="wait" initial={false}>
      {existing ? (
        <motion.div
          key="checkin-summary"
          initial={{ opacity: 0, y: 6, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.99 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="apple-card px-4 py-3 space-y-2"
        >
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onOpenJournal}
              className="flex-1 flex items-center gap-2.5 text-left min-w-0 focus-visible:outline-none"
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  existing.illnessSymptoms || existing.energyLevel <= 2
                    ? 'bg-[var(--accent-strain)]'
                    : existing.energyLevel === 3
                      ? 'bg-[var(--accent-calories)]'
                      : 'bg-[var(--accent-recovery)]'
                }`}
              />
              <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                {t.checkin.feelingToday}{' '}
                <span className="text-[var(--text-secondary)] font-normal">
                  {t.checkin.sleepWord}{' '}
                  {existing.subjectiveSleepQuality !== undefined
                    ? t.checkin.sleepOptions[existing.subjectiveSleepQuality - 1]
                    : '—'}{' '}
                  · {t.checkin.energyOptions[existing.energyLevel - 1]}
                </span>
              </p>
            </button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={onOpenJournal}
              className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[var(--bg-well)] hover:bg-[var(--bg-elevated)] px-3 py-1.5 text-[11.5px] font-medium text-[var(--text-primary)] transition-colors"
            >
              <span>{t.common.edit}</span>
              <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
            </motion.button>
          </div>

          {snapshot.recovery.subjectiveAlignmentNote && (
            <p className="text-[12px] leading-relaxed text-[var(--text-secondary)] border-t border-[var(--border-hairline)] pt-2">
              {snapshot.recovery.subjectiveAlignmentNote}
            </p>
          )}
        </motion.div>
      ) : (
        <motion.section
          key="checkin-form"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6, scale: 0.985 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          aria-label={t.checkin.title}
          className="apple-card p-4 sm:p-5 space-y-3.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-[var(--text-primary)] leading-tight">
                {t.checkin.title}
              </h2>
              <p className="mt-0.5 text-[11.5px] text-[var(--text-muted)]">
                {t.checkin.subtitle}
              </p>
            </div>
            <InfoButton label={t.checkin.title} onClick={() => onExplain('recovery')} />
          </div>

          {/* Question 1: Sleep Feeling */}
          <div className="space-y-1.5">
            <p className="text-[12px] font-medium text-[var(--text-secondary)]">
              {t.checkin.sleepFeel}
            </p>
            <div className="grid grid-cols-5 gap-1 p-1 rounded-full bg-[var(--bg-well)]">
              {sleepOptions.map((opt) => {
                const active = sleepFeel === opt.value;
                return (
                  <motion.button
                    key={opt.value}
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    aria-pressed={active}
                    onClick={() => {
                      triggerHaptic('selection');
                      setSleepFeel(opt.value);
                    }}
                    className={`relative min-h-[34px] rounded-full px-1 text-[11.5px] font-medium transition-colors ${
                      active
                        ? 'text-[#090A0C] font-semibold'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="quickSleepPill"
                        transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                        className="absolute inset-0 rounded-full bg-[var(--accent-sleep)] shadow-sm"
                      />
                    )}
                    <span className="relative z-10">{opt.short}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Question 2: Energy Feeling */}
          <div className="space-y-1.5">
            <p className="text-[12px] font-medium text-[var(--text-secondary)]">
              {t.checkin.energy}
            </p>
            <div className="grid grid-cols-5 gap-1 p-1 rounded-full bg-[var(--bg-well)]">
              {energyOptions.map((opt) => {
                const active = energyFeel === opt.value;
                return (
                  <motion.button
                    key={opt.value}
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    aria-pressed={active}
                    onClick={() => {
                      triggerHaptic('selection');
                      setEnergyFeel(opt.value);
                    }}
                    className={`relative min-h-[34px] rounded-full px-1 text-[11.5px] font-medium transition-colors ${
                      active
                        ? 'text-[#090A0C] font-semibold'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="quickEnergyPill"
                        transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                        className="absolute inset-0 rounded-full bg-[var(--accent-recovery)] shadow-sm"
                      />
                    )}
                    <span className="relative z-10">{opt.short}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Ultra-minimal footer */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <button
              type="button"
              onClick={onOpenJournal}
              className="text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] whitespace-nowrap transition-colors"
            >
              {t.checkin.moreOptions}
            </button>

            <motion.button
              type="button"
              whileTap={canSave ? { scale: 0.96 } : undefined}
              disabled={!canSave || saving}
              onClick={handleQuickSave}
              className="min-h-[36px] shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 rounded-full bg-[var(--text-primary)] text-[var(--bg-canvas)] px-4 text-xs font-semibold disabled:opacity-35 hover:opacity-92 transition-opacity"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{t.common.save}</span>
            </motion.button>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
};
