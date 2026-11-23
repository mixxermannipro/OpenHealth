import { AppLocale, DemoScenarioId, SportType } from '../types/health';
import { de, ExplanationEntry, ExplanationTopic } from './de';

export interface LocaleMeta {
  id: AppLocale;
  nativeName: string;
  shortCode: string;
  bcp47: string;
}

export const SUPPORTED_LOCALES: LocaleMeta[] = [
  { id: 'de', nativeName: 'Deutsch', shortCode: 'DE', bcp47: 'de-DE' },
  { id: 'en', nativeName: 'English', shortCode: 'EN', bcp47: 'en-US' },
  { id: 'es', nativeName: 'Español', shortCode: 'ES', bcp47: 'es-ES' },
  { id: 'fr', nativeName: 'Français', shortCode: 'FR', bcp47: 'fr-FR' },
  { id: 'it', nativeName: 'Italiano', shortCode: 'IT', bcp47: 'it-IT' },
];

const LOCALE_STORAGE_KEY = 'kadenz_locale';

let activeLocaleCache: AppLocale = (() => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY) as AppLocale | null;
      if (saved && SUPPORTED_LOCALES.some((l) => l.id === saved)) {
        return saved;
      }
    }
  } catch {
    // ignore storage restrictions
  }
  return 'de';
})();

export function getActiveLocale(): AppLocale {
  return activeLocaleCache;
}

export function setActiveLocaleSync(locale: AppLocale): void {
  activeLocaleCache = locale;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  } catch {
    // ignore
  }
}

export function getActiveBcp47(locale: AppLocale = activeLocaleCache): string {
  return SUPPORTED_LOCALES.find((l) => l.id === locale)?.bcp47 ?? 'de-DE';
}

export interface UITranslations {
  nav: {
    today: string;
    activity: string;
    sleep: string;
    nutrition: string;
    more: string;
    breathworkAction: string;
    checkInAction: string;
    localOnDevice: string;
  };
  greetings: {
    morning: string;
    day: string;
    evening: string;
  };
  common: {
    today: string;
    yesterday: string;
    back: string;
    next: string;
    save: string;
    cancel: string;
    edit: string;
    close: string;
    open: string;
    repeat: string;
    delete: string;
    remove: string;
    years: string;
    unitMin: string;
    localSaved: string;
    normal: string;
  };
  today: {
    recovery: string;
    recoveryOptimal: string;
    recoveryModerate: string;
    recoveryLow: string;
    recoveryDetails: string;
    fitnessAge: string;
    youngerThanAge: string;
    olderThanAge: string;
    matchesAge: string;
    sleep: string;
    strain: string;
    strainHigh: string;
    strainModerate: string;
    strainLight: string;
    hrv: string;
    calories: string;
    ofDailyGoal: string;
    recommendedToday: string;
    strainTargetPrefix: string;
    strainTargetTo: string;
    strainTargetHint: string;
    profileSettings: string;
  };
  checkin: {
    title: string;
    subtitle: string;
    sleepFeel: string;
    energy: string;
    moreOptions: string;
    feelingToday: string;
    sleepWord: string;
    sleepOptions: [string, string, string, string, string];
    energyOptions: [string, string, string, string, string];
  };
  activity: {
    title: string;
    activeCalories: string;
    ewmaBalance: string;
    optimalRange: string;
    hrZones: string;
    todayScope: string;
    weekScope: string;
    zone: string;
    todaysActivities: string;
    sessionSingular: string;
    sessionPlural: string;
    noWorkouts: string;
    simulatorTitle: string;
    simulatorSub: string;
    duration: string;
    avgHr: string;
    strainAfter: string;
    recoveryTomorrow: string;
    applyPreview: string;
    resetPreview: string;
    sportRun: string;
    sportStrength: string;
    sportCycle: string;
    strainLabels: Record<'Ruhe' | 'Leicht' | 'Moderat' | 'Hoch' | 'Maximal', string>;
  };
  sleep: {
    title: string;
    subtitle: string;
    duration: string;
    performance: string;
    noData: string;
    bedtime: string;
    wakeTime: string;
    efficiency: string;
    feltSleep: string;
    rateNow: string;
    watchVsFeeling: string;
    recommendedBedtime: string;
    bedtimeHint: string;
    caffeineCutoffPrefix: string;
    caffeineCutoffSuffix: string;
    caffeineHint: string;
    stages: { deep: string; rem: string; light: string; awake: string };
  };
  recovery: {
    title: string;
    backToOverview: string;
    statusOptimal: string;
    statusModerate: string;
    statusLow: string;
    statusRest: string;
    hrvFull: string;
    rhr: string;
    respRate: string;
    breathingTitle: string;
    breathingSub: string;
    feelingTitle: string;
    feelingEdit: string;
    feelingNow: string;
    objectiveVsFeeling: string;
    hrv7d: string;
    hrv30d: string;
    hrvTrend: string;
    week: string;
    month: string;
    year: string;
    breakdownTitle: string;
    habitsTitle: string;
  };
  nutrition: {
    title: string;
    logMeal: string;
    remaining: string;
    overBudget: string;
    eaten: string;
    baseNeed: string;
    active: string;
    goal: string;
    deficitLabel: string;
    surplusLabel: string;
    maintainLabel: string;
    wearableFormulaNote: string;
    manualFormulaNote: string;
    adjustPlan: string;
    protein: string;
    carbs: string;
    fat: string;
    fiber: string;
    aiPhoto: string;
    scan: string;
    search: string;
    voice: string;
    water: string;
    nothingLogged: string;
    repeatedNote: string;
    slots: {
      breakfast: string;
      lunch: string;
      dinner: string;
      snack: string;
    };
  };
  nutritionOnboarding: {
    badge: string;
    stepOf: string;
    step1Title: string;
    step1Sub: string;
    goalCut: string;
    goalCutDesc: string;
    goalMaintain: string;
    goalMaintainDesc: string;
    goalBuild: string;
    goalBuildDesc: string;
    dailyDeltaLabelCut: string;
    dailyDeltaLabelBuild: string;
    approxPerWeek: string;
    step2Title: string;
    step2Sub: string;
    sex: string;
    sexMale: string;
    sexFemale: string;
    sexDiverse: string;
    age: string;
    height: string;
    weight: string;
    liveBmrLabel: string;
    step3Title: string;
    step3Sub: string;
    hasWearableTitle: string;
    hasWearableDesc: string;
    noWearableTitle: string;
    noWearableDesc: string;
    neatQuestion: string;
    neatHint: string;
    neatSedentary: string;
    neatSedentaryDesc: string;
    neatMixed: string;
    neatMixedDesc: string;
    neatActive: string;
    neatActiveDesc: string;
    palQuestion: string;
    palHint: string;
    palSedentary: string;
    palLight: string;
    palModerate: string;
    palVeryActive: string;
    palAthlete: string;
    step4Title: string;
    step4Sub: string;
    formulaBase: string;
    formulaActive: string;
    formulaGoal: string;
    formulaTotal: string;
    activeGuarantee: string;
    activateCta: string;
  };
  more: {
    title: string;
    subtitle: string;
    sourcesTitle: string;
    sourcesSubPrefix: string;
    aiPrivacyTitle: string;
    aiPrivacySub: string;
    trendsTitle: string;
    trendsSub: string;
    breathworkTitle: string;
    breathworkSub: string;
    journalTitle: string;
    journalSub: string;
    profileTitle: string;
    appearanceTitle: string;
    themeDark: string;
    themeLight: string;
    themeSystem: string;
    languageLabel: string;
    languageSub: string;
    hapticsTitle: string;
    hapticsSub: string;
    scenariosTitle: string;
    scenariosSub: string;
    pwaTitle: string;
    pwaSub: string;
    localActive: string;
    storageTitle: string;
    exportBtn: string;
    importBtn: string;
    resetBtn: string;
    sourcesHero1: string;
    sourcesHero2: string;
    sourcesDesc: string;
    connectedSourcesLabel: string;
    settingsLabel: string;
    connected: string;
    add: string;
    disconnect: string;
    xmlReady: string;
    localProcessing: string;
    localProcessingSub: string;
    bgSync: string;
    bgSyncSub: string;
    openImportTitle: string;
    openImportSub: string;
    chooseFile: string;
    aiHeading: string;
    aiSub: string;
    aiProvidersTitle: string;
    aiProvidersSub: string;
    apiKeyTitle: string;
    apiKeySub: string;
    ollamaTitle: string;
    ollamaSub: string;
    localProcessTitle: string;
    localProcessSub: string;
    onDeviceRecs: string;
    photosOnDemand: string;
  };
  explanation: {
    defaultTitle: string;
    subtitle: string;
    shortSummary: string;
    howCalculated: string;
    whatItMeansForYou: string;
    technicalLabel: string;
  };
  sports: Record<SportType, string>;
  scenarios: Record<DemoScenarioId, { label: string; description: string }>;
}

const DE_UI: UITranslations = {
  nav: {
    today: 'Heute',
    activity: 'Belastung',
    sleep: 'Schlaf',
    nutrition: 'Essen',
    more: 'Mehr',
    breathworkAction: 'HRV-Atemübung',
    checkInAction: 'Tages-Check-in',
    localOnDevice: '100 % auf deinem Gerät',
  },
  greetings: {
    morning: 'Guten Morgen',
    day: 'Guten Tag',
    evening: 'Guten Abend',
  },
  common: {
    today: 'Heute',
    yesterday: 'Gestern',
    back: 'Zurück',
    next: 'Weiter',
    save: 'Speichern',
    cancel: 'Abbrechen',
    edit: 'Ändern',
    close: 'Schließen',
    open: 'Öffnen',
    repeat: 'Nochmal',
    delete: 'Löschen',
    remove: 'Entfernen',
    years: 'Jahre',
    unitMin: 'min',
    localSaved: 'Lokal gespeichert',
    normal: 'Normal',
  },
  today: {
    recovery: 'Erholung',
    recoveryOptimal: 'Optimal, bereit für Belastung.',
    recoveryModerate: 'Ausgeglichen, locker bis moderat.',
    recoveryLow: 'Heute bewusst regenerieren.',
    recoveryDetails: 'Details & HRV-Verlauf ansehen',
    fitnessAge: 'Fitnessalter',
    youngerThanAge: 'Jahre jünger als dein Alter',
    olderThanAge: 'Jahre über deinem Alter',
    matchesAge: 'Entspricht deinem Alter',
    sleep: 'Schlaf',
    strain: 'Belastung',
    strainHigh: 'Hohe Belastung heute.',
    strainModerate: 'Moderate Belastung heute.',
    strainLight: 'Lockere Belastung heute.',
    hrv: 'HRV',
    calories: 'Kalorien',
    ofDailyGoal: 'deines Tagesziels.',
    recommendedToday: 'Heute empfohlen',
    strainTargetPrefix: 'Belastung',
    strainTargetTo: 'bis',
    strainTargetHint: 'Bleibe in der grünen Zone für optimale Fortschritte.',
    profileSettings: 'Profil & Einstellungen',
  },
  checkin: {
    title: 'Wie fühlst du dich heute?',
    subtitle: '2 schnelle Tipps · fließt mit 18 % in deine Werte ein',
    sleepFeel: 'Schlafgefühl',
    energy: 'Energie',
    moreOptions: 'Mehr Optionen',
    feelingToday: 'Gefühl heute:',
    sleepWord: 'Schlaf',
    sleepOptions: ['Schlecht', 'Unruhig', 'Okay', 'Gut', 'Top'],
    energyOptions: ['Leer', 'Müde', 'Normal', 'Fit', 'Voll da'],
  },
  activity: {
    title: 'Belastung',
    activeCalories: 'Kalorien aktiv',
    ewmaBalance: 'EWMA Balance',
    optimalRange: 'Optimal 0,8–1,3',
    hrZones: 'Herzfrequenzzonen',
    todayScope: 'Heute',
    weekScope: '7 Tage',
    zone: 'Zone',
    todaysActivities: 'Heutige Aktivitäten',
    sessionSingular: 'Einheit',
    sessionPlural: 'Einheiten',
    noWorkouts: 'Heute sind noch keine Sporteinheiten erfasst — ideal für aktive Erholung oder eine Vorschau unten.',
    simulatorTitle: 'Trainings-Vorschau',
    simulatorSub: 'Belastung & morgige Erholung simulieren',
    duration: 'Dauer',
    avgHr: 'Ø Puls',
    strainAfter: 'Belastung danach',
    recoveryTomorrow: 'Erholung morgen',
    applyPreview: 'Vorschau übernehmen',
    resetPreview: 'Vorschau zurücksetzen',
    sportRun: 'Laufen',
    sportStrength: 'Kraft',
    sportCycle: 'Rad',
    strainLabels: {
      Ruhe: 'Ruhe',
      Leicht: 'Leicht',
      Moderat: 'Moderat',
      Hoch: 'Hoch',
      Maximal: 'Maximal',
    },
  },
  sleep: {
    title: 'Schlaf',
    subtitle: 'Besser schlafen. Ein gesünderes Ich.',
    duration: 'Schlafdauer',
    performance: 'Schlafleistung',
    noData: 'Für dieses Datum liegt keine Schlafaufzeichnung vor.',
    bedtime: 'Einschlafzeit',
    wakeTime: 'Aufwachzeit',
    efficiency: 'Schlafeffizienz',
    feltSleep: 'Gefühlter Schlaf',
    rateNow: 'Jetzt bewerten',
    watchVsFeeling: 'Uhr vs. Dein Schlafgefühl',
    recommendedBedtime: 'Empfohlene Schlafenszeit heute:',
    bedtimeHint: 'Ein erholsamer Schlaf hilft dir, konzentrierter und ausgeglichener zu sein.',
    caffeineCutoffPrefix: 'Koffein-Stopp ab',
    caffeineCutoffSuffix: 'Uhr',
    caffeineHint: '9 Std. vor Schlafenszeit für maximalen Tiefschlaf',
    stages: { deep: 'Tiefschlaf', rem: 'REM', light: 'Leicht', awake: 'Wach' },
  },
  recovery: {
    title: 'Erholung',
    backToOverview: 'Zurück zur Übersicht',
    statusOptimal: 'Optimal',
    statusModerate: 'Moderat',
    statusLow: 'Niedrig',
    statusRest: 'Schonung',
    hrvFull: 'Herzfrequenzvariabilität',
    rhr: 'Ruhepuls',
    respRate: 'Atemfrequenz',
    breathingTitle: 'HRV-Atmung',
    breathingSub: '5,5 s Resonanz',
    feelingTitle: 'Gefühl heute',
    feelingEdit: 'Check-in anpassen',
    feelingNow: 'Jetzt bewerten (18 %)',
    objectiveVsFeeling: 'Objektiv vs. Dein Gefühl',
    hrv7d: 'HRV, 7 Tage',
    hrv30d: 'HRV, 30 Tage',
    hrvTrend: 'HRV, Verlauf',
    week: 'Woche',
    month: 'Monat',
    year: 'Jahr',
    breakdownTitle: 'Zusammensetzung heute',
    habitsTitle: 'Was deine Erholung beeinflusst',
  },
  nutrition: {
    title: 'Essen',
    logMeal: 'Mahlzeit erfassen',
    remaining: 'Noch verfügbar',
    overBudget: 'Über Tagesbudget',
    eaten: 'Gegessen',
    baseNeed: 'Basis',
    active: 'Aktiv (100 %)',
    goal: 'Ziel',
    deficitLabel: 'Defizit',
    surplusLabel: 'Aufbau',
    maintainLabel: 'Halten',
    wearableFormulaNote: 'Aktivkalorien vom Wearable werden zu 100 % addiert — dein Ziel-Delta bleibt exakt.',
    manualFormulaNote: 'Berechnet über dein Aktivitätslevel (ohne Wearable).',
    adjustPlan: 'Kalorienplan anpassen',
    protein: 'Protein',
    carbs: 'Kohlenh.',
    fat: 'Fett',
    fiber: 'Ballaststoffe',
    aiPhoto: 'KI-Foto',
    scan: 'Scan',
    search: 'Suche',
    voice: 'Sprache',
    water: 'Wasser',
    nothingLogged: 'Noch nichts erfasst',
    repeatedNote: 'Wiederholt hinzugefügt',
    slots: {
      breakfast: 'Frühstück',
      lunch: 'Mittagessen',
      dinner: 'Abendessen',
      snack: 'Snacks',
    },
  },
  nutritionOnboarding: {
    badge: 'Kalorien-Setup',
    stepOf: 'Schritt',
    step1Title: 'Was ist dein Ziel?',
    step1Sub: 'Wähle dein gewünschtes Defizit, Halten oder deinen Aufbau — exakt auf die Kalorie.',
    goalCut: 'Defizit (Abnehmen)',
    goalCutDesc: 'Fett abbauen, Muskeln schützen',
    goalMaintain: 'Gewicht halten',
    goalMaintainDesc: 'Energie & Leistung im Gleichgewicht',
    goalBuild: 'Aufbau (Überschuss)',
    goalBuildDesc: 'Sauber Muskeln & Kraft aufbauen',
    dailyDeltaLabelCut: 'Tägliches Defizit',
    dailyDeltaLabelBuild: 'Täglicher Überschuss',
    approxPerWeek: 'ca. pro Woche',
    step2Title: 'Deine Körperdaten',
    step2Sub: 'Für deinen exakten Grundumsatz nach Mifflin-St Jeor — direkt aus deinem Profil vorausgefüllt.',
    sex: 'Biologisches Geschlecht',
    sexMale: 'Männlich',
    sexFemale: 'Weiblich',
    sexDiverse: 'Neutral',
    age: 'Alter',
    height: 'Größe (cm)',
    weight: 'Gewicht (kg)',
    liveBmrLabel: 'Dein Grundumsatz (BMR)',
    step3Title: 'Nutzt du ein Wearable?',
    step3Sub: 'Entscheidend, damit deine Sportkalorien niemals doppelt gezählt oder verschenkt werden.',
    hasWearableTitle: 'Ja, Wearable / Fitness-Tracker',
    hasWearableDesc: 'Apple Health, Health Connect, COROS, Garmin oder Polar liefert deine Aktivkalorien live.',
    noWearableTitle: 'Nein, kein Tracker',
    noWearableDesc: 'Wir berechnen deinen Bedarf über deine wöchentliche Bewegungsangabe.',
    neatQuestion: 'Wie sieht dein Alltag ohne Sport aus?',
    neatHint: 'Sport zählt extra zu 100 % — hier geht es nur um Beruf & normale Alltagsbewegung.',
    neatSedentary: 'Meist sitzend',
    neatSedentaryDesc: 'Büro, Studium, Homeoffice',
    neatMixed: 'Gemischt',
    neatMixedDesc: 'Viel stehend & gehend',
    neatActive: 'Körperlich aktiv',
    neatActiveDesc: 'Handwerk, Pflege, Gastro',
    palQuestion: 'Wie aktiv bist du insgesamt pro Woche?',
    palHint: 'Nur nötig ohne Fitness-Tracker — umfasst Alltag und Sport zusammen.',
    palSedentary: 'Wenig Bewegung (Büro, kaum Sport)',
    palLight: 'Leicht aktiv (1–3× lockerer Sport)',
    palModerate: 'Moderat aktiv (3–5× Training)',
    palVeryActive: 'Sehr aktiv (6–7× intensives Training)',
    palAthlete: 'Leistungssport (täglich hart / körperlicher Beruf)',
    step4Title: 'Dein persönlicher Plan',
    step4Sub: 'Transparent berechnet — passt sich ab jetzt jeden Tag automatisch an.',
    formulaBase: 'Grundbedarf (Alltag)',
    formulaActive: 'Aktivkalorien heute (100 %)',
    formulaGoal: 'Ziel-Anpassung',
    formulaTotal: 'Dein heutiges Tagesziel',
    activeGuarantee: 'Verbrennst du heute mehr Sportkalorien, steigt dein Tagesziel 1:1 mit — so fährst du immer genau das gewünschte Defizit oder den gewünschten Überschuss.',
    activateCta: 'Kalorienplan aktivieren',
  },
  more: {
    title: 'Mehr',
    subtitle: 'Datenquellen, Sprache, Privatsphäre & lokale Steuerung',
    sourcesTitle: 'Datenquellen',
    sourcesSubPrefix: 'verbunden · Health Connect, COROS, Garmin, GPX/TCX',
    aiPrivacyTitle: 'KI und Privatsphäre',
    aiPrivacySub: 'Eigener API-Key (Gemini, Claude, OpenAI, Ollama) · 100 % lokal',
    trendsTitle: 'Körper & Langzeit-Trends',
    trendsSub: 'VO2max, Gewicht, Korrelationen & 6-Monats-Verlauf',
    breathworkTitle: 'HRV-Resonanzatmung',
    breathworkSub: '5,5 s Biofeedback & 4-7-8 Einschlaf-Timer',
    journalTitle: 'Tagebuch Check-in',
    journalSub: 'Stress, Muskelkater, Koffein & Stimmung erfassen',
    profileTitle: 'Profil & persönliche Ziele',
    appearanceTitle: 'Erscheinungsbild, Sprache & Haptik',
    themeDark: 'Dunkel',
    themeLight: 'Hell',
    themeSystem: 'System',
    languageLabel: 'Sprache',
    languageSub: 'Sofortiger Wechsel ohne Neustart',
    hapticsTitle: 'Haptisches Feedback',
    hapticsSub: 'Dezente Vibration bei Gesten, Check-in & Speichern',
    scenariosTitle: 'Daten-Szenario testen',
    scenariosSub: 'Prüfe live, wie Erholung, Belastung & Empfehlungen auf verschiedene Zustände reagieren.',
    pwaTitle: 'App installieren & Offline-Modus',
    pwaSub: 'Funktioniert komplett lokal ohne Konto — installierbar auf Android, iOS & Desktop.',
    localActive: 'Lokal aktiv',
    storageTitle: 'Lokaler Speicher (IndexedDB)',
    exportBtn: 'Export',
    importBtn: 'Import',
    resetBtn: 'Reset',
    sourcesHero1: 'Deine Daten.',
    sourcesHero2: 'Dein Gerät.',
    sourcesDesc: 'Verbinde deine Quellen und behalte die Kontrolle über deine Daten — auf deinem Gerät.',
    connectedSourcesLabel: 'Verbundene Quellen',
    settingsLabel: 'Einstellungen',
    connected: 'Verbunden',
    add: 'Hinzufügen',
    disconnect: 'Trennen',
    xmlReady: 'XML-Import bereit',
    localProcessing: 'Lokale Verarbeitung',
    localProcessingSub: 'Deine Daten bleiben auf diesem Gerät.',
    bgSync: 'Im Hintergrund synchronisieren',
    bgSyncSub: 'Daten automatisch aktuell halten.',
    openImportTitle: 'Offener Datei-Import (100 % lokal)',
    openImportSub: 'Importiere echte Exporte von COROS, Garmin, Polar, Suunto (.gpx, .tcx), Apple Health (.xml) oder Health Connect (.json).',
    chooseFile: 'Datei auswählen (.gpx · .tcx · .xml · .json)',
    aiHeading: 'KI und Privatsphäre',
    aiSub: 'Lege fest, welchen KI-Anbieter du nutzen möchtest und wie deine Daten verarbeitet werden.',
    aiProvidersTitle: 'KI-Anbieter',
    aiProvidersSub: 'Wähle deinen bevorzugten Anbieter.',
    apiKeyTitle: 'API-Schlüssel',
    apiKeySub: 'Dein API-Schlüssel wird sicher auf diesem Gerät gespeichert.',
    ollamaTitle: 'Lokaler Ollama-Endpunkt',
    ollamaSub: 'Verbindet sich direkt mit deinem lokalen Ollama-Server — komplett offline.',
    localProcessTitle: 'Lokal verarbeiten',
    localProcessSub: 'Steuere, welche Daten auf deinem Gerät bleiben.',
    onDeviceRecs: 'Empfehlungen auf dem Gerät',
    photosOnDemand: 'Fotos nur auf Anfrage senden',
  },
  explanation: {
    defaultTitle: 'Erklärung',
    subtitle: 'Einfach erklärt · Keine medizinische Beratung',
    shortSummary: 'Kurz erklärt',
    howCalculated: 'Wie wird das berechnet?',
    whatItMeansForYou: 'Was bedeutet das für dich?',
    technicalLabel: 'Für Interessierte:',
  },
  sports: de.sports,
  scenarios: de.scenarios,
};

const EN_UI: UITranslations = {
  nav: {
    today: 'Today',
    activity: 'Strain',
    sleep: 'Sleep',
    nutrition: 'Nutrition',
    more: 'More',
    breathworkAction: 'HRV Breathwork',
    checkInAction: 'Daily Check-in',
    localOnDevice: '100% on your device',
  },
  greetings: {
    morning: 'Good morning',
    day: 'Good afternoon',
    evening: 'Good evening',
  },
  common: {
    today: 'Today',
    yesterday: 'Yesterday',
    back: 'Back',
    next: 'Continue',
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    close: 'Close',
    open: 'Open',
    repeat: 'Repeat',
    delete: 'Delete',
    remove: 'Remove',
    years: 'years',
    unitMin: 'min',
    localSaved: 'Saved locally',
    normal: 'Normal',
  },
  today: {
    recovery: 'Recovery',
    recoveryOptimal: 'Optimal, ready to perform.',
    recoveryModerate: 'Balanced, light to moderate.',
    recoveryLow: 'Focus on recovery today.',
    recoveryDetails: 'View details & HRV trend',
    fitnessAge: 'Fitness Age',
    youngerThanAge: 'years younger than your age',
    olderThanAge: 'years above your age',
    matchesAge: 'Matches your age',
    sleep: 'Sleep',
    strain: 'Strain',
    strainHigh: 'High strain today.',
    strainModerate: 'Moderate strain today.',
    strainLight: 'Light strain today.',
    hrv: 'HRV',
    calories: 'Calories',
    ofDailyGoal: 'of your daily goal.',
    recommendedToday: 'Recommended today',
    strainTargetPrefix: 'Strain',
    strainTargetTo: 'to',
    strainTargetHint: 'Stay in the green zone for optimal progress.',
    profileSettings: 'Profile & Settings',
  },
  checkin: {
    title: 'How do you feel today?',
    subtitle: '2 quick taps · weighted at 18% in your scores',
    sleepFeel: 'Sleep feeling',
    energy: 'Energy',
    moreOptions: 'More options',
    feelingToday: 'Feeling today:',
    sleepWord: 'Sleep',
    sleepOptions: ['Poor', 'Restless', 'Okay', 'Good', 'Great'],
    energyOptions: ['Drained', 'Tired', 'Normal', 'Ready', 'Energized'],
  },
  activity: {
    title: 'Strain',
    activeCalories: 'Active Calories',
    ewmaBalance: 'EWMA Balance',
    optimalRange: 'Optimal 0.8–1.3',
    hrZones: 'Heart Rate Zones',
    todayScope: 'Today',
    weekScope: '7 Days',
    zone: 'Zone',
    todaysActivities: "Today's Activities",
    sessionSingular: 'session',
    sessionPlural: 'sessions',
    noWorkouts: 'No workouts logged today yet — great for active recovery or testing a preview below.',
    simulatorTitle: 'Workout Preview',
    simulatorSub: "Simulate strain & tomorrow's recovery",
    duration: 'Duration',
    avgHr: 'Avg HR',
    strainAfter: 'Projected strain',
    recoveryTomorrow: 'Recovery tomorrow',
    applyPreview: 'Apply preview',
    resetPreview: 'Reset preview',
    sportRun: 'Run',
    sportStrength: 'Strength',
    sportCycle: 'Cycle',
    strainLabels: {
      Ruhe: 'Rest',
      Leicht: 'Light',
      Moderat: 'Moderate',
      Hoch: 'High',
      Maximal: 'All-out',
    },
  },
  sleep: {
    title: 'Sleep',
    subtitle: 'Sleep better. A healthier you.',
    duration: 'Sleep Duration',
    performance: 'Sleep Performance',
    noData: 'No sleep session recorded for this date.',
    bedtime: 'Time Asleep',
    wakeTime: 'Wake Time',
    efficiency: 'Sleep Efficiency',
    feltSleep: 'Perceived Sleep',
    rateNow: 'Rate now',
    watchVsFeeling: 'Tracker vs. How You Felt',
    recommendedBedtime: 'Recommended bedtime tonight:',
    bedtimeHint: 'Restorative sleep keeps you sharper, calmer, and better recovered.',
    caffeineCutoffPrefix: 'Caffeine cutoff at',
    caffeineCutoffSuffix: '',
    caffeineHint: '9 hrs before bedtime for maximum deep sleep',
    stages: { deep: 'Deep', rem: 'REM', light: 'Light', awake: 'Awake' },
  },
  recovery: {
    title: 'Recovery',
    backToOverview: 'Back to Overview',
    statusOptimal: 'Optimal',
    statusModerate: 'Moderate',
    statusLow: 'Low',
    statusRest: 'Rest',
    hrvFull: 'Heart Rate Variability',
    rhr: 'Resting Heart Rate',
    respRate: 'Respiratory Rate',
    breathingTitle: 'HRV Breathing',
    breathingSub: '5.5 s Resonance',
    feelingTitle: 'Feeling Today',
    feelingEdit: 'Edit check-in',
    feelingNow: 'Rate now (18%)',
    objectiveVsFeeling: 'Objective vs. How You Feel',
    hrv7d: 'HRV, 7 Days',
    hrv30d: 'HRV, 30 Days',
    hrvTrend: 'HRV, History',
    week: 'Week',
    month: 'Month',
    year: 'Year',
    breakdownTitle: "Today's Breakdown",
    habitsTitle: 'What Impacts Your Recovery',
  },
  nutrition: {
    title: 'Nutrition',
    logMeal: 'Log meal',
    remaining: 'Remaining',
    overBudget: 'Over daily target',
    eaten: 'Eaten',
    baseNeed: 'Base',
    active: 'Active (100%)',
    goal: 'Target',
    deficitLabel: 'Deficit',
    surplusLabel: 'Surplus',
    maintainLabel: 'Maintain',
    wearableFormulaNote: '100% of wearable active calories are added — your deficit or surplus stays exact.',
    manualFormulaNote: 'Calculated from your weekly activity level (no tracker).',
    adjustPlan: 'Adjust calorie plan',
    protein: 'Protein',
    carbs: 'Carbs',
    fat: 'Fat',
    fiber: 'Fiber',
    aiPhoto: 'AI Photo',
    scan: 'Scan',
    search: 'Search',
    voice: 'Voice',
    water: 'Water',
    nothingLogged: 'Nothing logged yet',
    repeatedNote: 'Repeated entry',
    slots: {
      breakfast: 'Breakfast',
      lunch: 'Lunch',
      dinner: 'Dinner',
      snack: 'Snacks',
    },
  },
  nutritionOnboarding: {
    badge: 'Calorie Setup',
    stepOf: 'Step',
    step1Title: 'What is your goal?',
    step1Sub: 'Pick your exact deficit, maintenance, or surplus down to the calorie.',
    goalCut: 'Deficit (Fat Loss)',
    goalCutDesc: 'Lose fat while protecting muscle',
    goalMaintain: 'Maintain Weight',
    goalMaintainDesc: 'Keep energy & performance balanced',
    goalBuild: 'Surplus (Build)',
    goalBuildDesc: 'Lean muscle & strength growth',
    dailyDeltaLabelCut: 'Daily Deficit',
    dailyDeltaLabelBuild: 'Daily Surplus',
    approxPerWeek: 'approx. per week',
    step2Title: 'Your Body Metrics',
    step2Sub: 'Used for your exact Mifflin-St Jeor resting metabolic rate — prefilled from your profile.',
    sex: 'Biological Sex',
    sexMale: 'Male',
    sexFemale: 'Female',
    sexDiverse: 'Neutral',
    age: 'Age',
    height: 'Height (cm)',
    weight: 'Weight (kg)',
    liveBmrLabel: 'Basal Metabolic Rate (BMR)',
    step3Title: 'Do you use a wearable?',
    step3Sub: 'Ensures your workout calories are never double-counted or lost.',
    hasWearableTitle: 'Yes, Wearable / Fitness Tracker',
    hasWearableDesc: 'Apple Health, Health Connect, COROS, Garmin, or Polar delivers your active calories.',
    noWearableTitle: 'No, without a tracker',
    noWearableDesc: 'We calculate your target from your weekly activity level instead.',
    neatQuestion: 'How active is your day outside workouts?',
    neatHint: 'Workouts are added 100% on top — this only reflects daily job & routine movement.',
    neatSedentary: 'Mostly seated',
    neatSedentaryDesc: 'Desk job, study, home office',
    neatMixed: 'Mixed',
    neatMixedDesc: 'Standing & walking regularly',
    neatActive: 'Physically active',
    neatActiveDesc: 'Trades, nursing, hospitality',
    palQuestion: 'How active are you overall per week?',
    palHint: 'Only needed without a tracker — combines daily life and exercise.',
    palSedentary: 'Sedentary (desk job, little exercise)',
    palLight: 'Lightly active (1–3× light workouts)',
    palModerate: 'Moderately active (3–5× workouts)',
    palVeryActive: 'Very active (6–7× intense training)',
    palAthlete: 'Athlete (hard daily training / physical job)',
    step4Title: 'Your Personal Plan',
    step4Sub: 'Transparently calculated — adapts dynamically every day.',
    formulaBase: 'Daily base need',
    formulaActive: 'Active calories today (100%)',
    formulaGoal: 'Goal adjustment',
    formulaTotal: "Today's calorie target",
    activeGuarantee: 'Burn more active calories through sports and your daily target increases 1:1 — keeping your exact chosen deficit or surplus intact.',
    activateCta: 'Activate Calorie Plan',
  },
  more: {
    title: 'More',
    subtitle: 'Data sources, language, privacy & local controls',
    sourcesTitle: 'Data Sources',
    sourcesSubPrefix: 'connected · Health Connect, COROS, Garmin, GPX/TCX',
    aiPrivacyTitle: 'AI & Privacy',
    aiPrivacySub: 'Bring your own API key (Gemini, Claude, OpenAI, Ollama) · 100% local',
    trendsTitle: 'Body & Long-Term Trends',
    trendsSub: 'VO2max, weight, correlations & 6-month history',
    breathworkTitle: 'HRV Resonance Breathing',
    breathworkSub: '5.5 s biofeedback & 4-7-8 sleep timer',
    journalTitle: 'Journal Check-in',
    journalSub: 'Log stress, soreness, caffeine & mood',
    profileTitle: 'Profile & Personal Goals',
    appearanceTitle: 'Appearance, Language & Haptics',
    themeDark: 'Dark',
    themeLight: 'Light',
    themeSystem: 'System',
    languageLabel: 'Language',
    languageSub: 'Instant switch without restart',
    hapticsTitle: 'Haptic Feedback',
    hapticsSub: 'Subtle vibration on gestures, check-in & saving',
    scenariosTitle: 'Test Data Scenarios',
    scenariosSub: 'Preview live how recovery, strain & guidance respond to different states.',
    pwaTitle: 'Install App & Offline Mode',
    pwaSub: 'Works 100% locally without an account — installable on Android, iOS & Desktop.',
    localActive: 'Local active',
    storageTitle: 'Local Storage (IndexedDB)',
    exportBtn: 'Export',
    importBtn: 'Import',
    resetBtn: 'Reset',
    sourcesHero1: 'Your Data.',
    sourcesHero2: 'Your Device.',
    sourcesDesc: 'Connect your sources and stay in full control — right on your device.',
    connectedSourcesLabel: 'Connected Sources',
    settingsLabel: 'Settings',
    connected: 'Connected',
    add: 'Add',
    disconnect: 'Disconnect',
    xmlReady: 'XML import ready',
    localProcessing: 'Local Processing',
    localProcessingSub: 'Your data stays on this device.',
    bgSync: 'Background Sync',
    bgSyncSub: 'Keep data automatically up to date.',
    openImportTitle: 'Open File Import (100% local)',
    openImportSub: 'Import real exports from COROS, Garmin, Polar, Suunto (.gpx, .tcx), Apple Health (.xml) or Health Connect (.json).',
    chooseFile: 'Choose file (.gpx · .tcx · .xml · .json)',
    aiHeading: 'AI & Privacy',
    aiSub: 'Choose your preferred AI provider and control how your data is processed.',
    aiProvidersTitle: 'AI Provider',
    aiProvidersSub: 'Select your preferred provider.',
    apiKeyTitle: 'API Key',
    apiKeySub: 'Your API key is stored securely on this device.',
    ollamaTitle: 'Local Ollama Endpoint',
    ollamaSub: 'Connects directly to your local Ollama server — completely offline.',
    localProcessTitle: 'Process Locally',
    localProcessSub: 'Control which data never leaves your device.',
    onDeviceRecs: 'On-device recommendations',
    photosOnDemand: 'Send photos on demand only',
  },
  explanation: {
    defaultTitle: 'Explanation',
    subtitle: 'Simply explained · Not medical advice',
    shortSummary: 'In short',
    howCalculated: 'How is it calculated?',
    whatItMeansForYou: 'What does this mean for you?',
    technicalLabel: 'Methodology:',
  },
  sports: {
    running: 'Running',
    walking: 'Walking',
    cycling: 'Cycling',
    strength: 'Strength Training',
    calisthenics: 'Calisthenics',
    swimming: 'Swimming',
    hiking: 'Hiking',
    football: 'Football',
    other: 'Other',
  },
  scenarios: {
    balanced: {
      label: 'Balanced Routine',
      description: 'Consistent running, calm sleep, well-matched strain, and fresh energy.',
    },
    fatigued: {
      label: 'Fatigued & Overreached',
      description: 'Several hard days in a row, short sleep, elevated resting HR, and recovery cue.',
    },
    recovering: {
      label: 'On the Way Back',
      description: 'Calmer days, steady sleep returning, and gradually rising freshness.',
    },
  },
};

const ES_UI: UITranslations = {
  nav: {
    today: 'Hoy',
    activity: 'Esfuerzo',
    sleep: 'Sueño',
    nutrition: 'Comida',
    more: 'Más',
    breathworkAction: 'Respiración HRV',
    checkInAction: 'Check-in diario',
    localOnDevice: '100 % en tu dispositivo',
  },
  greetings: {
    morning: 'Buenos días',
    day: 'Buenas tardes',
    evening: 'Buenas noches',
  },
  common: {
    today: 'Hoy',
    yesterday: 'Ayer',
    back: 'Atrás',
    next: 'Siguiente',
    save: 'Guardar',
    cancel: 'Cancelar',
    edit: 'Editar',
    close: 'Cerrar',
    open: 'Abrir',
    repeat: 'Repetir',
    delete: 'Eliminar',
    remove: 'Quitar',
    years: 'años',
    unitMin: 'min',
    localSaved: 'Guardado localmente',
    normal: 'Normal',
  },
  today: {
    recovery: 'Recuperación',
    recoveryOptimal: 'Óptima, listo para entrenar.',
    recoveryModerate: 'Equilibrada, suave a moderada.',
    recoveryLow: 'Prioriza descansar hoy.',
    recoveryDetails: 'Ver detalles y tendencia HRV',
    fitnessAge: 'Edad Fitness',
    youngerThanAge: 'años menor que tu edad',
    olderThanAge: 'años mayor que tu edad',
    matchesAge: 'Coincide con tu edad',
    sleep: 'Sueño',
    strain: 'Esfuerzo',
    strainHigh: 'Esfuerzo alto hoy.',
    strainModerate: 'Esfuerzo moderado hoy.',
    strainLight: 'Esfuerzo ligero hoy.',
    hrv: 'HRV',
    calories: 'Calorías',
    ofDailyGoal: 'de tu objetivo diario.',
    recommendedToday: 'Recomendado hoy',
    strainTargetPrefix: 'Esfuerzo',
    strainTargetTo: 'a',
    strainTargetHint: 'Mantente en la zona verde para progresar mejor.',
    profileSettings: 'Perfil y ajustes',
  },
  checkin: {
    title: '¿Cómo te sientes hoy?',
    subtitle: '2 toques rápidos · pondera un 18 % en tus valores',
    sleepFeel: 'Sensación de sueño',
    energy: 'Energía',
    moreOptions: 'Más opciones',
    feelingToday: 'Sensación hoy:',
    sleepWord: 'Sueño',
    sleepOptions: ['Malo', 'Inquieto', 'Normal', 'Bueno', 'Genial'],
    energyOptions: ['Sin fuerza', 'Cansado', 'Normal', 'Bien', 'A tope'],
  },
  activity: {
    title: 'Esfuerzo',
    activeCalories: 'Calorías activas',
    ewmaBalance: 'Balance EWMA',
    optimalRange: 'Óptimo 0,8–1,3',
    hrZones: 'Zonas cardíacas',
    todayScope: 'Hoy',
    weekScope: '7 Días',
    zone: 'Zona',
    todaysActivities: 'Actividades de hoy',
    sessionSingular: 'sesión',
    sessionPlural: 'sesiones',
    noWorkouts: 'Aún no hay entrenamientos hoy — ideal para recuperación activa o simular abajo.',
    simulatorTitle: 'Simulador de entreno',
    simulatorSub: 'Simula esfuerzo y recuperación de mañana',
    duration: 'Duración',
    avgHr: 'Pulso med.',
    strainAfter: 'Esfuerzo estimado',
    recoveryTomorrow: 'Recuperación mañana',
    applyPreview: 'Aplicar vista previa',
    resetPreview: 'Restablecer',
    sportRun: 'Correr',
    sportStrength: 'Fuerza',
    sportCycle: 'Bici',
    strainLabels: {
      Ruhe: 'Reposo',
      Leicht: 'Ligero',
      Moderat: 'Moderado',
      Hoch: 'Alto',
      Maximal: 'Máximo',
    },
  },
  sleep: {
    title: 'Sueño',
    subtitle: 'Dormir mejor. Una versión más sana de ti.',
    duration: 'Duración del sueño',
    performance: 'Rendimiento del sueño',
    noData: 'No hay registro de sueño para esta fecha.',
    bedtime: 'Hora de dormir',
    wakeTime: 'Hora de despertar',
    efficiency: 'Eficiencia',
    feltSleep: 'Sueño percibido',
    rateNow: 'Valorar ahora',
    watchVsFeeling: 'Reloj vs. tu sensación',
    recommendedBedtime: 'Hora recomendada hoy:',
    bedtimeHint: 'Un sueño reparador te ayuda a estar más concentrado y equilibrado.',
    caffeineCutoffPrefix: 'Sin cafeína desde las',
    caffeineCutoffSuffix: '',
    caffeineHint: '9 h antes de dormir para más sueño profundo',
    stages: { deep: 'Profundo', rem: 'REM', light: 'Ligero', awake: 'Despierto' },
  },
  recovery: {
    title: 'Recuperación',
    backToOverview: 'Volver al resumen',
    statusOptimal: 'Óptima',
    statusModerate: 'Moderada',
    statusLow: 'Baja',
    statusRest: 'Descanso',
    hrvFull: 'Variabilidad cardíaca',
    rhr: 'Pulso en reposo',
    respRate: 'Frecuencia respiratoria',
    breathingTitle: 'Respiración HRV',
    breathingSub: 'Resonancia 5,5 s',
    feelingTitle: 'Sensación hoy',
    feelingEdit: 'Editar check-in',
    feelingNow: 'Valorar ahora (18 %)',
    objectiveVsFeeling: 'Datos vs. tu sensación',
    hrv7d: 'HRV, 7 días',
    hrv30d: 'HRV, 30 días',
    hrvTrend: 'HRV, historial',
    week: 'Semana',
    month: 'Mes',
    year: 'Año',
    breakdownTitle: 'Desglose de hoy',
    habitsTitle: 'Qué influye en tu recuperación',
  },
  nutrition: {
    title: 'Comida',
    logMeal: 'Registrar comida',
    remaining: 'Disponible',
    overBudget: 'Sobre el objetivo',
    eaten: 'Consumido',
    baseNeed: 'Base',
    active: 'Activas (100 %)',
    goal: 'Objetivo',
    deficitLabel: 'Déficit',
    surplusLabel: 'Superávit',
    maintainLabel: 'Mantener',
    wearableFormulaNote: 'Se suma el 100 % de las calorías activas de tu reloj — tu déficit o superávit es exacto.',
    manualFormulaNote: 'Calculado con tu nivel de actividad semanal (sin reloj).',
    adjustPlan: 'Ajustar plan calórico',
    protein: 'Proteína',
    carbs: 'Carbos',
    fat: 'Grasa',
    fiber: 'Fibra',
    aiPhoto: 'Foto IA',
    scan: 'Escáner',
    search: 'Buscar',
    voice: 'Voz',
    water: 'Agua',
    nothingLogged: 'Sin registros aún',
    repeatedNote: 'Añadido de nuevo',
    slots: {
      breakfast: 'Desayuno',
      lunch: 'Almuerzo',
      dinner: 'Cena',
      snack: 'Snacks',
    },
  },
  nutritionOnboarding: {
    badge: 'Plan Calórico',
    stepOf: 'Paso',
    step1Title: '¿Cuál es tu objetivo?',
    step1Sub: 'Elige tu déficit exacto, mantenimiento o superávit al detalle.',
    goalCut: 'Déficit (Definir)',
    goalCutDesc: 'Perder grasa protegiendo el músculo',
    goalMaintain: 'Mantener peso',
    goalMaintainDesc: 'Energía y rendimiento equilibrados',
    goalBuild: 'Volumen (Superávit)',
    goalBuildDesc: 'Ganar músculo y fuerza limpiamente',
    dailyDeltaLabelCut: 'Déficit diario',
    dailyDeltaLabelBuild: 'Superávit diario',
    approxPerWeek: 'aprox. por semana',
    step2Title: 'Tus datos corporales',
    step2Sub: 'Para calcular tu metabolismo basal exacto (Mifflin-St Jeor).',
    sex: 'Sexo biológico',
    sexMale: 'Masculino',
    sexFemale: 'Femenino',
    sexDiverse: 'Neutro',
    age: 'Edad',
    height: 'Altura (cm)',
    weight: 'Peso (kg)',
    liveBmrLabel: 'Metabolismo basal (BMR)',
    step3Title: '¿Usas un reloj o tracker?',
    step3Sub: 'Clave para no contar doble tus entrenos ni perder calorías quemadas.',
    hasWearableTitle: 'Sí, reloj / tracker conectado',
    hasWearableDesc: 'Apple Health, Health Connect, COROS, Garmin o Polar envía tus calorías activas.',
    noWearableTitle: 'No, sin tracker',
    noWearableDesc: 'Calculamos tu gasto según tu actividad semanal.',
    neatQuestion: '¿Cómo es tu día sin contar el deporte?',
    neatHint: 'El deporte suma el 100 % aparte — esto es solo tu rutina laboral.',
    neatSedentary: 'Mayormente sentado',
    neatSedentaryDesc: 'Oficina, estudio, teletrabajo',
    neatMixed: 'Mixto',
    neatMixedDesc: 'De pie y caminando a menudo',
    neatActive: 'Físicamente activo',
    neatActiveDesc: 'Trabajo físico, hostelería, salud',
    palQuestion: '¿Cuál es tu actividad semanal total?',
    palHint: 'Solo necesario sin tracker — incluye rutina y deporte.',
    palSedentary: 'Sedentario (oficina, poco ejercicio)',
    palLight: 'Ligero (1–3× deporte suave)',
    palModerate: 'Moderado (3–5× entrenamientos)',
    palVeryActive: 'Muy activo (6–7× entreno intenso)',
    palAthlete: 'Atleta (entrenamiento duro diario)',
    step4Title: 'Tu plan personal',
    step4Sub: 'Cálculo transparente — se adapta automáticamente cada día.',
    formulaBase: 'Necesidad base diaria',
    formulaActive: 'Calorías activas hoy (100 %)',
    formulaGoal: 'Ajuste de objetivo',
    formulaTotal: 'Tu objetivo diario hoy',
    activeGuarantee: 'Si quemas más calorías entrenando, tu objetivo sube 1:1 para mantener siempre tu déficit o superávit exacto.',
    activateCta: 'Activar plan calórico',
  },
  more: {
    title: 'Más',
    subtitle: 'Fuentes de datos, idioma, privacidad y control local',
    sourcesTitle: 'Fuentes de datos',
    sourcesSubPrefix: 'conectadas · Health Connect, COROS, Garmin, GPX/TCX',
    aiPrivacyTitle: 'IA y Privacidad',
    aiPrivacySub: 'Tu propia clave API (Gemini, Claude, OpenAI, Ollama) · 100 % local',
    trendsTitle: 'Cuerpo y tendencias',
    trendsSub: 'VO2max, peso, correlaciones e historial de 6 meses',
    breathworkTitle: 'Respiración HRV',
    breathworkSub: 'Biofeedback 5,5 s y temporizador 4-7-8',
    journalTitle: 'Diario Check-in',
    journalSub: 'Registra estrés, agujetas, cafeína y ánimo',
    profileTitle: 'Perfil y objetivos',
    appearanceTitle: 'Apariencia, Idioma y Háptica',
    themeDark: 'Oscuro',
    themeLight: 'Claro',
    themeSystem: 'Sistema',
    languageLabel: 'Idioma',
    languageSub: 'Cambio inmediato sin reiniciar',
    hapticsTitle: 'Respuesta háptica',
    hapticsSub: 'Vibración sutil en gestos, check-in y al guardar',
    scenariosTitle: 'Probar escenarios',
    scenariosSub: 'Comprueba en vivo cómo reaccionan recuperación, esfuerzo y consejos.',
    pwaTitle: 'Instalar app y modo offline',
    pwaSub: 'Funciona 100 % local sin cuenta — instalable en Android, iOS y escritorio.',
    localActive: 'Local activo',
    storageTitle: 'Almacenamiento local (IndexedDB)',
    exportBtn: 'Exportar',
    importBtn: 'Importar',
    resetBtn: 'Reiniciar',
    sourcesHero1: 'Tus datos.',
    sourcesHero2: 'Tu dispositivo.',
    sourcesDesc: 'Conecta tus fuentes y mantén el control total en tu dispositivo.',
    connectedSourcesLabel: 'Fuentes conectadas',
    settingsLabel: 'Ajustes',
    connected: 'Conectado',
    add: 'Añadir',
    disconnect: 'Desconectar',
    xmlReady: 'Importación XML lista',
    localProcessing: 'Procesamiento local',
    localProcessingSub: 'Tus datos permanecen en este dispositivo.',
    bgSync: 'Sincronización en segundo plano',
    bgSyncSub: 'Mantén los datos actualizados automáticamente.',
    openImportTitle: 'Importación abierta (100 % local)',
    openImportSub: 'Importa archivos reales de COROS, Garmin, Polar, Suunto (.gpx, .tcx), Apple Health (.xml) o Health Connect (.json).',
    chooseFile: 'Elegir archivo (.gpx · .tcx · .xml · .json)',
    aiHeading: 'IA y Privacidad',
    aiSub: 'Elige tu proveedor de IA y controla cómo se procesan tus datos.',
    aiProvidersTitle: 'Proveedor de IA',
    aiProvidersSub: 'Selecciona tu proveedor preferido.',
    apiKeyTitle: 'Clave API',
    apiKeySub: 'Tu clave se guarda de forma segura en este dispositivo.',
    ollamaTitle: 'Servidor Ollama local',
    ollamaSub: 'Conexión directa a tu Ollama local — 100 % sin conexión.',
    localProcessTitle: 'Procesar localmente',
    localProcessSub: 'Controla qué datos nunca salen de tu dispositivo.',
    onDeviceRecs: 'Recomendaciones en el dispositivo',
    photosOnDemand: 'Enviar fotos solo bajo petición',
  },
  explanation: {
    defaultTitle: 'Explicación',
    subtitle: 'Explicado de forma sencilla · No es consejo médico',
    shortSummary: 'En resumen',
    howCalculated: '¿Cómo se calcula?',
    whatItMeansForYou: '¿Qué significa para ti?',
    technicalLabel: 'Metodología:',
  },
  sports: {
    running: 'Correr',
    walking: 'Caminar',
    cycling: 'Ciclismo',
    strength: 'Fuerza',
    calisthenics: 'Calistenia',
    swimming: 'Natación',
    hiking: 'Senderismo',
    football: 'Fútbol',
    other: 'Otro',
  },
  scenarios: {
    balanced: {
      label: 'Rutina equilibrada',
      description: 'Carreras regulares, sueño tranquilo, esfuerzo medido y buena energía.',
    },
    fatigued: {
      label: 'Fatigado y sobrecargado',
      description: 'Varios días duros seguidos, poco sueño, pulso alto y aviso de descanso.',
    },
    recovering: {
      label: 'Volviendo a la forma',
      description: 'Días más tranquilos, sueño estable y frescura en aumento.',
    },
  },
};

const FR_UI: UITranslations = {
  nav: {
    today: "Aujourd'hui",
    activity: 'Effort',
    sleep: 'Sommeil',
    nutrition: 'Repas',
    more: 'Plus',
    breathworkAction: 'Respiration VFC',
    checkInAction: 'Bilan du jour',
    localOnDevice: '100 % sur votre appareil',
  },
  greetings: {
    morning: 'Bonjour',
    day: 'Bon après-midi',
    evening: 'Bonsoir',
  },
  common: {
    today: "Aujourd'hui",
    yesterday: 'Hier',
    back: 'Retour',
    next: 'Continuer',
    save: 'Enregistrer',
    cancel: 'Annuler',
    edit: 'Modifier',
    close: 'Fermer',
    open: 'Ouvrir',
    repeat: 'Répéter',
    delete: 'Supprimer',
    remove: 'Retirer',
    years: 'ans',
    unitMin: 'min',
    localSaved: 'Enregistré localement',
    normal: 'Normal',
  },
  today: {
    recovery: 'Récupération',
    recoveryOptimal: "Optimale, prêt pour l'effort.",
    recoveryModerate: 'Équilibrée, léger à modéré.',
    recoveryLow: 'Privilégiez le repos aujourd’hui.',
    recoveryDetails: 'Voir détails & tendance VFC',
    fitnessAge: 'Âge Fitness',
    youngerThanAge: 'ans de moins que votre âge',
    olderThanAge: 'ans de plus que votre âge',
    matchesAge: 'Correspond à votre âge',
    sleep: 'Sommeil',
    strain: 'Effort',
    strainHigh: "Effort élevé aujourd'hui.",
    strainModerate: "Effort modéré aujourd'hui.",
    strainLight: "Effort léger aujourd'hui.",
    hrv: 'VFC',
    calories: 'Calories',
    ofDailyGoal: 'de votre objectif.',
    recommendedToday: "Recommandé aujourd'hui",
    strainTargetPrefix: 'Effort',
    strainTargetTo: 'à',
    strainTargetHint: 'Restez dans la zone verte pour progresser durablement.',
    profileSettings: 'Profil et réglages',
  },
  checkin: {
    title: 'Comment vous sentez-vous ?',
    subtitle: '2 appuis rapides · compte pour 18 % dans vos scores',
    sleepFeel: 'Ressenti du sommeil',
    energy: 'Énergie',
    moreOptions: 'Plus d’options',
    feelingToday: 'Ressenti du jour :',
    sleepWord: 'Sommeil',
    sleepOptions: ['Mauvais', 'Agité', 'Correct', 'Bon', 'Top'],
    energyOptions: ['Épuisé', 'Fatigué', 'Normal', 'En forme', 'Plein'],
  },
  activity: {
    title: 'Effort',
    activeCalories: 'Calories actives',
    ewmaBalance: 'Balance EWMA',
    optimalRange: 'Optimal 0,8–1,3',
    hrZones: 'Zones cardiaques',
    todayScope: "Aujourd'hui",
    weekScope: '7 Jours',
    zone: 'Zone',
    todaysActivities: 'Activités du jour',
    sessionSingular: 'séance',
    sessionPlural: 'séances',
    noWorkouts: "Aucune séance enregistrée aujourd'hui — idéal pour récupérer ou simuler ci-dessous.",
    simulatorTitle: 'Aperçu entraînement',
    simulatorSub: "Simuler l'effort et la récupération de demain",
    duration: 'Durée',
    avgHr: 'FC moy.',
    strainAfter: 'Effort projeté',
    recoveryTomorrow: 'Récupération demain',
    applyPreview: "Appliquer l'aperçu",
    resetPreview: 'Réinitialiser',
    sportRun: 'Course',
    sportStrength: 'Force',
    sportCycle: 'Vélo',
    strainLabels: {
      Ruhe: 'Repos',
      Leicht: 'Léger',
      Moderat: 'Modéré',
      Hoch: 'Élevé',
      Maximal: 'Maximal',
    },
  },
  sleep: {
    title: 'Sommeil',
    subtitle: 'Mieux dormir. Un corps plus sain.',
    duration: 'Durée du sommeil',
    performance: 'Performance du sommeil',
    noData: 'Aucune donnée de sommeil pour cette date.',
    bedtime: 'Coucher',
    wakeTime: 'Réveil',
    efficiency: 'Efficacité',
    feltSleep: 'Sommeil ressenti',
    rateNow: 'Évaluer',
    watchVsFeeling: 'Montre vs. votre ressenti',
    recommendedBedtime: 'Heure de coucher conseillée :',
    bedtimeHint: 'Un sommeil réparateur renforce votre concentration et votre équilibre.',
    caffeineCutoffPrefix: 'Stop caféine dès',
    caffeineCutoffSuffix: '',
    caffeineHint: '9 h avant le coucher pour un sommeil profond optimal',
    stages: { deep: 'Profond', rem: 'REM', light: 'Léger', awake: 'Éveillé' },
  },
  recovery: {
    title: 'Récupération',
    backToOverview: "Retour à l'accueil",
    statusOptimal: 'Optimale',
    statusModerate: 'Modérée',
    statusLow: 'Faible',
    statusRest: 'Repos',
    hrvFull: 'Variabilité cardiaque',
    rhr: 'Fréquence au repos',
    respRate: 'Fréquence respiratoire',
    breathingTitle: 'Respiration VFC',
    breathingSub: 'Résonance 5,5 s',
    feelingTitle: 'Ressenti du jour',
    feelingEdit: 'Modifier le bilan',
    feelingNow: 'Évaluer (18 %)',
    objectiveVsFeeling: 'Mesures vs. ressenti',
    hrv7d: 'VFC, 7 jours',
    hrv30d: 'VFC, 30 jours',
    hrvTrend: 'VFC, historique',
    week: 'Semaine',
    month: 'Mois',
    year: 'Année',
    breakdownTitle: "Composition aujourd'hui",
    habitsTitle: 'Ce qui influence votre récupération',
  },
  nutrition: {
    title: 'Repas',
    logMeal: 'Ajouter un repas',
    remaining: 'Restant',
    overBudget: 'Au-dessus du budget',
    eaten: 'Consommé',
    baseNeed: 'Base',
    active: 'Actives (100 %)',
    goal: 'Objectif',
    deficitLabel: 'Déficit',
    surplusLabel: 'Surplus',
    maintainLabel: 'Maintien',
    wearableFormulaNote: '100 % des calories actives de votre montre sont ajoutées — votre déficit ou surplus reste exact.',
    manualFormulaNote: "Calculé d'après votre niveau d'activité (sans montre).",
    adjustPlan: 'Ajuster le plan',
    protein: 'Protéines',
    carbs: 'Glucides',
    fat: 'Lipides',
    fiber: 'Fibres',
    aiPhoto: 'Photo IA',
    scan: 'Scan',
    search: 'Chercher',
    voice: 'Voix',
    water: 'Eau',
    nothingLogged: 'Rien enregistré',
    repeatedNote: 'Ajouté à nouveau',
    slots: {
      breakfast: 'Petit-déjeuner',
      lunch: 'Déjeuner',
      dinner: 'Dîner',
      snack: 'Collations',
    },
  },
  nutritionOnboarding: {
    badge: 'Plan Calorique',
    stepOf: 'Étape',
    step1Title: 'Quel est votre objectif ?',
    step1Sub: 'Définissez votre déficit exact, maintien ou surplus à la calorie près.',
    goalCut: 'Déficit (Sèche)',
    goalCutDesc: 'Perdre du gras en préservant le muscle',
    goalMaintain: 'Maintenir le poids',
    goalMaintainDesc: 'Énergie et performance équilibrées',
    goalBuild: 'Prise de masse',
    goalBuildDesc: 'Développer muscle et force proprement',
    dailyDeltaLabelCut: 'Déficit quotidien',
    dailyDeltaLabelBuild: 'Surplus quotidien',
    approxPerWeek: 'env. par semaine',
    step2Title: 'Vos données corporelles',
    step2Sub: 'Pour votre métabolisme de base exact (Mifflin-St Jeor).',
    sex: 'Sexe biologique',
    sexMale: 'Homme',
    sexFemale: 'Femme',
    sexDiverse: 'Neutre',
    age: 'Âge',
    height: 'Taille (cm)',
    weight: 'Poids (kg)',
    liveBmrLabel: 'Métabolisme de base (BMR)',
    step3Title: 'Utilisez-vous une montre ?',
    step3Sub: 'Pour ne jamais compter double vos séances ni perdre vos calories actives.',
    hasWearableTitle: 'Oui, montre / tracker connecté',
    hasWearableDesc: 'Apple Health, Health Connect, COROS, Garmin ou Polar transmet vos calories actives.',
    noWearableTitle: 'Non, sans tracker',
    noWearableDesc: "Calcul basé sur votre niveau d'activité hebdomadaire.",
    neatQuestion: 'Votre quotidien hors sport ?',
    neatHint: 'Le sport est ajouté à 100 % en plus — uniquement votre activité professionnelle.',
    neatSedentary: 'Surtout assis',
    neatSedentaryDesc: 'Bureau, études, télétravail',
    neatMixed: 'Mixte',
    neatMixedDesc: 'Debout et marche régulière',
    neatActive: 'Physiquement actif',
    neatActiveDesc: 'Artisanat, santé, restauration',
    palQuestion: 'Votre activité globale par semaine ?',
    palHint: 'Uniquement sans montre — regroupe quotidien et sport.',
    palSedentary: 'Sédentaire (bureau, peu de sport)',
    palLight: 'Léger (1–3× sport doux)',
    palModerate: 'Modéré (3–5× séances)',
    palVeryActive: 'Très actif (6–7× entraînements intenses)',
    palAthlete: 'Athlète (entraînement quotidien intense)',
    step4Title: 'Votre plan personnel',
    step4Sub: "Calcul transparent — s'adapte automatiquement chaque jour.",
    formulaBase: 'Besoin de base quotidien',
    formulaActive: "Calories actives aujourd'hui (100 %)",
    formulaGoal: "Ajustement d'objectif",
    formulaTotal: 'Votre objectif du jour',
    activeGuarantee: "Plus vous dépensez d'énergie au sport, plus votre objectif augmente 1:1 — votre déficit ou surplus choisi reste exact.",
    activateCta: 'Activer le plan calorique',
  },
  more: {
    title: 'Plus',
    subtitle: 'Sources de données, langue, confidentialité et contrôle local',
    sourcesTitle: 'Sources de données',
    sourcesSubPrefix: 'connectées · Health Connect, COROS, Garmin, GPX/TCX',
    aiPrivacyTitle: 'IA et Confidentialité',
    aiPrivacySub: 'Votre propre clé API (Gemini, Claude, OpenAI, Ollama) · 100 % local',
    trendsTitle: 'Corps et tendances',
    trendsSub: 'VO2max, poids, corrélations et suivi sur 6 mois',
    breathworkTitle: 'Respiration VFC',
    breathworkSub: 'Biofeedback 5,5 s & minuteur 4-7-8',
    journalTitle: 'Journal Check-in',
    journalSub: 'Suivez stress, courbatures, caféine et humeur',
    profileTitle: 'Profil et objectifs',
    appearanceTitle: 'Apparence, Langue et Haptique',
    themeDark: 'Sombre',
    themeLight: 'Clair',
    themeSystem: 'Système',
    languageLabel: 'Langue',
    languageSub: 'Changement instantané sans redémarrer',
    hapticsTitle: 'Retour haptique',
    hapticsSub: 'Vibration subtile sur les gestes, check-in et sauvegardes',
    scenariosTitle: 'Tester des scénarios',
    scenariosSub: 'Observez comment récupération, effort et conseils réagissent.',
    pwaTitle: 'Installer et mode hors ligne',
    pwaSub: '100 % local sans compte — installable sur Android, iOS et ordinateur.',
    localActive: 'Local actif',
    storageTitle: 'Stockage local (IndexedDB)',
    exportBtn: 'Exporter',
    importBtn: 'Importer',
    resetBtn: 'Réinitialiser',
    sourcesHero1: 'Vos données.',
    sourcesHero2: 'Votre appareil.',
    sourcesDesc: 'Connectez vos sources et gardez le contrôle total sur votre appareil.',
    connectedSourcesLabel: 'Sources connectées',
    settingsLabel: 'Réglages',
    connected: 'Connecté',
    add: 'Ajouter',
    disconnect: 'Déconnecter',
    xmlReady: 'Import XML prêt',
    localProcessing: 'Traitement local',
    localProcessingSub: 'Vos données restent sur cet appareil.',
    bgSync: 'Synchronisation auto',
    bgSyncSub: 'Garder les données à jour automatiquement.',
    openImportTitle: 'Import ouvert (100 % local)',
    openImportSub: 'Importez vos exports COROS, Garmin, Polar, Suunto (.gpx, .tcx), Apple Health (.xml) ou Health Connect (.json).',
    chooseFile: 'Choisir un fichier (.gpx · .tcx · .xml · .json)',
    aiHeading: 'IA et Confidentialité',
    aiSub: 'Choisissez votre fournisseur IA et maîtrisez le traitement de vos données.',
    aiProvidersTitle: 'Fournisseur IA',
    aiProvidersSub: 'Sélectionnez votre fournisseur préféré.',
    apiKeyTitle: 'Clé API',
    apiKeySub: 'Votre clé est enregistrée en sécurité sur cet appareil.',
    ollamaTitle: 'Serveur Ollama local',
    ollamaSub: 'Connexion directe à votre Ollama local — 100 % hors ligne.',
    localProcessTitle: 'Traitement local',
    localProcessSub: 'Choisissez ce qui ne quitte jamais votre appareil.',
    onDeviceRecs: "Recommandations sur l'appareil",
    photosOnDemand: 'Envoyer les photos uniquement sur demande',
  },
  explanation: {
    defaultTitle: 'Explication',
    subtitle: 'Expliqué simplement · Pas un avis médical',
    shortSummary: 'En bref',
    howCalculated: 'Comment est-ce calculé ?',
    whatItMeansForYou: 'Ce que cela signifie pour vous',
    technicalLabel: 'Méthodologie :',
  },
  sports: {
    running: 'Course à pied',
    walking: 'Marche',
    cycling: 'Cyclisme',
    strength: 'Musculation',
    calisthenics: 'Callisthénie',
    swimming: 'Natation',
    hiking: 'Randonnée',
    football: 'Football',
    other: 'Autre',
  },
  scenarios: {
    balanced: {
      label: 'Rythme équilibré',
      description: 'Courses régulières, sommeil calme, effort adapté et bonne énergie.',
    },
    fatigued: {
      label: 'Fatigué et surchargé',
      description: 'Plusieurs jours intenses, peu de sommeil, pouls élevé et alerte repos.',
    },
    recovering: {
      label: 'Retour en forme',
      description: 'Journées plus calmes, sommeil stable et fraîcheur en hausse.',
    },
  },
};

const IT_UI: UITranslations = {
  nav: {
    today: 'Oggi',
    activity: 'Sforzo',
    sleep: 'Sonno',
    nutrition: 'Nutrizione',
    more: 'Altro',
    breathworkAction: 'Respirazione HRV',
    checkInAction: 'Check-in giornaliero',
    localOnDevice: '100 % sul tuo dispositivo',
  },
  greetings: {
    morning: 'Buongiorno',
    day: 'Buon pomeriggio',
    evening: 'Buonasera',
  },
  common: {
    today: 'Oggi',
    yesterday: 'Ieri',
    back: 'Indietro',
    next: 'Avanti',
    save: 'Salva',
    cancel: 'Annulla',
    edit: 'Modifica',
    close: 'Chiudi',
    open: 'Apri',
    repeat: 'Ripeti',
    delete: 'Elimina',
    remove: 'Rimuovi',
    years: 'anni',
    unitMin: 'min',
    localSaved: 'Salvato in locale',
    normal: 'Normale',
  },
  today: {
    recovery: 'Recupero',
    recoveryOptimal: 'Ottimale, pronto a spingere.',
    recoveryModerate: 'Bilanciato, leggero o moderato.',
    recoveryLow: 'Oggi punta sul recupero.',
    recoveryDetails: 'Dettagli e andamento HRV',
    fitnessAge: 'Età Fitness',
    youngerThanAge: 'anni in meno della tua età',
    olderThanAge: 'anni in più della tua età',
    matchesAge: 'In linea con la tua età',
    sleep: 'Sonno',
    strain: 'Sforzo',
    strainHigh: 'Sforzo elevato oggi.',
    strainModerate: 'Sforzo moderato oggi.',
    strainLight: 'Sforzo leggero oggi.',
    hrv: 'HRV',
    calories: 'Calorie',
    ofDailyGoal: 'del tuo obiettivo.',
    recommendedToday: 'Consigliato oggi',
    strainTargetPrefix: 'Sforzo',
    strainTargetTo: 'a',
    strainTargetHint: 'Resta nella zona verde per progressi ottimali.',
    profileSettings: 'Profilo e impostazioni',
  },
  checkin: {
    title: 'Come ti senti oggi?',
    subtitle: '2 tocchi rapidi · pesa per il 18 % nei tuoi punteggi',
    sleepFeel: 'Sensazione sonno',
    energy: 'Energia',
    moreOptions: 'Altre opzioni',
    feelingToday: 'Sensazione oggi:',
    sleepWord: 'Sonno',
    sleepOptions: ['Scarso', 'Agitato', 'Ok', 'Buono', 'Top'],
    energyOptions: ['Scarico', 'Stanco', 'Normale', 'In forma', 'Carico'],
  },
  activity: {
    title: 'Sforzo',
    activeCalories: 'Calorie attive',
    ewmaBalance: 'Bilancio EWMA',
    optimalRange: 'Ottimale 0,8–1,3',
    hrZones: 'Zone cardiache',
    todayScope: 'Oggi',
    weekScope: '7 Giorni',
    zone: 'Zona',
    todaysActivities: 'Attività di oggi',
    sessionSingular: 'sessione',
    sessionPlural: 'sessioni',
    noWorkouts: 'Nessun allenamento oggi — perfetto per recupero attivo o per simulare qui sotto.',
    simulatorTitle: 'Simulatore allenamento',
    simulatorSub: 'Simula sforzo e recupero di domani',
    duration: 'Durata',
    avgHr: 'FC media',
    strainAfter: 'Sforzo previsto',
    recoveryTomorrow: 'Recupero domani',
    applyPreview: 'Applica anteprima',
    resetPreview: 'Ripristina',
    sportRun: 'Corsa',
    sportStrength: 'Forza',
    sportCycle: 'Bici',
    strainLabels: {
      Ruhe: 'Riposo',
      Leicht: 'Leggero',
      Moderat: 'Moderato',
      Hoch: 'Alto',
      Maximal: 'Massimale',
    },
  },
  sleep: {
    title: 'Sonno',
    subtitle: 'Dormi meglio. Un te più sano.',
    duration: 'Durata del sonno',
    performance: 'Qualità del sonno',
    noData: 'Nessuna sessione di sonno registrata per questa data.',
    bedtime: 'Addormentamento',
    wakeTime: 'Risveglio',
    efficiency: 'Efficienza',
    feltSleep: 'Sonno percepito',
    rateNow: 'Valuta ora',
    watchVsFeeling: 'Orologio vs. sensazione',
    recommendedBedtime: 'Ora consigliata stasera:',
    bedtimeHint: 'Un sonno ristoratore ti rende più lucido, calmo ed equilibrato.',
    caffeineCutoffPrefix: 'Stop caffeina dalle',
    caffeineCutoffSuffix: '',
    caffeineHint: '9 ore prima di dormire per massimo sonno profondo',
    stages: { deep: 'Profondo', rem: 'REM', light: 'Leggero', awake: 'Sveglio' },
  },
  recovery: {
    title: 'Recupero',
    backToOverview: 'Torna alla panoramica',
    statusOptimal: 'Ottimale',
    statusModerate: 'Moderato',
    statusLow: 'Basso',
    statusRest: 'Riposo',
    hrvFull: 'Variabilità cardiaca',
    rhr: 'Battito a riposo',
    respRate: 'Frequenza respiratoria',
    breathingTitle: 'Respirazione HRV',
    breathingSub: 'Risonanza 5,5 s',
    feelingTitle: 'Sensazione oggi',
    feelingEdit: 'Modifica check-in',
    feelingNow: 'Valuta ora (18 %)',
    objectiveVsFeeling: 'Dati vs. sensazione',
    hrv7d: 'HRV, 7 giorni',
    hrv30d: 'HRV, 30 giorni',
    hrvTrend: 'HRV, andamento',
    week: 'Settimana',
    month: 'Mese',
    year: 'Anno',
    breakdownTitle: 'Composizione di oggi',
    habitsTitle: 'Cosa influenza il tuo recupero',
  },
  nutrition: {
    title: 'Nutrizione',
    logMeal: 'Registra pasto',
    remaining: 'Disponibili',
    overBudget: 'Oltre il budget',
    eaten: 'Assunte',
    baseNeed: 'Base',
    active: 'Attive (100 %)',
    goal: 'Obiettivo',
    deficitLabel: 'Deficit',
    surplusLabel: 'Surplus',
    maintainLabel: 'Mantenimento',
    wearableFormulaNote: 'Il 100 % delle calorie attive del wearable viene sommato — il tuo deficit o surplus resta esatto.',
    manualFormulaNote: 'Calcolato dal tuo livello di attività settimanale (senza wearable).',
    adjustPlan: 'Modifica piano calorico',
    protein: 'Proteine',
    carbs: 'Carbo',
    fat: 'Grassi',
    fiber: 'Fibre',
    aiPhoto: 'Foto IA',
    scan: 'Scan',
    search: 'Cerca',
    voice: 'Voce',
    water: 'Acqua',
    nothingLogged: 'Ancora nulla',
    repeatedNote: 'Aggiunto di nuovo',
    slots: {
      breakfast: 'Colazione',
      lunch: 'Pranzo',
      dinner: 'Cena',
      snack: 'Spuntini',
    },
  },
  nutritionOnboarding: {
    badge: 'Piano Calorico',
    stepOf: 'Passo',
    step1Title: 'Qual è il tuo obiettivo?',
    step1Sub: 'Imposta deficit, mantenimento o surplus con precisione al singolo kcal.',
    goalCut: 'Deficit (Dimagrimento)',
    goalCutDesc: 'Perdere grasso preservando i muscoli',
    goalMaintain: 'Mantenere il peso',
    goalMaintainDesc: 'Energia e performance in equilibrio',
    goalBuild: 'Surplus (Massa)',
    goalBuildDesc: 'Costruire muscolo e forza in modo pulito',
    dailyDeltaLabelCut: 'Deficit giornaliero',
    dailyDeltaLabelBuild: 'Surplus giornaliero',
    approxPerWeek: 'circa a settimana',
    step2Title: 'I tuoi dati corporei',
    step2Sub: 'Per calcolare il metabolismo basale esatto (Mifflin-St Jeor).',
    sex: 'Sesso biologico',
    sexMale: 'Uomo',
    sexFemale: 'Donna',
    sexDiverse: 'Neutro',
    age: 'Età',
    height: 'Altezza (cm)',
    weight: 'Peso (kg)',
    liveBmrLabel: 'Metabolismo basale (BMR)',
    step3Title: 'Usi un wearable o tracker?',
    step3Sub: 'Fondamentale per non contare doppio gli allenamenti né perdere calorie bruciate.',
    hasWearableTitle: 'Sì, orologio / tracker connesso',
    hasWearableDesc: 'Apple Health, Health Connect, COROS, Garmin o Polar invia le calorie attive.',
    noWearableTitle: 'No, senza tracker',
    noWearableDesc: 'Calcoliamo il fabbisogno in base alla tua attività settimanale.',
    neatQuestion: 'Com’è la tua giornata senza lo sport?',
    neatHint: 'Lo sport si somma al 100 % a parte — conta solo lavoro e routine.',
    neatSedentary: 'Prevalentemente seduto',
    neatSedentaryDesc: 'Ufficio, studio, smart working',
    neatMixed: 'Misto',
    neatMixedDesc: 'Spesso in piedi e in movimento',
    neatActive: 'Fisicamente attivo',
    neatActiveDesc: 'Artigianato, sanità, ristorazione',
    palQuestion: 'Quanto sei attivo in totale a settimana?',
    palHint: 'Richiesto solo senza tracker — include routine e sport.',
    palSedentary: 'Sedentario (ufficio, poco sport)',
    palLight: 'Leggero (1–3× allenamenti leggeri)',
    palModerate: 'Moderato (3–5× allenamenti)',
    palVeryActive: 'Molto attivo (6–7× allenamenti intensi)',
    palAthlete: 'Atleta (allenamento duro quotidiano)',
    step4Title: 'Il tuo piano personale',
    step4Sub: 'Calcolo trasparente — si aggiorna automaticamente ogni giorno.',
    formulaBase: 'Fabbisogno base giornaliero',
    formulaActive: 'Calorie attive oggi (100 %)',
    formulaGoal: 'Regolazione obiettivo',
    formulaTotal: 'Il tuo obiettivo oggi',
    activeGuarantee: 'Se bruci più calorie con lo sport, il budget sale 1:1 così mantieni esattamente il deficit o surplus scelto.',
    activateCta: 'Attiva piano calorico',
  },
  more: {
    title: 'Altro',
    subtitle: 'Fonti dati, lingua, privacy e controllo locale',
    sourcesTitle: 'Fonti dati',
    sourcesSubPrefix: 'connesse · Health Connect, COROS, Garmin, GPX/TCX',
    aiPrivacyTitle: 'IA e Privacy',
    aiPrivacySub: 'La tua chiave API (Gemini, Claude, OpenAI, Ollama) · 100 % locale',
    trendsTitle: 'Corpo e trend',
    trendsSub: 'VO2max, peso, correlazioni e storico 6 mesi',
    breathworkTitle: 'Respirazione HRV',
    breathworkSub: 'Biofeedback 5,5 s e timer sonno 4-7-8',
    journalTitle: 'Diario Check-in',
    journalSub: 'Registra stress, indolenzimento, caffeina e umore',
    profileTitle: 'Profilo e obiettivi',
    appearanceTitle: 'Aspetto, Lingua e Aptica',
    themeDark: 'Scuro',
    themeLight: 'Chiaro',
    themeSystem: 'Sistema',
    languageLabel: 'Lingua',
    languageSub: 'Cambio immediato senza riavvio',
    hapticsTitle: 'Feedback aptico',
    hapticsSub: 'Vibrazione leggera su gesti, check-in e salvataggi',
    scenariosTitle: 'Testa scenari dati',
    scenariosSub: 'Verifica dal vivo come reagiscono recupero, sforzo e consigli.',
    pwaTitle: 'Installa app e modalità offline',
    pwaSub: 'Funziona 100 % in locale senza account — installabile su Android, iOS e Desktop.',
    localActive: 'Locale attivo',
    storageTitle: 'Archivio locale (IndexedDB)',
    exportBtn: 'Esporta',
    importBtn: 'Importa',
    resetBtn: 'Ripristina',
    sourcesHero1: 'I tuoi dati.',
    sourcesHero2: 'Il tuo dispositivo.',
    sourcesDesc: 'Collega le tue fonti e mantieni il pieno controllo sul tuo dispositivo.',
    connectedSourcesLabel: 'Fonti connesse',
    settingsLabel: 'Impostazioni',
    connected: 'Connesso',
    add: 'Aggiungi',
    disconnect: 'Disconnetti',
    xmlReady: 'Importazione XML pronta',
    localProcessing: 'Elaborazione locale',
    localProcessingSub: 'I tuoi dati restano su questo dispositivo.',
    bgSync: 'Sincronizzazione automatica',
    bgSyncSub: 'Mantieni i dati aggiornati automaticamente.',
    openImportTitle: 'Importazione aperta (100 % locale)',
    openImportSub: 'Importa esportazioni reali da COROS, Garmin, Polar, Suunto (.gpx, .tcx), Apple Health (.xml) o Health Connect (.json).',
    chooseFile: 'Scegli file (.gpx · .tcx · .xml · .json)',
    aiHeading: 'IA e Privacy',
    aiSub: 'Scegli il tuo provider IA e controlla come vengono elaborati i dati.',
    aiProvidersTitle: 'Provider IA',
    aiProvidersSub: 'Seleziona il provider preferito.',
    apiKeyTitle: 'Chiave API',
    apiKeySub: 'La tua chiave API è salvata in sicurezza su questo dispositivo.',
    ollamaTitle: 'Endpoint Ollama locale',
    ollamaSub: 'Si collega direttamente al tuo Ollama locale — completamente offline.',
    localProcessTitle: 'Elabora in locale',
    localProcessSub: 'Scegli quali dati non lasciano mai il dispositivo.',
    onDeviceRecs: 'Consigli sul dispositivo',
    photosOnDemand: 'Invia foto solo su richiesta',
  },
  explanation: {
    defaultTitle: 'Spiegazione',
    subtitle: 'Spiegato semplice · Non è un parere medico',
    shortSummary: 'In breve',
    howCalculated: 'Come viene calcolato?',
    whatItMeansForYou: 'Cosa significa per te?',
    technicalLabel: 'Metodologia:',
  },
  sports: {
    running: 'Corsa',
    walking: 'Camminata',
    cycling: 'Ciclismo',
    strength: 'Forza',
    calisthenics: 'Calisthenics',
    swimming: 'Nuoto',
    hiking: 'Escursionismo',
    football: 'Calcio',
    other: 'Altro',
  },
  scenarios: {
    balanced: {
      label: 'Routine equilibrata',
      description: 'Corsa regolare, sonno sereno, sforzo ben dosato e buona energia.',
    },
    fatigued: {
      label: 'Affaticato e sovraccarico',
      description: 'Più giorni intensi di fila, poco sonno, battito alto e avviso di riposo.',
    },
    recovering: {
      label: 'In ripresa',
      description: 'Giorni più calmi, sonno di nuovo costante e freschezza in crescita.',
    },
  },
};

export const UI_TRANSLATIONS: Record<AppLocale, UITranslations> = {
  de: DE_UI,
  en: EN_UI,
  es: ES_UI,
  fr: FR_UI,
  it: IT_UI,
};

const EN_EXPLANATIONS: Partial<Record<ExplanationTopic, ExplanationEntry>> = {
  recovery: {
    title: 'How is your Recovery Score calculated?',
    whatItMeans:
      'Your Recovery Score (0–100%) blends objective biometric data with how you actually feel today for an honest picture of readiness.',
    howCalculated: [
      '27% HRV (lnRMSSD): Overnight autonomic balance compared against your own 28-day rolling baseline.',
      '23% Sleep & Sleep Debt: Duration vs. need, efficiency, regularity, and perceived sleep quality.',
      '18% Daily Feeling: Your quick energy & sleep check-in plus fatigue, soreness, and stress.',
      '17% Resting Heart Rate: Lower RHR indicates strong recovery; sharp spikes flag stress or illness.',
      '15% Recent Strain: Yesterday and 7-day load balance vs. your 28-day chronic baseline.',
    ],
    whatToDo:
      'When your check-in is not yet filled in, objective metrics re-weight cleanly to 100% — no values are ever fabricated.',
    technicalNote:
      'Evidence base: lnRMSSD Z-Score (Plews et al., 2013), RHR, EWMA load, and subjective wellness weighting (Saw, Main & Gastin, 2016, BJSM).',
  },
  nutrition: {
    title: 'How are your Calories & Macros calculated?',
    whatItMeans:
      'Your daily calorie target adapts 1:1 to your basal metabolic rate, everyday lifestyle, and 100% of burned active calories from sports.',
    howCalculated: [
      'Basal Metabolic Rate (Mifflin-St Jeor, 1990): Clinically validated formula from weight, height, age, and biological sex.',
      'Wearable Mode (+100% Active Calories): Daily base need + 100% of burned sports calories + your exact goal delta (-deficit / 0 / +surplus).',
      'No-Tracker Mode (PAL): Uses your weekly activity multiplier directly without double-counting workouts.',
      'Protein (1.8–2.1 g/kg) & Fiber (14 g / 1,000 kcal): Aligned with ISSN & DGE evidence-based guidelines.',
    ],
    whatToDo:
      'Because 100% of active calories are added in wearable mode, your real deficit or surplus stays exact even on intense training days.',
    technicalNote:
      'Mifflin-St Jeor (Am J Clin Nutr 1990), ISSN Protein Position Stand (Jäger et al., 2017), DGE / IOM Fiber Reference.',
  },
  sleep: {
    title: 'How is your Sleep Score calculated?',
    whatItMeans:
      'Sleep Performance (0–100%) combines objective sleep architecture (82%) with how rested you felt upon waking (18%).',
    howCalculated: [
      '82% Objective Sleep: Duration vs. need (45%), efficiency (20%), bedtime consistency (20%), and deep/REM stages (15%).',
      '18% Perceived Sleep: Your subjective morning check-in whenever recorded.',
    ],
    whatToDo:
      'Consistent bedtimes and stopping caffeine ~9 hours before sleep maximize deep sleep and next-day recovery.',
    technicalNote: 'Sleep efficiency (%), circadian regularity, ultradian stages, and 82/18 subjective blend.',
  },
  strain21: {
    title: 'How does the 0–21 Strain Scale work?',
    whatItMeans:
      'A logarithmic 0–21 cardiovascular and muscular load scale inspired by elite sports physiology.',
    howCalculated: [
      'Exponential Banister TRIMP: Minutes in higher heart rate zones carry exponentially greater load.',
      'Logarithmic 0–21 curve: Reaching 10 is accessible; moving from 16 to 19 requires major effort.',
      'EWMA Load Balance: Compares your 7-day acute load against your 28-day chronic baseline.',
    ],
    whatToDo:
      'Aim for the recommended green target range on your Home screen based on your recovery.',
    technicalNote: 'Sex-specific Banister TRIMP (k=1.92/1.67), Karvonen HRR zones, Foster Session-RPE, EWMA ACWR.',
  },
};

export function getExplanation(topic: ExplanationTopic, locale: AppLocale): ExplanationEntry {
  if (locale === 'de') return de.explanations[topic];
  if (locale === 'en' && EN_EXPLANATIONS[topic]) return EN_EXPLANATIONS[topic]!;
  // For other topics/languages, return localized English summary if available or structured fallback
  if (EN_EXPLANATIONS[topic]) return EN_EXPLANATIONS[topic]!;
  return de.explanations[topic];
}
