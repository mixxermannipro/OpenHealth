import FitParser from 'fit-file-parser';
import {
  DeviceProviderId,
  HRVObservation,
  RestingHeartRateObservation,
  SleepSession,
  SportType,
  UserProfile,
  WorkoutSession,
  WorkoutTimeSeriesPoint,
} from '../types/health';
import { calculateWorkoutLoad } from '../engine/calculations';
import { toLocalDateKey } from '../utils/formatters';

export interface FileImportResult {
  format: 'fit' | 'gpx' | 'tcx' | 'apple_health_xml' | 'health_connect_json';
  workouts: WorkoutSession[];
  hrvObservations: HRVObservation[];
  rhrObservations: RestingHeartRateObservation[];
  sleepSessions: SleepSession[];
  summary: string;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mapSportName(raw?: string): SportType {
  const s = (raw || '').toLowerCase();
  if (s.includes('run') || s.includes('lauf')) return 'running';
  if (s.includes('cycl') || s.includes('bik') || s.includes('rad')) return 'cycling';
  if (s.includes('swim') || s.includes('schwimm')) return 'swimming';
  if (s.includes('walk') || s.includes('geh')) return 'walking';
  if (s.includes('hik') || s.includes('wander')) return 'hiking';
  if (s.includes('strength') || s.includes('kraft') || s.includes('weight')) return 'strength';
  return 'running';
}

/**
 * Pure regex/string-safe GPX parser (works in both browser and Node unit tests without DOMParser dependency).
 * Supports Garmin, COROS, Polar, Suunto, and Strava standard GPX 1.1 exports with TrackPointExtension HR.
 */
export function parseGpxFile(
  xmlText: string,
  providerId: DeviceProviderId,
  profile: UserProfile
): FileImportResult {
  const nameMatch = xmlText.match(/<name>([^<]+)<\/name>/i);
  const typeMatch = xmlText.match(/<type>([^<]+)<\/type>/i);
  const trkptRegex = /<trkpt\s+[^>]*lat=["']([^"']+)["'][^>]*lon=["']([^"']+)["'][^>]*>([\s\S]*?)<\/trkpt>/gi;

  const points: { lat: number; lon: number; ele?: number; timeMs?: number; hr?: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = trkptRegex.exec(xmlText)) !== null) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    const body = match[3];
    const eleM = body.match(/<ele>([^<]+)<\/ele>/i);
    const timeM = body.match(/<time>([^<]+)<\/time>/i);
    const hrM = body.match(/<(?:gpxtpx:|ns3:)?hr>(\d+(?:\.\d+)?)<\/(?:gpxtpx:|ns3:)?hr>/i);
    points.push({
      lat,
      lon,
      ele: eleM ? parseFloat(eleM[1]) : undefined,
      timeMs: timeM ? Date.parse(timeM[1]) : undefined,
      hr: hrM ? Math.round(parseFloat(hrM[1])) : undefined,
    });
  }

  if (points.length === 0) {
    return {
      format: 'gpx',
      workouts: [],
      hrvObservations: [],
      rhrObservations: [],
      sleepSessions: [],
      summary: 'Keine GPX-Trackpunkte gefunden.',
    };
  }

  let distanceKm = 0;
  let elevationGainM = 0;
  for (let i = 1; i < points.length; i++) {
    distanceKm += haversineKm(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
    if (points[i].ele !== undefined && points[i - 1].ele !== undefined) {
      const diff = points[i].ele! - points[i - 1].ele!;
      if (diff > 0.4) elevationGainM += diff;
    }
  }

  const startMs = points.find((p) => p.timeMs)?.timeMs ?? Date.now();
  const endMs = [...points].reverse().find((p) => p.timeMs)?.timeMs ?? startMs + 30 * 60000;
  const durationMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));
  const hrs = points.map((p) => p.hr).filter((v): v is number => v !== undefined);
  const avgHrBpm = hrs.length > 0 ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : undefined;
  const maxHrBpm = hrs.length > 0 ? Math.max(...hrs) : undefined;

  const sport = mapSportName(typeMatch?.[1] || nameMatch?.[1]);
  const startIso = new Date(startMs).toISOString();
  const dateKey = toLocalDateKey(new Date(startMs));
  const { rawLoad, normalizedLoad, zoneMinutes } = calculateWorkoutLoad(
    { sport, durationMinutes, avgHrBpm, distanceKm: Number(distanceKm.toFixed(2)) },
    profile
  );

  const workout: WorkoutSession = {
    id: `imp_gpx_${dateKey}_${Date.now()}`,
    date: dateKey,
    timestamp: startIso,
    sourceProvider: providerId,
    sourceRecordId: `gpx_${startIso}_${Math.round(distanceKm * 100)}`,
    dataQuality: avgHrBpm ? 'high' : 'moderate',
    provenance: 'measured',
    metricType: 'workout',
    title: nameMatch?.[1]?.trim() || 'Importiertes GPX-Training',
    sport,
    startTimeIso: startIso,
    durationMinutes,
    distanceKm: distanceKm > 0.05 ? Number(distanceKm.toFixed(2)) : undefined,
    avgPaceSecPerKm: distanceKm > 0.2 ? Math.round((durationMinutes * 60) / distanceKm) : undefined,
    avgHrBpm,
    maxHrBpm,
    elevationGainM: Math.round(elevationGainM),
    caloriesKcal: Math.round(durationMinutes * (avgHrBpm ? (avgHrBpm / 140) * 11 : 9.5)),
    rawLoadScore: rawLoad,
    normalizedLoad,
    hrZoneMinutes: zoneMinutes,
  };

  return {
    format: 'gpx',
    workouts: [workout],
    hrvObservations: [],
    rhrObservations: [],
    sleepSessions: [],
    summary: `GPX importiert: ${workout.title} (${workout.durationMinutes} Min.${workout.distanceKm ? `, ${workout.distanceKm} km` : ''})`,
  };
}

/**
 * Pure TCX parser (Garmin Training Center XML / COROS / Polar open export format).
 */
export function parseTcxFile(
  xmlText: string,
  providerId: DeviceProviderId,
  profile: UserProfile
): FileImportResult {
  const sportM = xmlText.match(/<Activity\s+Sport=["']([^"']+)["']/i);
  const idM = xmlText.match(/<Id>([^<]+)<\/Id>/i);
  const totalTimeMatches = [...xmlText.matchAll(/<TotalTimeSeconds>([^<]+)<\/TotalTimeSeconds>/gi)];
  const distMatches = [...xmlText.matchAll(/<DistanceMeters>([^<]+)<\/DistanceMeters>/gi)];
  const calMatches = [...xmlText.matchAll(/<Calories>([^<]+)<\/Calories>/gi)];
  const hrMatches = [...xmlText.matchAll(/<HeartRateBpm[^>]*>\s*<Value>(\d+)<\/Value>/gi)];

  const durationSec = totalTimeMatches.reduce((a, m) => a + parseFloat(m[1]), 0);
  const distanceMeters = distMatches.reduce((a, m) => Math.max(a, parseFloat(m[1])), 0);
  const calories = calMatches.reduce((a, m) => a + parseFloat(m[1]), 0);
  const hrs = hrMatches.map((m) => parseInt(m[1], 10)).filter((n) => n > 35 && n < 230);

  if (durationSec <= 0 && hrs.length === 0) {
    return {
      format: 'tcx',
      workouts: [],
      hrvObservations: [],
      rhrObservations: [],
      sleepSessions: [],
      summary: 'Keine gültigen TCX-Aktivitätsdaten gefunden.',
    };
  }

  const startIso = idM?.[1] && !Number.isNaN(Date.parse(idM[1])) ? idM[1] : new Date().toISOString();
  const dateKey = toLocalDateKey(new Date(startIso));
  const durationMinutes = Math.max(1, Math.round(durationSec / 60) || 30);
  const distanceKm = distanceMeters > 50 ? Number((distanceMeters / 1000).toFixed(2)) : undefined;
  const avgHrBpm = hrs.length > 0 ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : undefined;
  const maxHrBpm = hrs.length > 0 ? Math.max(...hrs) : undefined;
  const sport = mapSportName(sportM?.[1]);

  const { rawLoad, normalizedLoad, zoneMinutes } = calculateWorkoutLoad(
    { sport, durationMinutes, avgHrBpm, distanceKm },
    profile
  );

  const workout: WorkoutSession = {
    id: `imp_tcx_${dateKey}_${Date.now()}`,
    date: dateKey,
    timestamp: startIso,
    sourceProvider: providerId,
    sourceRecordId: `tcx_${startIso}_${durationMinutes}`,
    dataQuality: avgHrBpm ? 'high' : 'moderate',
    provenance: 'measured',
    metricType: 'workout',
    title: `${sport === 'running' ? 'Lauf' : sport === 'cycling' ? 'Radfahrt' : 'Training'} (TCX Import)`,
    sport,
    startTimeIso: startIso,
    durationMinutes,
    distanceKm,
    avgPaceSecPerKm: distanceKm ? Math.round((durationMinutes * 60) / distanceKm) : undefined,
    avgHrBpm,
    maxHrBpm,
    caloriesKcal: calories > 0 ? Math.round(calories) : Math.round(durationMinutes * 10),
    rawLoadScore: rawLoad,
    normalizedLoad,
    hrZoneMinutes: zoneMinutes,
  };

  return {
    format: 'tcx',
    workouts: [workout],
    hrvObservations: [],
    rhrObservations: [],
    sleepSessions: [],
    summary: `TCX importiert: ${workout.title} (${durationMinutes} Min.)`,
  };
}

/**
 * Pure Apple Health export.xml parser (extracts HRV, Resting Heart Rate, and Workouts locally on-device).
 */
export function parseAppleHealthXml(xmlText: string, profile: UserProfile): FileImportResult {
  const hrvObservations: HRVObservation[] = [];
  const rhrObservations: RestingHeartRateObservation[] = [];
  const workouts: WorkoutSession[] = [];

  const recordRegex = /<Record\s+([^>]+?)\/?\s*>/gi;
  let match: RegExpExecArray | null;
  const seenHrvDates = new Set<string>();
  const seenRhrDates = new Set<string>();

  while ((match = recordRegex.exec(xmlText)) !== null) {
    const attrs = match[1];
    const typeM = attrs.match(/type=["']([^"']+)["']/);
    const valM = attrs.match(/value=["']([^"']+)["']/);
    const startM = attrs.match(/startDate=["']([^"']+)["']/);
    if (!typeM || !valM || !startM) continue;

    const dateStr = startM[1].slice(0, 10);
    const numVal = parseFloat(valM[1]);
    if (Number.isNaN(numVal)) continue;

    if (typeM[1] === 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN' && !seenHrvDates.has(dateStr)) {
      seenHrvDates.add(dateStr);
      hrvObservations.push({
        id: `ah_hrv_${dateStr}`,
        date: dateStr,
        timestamp: startM[1],
        sourceProvider: 'apple_health',
        sourceRecordId: `ah_hrv_${startM[1]}`,
        dataQuality: 'high',
        provenance: 'measured',
        metricType: 'hrv_rmssd',
        unit: 'ms',
        value: Math.round(numVal),
        recordingContext: 'overnight_avg',
      });
    } else if (typeM[1] === 'HKQuantityTypeIdentifierRestingHeartRate' && !seenRhrDates.has(dateStr)) {
      seenRhrDates.add(dateStr);
      rhrObservations.push({
        id: `ah_rhr_${dateStr}`,
        date: dateStr,
        timestamp: startM[1],
        sourceProvider: 'apple_health',
        sourceRecordId: `ah_rhr_${startM[1]}`,
        dataQuality: 'high',
        provenance: 'measured',
        metricType: 'resting_hr',
        unit: 'bpm',
        value: Math.round(numVal),
        recordingContext: 'morning_rest',
      });
    }
  }

  const workoutRegex = /<Workout\s+([^>]+?)\/?\s*>/gi;
  while ((match = workoutRegex.exec(xmlText)) !== null) {
    const attrs = match[1];
    const typeM = attrs.match(/workoutActivityType=["']([^"']+)["']/);
    const durM = attrs.match(/duration=["']([^"']+)["']/);
    const distM = attrs.match(/totalDistance=["']([^"']+)["']/);
    const calM = attrs.match(/totalEnergyBurned=["']([^"']+)["']/);
    const startM = attrs.match(/startDate=["']([^"']+)["']/);
    if (!durM || !startM) continue;

    const dateStr = startM[1].slice(0, 10);
    const durationMinutes = Math.max(1, Math.round(parseFloat(durM[1])));
    const distanceKm = distM ? Number(parseFloat(distM[1]).toFixed(2)) : undefined;
    const sport = mapSportName(typeM?.[1]);
    const { rawLoad, normalizedLoad, zoneMinutes } = calculateWorkoutLoad(
      { sport, durationMinutes, distanceKm, rpe: 6 },
      profile
    );

    workouts.push({
      id: `ah_wk_${dateStr}_${workouts.length}`,
      date: dateStr,
      timestamp: startM[1],
      sourceProvider: 'apple_health',
      sourceRecordId: `ah_wk_${startM[1]}_${durationMinutes}`,
      dataQuality: 'high',
      provenance: 'measured',
      metricType: 'workout',
      title: `Apple Health ${sport === 'running' ? 'Lauf' : 'Training'}`,
      sport,
      startTimeIso: startM[1],
      durationMinutes,
      distanceKm,
      caloriesKcal: calM ? Math.round(parseFloat(calM[1])) : undefined,
      rawLoadScore: rawLoad,
      normalizedLoad,
      hrZoneMinutes: zoneMinutes,
    });
  }

  return {
    format: 'apple_health_xml',
    workouts,
    hrvObservations,
    rhrObservations,
    sleepSessions: [],
    summary: `Apple Health XML: ${hrvObservations.length} HRV, ${rhrObservations.length} Ruhepuls, ${workouts.length} Trainings lokal verarbeitet.`,
  };
}

/**
 * Android Health Connect JSON export parser (supports Health Connect Toolbox / Takeout JSON records).
 */
export function parseHealthConnectJson(jsonText: string, profile: UserProfile): FileImportResult {
  const parsed = JSON.parse(jsonText) as Record<string, unknown>;
  const hrvObservations: HRVObservation[] = [];
  const rhrObservations: RestingHeartRateObservation[] = [];
  const workouts: WorkoutSession[] = [];

  const hrvRecords = (parsed.heartRateVariabilityRmssdRecords || parsed.hrv || []) as Array<Record<string, unknown>>;
  for (const r of hrvRecords) {
    const time = String(r.time || r.timestamp || new Date().toISOString());
    const val = Number(r.heartRateVariabilityMillis ?? r.value);
    if (!Number.isNaN(val) && val > 5) {
      const dateStr = time.slice(0, 10);
      hrvObservations.push({
        id: `hc_hrv_${dateStr}_${hrvObservations.length}`,
        date: dateStr,
        timestamp: time,
        sourceProvider: 'health_connect',
        sourceRecordId: `hc_hrv_${time}`,
        dataQuality: 'high',
        provenance: 'measured',
        metricType: 'hrv_rmssd',
        unit: 'ms',
        value: Math.round(val),
        recordingContext: 'overnight_avg',
      });
    }
  }

  const rhrRecords = (parsed.restingHeartRateRecords || parsed.rhr || []) as Array<Record<string, unknown>>;
  for (const r of rhrRecords) {
    const time = String(r.time || r.timestamp || new Date().toISOString());
    const val = Number(r.beatsPerMinute ?? r.value);
    if (!Number.isNaN(val) && val > 30) {
      const dateStr = time.slice(0, 10);
      rhrObservations.push({
        id: `hc_rhr_${dateStr}_${rhrObservations.length}`,
        date: dateStr,
        timestamp: time,
        sourceProvider: 'health_connect',
        sourceRecordId: `hc_rhr_${time}`,
        dataQuality: 'high',
        provenance: 'measured',
        metricType: 'resting_hr',
        unit: 'bpm',
        value: Math.round(val),
        recordingContext: 'morning_rest',
      });
    }
  }

  const exerciseRecords = (parsed.exerciseSessionRecords || parsed.workouts || []) as Array<Record<string, unknown>>;
  for (const r of exerciseRecords) {
    const startTime = String(r.startTime || r.startTimeIso || new Date().toISOString());
    const endTime = String(r.endTime || '');
    const durMin =
      Number(r.durationMinutes) ||
      (endTime ? Math.max(1, Math.round((Date.parse(endTime) - Date.parse(startTime)) / 60000)) : 35);
    const sport = mapSportName(String(r.exerciseType || r.sport || 'running'));
    const dateStr = startTime.slice(0, 10);
    const { rawLoad, normalizedLoad, zoneMinutes } = calculateWorkoutLoad(
      { sport, durationMinutes: durMin, avgHrBpm: r.avgHrBpm ? Number(r.avgHrBpm) : undefined, rpe: 6 },
      profile
    );
    workouts.push({
      id: `hc_wk_${dateStr}_${workouts.length}`,
      date: dateStr,
      timestamp: startTime,
      sourceProvider: 'health_connect',
      sourceRecordId: `hc_wk_${startTime}_${durMin}`,
      dataQuality: 'high',
      provenance: 'measured',
      metricType: 'workout',
      title: String(r.title || 'Health Connect Training'),
      sport,
      startTimeIso: startTime,
      durationMinutes: durMin,
      distanceKm: r.distanceKm ? Number(r.distanceKm) : undefined,
      avgHrBpm: r.avgHrBpm ? Number(r.avgHrBpm) : undefined,
      caloriesKcal: r.caloriesKcal ? Number(r.caloriesKcal) : Math.round(durMin * 10),
      rawLoadScore: rawLoad,
      normalizedLoad,
      hrZoneMinutes: zoneMinutes,
    });
  }

  return {
    format: 'health_connect_json',
    workouts,
    hrvObservations,
    rhrObservations,
    sleepSessions: [],
    summary: `Health Connect JSON: ${hrvObservations.length} HRV, ${rhrObservations.length} Ruhepuls, ${workouts.length} Trainings importiert.`,
  };
}

/**
 * Binary Garmin / COROS / Polar / Suunto .FIT file parser.
 * Extracts duration, distance, average/max heart rate, elevation gain, cadence,
 * calories, and minute-by-minute HR time-series locally in the browser/WebView.
 */
export async function parseFitFile(
  buffer: ArrayBuffer,
  providerId: DeviceProviderId,
  profile: UserProfile
): Promise<FileImportResult> {
  const parser = new FitParser({
    force: true,
    speedUnit: 'km/h',
    lengthUnit: 'km',
    temperatureUnit: 'celsius',
    elapsedRecordField: true,
    mode: 'list',
  });

  const data = await new Promise<Record<string, unknown>>((resolve, reject) => {
    parser.parse(buffer, (err, parsed) => {
      if (err) reject(new Error(String(err)));
      else resolve(((parsed as unknown) as Record<string, unknown>) || {});
    });
  });

  const sessions = Array.isArray(data.sessions)
    ? (data.sessions as Record<string, unknown>[])
    : [];
  const records = Array.isArray(data.records)
    ? (data.records as Record<string, unknown>[])
    : [];

  if (sessions.length === 0 && records.length === 0) {
    return {
      format: 'fit',
      workouts: [],
      hrvObservations: [],
      rhrObservations: [],
      sleepSessions: [],
      summary: 'Keine gültigen FIT-Trainingsdaten gefunden.',
    };
  }

  const session = sessions[0] ?? {};
  const rawStart = session.start_time ?? session.timestamp ?? records[0]?.timestamp;
  const startDate =
    rawStart instanceof Date
      ? rawStart
      : typeof rawStart === 'string' || typeof rawStart === 'number'
        ? new Date(rawStart)
        : new Date();
  const startMs = Number.isNaN(startDate.getTime()) ? Date.now() : startDate.getTime();
  const startIso = new Date(startMs).toISOString();
  const dateKey = toLocalDateKey(new Date(startMs));

  const elapsedSec = Number(session.total_timer_time ?? session.total_elapsed_time ?? 0);
  const durationMinutes = Math.max(
    1,
    elapsedSec > 0 ? Math.round(elapsedSec / 60) : Math.max(1, Math.round(records.length / 60))
  );

  const rawDistKm = Number(session.total_distance ?? 0);
  const distanceKm = rawDistKm > 0.05 ? Number(rawDistKm.toFixed(2)) : undefined;
  const elevationGainM = Number(session.total_ascent ?? 0) > 0
    ? Math.round(Number(session.total_ascent))
    : undefined;
  const caloriesKcal = Number(session.total_calories ?? 0) > 0
    ? Math.round(Number(session.total_calories))
    : undefined;
  const cadenceRaw = Number(session.avg_running_cadence ?? session.avg_cadence ?? 0);
  const cadenceSpm = cadenceRaw > 0
    ? Math.round(cadenceRaw < 110 ? cadenceRaw * 2 : cadenceRaw)
    : undefined;

  const hrsFromRecords = records
    .map((r) => Number(r.heart_rate ?? 0))
    .filter((n) => Number.isFinite(n) && n >= 35 && n <= 230);

  const avgHrBpm =
    Number(session.avg_heart_rate ?? 0) > 35
      ? Math.round(Number(session.avg_heart_rate))
      : hrsFromRecords.length > 0
        ? Math.round(hrsFromRecords.reduce((a, b) => a + b, 0) / hrsFromRecords.length)
        : undefined;
  const maxHrBpm =
    Number(session.max_heart_rate ?? 0) > 35
      ? Math.round(Number(session.max_heart_rate))
      : hrsFromRecords.length > 0
        ? Math.max(...hrsFromRecords)
        : undefined;

  const sport = mapSportName(String(session.sport ?? session.sub_sport ?? 'running'));

  // Build downsampled HR time-series (up to 120 points)
  const timeSeries: WorkoutTimeSeriesPoint[] = [];
  if (records.length >= 3) {
    const step = Math.max(1, Math.ceil(records.length / 120));
    for (let i = 0; i < records.length; i += step) {
      const rec = records[i];
      const hr = Number(rec.heart_rate ?? 0);
      if (!Number.isFinite(hr) || hr < 35 || hr > 230) continue;
      const recTs = rec.timestamp instanceof Date ? rec.timestamp.getTime() : startMs + i * 1000;
      const minuteOffset = Math.max(0, Math.round((recTs - startMs) / 60000));
      const speedKmh = Number(rec.speed ?? rec.enhanced_speed ?? 0);
      const paceSecPerKm = speedKmh > 1.5 ? Math.round(3600 / speedKmh) : undefined;
      const ele = Number(rec.altitude ?? rec.enhanced_altitude ?? NaN);
      timeSeries.push({
        minuteOffset,
        hrBpm: Math.round(hr),
        paceSecPerKm,
        elevationM: Number.isFinite(ele) ? Math.round(ele) : undefined,
      });
    }
  }

  const { rawLoad, normalizedLoad, zoneMinutes } = calculateWorkoutLoad(
    { sport, durationMinutes, avgHrBpm, distanceKm },
    profile
  );

  const sportTitle =
    sport === 'running'
      ? 'Lauf'
      : sport === 'cycling'
        ? 'Radfahrt'
        : sport === 'swimming'
          ? 'Schwimmen'
          : sport === 'hiking'
            ? 'Wanderung'
            : sport === 'strength'
              ? 'Krafttraining'
              : 'Training';

  const workout: WorkoutSession = {
    id: `imp_fit_${dateKey}_${Date.now()}`,
    date: dateKey,
    timestamp: startIso,
    sourceProvider: providerId,
    sourceRecordId: `fit_${startIso}_${durationMinutes}_${Math.round((distanceKm ?? 0) * 100)}`,
    dataQuality: avgHrBpm ? 'high' : 'moderate',
    provenance: 'measured',
    metricType: 'workout',
    title: `${sportTitle} (${providerId === 'coros' ? 'COROS FIT' : 'FIT Import'})`,
    sport,
    startTimeIso: startIso,
    durationMinutes,
    distanceKm,
    avgPaceSecPerKm: distanceKm && distanceKm > 0.2 ? Math.round((durationMinutes * 60) / distanceKm) : undefined,
    avgHrBpm,
    maxHrBpm,
    cadenceSpm,
    elevationGainM,
    caloriesKcal: caloriesKcal ?? Math.round(durationMinutes * 10),
    rawLoadScore: rawLoad,
    normalizedLoad,
    hrZoneMinutes: zoneMinutes,
    timeSeries: timeSeries.length > 0 ? timeSeries : undefined,
  };

  return {
    format: 'fit',
    workouts: [workout],
    hrvObservations: [],
    rhrObservations: [],
    sleepSessions: [],
    summary: `FIT importiert: ${workout.title} (${workout.durationMinutes} Min.${workout.distanceKm ? `, ${workout.distanceKm} km` : ''})`,
  };
}
