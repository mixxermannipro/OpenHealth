import { AppLocale, MealCategory } from '../types/health';
import { inferMealCategoryByHour } from './nutrition';

export type ParsedMealSourceFormat = 'json' | 'deeplink' | 'text_fallback';

export interface ParsedMealItemDraft {
  name: string;
  grams: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}

export interface ParsedAiMeal {
  meal: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  category?: MealCategory;
  items: ParsedMealItemDraft[];
  sourceFormat: ParsedMealSourceFormat;
  caloriesDerivedFromMacros: boolean;
  warnings: string[];
  rawSnippet: string;
}

export type ParseAiMealResult =
  | { ok: true; data: ParsedAiMeal }
  | { ok: false; errorCode: 'empty' | 'unrecognized' | 'invalid_numbers'; message: string };

const MAX_INPUT_LENGTH = 24_000;
const MAX_CALORIES = 8_000;
const MAX_MACRO_G = 600;

/**
 * Copy-ready Zero-Cost KI Prompt Template for Google Gemini, ChatGPT, Claude, etc.
 * Instructs external AI apps to output strictly the canonical JSON schema so Android
 * Share-Intent / Clipboard import works with 100% reliability and 0 EUR API cost.
 */
export function getZeroCostAiPromptTemplate(locale: AppLocale = 'de'): string {
  switch (locale) {
    case 'en':
      return [
        'Estimate the calories and macronutrients for this meal (photo or description).',
        'Reply ONLY with valid JSON in this exact schema (no explanations, no markdown notes):',
        '{',
        '  "meal": "Short meal title",',
        '  "calories": 540,',
        '  "protein_g": 45,',
        '  "carbs_g": 55,',
        '  "fat_g": 12',
        '}',
      ].join('\n');
    case 'es':
      return [
        'Estima las calorías y macronutrientes de esta comida (foto o descripción).',
        'Responde SOLO con un JSON válido con este formato exacto (sin texto adicional):',
        '{',
        '  "meal": "Nombre corto del plato",',
        '  "calories": 540,',
        '  "protein_g": 45,',
        '  "carbs_g": 55,',
        '  "fat_g": 12',
        '}',
      ].join('\n');
    case 'fr':
      return [
        'Estime les calories et macronutriments de ce repas (photo ou description).',
        'Réponds UNIQUEMENT avec un JSON valide selon ce schéma exact (sans texte supplémentaire) :',
        '{',
        '  "meal": "Nom court du repas",',
        '  "calories": 540,',
        '  "protein_g": 45,',
        '  "carbs_g": 55,',
        '  "fat_g": 12',
        '}',
      ].join('\n');
    case 'it':
      return [
        'Stima le calorie e i macronutrienti di questo pasto (foto o descrizione).',
        'Rispondi SOLO con un JSON valido in questo schema esatto (nessun testo extra):',
        '{',
        '  "meal": "Nome breve del pasto",',
        '  "calories": 540,',
        '  "protein_g": 45,',
        '  "carbs_g": 55,',
        '  "fat_g": 12',
        '}',
      ].join('\n');
    case 'de':
    default:
      return [
        'Schätze Kalorien und Makronährstoffe für diese Mahlzeit (Foto oder Beschreibung).',
        'Antworte AUSSCHLIESSLICH mit gültigem JSON exakt nach diesem Schema (ohne Zusatztext):',
        '{',
        '  "meal": "Kurzer Name der Mahlzeit",',
        '  "calories": 540,',
        '  "protein_g": 45,',
        '  "carbs_g": 55,',
        '  "fat_g": 12',
        '}',
      ].join('\n');
  }
}

function clamp(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.min(max, Math.max(min, val));
}

function parseFlexibleNumber(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  if (typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Handle ranges like "520-560 kcal" or "520–560"
  const rangeMatch = trimmed.match(/(\d+(?:[.,]\d+)?)\s*[-–—]\s*(\d+(?:[.,]\d+)?)/);
  if (rangeMatch) {
    const a = Number(rangeMatch[1].replace(',', '.'));
    const b = Number(rangeMatch[2].replace(',', '.'));
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return (a + b) / 2;
    }
  }

  // Handle German thousands separator like "1.250 kcal" vs decimal "12,5 g"
  const cleaned = trimmed
    .replace(/[~≈ca.\s]+/gi, '')
    .replace(/(kcal|kalorien|cal|gramm|grams|g|ml)$/i, '');

  // If format is 1.250 (dot followed by exactly 3 digits and nothing after) treat dot as thousands sep
  const normalized = /^\d{1,2}\.\d{3}$/.test(cleaned)
    ? cleaned.replace('.', '')
    : cleaned.replace(',', '.');

  const numMatch = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!numMatch) return null;
  const parsed = Number(numMatch[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCategory(raw: unknown): MealCategory | undefined {
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim().toLowerCase();
  if (!v) return undefined;
  if (/(breakfast|frühstück|fruehstueck|desayuno|petit|colazione|morgens)/.test(v)) {
    return 'breakfast';
  }
  if (/(lunch|mittag|almuerzo|déjeuner|dejeuner|pranzo)/.test(v)) {
    return 'lunch';
  }
  if (/(dinner|abend|cena|dîner|diner|supper)/.test(v)) {
    return 'dinner';
  }
  if (/(snack|zwischen|collation|spuntin|post-workout|pre-workout)/.test(v)) {
    return 'snack';
  }
  return undefined;
}

function sanitizeTitle(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[*_`#]+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 90);
}

/**
 * Normalizes smart quotes, removes trailing commas, and repairs common LLM JSON formatting quirks.
 */
function repairJsonCandidate(raw: string): string {
  return raw
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/:\s*(\d+),(\d+)(\s*[,}\]])/g, ': $1.$2$3')
    .trim();
}

/**
 * Extracts balanced JSON object or array substrings from arbitrary prose / markdown text.
 */
function extractJsonCandidates(input: string): string[] {
  const candidates: string[] = [];

  // 1. Markdown fenced code blocks (```json ... ``` or ``` ... ```)
  const fenceRegex = /```(?:json|JSON)?\s*([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = fenceRegex.exec(input)) !== null) {
    if (match[1]?.trim()) {
      candidates.push(match[1].trim());
    }
  }

  // 2. Balanced brace scan for raw JSON objects or arrays anywhere in text
  for (let i = 0; i < input.length; i += 1) {
    const startChar = input[i];
    if (startChar !== '{' && startChar !== '[') continue;
    const endChar = startChar === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let j = i; j < input.length; j += 1) {
      const ch = input[j];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (ch === startChar) depth += 1;
      else if (ch === endChar) {
        depth -= 1;
        if (depth === 0) {
          const slice = input.slice(i, j + 1);
          if (slice.length >= 10) {
            candidates.push(slice);
          }
          i = j;
          break;
        }
      }
    }
  }

  return candidates;
}

function getField(obj: Record<string, unknown>, keys: string[]): unknown {
  const lowerMap = new Map<string, unknown>();
  for (const [k, v] of Object.entries(obj)) {
    lowerMap.set(k.toLowerCase().trim(), v);
  }
  for (const key of keys) {
    const val = lowerMap.get(key.toLowerCase());
    if (val !== undefined && val !== null && val !== '') {
      return val;
    }
  }
  return undefined;
}

function finalizeParsedMeal(params: {
  mealName: string;
  caloriesRaw: number | null;
  proteinRaw: number | null;
  carbsRaw: number | null;
  fatRaw: number | null;
  fiberRaw: number | null;
  category?: MealCategory;
  items?: ParsedMealItemDraft[];
  sourceFormat: ParsedMealSourceFormat;
  rawInput: string;
}): ParseAiMealResult {
  const warnings: string[] = [];

  const proteinG = clamp(Math.round((params.proteinRaw ?? 0) * 10) / 10, 0, MAX_MACRO_G);
  const carbsG = clamp(Math.round((params.carbsRaw ?? 0) * 10) / 10, 0, MAX_MACRO_G);
  const fatG = clamp(Math.round((params.fatRaw ?? 0) * 10) / 10, 0, MAX_MACRO_G);
  const fiberG = clamp(Math.round((params.fiberRaw ?? 0) * 10) / 10, 0, 150);

  const atwaterKcal = Math.round(proteinG * 4 + carbsG * 4 + fatG * 9);
  let caloriesDerivedFromMacros = false;
  let calories = 0;

  if (params.caloriesRaw !== null && params.caloriesRaw >= 0) {
    calories = Math.round(clamp(params.caloriesRaw, 0, MAX_CALORIES));
    if (params.caloriesRaw > MAX_CALORIES) {
      warnings.push('Kalorienwert wurde auf den plausiblen Höchstwert (8.000 kcal) begrenzt.');
    }
  } else if (atwaterKcal > 0) {
    calories = Math.min(MAX_CALORIES, atwaterKcal);
    caloriesDerivedFromMacros = true;
    warnings.push('Kalorien wurden automatisch aus Eiweiß, Kohlenhydraten und Fett berechnet.');
  }

  // Must have at least calories > 0 or meaningful macros > 0
  if (calories <= 0 && proteinG <= 0 && carbsG <= 0 && fatG <= 0) {
    return {
      ok: false,
      errorCode: 'invalid_numbers',
      message: 'Es konnten keine gültigen Kalorien- oder Makrowerte im Text gefunden werden.',
    };
  }

  // Soft sanity check between declared kcal and Atwater macro sum
  if (!caloriesDerivedFromMacros && atwaterKcal > 40 && calories > 40) {
    const diffRatio = Math.abs(calories - atwaterKcal) / Math.max(calories, atwaterKcal);
    if (diffRatio > 0.3) {
      warnings.push(
        `Hinweis: Angegebene Kalorien (${calories} kcal) weichen von den Makros (~${atwaterKcal} kcal) ab — bitte kurz prüfen.`
      );
    }
  }

  const cleanName = sanitizeTitle(params.mealName) || 'KI-Mahlzeit';
  const items: ParsedMealItemDraft[] =
    params.items && params.items.length > 0
      ? params.items
      : [
          {
            name: cleanName,
            grams: 100,
            calories,
            proteinG,
            carbsG,
            fatG,
            fiberG,
          },
        ];

  return {
    ok: true,
    data: {
      meal: cleanName,
      calories,
      proteinG: Math.round(proteinG),
      carbsG: Math.round(carbsG),
      fatG: Math.round(fatG),
      fiberG: Math.round(fiberG),
      category: params.category ?? inferMealCategoryByHour(),
      items,
      sourceFormat: params.sourceFormat,
      caloriesDerivedFromMacros,
      warnings,
      rawSnippet: params.rawInput.trim().slice(0, 260),
    },
  };
}

function parseMealFromObject(
  obj: Record<string, unknown>,
  rawInput: string
): ParseAiMealResult | null {
  // Handle nested wrapper objects like { "data": { "meal": ... } } or { "result": { ... } }
  const nested =
    (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)
      ? (obj.data as Record<string, unknown>)
      : null) ||
    (obj.result && typeof obj.result === 'object' && !Array.isArray(obj.result)
      ? (obj.result as Record<string, unknown>)
      : null) ||
    (obj.nutrition && typeof obj.nutrition === 'object' && !Array.isArray(obj.nutrition)
      ? (obj.nutrition as Record<string, unknown>)
      : null);

  const source = nested ?? obj;

  const nameRaw = getField(source, [
    'meal',
    'name',
    'title',
    'gericht',
    'mahlzeit',
    'dish',
    'food',
    'beschreibung',
    'description',
  ]);
  const caloriesRaw = parseFlexibleNumber(
    getField(source, [
      'calories',
      'kcal',
      'calories_kcal',
      'total_calories',
      'totalCalories',
      'kalorien',
      'energy_kcal',
      'energy',
    ])
  );
  const proteinRaw = parseFlexibleNumber(
    getField(source, [
      'protein_g',
      'proteinG',
      'protein',
      'proteins',
      'eiweiss',
      'eiweiss_g',
      'eiweiß',
      'eiweiß_g',
      'proteine',
      'p',
    ])
  );
  const carbsRaw = parseFlexibleNumber(
    getField(source, [
      'carbs_g',
      'carbsG',
      'carbs',
      'carbohydrates',
      'carbohydrates_g',
      'kohlenhydrate',
      'kohlenhydrate_g',
      'kh',
      'c',
    ])
  );
  const fatRaw = parseFlexibleNumber(
    getField(source, ['fat_g', 'fatG', 'fat', 'fats', 'fett', 'fett_g', 'lipids', 'f'])
  );
  const fiberRaw = parseFlexibleNumber(
    getField(source, ['fiber_g', 'fiberG', 'fiber', 'ballaststoffe', 'ballaststoffe_g'])
  );
  const category = normalizeCategory(
    getField(source, ['category', 'meal_type', 'mealType', 'slot', 'kategorie', 'typ'])
  );

  // Optional ingredient breakdown array
  let parsedItems: ParsedMealItemDraft[] | undefined;
  const rawItems = getField(source, ['items', 'ingredients', 'zutaten', 'foods']);
  if (Array.isArray(rawItems) && rawItems.length > 0) {
    const validItems: ParsedMealItemDraft[] = [];
    for (const entry of rawItems) {
      if (!entry || typeof entry !== 'object') continue;
      const rec = entry as Record<string, unknown>;
      const iName = sanitizeTitle(getField(rec, ['name', 'meal', 'food', 'item', 'zutat']));
      const iKcal = parseFlexibleNumber(getField(rec, ['calories', 'kcal', 'kalorien'])) ?? 0;
      const iP = parseFlexibleNumber(getField(rec, ['protein_g', 'protein', 'eiweiss', 'eiweiß'])) ?? 0;
      const iC = parseFlexibleNumber(getField(rec, ['carbs_g', 'carbs', 'kohlenhydrate'])) ?? 0;
      const iF = parseFlexibleNumber(getField(rec, ['fat_g', 'fat', 'fett'])) ?? 0;
      const iFib = parseFlexibleNumber(getField(rec, ['fiber_g', 'fiber', 'ballaststoffe'])) ?? 0;
      const iGrams = parseFlexibleNumber(getField(rec, ['grams', 'gramm', 'g', 'weight_g'])) ?? 100;
      if (iName || iKcal > 0) {
        validItems.push({
          name: iName || 'Zutat',
          grams: Math.max(1, Math.round(clamp(iGrams, 1, 5000))),
          calories: Math.max(0, Math.round(clamp(iKcal, 0, MAX_CALORIES))),
          proteinG: Math.max(0, Math.round(clamp(iP, 0, MAX_MACRO_G))),
          carbsG: Math.max(0, Math.round(clamp(iC, 0, MAX_MACRO_G))),
          fatG: Math.max(0, Math.round(clamp(iF, 0, MAX_MACRO_G))),
          fiberG: Math.max(0, Math.round(clamp(iFib, 0, 150))),
        });
      }
    }
    if (validItems.length > 0) {
      parsedItems = validItems;
    }
  }

  // If totals weren't top-level but items exist, sum items
  const summedKcal =
    caloriesRaw ??
    (parsedItems ? parsedItems.reduce((s, it) => s + it.calories, 0) : null);
  const summedP =
    proteinRaw ??
    (parsedItems ? parsedItems.reduce((s, it) => s + it.proteinG, 0) : null);
  const summedC =
    carbsRaw ??
    (parsedItems ? parsedItems.reduce((s, it) => s + it.carbsG, 0) : null);
  const summedF =
    fatRaw ??
    (parsedItems ? parsedItems.reduce((s, it) => s + it.fatG, 0) : null);
  const summedFib =
    fiberRaw ??
    (parsedItems ? parsedItems.reduce((s, it) => s + it.fiberG, 0) : null);

  const hasAnySignal =
    summedKcal !== null || summedP !== null || summedC !== null || summedF !== null;
  if (!hasAnySignal) return null;

  const fallbackName =
    sanitizeTitle(nameRaw) ||
    (parsedItems && parsedItems.length > 0
      ? parsedItems
          .slice(0, 2)
          .map((i) => i.name)
          .join(' & ')
      : '');

  return finalizeParsedMeal({
    mealName: fallbackName,
    caloriesRaw: summedKcal,
    proteinRaw: summedP,
    carbsRaw: summedC,
    fatRaw: summedF,
    fiberRaw: summedFib,
    category,
    items: parsedItems,
    sourceFormat: 'json',
    rawInput,
  });
}

/**
 * Parses custom URL schemes (`caltrack://log?name=...&kcal=...&p=...&c=...&f=...`,
 * `web+caltrack://...`, `web+kadenz://...`) or share URLs with query parameters.
 */
export function parseMealFromDeepLink(rawUrl: string): ParseAiMealResult | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // Match scheme URL inside surrounding text if shared together with prose
  const urlMatch = trimmed.match(
    /(?:(?:web\+)?(?:caltrack|kadenz):\/\/[^\s"'<>]+|https?:\/\/[^\s"'<>]+(?:share-meal|log)[^\s"'<>]*)/i
  );
  const candidateUrl = urlMatch ? urlMatch[0] : trimmed;

  // Must look like a URL with query parameters
  if (!candidateUrl.includes('?') && !/^(?:web\+)?(?:caltrack|kadenz):\/\//i.test(candidateUrl)) {
    return null;
  }

  let searchParams: URLSearchParams | null = null;
  try {
    // Normalize custom schemes to https://dummy.local/ for standard URL parsing
    const normalized = /^(?:https?:)\/\//i.test(candidateUrl)
      ? candidateUrl
      : candidateUrl.replace(/^[a-z0-9+.-]+:\/\//i, 'https://kadenz.local/');
    const parsed = new URL(normalized);
    searchParams = parsed.searchParams;
  } catch {
    return null;
  }

  // If the URL carries a raw `text` or `share` payload (Web Share Target GET), parse that payload recursively!
  const sharedText = searchParams.get('text') || searchParams.get('share') || searchParams.get('payload');
  const sharedTitle = searchParams.get('title') || '';
  if (sharedText && sharedText.trim().length > 0) {
    const combined =
      sharedTitle && !sharedText.toLowerCase().includes(sharedTitle.toLowerCase())
        ? `${sharedTitle}\n${sharedText}`
        : sharedText;
    const inner = parseAiMealInput(combined);
    if (inner.ok) return inner;
  }

  const name =
    searchParams.get('name') ||
    searchParams.get('meal') ||
    searchParams.get('title') ||
    '';
  const caloriesRaw = parseFlexibleNumber(
    searchParams.get('kcal') ?? searchParams.get('calories') ?? searchParams.get('cal')
  );
  const proteinRaw = parseFlexibleNumber(
    searchParams.get('p') ?? searchParams.get('protein') ?? searchParams.get('protein_g')
  );
  const carbsRaw = parseFlexibleNumber(
    searchParams.get('c') ?? searchParams.get('carbs') ?? searchParams.get('carbs_g')
  );
  const fatRaw = parseFlexibleNumber(
    searchParams.get('f') ?? searchParams.get('fat') ?? searchParams.get('fat_g')
  );
  const fiberRaw = parseFlexibleNumber(
    searchParams.get('fiber') ?? searchParams.get('fiber_g')
  );
  const category = normalizeCategory(searchParams.get('category') ?? searchParams.get('slot'));

  if (caloriesRaw === null && proteinRaw === null && carbsRaw === null && fatRaw === null) {
    return null;
  }

  return finalizeParsedMeal({
    mealName: name,
    caloriesRaw,
    proteinRaw,
    carbsRaw,
    fatRaw,
    fiberRaw,
    category,
    sourceFormat: 'deeplink',
    rawInput: candidateUrl,
  });
}

/**
 * Fault-tolerant natural-language fallback when an AI app ignores JSON formatting
 * and outputs plain German/English nutrition lines.
 */
function parseMealFromFreeText(input: string): ParseAiMealResult | null {
  const clean = input.replace(/[*_`]+/g, ' ');

  const kcalMatch =
    clean.match(/(?:kalorien|calories|energie|gesamt|total)\s*[:=–-]?\s*(?:ca\.?\s*|~\s*)?(\d+(?:[.,]\d+)?(?:\s*[-–—]\s*\d+(?:[.,]\d+)?)?)\s*(?:kcal|cal)?/i) ||
    clean.match(/(?:ca\.?\s*|~\s*)?(\d+(?:[.,]\d+)?(?:\s*[-–—]\s*\d+(?:[.,]\d+)?)?)\s*kcal\b/i);

  const proteinMatch =
    clean.match(/(?:eiwei[ßs]{1,2}|protein[e]?)\s*[:=–-]?\s*(?:ca\.?\s*|~\s*)?(\d+(?:[.,]\d+)?(?:\s*[-–—]\s*\d+(?:[.,]\d+)?)?)\s*g?\b/i) ||
    clean.match(/\b(\d+(?:[.,]\d+)?)\s*g\s*(?:eiwei[ßs]{1,2}|protein[e]?)\b/i);

  const carbsMatch =
    clean.match(/(?:kohlenhydrate|carbohydrates|carbs|kh)\s*[:=–-]?\s*(?:ca\.?\s*|~\s*)?(\d+(?:[.,]\d+)?(?:\s*[-–—]\s*\d+(?:[.,]\d+)?)?)\s*g?\b/i) ||
    clean.match(/\b(\d+(?:[.,]\d+)?)\s*g\s*(?:kohlenhydrate|carbs|kh)\b/i);

  const fatMatch =
    clean.match(/(?:fett[e]?|fats?|lipids?)\s*[:=–-]?\s*(?:ca\.?\s*|~\s*)?(\d+(?:[.,]\d+)?(?:\s*[-–—]\s*\d+(?:[.,]\d+)?)?)\s*g?\b/i) ||
    clean.match(/\b(\d+(?:[.,]\d+)?)\s*g\s*(?:fett|fat)\b/i);

  const fiberMatch = clean.match(
    /(?:ballaststoffe|fiber|fibres)\s*[:=–-]?\s*(?:ca\.?\s*|~\s*)?(\d+(?:[.,]\d+)?)\s*g?\b/i
  );

  const caloriesRaw = kcalMatch ? parseFlexibleNumber(kcalMatch[1]) : null;
  const proteinRaw = proteinMatch ? parseFlexibleNumber(proteinMatch[1]) : null;
  const carbsRaw = carbsMatch ? parseFlexibleNumber(carbsMatch[1]) : null;
  const fatRaw = fatMatch ? parseFlexibleNumber(fatMatch[1]) : null;
  const fiberRaw = fiberMatch ? parseFlexibleNumber(fiberMatch[1]) : null;

  const macroSignals = [proteinRaw, carbsRaw, fatRaw].filter((v) => v !== null).length;
  if (caloriesRaw === null && macroSignals < 2) {
    return null;
  }

  // Extract a plausible meal title from explicit label or first non-metric line
  const explicitNameMatch = clean.match(/(?:mahlzeit|gericht|meal|essen|dish)\s*[:=–-]\s*([^\n|•]{2,70})/i);
  let mealName = explicitNameMatch ? explicitNameMatch[1] : '';

  if (!mealName) {
    const lines = input
      .split(/\r?\n/)
      .map((l) => l.replace(/^[-•*\d.)\s#]+/, '').trim())
      .filter((l) => l.length >= 2 && l.length <= 80);

    for (const line of lines) {
      const lower = line.toLowerCase();
      // Skip intro prose or pure nutrient lines
      if (
        /^(hier ist|gerne|schätzung|nährwerte|kalorien|calories|eiweiß|eiweiss|protein|kohlenhydrate|carbs|fett|fat|ballaststoffe|fiber|gesamt|total)/i.test(
          lower
        )
      ) {
        continue;
      }
      // Strip trailing calorie summary on the same line ("Hähnchen mit Reis — 540 kcal")
      const stripped = line.split(/\s*[—–|]\s*|\s+\d+\s*kcal/i)[0]?.trim() || '';
      if (stripped.length >= 2) {
        mealName = stripped;
        break;
      }
    }
  }

  return finalizeParsedMeal({
    mealName,
    caloriesRaw,
    proteinRaw,
    carbsRaw,
    fatRaw,
    fiberRaw,
    category: normalizeCategory(input),
    sourceFormat: 'text_fallback',
    rawInput: input,
  });
}

/**
 * Main fault-tolerant entry point for parsing any external Share-Intent, Clipboard,
 * or Deep-Link input. Guaranteed never to throw regardless of malformed input.
 */
export function parseAiMealInput(rawInput: string | null | undefined): ParseAiMealResult {
  try {
    if (typeof rawInput !== 'string') {
      return {
        ok: false,
        errorCode: 'empty',
        message: 'Bitte füge zuerst die Antwort aus Gemini, ChatGPT oder Claude ein.',
      };
    }

    const bounded = rawInput.slice(0, MAX_INPUT_LENGTH).trim();
    if (!bounded) {
      return {
        ok: false,
        errorCode: 'empty',
        message: 'Bitte füge zuerst die Antwort aus Gemini, ChatGPT oder Claude ein.',
      };
    }

    // 1. Custom URL Scheme / Share Deep-Link (e.g. caltrack://log?name=...&kcal=...)
    const deepLinkResult = parseMealFromDeepLink(bounded);
    if (deepLinkResult) {
      return deepLinkResult;
    }

    // 2. JSON extraction (raw JSON, fenced ```json``` blocks, or JSON inside chat prose)
    const candidates = extractJsonCandidates(bounded);
    for (const candidate of candidates) {
      const repaired = repairJsonCandidate(candidate);
      try {
        const parsed = JSON.parse(repaired);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Array of meal objects -> aggregate into single meal with itemized breakdown
          const wrapped = parseMealFromObject({ items: parsed }, bounded);
          if (wrapped) return wrapped;
        } else if (parsed && typeof parsed === 'object') {
          const objResult = parseMealFromObject(parsed as Record<string, unknown>, bounded);
          if (objResult) return objResult;
        }
      } catch {
        // Continue trying next candidate or free-text fallback
      }
    }

    // 3. Natural-language / plain-text fallback
    const freeTextResult = parseMealFromFreeText(bounded);
    if (freeTextResult) {
      return freeTextResult;
    }

    return {
      ok: false,
      errorCode: 'unrecognized',
      message:
        'Keine Mahlzeit erkannt. Nutze den Kopier-Prompt in deiner KI-App oder gib JSON mit meal, calories, protein_g, carbs_g und fat_g an.',
    };
  } catch {
    return {
      ok: false,
      errorCode: 'unrecognized',
      message: 'Die Eingabe konnte nicht verarbeitet werden. Bitte prüfe das Format.',
    };
  }
}
