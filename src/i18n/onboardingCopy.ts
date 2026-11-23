import { AppLocale } from '../types/health';

export interface OnboardingCopy {
  welcomeKicker: string;
  step1Title: string;
  step1Sub: string;
  nameLabel: string;
  namePlaceholder: string;
  birthDateLabel: string;
  autoAgeNote: string;
  ageYearsSuffix: string;
  maxHrAutoLabel: string;
  step2Title: string;
  step2Sub: string;
  heightLabel: string;
  weightLabel: string;
  bmiLabel: string;
  waterGoalLabel: string;
  step3Title: string;
  step3Sub: string;
  targetWeightLabel: string;
  targetWeightDiffCut: string;
  targetWeightDiffBuild: string;
  targetWeightReached: string;
  paceLabelCut: string;
  paceLabelBuild: string;
  paceUnit: string;
  pacePresetsCut: [string, string, string, string];
  pacePresetsBuild: [string, string, string];
  dailyAdjustmentLabel: string;
  projectedDurationLabel: string;
  weeksUnit: string;
  projectedDatePrefix: string;
  floorSafetyNote: string;
  step4Title: string;
  step4Sub: string;
  preferredDevicesLabel: string;
  preferredDevicesHint: string;
  step5Title: string;
  step5Sub: string;
  basePlanLabel: string;
  wearableLiveBonusNote: string;
  weightRoadmapTitle: string;
  healthProfileTitle: string;
  sleepGoalLabel: string;
  startAppCta: string;
  savePlanCta: string;
  emptyState: {
    startCardTitle: string;
    startCardDesc: string;
    connectSourceBtn: string;
    logMealBtn: string;
    waitingForData: string;
    noWearableYet: string;
    noSleepYet: string;
    noHrvYet: string;
    noStrainYet: string;
    noRecommendedYet: string;
    noFitnessAgeYet: string;
    profileBirthDate: string;
    profileTargetWeight: string;
    restartSetup: string;
    weightGoalProgress: string;
    noConnectedSources: string;
  };
}

export const ONBOARDING_COPY: Record<AppLocale, OnboardingCopy> = {
  de: {
    welcomeKicker: '100 % lokal auf deinem Gerät · Kein Account nötig',
    step1Title: 'Willkommen bei KADENZ',
    step1Sub:
      'Deine Basisdaten gelten für die gesamte App — Kalorienziel, Pulsbereiche, Fitnessalter und Erholung.',
    nameLabel: 'Wie möchtest du genannt werden?',
    namePlaceholder: 'Dein Vorname (optional)',
    birthDateLabel: 'Geburtsdatum',
    autoAgeNote: 'Alter wird immer automatisch berechnet',
    ageYearsSuffix: 'Jahre',
    maxHrAutoLabel: 'Geschätzte Max-HF (Tanaka)',
    step2Title: 'Größe & Gewicht',
    step2Sub:
      'Für deinen exakten Grundumsatz (Mifflin-St Jeor), Protein- und Flüssigkeitsbedarf.',
    heightLabel: 'Körpergröße',
    weightLabel: 'Aktuelles Gewicht',
    bmiLabel: 'BMI',
    waterGoalLabel: 'Wasserziel',
    step3Title: 'Dein Ziel & Tempo',
    step3Sub:
      'Lege dein Zielgewicht und deine gewünschte Geschwindigkeit fest — wir berechnen deinen exakten Plan.',
    targetWeightLabel: 'Zielgewicht',
    targetWeightDiffCut: 'bis zum Zielgewicht',
    targetWeightDiffBuild: 'Aufbau bis zum Ziel',
    targetWeightReached: 'Entspricht deinem aktuellen Gewicht',
    paceLabelCut: 'Abnehm-Tempo',
    paceLabelBuild: 'Aufbau-Tempo',
    paceUnit: 'kg / Wo.',
    pacePresetsCut: ['Sanft', 'Empfohlen', 'Zügig', 'Intensiv'],
    pacePresetsBuild: ['Lean', 'Empfohlen', 'Fokus'],
    dailyAdjustmentLabel: 'Tägliche Anpassung',
    projectedDurationLabel: 'Geschätzte Dauer',
    weeksUnit: 'Wochen',
    projectedDatePrefix: 'Ziel ca.',
    floorSafetyNote:
      'Hinweis: Zur Sicherheit bleibt dein Tagesziel bei mindestens 1.200 kcal (zuzüglich 100 % Aktivkalorien).',
    step4Title: 'Wearable & Alltag',
    step4Sub:
      'Eine Bewegungsangabe ist nur nötig, wenn kein Fitness-Tracker deine Aktivkalorien liefert.',
    preferredDevicesLabel: 'Welche Plattform nutzt du? (optional)',
    preferredDevicesHint: 'Kannst du später jederzeit unter Datenquellen verbinden oder importieren.',
    step5Title: 'Dein persönlicher Plan',
    step5Sub:
      'Alles wird lokal in deinem Profil gespeichert und direkt in der gesamten App genutzt.',
    basePlanLabel: 'Tagesziel ohne Sport',
    wearableLiveBonusNote:
      'Sobald dein Tracker Aktivkalorien liefert, werden 100 % davon automatisch addiert — so bleibt dein Defizit oder Überschuss immer exakt.',
    weightRoadmapTitle: 'Gewichts-Plan',
    healthProfileTitle: 'Gesundheitsprofil',
    sleepGoalLabel: 'Schlafziel',
    startAppCta: 'Profil speichern & starten',
    savePlanCta: 'Plan aktualisieren',
    emptyState: {
      startCardTitle: 'Bereit für deine ersten Daten',
      startCardDesc:
        'Verbinde eine Datenquelle (Health Connect, Apple Health, COROS, Garmin) oder starte direkt mit deiner ersten Mahlzeit.',
      connectSourceBtn: 'Datenquelle verbinden',
      logMealBtn: 'Mahlzeit erfassen',
      waitingForData: 'Noch keine Messdaten',
      noWearableYet: 'Wearable verbinden oder Check-in ausfüllen',
      noSleepYet: 'Noch keine Schlafdaten',
      noHrvYet: 'Noch keine HRV-Daten',
      noStrainYet: 'Noch keine Aktivität heute',
      noRecommendedYet: 'Nach dem ersten Check-in oder Wearable-Sync verfügbar.',
      noFitnessAgeYet: 'Wird berechnet, sobald erste Ruhepuls- & Trainingsdaten vorliegen.',
      profileBirthDate: 'Geburtsdatum',
      profileTargetWeight: 'Zielgewicht (kg)',
      restartSetup: 'Einrichtung erneut starten',
      weightGoalProgress: 'Zielgewicht',
      noConnectedSources: 'Noch keine Quelle verbunden',
    },
  },
  en: {
    welcomeKicker: '100% local on your device · No account required',
    step1Title: 'Welcome to KADENZ',
    step1Sub:
      'Your baseline powers the entire app — calorie targets, heart-rate zones, fitness age, and recovery.',
    nameLabel: 'What should we call you?',
    namePlaceholder: 'Your first name (optional)',
    birthDateLabel: 'Date of birth',
    autoAgeNote: 'Age is calculated automatically every day',
    ageYearsSuffix: 'yrs',
    maxHrAutoLabel: 'Estimated Max HR (Tanaka)',
    step2Title: 'Height & Weight',
    step2Sub:
      'Used for your exact Basal Metabolic Rate (Mifflin-St Jeor), protein, and hydration targets.',
    heightLabel: 'Height',
    weightLabel: 'Current weight',
    bmiLabel: 'BMI',
    waterGoalLabel: 'Water target',
    step3Title: 'Your Goal & Pace',
    step3Sub:
      'Set your target weight and preferred weekly pace — we calculate your exact daily calorie plan.',
    targetWeightLabel: 'Target weight',
    targetWeightDiffCut: 'to target weight',
    targetWeightDiffBuild: 'gain to target',
    targetWeightReached: 'Matches your current weight',
    paceLabelCut: 'Weight-loss pace',
    paceLabelBuild: 'Weight-gain pace',
    paceUnit: 'kg / wk',
    pacePresetsCut: ['Gentle', 'Recommended', 'Brisk', 'Intense'],
    pacePresetsBuild: ['Lean', 'Recommended', 'Focused'],
    dailyAdjustmentLabel: 'Daily adjustment',
    projectedDurationLabel: 'Estimated timeline',
    weeksUnit: 'weeks',
    projectedDatePrefix: 'Est. target',
    floorSafetyNote:
      'Note: For safety, your daily target stays at or above 1,200 kcal (plus 100% of active calories).',
    step4Title: 'Wearable & Routine',
    step4Sub:
      'Weekly activity level is only needed if no wearable or fitness tracker provides your active calories.',
    preferredDevicesLabel: 'Which platform do you use? (optional)',
    preferredDevicesHint: 'You can connect or import files anytime under Data Sources.',
    step5Title: 'Your Personal Plan',
    step5Sub:
      'Saved locally in your profile and applied automatically across every formula in the app.',
    basePlanLabel: 'Daily target (base)',
    wearableLiveBonusNote:
      'Whenever your tracker records active calories, 100% are added on top — keeping your chosen deficit or surplus exact.',
    weightRoadmapTitle: 'Weight Plan',
    healthProfileTitle: 'Health Profile',
    sleepGoalLabel: 'Sleep target',
    startAppCta: 'Save profile & get started',
    savePlanCta: 'Update plan',
    emptyState: {
      startCardTitle: 'Ready for your first data',
      startCardDesc:
        'Connect a source (Health Connect, Apple Health, COROS, Garmin) or log your first meal right away.',
      connectSourceBtn: 'Connect data source',
      logMealBtn: 'Log first meal',
      waitingForData: 'No readings yet',
      noWearableYet: 'Connect a wearable or complete check-in',
      noSleepYet: 'No sleep data yet',
      noHrvYet: 'No HRV data yet',
      noStrainYet: 'No activity logged today',
      noRecommendedYet: 'Available after your first check-in or wearable sync.',
      noFitnessAgeYet: 'Calculated once initial resting HR & workout data are synced.',
      profileBirthDate: 'Date of birth',
      profileTargetWeight: 'Target weight (kg)',
      restartSetup: 'Restart setup',
      weightGoalProgress: 'Goal weight',
      noConnectedSources: 'No source connected yet',
    },
  },
  es: {
    welcomeKicker: '100 % local en tu dispositivo · Sin cuenta',
    step1Title: 'Bienvenido a KADENZ',
    step1Sub:
      'Tus datos base alimentan toda la app: calorías, zonas de pulso, edad fitness y recuperación.',
    nameLabel: '¿Cómo te llamas?',
    namePlaceholder: 'Tu nombre (opcional)',
    birthDateLabel: 'Fecha de nacimiento',
    autoAgeNote: 'La edad se calcula automáticamente siempre',
    ageYearsSuffix: 'años',
    maxHrAutoLabel: 'FC máx. estimada (Tanaka)',
    step2Title: 'Altura y peso',
    step2Sub:
      'Para tu metabolismo basal exacto (Mifflin-St Jeor), proteína e hidratación.',
    heightLabel: 'Altura',
    weightLabel: 'Peso actual',
    bmiLabel: 'IMC',
    waterGoalLabel: 'Objetivo de agua',
    step3Title: 'Tu objetivo y ritmo',
    step3Sub:
      'Define tu peso objetivo y qué tan rápido quieres avanzar para calcular tu plan perfecto.',
    targetWeightLabel: 'Peso objetivo',
    targetWeightDiffCut: 'hasta el objetivo',
    targetWeightDiffBuild: 'ganancia objetivo',
    targetWeightReached: 'Igual a tu peso actual',
    paceLabelCut: 'Ritmo de pérdida',
    paceLabelBuild: 'Ritmo de subida',
    paceUnit: 'kg / sem.',
    pacePresetsCut: ['Suave', 'Recomendado', 'Rápido', 'Intenso'],
    pacePresetsBuild: ['Limpio', 'Recomendado', 'Enfocado'],
    dailyAdjustmentLabel: 'Ajuste diario',
    projectedDurationLabel: 'Duración estimada',
    weeksUnit: 'semanas',
    projectedDatePrefix: 'Meta aprox.',
    floorSafetyNote:
      'Nota: Por seguridad, el mínimo diario es 1.200 kcal (más el 100 % de tus calorías activas).',
    step4Title: 'Wearable y rutina',
    step4Sub:
      'Solo pedimos tu actividad semanal si no usas reloj o pulsera que mida calorías activas.',
    preferredDevicesLabel: '¿Qué plataforma usas? (opcional)',
    preferredDevicesHint: 'Podrás conectar o importar archivos en Fuentes de datos.',
    step5Title: 'Tu plan personal',
    step5Sub:
      'Guardado localmente en tu perfil y usado automáticamente en toda la aplicación.',
    basePlanLabel: 'Objetivo diario base',
    wearableLiveBonusNote:
      'Cuando tu wearable registre calorías activas, se sumará el 100 % automáticamente para mantener tu déficit o superávit exacto.',
    weightRoadmapTitle: 'Plan de peso',
    healthProfileTitle: 'Perfil de salud',
    sleepGoalLabel: 'Meta de sueño',
    startAppCta: 'Guardar perfil y empezar',
    savePlanCta: 'Actualizar plan',
    emptyState: {
      startCardTitle: 'Listo para tus primeros datos',
      startCardDesc:
        'Conecta una fuente (Health Connect, Apple Health, COROS, Garmin) o registra tu primera comida.',
      connectSourceBtn: 'Conectar fuente',
      logMealBtn: 'Registrar comida',
      waitingForData: 'Sin datos todavía',
      noWearableYet: 'Conecta un wearable o haz tu check-in',
      noSleepYet: 'Sin datos de sueño',
      noHrvYet: 'Sin datos de HRV',
      noStrainYet: 'Sin actividad hoy',
      noRecommendedYet: 'Disponible tras tu primer check-in o sincronización.',
      noFitnessAgeYet: 'Se calcula cuando haya datos de pulso en reposo y entrenamientos.',
      profileBirthDate: 'Fecha de nacimiento',
      profileTargetWeight: 'Peso objetivo (kg)',
      restartSetup: 'Reiniciar configuración',
      weightGoalProgress: 'Peso objetivo',
      noConnectedSources: 'Ninguna fuente conectada',
    },
  },
  fr: {
    welcomeKicker: '100 % local sur votre appareil · Sans compte',
    step1Title: 'Bienvenue sur KADENZ',
    step1Sub:
      'Vos données de base alimentent toute l’application : calories, zones cardiaques, âge fitness et récupération.',
    nameLabel: 'Comment vous appelez-vous ?',
    namePlaceholder: 'Votre prénom (optionnel)',
    birthDateLabel: 'Date de naissance',
    autoAgeNote: 'L’âge est recalculé automatiquement',
    ageYearsSuffix: 'ans',
    maxHrAutoLabel: 'FC max estimée (Tanaka)',
    step2Title: 'Taille et poids',
    step2Sub:
      'Pour votre métabolisme basal exact (Mifflin-St Jeor), vos protéines et votre hydratation.',
    heightLabel: 'Taille',
    weightLabel: 'Poids actuel',
    bmiLabel: 'IMC',
    waterGoalLabel: 'Objectif eau',
    step3Title: 'Objectif et rythme',
    step3Sub:
      'Indiquez votre poids cible et votre rythme souhaité pour calculer un plan sur mesure.',
    targetWeightLabel: 'Poids cible',
    targetWeightDiffCut: 'jusqu’au poids cible',
    targetWeightDiffBuild: 'prise jusqu’à la cible',
    targetWeightReached: 'Identique au poids actuel',
    paceLabelCut: 'Rythme de perte',
    paceLabelBuild: 'Rythme de prise',
    paceUnit: 'kg / sem.',
    pacePresetsCut: ['Doux', 'Recommandé', 'Rapide', 'Intense'],
    pacePresetsBuild: ['Sec', 'Recommandé', 'Ciblé'],
    dailyAdjustmentLabel: 'Ajustement quotidien',
    projectedDurationLabel: 'Durée estimée',
    weeksUnit: 'semaines',
    projectedDatePrefix: 'Cible env.',
    floorSafetyNote:
      'Note : Par sécurité, l’objectif reste au moins à 1 200 kcal (plus 100 % des calories actives).',
    step4Title: 'Montre et quotidien',
    step4Sub:
      'L’activité hebdomadaire n’est demandée que sans montre connectée mesurant vos calories actives.',
    preferredDevicesLabel: 'Quelle plateforme utilisez-vous ? (optionnel)',
    preferredDevicesHint: 'Connectable ou importable à tout moment dans Sources de données.',
    step5Title: 'Votre plan personnel',
    step5Sub:
      'Enregistré localement dans votre profil et utilisé dans toutes les formules de l’app.',
    basePlanLabel: 'Objectif quotidien de base',
    wearableLiveBonusNote:
      'Dès que votre montre enregistre des calories actives, 100 % sont ajoutées pour respecter exactement votre déficit ou surplus.',
    weightRoadmapTitle: 'Plan de poids',
    healthProfileTitle: 'Profil santé',
    sleepGoalLabel: 'Objectif sommeil',
    startAppCta: 'Enregistrer et commencer',
    savePlanCta: 'Mettre à jour le plan',
    emptyState: {
      startCardTitle: 'Prêt pour vos premières données',
      startCardDesc:
        'Connectez une source (Health Connect, Apple Health, COROS, Garmin) ou ajoutez votre premier repas.',
      connectSourceBtn: 'Connecter une source',
      logMealBtn: 'Ajouter un repas',
      waitingForData: 'Aucune donnée pour l’instant',
      noWearableYet: 'Connectez une montre ou faites le check-in',
      noSleepYet: 'Aucune donnée de sommeil',
      noHrvYet: 'Aucune donnée VFC',
      noStrainYet: 'Aucune activité aujourd’hui',
      noRecommendedYet: 'Disponible après votre premier check-in ou synchronisation.',
      noFitnessAgeYet: 'Calculé dès les premières mesures de FC au repos et séances.',
      profileBirthDate: 'Date de naissance',
      profileTargetWeight: 'Poids cible (kg)',
      restartSetup: 'Relancer la configuration',
      weightGoalProgress: 'Poids cible',
      noConnectedSources: 'Aucune source connectée',
    },
  },
  it: {
    welcomeKicker: '100% locale sul dispositivo · Nessun account',
    step1Title: 'Benvenuto in KADENZ',
    step1Sub:
      'I tuoi dati di base alimentano tutta l’app: calorie, zone cardio, età fitness e recupero.',
    nameLabel: 'Come ti chiami?',
    namePlaceholder: 'Il tuo nome (opzionale)',
    birthDateLabel: 'Data di nascita',
    autoAgeNote: 'L’età viene calcolata automaticamente',
    ageYearsSuffix: 'anni',
    maxHrAutoLabel: 'FC max stimata (Tanaka)',
    step2Title: 'Altezza e peso',
    step2Sub:
      'Per il tuo metabolismo basale esatto (Mifflin-St Jeor), proteine e idratazione.',
    heightLabel: 'Altezza',
    weightLabel: 'Peso attuale',
    bmiLabel: 'IMC',
    waterGoalLabel: 'Obiettivo acqua',
    step3Title: 'Obiettivo e ritmo',
    step3Sub:
      'Imposta il peso obiettivo e la velocità desiderata per calcolare il tuo piano perfetto.',
    targetWeightLabel: 'Peso obiettivo',
    targetWeightDiffCut: 'al peso obiettivo',
    targetWeightDiffBuild: 'aumento verso l’obiettivo',
    targetWeightReached: 'Uguale al peso attuale',
    paceLabelCut: 'Ritmo di dimagrimento',
    paceLabelBuild: 'Ritmo di aumento',
    paceUnit: 'kg / sett.',
    pacePresetsCut: ['Dolce', 'Consigliato', 'Rapido', 'Intenso'],
    pacePresetsBuild: ['Pulito', 'Consigliato', 'Mirato'],
    dailyAdjustmentLabel: 'Variazione giornaliera',
    projectedDurationLabel: 'Durata stimata',
    weeksUnit: 'settimane',
    projectedDatePrefix: 'Obiettivo circa',
    floorSafetyNote:
      'Nota: Per sicurezza il minimo giornaliero resta 1.200 kcal (più il 100% delle calorie attive).',
    step4Title: 'Wearable e routine',
    step4Sub:
      'Chiediamo il livello di attività settimanale solo se non usi un wearable per le calorie attive.',
    preferredDevicesLabel: 'Quale piattaforma usi? (opzionale)',
    preferredDevicesHint: 'Puoi connettere o importare file in qualsiasi momento in Fonti dati.',
    step5Title: 'Il tuo piano personale',
    step5Sub:
      'Salvato localmente nel tuo profilo e usato subito in tutte le formule dell’app.',
    basePlanLabel: 'Obiettivo giornaliero base',
    wearableLiveBonusNote:
      'Quando il tuo tracker rileva calorie attive, il 100% viene aggiunto in automatico mantenendo esatto il tuo deficit o surplus.',
    weightRoadmapTitle: 'Piano peso',
    healthProfileTitle: 'Profilo salute',
    sleepGoalLabel: 'Obiettivo sonno',
    startAppCta: 'Salva profilo e inizia',
    savePlanCta: 'Aggiorna piano',
    emptyState: {
      startCardTitle: 'Pronto per i tuoi primi dati',
      startCardDesc:
        'Collega una fonte (Health Connect, Apple Health, COROS, Garmin) o registra subito il primo pasto.',
      connectSourceBtn: 'Collega fonte dati',
      logMealBtn: 'Registra pasto',
      waitingForData: 'Nessun dato ancora',
      noWearableYet: 'Collega un wearable o compila il check-in',
      noSleepYet: 'Nessun dato sul sonno',
      noHrvYet: 'Nessun dato HRV',
      noStrainYet: 'Nessuna attività oggi',
      noRecommendedYet: 'Disponibile dopo il primo check-in o sincronizzazione.',
      noFitnessAgeYet: 'Calcolato non appena arrivano FC a riposo e allenamenti.',
      profileBirthDate: 'Data di nascita',
      profileTargetWeight: 'Peso obiettivo (kg)',
      restartSetup: 'Riavvia configurazione',
      weightGoalProgress: 'Peso obiettivo',
      noConnectedSources: 'Nessuna fonte collegata',
    },
  },
};
