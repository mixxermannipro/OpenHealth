import { LOCAL_FOOD_DATABASE, LocalFoodReference } from '../engine/nutrition';
import { MealFoodItem } from '../types/health';

export interface FoodSearchResult {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  defaultGrams: number;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  imageUrl?: string;
  source: 'openfoodfacts' | 'local_db';
}

interface OFFProduct {
  code?: string;
  product_name?: string;
  product_name_de?: string;
  brands?: string;
  image_front_small_url?: string;
  nutriments?: {
    'energy-kcal_100g'?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
    fiber_100g?: number;
  };
}

function mapOffProduct(p: OFFProduct): FoodSearchResult | null {
  const name = (p.product_name_de || p.product_name || '').trim();
  const n = p.nutriments;
  if (!name || !n || typeof n['energy-kcal_100g'] !== 'number') return null;

  return {
    id: `off_${p.code || name}`,
    name,
    brand: p.brands?.split(',')[0]?.trim() || 'Open Food Facts',
    barcode: p.code,
    defaultGrams: 100,
    kcalPer100g: Math.round(n['energy-kcal_100g'] || 0),
    proteinPer100g: Number((n.proteins_100g || 0).toFixed(1)),
    carbsPer100g: Number((n.carbohydrates_100g || 0).toFixed(1)),
    fatPer100g: Number((n.fat_100g || 0).toFixed(1)),
    fiberPer100g: Number((n.fiber_100g || 0).toFixed(1)),
    imageUrl: p.image_front_small_url,
    source: 'openfoodfacts',
  };
}

function mapLocalRef(ref: LocalFoodReference): FoodSearchResult {
  return {
    id: ref.id,
    name: ref.name,
    brand: ref.brand,
    defaultGrams: ref.defaultGrams,
    kcalPer100g: ref.kcalPer100g,
    proteinPer100g: ref.proteinPer100g,
    carbsPer100g: ref.carbsPer100g,
    fatPer100g: ref.fatPer100g,
    fiberPer100g: ref.fiberPer100g,
    imageUrl: ref.imageUrl,
    source: 'local_db',
  };
}

export function searchLocalFoods(query: string): FoodSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return LOCAL_FOOD_DATABASE.slice(0, 12).map(mapLocalRef);

  return LOCAL_FOOD_DATABASE.filter(
    (f) =>
      f.name.toLowerCase().includes(q) ||
      (f.brand && f.brand.toLowerCase().includes(q)) ||
      f.keywords.some((k) => k.includes(q))
  ).map(mapLocalRef);
}

export async function searchOpenFoodFacts(query: string): Promise<{
  results: FoodSearchResult[];
  remoteUsed: boolean;
}> {
  const localMatches = searchLocalFoods(query);
  const q = query.trim();
  if (q.length < 2) {
    return { results: localMatches, remoteUsed: false };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const url = `https://de.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
      q
    )}&search_simple=1&action=process&json=1&page_size=10&fields=code,product_name,product_name_de,brands,nutriments,image_front_small_url`;

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = (await res.json()) as { products?: OFFProduct[] };
    const remote = (data.products || [])
      .map(mapOffProduct)
      .filter((x): x is FoodSearchResult => x !== null);

    // Put local DACH whole foods first if exact match, then Open Food Facts packaged items
    return {
      results: [...localMatches.slice(0, 4), ...remote],
      remoteUsed: remote.length > 0,
    };
  } catch {
    return { results: localMatches, remoteUsed: false };
  }
}

// Offline sample EAN catalog so barcode lookup works even without internet access
const OFFLINE_BARCODE_FALLBACKS: Record<string, FoodSearchResult> = {
  '4000417025005': {
    id: 'ean_4000417025005',
    name: 'Kölln Kernige Haferflocken',
    brand: 'Kölln',
    barcode: '4000417025005',
    defaultGrams: 80,
    kcalPer100g: 372,
    proteinPer100g: 13.5,
    carbsPer100g: 58.7,
    fatPer100g: 7.0,
    fiberPer100g: 10.0,
    source: 'local_db',
  },
  '4311501645512': {
    id: 'ean_4311501645512',
    name: 'Skyr Natur 0,2 % Fett',
    brand: 'Edeka / Gut & Günstig',
    barcode: '4311501645512',
    defaultGrams: 200,
    kcalPer100g: 63,
    proteinPer100g: 11.0,
    carbsPer100g: 4.0,
    fatPer100g: 0.2,
    fiberPer100g: 0,
    source: 'local_db',
  },
  '4008400404127': {
    id: 'ean_4008400404127',
    name: 'High Protein Pudding Schoko',
    brand: 'Ehrmann',
    barcode: '4008400404127',
    defaultGrams: 200,
    kcalPer100g: 76,
    proteinPer100g: 10.0,
    carbsPer100g: 5.4,
    fatPer100g: 1.5,
    fiberPer100g: 0.6,
    source: 'local_db',
  },
};

export async function lookupBarcodeOpenFoodFacts(barcode: string): Promise<FoodSearchResult | null> {
  const clean = barcode.replace(/\D/g, '');
  if (clean.length < 6) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
        clean
      )}.json?fields=code,product_name,product_name_de,brands,nutriments,image_front_small_url`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (res.ok) {
      const json = (await res.json()) as { status?: number; product?: OFFProduct };
      if (json.status === 1 && json.product) {
        const mapped = mapOffProduct(json.product);
        if (mapped) return mapped;
      }
    }
  } catch {
    // Fall through to offline fallback catalog
  }

  return OFFLINE_BARCODE_FALLBACKS[clean] || null;
}

export function foodResultToMealItem(result: FoodSearchResult, grams: number): MealFoodItem {
  const safeGrams = Math.max(1, Math.round(grams));
  const factor = safeGrams / 100;
  return {
    id: `food_${result.id}_${Date.now()}_${Math.floor(Math.random() * 999)}`,
    name: result.name,
    brand: result.brand,
    barcode: result.barcode,
    grams: safeGrams,
    calories: Math.round(result.kcalPer100g * factor),
    proteinG: Number((result.proteinPer100g * factor).toFixed(1)),
    carbsG: Number((result.carbsPer100g * factor).toFixed(1)),
    fatG: Number((result.fatPer100g * factor).toFixed(1)),
    fiberG: Number((result.fiberPer100g * factor).toFixed(1)),
    imageUrl: result.imageUrl,
    source: result.source,
  };
}
