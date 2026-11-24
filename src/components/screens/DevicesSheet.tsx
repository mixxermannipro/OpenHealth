import React from 'react';
import { RefreshCw, Unplug, AlertCircle } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { useHealthStore } from '../../store/useHealthStore';
import { DeviceProviderId, SourcePriorityPreferences } from '../../types/health';
import { de } from '../../i18n/de';
import { formatClockFromIso } from '../../utils/formatters';
import { isNativeAndroid } from '../../services/androidBridge';

interface DevicesSheetProps {
  open: boolean;
  onClose: () => void;
}

export const DevicesSheet: React.FC<DevicesSheetProps> = ({ open, onClose }) => {
  const {
    connectedSources,
    sourcePriorities,
    isSyncing,
    lastSyncReport,
    connectHealthConnect,
    syncHealthConnect,
    disconnectProvider,
    updateSourcePriority,
  } = useHealthStore();

  const nativeAndroid = isNativeAndroid();

  const priorityRows: { key: keyof SourcePriorityPreferences; label: string }[] = [
    { key: 'workouts', label: 'Sport & Anstrengung' },
    { key: 'sleep', label: 'Schlaf & Schlafphasen' },
    { key: 'heartRate', label: 'Nerven-Erholung & Morgenpuls' },
    { key: 'steps', label: 'Schritte & aktive Minuten' },
    { key: 'weight', label: 'Gewicht & Körperwerte' },
  ];

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Geräte & Datenquellen"
      subtitle={
        nativeAndroid
          ? 'Android Health Connect & Datei-Importe'
          : 'Plattform- & Datei-Importe (.FIT, .GPX, .TCX, .XML)'
      }
      maxWidthClass="sm:max-w-2xl"
    >
      <div className="space-y-5">
        <div className="rounded-2xl bg-[var(--bg-elevated)]/65 border border-[var(--border-hairline)] p-3.5 text-xs text-[var(--text-secondary)] flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-[var(--accent-load)] shrink-0 mt-0.5" />
          <div>
            <strong className="text-[var(--text-primary)] block">
              Lokale Datensynchronisation
            </strong>
            {nativeAndroid
              ? 'Auf Android verbindet sich KADENZ direkt mit Android Health Connect. Uhren wie COROS, Garmin, Polar oder Samsung synchronisieren über Health Connect oder über .FIT/.GPX/.TCX-Dateien.'
              : 'Im Browser sind direkte Geräte-Verbindungen nicht möglich. Nutze unter Mehr → Datenquellen den Datei-Import (.FIT, .GPX, .TCX, .XML) oder die Android-App mit Health Connect.'}
          </div>
        </div>

        {/* Sync & Deduplication Feedback */}
        {lastSyncReport && (
          <div className="rounded-2xl border border-[var(--accent-recovery)]/40 bg-[var(--accent-recovery)]/10 p-3.5 text-xs space-y-1">
            <div className="font-semibold text-[var(--text-primary)]">
              Abgleich &amp; Prüfung auf Doppeltes abgeschlossen
            </div>
            <div className="text-[var(--text-secondary)] tabular-nums">
              Neu übernommen: {lastSyncReport.importedWorkouts} Training(s),{' '}
              {lastSyncReport.importedObservations} Messwerte · Doppeltes bereinigt:{' '}
              {lastSyncReport.deduplicatedWorkouts + lastSyncReport.deduplicatedObservations}
            </div>
            {lastSyncReport.notes.map((n, idx) => (
              <div key={idx} className="text-[11px] text-[var(--text-secondary)]">
                · {n}
              </div>
            ))}
          </div>
        )}

        {/* Provider Catalog — Apple Grouped List */}
        <div className="rounded-2xl bg-[var(--bg-canvas)]/80 dark:bg-[var(--bg-elevated)]/55 divide-y divide-[var(--border-hairline)] overflow-hidden">
          {connectedSources
            .filter((src) => !(nativeAndroid && src.providerId === 'apple_health'))
            .map((src) => {
              const isHC = src.providerId === 'health_connect';
              return (
                <div
                  key={src.providerId}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--text-primary)]">
                        {src.name}
                      </span>
                      <span
                        className={`text-[11px] font-medium ${
                          isHC && nativeAndroid && src.connected
                            ? 'text-[var(--accent-recovery)]'
                            : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {isHC && nativeAndroid
                          ? src.connected
                            ? '· Verbunden'
                            : '· Nicht verbunden'
                          : nativeAndroid
                            ? '· Via Health Connect / Datei'
                            : '· Nur Datei-Import'}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                      {src.supportedDataTypes.join(' · ')}
                    </div>
                    <div className="mt-0.5 text-[11px] text-[var(--text-muted)] tabular-nums">
                      {src.lastSyncAt
                        ? `Letzter Abgleich: ${formatClockFromIso(src.lastSyncAt)} · ${src.syncedRecordCount} Einträge`
                        : 'Kein direkter Cloud-Zugriff nötig'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isHC && nativeAndroid ? (
                      src.connected ? (
                        <>
                          <button
                            type="button"
                            disabled={isSyncing}
                            onClick={() => syncHealthConnect({ silent: false })}
                            className="min-h-[36px] inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--text-primary)] text-[var(--bg-canvas)] px-4 py-1.5 text-xs font-medium hover:opacity-90 disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                            Synchronisieren
                          </button>
                          <button
                            type="button"
                            onClick={() => disconnectProvider(src.providerId)}
                            aria-label={`${src.name} trennen`}
                            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-full bg-[var(--bg-well)] text-[var(--text-secondary)] hover:text-[var(--accent-strain)]"
                          >
                            <Unplug className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => connectHealthConnect()}
                          className="min-h-[36px] inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--accent-recovery)] text-black px-4 py-1.5 text-xs font-semibold hover:opacity-90"
                        >
                          Verbinden
                        </button>
                      )
                    ) : (
                      <span className="text-[11px] text-[var(--text-muted)] px-2.5 py-1 rounded-full bg-[var(--bg-well)]">
                        {nativeAndroid ? 'Via Health Connect' : 'Nicht verfügbar'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Preferred Source Priorities */}
        <div className="space-y-3 pt-2 border-t border-[var(--border-hairline)]">
          <div>
            <h3 className="text-xs font-semibold text-[var(--text-primary)]">
              Welche Quelle hat Vorrang?
            </h3>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Verhindert doppeltes Zählen, wenn zwei Apps dasselbe Training oder denselben Tag speichern.
            </p>
          </div>

          <div className="space-y-2">
            {priorityRows.map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-[var(--text-secondary)]">{row.label}</span>
                <select
                  aria-label={`Primärquelle für ${row.label}`}
                  value={sourcePriorities[row.key]}
                  onChange={(e) =>
                    updateSourcePriority(row.key, e.target.value as DeviceProviderId)
                  }
                  className="min-h-[38px] rounded-full bg-[var(--bg-well)] px-3.5 text-xs text-[var(--text-primary)]"
                >
                  {connectedSources.map((s) => (
                    <option key={s.providerId} value={s.providerId}>
                      {de.providers[s.providerId]}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
};
