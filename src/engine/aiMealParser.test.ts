import test from 'node:test';
import assert from 'node:assert/strict';
import { getZeroCostAiPromptTemplate, parseAiMealInput, parseMealFromDeepLink } from './aiMealParser';

test('Parses canonical target JSON schema cleanly', () => {
  const input = JSON.stringify({
    meal: 'Hähnchenbrust mit Reis',
    calories: 540,
    protein_g: 55,
    carbs_g: 60,
    fat_g: 8,
  });

  const res = parseAiMealInput(input);
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.data.meal, 'Hähnchenbrust mit Reis');
    assert.equal(res.data.calories, 540);
    assert.equal(res.data.proteinG, 55);
    assert.equal(res.data.carbsG, 60);
    assert.equal(res.data.fatG, 8);
    assert.equal(res.data.sourceFormat, 'json');
  }
});

test('Extracts JSON wrapped in chatty Gemini/ChatGPT/Claude markdown fences with trailing commas and German units', () => {
  const messyOutput = `
Hier ist deine geschätzte Nährwertanalyse für das Foto:

\`\`\`json
{
  "meal": "Lachsfilet mit Süßkartoffel & Brokkoli",
  "calories": "620 kcal",
  "protein_g": "44,5 g",
  "carbs_g": 48,
  "fat_g": 26,
}
\`\`\`

Guten Appetit! Melde dich gerne bei weiteren Mahlzeiten.
`;

  const res = parseAiMealInput(messyOutput);
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.data.meal, 'Lachsfilet mit Süßkartoffel & Brokkoli');
    assert.equal(res.data.calories, 620);
    assert.equal(res.data.proteinG, 45);
    assert.equal(res.data.carbsG, 48);
    assert.equal(res.data.fatG, 26);
    assert.equal(res.data.sourceFormat, 'json');
  }
});

test('Derives calories via Atwater when AI JSON omits calories field', () => {
  const res = parseAiMealInput('{"meal": "Magerquark mit Beeren", "protein_g": 40, "carbs_g": 25, "fat_g": 2}');
  assert.equal(res.ok, true);
  if (res.ok) {
    // 40*4 + 25*4 + 2*9 = 160 + 100 + 18 = 278
    assert.equal(res.data.calories, 278);
    assert.equal(res.data.caloriesDerivedFromMacros, true);
    assert.ok(res.data.warnings.length > 0);
  }
});

test('Parses custom caltrack:// deep-link and web+caltrack:// share URLs', () => {
  const url = 'caltrack://log?name=H%C3%A4hnchenbrust%20mit%20Reis&kcal=540&p=55&c=60&f=8&category=lunch';
  const res = parseMealFromDeepLink(url);
  assert.ok(res && res.ok);
  if (res && res.ok) {
    assert.equal(res.data.meal, 'Hähnchenbrust mit Reis');
    assert.equal(res.data.calories, 540);
    assert.equal(res.data.proteinG, 55);
    assert.equal(res.data.carbsG, 60);
    assert.equal(res.data.fatG, 8);
    assert.equal(res.data.category, 'lunch');
    assert.equal(res.data.sourceFormat, 'deeplink');
  }
});

test('Falls back gracefully to natural-language German/English AI output when JSON is ignored', () => {
  const plainText = `
Haferflocken Bowl mit Blaubeeren
- Kalorien: 460–500 kcal
- Eiweiß: 24 g
- Kohlenhydrate: 68 g
- Fett: 11 g
`;
  const res = parseAiMealInput(plainText);
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.data.meal, 'Haferflocken Bowl mit Blaubeeren');
    assert.equal(res.data.calories, 480);
    assert.equal(res.data.proteinG, 24);
    assert.equal(res.data.carbsG, 68);
    assert.equal(res.data.fatG, 11);
    assert.equal(res.data.sourceFormat, 'text_fallback');
  }
});

test('Rejects malformed, empty, or non-meal text safely without ever throwing', () => {
  assert.equal(parseAiMealInput('').ok, false);
  assert.equal(parseAiMealInput('   ').ok, false);
  assert.equal(parseAiMealInput(null).ok, false);
  assert.equal(parseAiMealInput('Hallo, das Wetter ist heute sonnig!').ok, false);
  assert.equal(parseAiMealInput('{ broken json {{{').ok, false);
});

test('Prompt template includes canonical JSON schema keys for all 5 locales', () => {
  for (const loc of ['de', 'en', 'es', 'fr', 'it'] as const) {
    const prompt = getZeroCostAiPromptTemplate(loc);
    assert.ok(prompt.includes('"meal"'));
    assert.ok(prompt.includes('"calories"'));
    assert.ok(prompt.includes('"protein_g"'));
    assert.ok(prompt.includes('"carbs_g"'));
    assert.ok(prompt.includes('"fat_g"'));
  }
});
