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
  const [hapticsOn, setHapticsOn] = useState<boolean>(() => isHapticsEnabled());
  const [importProvider, setImportProvider] = useState<DeviceProviderId>('coros');
  const healthFileInputRef = useRef<HTMLInputElement | null>(null);
  const jsonBackupInputRef = useRef<HTMLInputElement | null>(null);

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
      const text = await file.text();
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.gpx')) {
        const res = parseGpxFile(text, importProvider, profile);
        await importExternalHealthFile(res);
      } else if (lower.endsWith('.tcx')) {
        const res = parseTcxFile(text, importProvider, profile);
        await importExternalHealthFile(res);
      } else if (lower.endsWith('.xml')) {
        const res = parseAppleHealthXml(text, profile);
        await importExternalHealthFile(res);
      } else if (lower.endsWith('.json')) {
        const res = parseHealthConnectJson(text, profile);
        await importExternalHealthFile(res);
      } else {
        showToast('Unterstützte Formate: .gpx, .tcx, Apple Health .xml, Health Connect .json', 'warning');
      }
    } catch {
      showToast('Datei konnte nicht gelesen werden. Bitte Format prüfen.', 'warning');
    } finally {
      e.target.value = '';
    }
  };

  const handleExportBackup = () => {
    haptics.success();
    const payload = exportAllAsJson();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kadenz-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
  // SUB-VIEW 1: DATENQUELLEN (Exact Match to IMG-20261121-WA0010)
  // =====================================================================
  if (detailView === 'sources') {
    const sourceIcon = (id: DeviceProviderId) => {
      if (id === 'health_connect') return <Heart className="w-5 h-5 text-[var(--text-primary)]" />;
      if (id === 'coros') return <Watch className="w-5 h-5 text-[var(--text-primary)]" />;
      if (id === 'garmin') return <Triangle className="w-5 h-5 text-[var(--text-primary)] fill-current" />;
      if (id === 'polar') return <CircleDot className="w-5 h-5 text-[var(--text-primary)]" />;
      return <Heart className="w-5 h-5 text-[var(--text-primary)]" />;
    };

    const ORDER: DeviceProviderId[] = ['health_connect', 'coros', 'garmin', 'polar', 'apple_health'];
    const primarySources = ORDER.map((id) =>
      connectedSources.find((s) => s.providerId === id)
    ).filter((s): s is NonNullable<typeof s> => Boolean(s));

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
            {t.more.sourcesDesc}
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
                const isApple = src.providerId === 'apple_health';
                return (
                  <div
                    key={src.providerId}
                    className="apple-card px-4 py-3.5 flex items-center justify-between gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (isApple) {
                          setImportProvider('apple_health');
                          healthFileInputRef.current?.click();
                        } else if (src.connected) {
                          simulateProviderSync(src.providerId);
                        } else {
                          connectSimulatedProvider(src.providerId);
                        }
                      }}
                      className="flex-1 flex items-center gap-3.5 text-left min-w-0"
                    >
                      <span className="w-10 h-10 rounded-xl bg-[var(--bg-well)] flex items-center justify-center shrink-0">
                        {sourceIcon(src.providerId)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[15.5px] font-semibold text-[var(--text-primary)] truncate">
                          {src.name}
                        </p>
                        {src.connected ? (
                          <p className="mt-0.5 inline-flex items-center gap-1.5 text-[12.5px] text-[var(--text-secondary)]">
                            <span className="w-2 h-2 rounded-full bg-[var(--accent-recovery)]" />
                            <span>{t.more.connected}</span>
                          </p>
                        ) : src.comingSoon ? (
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
                      {src.connected && (
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
                        onClick={() => {
                          if (isApple) {
                            setImportProvider('apple_health');
                            healthFileInputRef.current?.click();
                          } else if (src.connected) {
                            simulateProviderSync(src.providerId);
                          } else {
                            connectSimulatedProvider(src.providerId);
                          }
                        }}
                        className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Einstellungen + Real Offene Datei-Schnittstellen */}
          <div className="lg:col-span-5 space-y-5">
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
                        {t.more.bgSyncSub}
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
                    {t.more.openImportSub}
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
                accept=".gpx,.tcx,.xml,.json"
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
      try {
        await navigator.clipboard.writeText(promptTemplate);
        haptics.success();
        setPromptCopied(true);
        showToast('0 € KI-Prompt in die Zwischenablage kopiert.', 'success');
        window.setTimeout(() => setPromptCopied(false), 2400);
      } catch {
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
