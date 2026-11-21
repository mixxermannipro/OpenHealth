import { AIPrivacySettings, AIProviderId, MealFoodItem } from '../types/health';
import { parseNaturalMealTextLocally } from '../engine/nutrition';

export interface AIAnalysisResult {
  items: MealFoodItem[];
  providerLabel: string;
  usedBYOK: boolean;
  note?: string;
}

export type AIAnalysisStage =
  | 'preparing'
  | 'uploading'
  | 'streaming'
  | 'parsing'
  | 'done';

export interface AIAnalysisProgress {
  percent: number;
  stage: AIAnalysisStage;
  label: string;
  detail?: string;
  detectedCount?: number;
  isLiveStream?: boolean;
}

const NUTRITION_SYSTEM_PROMPT = `Du bist ein präziser Ernährungs-Analyst. Analysiere das hochgeladene Mahlzeiten-Foto und/oder die Beschreibung des Nutzers.
Antworte AUSSCHLIESSLICH mit gültigem JSON im folgenden Schema (kein Markdown, kein Fließtext):
{
  "items": [
    {
      "name": "Lebensmittel auf Deutsch",
      "grams": 80,
      "calories": 304,
      "proteinG": 10.8,
      "carbsG": 47.0,
      "fatG": 5.6,
      "fiberG": 8.0
    }
  ]
}
Schätze realistische Portionsgrößen in Gramm und realistische Nährwerte nach BLS/USDA.`;

export const AI_PROVIDER_LABELS: Record<AIProviderId, string> = {
  gemini: 'Google Gemini',
  claude: 'Anthropic Claude',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  ollama: 'Ollama, lokal',
};

/**
 * Pure helper mapping streamed JSON character length & detected item count
 * to an honest, monotonically smooth 28%..90% progress band.
 */
export function estimateStreamProgress(charCount: number, detectedItems: number): number {
  const charContribution = Math.min(48, Math.round((1 - Math.exp(-charCount / 260)) * 52));
  const itemBonus = Math.min(14, detectedItems * 4);
  return Math.max(28, Math.min(90, 28 + charContribution + itemBonus));
}

function countDetectedNames(partialJson: string): number {
  const matches = partialJson.match(/"name"\s*:/g);
  return matches ? matches.length : 0;
}

function extractJsonItems(rawText: string): MealFoodItem[] {
  const cleaned = rawText
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const slice = start !== -1 && end !== -1 ? cleaned.slice(start, end + 1) : cleaned;
  const parsed = JSON.parse(slice) as {
    items?: Array<{
      name?: string;
      grams?: number;
      calories?: number;
      proteinG?: number;
      carbsG?: number;
      fatG?: number;
      fiberG?: number;
    }>;
  };

  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    throw new Error('Keine Lebensmittel in der KI-Antwort erkannt.');
  }

  return parsed.items.map((item, idx) => ({
    id: `ai_item_${Date.now()}_${idx}`,
    name: String(item.name || 'Lebensmittel'),
    grams: Math.max(1, Math.round(Number(item.grams) || 100)),
    calories: Math.max(0, Math.round(Number(item.calories) || 0)),
    proteinG: Math.max(0, Number((Number(item.proteinG) || 0).toFixed(1))),
    carbsG: Math.max(0, Number((Number(item.carbsG) || 0).toFixed(1))),
    fatG: Math.max(0, Number((Number(item.fatG) || 0).toFixed(1))),
    fiberG: Math.max(0, Number((Number(item.fiberG) || 0).toFixed(1))),
    source: 'ai' as const,
  }));
}

function stripDataUrl(dataUrl: string): { mimeType: string; base64: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], base64: match[2] };
  }
  return { mimeType: 'image/jpeg', base64: dataUrl };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Analyse abgebrochen', 'AbortError'));
      return;
    }
    const timer = globalThis.setTimeout(() => resolve(), ms);
    signal?.addEventListener(
      'abort',
      () => {
        globalThis.clearTimeout(timer);
        reject(new DOMException('Analyse abgebrochen', 'AbortError'));
      },
      { once: true }
    );
  });
}

/**
 * Reads an SSE or NDJSON stream from an AI provider and emits live progress updates
 * as chunks arrive in real time.
 */
async function readProviderStream(
  res: Response,
  extractChunkText: (line: string) => string,
  providerLabel: string,
  onProgress?: (p: AIAnalysisProgress) => void
): Promise<string> {
  if (!res.body) {
    return await res.text();
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const chunkText = extractChunkText(line);
      if (chunkText) {
        accumulated += chunkText;
        const detectedCount = countDetectedNames(accumulated);
        const pct = estimateStreamProgress(accumulated.length, detectedCount);
        onProgress?.({
          percent: pct,
          stage: 'streaming',
          label:
            detectedCount > 0
              ? `${detectedCount} ${detectedCount === 1 ? 'Zutat' : 'Zutaten'} erkannt…`
              : 'KI erkennt Zutaten & Portionen…',
          detail: `${providerLabel} · Live-Stream`,
          detectedCount,
          isLiveStream: true,
        });
      }
    }
  }

  if (buffer.trim()) {
    const tail = extractChunkText(buffer.trim());
    if (tail) accumulated += tail;
  }

  return accumulated;
}

/**
 * BYOK Multi-Provider Meal Analyzer with Real-Time Streaming Progress
 * Calls the user's chosen AI provider directly from their device using their locally stored key
 * with real SSE/NDJSON stream progress, or falls back cleanly to on-device German parsing.
 */
export async function analyzeMealWithAI(params: {
  description: string;
  imageDataUrl?: string | null;
  settings: AIPrivacySettings;
  onProgress?: (progress: AIAnalysisProgress) => void;
  signal?: AbortSignal;
}): Promise<AIAnalysisResult> {
  const { description, imageDataUrl, settings, onProgress, signal } = params;
  const trimmedKey = settings.apiKey.trim();
  const providerName = AI_PROVIDER_LABELS[settings.provider];

  const userPrompt = description.trim()
    ? `Beschreibung der Mahlzeit: "${description.trim()}". Zerlege in einzelne Zutaten mit Gramm und Nährwerten.`
    : 'Analysiere diese Mahlzeit auf dem Foto und schätze alle sichtbaren Zutaten, Mengen (g) und Nährwerte.';

  const hasProviderReady = settings.provider === 'ollama' || trimmedKey.length > 6;

  onProgress?.({
    percent: 12,
    stage: 'preparing',
    label: imageDataUrl ? 'Bild wird vorbereitet…' : 'Anfrage wird vorbereitet…',
    detail: hasProviderReady ? providerName : 'Lokale BLS/DACH-Analyse',
    isLiveStream: hasProviderReady,
  });

  if (!hasProviderReady) {
    // Honest on-device parser fallback with responsive staged visual feedback
    await sleep(180, signal);
    onProgress?.({
      percent: 48,
      stage: 'streaming',
      label: imageDataUrl ? 'Mahlzeit wird ausgewertet…' : 'Zutaten & Mengen werden erkannt…',
      detail: 'Lokale Nährwert-Datenbank (ohne API-Key)',
      isLiveStream: false,
    });

    const localItems = parseNaturalMealTextLocally(description);
    await sleep(220, signal);

    if (localItems.length > 0) {
      onProgress?.({
        percent: 90,
        stage: 'parsing',
        label: `${localItems.length} Zutaten abgeglichen · Makros werden summiert…`,
        detail: 'BLS / DACH lokal',
        detectedCount: localItems.length,
        isLiveStream: false,
      });
      await sleep(140, signal);
      onProgress?.({
        percent: 100,
        stage: 'done',
        label: 'Analyse abgeschlossen',
        detail: 'Lokale Nährwert-Erkennung',
        detectedCount: localItems.length,
        isLiveStream: false,
      });
      return {
        items: localItems,
        providerLabel: 'Lokale Nährwert-Erkennung (ohne API-Key)',
        usedBYOK: false,
        note: 'Erkannt aus lokaler BLS/DACH-Datenbank. Für echte Foto-KI eigenen API-Key unter Mehr → KI & Privatsphäre hinterlegen.',
      };
    }

    if (imageDataUrl) {
      onProgress?.({
        percent: 92,
        stage: 'parsing',
        label: 'Vorschau-Nährwerte werden erstellt…',
        detail: 'Kein API-Key hinterlegt',
        detectedCount: 3,
        isLiveStream: false,
      });
      await sleep(150, signal);
      onProgress?.({
        percent: 100,
        stage: 'done',
        label: 'Vorschau bereit',
        detail: 'Für echte Foto-KI eigenen Key hinterlegen',
        detectedCount: 3,
        isLiveStream: false,
      });
      return {
        items: [
          {
            id: `local_demo_oats_${Date.now()}`,
            name: 'Haferflocken',
            grams: 80,
            calories: 304,
            proteinG: 10.8,
            carbsG: 47.0,
            fatG: 5.6,
            fiberG: 8.0,
            source: 'local_db',
          },
          {
            id: `local_demo_berries_${Date.now()}`,
            name: 'Blaubeeren',
            grams: 60,
            calories: 34,
            proteinG: 0.4,
            carbsG: 8.7,
            fatG: 0.2,
            fiberG: 1.4,
            source: 'local_db',
          },
          {
            id: `local_demo_yogurt_${Date.now()}`,
            name: 'Griechischer Joghurt',
            grams: 150,
            calories: 135,
            proteinG: 13.5,
            carbsG: 5.4,
            fatG: 7.5,
            fiberG: 0,
            source: 'local_db',
          },
        ],
        providerLabel: 'Vorschau-Schätzung (Kein API-Key hinterlegt)',
        usedBYOK: false,
        note: 'Hinterlege deinen eigenen API-Key (Gemini, Claude, OpenAI, OpenRouter oder lokales Ollama) unter Mehr → KI & Privatsphäre für echte Foto-KI.',
      };
    }

    throw new Error(
      'Bitte beschreibe deine Mahlzeit (z. B. „80g Haferflocken, 150g Skyr“) oder hinterlege deinen KI-API-Schlüssel unter Mehr → KI & Privatsphäre.'
    );
  }

  onProgress?.({
    percent: 24,
    stage: 'uploading',
    label: `Verbinde mit ${providerName}…`,
    detail: imageDataUrl ? 'Foto & Kontext werden übertragen' : 'Text wird übertragen',
    isLiveStream: true,
  });

  // 1. Google Gemini (BYOK — Real SSE Streaming)
  if (settings.provider === 'gemini') {
    const parts: Array<Record<string, unknown>> = [
      { text: `${NUTRITION_SYSTEM_PROMPT}\n\n${userPrompt}` },
    ];
    if (imageDataUrl) {
      const { mimeType, base64 } = stripDataUrl(imageDataUrl);
      parts.unshift({ inline_data: { mime_type: mimeType, data: base64 } });
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${encodeURIComponent(
        trimmedKey
      )}`,
      {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(
        `Gemini API Fehler (${res.status}): ${errText.slice(0, 140) || 'Bitte API-Schlüssel prüfen.'}`
      );
    }

    const text = await readProviderStream(
      res,
      (line) => {
        if (!line.startsWith('data:')) return '';
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') return '';
        try {
          const obj = JSON.parse(payload) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          return obj.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } catch {
          return '';
        }
      },
      'Google Gemini',
      onProgress
    );

    onProgress?.({
      percent: 95,
      stage: 'parsing',
      label: 'Nährwerte & Portionen werden geprüft…',
      detail: 'Google Gemini · Eigener API-Key',
      isLiveStream: true,
    });
    const items = extractJsonItems(text);
    onProgress?.({
      percent: 100,
      stage: 'done',
      label: `${items.length} Zutaten erkannt`,
      detail: 'Google Gemini · Eigener API-Key',
      detectedCount: items.length,
      isLiveStream: true,
    });
    return {
      items,
      providerLabel: 'Google Gemini · Eigener API-Key',
      usedBYOK: true,
    };
  }

  // 2. Anthropic Claude (BYOK — Real SSE Streaming)
  if (settings.provider === 'claude') {
    const content: Array<Record<string, unknown>> = [];
    if (imageDataUrl) {
      const { mimeType, base64 } = stripDataUrl(imageDataUrl);
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: mimeType, data: base64 },
      });
    }
    content.push({ type: 'text', text: userPrompt });

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': trimmedKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 900,
        stream: true,
        system: NUTRITION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content }],
      }),
    });
    if (!res.ok) {
      throw new Error(`Claude API Fehler (${res.status}). Bitte Schlüssel und Kontingent prüfen.`);
    }

    const text = await readProviderStream(
      res,
      (line) => {
        if (!line.startsWith('data:')) return '';
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') return '';
        try {
          const obj = JSON.parse(payload) as {
            type?: string;
            delta?: { text?: string };
          };
          return obj.type === 'content_block_delta' ? obj.delta?.text || '' : '';
        } catch {
          return '';
        }
      },
      'Anthropic Claude',
      onProgress
    );

    onProgress?.({
      percent: 95,
      stage: 'parsing',
      label: 'Nährwerte & Portionen werden geprüft…',
      detail: 'Anthropic Claude · Eigener API-Key',
      isLiveStream: true,
    });
    const items = extractJsonItems(text);
    onProgress?.({
      percent: 100,
      stage: 'done',
      label: `${items.length} Zutaten erkannt`,
      detail: 'Anthropic Claude · Eigener API-Key',
      detectedCount: items.length,
      isLiveStream: true,
    });
    return {
      items,
      providerLabel: 'Anthropic Claude · Eigener API-Key',
      usedBYOK: true,
    };
  }

  // 3. OpenAI or OpenRouter (BYOK — Real SSE Streaming)
  if (settings.provider === 'openai' || settings.provider === 'openrouter') {
    const endpoint =
      settings.provider === 'openai'
        ? 'https://api.openai.com/v1/chat/completions'
        : 'https://openrouter.ai/api/v1/chat/completions';
    const model = settings.provider === 'openai' ? 'gpt-4o-mini' : 'google/gemini-2.5-flash';

    const userContent: Array<Record<string, unknown>> = [{ type: 'text', text: userPrompt }];
    if (imageDataUrl) {
      userContent.push({ type: 'image_url', image_url: { url: imageDataUrl } });
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${trimmedKey}`,
      },
      body: JSON.stringify({
        model,
        stream: true,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: NUTRITION_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(
        `${AI_PROVIDER_LABELS[settings.provider]} Fehler (${res.status}). Bitte API-Key prüfen.`
      );
    }

    const text = await readProviderStream(
      res,
      (line) => {
        if (!line.startsWith('data:')) return '';
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') return '';
        try {
          const obj = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          return obj.choices?.[0]?.delta?.content || '';
        } catch {
          return '';
        }
      },
      providerName,
      onProgress
    );

    onProgress?.({
      percent: 95,
      stage: 'parsing',
      label: 'Nährwerte & Portionen werden geprüft…',
      detail: `${providerName} · Eigener API-Key`,
      isLiveStream: true,
    });
    const items = extractJsonItems(text);
    onProgress?.({
      percent: 100,
      stage: 'done',
      label: `${items.length} Zutaten erkannt`,
      detail: `${providerName} · Eigener API-Key`,
      detectedCount: items.length,
      isLiveStream: true,
    });
    return {
      items,
      providerLabel: `${AI_PROVIDER_LABELS[settings.provider]} · Eigener API-Key`,
      usedBYOK: true,
    };
  }

  // 4. Ollama Local (100% On-Device — Real NDJSON Streaming)
  const baseUrl = (settings.ollamaUrl || 'http://localhost:11434').replace(/\/$/, '');
  const ollamaModel = settings.ollamaModel || 'llava';
  const payload: Record<string, unknown> = {
    model: ollamaModel,
    stream: true,
    format: 'json',
    messages: [
      { role: 'system', content: NUTRITION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: userPrompt,
        ...(imageDataUrl ? { images: [stripDataUrl(imageDataUrl).base64] } : {}),
      },
    ],
  };

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Lokales Ollama unter ${baseUrl} nicht erreichbar (HTTP ${res.status}).`);
  }

  const text = await readProviderStream(
    res,
    (line) => {
      try {
        const obj = JSON.parse(line) as { message?: { content?: string } };
        return obj.message?.content || '';
      } catch {
        return '';
      }
    },
    `Ollama (${ollamaModel})`,
    onProgress
  );

  onProgress?.({
    percent: 95,
    stage: 'parsing',
    label: 'Nährwerte & Portionen werden geprüft…',
    detail: `Ollama lokal (${ollamaModel})`,
    isLiveStream: true,
  });
  const items = extractJsonItems(text);
  onProgress?.({
    percent: 100,
    stage: 'done',
    label: `${items.length} Zutaten erkannt`,
    detail: `Ollama lokal (${ollamaModel})`,
    detectedCount: items.length,
    isLiveStream: true,
  });
  return {
    items,
    providerLabel: `Ollama lokal (${ollamaModel})`,
    usedBYOK: true,
  };
}
