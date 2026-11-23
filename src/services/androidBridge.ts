import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import {
  BodyMeasurement,
  DailyActivitySummary,
  DeviceProviderId,
  HRVObservation,
  HydrationEntry,
  MealCategory,
  MealEntry,
  MeasurementProvenance,
  RestingHeartRateObservation,
  SleepSession,
  SleepStageSegment,
  SportType,
  UserProfile,
  WorkoutSession,
  WorkoutTimeSeriesPoint,
} from '../types/health';
import { calculateWorkoutLoad } from '../engine/calculations';
import type { HapticPatternName } from '../utils/haptics';

export interface NativePendingIntent {
  hasPending: boolean;
  kind?: 'share_intent' | 'deeplink' | 'tab_shortcut';
  rawText?: string;
  receivedAt?: number;
}

export interface NativeIncomingIntentEvent {
  kind: 'share_intent' | 'deeplink' | 'tab_shortcut';
  rawText: string;
  receivedAt: number;
}

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface HealthConnectStatus {
  available: boolean;
  status: 'available' | 'provider_update_required' | 'unavailable';
  sdkInt?: number;
}

export interface HealthConnectPermissionSummary {
  granted: string[];
  grantedCount: number;
  readGrantedCount: number;
  writeGrantedCount: number;
  totalCount: number;
  hasReadAccess: boolean;
  hasWriteAccess: boolean;
  allGranted: boolean;
  backgroundReadSupported?: boolean;
  backgroundReadGranted?: boolean;
  historyReadSupported?: boolean;
  historyReadGranted?: boolean;
  lastBackgroundSyncAt?: string;
  lastBackgroundSyncStatus?: string;
  lastBackgroundSyncRecords?: number;
  hasPendingBackgroundSnapshot?: boolean;
}

interface RawHealthConnectSyncResponse {
  hasSnapshot?: boolean;
  syncedAt: string;
  daysSynced?: number;
  grantedCount: number;
  hrvObservations: {
    id: string;
    date: string;
    timestamp: string;
    sourceProvider: string;
    sourceRecordId: string;
    provenance?: string;
    value: number;
  }[];
  rhrObservations: {
    id: string;
    date: string;
    timestamp: string;
    sourceProvider: string;
    sourceRecordId: string;
    provenance?: string;
    value: number;
  }[];
  sleepSessions: {
    id: string;
    date: string;
    timestamp: string;
    sourceProvider: string;
    sourceRecordId: string;
    bedtimeIso: string;
    wakeTimeIso: string;
    timeInBedMinutes: number;
    totalSleepMinutes: number;
    awakeMinutes: number;
    lightMinutes?: number;
    deepMinutes?: number;
    remMinutes?: number;
    hasStageData: boolean;
    efficiencyPercent: number;
    awakeningsCount: number;
    stages?: SleepStageSegment[];
  }[];
  workouts: {
    id: string;
    date: string;
    timestamp: string;
    startTimeIso: string;
    sourceProvider: string;
    sourceRecordId: string;
    title: string;
    sport: string;
    durationMinutes: number;
    distanceKm?: number;
    elevationGainM?: number;
    cadenceSpm?: number;
    avgHrBpm?: number;
    maxHrBpm?: number;
    caloriesKcal?: number;
    timeSeries?: WorkoutTimeSeriesPoint[];
  }[];
  dailyActivities: {
    id: string;
    date: string;
    timestamp: string;
    sourceProvider: string;
    sourceRecordId: string;
    steps: number;
    activeMinutes: number;
    estimatedEnergyKcal: number;
    activeCaloriesKcal?: number;
    vo2MaxEstimate?: number;
    spo2Percent?: number;
    respiratoryRateBpm?: number;
    skinTempDeviationC?: number;
  }[];
  bodyMeasurements: {
    id: string;
    date: string;
    timestamp: string;
    sourceProvider: string;
    sourceRecordId: string;
    weightKg: number;
    bodyFatPercent?: number;
    muscleMassKg?: number;
  }[];
  hydrationEntries: {
    date: string;
    ml: number;
    updatedAt: string;
  }[];
  meals?: {
    id: string;
    date: string;
    timestamp: string;
    category: string;
    title: string;
    totalCalories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number;
  }[];
}

export interface HealthConnectMappedBatch {
  providerId: DeviceProviderId;
  syncedAt: string;
  daysSynced: number;
  grantedCount: number;
  hrvObservations: HRVObservation[];
  rhrObservations: RestingHeartRateObservation[];
  sleepSessions: SleepSession[];
  workouts: WorkoutSession[];
  dailyActivities: DailyActivitySummary[];
  bodyMeasurements: BodyMeasurement[];
  hydrationEntries: HydrationEntry[];
  meals: MealEntry[];
}

interface KadenzNativePluginInterface {
  getPendingIntent(): Promise<NativePendingIntent>;
  getSafeAreaInsets(): Promise<SafeAreaInsets>;
  setSystemBars(options: { isDark: boolean; backgroundColor?: string }): Promise<void>;
  readClipboard(): Promise<{ text: string; error?: string }>;
  writeClipboard(options: { text: string }): Promise<{ ok: boolean }>;
  haptic(options: { pattern: HapticPatternName }): Promise<{ ok: boolean }>;
  checkCameraPermission(): Promise<{ granted: boolean }>;
  requestCameraPermission(): Promise<{ granted: boolean }>;
  exportFile(options: {
    filename: string;
    content: string;
    mimeType?: string;
  }): Promise<{ ok: boolean; path?: string }>;
  configureBackgroundSync(options: { enabled: boolean }): Promise<{ ok: boolean; enabled?: boolean }>;
  isBatteryOptimizationIgnored(): Promise<{ ignored: boolean }>;
  requestIgnoreBatteryOptimization(): Promise<{ ignored?: boolean; requested?: boolean }>;
  isAppInstalled(options: { packageName: string }): Promise<{ installed: boolean }>;
  openExternalApp(options: { packageName: string }): Promise<{ opened: boolean; store?: boolean }>;
  minimizeApp(): Promise<void>;
  getDeviceInfo(): Promise<{
    platform: string;
    sdkInt: number;
    manufacturer: string;
    model: string;
    appVersion: string;
  }>;
  addListener(
    eventName: 'incomingIntent',
    listenerFunc: (event: NativeIncomingIntentEvent) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'safeAreaInsets',
    listenerFunc: (insets: SafeAreaInsets) => void
  ): Promise<PluginListenerHandle>;
  addListener(eventName: 'hardwareBack', listenerFunc: () => void): Promise<PluginListenerHandle>;
}

interface HealthConnectPluginInterface {
  getStatus(): Promise<HealthConnectStatus>;
  checkPermissions(): Promise<HealthConnectPermissionSummary>;
  requestPermissions(options?: {
    includeWrite?: boolean;
    includeBackground?: boolean;
    includeHistory?: boolean;
  }): Promise<HealthConnectPermissionSummary>;
  requestBackgroundPermission(): Promise<HealthConnectPermissionSummary>;
  openSettings(): Promise<{ opened: string }>;
  syncData(options?: { daysBack?: number }): Promise<RawHealthConnectSyncResponse>;
  consumeBackgroundSnapshot(): Promise<RawHealthConnectSyncResponse>;
  triggerImmediateBackgroundSync(): Promise<{ scheduled: boolean }>;
  writeWeight(options: { weightKg: number }): Promise<{ written: boolean }>;
  writeHydration(options: { deltaMl: number }): Promise<{ written: boolean }>;
  writeNutrition(options: {
    title: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number;
    category: MealCategory;
  }): Promise<{ written: boolean }>;
}

const KadenzNative = registerPlugin<KadenzNativePluginInterface>('KadenzNative');
const HealthConnect = registerPlugin<HealthConnectPluginInterface>('HealthConnect');

const VALID_PROVIDERS = new Set<DeviceProviderId>([
  'garmin',
  'coros',
  'polar',
  'suunto',
  'apple_health',
  'health_connect',
  'samsung_health',
  'fitbit',
  'amazfit',
  'withings',
  'oura',
  'other',
]);

const VALID_SPORTS = new Set<SportType>([
  'running',
  'walking',
  'cycling',
  'strength',
  'calisthenics',
  'swimming',
  'hiking',
  'football',
  'other',
]);

function normalizeProvider(raw?: string): DeviceProviderId {
  if (raw && VALID_PROVIDERS.has(raw as DeviceProviderId)) {
    return raw as DeviceProviderId;
  }
  return 'health_connect';
}

function normalizeSport(raw?: string): SportType {
  if (raw && VALID_SPORTS.has(raw as SportType)) {
    return raw as SportType;
  }
  return 'other';
}

function normalizeProvenance(raw?: string): MeasurementProvenance {
  if (raw === 'measured' || raw === 'wearable_estimate' || raw === 'app_estimate') {
    return raw;
  }
  return 'measured';
}

function normalizeMealCategory(raw?: string): MealCategory {
  if (raw === 'breakfast' || raw === 'lunch' || raw === 'dinner' || raw === 'snack') {
    return raw;
  }
  return 'snack';
}

export function isNativeAndroid(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

// =========================================================================
// System Bars & Safe Area Insets
// =========================================================================

export async function syncNativeSystemBars(isDark: boolean, backgroundColor: string): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    await KadenzNative.setSystemBars({ isDark, backgroundColor });
  } catch {
    // Graceful no-op
  }
}

function applySafeAreaVars(insets: SafeAreaInsets): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--android-safe-top', `${Math.max(0, insets.top)}px`);
  root.style.setProperty('--android-safe-bottom', `${Math.max(0, insets.bottom)}px`);
  root.style.setProperty('--android-safe-left', `${Math.max(0, insets.left)}px`);
  root.style.setProperty('--android-safe-right', `${Math.max(0, insets.right)}px`);
}

export function initNativeSafeAreaInsets(): () => void {
  if (!isNativeAndroid()) return () => {};
  let handle: PluginListenerHandle | null = null;
  let active = true;

  KadenzNative.getSafeAreaInsets()
    .then((insets) => {
      if (active) applySafeAreaVars(insets);
    })
    .catch(() => {});

  KadenzNative.addListener('safeAreaInsets', (insets) => {
    if (active) applySafeAreaVars(insets);
  })
    .then((h) => {
      if (active) {
        handle = h;
      } else {
        h.remove();
      }
    })
    .catch(() => {});

  return () => {
    active = false;
    handle?.remove();
  };
}

// =========================================================================
// Native Clipboard (reliable on Android WebView + Web fallback)
// =========================================================================

export async function readTextFromClipboard(): Promise<string | null> {
  if (isNativeAndroid()) {
    try {
      const res = await KadenzNative.readClipboard();
      return res.text ?? '';
    } catch {
      // fall through to web clipboard
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
    return navigator.clipboard.readText();
  }
  return null;
}

export async function writeTextToClipboard(text: string): Promise<boolean> {
  if (isNativeAndroid()) {
    try {
      const res = await KadenzNative.writeClipboard({ text });
      if (res.ok) return true;
    } catch {
      // fall through to web clipboard
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

// =========================================================================
// Native Haptics
// =========================================================================

export function triggerNativeAndroidHaptic(pattern: HapticPatternName): boolean {
  if (!isNativeAndroid()) return false;
  KadenzNative.haptic({ pattern }).catch(() => {});
  return true;
}

// =========================================================================
// Native Camera Runtime Permission
// =========================================================================

export async function ensureNativeCameraPermission(): Promise<boolean> {
  if (!isNativeAndroid()) return true;
  try {
    const check = await KadenzNative.checkCameraPermission();
    if (check.granted) return true;
    const req = await KadenzNative.requestCameraPermission();
    return Boolean(req.granted);
  } catch {
    return false;
  }
}

// =========================================================================
// Native Backup File Export (FileProvider + Android Share/Save Sheet)
// =========================================================================

export async function exportJsonBackupNative(filename: string, content: string): Promise<boolean> {
  if (!isNativeAndroid()) return false;
  try {
    const res = await KadenzNative.exportFile({
      filename,
      content,
      mimeType: 'application/json',
    });
    return Boolean(res.ok);
  } catch {
    return false;
  }
}

// =========================================================================
// Native Incoming Intents (Share Target, Deep-Links, Launcher Shortcuts)
// =========================================================================

export function subscribeToNativeIntents(
  onIntent: (event: NativeIncomingIntentEvent) => void
): () => void {
  if (!isNativeAndroid()) return () => {};
  let active = true;
  let handle: PluginListenerHandle | null = null;

  KadenzNative.getPendingIntent()
    .then((pending) => {
      if (active && pending.hasPending && pending.kind && pending.rawText) {
        onIntent({
          kind: pending.kind,
          rawText: pending.rawText,
          receivedAt: pending.receivedAt ?? Date.now(),
        });
      }
    })
    .catch(() => {});

  KadenzNative.addListener('incomingIntent', (event) => {
    if (active && event.kind && event.rawText) {
      onIntent(event);
    }
  })
    .then((h) => {
      if (active) {
        handle = h;
      } else {
        h.remove();
      }
    })
    .catch(() => {});

  return () => {
    active = false;
    handle?.remove();
  };
}

// =========================================================================
// Native Hardware Back Button, Battery Optimization & Companion Apps
// =========================================================================

export function subscribeToNativeBackButton(onBack: () => void): () => void {
  if (!isNativeAndroid()) return () => {};
  let active = true;
  let handle: PluginListenerHandle | null = null;

  KadenzNative.addListener('hardwareBack', () => {
    if (active) onBack();
  })
    .then((h) => {
      if (active) {
        handle = h;
      } else {
        h.remove();
      }
    })
    .catch(() => {});

  return () => {
    active = false;
    handle?.remove();
  };
}

export async function minimizeNativeApp(): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    await KadenzNative.minimizeApp();
  } catch {
    // ignore
  }
}

export async function configureNativeBackgroundSync(enabled: boolean): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    await KadenzNative.configureBackgroundSync({ enabled });
  } catch {
    // ignore
  }
}

export async function isBatteryOptimizationIgnored(): Promise<boolean> {
  if (!isNativeAndroid()) return true;
  try {
    const res = await KadenzNative.isBatteryOptimizationIgnored();
    return Boolean(res.ignored);
  } catch {
    return false;
  }
}

export async function requestIgnoreBatteryOptimization(): Promise<boolean> {
  if (!isNativeAndroid()) return true;
  try {
    const res = await KadenzNative.requestIgnoreBatteryOptimization();
    return Boolean(res.ignored || res.requested);
  } catch {
    return false;
  }
}

export async function isExternalAppInstalled(packageName: string): Promise<boolean> {
  if (!isNativeAndroid()) return false;
  try {
    const res = await KadenzNative.isAppInstalled({ packageName });
    return Boolean(res.installed);
  } catch {
    return false;
  }
}

export async function openExternalWearableApp(packageName: string): Promise<boolean> {
  if (!isNativeAndroid()) return false;
  try {
    const res = await KadenzNative.openExternalApp({ packageName });
    return Boolean(res.opened);
  } catch {
    return false;
  }
}

// =========================================================================
// Native Android Health Connect API
// =========================================================================

export async function getHealthConnectStatus(): Promise<HealthConnectStatus> {
  if (!isNativeAndroid()) {
    return { available: false, status: 'unavailable' };
  }
  try {
    return await HealthConnect.getStatus();
  } catch {
    return { available: false, status: 'unavailable' };
  }
}

export async function checkHealthConnectPermissions(): Promise<HealthConnectPermissionSummary> {
  if (!isNativeAndroid()) {
    return {
      granted: [],
      grantedCount: 0,
      readGrantedCount: 0,
      writeGrantedCount: 0,
      totalCount: 0,
      hasReadAccess: false,
      hasWriteAccess: false,
      allGranted: false,
      backgroundReadSupported: false,
      backgroundReadGranted: false,
      historyReadSupported: false,
      historyReadGranted: false,
    };
  }
  return HealthConnect.checkPermissions();
}

export async function requestHealthConnectPermissions(
  includeWrite = true
): Promise<HealthConnectPermissionSummary> {
  return HealthConnect.requestPermissions({
    includeWrite,
    includeBackground: true,
    includeHistory: true,
  });
}

export async function requestHealthConnectBackgroundPermission(): Promise<HealthConnectPermissionSummary> {
  return HealthConnect.requestBackgroundPermission();
}

export async function openHealthConnectSettings(): Promise<void> {
  if (!isNativeAndroid()) return;
  await HealthConnect.openSettings();
}

export async function triggerImmediateHealthConnectBackgroundSync(): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    await HealthConnect.triggerImmediateBackgroundSync();
  } catch {
    // ignore
  }
}

function mapRawHealthConnectSnapshot(
  raw: RawHealthConnectSyncResponse,
  profile: UserProfile
): HealthConnectMappedBatch {
  const hrvObservations: HRVObservation[] = (raw.hrvObservations ?? []).map((h) => ({
    id: h.id,
    date: h.date,
    timestamp: h.timestamp,
    sourceProvider: normalizeProvider(h.sourceProvider),
    sourceRecordId: h.sourceRecordId,
    dataQuality: 'high',
    provenance: normalizeProvenance(h.provenance),
    metricType: 'hrv_rmssd',
    unit: 'ms',
    value: h.value,
    recordingContext: 'overnight_avg',
  }));

  const rhrObservations: RestingHeartRateObservation[] = (raw.rhrObservations ?? []).map((r) => ({
    id: r.id,
    date: r.date,
    timestamp: r.timestamp,
    sourceProvider: normalizeProvider(r.sourceProvider),
    sourceRecordId: r.sourceRecordId,
    dataQuality: r.provenance === 'wearable_estimate' ? 'moderate' : 'high',
    provenance: normalizeProvenance(r.provenance),
    metricType: 'resting_hr',
    unit: 'bpm',
    value: r.value,
    recordingContext: 'overnight_min',
  }));

  const sleepSessions: SleepSession[] = (raw.sleepSessions ?? []).map((s) => ({
    id: s.id,
    date: s.date,
    timestamp: s.timestamp,
    sourceProvider: normalizeProvider(s.sourceProvider),
    sourceRecordId: s.sourceRecordId,
    dataQuality: s.hasStageData ? 'high' : 'moderate',
    provenance: 'measured',
    metricType: 'sleep_session',
    bedtimeIso: s.bedtimeIso,
    wakeTimeIso: s.wakeTimeIso,
    timeInBedMinutes: s.timeInBedMinutes,
    totalSleepMinutes: s.totalSleepMinutes,
    awakeMinutes: s.awakeMinutes,
    lightMinutes: s.hasStageData ? (s.lightMinutes ?? 0) : null,
    deepMinutes: s.hasStageData ? (s.deepMinutes ?? 0) : null,
    remMinutes: s.hasStageData ? (s.remMinutes ?? 0) : null,
    hasStageData: Boolean(s.hasStageData),
    efficiencyPercent: s.efficiencyPercent,
    awakeningsCount: s.awakeningsCount,
    stages: Array.isArray(s.stages) ? s.stages : [],
  }));

  const workouts: WorkoutSession[] = (raw.workouts ?? []).map((w) => {
    const sport = normalizeSport(w.sport);
    const { rawLoad, normalizedLoad, zoneMinutes } = calculateWorkoutLoad(
      {
        sport,
        durationMinutes: w.durationMinutes,
        avgHrBpm: w.avgHrBpm,
        distanceKm: w.distanceKm,
      },
      profile
    );
    return {
      id: w.id,
      date: w.date,
      timestamp: w.timestamp,
      sourceProvider: normalizeProvider(w.sourceProvider),
      sourceRecordId: w.sourceRecordId,
      dataQuality: w.avgHrBpm ? 'high' : 'moderate',
      provenance: 'measured',
      metricType: 'workout',
      title: w.title,
      sport,
      startTimeIso: w.startTimeIso,
      durationMinutes: w.durationMinutes,
      distanceKm: w.distanceKm,
      elevationGainM: w.elevationGainM,
      cadenceSpm: w.cadenceSpm,
      avgPaceSecPerKm:
        w.distanceKm && w.distanceKm > 0.2
          ? Math.round((w.durationMinutes * 60) / w.distanceKm)
          : undefined,
      avgHrBpm: w.avgHrBpm,
      maxHrBpm: w.maxHrBpm,
      caloriesKcal: w.caloriesKcal,
      rawLoadScore: rawLoad,
      normalizedLoad,
      hrZoneMinutes: zoneMinutes,
      timeSeries: Array.isArray(w.timeSeries) && w.timeSeries.length > 0 ? w.timeSeries : undefined,
    };
  });

  const dailyActivities: DailyActivitySummary[] = (raw.dailyActivities ?? []).map((a) => ({
    id: a.id,
    date: a.date,
    timestamp: a.timestamp,
    sourceProvider: normalizeProvider(a.sourceProvider),
    sourceRecordId: a.sourceRecordId,
    dataQuality: 'high',
    provenance: 'measured',
    metricType: 'daily_activity',
    steps: a.steps,
    activeMinutes: a.activeMinutes,
    estimatedEnergyKcal: a.estimatedEnergyKcal,
    activeCaloriesKcal: a.activeCaloriesKcal,
    vo2MaxEstimate: a.vo2MaxEstimate,
    spo2Percent: a.spo2Percent,
    respiratoryRateBpm: a.respiratoryRateBpm,
    skinTempDeviationC: a.skinTempDeviationC,
  }));

  const bodyMeasurements: BodyMeasurement[] = (raw.bodyMeasurements ?? []).map((b) => ({
    id: b.id,
    date: b.date,
    timestamp: b.timestamp,
    sourceProvider: normalizeProvider(b.sourceProvider),
    sourceRecordId: b.sourceRecordId,
    dataQuality: 'high',
    provenance: 'measured',
    metricType: 'body_measurement',
    weightKg: b.weightKg,
    bodyFatPercent: b.bodyFatPercent,
    muscleMassKg: b.muscleMassKg,
  }));

  const hydrationEntries: HydrationEntry[] = (raw.hydrationEntries ?? []).map((h) => ({
    date: h.date,
    ml: h.ml,
    updatedAt: h.updatedAt,
  }));

  const meals: MealEntry[] = (raw.meals ?? []).map((m) => ({
    id: m.id,
    date: m.date,
    timestamp: m.timestamp,
    category: normalizeMealCategory(m.category),
    title: m.title,
    subtitle: `${m.proteinG}g E · ${m.carbsG}g KH · ${m.fatG}g F`,
    items: [
      {
        id: `${m.id}_item`,
        name: m.title,
        grams: 100,
        calories: m.totalCalories,
        proteinG: m.proteinG,
        carbsG: m.carbsG,
        fatG: m.fatG,
        fiberG: m.fiberG,
        source: 'manual',
      },
    ],
    totalCalories: m.totalCalories,
    proteinG: m.proteinG,
    carbsG: m.carbsG,
    fatG: m.fatG,
    fiberG: m.fiberG,
    analysisNote: 'Health Connect Sync',
  }));

  return {
    providerId: 'health_connect',
    syncedAt: raw.syncedAt,
    daysSynced: raw.daysSynced ?? 30,
    grantedCount: raw.grantedCount ?? 0,
    hrvObservations,
    rhrObservations,
    sleepSessions,
    workouts,
    dailyActivities,
    bodyMeasurements,
    hydrationEntries,
    meals,
  };
}

export async function syncHealthConnectBatch(
  profile: UserProfile,
  daysBack = 30
): Promise<HealthConnectMappedBatch> {
  const raw = await HealthConnect.syncData({ daysBack });
  return mapRawHealthConnectSnapshot(raw, profile);
}

export async function consumeHealthConnectBackgroundSnapshot(
  profile: UserProfile
): Promise<HealthConnectMappedBatch | null> {
  if (!isNativeAndroid()) return null;
  try {
    const raw = await HealthConnect.consumeBackgroundSnapshot();
    if (!raw || !raw.hasSnapshot) return null;
    return mapRawHealthConnectSnapshot(raw, profile);
  } catch {
    return null;
  }
}

export async function writeWeightToHealthConnect(weightKg: number): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    await HealthConnect.writeWeight({ weightKg });
  } catch {
    // Optional two-way sync: never fail local save
  }
}

export async function writeHydrationToHealthConnect(deltaMl: number): Promise<void> {
  if (!isNativeAndroid() || deltaMl <= 0) return;
  try {
    await HealthConnect.writeHydration({ deltaMl });
  } catch {
    // Optional two-way sync: never fail local save
  }
}

export async function writeMealToHealthConnect(meal: MealEntry): Promise<void> {
  if (!isNativeAndroid() || meal.totalCalories <= 0) return;
  try {
    await HealthConnect.writeNutrition({
      title: meal.title,
      calories: meal.totalCalories,
      proteinG: meal.proteinG,
      carbsG: meal.carbsG,
      fatG: meal.fatG,
      fiberG: meal.fiberG,
      category: meal.category,
    });
  } catch {
    // Optional two-way sync: never fail local save
  }
}
