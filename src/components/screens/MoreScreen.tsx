import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronRight,
  ChevronLeft,
  Watch,
  Heart,
  Shield,
  Sparkles,
  KeyRound,
  Eye,
  EyeOff,
  Smartphone,
  Image as ImageIcon,
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
  Check,
  Triangle,
  CircleDot,
  Cpu,
  Bot,
  GitFork,
  Terminal,
  Vibrate,
} from 'lucide-react';
import {
  AIProviderId,
  DemoScenarioId,
  DeviceProviderId,
  ThemePreference,
} from '../../types/health';
import { useHealthStore } from '../../store/useHealthStore';
import {
  parseAppleHealthXml,
  parseGpxFile,
  parseHealthConnectJson,
  parseTcxFile,
} from '../../providers/fileImporters';
import { de } from '../../i18n/de';
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

const AI_PROVIDERS: {
  id: AIProviderId;
  label: string;
  placeholder: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  { id: 'gemini', label: 'Google Gemini', placeholder: 'AIzaSy…', icon: Sparkles },
  { id: 'claude', label: 'Anthropic Claude', placeholder: 'sk-ant-…', icon: Bot },
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-proj-…', icon: Cpu },
  { id: 'openrouter', label: 'OpenRouter', placeholder: 'sk-or-v1-…', icon: GitFork },
  { id: 'ollama', label: 'Ollama, lokal', placeholder: 'Kein Schlüssel nötig', icon: Terminal },
];

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
    scenarioId,
    switchScenario,
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
  } = useHealthStore();

  const [showApiKey, setShowApiKey] = useState(false);
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
      await importFromJson(parsed);
    } catch {
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
            <span>Datenquellen</span>
          </button>

          <h1 className="font-editorial text-[42px] sm:text-[48px] font-medium leading-[1.06] text-[var(--text-primary)]">
            Deine Daten.
            <br />
            Dein Gerät.
          </h1>
          <p className="text-[14.5px] leading-relaxed text-[var(--text-secondary)] max-w-md">
            Verbinde deine Quellen und behalte die Kontrolle über deine Daten — auf deinem Gerät.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Verbundene Quellen */}
          <div className="lg:col-span-7 space-y-2.5">
            <p className="px-1 text-[13px] font-medium text-[var(--text-secondary)]">
              Verbundene Quellen
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
                            <span>Verbunden</span>
                          </p>
                        ) : src.comingSoon ? (
                          <p className="mt-0.5 inline-flex items-center gap-1.5 text-[12.5px] text-[var(--text-muted)]">
                            <Clock className="w-3.5 h-3.5" />
                            <span>XML-Import bereit</span>
                          </p>
                        ) : (
                          <p className="mt-0.5 inline-flex items-center gap-1.5 text-[12.5px] text-[var(--text-secondary)]">
                            <PlusCircle className="w-3.5 h-3.5" />
                            <span>Hinzufügen</span>
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
                          Trennen
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
                Einstellungen
              </p>

              <div className="space-y-2.5">
                <div className="apple-card px-4 py-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Settings className="w-5 h-5 text-[var(--text-secondary)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[14.5px] font-semibold text-[var(--text-primary)]">
                        Lokale Verarbeitung
                      </p>
                      <p className="text-[12px] text-[var(--text-secondary)]">
                        Deine Daten bleiben auf diesem Gerät.
                      </p>
                    </div>
                  </div>
                  <IOSSwitch
                    checked={aiPrivacy.localProcessingOnly}
                    onChange={(v) => updateAIPrivacy({ localProcessingOnly: v })}
                    ariaLabel="Lokale Verarbeitung umschalten"
                  />
                </div>

                <div className="apple-card px-4 py-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <RefreshCw className="w-5 h-5 text-[var(--text-secondary)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[14.5px] font-semibold text-[var(--text-primary)]">
                        Im Hintergrund synchronisieren
                      </p>
                      <p className="text-[12px] text-[var(--text-secondary)]">
                        Daten automatisch aktuell halten.
                      </p>
                    </div>
                  </div>
                  <IOSSwitch
                    checked={aiPrivacy.backgroundSync}
                    onChange={(v) => updateAIPrivacy({ backgroundSync: v })}
                    ariaLabel="Hintergrund-Synchronisierung umschalten"
                  />
                </div>
              </div>
            </div>

            {/* Open Standards File Importer (.gpx, .tcx, Apple Health export.xml, Health Connect JSON) */}
            <div className="apple-card p-4 space-y-3">
              <div className="flex items-center gap-2.5">
                <Upload className="w-4 h-4 text-[var(--accent-recovery)] shrink-0" />
                <div>
                  <p className="text-[14px] font-semibold text-[var(--text-primary)]">
                    Offener Datei-Import (100 % lokal)
                  </p>
                  <p className="text-[11.5px] text-[var(--text-secondary)]">
                    Importiere echte Exporte von COROS, Garmin, Polar, Suunto (.gpx, .tcx), Apple
                    Health (.xml) oder Health Connect (.json).
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => healthFileInputRef.current?.click()}
                className="w-full min-h-[42px] rounded-full bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--text-primary)] hover:border-white/20 transition-colors"
              >
                Datei auswählen (.gpx · .tcx · .xml · .json)
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
  // SUB-VIEW 2: KI UND PRIVATSPHÄRE (Exact Match to IMG-20261121-WA0015)
  // =====================================================================
  if (detailView === 'aiPrivacy') {
    const selectedProviderMeta =
      AI_PROVIDERS.find((p) => p.id === aiPrivacy.provider) ?? AI_PROVIDERS[0];

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
            <span>Mehr</span>
          </button>
          <h1 className="text-[30px] font-bold tracking-tight text-[var(--text-primary)] leading-tight">
            KI und Privatsphäre
          </h1>
          <p className="text-[14.5px] text-[var(--text-secondary)] max-w-lg">
            Lege fest, welchen KI-Anbieter du nutzen möchtest und wie deine Daten verarbeitet
            werden.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* KI-Anbieter Card */}
          <div className="lg:col-span-6 apple-card p-5 space-y-3">
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">KI-Anbieter</h2>
              <p className="text-[12.5px] text-[var(--text-secondary)]">
                Wähle deinen bevorzugten Anbieter.
              </p>
            </div>

            <div className="divide-y divide-[var(--border-hairline)]">
              {AI_PROVIDERS.map((prov) => {
                const Icon = prov.icon;
                const active = aiPrivacy.provider === prov.id;
                return (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => {
                      haptics.selection();
                      updateAIPrivacy({ provider: prov.id });
                    }}
                    className="w-full py-3.5 flex items-center gap-3.5 text-left group"
                  >
                    <span
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        active
                          ? 'border-[var(--text-primary)]'
                          : 'border-[var(--text-muted)]/60 group-hover:border-[var(--text-secondary)]'
                      }`}
                    >
                      {active && (
                        <span className="w-2.5 h-2.5 rounded-full bg-[var(--text-primary)]" />
                      )}
                    </span>
                    <Icon className="w-5 h-5 text-[var(--text-primary)] shrink-0" />
                    <span className="text-[15px] font-medium text-[var(--text-primary)]">
                      {prov.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* API-Schlüssel + Lokal verarbeiten */}
          <div className="lg:col-span-6 space-y-4">
            <div className="apple-card p-5 space-y-3">
              <div>
                <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
                  {aiPrivacy.provider === 'ollama' ? 'Lokaler Ollama-Endpunkt' : 'API-Schlüssel'}
                </h2>
                <p className="text-[12.5px] text-[var(--text-secondary)]">
                  {aiPrivacy.provider === 'ollama'
                    ? 'Verbindet sich direkt mit deinem lokalen Ollama-Server — komplett offline.'
                    : 'Dein API-Schlüssel wird sicher auf diesem Gerät gespeichert.'}
                </p>
              </div>

              {aiPrivacy.provider === 'ollama' ? (
                <div className="space-y-2.5">
                  <input
                    type="url"
                    value={aiPrivacy.ollamaUrl}
                    onChange={(e) => updateAIPrivacy({ ollamaUrl: e.target.value })}
                    placeholder="http://localhost:11434"
                    className="w-full min-h-[46px] rounded-2xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-4 text-sm text-[var(--text-primary)] focus:outline-none focus:border-white/25"
                  />
                  <input
                    type="text"
                    value={aiPrivacy.ollamaModel}
                    onChange={(e) => updateAIPrivacy({ ollamaModel: e.target.value })}
                    placeholder="llava oder llama3.2-vision"
                    className="w-full min-h-[46px] rounded-2xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-4 text-sm text-[var(--text-primary)] focus:outline-none focus:border-white/25"
                  />
                </div>
              ) : (
                <div className="relative flex items-center">
                  <KeyRound className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 pointer-events-none" />
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={aiPrivacy.apiKey}
                    onChange={(e) => updateAIPrivacy({ apiKey: e.target.value })}
                    placeholder={selectedProviderMeta.placeholder}
                    autoComplete="off"
                    className="w-full min-h-[46px] rounded-2xl bg-[var(--bg-well)] border border-[var(--border-hairline)] pl-10 pr-11 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-white/25"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey((s) => !s)}
                    aria-label={showApiKey ? 'Schlüssel verbergen' : 'Schlüssel anzeigen'}
                    className="absolute right-2.5 w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    {showApiKey ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
              )}

              <p className="text-[12px] text-[var(--text-muted)]">
                Der Schlüssel bleibt auf deinem Gerät (IndexedDB) und wird nur bei einer Analyse
                direkt an {selectedProviderMeta.label} gesendet.
              </p>
            </div>

            {/* Lokal verarbeiten Card matching bottom of IMG-20261121-WA0015 */}
            <div className="apple-card p-5 space-y-3">
              <div>
                <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
                  Lokal verarbeiten
                </h2>
                <p className="text-[12.5px] text-[var(--text-secondary)]">
                  Steuere, welche Daten auf deinem Gerät bleiben.
                </p>
              </div>

              <div className="divide-y divide-[var(--border-hairline)]">
                <div className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Smartphone className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
                    <span className="text-[14px] text-[var(--text-primary)]">
                      Empfehlungen auf dem Gerät
                    </span>
                  </div>
                  <IOSSwitch
                    checked={aiPrivacy.localRecommendationsOnly}
                    onChange={(v) => updateAIPrivacy({ localRecommendationsOnly: v })}
                    ariaLabel="Empfehlungen auf dem Gerät umschalten"
                  />
                </div>

                <div className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <ImageIcon className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
                    <span className="text-[14px] text-[var(--text-primary)]">
                      Fotos nur auf Anfrage senden
                    </span>
                  </div>
                  <IOSSwitch
                    checked={aiPrivacy.sendPhotosOnDemandOnly}
                    onChange={(v) => updateAIPrivacy({ sendPhotosOnDemandOnly: v })}
                    ariaLabel="Fotos nur auf Anfrage senden umschalten"
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
  // DEFAULT HUB: MEHR
  // =====================================================================
  const connectedCount = connectedSources.filter((s) => s.connected).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-5"
    >
      <header className="pt-1">
        <h1 className="text-[30px] font-bold tracking-tight text-[var(--text-primary)]">Mehr</h1>
        <p className="mt-0.5 text-[14.5px] text-[var(--text-secondary)]">
          Datenquellen, Privatsphäre, Profil &amp; lokale Steuerung
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: Primary Navigation Rows */}
        <div className="lg:col-span-6 space-y-4">
          <div className="apple-card divide-y divide-[var(--border-hairline)] overflow-hidden">
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
                <span className="w-10 h-10 rounded-xl bg-[var(--accent-recovery)]/15 text-[var(--accent-recovery)] flex items-center justify-center shrink-0">
                  <Watch className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[15.5px] font-semibold text-[var(--text-primary)]">
                    Datenquellen
                  </p>
                  <p className="text-[12.5px] text-[var(--text-secondary)]">
                    {connectedCount} verbunden · Health Connect, COROS, Garmin, GPX/TCX
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
                <span className="w-10 h-10 rounded-xl bg-[var(--accent-sleep)]/15 text-[var(--accent-sleep)] flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[15.5px] font-semibold text-[var(--text-primary)]">
                    KI und Privatsphäre
                  </p>
                  <p className="text-[12.5px] text-[var(--text-secondary)]">
                    Eigener API-Key (Gemini, Claude, OpenAI, Ollama) · 100 % lokal
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
                setDetailView('healthTrends');
              }}
              className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <span className="w-10 h-10 rounded-xl bg-[var(--accent-hrv)]/15 text-[var(--accent-hrv)] flex items-center justify-center shrink-0">
                  <Activity className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[15.5px] font-semibold text-[var(--text-primary)]">
                    Körper &amp; Langzeit-Trends
                  </p>
                  <p className="text-[12.5px] text-[var(--text-secondary)]">
                    VO2max, Gewicht, Korrelationen &amp; 6-Monats-Verlauf
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
            </motion.button>
          </div>

          {/* Tools & Profile */}
          <div className="apple-card divide-y divide-[var(--border-hairline)] overflow-hidden">
            <motion.button
              type="button"
              whileTap={{ scale: 0.985 }}
              onClick={() => {
                haptics.tick();
                onOpenBreathwork();
              }}
              className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-white/[0.02]"
            >
              <div className="flex items-center gap-3.5">
                <span className="w-9 h-9 rounded-xl bg-[var(--accent-recovery)]/15 text-[var(--accent-recovery)] flex items-center justify-center">
                  <Wind className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-[var(--text-primary)]">
                    HRV-Resonanzatmung
                  </p>
                  <p className="text-[12px] text-[var(--text-secondary)]">
                    5,5 s Biofeedback &amp; 4-7-8 Einschlaf-Timer
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
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
              <div className="flex items-center gap-3.5">
                <span className="w-9 h-9 rounded-xl bg-[var(--accent-calories)]/15 text-[var(--accent-calories)] flex items-center justify-center">
                  <NotebookPen className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-[var(--text-primary)]">
                    Tagebuch Check-in
                  </p>
                  <p className="text-[12px] text-[var(--text-secondary)]">
                    Stress, Muskelkater, Koffein &amp; Stimmung erfassen
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.985 }}
              onClick={() => {
                haptics.tick();
                onOpenSettings();
              }}
              className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-white/[0.02]"
            >
              <div className="flex items-center gap-3.5">
                <span className="w-9 h-9 rounded-xl bg-[var(--bg-well)] text-[var(--text-primary)] flex items-center justify-center">
                  <User className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-[var(--text-primary)]">
                    Profil &amp; persönliche Ziele
                  </p>
                  <p className="text-[12px] text-[var(--text-secondary)]">
                    {profile.displayName} · {profile.age} J. · {profile.weightKg} kg · {profile.heightCm} cm
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
            </motion.button>
          </div>
        </div>

        {/* Right Column: Appearance & Haptics, Demo Scenario & Local JSON Backup */}
        <div className="lg:col-span-6 space-y-4">
          {/* Appearance & Haptic Feedback */}
          <div className="apple-card p-5 space-y-4">
            <div className="space-y-2.5">
              <p className="text-[14px] font-semibold text-[var(--text-primary)]">
                Erscheinungsbild &amp; Haptik
              </p>
              <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-[var(--bg-well)] p-1">
                {(
                  [
                    { id: 'dark', label: 'Dunkel', icon: Moon },
                    { id: 'light', label: 'Hell', icon: Sun },
                    { id: 'system', label: 'System', icon: Monitor },
                  ] as {
                    id: ThemePreference;
                    label: string;
                    icon: React.FC<{ className?: string }>;
                  }[]
                ).map((t) => {
                  const Icon = t.icon;
                  const active = theme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        if (!active) {
                          haptics.selection();
                          setTheme(t.id);
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
                      <span className="relative z-10">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-8 h-8 rounded-xl bg-[var(--bg-well)] text-[var(--text-secondary)] flex items-center justify-center shrink-0">
                  <Vibrate className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-[var(--text-primary)]">
                    Haptisches Feedback
                  </p>
                  <p className="text-[11.5px] text-[var(--text-secondary)]">
                    Dezente Vibration bei Gesten, Check-in &amp; Speichern
                  </p>
                </div>
              </div>
              <IOSSwitch
                checked={hapticsOn}
                onChange={handleToggleHaptics}
                ariaLabel="Haptisches Feedback umschalten"
              />
            </div>
          </div>

          {/* Demo Scenario Switcher */}
          <div className="apple-card p-5 space-y-3">
            <div>
              <p className="text-[14px] font-semibold text-[var(--text-primary)]">
                Daten-Szenario testen
              </p>
              <p className="text-[12px] text-[var(--text-secondary)]">
                Prüfe live, wie Erholung, Belastung &amp; Empfehlungen auf verschiedene Zustände
                reagieren.
              </p>
            </div>
            <div className="space-y-2">
              {(['balanced', 'fatigued', 'recovering'] as DemoScenarioId[]).map((id) => {
                const sc = de.scenarios[id];
                const active = scenarioId === id;
                return (
                  <motion.button
                    key={id}
                    type="button"
                    whileTap={{ scale: 0.985 }}
                    onClick={() => {
                      haptics.selection();
                      switchScenario(id);
                    }}
                    className={`w-full p-3 rounded-2xl flex items-center justify-between gap-3 text-left transition-colors ${
                      active
                        ? 'bg-[var(--accent-recovery)]/14 border border-[var(--accent-recovery)]/35'
                        : 'bg-[var(--bg-well)] border border-transparent hover:border-[var(--border-hairline)]'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-[var(--text-primary)]">
                        {sc.label}
                      </p>
                      <p className="text-[11.5px] text-[var(--text-secondary)] truncate">
                        {sc.description}
                      </p>
                    </div>
                    {active && <Check className="w-4 h-4 text-[var(--accent-recovery)] shrink-0" />}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Play Store / Homescreen PWA Installation & Offline Readiness */}
          <div className="apple-card p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[14px] font-semibold text-[var(--text-primary)]">
                  App installieren &amp; Offline-Modus
                </p>
                <p className="text-[12px] text-[var(--text-secondary)]">
                  Funktioniert komplett lokal ohne Konto — installierbar auf Android, iOS &amp; Desktop.
                </p>
              </div>
              <span className="shrink-0 text-[11.5px] font-medium text-[var(--accent-recovery)]">
                Lokal aktiv
              </span>
            </div>
            <PWAInstallButton />
          </div>

          {/* Local Backup Controls */}
          <div className="apple-card p-5 space-y-3">
            <p className="text-[14px] font-semibold text-[var(--text-primary)]">
              Lokaler Speicher (IndexedDB)
            </p>
            <div className="grid grid-cols-3 gap-2">
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={handleExportBackup}
                className="min-h-[40px] rounded-2xl bg-[var(--bg-well)] hover:bg-[var(--bg-elevated)] text-xs font-medium text-[var(--text-primary)] inline-flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Export
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
                Import
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  haptics.warning();
                  resetAllData();
                }}
                className="min-h-[40px] rounded-2xl bg-[var(--accent-strain)]/12 text-[var(--accent-strain)] text-xs font-medium inline-flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </motion.button>
            </div>
            <input
              ref={jsonBackupInputRef}
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
