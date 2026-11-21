import {
  MealCategory,
  MealEntry,
  MealFoodItem,
  NutritionGoalMode,
  NutritionTargets,
  UserProfile,
} from '../types/health';

export interface LocalFoodReference {
  id: string;
  name: string;
  brand?: string;
  defaultGrams: number;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  keywords: string[];
  imageUrl?: string;
}

// Curated German/DACH Bundeslebensmittelschlüssel (BLS) & USDA reference values for instant offline/local-first tracking
export const LOCAL_FOOD_DATABASE: LocalFoodReference[] = [
  {
    id: 'haferflocken',
    name: 'Haferflocken',
    brand: 'Vollkorn · Zart',
    defaultGrams: 80,
    kcalPer100g: 380,
    proteinPer100g: 13.5,
    carbsPer100g: 58.7,
    fatPer100g: 7.0,
    fiberPer100g: 10.0,
    keywords: ['haferflocken', 'hafer', 'oats', 'porridge', 'oatmeal'],
    imageUrl: '/src/assets/images/meal_oatmeal_berries_1795248984774.jpg',
  },
  {
    id: 'blaubeeren',
    name: 'Blaubeeren',
    brand: 'Frisch',
    defaultGrams: 60,
    kcalPer100g: 57,
    proteinPer100g: 0.7,
    carbsPer100g: 14.5,
    fatPer100g: 0.3,
    fiberPer100g: 2.4,
    keywords: ['blaubeeren', 'heidelbeeren', 'beeren', 'blueberries'],
  },
  {
    id: 'erdbeeren',
    name: 'Erdbeeren',
    brand: 'Frisch',
    defaultGrams: 80,
    kcalPer100g: 32,
    proteinPer100g: 0.7,
    carbsPer100g: 7.7,
    fatPer100g: 0.3,
    fiberPer100g: 2.0,
    keywords: ['erdbeeren', 'strawberries'],
  },
  {
    id: 'griechischer_joghurt',
    name: 'Griechischer Joghurt',
    brand: '5 % Fett',
    defaultGrams: 150,
    kcalPer100g: 90,
    proteinPer100g: 9.0,
    carbsPer100g: 3.6,
    fatPer100g: 5.0,
    fiberPer100g: 0,
    keywords: ['griechischer joghurt', 'joghurt', 'yogurt', 'greek yogurt'],
    imageUrl: '/src/assets/images/meal_yogurt_nuts_1795248986361.jpg',
  },
  {
    id: 'skyr',
    name: 'Skyr Natur',
    brand: 'High Protein · 0,2 % Fett',
    defaultGrams: 200,
    kcalPer100g: 63,
    proteinPer100g: 11.0,
    carbsPer100g: 4.0,
    fatPer100g: 0.2,
    fiberPer100g: 0,
    keywords: ['skyr', 'magerquark', 'quark'],
    imageUrl: '/src/assets/images/meal_yogurt_nuts_1795248986361.jpg',
  },
  {
    id: 'haehnchenbrust',
    name: 'Hähnchenbrust gegrillt',
    brand: 'Mager',
    defaultGrams: 180,
    kcalPer100g: 165,
    proteinPer100g: 31.0,
    carbsPer100g: 0,
    fatPer100g: 3.6,
    fiberPer100g: 0,
    keywords: ['hähnchen', 'hähnchenbrust', 'chicken', 'huhn', 'geflügel', 'hähnchen-bowl'],
    imageUrl: '/src/assets/images/meal_chicken_bowl_1795248983766.jpg',
  },
  {
    id: 'vollkornreis',
    name: 'Vollkornreis gekocht',
    brand: 'Naturreis',
    defaultGrams: 200,
    kcalPer100g: 123,
    proteinPer100g: 2.7,
    carbsPer100g: 25.6,
    fatPer100g: 1.0,
    fiberPer100g: 1.8,
    keywords: ['reis', 'vollkornreis', 'basmati', 'jasminreis', 'rice'],
  },
  {
    id: 'avocado',
    name: 'Avocado',
    brand: 'Frisch',
    defaultGrams: 75,
    kcalPer100g: 160,
    proteinPer100g: 2.0,
    carbsPer100g: 8.5,
    fatPer100g: 14.7,
    fiberPer100g: 6.7,
    keywords: ['avocado'],
  },
  {
    id: 'lachsfilet',
    name: 'Wildlachs gebraten',
    brand: 'Omega-3 reich',
    defaultGrams: 160,
    kcalPer100g: 206,
    proteinPer100g: 22.1,
    carbsPer100g: 0,
    fatPer100g: 12.4,
    fiberPer100g: 0,
    keywords: ['lachs', 'lachsfilet', 'salmon', 'fisch'],
    imageUrl: '/src/assets/images/meal_salmon_rice_1795248984575.jpg',
  },
  {
    id: 'edamame',
    name: 'Edamame geschält',
    brand: 'Gedämpft',
    defaultGrams: 80,
    kcalPer100g: 122,
    proteinPer100g: 11.9,
    carbsPer100g: 8.9,
    fatPer100g: 5.2,
    fiberPer100g: 5.2,
    keywords: ['edamame', 'sojabohnen'],
  },
  {
    id: 'banane',
    name: 'Banane',
    brand: '1 mittelgroß',
    defaultGrams: 120,
    kcalPer100g: 89,
    proteinPer100g: 1.1,
    carbsPer100g: 22.8,
    fatPer100g: 0.3,
    fiberPer100g: 2.6,
    keywords: ['banane', 'banana'],
  },
  {
    id: 'apfel',
    name: 'Apfel',
    brand: 'Frisch',
    defaultGrams: 150,
    kcalPer100g: 52,
    proteinPer100g: 0.3,
    carbsPer100g: 13.8,
    fatPer100g: 0.2,
    fiberPer100g: 2.4,
    keywords: ['apfel', 'apple'],
  },
  {
    id: 'mandeln',
    name: 'Mandeln & Walnüsse',
    brand: 'Naturbelassen',
    defaultGrams: 30,
    kcalPer100g: 615,
    proteinPer100g: 19.0,
    carbsPer100g: 16.0,
    fatPer100g: 54.0,
    fiberPer100g: 10.5,
    keywords: ['mandeln', 'walnüsse', 'nüsse', 'nuts', 'almonds'],
  },
  {
    id: 'eier',
    name: 'Eier (Freiland)',
    brand: '2 Stück ≈ 120 g',
    defaultGrams: 120,
    kcalPer100g: 143,
    proteinPer100g: 12.6,
    carbsPer100g: 0.7,
    fatPer100g: 9.5,
    fiberPer100g: 0,
    keywords: ['ei', 'eier', 'rührei', 'spiegelei', 'omelett', 'eggs'],
  },
  {
    id: 'vollkornbrot',
    name: 'Dinkel-Vollkornbrot',
    brand: '2 Scheiben ≈ 100 g',
    defaultGrams: 100,
    kcalPer100g: 235,
    proteinPer100g: 8.8,
    carbsPer100g: 41.2,
    fatPer100g: 2.6,
    fiberPer100g: 7.4,
    keywords: ['brot', 'vollkornbrot', 'dinkelbrot', 'sauerteigbrot', 'toast', 'bread'],
  },
  {
    id: 'whey_protein',
    name: 'Whey Protein Shake',
    brand: 'Isolat · 1 Scoop',
    defaultGrams: 30,
    kcalPer100g: 375,
    proteinPer100g: 82.0,
    carbsPer100g: 5.0,
    fatPer100g: 2.5,
    fiberPer100g: 0.5,
    keywords: ['whey', 'protein', 'shake', 'proteinshake', 'eiweißshake'],
  },
  {
    id: 'pasta_vollkorn',
    name: 'Vollkorn-Pasta gekocht',
    brand: 'Al dente',
    defaultGrams: 220,
    kcalPer100g: 148,
    proteinPer100g: 5.5,
    carbsPer100g: 28.5,
    fatPer100g: 1.0,
    fiberPer100g: 4.5,
    keywords: ['pasta', 'nudeln', 'spaghetti', 'vollkornnudeln'],
  },
  {
    id: 'chiasamen',
    name: 'Chiasamen',
    brand: 'Bio',
    defaultGrams: 15,
    kcalPer100g: 486,
    proteinPer100g: 16.5,
    carbsPer100g: 42.1,
    fatPer100g: 30.7,
    fiberPer100g: 34.4,
    keywords: ['chia', 'chiasamen', 'leinsamen'],
  },
  {
    id: 'erdnussbutter',
    name: 'Erdnussmus (100 %)',
    brand: 'Ohne Zuckerzusatz',
    defaultGrams: 20,
    kcalPer100g: 598,
    proteinPer100g: 25.8,
    carbsPer100g: 16.1,
    fatPer100g: 50.4,
    fiberPer100g: 8.5,
    keywords: ['erdnussbutter', 'erdnussmus', 'peanut butter'],
  },
  {
    id: 'tomaten_spinat',
    name: 'Cherrytomaten & Blattspinat',
    brand: 'Frisch',
    defaultGrams: 120,
    kcalPer100g: 22,
    proteinPer100g: 1.8,
    carbsPer100g: 3.7,
    fatPer100g: 0.3,
    fiberPer100g: 1.8,
    keywords: ['tomaten', 'spinat', 'salat', 'gemüse', 'gurke', 'brokkoli'],
  },
  {
    id: 'honig',
    name: 'Blütenhonig',
    brand: '1 TL ≈ 10 g',
    defaultGrams: 10,
    kcalPer100g: 304,
    proteinPer100g: 0.3,
    carbsPer100g: 82.4,
    fatPer100g: 0,
    fiberPer100g: 0,
    keywords: ['honig', 'honey', 'ahornsirup'],
  },
  {
    id: 'tofu',
    name: 'Naturtofu gebraten',
    brand: 'Bio',
    defaultGrams: 150,
    kcalPer100g: 144,
    proteinPer100g: 15.8,
    carbsPer100g: 2.8,
    fatPer100g: 8.7,
    fiberPer100g: 2.3,
    keywords: ['tofu', 'tempeh'],
  },
  {
    id: 'kartoffeln',
    name: 'Kartoffeln gekocht',
    brand: 'Festkochend',
    defaultGrams: 250,
    kcalPer100g: 77,
    proteinPer100g: 2.0,
    carbsPer100g: 17.5,
    fatPer100g: 0.1,
    fiberPer100g: 2.2,
    keywords: ['kartoffeln', 'süßkartoffel', 'potato'],
  },
];

/**
 * Mifflin-St Jeor (1990) Basal Metabolic Rate (kcal/day)
 * Most clinically validated BMR predictive equation in healthy adults (ADA / AND consensus).
 */
export function calculateMifflinStJeorBMR(profile: Pick<UserProfile, 'weightKg' | 'heightCm' | 'age' | 'biologicalSex'>): number {
  const weight = Math.max(35, profile.weightKg || 72);
  const height = Math.max(130, profile.heightCm || 178);
  const age = Math.max(14, profile.age || 25);

  const base = 10 * weight + 6.25 * height - 5 * age;
  if (profile.biologicalSex === 'male') return Math.round(base + 5);
  if (profile.biologicalSex === 'female') return Math.round(base - 161);
  return Math.round(base - 78);
}

/**
 * Adaptive Daily Calorie & Evidence-Based Macro Targets (ISSN & DGE Guidelines)
 * Dynamically combines Mifflin-St Jeor BMR + NEAT + daily active calories from workouts/steps.
 */
export function calculateNutritionTargets(
  profile: UserProfile,
  activeCaloriesToday = 450
): NutritionTargets {
  const bmrKcal = calculateMifflinStJeorBMR(profile);
  const neatMultiplier =
    profile.activityLevel === 'athlete'
      ? 1.38
      : profile.activityLevel === 'very_active'
        ? 1.32
        : profile.activityLevel === 'active'
          ? 1.26
          : 1.2;

  const goalMode: NutritionGoalMode =
    profile.nutritionGoalMode ??
    (profile.goals.includes('build_muscle') ? 'build' : 'maintain');

  const goalDelta = goalMode === 'cut' ? -350 : goalMode === 'build' ? 250 : 0;
  const activeBonusKcal = Math.round(Math.max(0, Math.min(1400, activeCaloriesToday * 0.72)));

  const computedCalories = Math.max(
    1400,
    Math.round((bmrKcal * neatMultiplier + activeBonusKcal + goalDelta) / 10) * 10
  );
  const caloriesKcal = profile.customCalorieTarget
    ? Math.max(1200, Math.round(profile.customCalorieTarget))
    : computedCalories;

  // ISSN Evidence-based Protein: 1.8-2.2 g/kg for active/strength athletes, 1.6 g/kg general
  const proteinFactor =
    goalMode === 'cut'
      ? 2.1
      : profile.goals.includes('build_muscle') || profile.goals.includes('increase_strength')
        ? 2.0
        : 1.8;
  const proteinG = Math.round((profile.weightKg || 72) * proteinFactor);

  // Fat: ~0.95-1.05 g/kg (approx 28-30% of calories, minimum hormone-safe floor)
  const fatG = Math.max(50, Math.round((caloriesKcal * 0.28) / 9));

  // Remaining energy allocated to performance carbohydrates
  const remainingForCarbsKcal = Math.max(200, caloriesKcal - proteinG * 4 - fatG * 9);
  const carbsG = Math.round(remainingForCarbsKcal / 4);

  // DGE / IOM Fiber guideline: 14 g per 1000 kcal (min 30 g)
  const fiberG = Math.max(30, Math.round((caloriesKcal / 1000) * 14));

  return {
    caloriesKcal,
    proteinG,
    carbsG,
    fatG,
    fiberG,
    bmrKcal,
    activeBonusKcal,
    goalMode,
  };
}

export function scaleFoodItem(ref: LocalFoodReference, grams: number): MealFoodItem {
  const safeGrams = Math.max(1, Math.round(grams));
  const ratio = safeGrams / 100;
  return {
    id: `item_${ref.id}_${Date.now()}_${Math.floor(Math.random() * 999)}`,
    name: ref.name,
    brand: ref.brand,
    grams: safeGrams,
    calories: Math.round(ref.kcalPer100g * ratio),
    proteinG: Number((ref.proteinPer100g * ratio).toFixed(1)),
    carbsG: Number((ref.carbsPer100g * ratio).toFixed(1)),
    fatG: Number((ref.fatPer100g * ratio).toFixed(1)),
    fiberG: Number((ref.fiberPer100g * ratio).toFixed(1)),
    imageUrl: ref.imageUrl,
    source: 'local_db',
  };
}

export function summarizeMealsForDate(meals: MealEntry[], dateKey: string) {
  const dayMeals = meals.filter((m) => m.date === dateKey);
  const totalCalories = Math.round(dayMeals.reduce((acc, m) => acc + m.totalCalories, 0));
  const proteinG = Math.round(dayMeals.reduce((acc, m) => acc + m.proteinG, 0));
  const carbsG = Math.round(dayMeals.reduce((acc, m) => acc + m.carbsG, 0));
  const fatG = Math.round(dayMeals.reduce((acc, m) => acc + m.fatG, 0));
  const fiberG = Math.round(dayMeals.reduce((acc, m) => acc + m.fiberG, 0));

  return {
    dayMeals,
    totalCalories,
    proteinG,
    carbsG,
    fatG,
    fiberG,
  };
}

export function buildMealEntryFromItems(params: {
  date: string;
  category: MealCategory;
  title?: string;
  items: MealFoodItem[];
  imageUrl?: string;
  analysisNote?: string;
}): MealEntry {
  const totalCalories = Math.round(params.items.reduce((acc, i) => acc + i.calories, 0));
  const proteinG = Number(params.items.reduce((acc, i) => acc + i.proteinG, 0).toFixed(1));
  const carbsG = Number(params.items.reduce((acc, i) => acc + i.carbsG, 0).toFixed(1));
  const fatG = Number(params.items.reduce((acc, i) => acc + i.fatG, 0).toFixed(1));
  const fiberG = Number(params.items.reduce((acc, i) => acc + i.fiberG, 0).toFixed(1));

  const categoryTitles: Record<MealCategory, string> = {
    breakfast: 'Frühstück',
    lunch: 'Mittagessen',
    dinner: 'Abendessen',
    snack: 'Snack',
  };

  const subtitle =
    params.items.length > 0
      ? params.items
          .slice(0, 3)
          .map((i) => i.name)
          .join(', ')
      : 'Eigene Mahlzeit';

  return {
    id: `meal_${params.date}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    date: params.date,
    timestamp: new Date().toISOString(),
    category: params.category,
    title: params.title?.trim() || categoryTitles[params.category],
    subtitle,
    imageUrl: params.imageUrl || params.items.find((i) => i.imageUrl)?.imageUrl,
    items: params.items,
    totalCalories,
    proteinG,
    carbsG,
    fatG,
    fiberG,
    analysisNote: params.analysisNote,
  };
}

/**
 * Local Natural-Language Meal Parser (German)
 * Works 100% offline/without API key by extracting quantities (e.g. "80g Haferflocken, 60g Blaubeeren, 150g griechischer Joghurt").
 */
export function parseNaturalMealTextLocally(text: string): MealFoodItem[] {
  const lower = text.toLowerCase();
  const matched: MealFoodItem[] = [];
  const usedIds = new Set<string>();

  for (const food of LOCAL_FOOD_DATABASE) {
    const matchedKeyword = food.keywords.find((kw) => lower.includes(kw));
    if (!matchedKeyword || usedIds.has(food.id)) continue;
    usedIds.add(food.id);

    // Look for an explicit gram/ml/piece quantity immediately before the keyword
    const escaped = matchedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const gramMatch = lower.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:g|gr|gramm|ml)\\s*(?:\\w+\\s*){0,2}${escaped}`));
    const pieceMatch = lower.match(new RegExp(`(\\d+)\\s*(?:st(?:ü|u)ck|el|tl|scoop|scheiben?)?\\s*${escaped}`));

    let grams = food.defaultGrams;
    if (gramMatch) {
      grams = Math.max(5, Math.round(parseFloat(gramMatch[1].replace(',', '.'))));
    } else if (pieceMatch) {
      const count = parseInt(pieceMatch[1], 10);
      if (count > 0 && count <= 10) {
        grams = Math.round(food.defaultGrams * (count / (food.id === 'eier' ? 2 : 1)));
      }
    }

    matched.push(scaleFoodItem(food, grams));
  }

  return matched;
}

export function createSeedMealsForDate(todayKey: string): MealEntry[] {
  return [
    {
      id: `meal_seed_breakfast_${todayKey}`,
      date: todayKey,
      timestamp: `${todayKey}T07:50:00`,
      category: 'breakfast',
      title: 'Frühstück',
      subtitle: 'Haferflocken mit Beeren',
      imageUrl: '/src/assets/images/meal_oatmeal_berries_1795248984774.jpg',
      items: [
        {
          id: 'seed_oats',
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
          id: 'seed_berries',
          name: 'Blaubeeren & Erdbeeren',
          grams: 90,
          calories: 46,
          proteinG: 0.6,
          carbsG: 11.2,
          fatG: 0.3,
          fiberG: 2.1,
          source: 'local_db',
        },
        {
          id: 'seed_yogurt_b',
          name: 'Griechischer Joghurt & Chia',
          grams: 165,
          calories: 170,
          proteinG: 16.0,
          carbsG: 11.8,
          fatG: 9.1,
          fiberG: 5.1,
          source: 'local_db',
        },
      ],
      totalCalories: 520,
      proteinG: 27.4,
      carbsG: 70.0,
      fatG: 15.0,
      fiberG: 15.2,
    },
    {
      id: `meal_seed_lunch_${todayKey}`,
      date: todayKey,
      timestamp: `${todayKey}T12:45:00`,
      category: 'lunch',
      title: 'Mittagessen',
      subtitle: 'Hähnchen-Bowl',
      imageUrl: '/src/assets/images/meal_chicken_bowl_1795248983766.jpg',
      items: [
        {
          id: 'seed_chicken',
          name: 'Hähnchenbrust gegrillt',
          grams: 220,
          calories: 363,
          proteinG: 68.2,
          carbsG: 0,
          fatG: 7.9,
          fiberG: 0,
          source: 'local_db',
        },
        {
          id: 'seed_rice',
          name: 'Vollkornreis gekocht',
          grams: 220,
          calories: 271,
          proteinG: 5.9,
          carbsG: 56.3,
          fatG: 2.2,
          fiberG: 4.0,
          source: 'local_db',
        },
        {
          id: 'seed_avocado',
          name: 'Avocado & Cherrytomaten',
          grams: 130,
          calories: 146,
          proteinG: 2.5,
          carbsG: 9.7,
          fatG: 11.9,
          fiberG: 5.5,
          source: 'local_db',
        },
      ],
      totalCalories: 780,
      proteinG: 76.6,
      carbsG: 66.0,
      fatG: 22.0,
      fiberG: 9.5,
    },
    {
      id: `meal_seed_snack_${todayKey}`,
      date: todayKey,
      timestamp: `${todayKey}T16:15:00`,
      category: 'snack',
      title: 'Snack',
      subtitle: 'Joghurt mit Nüssen',
      imageUrl: '/src/assets/images/meal_yogurt_nuts_1795248986361.jpg',
      items: [
        {
          id: 'seed_skyr_s',
          name: 'Griechischer Joghurt',
          grams: 140,
          calories: 126,
          proteinG: 12.6,
          carbsG: 5.0,
          fatG: 7.0,
          fiberG: 0,
          source: 'local_db',
        },
        {
          id: 'seed_nuts_s',
          name: 'Mandeln, Walnüsse & Beeren',
          grams: 28,
          calories: 114,
          proteinG: 2.8,
          carbsG: 4.2,
          fatG: 9.8,
          fiberG: 1.9,
          source: 'local_db',
        },
      ],
      totalCalories: 240,
      proteinG: 15.4,
      carbsG: 9.2,
      fatG: 16.8,
      fiberG: 1.9,
    },
  ];
}
