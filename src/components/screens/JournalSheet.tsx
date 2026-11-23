import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Check } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { BottomSheet } from '../ui/BottomSheet';
import { IOSSwitch } from '../ui/LiquidPrimitives';
import { useHealthStore } from '../../store/useHealthStore';
import { HabitTagId, JournalEntry } from '../../types/health';
import { HABIT_TAG_DEFINITIONS } from '../../engine/calculations';
import { formatGermanFullDate } from '../../utils/formatters';
import { triggerHaptic } from '../../utils/haptics';

interface JournalSheetProps {
  open: boolean;
  onClose: () => void;
}

const SLEEP_CHOICES: { val: 1 | 2 | 3 | 4 | 5; label: string }[] = [
  { val: 1, label: 'Schlecht' },
  { val: 2, label: 'Unruhig' },
  { val: 3, label: 'Okay' },
  { val: 4, label: 'Gut' },
  { val: 5, label: 'Top' },
];

const ENERGY_CHOICES: { val: 1 | 2 | 3 | 4 | 5; label: string }[] = [
  { val: 1, label: 'Leer' },
  { val: 2, label: 'Müde' },
  { val: 3, label: 'Normal' },
  { val: 4, label: 'Fit' },
  { val: 5, label: 'Voll da' },
];

const LEVEL_3_SORENESS: { val: 1 | 3 | 5; label: string }[] = [
  { val: 1, label: 'Locker' },
  { val: 3, label: 'Spürbar' },
  { val: 5, label: 'Stark' },
];

const LEVEL_3_STRESS: { val: 1 | 3 | 5; label: string }[] = [
  { val: 1, label: 'Ruhig' },
  { val: 3, label: 'Mittel' },
  { val: 5, label: 'Hoch' },
];

export const JournalSheet: React.FC<JournalSheetProps> = ({ open, onClose }) => {
  const { selectedDate, journalEntries, hydrationEntries, saveJournalEntry } = useHealthStore(
    useShallow((s) => ({
      selectedDate: s.selectedDate,
      journalEntries: s.journalEntries,
      hydrationEntries: s.hydrationEntries,
      saveJournalEntry: s.saveJournalEntry,
    }))
  );
  const existing = journalEntries.find((j) => j.date === selectedDate);
  const hydrationTodayMl = hydrationEntries.find((h) => h.date === selectedDate)?.ml ?? 0;

  const [subjectiveSleepQuality, setSubjectiveSleepQuality] = useState<1 | 2 | 3 | 4 | 5>(4);
  const [energyLevel, setEnergyLevel] = useState<1 | 2 | 3 | 4 | 5>(4);
  const [illnessSymptoms, setIllnessSymptoms] = useState(false);
  const [habitTags, setHabitTags] = useState<HabitTagId[]>([]);

  // Optional details hidden behind calm Apple disclosure accordion
  const [showDetails, setShowDetails] = useState(false);
  const [muscleSoreness, setMuscleSoreness] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [stressLevel, setStressLevel] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [caffeineMg, setCaffeineMg] = useState('');
  const [alcoholDrinks, setAlcoholDrinks] = useState('0');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setShowDetails(false);
    if (existing) {
      setSubjectiveSleepQuality(existing.subjectiveSleepQuality ?? 3);
      setEnergyLevel(existing.energyLevel);
      setIllnessSymptoms(Boolean(existing.illnessSymptoms));
      const baseTags = new Set<HabitTagId>(existing.habitTags ?? []);
      if ((existing.alcoholDrinks ?? 0) > 0) baseTags.add('alcohol');
      if (hydrationTodayMl >= 2200) baseTags.add('hydrated');
      setHabitTags(Array.from(baseTags));
      setMuscleSoreness(existing.muscleSoreness);
      setStressLevel(existing.stressLevel);
      setCaffeineMg(existing.caffeineMg !== undefined ? String(existing.caffeineMg) : '');
      setAlcoholDrinks(
        existing.alcoholDrinks !== undefined ? String(existing.alcoholDrinks) : '0'
      );
      setNotes(existing.notes || '');
    } else {
      setSubjectiveSleepQuality(4);
      setEnergyLevel(4);
      setIllnessSymptoms(false);
      setHabitTags(hydrationTodayMl >= 2200 ? ['hydrated'] : []);
      setMuscleSoreness(1);
      setStressLevel(1);
      setCaffeineMg('');
      setAlcoholDrinks('0');
      setNotes('');
    }
  }, [open, selectedDate, existing, hydrationTodayMl]);

  const toggleHabitTag = (tagId: HabitTagId) => {
    triggerHaptic('selection');
    setHabitTags((prev) => {
      const exists = prev.includes(tagId);
      const next = exists ? prev.filter((t) => t !== tagId) : [...prev, tagId];
      if (tagId === 'alcohol') {
        setAlcoholDrinks((cur) => (!exists ? (Number(cur) > 0 ? cur : '1') : '0'));
      }
      return next;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const derivedFatigue = Math.max(1, Math.min(5, 6 - energyLevel)) as 1 | 2 | 3 | 4 | 5;
    const parsedAlcohol = alcoholDrinks ? Number(alcoholDrinks) : 0;
    const finalTags = new Set<HabitTagId>(habitTags);
    if (parsedAlcohol > 0) finalTags.add('alcohol');

    const entry: JournalEntry = {
      date: selectedDate,
      updatedAt: new Date().toISOString(),
      subjectiveSleepQuality,
      energyLevel,
      subjectiveFatigue: derivedFatigue,
      muscleSoreness,
      stressLevel,
      mood: energyLevel,
      hydrationLiters:
        hydrationTodayMl > 0
          ? Number((hydrationTodayMl / 1000).toFixed(2))
          : existing?.hydrationLiters,
      caffeineMg: caffeineMg ? Number(caffeineMg) : undefined,
      alcoholDrinks: parsedAlcohol,
      illnessSymptoms,
      habitTags: Array.from(finalTags),
      notes: notes.trim() || undefined,
    };
    await saveJournalEntry(entry);
    triggerHaptic('success');
    onClose();
  };

  const renderSegmentedRow = (
    title: string,
    layoutId: string,
    choices: { val: 1 | 2 | 3 | 4 | 5; label: string }[],
    current: 1 | 2 | 3 | 4 | 5,
    onChange: (n: 1 | 2 | 3 | 4 | 5) => void,
    activeBgClass: string
  ) => (
    <div className="space-y-2">
      <p className="text-[13.5px] font-semibold text-[var(--text-primary)]">{title}</p>
      <div className="grid grid-cols-5 gap-1 p-1 rounded-full bg-[var(--bg-well)]">
        {choices.map((c) => {
          const active = current === c.val;
          return (
            <motion.button
              key={c.val}
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                triggerHaptic('selection');
                onChange(c.val);
              }}
              aria-pressed={active}
              className={`relative min-h-[38px] rounded-full px-1 text-[11.5px] font-medium transition-colors ${
                active
                  ? 'text-[#090A0C] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {active && (
                <motion.span
                  layoutId={layoutId}
                  transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                  className={`absolute inset-0 rounded-full shadow-sm ${activeBgClass}`}
                />
              )}
              <span className="relative z-10">{c.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );

  // Snap 1..5 stored value cleanly to nearest 3-step button (1 / 3 / 5)
  const snapTo3 = (v: number): 1 | 3 | 5 => (v <= 2 ? 1 : v <= 3 ? 3 : 5);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Wie fühlst du dich?"
      subtitle={`${formatGermanFullDate(selectedDate)} · Fließt mit 18 % in Erholung & Schlaf ein`}
      maxWidthClass="sm:max-w-md"
    >
      <form onSubmit={handleSave} className="space-y-5">
        {renderSegmentedRow(
          'Wie hast du geschlafen?',
          'sheetSleepPill',
          SLEEP_CHOICES,
          subjectiveSleepQuality,
          setSubjectiveSleepQuality,
          'bg-[var(--accent-sleep)]'
        )}

        {renderSegmentedRow(
          'Wie viel Energie hast du heute?',
          'sheetEnergyPill',
          ENERGY_CHOICES,
          energyLevel,
          setEnergyLevel,
          'bg-[var(--accent-recovery)]'
        )}

        {/* Calm 1-row iOS Toggle for Illness / Rest Override */}
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-[var(--bg-well)]/65 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[13.5px] font-medium text-[var(--text-primary)]">
              Angeschlagen oder krank
            </p>
            <p className="text-[11.5px] text-[var(--text-muted)]">
              Setzt dein Tagesziel automatisch auf Schonung
            </p>
          </div>
          <IOSSwitch
            checked={illnessSymptoms}
            onChange={setIllnessSymptoms}
            ariaLabel="Erkältungs- oder Krankheitssymptome"
          />
        </div>

        {/* WHOOP-style 1-Tap Habit Tags for statistical next-day recovery analysis */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13.5px] font-semibold text-[var(--text-primary)]">
              Einflussfaktoren heute
            </p>
            <span className="text-[11px] text-[var(--text-muted)]">Für Erholungs-Analyse</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {HABIT_TAG_DEFINITIONS.map((tag) => {
              const active = habitTags.includes(tag.id);
              return (
                <motion.button
                  key={tag.id}
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  aria-pressed={active}
                  onClick={() => toggleHabitTag(tag.id)}
                  className={`min-h-[34px] rounded-full px-3 text-[12px] font-medium border transition-colors ${
                    active
                      ? tag.id === 'late_meal' || tag.id === 'late_caffeine' || tag.id === 'alcohol'
                        ? 'bg-[var(--accent-strain)]/18 border-[var(--accent-strain)]/45 text-[var(--accent-strain)] font-semibold'
                        : 'bg-[var(--accent-recovery)]/18 border-[var(--accent-recovery)]/45 text-[var(--accent-recovery)] font-semibold'
                      : 'bg-[var(--bg-well)]/75 border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {tag.label}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Collapsible Optional Details — Hidden by default for effortless simplicity */}
        <div className="border-t border-[var(--border-hairline)] pt-3">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('tick');
              setShowDetails((s) => !s);
            }}
            aria-expanded={showDetails}
            className="w-full flex items-center justify-between py-1.5 text-left text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <span>Weitere Details (optional)</span>
            <motion.span
              animate={{ rotate: showDetails ? 180 : 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="text-[var(--text-muted)]"
            >
              <ChevronDown className="w-4 h-4" />
            </motion.span>
          </button>

          <AnimatePresence initial={false}>
            {showDetails && (
              <motion.div
                key="optional-journal-details"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="pt-3 space-y-4">
                  {/* Streamlined 3-step Muscle Soreness */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-[var(--text-secondary)]">Muskelkater</p>
                    <div className="grid grid-cols-3 gap-1.5 p-1 rounded-full bg-[var(--bg-well)]">
                      {LEVEL_3_SORENESS.map((opt) => {
                        const active = snapTo3(muscleSoreness) === opt.val;
                        return (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => setMuscleSoreness(opt.val)}
                            className={`min-h-[34px] rounded-full text-xs font-medium transition-colors ${
                              active
                                ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)] font-semibold'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Streamlined 3-step Stress */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-[var(--text-secondary)]">Stress</p>
                    <div className="grid grid-cols-3 gap-1.5 p-1 rounded-full bg-[var(--bg-well)]">
                      {LEVEL_3_STRESS.map((opt) => {
                        const active = snapTo3(stressLevel) === opt.val;
                        return (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => setStressLevel(opt.val)}
                            className={`min-h-[34px] rounded-full text-xs font-medium transition-colors ${
                              active
                                ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)] font-semibold'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Optional Caffeine & Alcohol */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="space-y-1 text-xs text-[var(--text-secondary)]">
                      <span>Koffein (mg)</span>
                      <input
                        type="number"
                        min="0"
                        max="1000"
                        placeholder="z. B. 120"
                        value={caffeineMg}
                        onChange={(e) => setCaffeineMg(e.target.value)}
                        className="w-full min-h-[40px] rounded-xl bg-[var(--bg-well)]/75 px-3 text-sm tabular-nums text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                      />
                    </label>
                    <label className="space-y-1 text-xs text-[var(--text-secondary)]">
                      <span>Alkohol (Drinks)</span>
                      <input
                        type="number"
                        min="0"
                        max="15"
                        value={alcoholDrinks}
                        onChange={(e) => setAlcoholDrinks(e.target.value)}
                        className="w-full min-h-[40px] rounded-xl bg-[var(--bg-well)]/75 px-3 text-sm tabular-nums text-[var(--text-primary)]"
                      />
                    </label>
                  </div>

                  <label className="block space-y-1 text-xs text-[var(--text-secondary)]">
                    <span>Kurze Notiz</span>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="z. B. Spät gegessen, schwere Beine…"
                      className="w-full min-h-[40px] rounded-xl bg-[var(--bg-well)]/75 px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                    />
                  </label>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.button
          type="submit"
          whileTap={{ scale: 0.98 }}
          className="w-full min-h-[48px] rounded-full bg-[var(--text-primary)] text-[var(--bg-canvas)] font-semibold text-sm hover:opacity-92 transition-opacity inline-flex items-center justify-center gap-2"
        >
          <Check className="w-4 h-4" />
          <span>Speichern</span>
        </motion.button>
      </form>
    </BottomSheet>
  );
};
