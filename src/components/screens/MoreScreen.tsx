import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronRight,
  ChevronLeft,
  Watch,
  Heart,
  Shield,
  Sparkles,
  Smartphone,
  Settings,
  RefreshCw,
  Upload,
  Download,
  RotateCcw,
  PlusCircle,
  Clock,
  Wind,
  NotebookPen,
  Activity,
  User,
  Sun,
  Moon,
  Monitor,
  Triangle,
  CircleDot,
  Vibrate,
  Globe,
  Copy,
  Check,
  Share2,
  Link2,
} from 'lucide-react';
import {
  DeviceProviderId,
  ThemePreference,
} from '../../types/health';
import { useShallow } from 'zustand/react/shallow';
import { useHealthStore } from '../../store/useHealthStore';
import { validateImportPayload } from '../../db/database';
import {
  parseAppleHealthXml,
  parseFitFile,
  parseGpxFile,
  parseHealthConnectJson,
  parseTcxFile,
} from '../../providers/fileImporters';
import { getZeroCostAiPromptTemplate } from '../../engine/aiMealParser';
import { SUPPORTED_LOCALES } from '../../i18n/translations';
import { ONBOARDING_COPY } from '../../i18n/onboardingCopy';
import { useI18n } from '../../i18n/useI18n';
import { getEffectiveAge } from '../../utils/biometrics';
import { IOSSwitch } from '../ui/LiquidPrimitives';
import { SNAPPY_SPRING } from '../ui/MotionPrimitives';
import { PWAInstallButton } from '../ui/PWAInstallButton';
import {
  haptics,
  isHapticsEnabled,
  setHapticsEnabled,
} from '../../utils/haptics';
import {
  exportJsonBackupNative,
  isNativeAndroid,
  openExternalWearableApp,
  writeTextToClipboard,
} from '../../services/androidBridge';
import { formatClockFromIso } from '../../utils/formatters';

interface MoreScreenProps {
  onOpenJournal: () => void;
  onOpenBreathwork: () => void;
  onOpenSettings: () => void;
}

export const MoreScreen: React.FC<MoreScreenProps> = ({
  onOpenJournal,
  onOpenBreathwork,
  onOpenSettings,
}) => {
  const {
    detailView,
    setDetailView,
    profile,
    theme,
    setTheme,
    connectedSources,
    aiPrivacy,
    updateAIPrivacy,
    connectSimulatedProvider,
    disconnectProvider,
    simulateProviderSync,
    connectHealthConnect,
    requestHealthConnectBackgroundAccess,
    requestDisableBatteryOptimization,
    syncHealthConnect,
    openHealthConnectAppSettings,
    healthConnectStatus,
    healthConnectPermissions,
    batteryOptimizationIgnored,
    importExternalHealthFile,
    exportAllAsJson,
    importFromJson,
    resetAllData,
    isSyncing,
    showToast,
  } = useHealthStore(
    useShallow((s) => ({
      detailView: s.detailView,
      setDetailView: s.setDetailView,
      profile: s.profile,
      theme: s.theme,
      setTheme: s.setTheme,
      connectedSources: s.connectedSources,
      aiPrivacy: s.aiPrivacy,
      updateAIPrivacy: s.updateAIPrivacy,
      connectSimulatedProvider: s.connectSimulatedProvider,
      disconnectProvider: s.disconnectProvider,
      simulateProviderSync: s.simulateProviderSync,
      connectHealthConnect: s.connectHealthConnect,
      requestHealthConnectBackgroundAccess: s.requestHealthConnectBackgroundAccess,
      requestDisableBatteryOptimization: s.requestDisableBatteryOptimization,
      syncHealthConnect: s.syncHealthConnect,
      openHealthConnectAppSettings: s.openHealthConnectAppSettings,
      healthConnectStatus: s.healthConnectStatus,
      healthConnectPermissions: s.healthConnectPermissions,
      batteryOptimizationIgnored: s.batteryOptimizationIgnored,
      importExternalHealthFile: s.importExternalHealthFile,
      exportAllAsJson: s.exportAllAsJson,
      importFromJson: s.importFromJson,
      resetAllData: s.resetAllData,
      isSyncing: s.isSyncing,
      showToast: s.showToast,
    }))
  );

  const { t, locale, setLocale } = useI18n();
  const [promptCopied, setPromptCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showCorosGuide, setShowCorosGuide] = useState(false);
  const [hapticsOn, setHapticsOn] = useState<boolean>(() => isHapticsEnabled());
  const [importProvider, setImportProvider] = useState<DeviceProviderId>('coros');
  const healthFileInputRef = useRef<HTMLInputElement | null>(null);
  const jsonBackupInputRef = useRef<HTMLInputElement | null>(null);
  const nativeAndroid = isNativeAndroid();

  const handleToggleHaptics = (enabled: boolean) => {
    setHapticsOn(enabled);
    setHapticsEnabled(enabled);
    if (enabled) {
      haptics.medium();
    }
  };

  const handleExternalFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.fit')) {
        const buf = await file.arrayBuffer();
        const res = await parseFitFile(buf, importProvider, profile);
        await importExternalHealthFile(res);
      } else if (lower.endsWith('.gpx')) {
        const res = parseGpxFile(await file.text(), importProvider, profile);
        await importExternalHealthFile(res);
      } else if (lower.endsWith('.tcx')) {
        const res = parseTcxFile(await file.text(), importProvider, profile);
        await importExternalHealthFile(res);
      } else if (lower.endsWith('.xml')) {
        const res = parseAppleHealthXml(await file.text(), profile);
        await importExternalHealthFile(res);
      } else if (lower.endsWith('.json')) {
        const res = parseHealthConnectJson(await file.text(), profile);
        await importExternalHealthFile(res);
      } else {
        showToast('Unterstützte Formate: .fit, .gpx, .tcx, Apple Health .xml, Health Connect .json', 'warning');
      }
    } catch {
      showToast('Datei konnte nicht gelesen werden. Bitte Format prüfen.', 'warning');
    } finally {
      e.target.value = '';
    }
  };

  const handleExportBackup = async () => {
    haptics.success();
    const payload = exportAllAsJson();
    const filename = `kadenz-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const jsonString = JSON.stringify(payload, null, 2);

    if (nativeAndroid) {
      const exported = await exportJsonBackupNative(filename, jsonString);
      if (exported) {
        showToast('Backup zum Speichern / Teilen geöffnet.', 'success');
        return;
      }
    }

    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Lokales Backup als JSON gespeichert.', 'success');
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const validation = validateImportPayload(parsed);
      if (!validation.valid) {
        haptics.warning();
        showToast(validation.error || 'Ungültige Backup-JSON-Datei.', 'warning');
        return;
      }
      await importFromJson(parsed);
    } catch {
      haptics.warning();
      showToast('Ungültige Backup-JSON-Datei.', 'warning');
    } finally {
      e.target.value = '';
    }
  };

  // =====================================================================
  // SUB-VIEW 1: DATENQUELLEN (Real Android Health Connect + COROS + Open Imports)
  // =====================================================================
  if (detailView === 'sources') {
    const sourceIcon = (id: DeviceProviderId) => {
      if (id === 'health_connect') return <Heart className="w-5 h-5 text-[var(--accent-recovery)]" />;
      if (id === 'coros') return <Watch className="w-5 h-5 text-[var(--accent-hrv)]" />;
      if (id === 'garmin') return <Triangle className="w-5 h-5 text-[var(--text-primary)] fill-current" />;
      if (id === 'polar') return <CircleDot className="w-5 h-5 text-[var(--text-primary)]" />;
      return <Heart className="w-5 h-5 text-[var(--text-primary)]" />;
    };

    const ORDER: DeviceProviderId[] = ['health_connect', 'coros', 'garmin', 'polar', 'apple_health'];
    const primarySources = ORDER.map((id) =>
      connectedSources.find((s) => s.providerId === id)
    ).filter((s): s is NonNullable<typeof s> => Boolean(s));

    const hcConnected = connectedSources.some((s) => s.providerId === 'health_connect' && s.connected);

    const handleSourcePrimaryAction = (src: (typeof primarySources)[number]) => {
      if (src.providerId === 'apple_health') {
        setImportProvider('apple_health');
        healthFileInputRef.current?.click();
        return;
      }
      if (src.providerId === 'health_connect' && nativeAndroid) {
        if (src.connected) {
          syncHealthConnect({ silent: false });
        } else {
          connectHealthConnect();
        }
        return;
      }
      if (src.providerId === 'coros' && nativeAndroid) {
        haptics.selection();
        setShowCorosGuide((prev) => !prev);
        return;
      }
      if (nativeAndroid) {
        setImportProvider(src.providerId);
        healthFileInputRef.current?.click();
        return;
      }
      if (src.connected) {
        simulateProviderSync(src.providerId);
      } else {
        connectSimulatedProvider(src.providerId);
      }
    };

    return (
      <motion.div
        initial={{ opacity: 0, x: 14 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-5"
      >
        <header className="space-y-2">
          <button
            type="button"
            onClick={() => setDetailView('none')}
            className="inline-flex items-center gap-1 -ml-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{t.more.sourcesTitle}</span>
          </button>

          <h1 className="font-editorial text-[42px] sm:text-[48px] font-medium leading-[1.06] text-[var(--text-primary)]">
            {t.more.sourcesHero1}
            <br />
            {t.more.sourcesHero2}
          </h1>
          <p className="text-[14.5px] leading-relaxed text-[var(--text-secondary)] max-w-md">
            {nativeAndroid
              ? 'Dauerhafte Android Health Connect Synchronisation für Schlafphasen, HRV, Ruhepuls, Schritte, Trainings, Vitalwerte & Ernährung — alle Wearables (COROS, Garmin, Polar, Samsung, Oura, Fitbit) fließen darüber lokal zusammen.'
              : t.more.sourcesDesc}
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Verbundene Quellen */}
          <div className="lg:col-span-7 space-y-2.5">
            <p className="px-1 text-[13px] font-medium text-[var(--text-secondary)]">
              {t.more.connectedSourcesLabel}
            </p>
            <div className="space-y-2.5">
              {primarySources.map((src) => {
                const isHC = src.providerId === 'health_connect';
                const isCoros = src.providerId === 'coros';
                const isApple = src.providerId === 'apple_health';
                const isWearableViaImport = nativeAndroid && !isHC && !isApple;
                return (
                  <div key={src.providerId} className="space-y-2">
                    <div className="apple-card px-4 py-3.5 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        disabled={isSyncing}
                        onClick={() => handleSourcePrimaryAction(src)}
                        className="flex-1 flex items-center gap-3.5 text-left min-w-0"
                      >
                        <span className="w-10 h-10 rounded-xl bg-[var(--bg-well)] flex items-center justify-center shrink-0">
                          {sourceIcon(src.providerId)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[15.5px] font-semibold text-[var(--text-primary)] truncate">
                            {src.name}
                          </p>
                          {isHC && nativeAndroid ? (
                            src.connected ? (
                              <p className="mt-0.5 inline-flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)] flex-wrap">
                                <span className="w-2 h-2 rounded-full bg-[var(--accent-recovery)] shrink-0" />
                                <span>
                                  {t.more.connected}
                                  {healthConnectPermissions?.grantedCount
                                    ? ` · ${healthConnectPermissions.grantedCount} Freigaben`
                                    : ''}
                                  {src.lastSyncAt ? ` · ${formatClockFromIso(src.lastSyncAt)}` : ''}
                                </span>
                              </p>
                            ) : (
                              <p className="mt-0.5 inline-flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
                                <PlusCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>
                                  {healthConnectStatus?.status === 'provider_update_required'
                                    ? 'Health Connect im Play Store installieren'
                                    : 'Nativ auf Android verbinden (Schlaf, HRV, Trainings)'}
                                </span>
                              </p>
                            )
                          ) : isCoros && nativeAndroid ? (
                            <p className="mt-0.5 inline-flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
                              <Watch className="w-3.5 h-3.5 shrink-0 text-[var(--accent-hrv)]" />
                              <span>COROS Einrichtung (Health Connect &amp; .FIT)</span>
                            </p>
                          ) : isWearableViaImport ? (
                            <p className="mt-0.5 inline-flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
                              <Upload className="w-3.5 h-3.5 shrink-0" />
                              <span>Via Health Connect oder .FIT/.GPX/.TCX</span>
                            </p>
                          ) : src.connected ? (
                            <p className="mt-0.5 inline-flex items-center gap-1.5 text-[12.5px] text-[var(--text-secondary)]">
                              <span className="w-2 h-2 rounded-full bg-[var(--accent-recovery)]" />
                              <span>{t.more.connected}</span>
                            </p>
                          ) : isApple || src.comingSoon ? (
                            <p className="mt-0.5 inline-flex items-center gap-1.5 text-[12.5px] text-[var(--text-muted)]">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{t.more.xmlReady}</span>
                            </p>
                          ) : (
                            <p className="mt-0.5 inline-flex items-center gap-1.5 text-[12.5px] text-[var(--text-secondary)]">
                              <PlusCircle className="w-3.5 h-3.5" />
                              <span>{t.more.add}</span>
                            </p>
                          )}
                        </div>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isHC && nativeAndroid && src.connected && (
                          <button
                            type="button"
                            onClick={() => openHealthConnectAppSettings()}
                            className="rounded-full px-2.5 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-well)]"
                          >
                            Rechte
                          </button>
                        )}
                        {src.connected && !(isHC && nativeAndroid) && (
                          <button
                            type="button"
                            onClick={() => disconnectProvider(src.providerId)}
                            className="rounded-full px-2.5 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-well)]"
                          >
                            {t.more.disconnect}
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label={`${src.name} synchronisieren`}
                          disabled={isSyncing}
                          onClick={() => handleSourcePrimaryAction(src)}
                          className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        >
                          {isHC && nativeAndroid && isSyncing ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-[var(--accent-recovery)]" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Dedicated COROS Android Setup & Direct .FIT Import Panel */}
                    {isCoros && nativeAndroid && showCorosGuide && (
                      <div className="apple-card p-4 space-y-3 border border-[var(--accent-hrv)]/30 bg-[var(--bg-elevated)]/70">
                        <div className="space-y-1">
                          <p className="text-[13.5px] font-semibold text-[var(--text-primary)]">
                            COROS Uhr kostenlos &amp; dauerhaft verbinden
                          </p>
                          <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">
                            Die COROS Partner-API ist leider nur für kommerzielle Server-Plattformen freigegeben.
                            Über <strong className="text-[var(--text-primary)]">Android Health Connect</strong> synchronisiert
                            deine COROS-Uhr jedoch kostenlos &amp; vollautomatisch Schlaf, Herzfrequenz, Ruhepuls, Schritte
                            und Trainings direkt in KADENZ:
                          </p>
                        </div>

                        <ol className="text-[12px] text-[var(--text-secondary)] space-y-1.5 list-decimal pl-4">
                          <li>
                            Öffne die <strong className="text-[var(--text-primary)]">COROS App</strong> →{' '}
                            <em>Profil → Einstellungen → Drittanbieter-Apps → Health Connect</em>.
                          </li>
                          <li>
                            Aktiviere dort alle Kategorien (Schlaf, Herzfrequenz, Schritte, Trainings &amp; Distanz).
                          </li>
                          <li>
                            Verbinde oben <strong className="text-[var(--text-primary)]">Health Connect</strong> und erlaube den
                            dauerhaften Hintergrund-Abgleich (alle 15 Min.).
                          </li>
                        </ol>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          <button
                            type="button"
                            onClick={async () => {
                              haptics.selection();
                              const ok = await openExternalWearableApp('com.coros.coros');
                              if (!ok) {
                                showToast('COROS App nicht gefunden.', 'warning');
                              }
                            }}
                            className="min-h-[40px] rounded-full bg-[var(--text-primary)] text-[var(--bg-canvas)] text-xs font-semibold px-4 hover:opacity-90 transition-opacity"
                          >
                            COROS App öffnen
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              haptics.tick();
                              setImportProvider('coros');
                              healthFileInputRef.current?.click();
                            }}
                            className="min-h-[40px] rounded-full bg-[var(--bg-well)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--text-primary)] px-4"
                          >
                            COROS .FIT / .GPX importieren
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Einstellungen + Dauerhafter Hintergrund-Sync + Offene Datei-Schnittstellen */}
          <div className="lg:col-span-5 space-y-5">
            {nativeAndroid && hcConnected && (
              <div className="apple-card p-4 space-y-3 border border-[var(--accent-recovery)]/25">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[var(--accent-recovery)] shrink-0" />
                    <p className="text-[13.5px] font-semibold text-[var(--text-primary)]">
                      Dauerhafter Hintergrund-Sync
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      healthConnectPermissions?.backgroundReadGranted && batteryOptimizationIgnored
                        ? 'bg-[var(--accent-recovery)]/15 text-[var(--accent-recovery)]'
                        : 'bg-[var(--accent-calories)]/15 text-[var(--accent-calories)]'
                    }`}
                  >
                    {healthConnectPermissions?.backgroundReadGranted && batteryOptimizationIgnored
                      ? 'Optimal aktiv'
                      : 'Einrichtung offen'}
                  </span>
                </div>

                <div className="space-y-1.5 text-[12px] text-[var(--text-secondary)]">
                  <p>
                    • Health-Connect-Datentypen:{' '}
                    <strong className="text-[var(--text-primary)]">
                      {healthConnectPermissions?.allGranted
                        ? `Alle aktiv (${healthConnectPermissions.grantedCount}/${healthConnectPermissions.totalCount}) ✓`
                        : `${healthConnectPermissions?.grantedCount ?? 0} von ${healthConnectPermissions?.totalCount ?? 0} freigegeben`}
                    </strong>
                  </p>
                  <p>
                    • Hintergrund-Leserecht (alle 15 Min.):{' '}
                    <strong className="text-[var(--text-primary)]">
                      {healthConnectPermissions?.backgroundReadGranted ? 'Aktiv ✓' : 'Fehlt noch'}
                    </strong>
                  </p>
                  <p>
                    • 90-Tage-Verlauf (Baselines &amp; Schlaf):{' '}
                    <strong className="text-[var(--text-primary)]">
                      {healthConnectPermissions?.historyReadGranted ? 'Aktiv ✓' : '30 Tage Standard'}
                    </strong>
                  </p>
                  <p>
                    • Akku-Optimierung:{' '}
                    <strong className="text-[var(--text-primary)]">
                      {batteryOptimizationIgnored ? 'Deaktiviert ✓ (kein Stopp)' : 'Aktiv (kann Sync bremsen)'}
                    </strong>
                  </p>
                  {healthConnectPermissions?.lastBackgroundSyncAt && (
                    <p className="text-[11.5px] text-[var(--text-muted)] tabular-nums pt-0.5">
                      Letzter Hintergrund-Sync:{' '}
                      {formatClockFromIso(healthConnectPermissions.lastBackgroundSyncAt)}
                      {typeof healthConnectPermissions.lastBackgroundSyncRecords === 'number'
                        ? ` · ${healthConnectPermissions.lastBackgroundSyncRecords} Einträge`
                        : ''}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  {!healthConnectPermissions?.allGranted && (
                    <button
                      type="button"
                      onClick={() => connectHealthConnect()}
                      className="w-full min-h-[40px] rounded-full bg-[var(--accent-recovery)] text-black text-xs font-semibold px-4 hover:opacity-90"
                    >
                      Alle Health-Connect-Daten freigeben
                    </button>
                  )}

                  {healthConnectPermissions?.backgroundReadSupported &&
                    !healthConnectPermissions?.backgroundReadGranted && (
                      <button
                        type="button"
                        onClick={() => requestHealthConnectBackgroundAccess()}
                        className="w-full min-h-[40px] rounded-full bg-[var(--text-primary)] text-[var(--bg-canvas)] text-xs font-semibold px-4 hover:opacity-90"
                      >
                        Dauerhaften Hintergrund-Sync erlauben
                      </button>
                    )}

                  {!batteryOptimizationIgnored && (
                    <button
                      type="button"
                      onClick={() => requestDisableBatteryOptimization()}
                      className="w-full min-h-[40px] rounded-full bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--text-primary)] px-4"
                    >
                      Akku-Optimierung deaktivieren
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2.5">
              <p className="px-1 text-[13px] font-medium text-[var(--text-secondary)]">
                {t.more.settingsLabel}
              </p>

              <div className="space-y-2.5">
                <div className="apple-card px-4 py-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Settings className="w-5 h-5 text-[var(--text-secondary)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[14.5px] font-semibold text-[var(--text-primary)]">
                        {t.more.localProcessing}
                      </p>
                      <p className="text-[12px] text-[var(--text-secondary)]">
                        {t.more.localProcessingSub}
                      </p>
                    </div>
                  </div>
                  <IOSSwitch
                    checked={aiPrivacy.localProcessingOnly}
                    onChange={(v) => updateAIPrivacy({ localProcessingOnly: v })}
                    ariaLabel={t.more.localProcessing}
                  />
                </div>

                <div className="apple-card px-4 py-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <RefreshCw className="w-5 h-5 text-[var(--text-secondary)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[14.5px] font-semibold text-[var(--text-primary)]">
                        {t.more.bgSync}
                      </p>
                      <p className="text-[12px] text-[var(--text-secondary)]">
                        {nativeAndroid ? 'Alle 15 Min. automatisch via Health Connect' : t.more.bgSyncSub}
                      </p>
                    </div>
                  </div>
                  <IOSSwitch
                    checked={aiPrivacy.backgroundSync}
                    onChange={(v) => updateAIPrivacy({ backgroundSync: v })}
                    ariaLabel={t.more.bgSync}
                  />
                </div>
              </div>
            </div>

            {/* Open Standards File Importer */}
            <div className="apple-card p-4 space-y-3">
              <div className="flex items-center gap-2.5">
                <Upload className="w-4 h-4 text-[var(--accent-recovery)] shrink-0" />
                <div>
                  <p className="text-[14px] font-semibold text-[var(--text-primary)]">
                    {t.more.openImportTitle}
                  </p>
                  <p className="text-[11.5px] text-[var(--text-secondary)]">
                    COROS/Garmin .FIT, .GPX, .TCX, Apple Health .XML &amp; Health Connect .JSON
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => healthFileInputRef.current?.click()}
                className="w-full min-h-[42px] rounded-full bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--text-primary)] hover:border-white/20 transition-colors"
              >
                {t.more.chooseFile}
              </button>
              <input
                ref={healthFileInputRef}
                type="file"
                accept=".fit,.gpx,.tcx,.xml,.json"
                onChange={handleExternalFileChange}
                className="hidden"
              />
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // =====================================================================
  // SUB-VIEW 2: ZERO-COST KI-IMPORT & PRIVATSPHÄRE (0 €, 100 % lokal)
  // =====================================================================
  if (detailView === 'aiPrivacy') {
    const promptTemplate = getZeroCostAiPromptTemplate(locale);

    const handleCopyPrompt = async () => {
      const ok = await writeTextToClipboard(promptTemplate);
      if (ok) {
        haptics.success();
        setPromptCopied(true);
        showToast('0 € KI-Prompt in die Zwischenablage kopiert.', 'success');
        window.setTimeout(() => setPromptCopied(false), 2400);
      } else {
        haptics.warning();
        showToast('Prompt konnte nicht automatisch kopiert werden.', 'warning');
      }
    };

    return (
      <motion.div
        initial={{ opacity: 0, x: 14 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-5"
      >
        <header className="space-y-1.5">
          <button
            type="button"
            onClick={() => setDetailView('none')}
            className="inline-flex items-center gap-1 -ml-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{t.more.title}</span>
          </button>
          <h1 className="text-[30px] font-bold tracking-tight text-[var(--text-primary)] leading-tight">
            0 € KI-Import & Privatsphäre
          </h1>
          <p className="text-[14.5px] text-[var(--text-secondary)] max-w-lg">
            Keine API-Keys, kein Backend, 0 € Betriebskosten. Schätze Mahlzeiten in deiner
            bevorzugten KI-App (Gemini, ChatGPT, Claude) und übernimm sie per Android „Teilen“ oder
            Zwischenablage.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left: Prompt-Vorlage */}
          <div className="lg:col-span-6 apple-card p-5 space-y-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
                  Kopierbare Prompt-Vorlage
                </h2>
                <p className="text-[12.5px] text-[var(--text-secondary)]">
                  Sorgt für einheitliches JSON für fehlerfreies lokales Einlesen.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="shrink-0 min-h-[36px] px-3.5 rounded-full bg-[var(--text-primary)] text-[var(--bg-canvas)] text-xs font-semibold inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity"
              >
                {promptCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Kopiert</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Kopieren</span>
                  </>
                )}
              </button>
            </div>

            <pre className="rounded-2xl bg-[var(--bg-well)] border border-[var(--border-hairline)] p-3.5 text-[12px] leading-relaxed font-mono text-[var(--text-primary)] whitespace-pre-wrap overflow-x-auto">
              {promptTemplate}
            </pre>
          </div>

          {/* Right: Share-Intent, Deep-Link & Lokale Privatsphäre */}
          <div className="lg:col-span-6 space-y-4">
            <div className="apple-card p-5 space-y-3.5">
              <div className="flex items-center gap-2.5">
                <Share2 className="w-4 h-4 text-[var(--accent-recovery)] shrink-0" />
                <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
                  Android Teilen-Menü & Deep-Link
                </h2>
              </div>

              <div className="space-y-2.5 text-[13px] text-[var(--text-secondary)] leading-relaxed">
                <p>
                  <strong className="text-[var(--text-primary)] font-medium">
                    1. Android Share-Target (ACTION_SEND):
                  </strong>{' '}
                  Sobald KADENZ als App installiert ist, erscheint sie im Android-Teilen-Menü für
                  Textantworten aus Gemini, ChatGPT oder Claude.
                </p>
                <p>
                  <strong className="text-[var(--text-primary)] font-medium">
                    2. Zwischenablage (1-Tap):
                  </strong>{' '}
                  Antwort kopieren und im Tab <em>Essen</em> auf <em>Zwischenablage</em> tippen —
                  funktioniert offline auf jedem Gerät.
                </p>
                <div className="pt-1 flex items-start gap-2 text-[12px] text-[var(--text-muted)]">
                  <Link2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span className="font-mono break-all">
                    caltrack://log?name=Skyr&amp;kcal=380&amp;p=36&amp;c=42&amp;f=6
                  </span>
                </div>
              </div>
            </div>

            <div className="apple-card p-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-[var(--accent-calories)] shrink-0" />
                <div>
                  <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
                    {t.more.localProcessTitle}
                  </h2>
                  <p className="text-[12.5px] text-[var(--text-secondary)]">
                    Keine Cloud-Konten, keine API-Schlüssel, volle Datenhoheit.
                  </p>
                </div>
              </div>

              <div className="divide-y divide-[var(--border-hairline)]">
                <div className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Smartphone className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
                    <span className="text-[14px] text-[var(--text-primary)]">
                      {t.more.onDeviceRecs}
                    </span>
                  </div>
                  <IOSSwitch
                    checked={aiPrivacy.localRecommendationsOnly}
                    onChange={(v) => updateAIPrivacy({ localRecommendationsOnly: v })}
                    ariaLabel={t.more.onDeviceRecs}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // =====================================================================
  // DEFAULT HUB: MEHR (Clean 3-Group Apple Settings Architecture)
  // =====================================================================
  const connectedCount = connectedSources.filter((s) => s.connected).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-5"
    >
      <header className="pt-1">
        <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight text-[var(--text-primary)]">
          {t.more.title}
        </h1>
        <p className="mt-0.5 text-[14px] text-[var(--text-secondary)]">
          Profil, Datenquellen & App-Einstellungen
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Persönlich & Werkzeuge */}
        <div className="lg:col-span-6 space-y-5">
          {/* Group 1: Persönlich & Verbindungen */}
          <section className="space-y-2">
            <h2 className="px-1 text-[12px] font-medium text-[var(--text-secondary)]">
              Persönlich & Verbindungen
            </h2>
            <div className="apple-card divide-y divide-[var(--border-hairline)] overflow-hidden">
              <motion.button
                type="button"
                whileTap={{ scale: 0.985 }}
                onClick={() => {
                  haptics.tick();
                  onOpenSettings();
                }}
                className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="w-9 h-9 rounded-xl bg-[var(--bg-well)] text-[var(--text-primary)] flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-[var(--text-primary)]">
                      Mein Profil
                    </p>
                    <p className="text-[12px] text-[var(--text-secondary)] tabular-nums truncate">
                      {profile.displayName || 'Profil'} · {getEffectiveAge(profile)}{' '}
                      {ONBOARDING_COPY[locale].ageYearsSuffix} · {profile.weightKg} kg
                      {profile.targetWeightKg && profile.targetWeightKg !== profile.weightKg
                        ? ` → ${profile.targetWeightKg} kg`
                        : ''}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.985 }}
                onClick={() => {
                  haptics.tick();
                  setDetailView('sources');
                }}
                className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="w-9 h-9 rounded-xl bg-[var(--accent-recovery)]/15 text-[var(--accent-recovery)] flex items-center justify-center shrink-0">
                    <Watch className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-[var(--text-primary)]">
                      Datenquellen & Uhren
                    </p>
                    <p className="text-[12px] text-[var(--text-secondary)] truncate">
                      {connectedCount > 0
                        ? `${connectedCount} ${t.more.sourcesSubPrefix}`
                        : 'Health Connect, Apple Health, COROS, Garmin'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.985 }}
                onClick={() => {
                  haptics.tick();
                  setDetailView('aiPrivacy');
                }}
                className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="w-9 h-9 rounded-xl bg-[var(--accent-sleep)]/15 text-[var(--accent-sleep)] flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-[var(--text-primary)]">
                      0 € KI-Import & Privatsphäre
                    </p>
                    <p className="text-[12px] text-[var(--text-secondary)] truncate">
                      Prompt-Vorlage, Teilen-Menü & 100 % lokal
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
              </motion.button>
            </div>
          </section>

          {/* Group 2: Werkzeuge */}
          <section className="space-y-2">
            <h2 className="px-1 text-[12px] font-medium text-[var(--text-secondary)]">
              Werkzeuge & Rückblick
            </h2>
            <div className="apple-card divide-y divide-[var(--border-hairline)] overflow-hidden">
              <motion.button
                type="button"
                whileTap={{ scale: 0.985 }}
                onClick={() => {
                  haptics.tick();
                  setDetailView('healthTrends');
                }}
                className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-white/[0.02]"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="w-9 h-9 rounded-xl bg-[var(--accent-hrv)]/15 text-[var(--accent-hrv)] flex items-center justify-center shrink-0">
                    <Activity className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-[var(--text-primary)]">
                      {t.more.trendsTitle}
                    </p>
                    <p className="text-[12px] text-[var(--text-secondary)] truncate">
                      {t.more.trendsSub}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.985 }}
                onClick={() => {
                  haptics.tick();
                  onOpenBreathwork();
                }}
                className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-white/[0.02]"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="w-9 h-9 rounded-xl bg-[var(--accent-recovery)]/15 text-[var(--accent-recovery)] flex items-center justify-center shrink-0">
                    <Wind className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-[var(--text-primary)]">
                      {t.more.breathworkTitle}
                    </p>
                    <p className="text-[12px] text-[var(--text-secondary)] truncate">
                      {t.more.breathworkSub}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.985 }}
                onClick={() => {
                  haptics.tick();
                  onOpenJournal();
                }}
                className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-white/[0.02]"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="w-9 h-9 rounded-xl bg-[var(--accent-calories)]/15 text-[var(--accent-calories)] flex items-center justify-center shrink-0">
                    <NotebookPen className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-[var(--text-primary)]">
                      {t.more.journalTitle}
                    </p>
                    <p className="text-[12px] text-[var(--text-secondary)] truncate">
                      {t.more.journalSub}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
              </motion.button>
            </div>
          </section>
        </div>

        {/* Right Column: Darstellung & Datensicherung */}
        <div className="lg:col-span-6 space-y-5">
          {/* Group 3: App & Darstellung */}
          <section className="space-y-2">
            <h2 className="px-1 text-[12px] font-medium text-[var(--text-secondary)]">
              Darstellung & Bedienung
            </h2>
            <div className="apple-card p-5 space-y-4">
              <div className="space-y-2">
                <p className="text-[13.5px] font-medium text-[var(--text-primary)]">
                  {t.more.appearanceTitle}
                </p>
                <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-[var(--bg-well)] p-1">
                  {(
                    [
                      { id: 'dark', label: t.more.themeDark, icon: Moon },
                      { id: 'light', label: t.more.themeLight, icon: Sun },
                      { id: 'system', label: t.more.themeSystem, icon: Monitor },
                    ] as {
                      id: ThemePreference;
                      label: string;
                      icon: React.FC<{ className?: string }>;
                    }[]
                  ).map((item) => {
                    const Icon = item.icon;
                    const active = theme === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (!active) {
                            haptics.selection();
                            setTheme(item.id);
                          }
                        }}
                        className={`relative min-h-[38px] rounded-[13px] flex items-center justify-center gap-2 text-xs font-medium transition-colors ${
                          active
                            ? 'text-[var(--bg-canvas)]'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {active && (
                          <motion.span
                            layoutId="themeModePill"
                            transition={SNAPPY_SPRING}
                            className="absolute inset-0 rounded-[13px] bg-[var(--text-primary)]"
                          />
                        )}
                        <Icon className="w-3.5 h-3.5 relative z-10" />
                        <span className="relative z-10">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border-hairline)] space-y-2">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[var(--text-secondary)]" />
                  <p className="text-[13.5px] font-medium text-[var(--text-primary)]">
                    {t.more.languageLabel}
                  </p>
                </div>
                <div
                  className="grid grid-cols-5 gap-1 rounded-2xl bg-[var(--bg-well)] p-1"
                  role="radiogroup"
                  aria-label={t.more.languageLabel}
                >
                  {SUPPORTED_LOCALES.map((loc) => {
                    const active = locale === loc.id;
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        title={loc.nativeName}
                        onClick={() => {
                          if (!active) {
                            haptics.selection();
                            setLocale(loc.id);
                          }
                        }}
                        className={`relative min-h-[36px] rounded-[12px] flex items-center justify-center text-[12px] font-semibold transition-colors ${
                          active
                            ? 'text-[var(--bg-canvas)]'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {active && (
                          <motion.span
                            layoutId="localeModePill"
                            transition={SNAPPY_SPRING}
                            className="absolute inset-0 rounded-[12px] bg-[var(--text-primary)]"
                          />
                        )}
                        <span className="relative z-10">{loc.shortCode}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Vibrate className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium text-[var(--text-primary)]">
                      {t.more.hapticsTitle}
                    </p>
                    <p className="text-[11.5px] text-[var(--text-secondary)] truncate">
                      Sanftes Feedback beim Tippen
                    </p>
                  </div>
                </div>
                <IOSSwitch
                  checked={hapticsOn}
                  onChange={handleToggleHaptics}
                  ariaLabel={t.more.hapticsTitle}
                />
              </div>
            </div>
          </section>

          {/* Group 4: App & Datensicherung */}
          <section className="space-y-2">
            <h2 className="px-1 text-[12px] font-medium text-[var(--text-secondary)]">
              App & Datensicherung (100 % lokal)
            </h2>
            <div className="apple-card p-5 space-y-3.5">
              <PWAInstallButton />

              <div className="grid grid-cols-3 gap-2 pt-1">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={handleExportBackup}
                  className="min-h-[40px] rounded-2xl bg-[var(--bg-well)] hover:bg-[var(--bg-elevated)] text-xs font-medium text-[var(--text-primary)] inline-flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t.more.exportBtn}</span>
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    haptics.tick();
                    jsonBackupInputRef.current?.click();
                  }}
                  className="min-h-[40px] rounded-2xl bg-[var(--bg-well)] hover:bg-[var(--bg-elevated)] text-xs font-medium text-[var(--text-primary)] inline-flex items-center justify-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{t.more.importBtn}</span>
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    haptics.warning();
                    setConfirmReset(true);
                  }}
                  className="min-h-[40px] rounded-2xl bg-[var(--accent-strain)]/12 text-[var(--accent-strain)] text-xs font-medium inline-flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t.more.resetBtn}</span>
                </motion.button>
              </div>

              {confirmReset && (
                <div className="rounded-2xl bg-[var(--accent-strain)]/10 border border-[var(--accent-strain)]/25 p-3.5 space-y-2.5 text-xs">
                  <p className="font-medium text-[var(--text-primary)]">
                    Alle lokalen Daten auf diesem Gerät wirklich löschen?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmReset(false);
                        resetAllData();
                      }}
                      className="min-h-[34px] px-3.5 rounded-xl bg-[var(--accent-strain)] text-white font-semibold"
                    >
                      Ja, löschen
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="min-h-[34px] px-3.5 rounded-xl bg-[var(--bg-well)] text-[var(--text-primary)] font-medium"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}

              <input
                ref={jsonBackupInputRef}
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
};
