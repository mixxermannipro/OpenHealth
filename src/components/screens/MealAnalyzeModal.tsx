import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Camera,
  ScanLine,
  Mic,
  MicOff,
  ScanBarcode,
  Search,
  Cpu,
  Plus,
  Minus,
  Trash2,
  Loader2,
  Upload,
  Check,
  Utensils,
  Clock,
} from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';
import { MealCategory, MealFoodItem } from '../../types/health';
import { useHealthStore } from '../../store/useHealthStore';
import { buildMealEntryFromItems } from '../../engine/nutrition';
import {
  FoodSearchResult,
  foodResultToMealItem,
  lookupBarcodeOpenFoodFacts,
  searchLocalFoods,
  searchOpenFoodFacts,
} from '../../services/openFoodFacts';
import {
  AI_PROVIDER_LABELS,
  AIAnalysisProgress,
  analyzeMealWithAI,
} from '../../services/aiNutrition';
import { AnimatedNumber } from '../ui/MotionPrimitives';
import { formatNumberDE } from '../../utils/formatters';

export type MealModalMode = 'ai' | 'voice' | 'barcode' | 'search';

interface MealAnalyzeModalProps {
  open: boolean;
  initialMode: MealModalMode;
  initialCategory?: MealCategory;
  onClose: () => void;
}

const DEFAULT_DEMO_ITEMS: MealFoodItem[] = [
  {
    id: 'demo_oats',
    name: 'Haferflocken',
    grams: 80,
    calories: 304,
    proteinG: 10.8,
    carbsG: 47.0,
    fatG: 5.6,
    fiberG: 8.0,
    source: 'ai',
  },
  {
    id: 'demo_blueberries',
    name: 'Blaubeeren',
    grams: 60,
    calories: 34,
    proteinG: 0.4,
    carbsG: 8.7,
    fatG: 0.2,
    fiberG: 1.4,
    source: 'ai',
  },
  {
    id: 'demo_yogurt',
    name: 'Griechischer Joghurt',
    grams: 150,
    calories: 135,
    proteinG: 13.5,
    carbsG: 5.4,
    fatG: 7.5,
    fiberG: 0,
    source: 'ai',
  },
];

const DEFAULT_PREVIEW_PHOTO = '/src/assets/images/meal_oatmeal_berries_1795248984774.jpg';

const CATEGORY_OPTIONS: { id: MealCategory; label: string }[] = [
  { id: 'breakfast', label: 'Frühstück' },
  { id: 'lunch', label: 'Mittag' },
  { id: 'dinner', label: 'Abend' },
  { id: 'snack', label: 'Snack' },
];

export const MealAnalyzeModal: React.FC<MealAnalyzeModalProps> = ({
  open,
  initialMode,
  initialCategory,
  onClose,
}) => {
  const { selectedDate, meals, aiPrivacy, addMealEntry, setDetailView, setActiveTab } =
    useHealthStore();

  const [mode, setMode] = useState<MealModalMode>(initialMode);
  const [category, setCategory] = useState<MealCategory>('breakfast');
  const [previewPhoto, setPreviewPhoto] = useState<string>(DEFAULT_PREVIEW_PHOTO);
  const [uploadedPhotoDataUrl, setUploadedPhotoDataUrl] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<MealFoodItem[]>(DEFAULT_DEMO_ITEMS);
  const [editingItems, setEditingItems] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<AIAnalysisProgress | null>(null);
  const analysisAbortRef = useRef<AbortController | null>(null);
  const [statusNote, setStatusNote] = useState<string>('Analyse mit deinem eigenen API-Key');
  const [errorText, setErrorText] = useState<string | null>(null);

  // Voice state
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  // Barcode state
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeBusy, setBarcodeBusy] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Search + Manual Quick-Calorie state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>(() => searchLocalFoods(''));
  const [searching, setSearching] = useState(false);
  const [remoteUsed, setRemoteUsed] = useState(false);
  const [showQuickManual, setShowQuickManual] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualKcal, setManualKcal] = useState('');
  const [manualProtein, setManualProtein] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Recent unique meal items for 1-tap MyFitnessPal/Yazio repeat
  const recentQuickItems = useMemo(() => {
    const seen = new Set<string>();
    const out: MealFoodItem[] = [];
    for (const m of meals) {
      for (const item of m.items) {
        const key = item.name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          out.push(item);
        }
        if (out.length >= 5) return out;
      }
    }
    return out;
  }, [meals]);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setErrorText(null);
      setEditingItems(false);
      setShowQuickManual(false);
      setAnalysisProgress(null);
      if (initialCategory) {
        setCategory(initialCategory);
      } else {
        const hour = new Date().getHours();
        setCategory(hour < 11 ? 'breakfast' : hour < 15 ? 'lunch' : hour < 18 ? 'snack' : 'dinner');
      }
    } else {
      analysisAbortRef.current?.abort();
      analysisAbortRef.current = null;
      stopCamera();
      stopVoice();
    }
  }, [open, initialMode, initialCategory]);

  // Escape key & body scroll lock
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    return () => {
      stopCamera();
      stopVoice();
    };
  }, []);

  // Debounced live Open Food Facts search
  useEffect(() => {
    if (!open || mode !== 'search') return;
    const handle = window.setTimeout(async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults(searchLocalFoods(searchQuery));
        setRemoteUsed(false);
        return;
      }
      setSearching(true);
      const res = await searchOpenFoodFacts(searchQuery);
      setSearchResults(res.results);
      setRemoteUsed(res.remoteUsed);
      setSearching(false);
    }, 320);
    return () => window.clearTimeout(handle);
  }, [searchQuery, open, mode]);

  const totals = useMemo(() => {
    const kcal = Math.round(items.reduce((a, i) => a + i.calories, 0));
    const protein = Math.round(items.reduce((a, i) => a + i.proteinG, 0));
    const carbs = Math.round(items.reduce((a, i) => a + i.carbsG, 0));
    const fat = Math.round(items.reduce((a, i) => a + i.fatG, 0));
    return { kcal, protein, carbs, fat };
  }, [items]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const stopVoice = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setListening(false);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPreviewPhoto(reader.result);
        setUploadedPhotoDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const cancelAIAnalysis = () => {
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    setAnalyzing(false);
    setAnalysisProgress(null);
  };

  const runAIAnalysis = async (customText?: string) => {
    const textToUse = customText !== undefined ? customText : description;
    analysisAbortRef.current?.abort();
    const controller = new AbortController();
    analysisAbortRef.current = controller;

    setAnalyzing(true);
    setErrorText(null);
    setAnalysisProgress({
      percent: 8,
      stage: 'preparing',
      label: uploadedPhotoDataUrl ? 'Foto wird vorbereitet…' : 'Analyse startet…',
      detail: hasKey ? AI_PROVIDER_LABELS[aiPrivacy.provider] : 'Lokale Erkennung',
      isLiveStream: hasKey,
    });
    try {
      const result = await analyzeMealWithAI({
        description: textToUse,
        imageDataUrl: uploadedPhotoDataUrl,
        settings: aiPrivacy,
        signal: controller.signal,
        onProgress: (p) => setAnalysisProgress(p),
      });
      setItems(result.items);
      setStatusNote(result.note || result.providerLabel);
      triggerHaptic('success');
      window.setTimeout(() => {
        setAnalysisProgress((curr) => (curr?.stage === 'done' ? null : curr));
      }, 1400);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setAnalysisProgress(null);
      } else {
        setAnalysisProgress(null);
        setErrorText(err instanceof Error ? err.message : 'Analyse fehlgeschlagen.');
      }
    } finally {
      if (analysisAbortRef.current === controller) {
        analysisAbortRef.current = null;
      }
      setAnalyzing(false);
    }
  };

  const toggleVoiceInput = () => {
    if (listening) {
      stopVoice();
      return;
    }
    const SpeechRec =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

    if (!SpeechRec) {
      setErrorText(
        'Spracherkennung wird in diesem Browser nicht unterstützt. Tippe deine Mahlzeit einfach ins Textfeld.'
      );
      return;
    }

    setErrorText(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new (SpeechRec as any)();
    rec.lang = 'de-DE';
    rec.interimResults = true;
    rec.continuous = false;

    rec.onresult = (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
      const text = Array.from(event.results)
        .map((r) => r[0]?.transcript || '')
        .join(' ')
        .trim();
      setDescription(text);
    };
    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    rec.onerror = () => {
      setListening(false);
      setErrorText('Mikrofon-Zugriff wurde abgelehnt oder unterbrochen.');
    };

    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  const handleBarcodeLookup = async (codeOverride?: string) => {
    const code = (codeOverride ?? barcodeInput).trim();
    if (!code) return;
    setBarcodeBusy(true);
    setErrorText(null);
    const product = await lookupBarcodeOpenFoodFacts(code);
    setBarcodeBusy(false);

    if (!product) {
      setErrorText(`Kein Produkt für Barcode „${code}“ in Open Food Facts gefunden.`);
      return;
    }
    const newItem = foodResultToMealItem(product, product.defaultGrams);
    setItems((prev) => [newItem, ...prev.filter((i) => !i.id.startsWith('demo_'))]);
    if (product.imageUrl) setPreviewPhoto(product.imageUrl);
    setStatusNote(`Open Food Facts · Barcode ${code}`);
  };

  const startLiveBarcodeCamera = async () => {
    setErrorText(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorText('Kamera-API nicht verfügbar. Bitte Barcode direkt eingeben.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const DetectorCtor = (window as unknown as Record<string, unknown>).BarcodeDetector;
      if (!DetectorCtor) {
        setErrorText(
          'Kamera aktiv — Browser unterstützt keinen nativen BarcodeDetector. Bitte EAN unten eingeben.'
        );
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detector = new (DetectorCtor as any)({ formats: ['ean_13', 'ean_8', 'upc_a'] });
      const scanLoop = async () => {
        if (!streamRef.current || !videoRef.current) return;
        try {
          const found = await detector.detect(videoRef.current);
          if (found.length > 0 && found[0].rawValue) {
            const code = String(found[0].rawValue);
            setBarcodeInput(code);
            stopCamera();
            await handleBarcodeLookup(code);
            return;
          }
        } catch {
          // keep scanning
        }
        if (streamRef.current) requestAnimationFrame(scanLoop);
      };
      requestAnimationFrame(scanLoop);
    } catch {
      setErrorText('Kamera-Zugriff nicht möglich — nutze die EAN-Eingabe oder Beispiel-Barcodes.');
    }
  };

  const adjustItemGrams = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextGrams = Math.max(10, item.grams + delta);
        const factor = nextGrams / Math.max(1, item.grams);
        return {
          ...item,
          grams: nextGrams,
          calories: Math.round(item.calories * factor),
          proteinG: Number((item.proteinG * factor).toFixed(1)),
          carbsG: Number((item.carbsG * factor).toFixed(1)),
          fatG: Number((item.fatG * factor).toFixed(1)),
          fiberG: Number((item.fiberG * factor).toFixed(1)),
        };
      })
    );
  };

  const addSearchResultToTray = (res: FoodSearchResult) => {
    const item = foodResultToMealItem(res, res.defaultGrams);
    setItems((prev) => [item, ...prev.filter((i) => !i.id.startsWith('demo_'))]);
    setStatusNote(
      res.source === 'openfoodfacts'
        ? 'Aus Open Food Facts übernommen'
        : 'Aus lokaler DACH/BLS-Datenbank übernommen'
    );
  };

  const addRecentItemToTray = (recent: MealFoodItem) => {
    const cloned: MealFoodItem = { ...recent, id: `recent_${Date.now()}` };
    setItems((prev) => [cloned, ...prev.filter((i) => !i.id.startsWith('demo_'))]);
    setStatusNote('Aus „Zuletzt gegessen“ übernommen');
  };

  const handleAddQuickManual = () => {
    const kcal = Math.max(1, Math.round(Number(manualKcal) || 0));
    const name = manualName.trim() || 'Schnell-Eintrag';
    if (!kcal) return;
    const proteinG = Math.max(0, Number(manualProtein) || 0);
    const remainingKcal = Math.max(0, kcal - proteinG * 4);
    const carbsG = Math.round((remainingKcal * 0.55) / 4);
    const fatG = Math.round((remainingKcal * 0.45) / 9);
    const customItem: MealFoodItem = {
      id: `manual_${Date.now()}`,
      name,
      grams: 100,
      calories: kcal,
      proteinG,
      carbsG,
      fatG,
      fiberG: 2,
      source: 'manual',
    };
    setItems((prev) => [customItem, ...prev.filter((i) => !i.id.startsWith('demo_'))]);
    setManualName('');
    setManualKcal('');
    setManualProtein('');
    setShowQuickManual(false);
    setStatusNote('Manueller Schnell-Eintrag');
  };

  const handleSaveMeal = async () => {
    if (items.length === 0) return;
    const entry = buildMealEntryFromItems({
      date: selectedDate,
      category,
      items,
      imageUrl: mode === 'ai' ? previewPhoto : undefined,
      analysisNote: statusNote,
    });
    await addMealEntry(entry);
    triggerHaptic('success');
    setItems(DEFAULT_DEMO_ITEMS);
    setDescription('');
    setUploadedPhotoDataUrl(null);
    setPreviewPhoto(DEFAULT_PREVIEW_PHOTO);
    setStatusNote('Analyse mit deinem eigenen API-Key');
    onClose();
  };

  const hasKey = aiPrivacy.provider === 'ollama' || aiPrivacy.apiKey.trim().length > 6;

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Mahlzeit analysieren"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-md"
          />

          <motion.div
            initial={{ y: 44, opacity: 0, scale: 0.985 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 44, opacity: 0, scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 370, damping: 33 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 95 || info.velocity.y > 500) {
                triggerHaptic('tick');
                onClose();
              }
            }}
            className="relative z-10 w-full sm:max-w-[500px] max-h-[92dvh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-primary)] p-5 pb-7 space-y-4 shadow-2xl"
          >
            <div className="sm:hidden flex justify-center -mt-2 pb-0.5 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1 rounded-full bg-black/15 dark:bg-white/25" />
            </div>
            {/* Header matching IMG-20261121-WA0011 */}
            <div className="relative text-center pt-1">
              <h2 className="text-[22px] font-bold tracking-tight text-[var(--text-primary)]">
                Mahlzeit erfassen
              </h2>
              <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
                Foto, Sprache, Barcode oder Open Food Facts
              </p>
              <button
                type="button"
                onClick={onClose}
                aria-label="Schließen"
                className="absolute right-0 top-0 w-9 h-9 rounded-full bg-[var(--bg-well)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 4-Mode Pill Switcher with sliding spring capsule */}
            <div className="grid grid-cols-4 gap-1 p-1 rounded-full bg-[var(--bg-well)]">
              {(
                [
                  { id: 'ai', label: 'KI Foto', icon: Camera },
                  { id: 'voice', label: 'Sprache', icon: Mic },
                  { id: 'barcode', label: 'Barcode', icon: ScanBarcode },
                  { id: 'search', label: 'Suche', icon: Search },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = mode === tab.id;
                return (
                  <motion.button
                    key={tab.id}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      triggerHaptic('selection');
                      setMode(tab.id);
                      if (tab.id !== 'barcode') stopCamera();
                    }}
                    className={`relative min-h-[36px] rounded-full flex items-center justify-center gap-1.5 text-[11.5px] font-medium transition-colors ${
                      active
                        ? 'text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="mealModalModePill"
                        transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                        className="absolute inset-0 rounded-full bg-[var(--bg-surface)] shadow-sm"
                      />
                    )}
                    <Icon className="relative z-10 w-3.5 h-3.5" />
                    <span className="relative z-10">{tab.label}</span>
                  </motion.button>
                );
              })}
            </div>

            {/* MODE 1: KI Foto & Beschreibung */}
            {mode === 'ai' && (
              <div className="space-y-3">
                <div className="relative rounded-[20px] overflow-hidden border border-[var(--border-hairline)] bg-[var(--bg-surface)] aspect-[16/10]">
                  <img
                    src={previewPhoto}
                    alt="Mahlzeit Vorschau"
                    referrerPolicy="no-referrer"
                    className={`w-full h-full object-cover transition-all duration-300 ${
                      analyzing ? 'scale-[1.03] brightness-75' : 'scale-100 brightness-100'
                    }`}
                  />
                  <span className="pointer-events-none absolute top-3.5 left-3.5 w-6 h-6 border-t-[2.5px] border-l-[2.5px] border-white/90 rounded-tl-lg" />
                  <span className="pointer-events-none absolute top-3.5 right-3.5 w-6 h-6 border-t-[2.5px] border-r-[2.5px] border-white/90 rounded-tr-lg" />
                  <span className="pointer-events-none absolute bottom-3.5 left-3.5 w-6 h-6 border-b-[2.5px] border-l-[2.5px] border-white/90 rounded-bl-lg" />
                  <span className="pointer-events-none absolute bottom-3.5 right-3.5 w-6 h-6 border-b-[2.5px] border-r-[2.5px] border-white/90 rounded-br-lg" />

                  {/* Live Animated AI Scan Beam Overlay */}
                  <AnimatePresence>
                    {analyzing && (
                      <motion.div
                        key="ai-scan-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="pointer-events-none absolute inset-0"
                      >
                        <motion.div
                          initial={{ y: '-10%' }}
                          animate={{ y: ['0%', '92%', '0%'] }}
                          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                          className="absolute inset-x-3 h-[2px] rounded-full bg-[#F5B82E] shadow-[0_0_18px_4px_rgba(245,184,46,0.75)]"
                        />
                        {analysisProgress && (
                          <div className="absolute top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-black/75 backdrop-blur-md border border-white/15 px-3.5 py-1 flex items-center gap-2 text-[11.5px] font-medium text-white whitespace-nowrap">
                            <Loader2 className="w-3.5 h-3.5 text-[#F5B82E] animate-spin shrink-0" />
                            <span>{analysisProgress.percent} %</span>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {!analyzing && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap inline-flex items-center gap-1.5 rounded-full bg-black/65 backdrop-blur-md border border-white/15 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-black/80 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5 shrink-0" />
                      Foto wählen / aufnehmen
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional beschreiben: z. B. 80g Haferflocken, 150g Skyr"
                    className="flex-1 min-h-[42px] rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] px-3.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--text-secondary)]"
                  />
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    disabled={analyzing}
                    onClick={() => runAIAnalysis()}
                    className="min-h-[42px] px-4 rounded-2xl bg-[#F5B82E] text-[#111215] text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 hover:brightness-105 disabled:opacity-60"
                  >
                    {analyzing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ScanLine className="w-3.5 h-3.5" />
                    )}
                    Analysieren
                  </motion.button>
                </div>
              </div>
            )}

            {/* MODE 2: Spracheingabe */}
            {mode === 'voice' && (
              <div className="rounded-[20px] bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-4 space-y-3 text-center">
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  aria-label={listening ? 'Aufnahme stoppen' : 'Spracheingabe starten'}
                  className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                    listening
                      ? 'bg-[#FB7B6B] text-white shadow-[0_0_0_10px_rgba(251,123,107,0.2)]'
                      : 'bg-[var(--accent-sleep)]/20 text-[var(--accent-sleep)] hover:bg-[var(--accent-sleep)]/30'
                  }`}
                >
                  {listening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
                </button>
                <p className="text-xs text-[var(--text-secondary)]">
                  {listening
                    ? 'Ich höre zu (Deutsch) — sprich deine Mahlzeit ein…'
                    : 'Tippen und sprechen, z. B. „200g Hähnchenbrust, 200g Reis und Avocado“'}
                </p>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Gesprochener oder getippter Text erscheint hier…"
                  className="w-full rounded-xl bg-[var(--bg-well)] border border-[var(--border-hairline)] p-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                />
                <button
                  type="button"
                  disabled={analyzing || !description.trim()}
                  onClick={() => runAIAnalysis()}
                  className="w-full min-h-[40px] rounded-full bg-[var(--accent-sleep)] text-[#090A0C] text-xs font-semibold disabled:opacity-50"
                >
                  {analyzing ? 'Analysiere…' : 'Gesprochene Mahlzeit berechnen'}
                </button>
              </div>
            )}

            {/* MODE 3: Barcode Scanner + Open Food Facts v2 */}
            {mode === 'barcode' && (
              <div className="rounded-[20px] bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-4 space-y-3">
                {cameraActive ? (
                  <div className="relative rounded-2xl overflow-hidden aspect-[16/9] bg-black">
                    <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="absolute top-2.5 right-2.5 rounded-full bg-black/70 px-3 py-1 text-xs text-white"
                    >
                      Kamera stoppen
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={startLiveBarcodeCamera}
                    className="w-full min-h-[42px] rounded-2xl bg-[var(--bg-well)] hover:bg-[var(--bg-elevated)] text-xs font-medium text-[var(--text-primary)] inline-flex items-center justify-center gap-2"
                  >
                    <ScanBarcode className="w-4 h-4 text-[var(--accent-calories)]" />
                    Live-Barcode-Kamera starten
                  </button>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="EAN-Barcode eingeben (z. B. 4000417025005)"
                    className="flex-1 min-h-[40px] rounded-xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                  />
                  <button
                    type="button"
                    disabled={barcodeBusy}
                    onClick={() => handleBarcodeLookup()}
                    className="min-h-[40px] px-4 rounded-xl bg-[#F5B82E] text-[#111215] text-xs font-semibold shrink-0"
                  >
                    {barcodeBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Suchen'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    { code: '4000417025005', label: 'Kölln Haferflocken' },
                    { code: '4311501645512', label: 'Skyr Natur' },
                    { code: '4008400404127', label: 'Protein Pudding' },
                  ].map((s) => (
                    <button
                      key={s.code}
                      type="button"
                      onClick={() => {
                        setBarcodeInput(s.code);
                        handleBarcodeLookup(s.code);
                      }}
                      className="rounded-full bg-[var(--bg-well)] hover:bg-[var(--bg-elevated)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* MODE 4: Manuelle Suche (Open Food Facts + Offline BLS + Zuletzt + Schnell-Kalorien) */}
            {mode === 'search' && (
              <div className="rounded-[20px] bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-4 space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Lebensmittel suchen (Open Food Facts + BLS)…"
                      className="w-full min-h-[40px] rounded-xl bg-[var(--bg-well)] border border-[var(--border-hairline)] pl-10 pr-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowQuickManual((s) => !s)}
                    className="shrink-0 min-h-[40px] px-3 rounded-xl bg-[var(--bg-well)] hover:bg-[var(--bg-elevated)] text-[11.5px] font-medium text-[var(--text-primary)]"
                  >
                    {showQuickManual ? 'Zurück' : '+ Frei'}
                  </button>
                </div>

                {showQuickManual ? (
                  <div className="space-y-2.5 pt-1">
                    <input
                      type="text"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="Name (z. B. Proteinriegel)"
                      className="w-full min-h-[38px] rounded-xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-3 text-xs text-[var(--text-primary)]"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        inputMode="numeric"
                        value={manualKcal}
                        onChange={(e) => setManualKcal(e.target.value)}
                        placeholder="Kalorien (kcal)"
                        className="min-h-[38px] rounded-xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-3 text-xs text-[var(--text-primary)]"
                      />
                      <input
                        type="number"
                        inputMode="numeric"
                        value={manualProtein}
                        onChange={(e) => setManualProtein(e.target.value)}
                        placeholder="Protein (g, optional)"
                        className="min-h-[38px] rounded-xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-3 text-xs text-[var(--text-primary)]"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={!manualKcal}
                      onClick={handleAddQuickManual}
                      className="w-full min-h-[38px] rounded-full bg-[var(--text-primary)] text-[var(--bg-canvas)] text-xs font-semibold disabled:opacity-40"
                    >
                      Zur Mahlzeit hinzufügen
                    </button>
                  </div>
                ) : (
                  <>
                    {/* 1-Tap Zuletzt gegessen chips */}
                    {recentQuickItems.length > 0 && !searchQuery.trim() && (
                      <div className="space-y-1.5">
                        <p className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted)]">
                          <Clock className="w-3 h-3" />
                          Zuletzt gegessen
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {recentQuickItems.map((ri) => (
                            <button
                              key={ri.id}
                              type="button"
                              onClick={() => addRecentItemToTray(ri)}
                              className="rounded-full bg-[var(--bg-well)] hover:bg-[var(--bg-elevated)] px-2.5 py-1 text-[11px] text-[var(--text-primary)] inline-flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3 text-[var(--accent-calories)]" />
                              <span>{ri.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="max-h-40 overflow-y-auto divide-y divide-[var(--border-hairline)]">
                      {searching && (
                        <div className="py-3 text-center text-xs text-[var(--text-secondary)] inline-flex items-center gap-2 w-full justify-center">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Suche in Open Food Facts…
                        </div>
                      )}
                      {searchResults.slice(0, 8).map((res) => (
                        <div
                          key={res.id}
                          className="py-2 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-[var(--text-primary)] truncate">
                              {res.name}
                            </p>
                            <p className="text-[11px] text-[var(--text-muted)] truncate">
                              {res.brand || 'BLS'} · {res.kcalPer100g} kcal/100g · P{' '}
                              {res.proteinPer100g}g
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => addSearchResultToTray(res)}
                            className="shrink-0 min-h-[30px] px-2.5 rounded-full bg-[var(--bg-well)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] inline-flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            {res.defaultGrams}g
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {remoteUsed
                        ? 'Live-Ergebnisse aus Open Food Facts + lokaler DACH-Datenbank.'
                        : 'Sofortsuche aus lokaler BLS/DACH-Datenbank (Open Food Facts ab 2 Zeichen).'}
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Live AI Analysis Progress Bar (0 % -> 100 % with live API streaming feedback) */}
            <AnimatePresence>
              {analysisProgress && (
                <motion.div
                  key="ai-progress-card"
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  role="progressbar"
                  aria-valuenow={analysisProgress.percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="KI-Analyse Fortschritt"
                  className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-3.5 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-semibold text-[var(--text-primary)] truncate">
                        {analysisProgress.label}
                      </p>
                      {analysisProgress.detail && (
                        <p className="text-[11px] text-[var(--text-muted)] truncate">
                          {analysisProgress.detail}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[13px] font-bold tabular-nums text-[var(--accent-calories)]">
                        {analysisProgress.percent} %
                      </span>
                      {analyzing && (
                        <button
                          type="button"
                          onClick={cancelAIAnalysis}
                          className="text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-0.5 rounded-full bg-[var(--bg-well)]"
                        >
                          Stopp
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="h-[6px] w-full rounded-full bg-[var(--bg-well)] overflow-hidden">
                    <motion.div
                      initial={{ width: '6%' }}
                      animate={{ width: `${analysisProgress.percent}%` }}
                      transition={{ type: 'spring', stiffness: 140, damping: 24 }}
                      className="h-full rounded-full"
                      style={{
                        background:
                          analysisProgress.stage === 'done'
                            ? 'var(--accent-recovery)'
                            : 'linear-gradient(90deg, #F5B82E 0%, #5CE17C 100%)',
                      }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {errorText && (
              <div className="rounded-2xl bg-[var(--accent-strain)]/12 border border-[var(--accent-strain)]/30 px-3.5 py-2.5 text-xs text-[var(--accent-strain)]">
                {errorText}
              </div>
            )}

            {/* KI-Schätzung / Zusammenfassung Card */}
            <div className="rounded-[22px] bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-4 space-y-3">
              <div className="space-y-2.5">
                <div>
                  <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">
                    {mode === 'ai' ? 'KI-Schätzung' : 'Deine Mahlzeit'}
                  </h3>
                  <p className="text-[12px] text-[var(--text-secondary)]">
                    Erkannte Lebensmittel und Mengen
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {CATEGORY_OPTIONS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.id)}
                      className={`min-h-[30px] px-2 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
                        category === c.id
                          ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)] font-semibold'
                          : 'bg-[var(--bg-well)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-[var(--border-hairline)]">
                {items.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-10 h-10 rounded-xl bg-[var(--bg-well)] border border-[var(--border-hairline)] flex items-center justify-center shrink-0 overflow-hidden">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Utensils className="w-4 h-4 text-[var(--accent-calories)]" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[14.5px] font-medium text-[var(--text-primary)] truncate">
                          {item.name}
                        </p>
                        {editingItems && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => adjustItemGrams(item.id, -20)}
                              aria-label="Menge verringern"
                              className="w-6 h-6 rounded-full bg-[var(--bg-well)] flex items-center justify-center text-[var(--text-primary)]"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustItemGrams(item.id, 20)}
                              aria-label="Menge erhöhen"
                              className="w-6 h-6 rounded-full bg-[var(--bg-well)] flex items-center justify-center text-[var(--text-primary)]"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setItems((p) => p.filter((x) => x.id !== item.id))}
                              aria-label="Entfernen"
                              className="w-6 h-6 rounded-full bg-[var(--accent-strain)]/20 text-[var(--accent-strain)] flex items-center justify-center ml-1"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0 tabular-nums">
                      <p className="text-[14px] font-medium text-[var(--text-primary)]">
                        {item.grams} g
                      </p>
                      <p className="text-[12px] text-[var(--text-secondary)]">
                        {item.calories} kcal
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Gesamt Row with editorial serif total */}
              <div className="pt-2 border-t border-[var(--border-hairline)] flex items-baseline justify-between">
                <div>
                  <span className="text-[15px] text-[var(--text-secondary)]">Gesamt</span>
                  <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                    P {totals.protein}g · K {totals.carbs}g · F {totals.fat}g
                  </p>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <AnimatedNumber
                    value={totals.kcal}
                    className="serif-metric text-[40px] font-medium leading-none text-[var(--text-primary)]"
                  />
                  <span className="text-[15px] text-[var(--text-secondary)]">kcal</span>
                </div>
              </div>

              {/* API-Key attribution footer */}
              <div className="pt-2 border-t border-[var(--border-hairline)] flex items-center justify-between gap-2 text-[11.5px] text-[var(--text-secondary)]">
                <div className="flex items-center gap-2 min-w-0">
                  <Cpu className="w-3.5 h-3.5 shrink-0 text-[var(--text-muted)]" />
                  <span className="truncate">
                    {hasKey
                      ? `${AI_PROVIDER_LABELS[aiPrivacy.provider]} · Eigener API-Key`
                      : statusNote}
                  </span>
                </div>
                {!hasKey && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      setActiveTab('more');
                      setDetailView('aiPrivacy');
                    }}
                    className="shrink-0 text-[var(--accent-recovery)] font-medium hover:underline"
                  >
                    Key einrichten
                  </button>
                )}
              </div>
            </div>

            {/* Primary CTA ("Übernehmen") + "Bearbeiten" */}
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                disabled={items.length === 0}
                onClick={handleSaveMeal}
                className="w-full min-h-[50px] rounded-full bg-[var(--text-primary)] text-[var(--bg-canvas)] text-[15px] font-semibold hover:opacity-92 transition-opacity disabled:opacity-40 inline-flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Übernehmen
              </button>
              <button
                type="button"
                onClick={() => setEditingItems((e) => !e)}
                className="w-full py-1.5 text-center text-[13.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                {editingItems ? 'Fertig bearbeiten' : 'Bearbeiten'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
