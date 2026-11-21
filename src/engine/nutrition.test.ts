import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMealEntryFromItems,
  calculateMifflinStJeorBMR,
  calculateNutritionTargets,
  parseNaturalMealTextLocally,
  summarizeMealsForDate,
} from './nutrition';
import { createDefaultProfile } from '../data/mockGenerator';
import {
  AIAnalysisProgress,
  analyzeMealWithAI,
  estimateStreamProgress,
} from '../services/aiNutrition';

test('Mifflin-St Jeor BMR calculates expected clinical values for male and female', () => {
  const maleBmr = calculateMifflinStJeorBMR({
    weightKg: 75,
    heightCm: 180,
    age: 21,
    biologicalSex: 'male',
  });
  // 10*75 + 6.25*180 - 5*21 + 5 = 750 + 1125 - 105 + 5 = 1775
  assert.equal(maleBmr, 1775);

  const femaleBmr = calculateMifflinStJeorBMR({
    weightKg: 62,
    heightCm: 168,
    age: 28,
    biologicalSex: 'female',
  });
  // 620 + 1050 - 140 - 161 = 1369
  assert.equal(femaleBmr, 1369);
});

test('Adaptive nutrition targets scale with active calories and goal mode', () => {
  const profile = createDefaultProfile({ weightKg: 75, heightCm: 180, age: 21, nutritionGoalMode: 'maintain' });
  const restTargets = calculateNutritionTargets(profile, 150);
  const hardDayTargets = calculateNutritionTargets(profile, 800);

  assert.ok(hardDayTargets.caloriesKcal > restTargets.caloriesKcal);
  assert.ok(restTargets.proteinG >= 120);
  assert.ok(restTargets.fiberG >= 30);

  const cutTargets = calculateNutritionTargets({ ...profile, nutritionGoalMode: 'cut' }, 450);
  const buildTargets = calculateNutritionTargets({ ...profile, nutritionGoalMode: 'build' }, 450);
  assert.ok(buildTargets.caloriesKcal > cutTargets.caloriesKcal);
});

test('Local German meal parser extracts explicit gram amounts and computes macros', () => {
  const items = parseNaturalMealTextLocally('80g Haferflocken, 60g Blaubeeren und 150g griechischer Joghurt');
  assert.equal(items.length, 3);
  const oats = items.find((i) => i.name.includes('Haferflocken'));
  assert.equal(oats?.grams, 80);
  assert.equal(oats?.calories, 304);

  const meal = buildMealEntryFromItems({
    date: '2026-11-21',
    category: 'breakfast',
    items,
  });
  assert.equal(meal.totalCalories, 473);
  const summary = summarizeMealsForDate([meal], '2026-11-21');
  assert.equal(summary.totalCalories, 473);
  assert.ok(summary.proteinG > 20);
});

test('AI meal analysis reports monotonic streaming progress from preparing to 100% done', async () => {
  const p0 = estimateStreamProgress(0, 0);
  const pMid = estimateStreamProgress(240, 2);
  const pHigh = estimateStreamProgress(900, 4);
  assert.ok(p0 >= 28 && p0 < pMid && pMid < pHigh && pHigh <= 90);

  const events: AIAnalysisProgress[] = [];
  const res = await analyzeMealWithAI({
    description: '80g Haferflocken und 150g Skyr',
    settings: {
      provider: 'gemini',
      apiKey: '',
      ollamaUrl: 'http://localhost:11434',
      ollamaModel: 'llava',
      localRecommendationsOnly: true,
      sendPhotosOnDemandOnly: true,
      localProcessingOnly: true,
      backgroundSync: true,
    },
    onProgress: (p) => events.push(p),
  });

  assert.ok(res.items.length >= 2);
  assert.ok(events.length >= 3);
  assert.equal(events[0].stage, 'preparing');
  assert.equal(events[events.length - 1].stage, 'done');
  assert.equal(events[events.length - 1].percent, 100);
  for (let i = 1; i < events.length; i++) {
    assert.ok(events[i].percent >= events[i - 1].percent);
  }
});
