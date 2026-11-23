import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  Barcode,
  Check,
  CheckCircle2,
  ClipboardPaste,
  Copy,
  Edit3,
  Loader2,
  Search,
  Share2,
  Sparkles,
  Camera,
  CameraOff,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { MealCategory, MealEntry } from '../../types/health';
import { useHealthStore } from '../../store/useHealthStore';
import { computeAtwaterCalories, inferMealCategoryByHour } from '../../engine/nutrition';
import {
  getZeroCostAiPromptTemplate,
  parseAiMealInput,
  ParsedAiMeal,
} from '../../engine/aiMealParser';
import {
  FoodCatalogProduct,
  LOCAL_GERMAN_FOODS,
  lookupBarcodeOpenFoodFacts,
  searchOpenFoodFacts,
} from '../../services/openFoodFacts';
import { IncomingSharePayload } from '../../services/mealShareReceiver';
import {
  ensureNativeCameraPermission,
  readTextFromClipboard,
  writeTextToClipboard,
} from '../../services/androidBridge';
import { BottomSheet } from '../ui/BottomSheet';
import { SNAPPY_SPRING } from '../ui/MotionPrimitives';
import { haptics } from '../../utils/haptics';
import { useI18n } from '../../i18n/useI18n';

export type MealModalMode = 'ai' | 'scan' | 'search' | 'manual';

interface MealAnalyzeModalProps {
  open: boolean;
  initialMode: MealModalMode;
  initialCategory?: MealCategory;
  editingMeal?: MealEntry | null;
  initialSharePayload?: IncomingSharePayload | null;
  onConsumeSharePayload?: () => void;
  onClose: () => void;
}

const SLOTS: MealCategory[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const MealAnalyzeModal: React.FC<MealAnalyzeModalProps> = ({
  open,
  initialMode,
  initialCategory,
  editingMeal,
  initialSharePayload,
  onConsumeSharePayload,
  onClose,
}) => {
  const { selectedDate, addMealEntry, updateMealEntry, showToast } = useHealthStore(
    useShallow((s) => ({
      selectedDate: s.selectedDate,
      addMealEntry: s.addMealEntry,
      updateMealEntry: s.updateMealEntry,
      showToast: s.showToast,
    }))
  );
  const { t, locale } = useI18n();

  const [mode, setMode] = useState<MealModalMode>(initialMode);
  const [category, setCategory] = useState<MealCategory>(
    initialCategory ?? inferMealCategoryByHour()
  );

  // Zero-Cost KI-Import (Share-Intent / Clipboard) state
  const [rawAiInput, setRawAiInput] = useState('');
  const [shareOriginBanner, setShareOriginBanner] = useState<
    'share_intent' | 'deeplink' | 'clipboard' | null
  >(null);
  const [promptCopied, setPromptCopied] = useState(false);
  const [clipboardFeedback, setClipboardFeedback] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftCalories, setDraftCalories] = useState('');
  const [draftProtein, setDraftProtein] = useState('');
  const [draftCarbs, setDraftCarbs] = useState('');
  const [draftFat, setDraftFat] = useState('');
  const [draftFiber, setDraftFiber] = useState('');
  const aiTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Barcode scan state
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [scannedProduct, setScannedProduct] = useState<FoodCatalogProduct | null>(null);
  const [scannedGrams, setScannedGrams] = useState(100);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodCatalogProduct[]>(LOCAL_GERMAN_FOODS);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodCatalogProduct | null>(null);
  const [selectedFoodGrams, setSelectedFoodGrams] = useState(100);

  // Manual entry state
  const [manualName, setManualName] = useState('');
  const [manualKcal, setManualKcal] = useState('');
  const [manualP, setManualP] = useState('');
  const [manualC, setManualC] = useState('');
  const [manualF, setManualF] = useState('');
  const [manualFiber, setManualFiber] = useState('');

  const promptTemplate = useMemo(() => getZeroCostAiPromptTemplate(locale), [locale]);

  const parsedAiResult = useMemo(() => {
    if (!rawAiInput.trim()) return null;
    return parseAiMealInput(rawAiInput);
  }, [rawAiInput]);

  // Reset modal state on open, edit meal, or incoming Share-Intent / Deep-Link
  useEffect(() => {
    if (!open) {
      stopCamera();
      setShareOriginBanner(null);
      return;
    }

    if (editingMeal) {
      setMode('manual');
      setCategory(editingMeal.category);
      setManualName(editingMeal.title);
      setManualKcal(String(editingMeal.totalCalories));
      setManualP(String(editingMeal.proteinG));
      setManualC(String(editingMeal.carbsG));
      setManualF(String(editingMeal.fatG));
      setManualFiber(editingMeal.fiberG !== undefined ? String(editingMeal.fiberG) : '');
    } else if (initialSharePayload?.rawText) {
      setMode('ai');
      setRawAiInput(initialSharePayload.rawText);
      setShareOriginBanner(initialSharePayload.origin);
      setCategory(initialCategory ?? inferMealCategoryByHour());
      onConsumeSharePayload?.();
    } else {
      setMode(initialMode);
      setCategory(initialCategory ?? inferMealCategoryByHour());
      setManualName('');
      setManualKcal('');
      setManualP('');
      setManualC('');
      setManualF('');
      setManualFiber('');
    }
    setClipboardFeedback(null);
    setBarcodeError(null);
    setSelectedFood(null);
    setScannedProduct(null);
  }, [open, initialMode, initialCategory, editingMeal, initialSharePayload, onConsumeSharePayload]);

  // Synchronize editable review fields whenever the parser yields a valid meal
  useEffect(() => {
    if (parsedAiResult && parsedAiResult.ok) {
      const d: ParsedAiMeal = parsedAiResult.data;
      setDraftName(d.meal);
      setDraftCalories(String(d.calories));
      setDraftProtein(String(d.proteinG));
      setDraftCarbs(String(d.carbsG));
      setDraftFat(String(d.fatG));
      setDraftFiber(String(d.fiberG));
      if (d.category && !initialCategory) {
        setCategory(d.category);
      }
    }
  }, [parsedAiResult, initialCategory]);

  // Debounced Open Food Facts search
  useEffect(() => {
    if (mode !== 'search' || !open) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      const list = await searchOpenFoodFacts(searchQuery);
      if (active) {
        setSearchResults(list);
        setSearchLoading(false);
      }
    }, 260);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [searchQuery, mode, open]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (mode !== 'scan') {
      stopCamera();
    }
    return () => stopCamera();
  }, [mode]);

  const handleCopyPrompt = async () => {
    const ok = await writeTextToClipboard(promptTemplate);
    if (ok) {
      haptics.success();
      setPromptCopied(true);
      showToast('KI-Prompt in die Zwischenablage kopiert.', 'success');
      window.setTimeout(() => setPromptCopied(false), 2400);
    } else {
      haptics.tick();
      showToast('Prompt konnte nicht automatisch kopiert werden.', 'warning');
    }
  };

  const handlePasteFromClipboard = async () => {
    setClipboardFeedback(null);
    try {
      const clipText = await readTextFromClipboard();
      if (clipText === null) {
        throw new Error('clipboard_unavailable');
      }
      if (!clipText.trim()) {
        haptics.warning();
        setClipboardFeedback('Zwischenablage ist leer. Kopiere zuerst die Antwort aus deiner KI-App.');
        return;
      }
      haptics.success();
      setRawAiInput(clipText);
      setShareOriginBanner('clipboard');
    } catch {
      haptics.tick();
      setClipboardFeedback(
        'Direkter Zugriff blockiert — tippe in das Textfeld und füge dort ein (Einfügen).'
      );
      aiTextareaRef.current?.focus();
    }
  };

  const handleSaveParsedAiMeal = async () => {
    const cleanTitle = draftName.trim() || 'KI-Mahlzeit';
    const rawKcal = Math.max(0, Math.round(Number(draftCalories) || 0));
    const p = Math.max(0, Math.round(Number(draftProtein) || 0));
    const c = Math.max(0, Math.round(Number(draftCarbs) || 0));
    const f = Math.max(0, Math.round(Number(draftFat) || 0));
    const fib = Math.max(0, Math.round(Number(draftFiber) || 0));
    const kcal = rawKcal > 0 ? rawKcal : computeAtwaterCalories(p, c, f);

    if (kcal <= 0 && p <= 0 && c <= 0 && f <= 0) {
      haptics.warning();
      return;
    }

    const parsedItems =
      parsedAiResult && parsedAiResult.ok && parsedAiResult.data.items.length > 0
        ? parsedAiResult.data.items.map((it, idx) => ({
            id: `ai_item_${Date.now()}_${idx}`,
            name: it.name,
            grams: it.grams,
            calories: it.calories,
            proteinG: it.proteinG,
            carbsG: it.carbsG,
            fatG: it.fatG,
            fiberG: it.fiberG,
            source: 'ai' as const,
          }))
        : [
            {
              id: `ai_item_${Date.now()}`,
              name: cleanTitle,
              grams: 100,
              calories: kcal,
              proteinG: p,
              carbsG: c,
              fatG: f,
              fiberG: fib,
              source: 'ai' as const,
            },
          ];

    const originLabel =
      shareOriginBanner === 'share_intent'
        ? 'Android Teilen · 0 € KI-Import'
        : shareOriginBanner === 'deeplink'
          ? 'Deep-Link · 0 € KI-Import'
          : 'Zwischenablage · 0 € KI-Import';

    const entry: MealEntry = {
      id: `meal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date: selectedDate,
      timestamp: new Date().toISOString(),
      category,
      title: cleanTitle,
      subtitle: `${p}g E · ${c}g KH · ${f}g F`,
      items: parsedItems,
      totalCalories: kcal,
      proteinG: p,
      carbsG: c,
      fatG: f,
      fiberG: fib,
      analysisNote: originLabel,
    };

    haptics.success();
    await addMealEntry(entry);
    setRawAiInput('');
    setShareOriginBanner(null);
    onClose();
  };

  const handleLookupBarcode = async (codeToLookup?: string) => {
    const code = (codeToLookup ?? barcodeInput).replace(/\D/g, '');
    if (code.length < 8) {
      setBarcodeError('Bitte mindestens 8 Ziffern (EAN-8 / EAN-13) eingeben.');
      return;
    }
    setBarcodeLoading(true);
    setBarcodeError(null);
    const product = await lookupBarcodeOpenFoodFacts(code);
    setBarcodeLoading(false);
    if (!product) {
      haptics.warning();
      setBarcodeError('Kein Produkt in Open Food Facts gefunden. Probiere die Suche oder manuelle Eingabe.');
      return;
    }
    haptics.success();
    setScannedProduct(product);
    setScannedGrams(product.defaultGrams);
  };

  const startCameraScanner = async () => {
    setBarcodeError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setBarcodeError(
        'Kamera wird auf diesem Gerät nicht unterstützt — EAN-Nummer einfach unten eingeben.'
      );
      return;
    }

    // On native Android, request CAMERA runtime permission cleanly before opening WebView camera
    const permissionGranted = await ensureNativeCameraPermission();
    if (!permissionGranted) {
      setBarcodeError(
        'Kameraberechtigung verweigert. Du kannst sie in den Android-App-Einstellungen freigeben oder die EAN direkt eingeben.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      // Mount <video> first; the effect below attaches srcObject and starts native BarcodeDetector or ZXing fallback
      setCameraActive(true);
    } catch {
      stopCamera();
      setBarcodeError('Kamerazugriff verweigert. Du kannst die EAN-Nummer direkt eingeben.');
    }
  };

  // Attach acquired MediaStream once <video> has mounted & decode barcodes via native BarcodeDetector or ZXing offline fallback
  useEffect(() => {
    if (!cameraActive || !streamRef.current) return;
    let cancelled = false;
    let rafId = 0;
    let zxingStop: (() => void) | null = null;

    const BarcodeDetectorCtor = (window as unknown as {
      BarcodeDetector?: new (opts: { formats: string[] }) => {
        detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
      };
    }).BarcodeDetector;

    const videoEl = videoRef.current;
    if (!videoEl) return;

    videoEl.srcObject = streamRef.current;
    videoEl.play().catch(() => {});

    const onDetectedCode = async (rawCode: string) => {
      if (cancelled) return;
      const clean = rawCode.replace(/\D/g, '');
      if (clean.length < 8) return;
      cancelled = true;
      zxingStop?.();
      stopCamera();
      setBarcodeInput(clean);
      await handleLookupBarcode(clean);
    };

    if (BarcodeDetectorCtor) {
      const detector = new BarcodeDetectorCtor({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'],
      });

      const scanLoop = async () => {
        if (cancelled || !streamRef.current || !videoRef.current) return;
        try {
          if (videoRef.current.readyState >= 2) {
            const codes = await detector.detect(videoRef.current);
            if (!cancelled && codes.length > 0 && codes[0].rawValue) {
              await onDetectedCode(codes[0].rawValue);
              return;
            }
          }
        } catch {
          // continue scanning frames
        }
        if (!cancelled) {
          rafId = window.requestAnimationFrame(scanLoop);
        }
      };

      rafId = window.requestAnimationFrame(scanLoop);
    } else {
      // Universal Android WebView offline fallback via @zxing/browser (no Google Play Services required)
      (async () => {
        try {
          const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
            import('@zxing/browser'),
            import('@zxing/library'),
          ]);
          if (cancelled || !streamRef.current || !videoRef.current) return;
          const hints = new Map();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E,
            BarcodeFormat.CODE_128,
          ]);
          const reader = new BrowserMultiFormatReader(hints, {
            delayBetweenScanAttempts: 250,
            delayBetweenScanSuccess: 500,
          });
          const controls = await reader.decodeFromStream(
            streamRef.current,
            videoRef.current,
            (result) => {
              if (!cancelled && result?.getText()) {
                onDetectedCode(result.getText());
              }
            }
          );
          zxingStop = () => {
            try {
              controls.stop();
            } catch {
              // ignore cleanup errors
            }
          };
          if (cancelled) {
            zxingStop();
          }
        } catch {
          if (!cancelled) {
            setBarcodeError(
              'Kamera-Scanner konnte nicht gestartet werden — EAN-Nummer einfach unten eingeben.'
            );
            stopCamera();
          }
        }
      })();
    }

    return () => {
      cancelled = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      zxingStop?.();
    };
  }, [cameraActive]);

  const handleSaveCatalogProduct = async (product: FoodCatalogProduct, grams: number) => {
    const safeGrams = Math.max(5, Math.round(grams || product.defaultGrams));
    const factor = safeGrams / 100;
    const kcal = Math.round(product.kcalPer100g * factor);
    const p = Math.round(product.proteinPer100g * factor);
    const c = Math.round(product.carbsPer100g * factor);
    const f = Math.round(product.fatPer100g * factor);
    const fib = Math.round(product.fiberPer100g * factor);

    const entry: MealEntry = {
      id: `meal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date: selectedDate,
      timestamp: new Date().toISOString(),
      category,
      title: product.name,
      subtitle: `${safeGrams} g${product.brand ? ` · ${product.brand}` : ''}`,
      imageUrl: product.imageUrl,
      items: [
        {
          id: `item_${Date.now()}`,
          name: product.name,
          brand: product.brand,
          grams: safeGrams,
          calories: kcal,
          proteinG: p,
          carbsG: c,
          fatG: f,
          fiberG: fib,
          barcode: product.barcode,
          imageUrl: product.imageUrl,
          source: product.source,
        },
      ],
      totalCalories: kcal,
      proteinG: p,
      carbsG: c,
      fatG: f,
      fiberG: fib,
    };

    haptics.success();
    await addMealEntry(entry);
    onClose();
  };

  const manualAutoAtwater = useMemo(
    () =>
      computeAtwaterCalories(
        Number(manualP) || 0,
        Number(manualC) || 0,
        Number(manualF) || 0
      ),
    [manualP, manualC, manualF]
  );

  const handleSaveManual = async () => {
    const rawKcal = Math.max(0, Math.round(Number(manualKcal) || 0));
    const p = Math.max(0, Math.round(Number(manualP) || 0));
    const c = Math.max(0, Math.round(Number(manualC) || 0));
    const f = Math.max(0, Math.round(Number(manualF) || 0));
    const fib = Math.max(0, Math.round(Number(manualFiber) || 0));
    const kcal = rawKcal > 0 ? rawKcal : computeAtwaterCalories(p, c, f);
    const title = manualName.trim() || 'Eigene Mahlzeit';
    if (kcal <= 0 && p <= 0 && c <= 0 && f <= 0) {
      haptics.warning();
      return;
    }

    if (editingMeal) {
      const updated: MealEntry = {
        ...editingMeal,
        category,
        title,
        subtitle: `${p}g E · ${c}g KH · ${f}g F`,
        totalCalories: kcal,
        proteinG: p,
        carbsG: c,
        fatG: f,
        fiberG: fib,
      };
      haptics.success();
      await updateMealEntry(updated);
      onClose();
      return;
    }

    const entry: MealEntry = {
      id: `meal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date: selectedDate,
      timestamp: new Date().toISOString(),
      category,
      title,
      subtitle: `${p}g E · ${c}g KH · ${f}g F`,
      items: [
        {
          id: `manual_${Date.now()}`,
          name: title,
          grams: 100,
          calories: kcal,
          proteinG: p,
          carbsG: c,
          fatG: f,
          fiberG: fib,
          source: 'manual',
        },
      ],
      totalCalories: kcal,
      proteinG: p,
      carbsG: c,
      fatG: f,
      fiberG: fib,
    };

    haptics.success();
    await addMealEntry(entry);
    setManualName('');
    setManualKcal('');
    setManualP('');
    setManualC('');
    setManualF('');
    setManualFiber('');
    onClose();
  };

  const aiCanSave =
    (Number(draftCalories) > 0 ||
      Number(draftProtein) > 0 ||
      Number(draftCarbs) > 0 ||
      Number(draftFat) > 0) &&
    Boolean(parsedAiResult?.ok);

  const tabs: { id: MealModalMode; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'ai', label: 'KI-Import', icon: Sparkles },
    { id: 'scan', label: t.nutrition.scan, icon: Barcode },
    { id: 'search', label: t.nutrition.search, icon: Search },
    { id: 'manual', label: 'Manuell', icon: Edit3 },
  ];

  const slotLabels = t.nutrition.slots;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={
        editingMeal
          ? 'Mahlzeit bearbeiten'
          : mode === 'ai'
            ? '0 € KI-Mahlzeiten-Import'
            : t.nutrition.logMeal
      }
      subtitle={
        editingMeal
          ? 'Kalorien, Makros oder Tageszeit anpassen'
          : mode === 'ai'
            ? 'Teilen-Menü & Zwischenablage · 100 % lokal ohne API-Kosten'
            : 'Open Food Facts, Barcode oder eigene Eingabe'
      }
      maxWidthClass="sm:max-w-xl"
    >
      <div className="space-y-4">
        {/* Mode Switcher (hidden when editing an existing entry) */}
        {!editingMeal && (
        <div
          className="grid grid-cols-4 gap-1 rounded-2xl bg-[var(--bg-well)] p-1"
          role="tablist"
          aria-label="Erfassungsmodus"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = mode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  haptics.selection();
                  setMode(tab.id);
                }}
                className={`relative min-h-[38px] rounded-[13px] flex items-center justify-center gap-1.5 text-[12px] font-medium transition-colors ${
                  active
                    ? 'text-[var(--bg-canvas)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="mealModalModePill"
                    transition={SNAPPY_SPRING}
                    className="absolute inset-0 rounded-[13px] bg-[var(--text-primary)]"
                  />
                )}
                <Icon className="w-3.5 h-3.5 relative z-10 shrink-0" />
                <span className="relative z-10 truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
        )}

        {/* Meal Category Selector */}
        <div className="grid grid-cols-4 gap-1.5">
          {SLOTS.map((slot) => {
            const active = category === slot;
            return (
              <button
                key={slot}
                type="button"
                onClick={() => {
                  haptics.tick();
                  setCategory(slot);
                }}
                className={`min-h-[34px] rounded-xl text-[12px] font-medium border transition-colors ${
                  active
                    ? 'bg-[var(--bg-elevated)] border-white/20 text-[var(--text-primary)]'
                    : 'bg-transparent border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {slotLabels[slot]}
              </button>
            );
          })}
        </div>

        {/* ================================================================ */}
        {/* TAB 1: ZERO-COST KI-IMPORT (ANDROID SHARE-INTENT & CLIPBOARD)    */}
        {/* ================================================================ */}
        {mode === 'ai' && (
          <div className="space-y-4">
            {/* Incoming Share-Intent / Deep-Link Origin Notice */}
            {shareOriginBanner && (
              <div className="rounded-2xl bg-[var(--accent-recovery)]/10 border border-[var(--accent-recovery)]/25 px-3.5 py-2.5 flex items-center gap-2.5 text-[12.5px] text-[var(--text-primary)]">
                <Share2 className="w-4 h-4 text-[var(--accent-recovery)] shrink-0" />
                <span>
                  {shareOriginBanner === 'share_intent'
                    ? 'Direkt über Android „Teilen“ empfangen — kurz prüfen und übernehmen.'
                    : shareOriginBanner === 'deeplink'
                      ? 'Per Deep-Link empfangen — Werte wurden automatisch eingetragen.'
                      : 'Aus der Zwischenablage eingefügt und lokal ausgewertet.'}
                </span>
              </div>
            )}

            {/* Step 1: 1-Tap Prompt Copy Card (compact when already receiving a shared payload) */}
            {!(shareOriginBanner && parsedAiResult?.ok) && (
              <div className="rounded-2xl bg-[var(--bg-well)]/80 border border-[var(--border-hairline)] p-3.5 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                      1. In Gemini, ChatGPT oder Claude schätzen lassen
                    </p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--text-secondary)]">
                      Kopiere den Kurz-Prompt, sende Foto oder Text an deine KI-App und teile die
                      Antwort direkt mit KADENZ oder kopiere sie hierher.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    className="shrink-0 whitespace-nowrap min-h-[36px] px-3 rounded-xl bg-[var(--text-primary)] text-[var(--bg-canvas)] text-[12px] font-semibold inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                  >
                    {promptCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Kopiert</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Prompt</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Parser Status & Live Editable Review (shown prominently when valid) */}
            {parsedAiResult && !parsedAiResult.ok && (
              <div
                role="alert"
                className="rounded-2xl bg-[var(--accent-strain)]/10 border border-[var(--accent-strain)]/25 p-3.5 flex items-start gap-2.5 text-[12.5px] text-[var(--text-primary)]"
              >
                <AlertTriangle className="w-4 h-4 text-[var(--accent-strain)] shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Eingabe nicht erkannt</p>
                  <p className="mt-0.5 text-[var(--text-secondary)]">{parsedAiResult.message}</p>
                </div>
              </div>
            )}

            {parsedAiResult && parsedAiResult.ok && (
              <div className="rounded-2xl bg-[var(--bg-elevated)]/70 border border-[var(--border-hairline)] p-4 space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--accent-recovery)]">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      {parsedAiResult.data.sourceFormat === 'json'
                        ? 'JSON lokal erkannt'
                        : parsedAiResult.data.sourceFormat === 'deeplink'
                          ? 'Deep-Link erkannt'
                          : 'Nährwerte aus Text erkannt'}
                    </span>
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    Direkt bearbeitbar
                  </span>
                </div>

                {parsedAiResult.data.warnings.length > 0 && (
                  <div className="rounded-xl bg-[var(--accent-calories)]/10 border border-[var(--accent-calories)]/25 px-3 py-2 text-[11.5px] text-[var(--text-secondary)] space-y-1">
                    {parsedAiResult.data.warnings.map((w, idx) => (
                      <p key={idx}>{w}</p>
                    ))}
                  </div>
                )}

                <div className="space-y-2.5">
                  <div>
                    <label
                      htmlFor="ai-draft-name"
                      className="block text-[11.5px] text-[var(--text-secondary)] mb-1"
                    >
                      Mahlzeit
                    </label>
                    <input
                      id="ai-draft-name"
                      type="text"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      className="w-full min-h-[42px] rounded-xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-3 text-[14px] font-medium text-[var(--text-primary)] focus:outline-none focus:border-white/25"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <div>
                      <label
                        htmlFor="ai-draft-kcal"
                        className="block text-[11px] text-[var(--text-secondary)] mb-1"
                      >
                        Kalorien
                      </label>
                      <input
                        id="ai-draft-kcal"
                        type="number"
                        min={0}
                        max={8000}
                        value={draftCalories}
                        onChange={(e) => setDraftCalories(e.target.value)}
                        className="w-full min-h-[40px] rounded-xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-2.5 text-[14px] font-semibold tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-white/25"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="ai-draft-protein"
                        className="block text-[11px] text-[var(--text-secondary)] mb-1"
                      >
                        Eiweiß (g)
                      </label>
                      <input
                        id="ai-draft-protein"
                        type="number"
                        min={0}
                        max={600}
                        value={draftProtein}
                        onChange={(e) => setDraftProtein(e.target.value)}
                        className="w-full min-h-[40px] rounded-xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-2.5 text-[14px] font-semibold tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-white/25"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="ai-draft-carbs"
                        className="block text-[11px] text-[var(--text-secondary)] mb-1"
                      >
                        KH (g)
                      </label>
                      <input
                        id="ai-draft-carbs"
                        type="number"
                        min={0}
                        max={600}
                        value={draftCarbs}
                        onChange={(e) => setDraftCarbs(e.target.value)}
                        className="w-full min-h-[40px] rounded-xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-2.5 text-[14px] font-semibold tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-white/25"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="ai-draft-fat"
                        className="block text-[11px] text-[var(--text-secondary)] mb-1"
                      >
                        Fett (g)
                      </label>
                      <input
                        id="ai-draft-fat"
                        type="number"
                        min={0}
                        max={600}
                        value={draftFat}
                        onChange={(e) => setDraftFat(e.target.value)}
                        className="w-full min-h-[40px] rounded-xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-2.5 text-[14px] font-semibold tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-white/25"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label
                        htmlFor="ai-draft-fiber"
                        className="block text-[11px] text-[var(--text-secondary)] mb-1"
                      >
                        Ballastst. (g)
                      </label>
                      <input
                        id="ai-draft-fiber"
                        type="number"
                        min={0}
                        max={150}
                        value={draftFiber}
                        onChange={(e) => setDraftFiber(e.target.value)}
                        className="w-full min-h-[40px] rounded-xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-2.5 text-[14px] font-semibold tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-white/25"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={!aiCanSave}
              onClick={handleSaveParsedAiMeal}
              className="w-full min-h-[48px] rounded-full bg-[var(--text-primary)] text-[var(--bg-canvas)] text-[14.5px] font-semibold disabled:opacity-35 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              Mahlzeit übernehmen
            </button>

            {/* Step 2: Paste from Clipboard + Raw Input Textarea */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="kadenz-ai-import-input"
                  className="text-[12px] font-medium text-[var(--text-secondary)] truncate"
                >
                  {shareOriginBanner && parsedAiResult?.ok
                    ? 'Empfangener Rohtext (bearbeitbar)'
                    : '2. KI-Antwort einfügen (JSON, Text oder Link)'}
                </label>
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="shrink-0 whitespace-nowrap min-h-[34px] px-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-[12px] font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5 hover:border-white/25 transition-colors"
                >
                  <ClipboardPaste className="w-3.5 h-3.5 text-[var(--accent-calories)] shrink-0" />
                  <span>Zwischenablage</span>
                </button>
              </div>

              <textarea
                ref={aiTextareaRef}
                id="kadenz-ai-import-input"
                rows={shareOriginBanner && parsedAiResult?.ok ? 2 : 4}
                value={rawAiInput}
                onChange={(e) => {
                  setRawAiInput(e.target.value);
                  setClipboardFeedback(null);
                }}
                placeholder={`{\n  "meal": "Hähnchenbrust mit Reis",\n  "calories": 540,\n  "protein_g": 55,\n  "carbs_g": 60,\n  "fat_g": 8\n}`}
                className="w-full rounded-2xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-3.5 py-2.5 text-[12.5px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/70 focus:outline-none focus:border-white/25 resize-y"
              />

              {clipboardFeedback && (
                <p className="text-[12px] text-[var(--accent-calories)]">{clipboardFeedback}</p>
              )}
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 2: FREE BARCODE SCANNER (OPEN FOOD FACTS)                    */}
        {/* ================================================================ */}
        {mode === 'scan' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[var(--bg-well)] border border-[var(--border-hairline)] p-4 space-y-3">
              {cameraActive ? (
                <div className="relative overflow-hidden rounded-xl bg-black aspect-video">
                  <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="absolute top-2.5 right-2.5 px-3 py-1.5 rounded-full bg-black/70 text-white text-xs font-medium inline-flex items-center gap-1.5"
                  >
                    <CameraOff className="w-3.5 h-3.5" />
                    <span>Kamera stoppen</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startCameraScanner}
                  className="w-full min-h-[44px] rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-[13px] font-medium text-[var(--text-primary)] inline-flex items-center justify-center gap-2 hover:border-white/20"
                >
                  <Camera className="w-4 h-4 text-[var(--accent-calories)]" />
                  <span>Kamera-Barcode-Scanner starten</span>
                </button>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleLookupBarcode();
                  }}
                  placeholder="EAN-Nummer eingeben (z. B. 4000417025005)"
                  className="flex-1 min-h-[44px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] px-3.5 text-sm tabular-nums text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-white/25"
                />
                <button
                  type="button"
                  disabled={barcodeLoading}
                  onClick={() => handleLookupBarcode()}
                  className="min-h-[44px] px-4 rounded-xl bg-[var(--text-primary)] text-[var(--bg-canvas)] text-sm font-semibold inline-flex items-center gap-1.5"
                >
                  {barcodeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Prüfen'}
                </button>
              </div>

              {barcodeError && (
                <p className="text-[12px] text-[var(--accent-strain)]">{barcodeError}</p>
              )}
            </div>

            {scannedProduct && (
              <ProductGramCard
                product={scannedProduct}
                grams={scannedGrams}
                onChangeGrams={setScannedGrams}
                onSave={() => handleSaveCatalogProduct(scannedProduct, scannedGrams)}
              />
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 3: FREE OPEN FOOD FACTS & LOCAL CATALOG SEARCH               */}
        {/* ================================================================ */}
        {mode === 'search' && (
          <div className="space-y-3.5">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedFood(null);
                }}
                placeholder="Lebensmittel suchen (Open Food Facts + Offline-Basis)…"
                className="w-full min-h-[44px] rounded-2xl bg-[var(--bg-well)] border border-[var(--border-hairline)] pl-10 pr-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-white/25"
              />
              {searchLoading && (
                <Loader2 className="w-4 h-4 animate-spin text-[var(--text-muted)] absolute right-3.5" />
              )}
            </div>

            {selectedFood ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setSelectedFood(null)}
                  className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  ← Zurück zur Ergebnisliste
                </button>
                <ProductGramCard
                  product={selectedFood}
                  grams={selectedFoodGrams}
                  onChangeGrams={setSelectedFoodGrams}
                  onSave={() => handleSaveCatalogProduct(selectedFood, selectedFoodGrams)}
                />
              </div>
            ) : (
              <div className="max-h-[300px] overflow-y-auto divide-y divide-[var(--border-hairline)] rounded-2xl bg-[var(--bg-well)]/60 border border-[var(--border-hairline)]">
                {searchResults.length === 0 ? (
                  <p className="p-4 text-center text-xs text-[var(--text-muted)]">
                    Keine Treffer gefunden.
                  </p>
                ) : (
                  searchResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        haptics.tick();
                        setSelectedFood(item);
                        setSelectedFoodGrams(item.defaultGrams);
                      }}
                      className="w-full px-3.5 py-3 flex items-center justify-between gap-3 text-left hover:bg-white/[0.03] transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-[var(--text-primary)] truncate">
                          {item.name}
                        </p>
                        <p className="text-[11.5px] text-[var(--text-secondary)] tabular-nums">
                          {item.brand ? `${item.brand} · ` : ''}
                          {item.proteinPer100g}g E · {item.carbsPer100g}g KH · {item.fatPer100g}g F
                          {' / 100g'}
                        </p>
                      </div>
                      <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">
                        {item.kcalPer100g} kcal
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 4: QUICK MANUAL ENTRY                                        */}
        {/* ================================================================ */}
        {mode === 'manual' && (
          <div className="space-y-3.5">
            <div>
              <label
                htmlFor="manual-meal-name"
                className="block text-[12px] text-[var(--text-secondary)] mb-1"
              >
                Bezeichnung
              </label>
              <input
                id="manual-meal-name"
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="z. B. Skyr mit Beeren & Haferflocken"
                className="w-full min-h-[44px] rounded-xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-3.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-white/25"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div>
                <label
                  htmlFor="manual-meal-kcal"
                  className="block text-[11px] text-[var(--text-secondary)] mb-1"
                >
                  Kalorien {manualAutoAtwater > 0 && !manualKcal ? '(auto)' : '*'}
                </label>
                <input
                  id="manual-meal-kcal"
                  type="number"
                  min={0}
                  max={8000}
                  value={manualKcal}
                  onChange={(e) => setManualKcal(e.target.value)}
                  placeholder={manualAutoAtwater > 0 ? `≈ ${manualAutoAtwater}` : '480'}
                  className="w-full min-h-[42px] rounded-xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-3 text-sm font-semibold tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-white/25"
                />
              </div>
              <div>
                <label
                  htmlFor="manual-meal-p"
                  className="block text-[11px] text-[var(--text-secondary)] mb-1"
                >
                  Eiweiß (g)
                </label>
                <input
                  id="manual-meal-p"
                  type="number"
                  min={0}
                  max={600}
                  value={manualP}
                  onChange={(e) => setManualP(e.target.value)}
                  placeholder="35"
                  className="w-full min-h-[42px] rounded-xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-3 text-sm tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-white/25"
                />
              </div>
              <div>
                <label
                  htmlFor="manual-meal-c"
                  className="block text-[11px] text-[var(--text-secondary)] mb-1"
                >
                  KH (g)
                </label>
                <input
                  id="manual-meal-c"
                  type="number"
                  min={0}
                  max={600}
                  value={manualC}
                  onChange={(e) => setManualC(e.target.value)}
                  placeholder="52"
                  className="w-full min-h-[42px] rounded-xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-3 text-sm tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-white/25"
                />
              </div>
              <div>
                <label
                  htmlFor="manual-meal-f"
                  className="block text-[11px] text-[var(--text-secondary)] mb-1"
                >
                  Fett (g)
                </label>
                <input
                  id="manual-meal-f"
                  type="number"
                  min={0}
                  max={600}
                  value={manualF}
                  onChange={(e) => setManualF(e.target.value)}
                  placeholder="12"
                  className="w-full min-h-[42px] rounded-xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-3 text-sm tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-white/25"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label
                  htmlFor="manual-meal-fib"
                  className="block text-[11px] text-[var(--text-secondary)] mb-1"
                >
                  Ballastst. (g)
                </label>
                <input
                  id="manual-meal-fib"
                  type="number"
                  min={0}
                  max={150}
                  value={manualFiber}
                  onChange={(e) => setManualFiber(e.target.value)}
                  placeholder="6"
                  className="w-full min-h-[42px] rounded-xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-3 text-sm tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-white/25"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={!(Number(manualKcal) > 0 || Number(manualP) > 0 || Number(manualC) > 0 || Number(manualF) > 0)}
              onClick={handleSaveManual}
              className="w-full min-h-[48px] rounded-full bg-[var(--text-primary)] text-[var(--bg-canvas)] text-[14.5px] font-semibold disabled:opacity-35 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              {editingMeal ? 'Änderungen speichern' : 'Mahlzeit speichern'}
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
};

const ProductGramCard: React.FC<{
  product: FoodCatalogProduct;
  grams: number;
  onChangeGrams: (g: number) => void;
  onSave: () => void;
}> = ({ product, grams, onChangeGrams, onSave }) => {
  const safeGrams = Math.max(5, grams || 100);
  const factor = safeGrams / 100;
  const kcal = Math.round(product.kcalPer100g * factor);
  const p = Math.round(product.proteinPer100g * factor);
  const c = Math.round(product.carbsPer100g * factor);
  const f = Math.round(product.fatPer100g * factor);

  return (
    <div className="rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-hairline)] p-4 space-y-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-[var(--text-primary)] truncate">
            {product.name}
          </p>
          {product.brand && (
            <p className="text-[12px] text-[var(--text-secondary)]">{product.brand}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="serif-metric text-[26px] leading-none text-[var(--text-primary)]">
            {kcal}
          </p>
          <p className="text-[11px] text-[var(--text-muted)]">kcal</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label htmlFor="product-grams" className="text-xs text-[var(--text-secondary)] shrink-0">
          Menge (g)
        </label>
        <input
          id="product-grams"
          type="number"
          min={5}
          max={2000}
          step={5}
          value={grams}
          onChange={(e) => onChangeGrams(Math.max(5, Number(e.target.value) || 0))}
          className="w-24 min-h-[38px] rounded-xl bg-[var(--bg-well)] border border-[var(--border-hairline)] px-3 text-sm font-semibold tabular-nums text-[var(--text-primary)] focus:outline-none focus:border-white/25"
        />
        <div className="flex items-center gap-1.5 flex-wrap">
          {[50, 100, 150, 250].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onChangeGrams(preset)}
              className="px-2.5 py-1 rounded-lg bg-[var(--bg-well)] text-[11px] font-medium tabular-nums text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              {preset}g
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border-hairline)] text-center">
        <div>
          <p className="text-[11px] text-[var(--text-muted)]">Eiweiß</p>
          <p className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">{p} g</p>
        </div>
        <div>
          <p className="text-[11px] text-[var(--text-muted)]">Kohlenhydrate</p>
          <p className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">{c} g</p>
        </div>
        <div>
          <p className="text-[11px] text-[var(--text-muted)]">Fett</p>
          <p className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">{f} g</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onSave}
        className="w-full min-h-[44px] rounded-full bg-[var(--text-primary)] text-[var(--bg-canvas)] text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        Übernehmen ({kcal} kcal)
      </button>
    </div>
  );
};
