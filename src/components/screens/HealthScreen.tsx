import React, { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  DailyDerivedSnapshot,
  MeasurementProvenance,
  TimeRange,
} from '../../types/health';
import { useHealthStore } from '../../store/useHealthStore';
import {
  assessRecovery,
  assessSleep,
  assessTrainingLoad,
  computePersonalBaseline,
  estimateFitnessAge,
  getRangeDays,
} from '../../engine/calculations';
import { addDaysToKey, formatGermanShortDate, formatNumberDE } from '../../utils/formatters';
import { de } from '../../i18n/de';
import { RangeSelector } from '../ui/RangeSelector';
import { BottomSheet } from '../ui/BottomSheet';
import { ExplanationTopic } from '../ui/ExplanationSheet';
import { InfoButton } from '../ui/InfoButton';
import { TrendChart } from '../charts/TrendChart';
import { CorrelationChart } from '../charts/CorrelationChart';

interface HealthScreenProps {
  snapshot: DailyDerivedSnapshot;
  onExplain: (topic: ExplanationTopic) => void;
}

interface BiometricRow {
  id: string;
  category: 'Herz & Kreislauf' | 'Bewegung' | 'Schlaf' | 'Körper & Atmung';
  title: string;
  valueText: string;
  baselineText: string;
  provenance: MeasurementProvenance;
  sourceLabel: string;
  explanation: string;
  seriesKey: 'hrv' | 'rhr' | 'hr_daily' | 'vo2' | 'steps' | 'sleep' | 'weight' | 'resp' | 'spo2';
  infoTopic: ExplanationTopic;
  unit: string;
  color: string;
}

export const HealthScreen: React.FC<HealthScreenProps> = ({ snapshot, onExplain }) => {
  const {
    profile,
    selectedDate,
    hrvObservations,
    rhrObservations,
    sleepSessions,
    workouts,
    dailyActivities,
    bodyMeasurements,
    journalEntries,
  } = useHealthStore(
    useShallow((s) => ({
      profile: s.profile,
      selectedDate: s.selectedDate,
      hrvObservations: s.hrvObservations,
      rhrObservations: s.rhrObservations,
      sleepSessions: s.sleepSessions,
      workouts: s.workouts,
      dailyActivities: s.dailyActivities,
      bodyMeasurements: s.bodyMeasurements,
      journalEntries: s.journalEntries,
    }))
  );

  const [healthSubTab, setHealthSubTab] = useState<'monitor' | 'healthspan' | 'trends'>('monitor');
  const [trendRange, setTrendRange] = useState<TimeRange>('30d');
  const [selectedTrendMetric, setSelectedTrendMetric] = useState<
    'recovery' | 'hrv' | 'rhr' | 'sleep' | 'load' | 'steps' | 'vo2'
  >('hrv');
  const [correlationPair, setCorrelationPair] = useState<
    'sleep_recovery' | 'hrv_load' | 'rhr_load'
  >('sleep_recovery');
  const [activeBiometric, setActiveBiometric] = useState<BiometricRow | null>(null);

  const fitnessAge = useMemo(
    () =>
      estimateFitnessAge(
        selectedDate,
        profile,
        rhrObservations,
        workouts,
        dailyActivities,
        hrvObservations,
        sleepSessions,
        false
      ),
    [selectedDate, profile, rhrObservations, workouts, dailyActivities, hrvObservations, sleepSessions]
  );

  const biometricRows: BiometricRow[] = useMemo(() => {
    const { hrv, rhr, activity, sleep, body, baseline } = snapshot;
    return [
      {
        id: 'bio_hr_daily',
        category: 'Herz & Kreislauf',
        title: 'Herzfrequenz (Tag)',
        valueText:
          activity?.latestHrBpm !== undefined || activity?.avgHrBpm !== undefined
            ? `${activity.latestHrBpm ?? activity.avgHrBpm} /min`
            : 'Nicht gemessen',
        baselineText:
          activity?.avgHrBpm !== undefined && activity?.minHrBpm !== undefined && activity?.maxHrBpm !== undefined
            ? `Ø ${activity.avgHrBpm} · ${activity.minHrBpm}–${activity.maxHrBpm} /min`
            : 'Ganztägige Messwerte',
        provenance:
          activity?.avgHrBpm !== undefined || activity?.latestHrBpm !== undefined
            ? 'measured'
            : 'missing',
        sourceLabel:
          activity && (activity.avgHrBpm !== undefined || activity.latestHrBpm !== undefined)
            ? de.providers[activity.sourceProvider]
            : '—',
        explanation:
          'Aktuellste sowie tägliche Durchschnitts-, Minimal- und Maximal-Herzfrequenz aus deinen Health-Connect-Messpunkten.',
        seriesKey: 'hr_daily',
        infoTopic: 'biometrics',
        unit: '/min',
        color: 'var(--accent-strain)',
      },
      {
        id: 'bio_rhr',
        category: 'Herz & Kreislauf',
        title: 'Morgenpuls in Ruhe',
        valueText: rhr ? `${rhr.value} /min` : 'Nicht gemessen',
        baselineText: baseline.rhrMean28d ? `Schnitt ${baseline.rhrMean28d} /min` : 'Kein Schnitt',
        provenance: rhr ? rhr.provenance : 'missing',
        sourceLabel: rhr ? de.providers[rhr.sourceProvider] : '—',
        explanation:
          'Dein ruhiger Puls in der Nacht oder direkt am Morgen. Steigt er plötzlich, braucht dein Körper oft etwas Ruhe.',
        seriesKey: 'rhr',
        infoTopic: 'rhr',
        unit: '/min',
        color: 'var(--accent-strain)',
      },
      {
        id: 'bio_hrv',
        category: 'Herz & Kreislauf',
        title: 'Nerven-Erholung',
        valueText: hrv ? `${hrv.value} ms` : 'Nicht gemessen',
        baselineText: baseline.hrvMean28d ? `Schnitt ${baseline.hrvMean28d} ms` : 'Kein Schnitt',
        provenance: hrv ? hrv.provenance : 'missing',
        sourceLabel: hrv ? de.providers[hrv.sourceProvider] : '—',
        explanation:
          'Zeigt, wie entspannt dein Nervensystem nachts war. Wichtig ist immer der Vergleich zu deinem eigenen Schnitt.',
        seriesKey: 'hrv',
        infoTopic: 'hrv',
        unit: 'ms',
        color: 'var(--accent-recovery)',
      },
      {
        id: 'bio_vo2',
        category: 'Herz & Kreislauf',
        title: 'Ausdauer-Fitness',
        valueText:
          activity?.vo2MaxEstimate !== undefined
            ? `${formatNumberDE(activity.vo2MaxEstimate, 1)} Pkt.`
            : 'Nicht verfügbar',
        baselineText: baseline.vo2MaxLatest ? `Aktuell ${formatNumberDE(baseline.vo2MaxLatest, 1)}` : '—',
        provenance: activity?.vo2MaxEstimate !== undefined ? 'wearable_estimate' : 'missing',
        sourceLabel: activity ? de.providers[activity.sourceProvider] : '—',
        explanation:
          'Schätzung deiner Sportuhr, wie gut dein Körper beim Laufen Sauerstoff verwertet.',
        seriesKey: 'vo2',
        infoTopic: 'cardioFitness',
        unit: 'Pkt.',
        color: 'var(--accent-sleep)',
      },
      {
        id: 'bio_steps',
        category: 'Bewegung',
        title: 'Schritte & aktive Zeit',
        valueText: activity ? `${formatNumberDE(activity.steps)} Schritte` : 'Keine Daten',
        baselineText: activity ? `${activity.activeMinutes} aktive Min.` : '—',
        provenance: activity ? activity.provenance : 'missing',
        sourceLabel: activity ? de.providers[activity.sourceProvider] : '—',
        explanation: 'Deine gesamte Alltagsbewegung und aktive Minuten über den Tag verteilt.',
        seriesKey: 'steps',
        infoTopic: 'steps',
        unit: 'Schritte',
        color: 'var(--accent-sleep)',
      },
      {
        id: 'bio_sleep',
        category: 'Schlaf',
        title: 'Schlafwert',
        valueText: sleep.score !== null ? `${sleep.score} / 100` : 'Nicht erfasst',
        baselineText: `Ziel ${Math.round(sleep.targetMinutes / 60)} Std.`,
        provenance: sleep.score !== null ? 'app_estimate' : 'missing',
        sourceLabel: snapshot.sleepSession ? de.providers[snapshot.sleepSession.sourceProvider] : '—',
        explanation: 'Fasst zusammen, ob dein Schlaf lang genug, ruhig und regelmäßig war.',
        seriesKey: 'sleep',
        infoTopic: 'sleep',
        unit: 'Pkt.',
        color: 'var(--accent-sleep)',
      },
      {
        id: 'bio_resp',
        category: 'Körper & Atmung',
        title: 'Atemzüge pro Minute',
        valueText:
          activity?.respiratoryRateBpm !== undefined
            ? `${formatNumberDE(activity.respiratoryRateBpm, 1)} /min`
            : 'Nicht gemessen',
        baselineText: 'Normal ca. 12–18 /min',
        provenance: activity?.respiratoryRateBpm !== undefined ? 'wearable_estimate' : 'missing',
        sourceLabel: activity ? de.providers[activity.sourceProvider] : '—',
        explanation: 'Wie oft du nachts pro Minute ruhig ein- und ausgeatmet hast.',
        seriesKey: 'resp',
        infoTopic: 'biometrics',
        unit: '/min',
        color: 'var(--accent-recovery)',
      },
      {
        id: 'bio_spo2',
        category: 'Körper & Atmung',
        title: 'Sauerstoff im Blut',
        valueText:
          activity?.spo2Percent !== undefined ? `${activity.spo2Percent} %` : 'Nicht gemessen',
        baselineText: 'Freiwilliger Nachtwert',
        provenance: activity?.spo2Percent !== undefined ? 'wearable_estimate' : 'missing',
        sourceLabel: activity && activity.spo2Percent !== undefined ? de.providers[activity.sourceProvider] : '—',
        explanation:
          'Wenn für einen Tag kein Wert vorliegt, bleibt das Feld ehrlich leer — fehlende Messwerte werden nicht erfunden.',
        seriesKey: 'spo2',
        infoTopic: 'biometrics',
        unit: '%',
        color: 'var(--accent-sleep)',
      },
      {
        id: 'bio_weight',
        category: 'Körper & Atmung',
        title: 'Gewicht & Fettanteil',
        valueText: body ? `${formatNumberDE(body.weightKg, 1)} kg` : 'Nicht erfasst',
        baselineText:
          body?.bodyFatPercent !== undefined
            ? `Fettanteil ca. ${formatNumberDE(body.bodyFatPercent, 1)} %`
            : 'Keine weiteren Daten',
        provenance: body ? body.provenance : 'missing',
        sourceLabel: body ? de.providers[body.sourceProvider] : '—',
        explanation: 'Letzte eingetragene Messung von Gewicht und Körperwerten.',
        seriesKey: 'weight',
        infoTopic: 'biometrics',
        unit: 'kg',
        color: 'var(--accent-load)',
      },
    ];
  }, [snapshot]);

  const biometricModalSeries = useMemo(() => {
    if (!activeBiometric) return [];
    const pts = [];
    for (let i = 29; i >= 0; i--) {
      const dk = addDaysToKey(selectedDate, -i);
      let val: number | null = null;
      if (activeBiometric.seriesKey === 'hrv') {
        val = hrvObservations.find((h) => h.date === dk)?.value ?? null;
      } else if (activeBiometric.seriesKey === 'rhr') {
        val = rhrObservations.find((r) => r.date === dk)?.value ?? null;
      } else if (activeBiometric.seriesKey === 'hr_daily') {
        val = dailyActivities.find((a) => a.date === dk)?.avgHrBpm ?? null;
      } else if (activeBiometric.seriesKey === 'vo2') {
        val = dailyActivities.find((a) => a.date === dk)?.vo2MaxEstimate ?? null;
      } else if (activeBiometric.seriesKey === 'steps') {
        val = dailyActivities.find((a) => a.date === dk)?.steps ?? null;
      } else if (activeBiometric.seriesKey === 'sleep') {
        val = assessSleep(dk, profile, sleepSessions, journalEntries).score;
      } else if (activeBiometric.seriesKey === 'weight') {
        val = bodyMeasurements.find((b) => b.date === dk)?.weightKg ?? null;
      } else if (activeBiometric.seriesKey === 'resp') {
        val = dailyActivities.find((a) => a.date === dk)?.respiratoryRateBpm ?? null;
      } else if (activeBiometric.seriesKey === 'spo2') {
        val = dailyActivities.find((a) => a.date === dk)?.spo2Percent ?? null;
      }
      pts.push({ date: dk, label: formatGermanShortDate(dk), value: val });
    }
    return pts;
  }, [
    activeBiometric,
    selectedDate,
    hrvObservations,
    rhrObservations,
    dailyActivities,
    profile,
    sleepSessions,
    journalEntries,
    bodyMeasurements,
  ]);

  const trendsData = useMemo(() => {
    const days = getRangeDays(trendRange);
    const step = days >= 180 ? 3 : days >= 90 ? 2 : 1;
    const rows = [];
    for (let i = days - 1; i >= 0; i -= step) {
      const dk = addDaysToKey(selectedDate, -i);
      const base = computePersonalBaseline(
        dk,
        hrvObservations,
        rhrObservations,
        sleepSessions,
        workouts,
        dailyActivities
      );
      const slp = assessSleep(dk, profile, sleepSessions, journalEntries);
      const ld = assessTrainingLoad(dk, profile, workouts, base);
      const rec = assessRecovery(
        dk,
        profile,
        hrvObservations,
        rhrObservations,
        sleepSessions,
        workouts,
        journalEntries,
        base,
        slp,
        ld,
        true
      );
      const act = dailyActivities.find((a) => a.date === dk);
      const hrv = hrvObservations.find((h) => h.date === dk);
      const rhr = rhrObservations.find((r) => r.date === dk);

      rows.push({
        date: dk,
        label: formatGermanShortDate(dk),
        recovery: rec.score,
        hrv: hrv?.value ?? null,
        rhr: rhr?.value ?? null,
        sleepHours: slp.durationMinutes !== null ? Number((slp.durationMinutes / 60).toFixed(2)) : null,
        load: ld.dailyLoadScore,
        steps: act?.steps ?? null,
        vo2: act?.vo2MaxEstimate ?? null,
      });
    }
    return rows;
  }, [
    trendRange,
    selectedDate,
    profile,
    hrvObservations,
    rhrObservations,
    sleepSessions,
    workouts,
    dailyActivities,
    journalEntries,
  ]);

  const trendInsightText = useMemo(() => {
    const recentRhr = rhrObservations
      .filter((r) => r.date > addDaysToKey(selectedDate, -7) && r.date <= selectedDate)
      .map((r) => r.value);
    const oldRhr = rhrObservations
      .filter((r) => r.date >= addDaysToKey(selectedDate, -35) && r.date <= addDaysToKey(selectedDate, -25))
      .map((r) => r.value);
    if (recentRhr.length >= 4 && oldRhr.length >= 4) {
      const avgNow = recentRhr.reduce((a, b) => a + b, 0) / recentRhr.length;
      const avgOld = oldRhr.reduce((a, b) => a + b, 0) / oldRhr.length;
      const diff = Number((avgNow - avgOld).toFixed(1));
      if (Math.abs(diff) >= 1.0) {
        return `Dein durchschnittlicher Morgenpuls ist in den letzten 30 Tagen um ${formatNumberDE(
          Math.abs(diff),
          1
        )} Schläge/min ${diff < 0 ? 'gesunken' : 'gestiegen'}.`;
      }
    }
    return 'Alle langfristigen Körperwerte bewegen sich aktuell in einem stabilen Bereich.';
  }, [rhrObservations, selectedDate]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-editorial text-[26px] sm:text-[32px] font-medium tracking-tight">
            Körper &amp; Entwicklung
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-[var(--text-secondary)]">
            Alle Körperwerte, dein geschätztes Fitness-Alter und langfristige Trends
          </p>
        </div>
        <InfoButton label="Körperwerte" onClick={() => onExplain('biometrics')} />
      </div>

      {/* Apple Segmented Sub-tabs */}
      <div
        className="grid grid-cols-3 sm:inline-grid sm:grid-cols-3 gap-1 p-1 rounded-2xl bg-[var(--bg-well)]"
        role="tablist"
        aria-label="Körperbereiche"
      >
        {(
          [
            { id: 'monitor', label: 'Körperwerte' },
            { id: 'healthspan', label: 'Fitness-Alter' },
            { id: 'trends', label: 'Trends & Vergleiche' },
          ] as const
        ).map((tab) => {
          const active = healthSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setHealthSubTab(tab.id)}
              className={`min-h-[36px] px-2.5 sm:px-4 py-1.5 rounded-xl text-[11.5px] sm:text-xs font-medium whitespace-nowrap truncate transition-all ${
                active
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* SUBTAB 1: BIOMETRIC MONITOR */}
      {healthSubTab === 'monitor' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3 px-0.5 text-xs text-[var(--text-secondary)]">
            <span>
              Jede Kachel zeigt ehrlich, ob ein Wert direkt gemessen, geschätzt oder berechnet wurde — fehlende Werte bleiben leer.
            </span>
            <InfoButton label="Herkunft der Werte" onClick={() => onExplain('biometrics')} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {biometricRows.map((row) => (
              <div key={row.id} className="relative min-h-[140px]">
                <button
                  type="button"
                  onClick={() => setActiveBiometric(row)}
                  className="w-full h-full apple-card p-5 text-left hover:opacity-95 active:scale-[0.985] transition-transform flex flex-col justify-between min-h-[140px]"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)] pr-8">
                    <span className="truncate">{row.category}</span>
                    <span className="truncate">{de.provenance[row.provenance]}</span>
                  </div>

                  <div className="my-2.5">
                    <div className="text-xs font-medium text-[var(--text-secondary)]">{row.title}</div>
                    <div className="mt-1 text-xl font-semibold tabular-nums text-[var(--text-primary)]">
                      {row.valueText}
                    </div>
                  </div>

                  <div className="text-[11px] text-[var(--text-muted)] flex items-center justify-between gap-2 pt-2.5 border-t border-[var(--border-hairline)]">
                    <span className="truncate">{row.baselineText}</span>
                    <span className="shrink-0">{row.sourceLabel}</span>
                  </div>
                </button>
                <InfoButton
                  label={row.title}
                  onClick={() => onExplain(row.infoTopic)}
                  className="absolute top-2.5 right-2.5 z-10"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 2: FITNESS AGE & HEALTHSPAN */}
      {healthSubTab === 'healthspan' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <section className="lg:col-span-5 apple-card p-6 sm:p-7 flex flex-col items-center text-center justify-between">
              <div className="w-full flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--accent-recovery)]">
                  Geschätztes Fitness-Alter
                </span>
                <InfoButton label="Fitness-Alter" onClick={() => onExplain('fitnessAge')} />
              </div>

              {fitnessAge.sufficientData && fitnessAge.estimatedFitnessAge !== null ? (
                <div className="my-6 relative w-52 h-52 rounded-full border-2 border-[var(--accent-recovery)]/30 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_center,rgba(5,150,105,0.10),transparent_70%)]">
                  <span className="text-xs text-[var(--text-secondary)]">
                    Fitness-Alter
                  </span>
                  <span className="mt-1 text-5xl font-semibold tabular-nums tracking-tight">
                    {formatNumberDE(fitnessAge.estimatedFitnessAge, 1)}
                  </span>
                  <span className="mt-2 text-xs font-medium text-[var(--accent-recovery)] tabular-nums">
                    {fitnessAge.differenceYears! <= 0 ? '' : '+'}
                    {formatNumberDE(fitnessAge.differenceYears, 1)} J. ggü.{' '}
                    {formatNumberDE(fitnessAge.chronologicalAge, 1)}
                  </span>
                </div>
              ) : (
                <div className="my-6 rounded-2xl bg-[var(--bg-canvas)]/70 dark:bg-[var(--bg-elevated)]/55 p-5 text-xs text-[var(--text-secondary)] space-y-2">
                  <div className="text-base font-semibold text-[var(--text-primary)]">
                    Zu wenig Daten
                  </div>
                  <p>Für eine verlässliche Langzeit-Schätzung fehlen aktuell noch:</p>
                  <ul className="list-disc pl-4 text-left space-y-1">
                    {fitnessAge.missingRequirements.map((req, idx) => (
                      <li key={idx}>{req}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                {fitnessAge.methodologyNote}
              </p>
            </section>

            <section className="lg:col-span-7 apple-card p-6 sm:p-7 space-y-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">Was in die Schätzung einfließt</h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Deine Gewohnheiten der letzten 1–3 Monate
                  </p>
                </div>
                <InfoButton label="Eingangsgrößen Fitness-Alter" onClick={() => onExplain('fitnessAge')} />
              </div>

              <div className="rounded-2xl bg-[var(--bg-canvas)]/75 dark:bg-[var(--bg-elevated)]/55 divide-y divide-[var(--border-hairline)] overflow-hidden">
                {fitnessAge.inputsUsed.map((inp) => (
                  <div key={inp.label} className="px-4 py-3.5 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-[var(--text-secondary)]">{inp.label}</div>
                      <div className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                        {inp.valueText}
                      </div>
                    </div>
                    <span
                      className={`text-xs font-semibold tabular-nums ${
                        inp.impactYears <= 0
                          ? 'text-[var(--accent-recovery)]'
                          : 'text-[var(--accent-load)]'
                      }`}
                    >
                      {inp.impactYears > 0 ? '+' : ''}
                      {formatNumberDE(inp.impactYears, 1)} J.
                    </span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[var(--border-hairline)]">
                <div>
                  <h3 className="text-xs font-semibold text-[var(--accent-recovery)] mb-2">
                    Das hilft dir
                  </h3>
                  {fitnessAge.improvingFactors.length > 0 ? (
                    <ul className="space-y-1.5 text-xs text-[var(--text-secondary)]">
                      {fitnessAge.improvingFactors.map((f, i) => (
                        <li key={i}>· {f}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)]">Keine besonderen Ausreißer.</p>
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-[var(--accent-load)] mb-2">
                    Hier ist noch Luft nach oben
                  </h3>
                  {fitnessAge.decliningFactors.length > 0 ? (
                    <ul className="space-y-1.5 text-xs text-[var(--text-secondary)]">
                      {fitnessAge.decliningFactors.map((f, i) => (
                        <li key={i}>· {f}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)]">Alles im grünen Bereich.</p>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* SUBTAB 3: TRENDS & ADVANCED ANALYTICS */}
      {healthSubTab === 'trends' && (
        <div className="space-y-6">
          <section className="apple-card p-6 sm:p-7 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    ['hrv', 'Nerven-Erholung'],
                    ['rhr', 'Morgenpuls'],
                    ['recovery', 'Erholung'],
                    ['sleep', 'Schlaf (Std.)'],
                    ['load', 'Anstrengung'],
                    ['steps', 'Schritte'],
                    ['vo2', 'Ausdauer'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedTrendMetric(key)}
                    aria-pressed={selectedTrendMetric === key}
                    className={`min-h-[34px] px-3.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedTrendMetric === key
                        ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)]'
                        : 'bg-[var(--bg-well)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <RangeSelector value={trendRange} onChange={setTrendRange} />
                <InfoButton
                  label="Langzeit-Trend"
                  onClick={() =>
                    onExplain(
                      selectedTrendMetric === 'hrv'
                        ? 'hrv'
                        : selectedTrendMetric === 'rhr'
                          ? 'rhr'
                          : selectedTrendMetric === 'recovery'
                            ? 'recoveryTrend'
                            : selectedTrendMetric === 'sleep'
                              ? 'sleepTrend'
                              : selectedTrendMetric === 'load'
                                ? 'trainingLoad'
                                : selectedTrendMetric === 'steps'
                                  ? 'steps'
                                  : 'cardioFitness'
                    )
                  }
                />
              </div>
            </div>

            <TrendChart
              data={trendsData.map((d) => ({
                date: d.date,
                label: d.label,
                value:
                  selectedTrendMetric === 'hrv'
                    ? d.hrv
                    : selectedTrendMetric === 'rhr'
                      ? d.rhr
                      : selectedTrendMetric === 'recovery'
                        ? d.recovery
                        : selectedTrendMetric === 'sleep'
                          ? d.sleepHours
                          : selectedTrendMetric === 'load'
                            ? d.load
                            : selectedTrendMetric === 'steps'
                              ? d.steps
                              : d.vo2,
              }))}
              unit={
                selectedTrendMetric === 'hrv'
                  ? 'ms'
                  : selectedTrendMetric === 'rhr'
                    ? '/min'
                    : selectedTrendMetric === 'recovery'
                      ? '%'
                      : selectedTrendMetric === 'sleep'
                        ? 'Std.'
                        : selectedTrendMetric === 'load'
                          ? '/100'
                          : selectedTrendMetric === 'vo2'
                            ? 'Pkt.'
                            : 'Schritte'
              }
              color={
                selectedTrendMetric === 'rhr'
                  ? 'var(--accent-strain)'
                  : selectedTrendMetric === 'load'
                    ? 'var(--accent-load)'
                    : selectedTrendMetric === 'sleep' || selectedTrendMetric === 'steps'
                      ? 'var(--accent-sleep)'
                      : 'var(--accent-recovery)'
              }
              valueName={selectedTrendMetric}
            />

            <p className="text-xs text-[var(--text-secondary)]">{trendInsightText}</p>
          </section>

          <section className="apple-card p-6 sm:p-7 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Werte vergleichen</h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Schau gemeinsam auf zwei Werte — so erkennst du persönliche Muster.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="inline-flex flex-wrap gap-0.5 p-1 rounded-full bg-[var(--bg-well)]">
                  {(
                    [
                      ['sleep_recovery', 'Schlaf & Erholung'],
                      ['hrv_load', 'Nerven-Erholung & Anstrengung'],
                      ['rhr_load', 'Morgenpuls & Anstrengung'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setCorrelationPair(key)}
                      aria-pressed={correlationPair === key}
                      className={`min-h-[30px] px-3 py-1 rounded-full text-xs font-medium transition-all ${
                        correlationPair === key
                          ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <InfoButton label="Werte vergleichen" onClick={() => onExplain('correlations')} />
              </div>
            </div>

            {correlationPair === 'sleep_recovery' && (
              <CorrelationChart
                data={trendsData.map((d) => ({
                  label: d.label,
                  primary: d.sleepHours,
                  secondary: d.recovery,
                }))}
                primaryLabel="Schlaf"
                primaryUnit="Std."
                primaryColor="var(--accent-sleep)"
                secondaryLabel="Erholung"
                secondaryUnit="%"
                secondaryColor="var(--accent-recovery)"
              />
            )}

            {correlationPair === 'hrv_load' && (
              <CorrelationChart
                data={trendsData.map((d) => ({
                  label: d.label,
                  primary: d.hrv,
                  secondary: d.load,
                }))}
                primaryLabel="Nerven-Erholung"
                primaryUnit="ms"
                primaryColor="var(--accent-recovery)"
                secondaryLabel="Anstrengung"
                secondaryUnit="/100"
                secondaryColor="var(--accent-load)"
              />
            )}

            {correlationPair === 'rhr_load' && (
              <CorrelationChart
                data={trendsData.map((d) => ({
                  label: d.label,
                  primary: d.rhr,
                  secondary: d.load,
                }))}
                primaryLabel="Morgenpuls"
                primaryUnit="/min"
                primaryColor="var(--accent-strain)"
                secondaryLabel="Anstrengung"
                secondaryUnit="/100"
                secondaryColor="var(--accent-load)"
              />
            )}
          </section>
        </div>
      )}

      {/* Biometric Detail Sheet */}
      <BottomSheet
        open={Boolean(activeBiometric)}
        onClose={() => setActiveBiometric(null)}
        title={activeBiometric?.title || ''}
        subtitle={
          activeBiometric
            ? `${de.provenance[activeBiometric.provenance]} · Quelle: ${activeBiometric.sourceLabel}`
            : undefined
        }
      >
        {activeBiometric && (
          <div className="space-y-5">
            <div className="flex items-baseline justify-between pb-4 border-b border-[var(--border-hairline)]">
              <div>
                <div className="text-xs text-[var(--text-muted)]">Aktueller Wert</div>
                <div className="mt-0.5 text-2xl font-semibold tabular-nums">
                  {activeBiometric.valueText}
                </div>
              </div>
              <div className="text-xs text-[var(--text-secondary)] text-right">
                {activeBiometric.baselineText}
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
              {activeBiometric.explanation}
            </p>

            <div>
              <h3 className="text-xs font-semibold text-[var(--text-muted)] mb-2">
                Verlauf der letzten 30 Tage
              </h3>
              <TrendChart
                data={biometricModalSeries}
                unit={activeBiometric.unit}
                color={activeBiometric.color}
                height={190}
                valueName={activeBiometric.title}
              />
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
};
