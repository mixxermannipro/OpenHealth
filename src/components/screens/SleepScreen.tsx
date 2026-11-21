import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  ChevronDown,
  BedDouble,
  Sunrise,
  BarChart2,
  Moon,
  ChevronRight,
  Coffee,
  Wind,
  Heart,
} from 'lucide-react';
import { DailyDerivedSnapshot } from '../../types/health';
import { useHealthStore } from '../../store/useHealthStore';
import { SUBJECTIVE_SLEEP_LABELS } from '../../engine/calculations';
import { ExplanationTopic } from '../../i18n/de';
import { InfoButton } from '../ui/InfoButton';
import { StepHypnogram } from '../ui/LiquidPrimitives';
import {
  SNAPPY_SPRING,
  staggerCardVariants,
  staggerParentVariants,
} from '../ui/MotionPrimitives';
import {
  addDaysToKey,
  formatClockFromIso,
  formatGermanShortDate,
} from '../../utils/formatters';
import { haptics } from '../../utils/haptics';

interface SleepScreenProps {
  snapshot: DailyDerivedSnapshot;
  onExplain: (topic: ExplanationTopic) => void;
  onOpenBreathwork: () => void;
  onOpenJournal: () => void;
}

export const SleepScreen: React.FC<SleepScreenProps> = ({
  snapshot,
  onExplain,
  onOpenBreathwork,
  onOpenJournal,
}) => {
  const { todayKey, selectedDate, setSelectedDate } = useHealthStore();
  const [pickerOpen, setPickerOpen] = useState(false);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const recentDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const dk = addDaysToKey(todayKey, -i);
      const label =
        i === 0 ? 'Heute' : i === 1 ? 'Gestern' : formatGermanShortDate(dk);
      return { dk, label };
    });
  }, [todayKey]);

  const activeDateLabel =
    selectedDate === todayKey
      ? 'Heute'
      : selectedDate === addDaysToKey(todayKey, -1)
        ? 'Gestern'
        : formatGermanShortDate(selectedDate);

  const isToday = selectedDate === todayKey;

  const totalMin = snapshot.sleep.durationMinutes ?? 462;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  const sleepPerf = snapshot.sleep.sleepPerformancePercent ?? snapshot.sleep.score ?? 92;

  const bedtimeStr = snapshot.sleepSession
    ? formatClockFromIso(snapshot.sleepSession.bedtimeIso)
    : '23:12';
  const wakeStr = snapshot.sleepSession
    ? formatClockFromIso(snapshot.sleepSession.wakeTimeIso)
    : '06:54';
  const efficiencyStr =
    snapshot.sleep.efficiencyPercent !== null ? `${snapshot.sleep.efficiencyPercent}%` : '—';

  const recBedtime = snapshot.sleep.recommendedBedtime ?? '22:45';
  const caffeineCutoff = snapshot.sleep.caffeineCutoffTime ?? '13:45';

  const handleCardTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    swipeStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleCardTouchEnd = (e: React.TouchEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 52 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    if (dx > 0) {
      haptics.selection();
      setSelectedDate(addDaysToKey(selectedDate, -1));
    } else if (!isToday) {
      haptics.selection();
      setSelectedDate(addDaysToKey(selectedDate, 1));
    }
  };

  return (
    <motion.div
      variants={staggerParentVariants}
      initial="hidden"
      animate="show"
      className="space-y-4"
    >
      {/* Header matching IMG-20261121-WA0014 */}
      <motion.header
        variants={staggerCardVariants}
        className="flex items-start justify-between gap-3 pt-1"
      >
        <div>
          <h1 className="text-[30px] font-bold tracking-tight text-[var(--text-primary)] leading-tight">
            Schlaf
          </h1>
          <p className="mt-0.5 text-[14.5px] text-[var(--text-secondary)]">
            Besser schlafen. Ein gesünderes Ich.
          </p>
        </div>

        <div className="relative">
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              haptics.tick();
              setPickerOpen((o) => !o);
            }}
            className="min-h-[40px] inline-flex items-center gap-2 rounded-full bg-[var(--bg-surface)] border border-[var(--border-hairline)] px-3.5 text-[13.5px] font-medium text-[var(--text-primary)] hover:border-white/20 transition-colors"
          >
            <Calendar className="w-4 h-4 text-[var(--text-secondary)]" />
            <span>{activeDateLabel}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-200 ${
                pickerOpen ? 'rotate-180' : ''
              }`}
            />
          </motion.button>

          <AnimatePresence>
            {pickerOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: -6 }}
                transition={SNAPPY_SPRING}
                className="absolute right-0 mt-2 w-40 z-30 origin-top-right liquid-glass rounded-2xl p-1.5 space-y-0.5"
              >
                {recentDates.map((d) => (
                  <button
                    key={d.dk}
                    type="button"
                    onClick={() => {
                      haptics.selection();
                      setSelectedDate(d.dk);
                      setPickerOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                      selectedDate === d.dk
                        ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-well)]'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Main Hypnogram Card matching IMG-20261121-WA0014 (supports horizontal night-swipe) */}
        <motion.div
          variants={staggerCardVariants}
          data-no-tab-swipe="true"
          onTouchStart={handleCardTouchStart}
          onTouchEnd={handleCardTouchEnd}
          className="lg:col-span-7 apple-card p-5 space-y-5"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[13.5px] font-medium text-[var(--text-secondary)]">Schlafdauer</p>
              <div className="mt-1 serif-metric text-[54px] sm:text-[60px] font-medium leading-none text-[var(--text-primary)]">
                {hours} <span className="text-[40px] sm:text-[44px]">h</span>{' '}
                {String(mins).padStart(2, '0')}
              </div>
              <p className="mt-2 text-[14.5px] text-[var(--text-secondary)]">
                Schlafleistung{' '}
                <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                  {sleepPerf}%
                </span>
              </p>
            </div>
            <InfoButton label="Schlafleistung & Phasen" onClick={() => onExplain('sleep')} />
          </div>

          {snapshot.sleepSession ? (
            <StepHypnogram session={snapshot.sleepSession} />
          ) : (
            <div className="rounded-2xl bg-[var(--bg-well)] p-4 text-xs text-[var(--text-secondary)]">
              Für dieses Datum liegt keine Schlafaufzeichnung vor.
            </div>
          )}
        </motion.div>

        {/* Right/Bottom Grouped Times & Recommended Bedtime + Caffeine Coach */}
        <div className="lg:col-span-5 space-y-4">
          {/* Grouped Times Card matching IMG-20261121-WA0014 */}
          <motion.div
            variants={staggerCardVariants}
            className="apple-card divide-y divide-[var(--border-hairline)] overflow-hidden"
          >
            <div className="px-4 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <BedDouble className="w-5 h-5 text-[var(--text-secondary)]" />
                <span className="text-[15px] text-[var(--text-primary)]">Einschlafzeit</span>
              </div>
              <span className="text-[17px] font-semibold tabular-nums text-[var(--text-primary)]">
                {bedtimeStr}
              </span>
            </div>

            <div className="px-4 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <Sunrise className="w-5 h-5 text-[var(--text-secondary)]" />
                <span className="text-[15px] text-[var(--text-primary)]">Aufwachzeit</span>
              </div>
              <span className="text-[17px] font-semibold tabular-nums text-[var(--text-primary)]">
                {wakeStr}
              </span>
            </div>

            <div className="px-4 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <BarChart2 className="w-5 h-5 text-[var(--text-secondary)]" />
                <span className="text-[15px] text-[var(--text-primary)]">Schlafeffizienz</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[17px] font-semibold tabular-nums text-[var(--text-primary)]">
                  {efficiencyStr}
                </span>
                <InfoButton
                  label="Schlafeffizienz"
                  onClick={() => onExplain('sleepStages')}
                  className="!min-h-[28px] !min-w-[28px]"
                />
              </div>
            </div>

            <motion.button
              type="button"
              whileTap={{ scale: 0.985 }}
              onClick={() => {
                haptics.tick();
                onOpenJournal();
              }}
              className="w-full px-4 py-4 flex items-center justify-between gap-3 text-left hover:bg-[var(--bg-well)]/40 transition-colors"
            >
              <div className="flex items-center gap-3.5">
                <Heart className="w-5 h-5 text-[var(--accent-sleep)]" />
                <span className="text-[15px] text-[var(--text-primary)]">Gefühlter Schlaf</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[14.5px] font-semibold text-[var(--accent-sleep)]">
                  {snapshot.sleep.subjectiveSleepQuality !== undefined
                    ? SUBJECTIVE_SLEEP_LABELS[snapshot.sleep.subjectiveSleepQuality]
                    : 'Jetzt bewerten'}
                </span>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
              </div>
            </motion.button>
          </motion.div>

          {snapshot.sleep.subjectiveAlignmentNote && (
            <motion.div variants={staggerCardVariants} className="apple-card p-4 space-y-1">
              <p className="text-xs font-semibold text-[var(--accent-sleep)]">
                Uhr vs. Dein Schlafgefühl
              </p>
              <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                {snapshot.sleep.subjectiveAlignmentNote}
              </p>
            </motion.div>
          )}

          {/* Recommended Bedtime Card matching IMG-20261121-WA0014 */}
          <motion.button
            variants={staggerCardVariants}
            whileTap={{ scale: 0.985 }}
            type="button"
            onClick={() => {
              haptics.tick();
              onExplain('sleep');
            }}
            className="w-full apple-card p-4 flex items-center justify-between gap-3 text-left hover:border-white/[0.14] transition-colors"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <span className="w-11 h-11 rounded-full bg-[var(--accent-sleep)]/18 flex items-center justify-center shrink-0">
                <Moon className="w-5 h-5 text-[var(--accent-sleep)] fill-[var(--accent-sleep)]/40" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] text-[var(--text-secondary)]">
                  Empfohlene Schlafenszeit heute:
                </p>
                <p className="text-[24px] font-bold tabular-nums text-[var(--text-primary)] leading-tight">
                  {recBedtime}
                </p>
                <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary)] leading-snug">
                  Ein erholsamer Schlaf hilft dir, konzentrierter und ausgeglichener zu sein.
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
          </motion.button>

          {/* Science-backed Caffeine Cutoff & 4-7-8 Sleep Breathwork */}
          <motion.div
            variants={staggerCardVariants}
            className="apple-card p-4 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-9 h-9 rounded-full bg-[var(--accent-calories)]/15 text-[var(--accent-calories)] flex items-center justify-center shrink-0">
                <Coffee className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                  Koffein-Stopp ab {caffeineCutoff} Uhr
                </p>
                <p className="text-[11.5px] text-[var(--text-muted)]">
                  9 Std. vor Schlafenszeit für maximalen Tiefschlaf
                </p>
              </div>
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                haptics.light();
                onOpenBreathwork();
              }}
              className="shrink-0 min-h-[34px] inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-well)] px-3 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            >
              <Wind className="w-3.5 h-3.5 text-[var(--accent-sleep)]" />
              4-7-8
            </motion.button>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

