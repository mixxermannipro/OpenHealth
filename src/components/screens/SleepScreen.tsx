import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Plus,
  Check,
  Clock,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { DailyDerivedSnapshot, SleepSession } from '../../types/health';
import { useHealthStore } from '../../store/useHealthStore';
import { ExplanationTopic } from '../../i18n/de';
import { useI18n } from '../../i18n/useI18n';
import { InfoButton } from '../ui/InfoButton';
import { BottomSheet } from '../ui/BottomSheet';
import { StepHypnogram } from '../ui/LiquidPrimitives';
import {
  SNAPPY_SPRING,
  staggerCardVariants,
  staggerParentVariants,
} from '../ui/MotionPrimitives';
import {
  addDaysToKey,
  formatClockFromIso,
  formatDurationMinutes,
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
  const {
    profile,
    todayKey,
    selectedDate,
    setSelectedDate,
    addManualSleepSession,
    updateProfile,
  } = useHealthStore(
    useShallow((s) => ({
      profile: s.profile,
      todayKey: s.todayKey,
      selectedDate: s.selectedDate,
      setSelectedDate: s.setSelectedDate,
      addManualSleepSession: s.addManualSleepSession,
      updateProfile: s.updateProfile,
    }))
  );
  const { t, locale } = useI18n();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [manualSleepOpen, setManualSleepOpen] = useState(false);
  const [manualBedtime, setManualBedtime] = useState(profile.preferredBedtime || '23:00');
  const [manualWakeTime, setManualWakeTime] = useState(profile.preferredWakeTime || '07:00');
  const [manualEfficiency, setManualEfficiency] = useState(92);
  const [editingWakeTarget, setEditingWakeTarget] = useState(false);
  const [wakeTargetDraft, setWakeTargetDraft] = useState(profile.preferredWakeTime || '07:00');
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setWakeTargetDraft(profile.preferredWakeTime || '07:00');
  }, [profile.preferredWakeTime]);

  useEffect(() => {
    if (!pickerOpen) return;
    const handlePointerOutside = (e: MouseEvent | TouchEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false);
    };
    document.addEventListener('mousedown', handlePointerOutside);
    document.addEventListener('touchstart', handlePointerOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerOutside);
      document.removeEventListener('touchstart', handlePointerOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [pickerOpen]);

  const recentDates = useMemo(() => {
    void locale;
    return Array.from({ length: 7 }, (_, i) => {
      const dk = addDaysToKey(todayKey, -i);
      const label =
        i === 0 ? t.common.today : i === 1 ? t.common.yesterday : formatGermanShortDate(dk);
      return { dk, label };
    });
  }, [todayKey, t.common.today, t.common.yesterday, locale]);

  const activeDateLabel =
    selectedDate === todayKey
      ? t.common.today
      : selectedDate === addDaysToKey(todayKey, -1)
        ? t.common.yesterday
        : formatGermanShortDate(selectedDate);

  const isToday = selectedDate === todayKey;

  const hasSleepData = snapshot.sleep.durationMinutes !== null;
  const totalMin = snapshot.sleep.durationMinutes ?? 0;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  const sleepPerf = snapshot.sleep.sleepPerformancePercent ?? snapshot.sleep.score;

  const bedtimeStr = snapshot.sleepSession
    ? formatClockFromIso(snapshot.sleepSession.bedtimeIso)
    : '—';
  const wakeStr = snapshot.sleepSession
    ? formatClockFromIso(snapshot.sleepSession.wakeTimeIso)
    : '—';
  const efficiencyStr =
    snapshot.sleep.efficiencyPercent !== null ? `${snapshot.sleep.efficiencyPercent}%` : '—';

  const recBedtime = snapshot.sleep.recommendedBedtime ?? profile.preferredBedtime ?? '23:00';
  const caffeineCutoff = snapshot.sleep.caffeineCutoffTime ?? '14:00';

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

  const sleepDebtMin = snapshot.sleep.sleepDebtMinutes;
  const sleepNeedMin = snapshot.sleep.sleepNeedMinutes;

  const handleSaveManualSleep = async (e: React.FormEvent) => {
    e.preventDefault();
    const [bH, bM] = manualBedtime.split(':').map(Number);
    const [wH, wM] = manualWakeTime.split(':').map(Number);
    if (Number.isNaN(bH) || Number.isNaN(wH)) return;

    const bedMins = bH * 60 + (bM || 0);
    const wakeMins = wH * 60 + (wM || 0);
    const timeInBedMinutes = Math.max(
      60,
      Math.min(16 * 60, wakeMins > bedMins ? wakeMins - bedMins : 1440 - bedMins + wakeMins)
    );
    const totalSleepMinutes = Math.round((timeInBedMinutes * manualEfficiency) / 100);
    const awakeMinutes = Math.max(0, timeInBedMinutes - totalSleepMinutes);

    const bedDateKey = wakeMins <= bedMins ? addDaysToKey(selectedDate, -1) : selectedDate;
    const bedtimeIso = `${bedDateKey}T${manualBedtime}:00`;
    const wakeTimeIso = `${selectedDate}T${manualWakeTime}:00`;

    const session: SleepSession = {
      id: `sleep_manual_${selectedDate}`,
      date: selectedDate,
      timestamp: wakeTimeIso,
      sourceProvider: 'other',
      sourceRecordId: `manual_sleep_${selectedDate}`,
      dataQuality: 'moderate',
      provenance: 'measured',
      metricType: 'sleep_session',
      bedtimeIso,
      wakeTimeIso,
      timeInBedMinutes,
      totalSleepMinutes,
      efficiencyPercent: manualEfficiency,
      deepMinutes: null,
      remMinutes: null,
      lightMinutes: null,
      awakeMinutes,
      hasStageData: false,
      awakeningsCount: awakeMinutes >= 25 ? 2 : awakeMinutes >= 10 ? 1 : 0,
      stages: [],
    };

    await addManualSleepSession(session);
    haptics.success();
    setManualSleepOpen(false);
  };

  const handleSaveWakeTarget = async () => {
    if (!wakeTargetDraft) return;
    await updateProfile({ preferredWakeTime: wakeTargetDraft });
    setEditingWakeTarget(false);
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
            {t.sleep.title}
          </h1>
          <p className="mt-0.5 text-[14.5px] text-[var(--text-secondary)]">
            {t.sleep.subtitle}
          </p>
        </div>

        <div ref={pickerRef} className="relative">
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
              <p className="text-[13.5px] font-medium text-[var(--text-secondary)]">
                {t.sleep.duration}
              </p>
              <div className="mt-1 serif-metric text-[54px] sm:text-[60px] font-medium leading-none text-[var(--text-primary)]">
                {hasSleepData ? (
                  <>
                    {hours} <span className="text-[40px] sm:text-[44px]">h</span>{' '}
                    {String(mins).padStart(2, '0')}
                  </>
                ) : (
                  '—'
                )}
              </div>
              <p className="mt-2 text-[14.5px] text-[var(--text-secondary)]">
                {t.sleep.performance}{' '}
                <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                  {sleepPerf !== null ? `${sleepPerf}%` : '—'}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  haptics.tick();
                  setManualSleepOpen(true);
                }}
                className="min-h-[32px] inline-flex items-center gap-1 rounded-full bg-[var(--bg-well)] hover:bg-[var(--bg-elevated)] px-3 text-[11.5px] font-medium text-[var(--text-primary)] transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-[var(--accent-sleep)]" />
                <span>{hasSleepData ? 'Bearbeiten' : 'Eintragen'}</span>
              </button>
              <InfoButton label={t.sleep.performance} onClick={() => onExplain('sleep')} />
            </div>
          </div>

          {snapshot.sleepSession ? (
            <StepHypnogram session={snapshot.sleepSession} />
          ) : (
            <div className="rounded-2xl bg-[var(--bg-well)]/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {t.sleep.noData}
              </p>
              <button
                type="button"
                onClick={() => {
                  haptics.tick();
                  setManualSleepOpen(true);
                }}
                className="shrink-0 min-h-[36px] inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--accent-sleep)] text-[#090A0C] px-3.5 text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Schlaf manuell eintragen</span>
              </button>
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
                <span className="text-[15px] text-[var(--text-primary)]">{t.sleep.bedtime}</span>
              </div>
              <span className="text-[17px] font-semibold tabular-nums text-[var(--text-primary)]">
                {bedtimeStr}
              </span>
            </div>

            <div className="px-4 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <Sunrise className="w-5 h-5 text-[var(--text-secondary)]" />
                <span className="text-[15px] text-[var(--text-primary)]">{t.sleep.wakeTime}</span>
              </div>
              <span className="text-[17px] font-semibold tabular-nums text-[var(--text-primary)]">
                {wakeStr}
              </span>
            </div>

            <div className="px-4 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <BarChart2 className="w-5 h-5 text-[var(--text-secondary)]" />
                <span className="text-[15px] text-[var(--text-primary)]">
                  {t.sleep.efficiency}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[17px] font-semibold tabular-nums text-[var(--text-primary)]">
                  {efficiencyStr}
                </span>
                <InfoButton
                  label={t.sleep.efficiency}
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
                <span className="text-[15px] text-[var(--text-primary)]">{t.sleep.feltSleep}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[14.5px] font-semibold text-[var(--accent-sleep)]">
                  {snapshot.sleep.subjectiveSleepQuality !== undefined
                    ? t.checkin.sleepOptions[snapshot.sleep.subjectiveSleepQuality - 1]
                    : t.sleep.rateNow}
                </span>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
              </div>
            </motion.button>
          </motion.div>

          {snapshot.sleep.subjectiveAlignmentNote && (
            <motion.div variants={staggerCardVariants} className="apple-card p-4 space-y-1">
              <p className="text-xs font-semibold text-[var(--accent-sleep)]">
                {t.sleep.watchVsFeeling}
              </p>
              <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                {snapshot.sleep.subjectiveAlignmentNote}
              </p>
            </motion.div>
          )}

          {/* WHOOP/Oura Bedtime & Sleep Debt Coach */}
          <motion.div
            variants={staggerCardVariants}
            className="apple-card p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <span className="w-11 h-11 rounded-full bg-[var(--accent-sleep)]/18 flex items-center justify-center shrink-0">
                  <Moon className="w-5 h-5 text-[var(--accent-sleep)] fill-[var(--accent-sleep)]/40" />
                </span>
                <div className="min-w-0">
                  <p className="text-[12.5px] text-[var(--text-secondary)]">
                    {t.sleep.recommendedBedtime}
                  </p>
                  <p className="text-[24px] font-bold tabular-nums text-[var(--text-primary)] leading-tight">
                    {recBedtime}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  haptics.tick();
                  setEditingWakeTarget((v) => !v);
                }}
                className="shrink-0 min-h-[30px] inline-flex items-center gap-1 rounded-full bg-[var(--bg-well)] hover:bg-[var(--bg-elevated)] px-2.5 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Clock className="w-3 h-3" />
                <span className="tabular-nums">Wecker {profile.preferredWakeTime || '07:00'}</span>
              </button>
            </div>

            {editingWakeTarget && (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-[var(--bg-well)]/75 p-2.5">
                <label className="text-xs text-[var(--text-secondary)] flex items-center gap-2">
                  <span>Aufstehzeit:</span>
                  <input
                    type="time"
                    value={wakeTargetDraft}
                    onChange={(e) => setWakeTargetDraft(e.target.value)}
                    className="rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] px-2 py-1 text-xs tabular-nums text-[var(--text-primary)]"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleSaveWakeTarget}
                  className="min-h-[30px] rounded-full bg-[var(--accent-sleep)] text-[#090A0C] px-3 text-xs font-semibold inline-flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  <span>Speichern</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <div className="rounded-xl bg-[var(--bg-well)]/65 px-3 py-2">
                <p className="text-[11px] text-[var(--text-muted)]">Schlafbedarf heute</p>
                <p className="text-sm font-semibold tabular-nums text-[var(--text-primary)] mt-0.5">
                  {formatDurationMinutes(sleepNeedMin)}
                </p>
              </div>
              <div className="rounded-xl bg-[var(--bg-well)]/65 px-3 py-2">
                <p className="text-[11px] text-[var(--text-muted)]">7-Tage-Schlafschuld</p>
                <p
                  className={`text-sm font-semibold tabular-nums mt-0.5 ${
                    sleepDebtMin > 90
                      ? 'text-[var(--accent-strain)]'
                      : sleepDebtMin > 30
                        ? 'text-[var(--accent-calories)]'
                        : 'text-[var(--accent-recovery)]'
                  }`}
                >
                  {sleepDebtMin > 0 ? `+${formatDurationMinutes(sleepDebtMin)}` : '0 Min. (Im Plan)'}
                </p>
              </div>
            </div>
          </motion.div>

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
                  {t.sleep.caffeineCutoffPrefix} {caffeineCutoff}
                  {t.sleep.caffeineCutoffSuffix ? ` ${t.sleep.caffeineCutoffSuffix}` : ''}
                </p>
                <p className="text-[11.5px] text-[var(--text-muted)]">{t.sleep.caffeineHint}</p>
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

      {/* Manual Sleep Entry Sheet (Wearable-Free Support) */}
      <BottomSheet
        open={manualSleepOpen}
        onClose={() => setManualSleepOpen(false)}
        title="Schlaf manuell eintragen"
        subtitle="Funktioniert auch ohne Smartwatch · Aktualisiert Schlafschuld & Bettzeit-Coach"
        maxWidthClass="sm:max-w-md"
      >
        <form onSubmit={handleSaveManualSleep} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1.5 text-xs text-[var(--text-secondary)]">
              <span>Eingeschlafen</span>
              <input
                type="time"
                required
                value={manualBedtime}
                onChange={(e) => setManualBedtime(e.target.value)}
                className="w-full min-h-[44px] rounded-xl bg-[var(--bg-well)] px-3 text-base font-semibold tabular-nums text-[var(--text-primary)]"
              />
            </label>
            <label className="space-y-1.5 text-xs text-[var(--text-secondary)]">
              <span>Aufgewacht</span>
              <input
                type="time"
                required
                value={manualWakeTime}
                onChange={(e) => setManualWakeTime(e.target.value)}
                className="w-full min-h-[44px] rounded-xl bg-[var(--bg-well)] px-3 text-base font-semibold tabular-nums text-[var(--text-primary)]"
              />
            </label>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-secondary)]">Schlafeffizienz (ruhig vs. wach)</span>
              <span className="font-semibold tabular-nums text-[var(--accent-sleep)]">
                {manualEfficiency} %
              </span>
            </div>
            <input
              type="range"
              min={70}
              max={98}
              step={1}
              value={manualEfficiency}
              onChange={(e) => setManualEfficiency(Number(e.target.value))}
              className="w-full accent-[var(--accent-sleep)]"
            />
          </div>

          <motion.button
            type="submit"
            whileTap={{ scale: 0.98 }}
            className="w-full min-h-[48px] rounded-full bg-[var(--accent-sleep)] text-[#090A0C] font-semibold text-sm inline-flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Schlaf speichern</span>
          </motion.button>
        </form>
      </BottomSheet>
    </motion.div>
  );
};

