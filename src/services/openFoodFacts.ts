export interface FoodCatalogProduct {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  imageUrl?: string;
  defaultGrams: number;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  source: 'openfoodfacts' | 'local_db';
}

/**
 * Curated offline-ready staple food database (per 100g, DGE/USDA reference values)
 * used as instant local suggestions and offline fallback alongside Open Food Facts.
 */
export const LOCAL_GERMAN_FOODS: FoodCatalogProduct[] = [
  {
    id: 'local_oats',
    name: 'Haferflocken (zart)',
    brand: 'Basis',
    defaultGrams: 80,
    kcalPer100g: 372,
    proteinPer100g: 13.5,
    carbsPer100g: 58.7,
    fatPer100g: 7.0,
    fiberPer100g: 10.0,
    source: 'local_db',
  },
  {
    id: 'local_skyr',
    name: 'Skyr Natur',
    brand: 'Basis',
    defaultGrams: 250,
    kcalPer100g: 62,
    proteinPer100g: 11.0,
    carbsPer100g: 4.0,
    fatPer100g: 0.2,
    fiberPer100g: 0,
    source: 'local_db',
  },
  {
    id: 'local_chicken',
    name: 'Hähnchenbrustfilet (gegart)',
    brand: 'Basis',
    defaultGrams: 180,
    kcalPer100g: 165,
    proteinPer100g: 31.0,
    carbsPer100g: 0,
    fatPer100g: 3.6,
    fiberPer100g: 0,
    source: 'local_db',
  },
  {
    id: 'local_rice',
    name: 'Basmatireis (gekocht)',
    brand: 'Basis',
    defaultGrams: 200,
    kcalPer100g: 130,
    proteinPer100g: 2.7,
    carbsPer100g: 28.2,
    fatPer100g: 0.3,
    fiberPer100g: 0.4,
    source: 'local_db',
  },
  {
    id: 'local_salmon',
    name: 'Lachsfilet',
    brand: 'Basis',
    defaultGrams: 150,
    kcalPer100g: 208,
    proteinPer100g: 20.4,
    carbsPer100g: 0,
    fatPer100g: 13.4,
    fiberPer100g: 0,
    source: 'local_db',
  },
  {
    id: 'local_eggs',
    name: 'Hühnerei (gekocht)',
    brand: 'Basis',
    defaultGrams: 120,
    kcalPer100g: 155,
    proteinPer100g: 12.6,
    carbsPer100g: 1.1,
    fatPer100g: 10.6,
    fiberPer100g: 0,
    source: 'local_db',
  },
  {
    id: 'local_banana',
    name: 'Banane',
    brand: 'Obst',
    defaultGrams: 120,
    kcalPer100g: 89,
    proteinPer100g: 1.1,
    carbsPer100g: 22.8,
    fatPer100g: 0.3,
    fiberPer100g: 2.6,
    source: 'local_db',
  },
  {
    id: 'local_quark',
    name: 'Magerquark',
    brand: 'Basis',
    defaultGrams: 250,
    kcalPer100g: 67,
    proteinPer100g: 12.0,
    carbsPer100g: 4.1,
    fatPer100g: 0.3,
    fiberPer100g: 0,
    source: 'local_db',
  },
  {
    id: 'local_avocado',
    name: 'Avocado',
    brand: 'Frisch',
    defaultGrams: 80,
    kcalPer100g: 160,
    proteinPer100g: 2.0,
    carbsPer100g: 8.5,
    fatPer100g: 14.7,
    fiberPer100g: 6.7,
    source: 'local_db',
  },
  {
    id: 'local_bread',
    name: 'Vollkornbrot',
    brand: 'Bäckerei',
    defaultGrams: 100,
    kcalPer100g: 215,
    proteinPer100g: 7.5,
    carbsPer100g: 40.0,
    fatPer100g: 1.5,
    fiberPer100g: 7.2,
    source: 'local_db',
  },
];

function mapOffProduct(raw: Record<string, unknown>): FoodCatalogProduct | null {
  const name = String(
    raw.product_name_de || raw.product_name || raw.generic_name_de || raw.generic_name || ''
  ).trim();
  if (!name) return null;
  const nut = (raw.nutriments as Record<string, unknown> | undefined) ?? {};
  const kcal = Number(nut['energy-kcal_100g'] ?? nut['energy-kcal'] ?? 0);
  if (!Number.isFinite(kcal) || kcal <= 0) return null;

  return {
    id: `off_${String(raw.code || raw._id || name)}`,
    name,
    brand: raw.brands ? String(raw.brands).split(',')[0].trim() : undefined,
    barcode: raw.code ? String(raw.code) : undefined,
    imageUrl: raw.image_front_small_url ? String(raw.image_front_small_url) : undefined,
    defaultGrams: 100,
    kcalPer100g: Math.round(kcal),
    proteinPer100g: Number(Number(nut.proteins_100g ?? 0).toFixed(1)),
    carbsPer100g: Number(Number(nut.carbohydrates_100g ?? 0).toFixed(1)),
    fatPer100g: Number(Number(nut.fat_100g ?? 0).toFixed(1)),
    fiberPer100g: Number(Number(nut.fiber_100g ?? 0).toFixed(1)),
    source: 'openfoodfacts',
  };
}

export async function lookupBarcodeOpenFoodFacts(
  barcode: string
): Promise<FoodCatalogProduct | null> {
  const cleanCode = barcode.replace(/\D/g, '');
  if (cleanCode.length < 8) return null;

  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 6000);
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(cleanCode)}.json?fields=code,product_name,product_name_de,brands,nutriments,image_front_small_url`,
      { signal: controller.signal }
    );
    window.clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as { status?: number; product?: Record<string, unknown> };
    if (json.status !== 1 || !json.product) return null;
    return mapOffProduct({ ...json.product, code: cleanCode });
  } catch {
    return null;
  }
}

export async function searchOpenFoodFacts(query: string): Promise<FoodCatalogProduct[]> {
  const q = query.trim();
  const localMatches = LOCAL_GERMAN_FOODS.filter(
    (f) => !q || f.name.toLowerCase().includes(q.toLowerCase())
  );
  if (q.length < 2) return localMatches;

  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5500);
    const res = await fetch(
      `https://de.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=12&fields=code,product_name,product_name_de,brands,nutriments,image_front_small_url`,
      { signal: controller.signal }
    );
    window.clearTimeout(timer);
    if (!res.ok) return localMatches;
    const json = (await res.json()) as { products?: Record<string, unknown>[] };
    const remote = (json.products ?? [])
      .map(mapOffProduct)
      .filter((p): p is FoodCatalogProduct => Boolean(p));

    const seen = new Set<string>();
    const merged: FoodCatalogProduct[] = [];
    for (const item of [...localMatches, ...remote]) {
      const key = `${item.name.toLowerCase()}_${item.kcalPer100g}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
    return merged.slice(0, 15);
  } catch {
    return localMatches;
  }
}
