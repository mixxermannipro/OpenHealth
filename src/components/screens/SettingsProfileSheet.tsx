import React, { useRef, useState } from 'react';
import { Download, RotateCcw, Trash2, Upload } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { useHealthStore } from '../../store/useHealthStore';
import {
  AppExportPayload,
  DashboardFocus,
  DemoScenarioId,
  ThemePreference,
} from '../../types/health';
import { de } from '../../i18n/de';
import { validateImportPayload } from '../../db/database';
import { PWAInstallButton } from '../ui/PWAInstallButton';

interface SettingsProfileSheetProps {
  open: boolean;
  onClose: () => void;
}

export const SettingsProfileSheet: React.FC<SettingsProfileSheetProps> = ({ open, onClose }) => {
  const {
    profile,
    theme,
    scenarioId,
    setTheme,
    switchScenario,
    updateProfile,
    setDashboardFocus,
    redoOnboarding,
    exportAllAsJson,
    importFromJson,
    resetAllData,
    showToast,
  } = useHealthStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<AppExportPayload | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const [nameInput, setNameInput] = useState(profile.displayName);
  const [maxHrInput, setMaxHrInput] = useState(String(profile.maxHr));
  const [sleepHoursInput, setSleepHoursInput] = useState(
    String(Number((profile.sleepTargetMinutes / 60).toFixed(1)))
  );

  const handleSaveProfileQuick = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({
      displayName: nameInput.trim() || profile.displayName,
      maxHr: Math.max(140, Math.min(220, Number(maxHrInput) || profile.maxHr)),
      sleepTargetMinutes: Math.round((Number(sleepHoursInput) || 8) * 60),
    });
  };

  const handleExport = () => {
    const payload = exportAllAsJson();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kadenz-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('JSON-Export heruntergeladen.', 'success');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    setPendingImport(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const check = validateImportPayload(parsed);
      if (!check.valid) {
        setImportError(check.error);
      } else {
        setPendingImport(check.payload);
      }
    } catch {
      setImportError('Die ausgewählte Datei ist kein gültiges JSON-Format.');
    }
    e.target.value = '';
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Profil, Beispiele & Einstellungen"
      subtitle="Auf diesem Gerät gespeichert · Design · Sicherung"
      maxWidthClass="sm:max-w-2xl"
    >
      <div className="space-y-6">
        {/* Demo Scenario Switcher */}
        <section className="space-y-2.5">
          <h3 className="text-xs font-semibold text-[var(--text-muted)]">
            Alltags-Beispiel wechseln
          </h3>
          <div className="rounded-2xl bg-[var(--bg-canvas)]/80 dark:bg-[var(--bg-elevated)]/55 divide-y divide-[var(--border-hairline)] overflow-hidden">
            {(['balanced', 'fatigued', 'recovering'] as DemoScenarioId[]).map((id) => {
              const active = scenarioId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => switchScenario(id)}
                  aria-pressed={active}
                  className={`w-full px-4 py-3 text-left transition-colors flex items-center justify-between gap-3 ${
                    active ? 'bg-[var(--accent-recovery)]/10' : 'hover:bg-[var(--bg-well)]/50'
                  }`}
                >
                  <div>
                    <div className="text-xs font-semibold text-[var(--text-primary)]">
                      {de.scenarios[id].label}
                    </div>
                    <div className="mt-0.5 text-[11px] text-[var(--text-secondary)] leading-snug">
                      {de.scenarios[id].description}
                    </div>
                  </div>
                  {active && (
                    <span className="text-[11px] font-semibold text-[var(--accent-recovery)] shrink-0">
                      Aktiv
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Theme Switcher — Apple Segmented Control */}
        <section className="space-y-2.5 pt-2 border-t border-[var(--border-hairline)]">
          <h3 className="text-xs font-semibold text-[var(--text-muted)]">Erscheinungsbild</h3>
          <div className="grid grid-cols-3 gap-0.5 p-1 rounded-full bg-[var(--bg-well)]">
            {(
              [
                ['system', 'System'],
                ['light', 'Hell'],
                ['dark', 'Dunkel'],
              ] as [ThemePreference, string][]
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setTheme(val)}
                aria-pressed={theme === val}
                className={`min-h-[36px] rounded-full text-xs font-medium transition-all ${
                  theme === val
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Dashboard Focus */}
        <section className="space-y-2.5 pt-2 border-t border-[var(--border-hairline)]">
          <h3 className="text-xs font-semibold text-[var(--text-muted)]">
            Schwerpunkt auf „Heute“
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                ['endurance', 'Ausdauer'],
                ['recovery', 'Erholung'],
                ['sleep', 'Schlaf'],
                ['general', 'Gesundheit'],
              ] as [DashboardFocus, string][]
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setDashboardFocus(val)}
                aria-pressed={profile.dashboardFocus === val}
                className={`min-h-[38px] rounded-full text-xs font-medium transition-colors ${
                  profile.dashboardFocus === val
                    ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)]'
                    : 'bg-[var(--bg-well)]/75 text-[var(--text-secondary)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Quick Profile Parameters */}
        <form
          onSubmit={handleSaveProfileQuick}
          className="space-y-3 pt-2 border-t border-[var(--border-hairline)]"
        >
          <h3 className="text-xs font-semibold text-[var(--text-muted)]">
            Persönliche Eckdaten
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <label className="space-y-1 text-xs text-[var(--text-secondary)]">
              <span>Name</span>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full min-h-[42px] rounded-xl bg-[var(--bg-well)]/75 px-3 text-sm text-[var(--text-primary)]"
              />
            </label>
            <label className="space-y-1 text-xs text-[var(--text-secondary)]">
              <span>Höchster Puls (/min)</span>
              <input
                type="number"
                value={maxHrInput}
                onChange={(e) => setMaxHrInput(e.target.value)}
                className="w-full min-h-[42px] rounded-xl bg-[var(--bg-well)]/75 px-3 text-sm tabular-nums text-[var(--text-primary)]"
              />
            </label>
            <label className="space-y-1 text-xs text-[var(--text-secondary)]">
              <span>Schlafziel (Std.)</span>
              <input
                type="number"
                step="0.5"
                value={sleepHoursInput}
                onChange={(e) => setSleepHoursInput(e.target.value)}
                className="w-full min-h-[42px] rounded-xl bg-[var(--bg-well)]/75 px-3 text-sm tabular-nums text-[var(--text-primary)]"
              />
            </label>
          </div>
          <button
            type="submit"
            className="min-h-[40px] px-5 py-2 rounded-full bg-[var(--text-primary)] text-[var(--bg-canvas)] text-xs font-semibold hover:opacity-90"
          >
            Eckdaten speichern
          </button>
        </form>

        {/* PWA & Onboarding */}
        <section className="space-y-2.5 pt-2 border-t border-[var(--border-hairline)]">
          <PWAInstallButton />
          <button
            type="button"
            onClick={async () => {
              onClose();
              await redoOnboarding();
            }}
            className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-full bg-[var(--bg-well)] px-4 py-2 text-xs font-medium text-[var(--text-primary)] hover:opacity-85"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Einrichtung erneut starten
          </button>
        </section>

        {/* Data Management: Export / Import / Reset */}
        <section className="space-y-3 pt-2 border-t border-[var(--border-hairline)]">
          <h3 className="text-xs font-semibold text-[var(--text-muted)]">
            Sicherung auf diesem Gerät
          </h3>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-well)] px-4 py-2 text-xs font-medium hover:opacity-85"
            >
              <Download className="w-3.5 h-3.5" />
              Sicherung speichern
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-well)] px-4 py-2 text-xs font-medium hover:opacity-85"
            >
              <Upload className="w-3.5 h-3.5" />
              Sicherung laden
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-strain)]/12 text-[var(--accent-strain)] px-4 py-2 text-xs font-medium hover:bg-[var(--accent-strain)]/20"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Lokale Daten löschen
            </button>
          </div>

          {importError && (
            <div className="rounded-xl bg-[var(--accent-strain)]/10 border border-[var(--accent-strain)]/30 p-3 text-xs text-[var(--accent-strain)]">
              {importError}
            </div>
          )}

          {pendingImport && (
            <div className="rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-hairline)] p-3.5 text-xs space-y-2">
              <div className="font-semibold text-[var(--text-primary)]">
                Import bestätigen ({pendingImport.workouts.length} Einheiten,{' '}
                {pendingImport.sleepSessions.length} Nächte)
              </div>
              <p className="text-[var(--text-secondary)]">
                Dadurch werden die aktuellen lokalen Demo-Daten auf diesem Gerät ersetzt.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await importFromJson(pendingImport);
                    setPendingImport(null);
                  }}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[var(--text-primary)] text-[var(--bg-canvas)] font-semibold"
                >
                  Jetzt ersetzen
                </button>
                <button
                  type="button"
                  onClick={() => setPendingImport(null)}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-[var(--border-hairline)]"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}

          {confirmReset && (
            <div className="rounded-xl bg-[var(--accent-strain)]/10 border border-[var(--accent-strain)]/30 p-3.5 text-xs space-y-2">
              <div className="font-semibold text-[var(--text-primary)]">
                Alle lokalen Daten unwiderruflich zurücksetzen?
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    setConfirmReset(false);
                    onClose();
                    await resetAllData();
                  }}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[var(--accent-strain)] text-white font-semibold"
                >
                  Ja, zurücksetzen
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-[var(--border-hairline)]"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </BottomSheet>
  );
};
