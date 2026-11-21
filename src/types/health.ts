export type DeviceProviderId =
  | 'garmin'
  | 'coros'
  | 'polar'
  | 'suunto'
  | 'apple_health'
  | 'health_connect'
  | 'samsung_health'
  | 'fitbit'
  | 'amazfit'
  | 'withings'
  | 'oura'
  | 'other';

export type SportType =
  | 'running'
  | 'walking'
  | 'cycling'
  | 'strength'
  | 'calisthenics'
  | 'swimming'
  | 'hiking'
  | 'football'
  | 'other';

export type DataQualityLevel = 'high' | 'moderate' | 'low' | 'missing';
export type ConfidenceLevel = 'good' | 'limited' | 'insufficient';
export type MeasurementProvenance = 'measured' | 'wearable_estimate' | 'app_estimate' | 'missing';
export type ThemePreference = 'system' | 'light' | 'dark';
export type DemoScenarioId = 'balanced' | 'fatigued' | 'recovering';
export type DashboardFocus = 'general' | 'endurance' | 'recovery' | 'sleep';

// 5-icon Liquid Glass Bottom Pill Tabs matching reference UX
export type PrimaryTab = 'today' | 'activity' | 'sleep' | 'nutrition' | 'more';

// Secondary detail views pushed from Home / Mehr
export type DetailView = 'none' | 'recovery' | 'fitnessAge' | 'sources' | 'aiPrivacy' | 'healthTrends';

export type TimeRange = '7d' | '30d' | '90d' | '6m';

export type GoalOption =
  | 'cardiovascular'
  | 'run_faster'
  | 'improve_recovery'
  | 'improve_sleep'
  | 'increase_strength'
  | 'build_muscle'
  | 'improve_endurance'
  | 'reduce_fatigue'
  | 'long_term_health'
  | 'general_fitness';

export type NutritionGoalMode = 'cut' | 'maintain' | 'build';

export type MealCategory = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type AIProviderId = 'gemini' | 'claude' | 'openai' | 'openrouter' | 'ollama';

export interface AIPrivacySettings {
  provider: AIProviderId;
  apiKey: string;
  ollamaUrl: string;
  ollamaModel: string;
  localRecommendationsOnly: boolean;
  sendPhotosOnDemandOnly: boolean;
  localProcessingOnly: boolean;
  backgroundSync: boolean;
}

export interface MealFoodItem {
  id: string;
  name: string;
  brand?: string;
  grams: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  imageUrl?: string;
  barcode?: string;
  source: 'ai' | 'openfoodfacts' | 'local_db' | 'manual';
}

export interface MealEntry {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: string;
  category: MealCategory;
  title: string;
  subtitle: string;
  imageUrl?: string;
  items: MealFoodItem[];
  totalCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  analysisNote?: string;
}

export interface HydrationEntry {
  date: string;
  ml: number;
  updatedAt: string;
}

export interface NutritionTargets {
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  bmrKcal: number;
  activeBonusKcal: number;
  goalMode: NutritionGoalMode;
}

export interface RunningTargets {
  target5kSec?: number;
  target10kSec?: number;
  targetHalfSec?: number;
  targetMarathonSec?: number;
}

export interface UserProfile {
  id: string;
  displayName: string;
  age: number;
  heightCm: number;
  weightKg: number;
  biologicalSex?: 'female' | 'male' | 'diverse' | 'unspecified';
  restingHrBaselineManual?: number;
  maxHr: number;
  hrZoneMethod: 'hrr' | 'hrmax';
  fitnessExperience: 'beginner' | 'intermediate' | 'advanced' | 'competitive';
  primarySport: SportType;
  activityLevel: 'moderate' | 'active' | 'very_active' | 'athlete';
  weeklyTrainingDays: number;
  sleepTargetMinutes: number;
  preferredBedtime: string;
  preferredWakeTime: string;
  nutritionGoalMode?: NutritionGoalMode;
  customCalorieTarget?: number;
  goals: GoalOption[];
  runningTargets: RunningTargets;
  dashboardFocus: DashboardFocus;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectedSource {
  providerId: DeviceProviderId;
  name: string;
  connected: boolean;
  isDemoSimulation: boolean;
  comingSoon?: boolean;
  lastSyncAt: string | null;
  supportedDataTypes: ('sleep' | 'hrv' | 'rhr' | 'workouts' | 'steps' | 'body' | 'vo2max')[];
  syncedRecordCount: number;
}

export interface SourcePriorityPreferences {
  steps: DeviceProviderId;
  heartRate: DeviceProviderId;
  sleep: DeviceProviderId;
  workouts: DeviceProviderId;
  weight: DeviceProviderId;
  bodyComposition: DeviceProviderId;
}

export interface ObservationBase {
  id: string;
  date: string; // YYYY-MM-DD local date
  timestamp: string;
  sourceProvider: DeviceProviderId;
  sourceRecordId: string;
  dataQuality: DataQualityLevel;
  provenance: MeasurementProvenance;
}

export interface HRVObservation extends ObservationBase {
  metricType: 'hrv_rmssd';
  unit: 'ms';
  value: number;
  recordingContext: 'overnight_avg' | 'morning_readiness';
}

export interface RestingHeartRateObservation extends ObservationBase {
  metricType: 'resting_hr';
  unit: 'bpm';
  value: number;
  recordingContext: 'overnight_min' | 'morning_rest';
}

export interface SleepStageSegment {
  stage: 'awake' | 'light' | 'deep' | 'rem';
  startOffsetMinutes: number;
  durationMinutes: number;
}

export interface SleepSession extends ObservationBase {
  metricType: 'sleep_session';
  bedtimeIso: string;
  wakeTimeIso: string;
  timeInBedMinutes: number;
  totalSleepMinutes: number;
  awakeMinutes: number;
  lightMinutes: number | null;
  deepMinutes: number | null;
  remMinutes: number | null;
  hasStageData: boolean;
  efficiencyPercent: number;
  awakeningsCount: number;
  stages: SleepStageSegment[];
}

export interface WorkoutTimeSeriesPoint {
  minuteOffset: number;
  hrBpm: number;
  paceSecPerKm?: number;
  elevationM?: number;
}

export interface KilometerSplit {
  km: number;
  durationSec: number;
  paceSecPerKm: number;
  avgHrBpm: number;
  elevationDiffM: number;
}

export interface StrengthExerciseSummary {
  name: string;
  sets: number;
  reps: number;
  weightKg?: number;
}

export interface WorkoutSession extends ObservationBase {
  metricType: 'workout';
  title: string;
  sport: SportType;
  startTimeIso: string;
  durationMinutes: number;
  distanceKm?: number;
  avgPaceSecPerKm?: number;
  avgHrBpm?: number;
  maxHrBpm?: number;
  cadenceSpm?: number;
  elevationGainM?: number;
  rpe?: number; // 1-10
  caloriesKcal?: number;
  rawLoadScore: number; // Banister exponential TRIMP
  normalizedLoad: number; // 0-100 single-session impact
  strain21?: number; // 0-21 Borg/Whoop-like logarithmic strain
  hrZoneMinutes?: [number, number, number, number, number];
  timeSeries?: WorkoutTimeSeriesPoint[];
  splits?: KilometerSplit[];
  exercises?: StrengthExerciseSummary[];
  hasDetailedExerciseLog?: boolean;
  isSimulated?: boolean;
}

export interface DailyActivitySummary extends ObservationBase {
  metricType: 'daily_activity';
  steps: number;
  activeMinutes: number;
  sedentaryMinutes?: number;
  estimatedEnergyKcal: number;
  activeCaloriesKcal?: number;
  vo2MaxEstimate?: number;
  respiratoryRateBpm?: number;
  spo2Percent?: number;
  skinTempDeviationC?: number;
}

export interface BodyMeasurement extends ObservationBase {
  metricType: 'body_measurement';
  weightKg: number;
  bodyFatPercent?: number;
  muscleMassKg?: number;
}

export interface JournalEntry {
  date: string;
  updatedAt: string;
  subjectiveSleepQuality?: 1 | 2 | 3 | 4 | 5;
  stressLevel: 1 | 2 | 3 | 4 | 5;
  energyLevel: 1 | 2 | 3 | 4 | 5;
  muscleSoreness: 1 | 2 | 3 | 4 | 5;
  mood: 1 | 2 | 3 | 4 | 5;
  subjectiveFatigue: 1 | 2 | 3 | 4 | 5;
  alcoholDrinks?: number;
  caffeineMg?: number;
  illnessSymptoms?: boolean;
  hydrationLiters?: number;
  notes?: string;
}

export interface PersonalBaseline {
  hrvMean28d: number | null;
  hrvStd28d: number | null;
  hrvLnMean28d?: number | null;
  hrvLnStd28d?: number | null;
  hrvCount28d: number;
  rhrMean28d: number | null;
  rhrStd28d: number | null;
  rhrCount28d: number;
  sleepMean28d: number | null;
  chronicLoad28d: number;
  acuteLoad7d: number;
  ewmaAcwr?: number | null;
  vo2MaxLatest: number | null;
}

export interface RecoveryFactorBreakdown {
  key: 'hrv' | 'rhr' | 'sleep' | 'load' | 'journal';
  label: string;
  weightUsed: number;
  configuredWeight: number;
  score: number | null; // 0-100 sub-score
  deltaText: string;
  available: boolean;
  explanation: string;
}

export type ReadinessCategory =
  | 'high_intensity_ok'
  | 'moderate_preferred'
  | 'easy_recovery'
  | 'rest_considered'
  | 'insufficient_data';

export interface RecoveryAssessment {
  date: string;
  score: number | null; // 0-100
  classification: 'Gut' | 'Mittel' | 'Niedrig' | 'Unzureichend';
  deltaFromYesterday: number | null;
  confidence: ConfidenceLevel;
  confidenceReason: string;
  readinessCategory: ReadinessCategory;
  readinessTitle: string;
  readinessSummary: string;
  factors: RecoveryFactorBreakdown[];
  sleepDebtMinutes: number;
  hrvToday: number | null;
  hrvBaseline: number | null;
  hrvDeltaPct: number | null;
  hrvLnZScore?: number | null;
  rhrToday: number | null;
  rhrBaseline: number | null;
  rhrDeltaBpm: number | null;
  recommendedStrainRange?: [number, number];
  objectiveOnlyScore?: number | null;
  subjectiveScore?: number | null;
  subjectiveAlignmentNote?: string;
}

export interface SleepAssessment {
  date: string;
  score: number | null; // 0-100
  objectiveScore?: number | null;
  subjectiveSleepQuality?: 1 | 2 | 3 | 4 | 5;
  subjectiveAlignmentNote?: string;
  sleepPerformancePercent?: number | null;
  sleepNeedMinutes?: number;
  recommendedBedtime?: string;
  caffeineCutoffTime?: string;
  durationMinutes: number | null;
  targetMinutes: number;
  durationDeltaMinutes: number | null;
  efficiencyPercent: number | null;
  regularityScore: number | null;
  continuityScore: number | null;
  sleepDebtMinutes: number;
  hasStageData: boolean;
  confidence: ConfidenceLevel;
  recoveryContributionText: string;
  insights: string[];
}

export interface HRZoneConfig {
  zone: 1 | 2 | 3 | 4 | 5;
  name: string;
  minBpm: number;
  maxBpm: number;
  description: string;
}

export interface TrainingLoadAssessment {
  date: string;
  dailyLoadScore: number; // 0-100
  dailyStrain21?: number; // 0.0-21.0 Whoop-compatible logarithmic scale
  strainLabel?: 'Ruhe' | 'Leicht' | 'Moderat' | 'Hoch' | 'Maximal';
  rawDailyLoad: number;
  classification: 'Ruhetag' | 'Leicht' | 'Mittel' | 'Hoch' | 'Sehr hoch';
  acuteLoad7d: number;
  chronicLoad28d: number;
  acuteChronicRatio: number | null;
  ewmaAcwr?: number | null;
  weeklyAvgLoad: number;
  weeklyTrendPct: number | null;
  workouts: WorkoutSession[];
  weeklyZoneMinutes: [number, number, number, number, number];
  todayZoneMinutes?: [number, number, number, number, number];
}

export interface FitnessAgeHistoryPoint {
  date: string;
  label: string;
  age: number;
}

export interface FitnessAgeEstimate {
  date: string;
  chronologicalAge: number;
  estimatedFitnessAge: number | null;
  differenceYears: number | null;
  confidence: ConfidenceLevel;
  sufficientData: boolean;
  missingRequirements: string[];
  improvingFactors: string[];
  decliningFactors: string[];
  inputsUsed: {
    key?: 'hrv' | 'rhr' | 'sleep' | 'vo2max' | 'aerobic' | 'strength';
    label: string;
    valueText: string;
    impactYears: number;
  }[];
  history30d?: FitnessAgeHistoryPoint[];
  methodologyNote: string;
}

export interface TrainingRecommendation {
  date: string;
  headline: string;
  subheadline: string;
  recommendedWorkoutTitle: string;
  recommendedSport: SportType;
  suggestedDurationMinutes: number;
  suggestedIntensity: 'Sehr leicht' | 'Leicht' | 'Mittel' | 'Fordernd' | 'Erholung';
  suggestedZoneLabel: string;
  suggestedStrainRange?: [number, number];
  trainingObjective: string;
  reasoningSteps: string[];
  recoveryConsiderations: string;
  uncertaintyNote: string;
  confidence: ConfidenceLevel;
}

export interface DataQualityAssessment {
  overallConfidence: ConfidenceLevel;
  observationsLast28d: number;
  sleepNightsLast28d: number;
  missingSignalsToday: string[];
}

export interface PersonalizedInsight {
  id: string;
  category: 'recovery' | 'sleep' | 'load' | 'cardio' | 'journal';
  title: string;
  detail: string;
  direction: 'positive' | 'neutral' | 'caution';
}

export interface DailyDerivedSnapshot {
  date: string;
  baseline: PersonalBaseline;
  recovery: RecoveryAssessment;
  sleep: SleepAssessment;
  trainingLoad: TrainingLoadAssessment;
  recommendation: TrainingRecommendation;
  dataQuality: DataQualityAssessment;
  insights: PersonalizedInsight[];
  activity?: DailyActivitySummary;
  sleepSession?: SleepSession;
  hrv?: HRVObservation;
  rhr?: RestingHeartRateObservation;
  body?: BodyMeasurement;
  journal?: JournalEntry;
}

export interface SimulationInput {
  sport: SportType;
  durationMinutes: number;
  distanceKm?: number;
  avgHrBpm?: number;
  rpe: number;
  title?: string;
}

export interface SimulationResult {
  input: SimulationInput;
  simulatedWorkout: WorkoutSession;
  beforeDailyLoad: number;
  afterDailyLoad: number;
  beforeStrain21?: number;
  afterStrain21?: number;
  beforeAcuteLoad: number;
  afterAcuteLoad: number;
  beforeNextDayReadiness: ReadinessCategory;
  afterNextDayReadiness: ReadinessCategory;
  estimatedNextDayRecoveryRange: [number, number];
  nextIntensityGuidance: string;
  lowConfidenceHeuristicNote: string;
}

export interface HabitImpactSummary {
  id: string;
  habit: string;
  impactPct: number;
  sampleCount: number;
  explanation: string;
}

export interface AppExportPayload {
  schemaVersion: number;
  exportedAt: string;
  scenarioId: DemoScenarioId;
  profile: UserProfile;
  connectedSources: ConnectedSource[];
  sourcePriorities: SourcePriorityPreferences;
  hrvObservations: HRVObservation[];
  rhrObservations: RestingHeartRateObservation[];
  sleepSessions: SleepSession[];
  workouts: WorkoutSession[];
  dailyActivities: DailyActivitySummary[];
  bodyMeasurements: BodyMeasurement[];
  journalEntries: JournalEntry[];
  meals?: MealEntry[];
  hydrationEntries?: HydrationEntry[];
}
