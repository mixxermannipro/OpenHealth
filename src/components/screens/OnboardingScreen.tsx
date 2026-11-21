import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, Activity, ShieldCheck, SlidersHorizontal, Watch } from 'lucide-react';
import {
  DashboardFocus,
  DeviceProviderId,
  GoalOption,
  SportType,
  UserProfile,
} from '../../types/health';
import { de } from '../../i18n/de';
import { useHealthStore } from '../../store/useHealthStore';

const ALL_GOALS: GoalOption[] = [
  'cardiovascular',
  'run_faster',
  'improve_recovery',
  'improve_sleep',
  'increase_strength',
  'build_muscle',
  'improve_endurance',
  'reduce_fatigue',
  'long_term_health',
  'general_fitness',
];

const PROVIDER_LIST: DeviceProviderId[] = [
  'garmin',
  'coros',
  'polar',
  'suunto',
  'apple_health',
  'health_connect',
  'samsung_health',
  'fitbit',
  'oura',
  'withings',
];

export const OnboardingScreen: React.FC = () => {
  const { profile, completeOnboarding, exploreDemoQuickStart } = useHealthStore();
  const [step, setStep] = useState(0);

  const [displayName, setDisplayName] = useState(profile.displayName || 'Lukas');
  const [age, setAge] = useState(String(profile.age || 29));
  const [heightCm, setHeightCm] = useState(String(profile.heightCm || 179));
  const [weightKg, setWeightKg] = useState(String(profile.weightKg || 72.4));
  const [biologicalSex, setBiologicalSex] = useState<UserProfile['biologicalSex']>(
    profile.biologicalSex || 'unspecified'
  );
  const [restingHr, setRestingHr] = useState(String(profile.restingHrBaselineManual ?? 52));
  const [maxHr, setMaxHr] = useState(String(profile.maxHr || 191));
  const [primarySport, setPrimarySport] = useState<SportType>(profile.primarySport || 'running');
  const [fitnessExperience, setFitnessExperience] = useState<UserProfile['fitnessExperience']>(
    profile.fitnessExperience || 'intermediate'
  );
  const [weeklyDays, setWeeklyDays] = useState(String(profile.weeklyTrainingDays || 5));
  const [sleepHours, setSleepHours] = useState(
    String(Number(((profile.sleepTargetMinutes || 480) / 60).toFixed(1)))
  );

  const [goals, setGoals] = useState<GoalOption[]>(profile.goals);
  const [target10kMin, setTarget10kMin] = useState('42:30');
  const [selectedProviders, setSelectedProviders] = useState<DeviceProviderId[]>(['garmin', 'oura']);
  const [dashboardFocus, setDashboardFocus] = useState<DashboardFocus>(profile.dashboardFocus);

  const toggleGoal = (g: GoalOption) => {
    setGoals((prev) => (prev.includes(g) ? prev.filter((item) => item !== g) : [...prev, g]));
  };

  const toggleProvider = (id: DeviceProviderId) => {
    setSelectedProviders((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleFinish = async () => {
    const parsed10k = (() => {
      const parts = target10kMin.split(':').map(Number);
      if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
        return parts[0] * 60 + parts[1];
      }
      return undefined;
    })();

    await completeOnboarding(
      {
        displayName: displayName.trim() || 'Athlet',
        age: Math.max(14, Math.min(95, Number(age) || 29)),
        heightCm: Math.max(120, Math.min(230, Number(heightCm) || 178)),
        weightKg: Math.max(35, Math.min(200, Number(weightKg) || 72)),
        biologicalSex,
        restingHrBaselineManual: Number(restingHr) || undefined,
        maxHr: Math.max(140, Math.min(220, Number(maxHr) || 190)),
        primarySport,
        fitnessExperience,
        weeklyTrainingDays: Math.max(1, Math.min(7, Number(weeklyDays) || 4)),
        sleepTargetMinutes: Math.round((Number(sleepHours) || 8) * 60),
        goals: goals.length > 0 ? goals : ['general_fitness'],
        runningTargets: parsed10k ? { ...profile.runningTargets, target10kSec: parsed10k } : profile.runningTargets,
        dashboardFocus,
      },
      selectedProviders.length > 0 ? selectedProviders : ['garmin']
    );
  };

  return (
    <div className="min-h-dvh bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col justify-between px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl flex-1 flex flex-col justify-center">
        {/* Progress header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <span className="font-editorial text-xl font-semibold tracking-tight">{de.brandName}</span>
            <span className="text-xs text-[var(--text-muted)]">·</span>
            <span className="text-xs text-[var(--text-secondary)]">Schritt {step + 1} von 6</span>
          </div>
          {step === 0 && (
            <button
              type="button"
              onClick={exploreDemoQuickStart}
              className="min-h-[40px] px-4 py-1.5 rounded-full text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-well)] transition-colors whitespace-nowrap"
            >
              Direkt zur Demo
            </button>
          )}
        </div>

        <div className="grid grid-cols-6 gap-1.5 mb-6" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-colors ${
                i <= step ? 'bg-[var(--accent-recovery)]' : 'bg-black/10 dark:bg-white/10'
              }`}
            />
          ))}
        </div>

        <div className="apple-card p-6 sm:p-8">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="step0"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="space-y-3">
                  <p className="text-xs font-medium text-[var(--accent-recovery)]">
                    Dein persönlicher Gesundheits- &amp; Trainingsbegleiter
                  </p>
                  <h1 className="font-editorial text-2xl sm:text-[32px] font-medium tracking-tight leading-snug text-balance">
                    Klar sehen, wie fit du heute bist – bei Erholung, Schlaf und Training.
                  </h1>
                  <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
                    KADENZ bündelt Daten von Uhren und Ringen unabhängig vom Hersteller und übersetzt
                    Ruhepuls, Nerven-Erholung, Schlaf und Anstrengung in einfache Empfehlungen —
                    direkt auf deinem Gerät, ganz ohne Konto.
                  </p>
                </div>

                <div className="rounded-2xl bg-[var(--bg-canvas)]/80 dark:bg-[var(--bg-elevated)]/55 divide-y divide-[var(--border-hairline)] overflow-hidden">
                  <div className="px-4 py-3.5 flex items-start gap-3">
                    <Activity className="w-4 h-4 text-[var(--accent-recovery)] mt-0.5 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold">Verständliche Auswertung</div>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        Mit jedem (i)-Symbol siehst du sofort in klaren Worten, wie Werte entstehen und was sie bedeuten.
                      </p>
                    </div>
                  </div>
                  <div className="px-4 py-3.5 flex items-start gap-3">
                    <Watch className="w-4 h-4 text-[var(--accent-sleep)] mt-0.5 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold">Offen für viele Uhren &amp; Apps</div>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        Beispiel-Anbindungen für Garmin, COROS, Polar, Oura, Apple Health &amp; Health Connect.
                      </p>
                    </div>
                  </div>
                  <div className="px-4 py-3.5 flex items-start gap-3">
                    <SlidersHorizontal className="w-4 h-4 text-[var(--accent-load)] mt-0.5 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold">Training vorab testen</div>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        Probiere aus, wie ein geplanter 10-km-Lauf deine Anstrengung und dein morgiges Gefühl verändert.
                      </p>
                    </div>
                  </div>
                  <div className="px-4 py-3.5 flex items-start gap-3">
                    <ShieldCheck className="w-4 h-4 text-[var(--accent-recovery)] mt-0.5 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold">Bleibt auf deinem Gerät</div>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        Diese Vorschau nutzt realitätsnahe Beispieldaten und speichert alles sicher direkt bei dir.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 rounded-full bg-[var(--text-primary)] text-[var(--bg-canvas)] px-6 py-3 text-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    Jetzt starten
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={exploreDemoQuickStart}
                    className="min-h-[48px] inline-flex items-center justify-center rounded-full bg-[var(--bg-well)] px-6 py-3 text-sm font-medium text-[var(--text-primary)] hover:opacity-85 transition-opacity"
                  >
                    Demo erkunden
                  </button>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div>
                  <h2 className="text-xl font-semibold">Über dich</h2>
                  <p className="mt-1 text-xs sm:text-sm text-[var(--text-secondary)]">
                    Mit diesen Angaben passen wir Pulsbereiche, Schlafziel und Vergleichswerte an dich an. Du kannst alles jederzeit ändern.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="space-y-1.5 text-xs font-medium text-[var(--text-secondary)]">
                    <span>Anzeigename</span>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)]/60 px-3.5 text-sm text-[var(--text-primary)]"
                    />
                  </label>
                  <label className="space-y-1.5 text-xs font-medium text-[var(--text-secondary)]">
                    <span>Alter (Jahre)</span>
                    <input
                      type="number"
                      min={14}
                      max={95}
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)]/60 px-3.5 text-sm tabular-nums text-[var(--text-primary)]"
                    />
                  </label>
                  <label className="space-y-1.5 text-xs font-medium text-[var(--text-secondary)]">
                    <span>Größe (cm)</span>
                    <input
                      type="number"
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)]/60 px-3.5 text-sm tabular-nums text-[var(--text-primary)]"
                    />
                  </label>
                  <label className="space-y-1.5 text-xs font-medium text-[var(--text-secondary)]">
                    <span>Gewicht (kg)</span>
                    <input
                      type="number"
                      step="0.1"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)]/60 px-3.5 text-sm tabular-nums text-[var(--text-primary)]"
                    />
                  </label>
                  <label className="space-y-1.5 text-xs font-medium text-[var(--text-secondary)]">
                    <span>Typischer Morgenpuls (Schläge/Min., optional)</span>
                    <input
                      type="number"
                      value={restingHr}
                      onChange={(e) => setRestingHr(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)]/60 px-3.5 text-sm tabular-nums text-[var(--text-primary)]"
                    />
                  </label>
                  <label className="space-y-1.5 text-xs font-medium text-[var(--text-secondary)]">
                    <span>Höchster Puls (Schläge/Min., geschätzt oder gemessen)</span>
                    <input
                      type="number"
                      value={maxHr}
                      onChange={(e) => setMaxHr(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)]/60 px-3.5 text-sm tabular-nums text-[var(--text-primary)]"
                    />
                  </label>
                  <label className="space-y-1.5 text-xs font-medium text-[var(--text-secondary)]">
                    <span>Hauptsportart</span>
                    <select
                      value={primarySport}
                      onChange={(e) => setPrimarySport(e.target.value as SportType)}
                      className="w-full min-h-[44px] rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)]/60 px-3 text-sm text-[var(--text-primary)]"
                    >
                      {Object.entries(de.sports).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5 text-xs font-medium text-[var(--text-secondary)]">
                    <span>Trainingserfahrung</span>
                    <select
                      value={fitnessExperience}
                      onChange={(e) =>
                        setFitnessExperience(e.target.value as UserProfile['fitnessExperience'])
                      }
                      className="w-full min-h-[44px] rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)]/60 px-3 text-sm text-[var(--text-primary)]"
                    >
                      <option value="beginner">Einsteiger</option>
                      <option value="intermediate">Regelmäßig aktiv</option>
                      <option value="advanced">Ambitioniert</option>
                      <option value="competitive">Wettkampforientiert</option>
                    </select>
                  </label>
                  <label className="space-y-1.5 text-xs font-medium text-[var(--text-secondary)]">
                    <span>Trainingstage pro Woche</span>
                    <input
                      type="number"
                      min={1}
                      max={7}
                      value={weeklyDays}
                      onChange={(e) => setWeeklyDays(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)]/60 px-3.5 text-sm tabular-nums text-[var(--text-primary)]"
                    />
                  </label>
                  <label className="space-y-1.5 text-xs font-medium text-[var(--text-secondary)]">
                    <span>Persönliches Schlafziel (Stunden)</span>
                    <input
                      type="number"
                      step="0.5"
                      min={5}
                      max={11}
                      value={sleepHours}
                      onChange={(e) => setSleepHours(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)]/60 px-3.5 text-sm tabular-nums text-[var(--text-primary)]"
                    />
                  </label>
                </div>

                <label className="block space-y-1.5 text-xs font-medium text-[var(--text-secondary)]">
                  <span>Angabe für Ausdauer-Vergleich (optional, hilft bei der Einordnung)</span>
                  <select
                    value={biologicalSex}
                    onChange={(e) =>
                      setBiologicalSex(e.target.value as UserProfile['biologicalSex'])
                    }
                    className="w-full min-h-[44px] rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)]/60 px-3 text-sm text-[var(--text-primary)]"
                  >
                    <option value="unspecified">Keine Angabe</option>
                    <option value="female">Weiblich</option>
                    <option value="male">Männlich</option>
                    <option value="diverse">Divers</option>
                  </select>
                </label>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div>
                  <h2 className="text-xl font-semibold">Persönliche Ziele</h2>
                  <p className="mt-1 text-xs sm:text-sm text-[var(--text-secondary)]">
                    Wähle Schwerpunkte aus, damit Empfehlungen zwischen Intensität, Umfang und Erholung abwägen.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ALL_GOALS.map((g) => {
                    const active = goals.includes(g);
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => toggleGoal(g)}
                        aria-pressed={active}
                        className={`min-h-[46px] flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left text-xs sm:text-sm transition-colors ${
                          active
                            ? 'border-[var(--accent-recovery)] bg-[var(--accent-recovery)]/10 text-[var(--text-primary)] font-medium'
                            : 'border-[var(--border-hairline)] bg-[var(--bg-elevated)]/40 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                        }`}
                      >
                        <span>{de.goals[g]}</span>
                        {active && <Check className="w-4 h-4 text-[var(--accent-recovery)] shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                <label className="block space-y-1.5 text-xs font-medium text-[var(--text-secondary)] pt-1">
                  <span>Optionales 10-km-Laufziel (mm:ss)</span>
                  <input
                    type="text"
                    placeholder="42:30"
                    value={target10kMin}
                    onChange={(e) => setTarget10kMin(e.target.value)}
                    className="w-full sm:w-48 min-h-[44px] rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)]/60 px-3.5 text-sm font-mono tabular-nums text-[var(--text-primary)]"
                  />
                </label>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div>
                  <h2 className="text-xl font-semibold">Sportuhr oder App wählen</h2>
                  <p className="mt-1 text-xs sm:text-sm text-[var(--text-secondary)]">
                    Hinweis: Alle Quellen in dieser Vorschau sind Demo-Verbindungen mit Beispieldaten. Es werden keine echten Konten oder Passwörter abgefragt.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {PROVIDER_LIST.map((id) => {
                    const active = selectedProviders.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleProvider(id)}
                        aria-pressed={active}
                        className={`min-h-[60px] flex flex-col items-start justify-between rounded-xl border p-3 text-left transition-colors ${
                          active
                            ? 'border-[var(--accent-sleep)] bg-[var(--accent-sleep)]/10 text-[var(--text-primary)]'
                            : 'border-[var(--border-hairline)] bg-[var(--bg-elevated)]/40 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
                        }`}
                      >
                        <div className="w-full flex items-center justify-between">
                          <span className="text-sm font-medium">{de.providers[id]}</span>
                          {active && <Check className="w-4 h-4 text-[var(--accent-sleep)]" />}
                        </div>
                        <span className="text-[11px] text-[var(--text-muted)]">Demo-Quelle</span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div>
                  <h2 className="text-xl font-semibold">Was ist dir auf dem Startbildschirm am wichtigsten?</h2>
                  <p className="mt-1 text-xs sm:text-sm text-[var(--text-secondary)]">
                    Wähle aus, worauf deine Übersicht zuerst den Schwerpunkt legen soll.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(
                    [
                      {
                        id: 'endurance',
                        title: 'Ausdauer & Training',
                        desc: 'Fokus auf Trainings-Anstrengung, Lauftempo, Ausdauer-Niveau und Pulsbereiche.',
                      },
                      {
                        id: 'recovery',
                        title: 'Erholung & Tagesform',
                        desc: 'Fokus auf Nerven-Erholung, Morgenpuls und die passende Belastung für heute.',
                      },
                      {
                        id: 'sleep',
                        title: 'Schlaf & Rhythmus',
                        desc: 'Fokus auf Schlafdauer, fehlenden Schlaf und regelmäßige Schlafenszeiten.',
                      },
                      {
                        id: 'general',
                        title: 'Rundum-Gesundheit',
                        desc: 'Ausgewogene Übersicht aus Erholung, Schlaf, Puls und Bewegung im Alltag.',
                      },
                    ] as const
                  ).map((item) => {
                    const active = dashboardFocus === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setDashboardFocus(item.id)}
                        aria-pressed={active}
                        className={`min-h-[82px] rounded-2xl border p-4 text-left transition-colors ${
                          active
                            ? 'border-[var(--accent-recovery)] bg-[var(--accent-recovery)]/10'
                            : 'border-[var(--border-hairline)] bg-[var(--bg-elevated)]/40 hover:bg-[var(--bg-elevated)]'
                        }`}
                      >
                        <div className="text-sm font-semibold text-[var(--text-primary)]">
                          {item.title}
                        </div>
                        <div className="mt-1 text-xs text-[var(--text-secondary)]">{item.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div>
                  <h2 className="text-xl font-semibold">Bereit für dein Dashboard</h2>
                  <p className="mt-1 text-xs sm:text-sm text-[var(--text-secondary)]">
                    KADENZ generiert jetzt 6 Monate zusammenhängende Demo-Verlaufsdaten auf Basis deiner Auswahl und speichert sie lokal auf diesem Gerät.
                  </p>
                </div>

                <div className="rounded-2xl bg-[var(--bg-elevated)]/65 border border-[var(--border-hairline)] p-4 space-y-2 text-xs sm:text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Profil</span>
                    <span className="font-medium">{displayName || 'Athlet'} · {age} Jahre</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Hauptsportart</span>
                    <span className="font-medium">{de.sports[primarySport]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Schlafziel</span>
                    <span className="font-medium tabular-nums">{sleepHours} Std./Nacht</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Demo-Quellen</span>
                    <span className="font-medium">
                      {selectedProviders.map((p) => de.providers[p]).join(', ') || 'Garmin'}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {step > 0 && (
            <div className="mt-6 pt-5 border-t border-[var(--border-hairline)] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="min-h-[44px] inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-well)] px-5 py-2 text-sm font-medium text-[var(--text-primary)] hover:opacity-85 transition-opacity"
              >
                <ArrowLeft className="w-4 h-4" />
                Zurück
              </button>

              {step < 5 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.min(5, s + 1))}
                  className="min-h-[44px] inline-flex items-center gap-1.5 rounded-full bg-[var(--text-primary)] text-[var(--bg-canvas)] px-6 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Weiter
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinish}
                  className="min-h-[44px] inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-recovery)] text-slate-950 px-6 py-2 text-sm font-semibold hover:opacity-95 transition-opacity"
                >
                  <Check className="w-4 h-4" />
                  Dashboard erstellen
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
