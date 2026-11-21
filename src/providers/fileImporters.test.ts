import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAppleHealthXml,
  parseGpxFile,
  parseHealthConnectJson,
  parseTcxFile,
} from './fileImporters';
import { createDefaultProfile } from '../data/mockGenerator';

test('GPX parser extracts distance, duration, heart rate, and load', () => {
  const profile = createDefaultProfile({}, '2026-11-21');
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1">
      <trk>
        <name>Morgenlauf Isar</name>
        <type>running</type>
        <trkseg>
          <trkpt lat="48.1351" lon="11.5820"><ele>510</ele><time>2026-11-21T07:00:00Z</time><extensions><gpxtpx:hr>145</gpxtpx:hr></extensions></trkpt>
          <trkpt lat="48.1441" lon="11.5820"><ele>522</ele><time>2026-11-21T07:05:00Z</time><extensions><gpxtpx:hr>155</gpxtpx:hr></extensions></trkpt>
          <trkpt lat="48.1531" lon="11.5820"><ele>520</ele><time>2026-11-21T07:10:00Z</time><extensions><gpxtpx:hr>160</gpxtpx:hr></extensions></trkpt>
        </trkseg>
      </trk>
    </gpx>`;

  const res = parseGpxFile(gpx, 'coros', profile);
  assert.equal(res.workouts.length, 1);
  assert.equal(res.workouts[0].title, 'Morgenlauf Isar');
  assert.equal(res.workouts[0].durationMinutes, 10);
  assert.ok((res.workouts[0].distanceKm ?? 0) > 1.8);
  assert.equal(res.workouts[0].avgHrBpm, 153);
});

test('TCX parser parses Garmin/COROS activity XML accurately', () => {
  const profile = createDefaultProfile({}, '2026-11-21');
  const tcx = `<TrainingCenterDatabase>
    <Activities>
      <Activity Sport="Running">
        <Id>2026-11-21T08:00:00Z</Id>
        <Lap>
          <TotalTimeSeconds>2400</TotalTimeSeconds>
          <DistanceMeters>8200</DistanceMeters>
          <Calories>520</Calories>
          <Track>
            <Trackpoint><HeartRateBpm><Value>148</Value></HeartRateBpm></Trackpoint>
            <Trackpoint><HeartRateBpm><Value>156</Value></HeartRateBpm></Trackpoint>
          </Track>
        </Lap>
      </Activity>
    </Activities>
  </TrainingCenterDatabase>`;

  const res = parseTcxFile(tcx, 'garmin', profile);
  assert.equal(res.workouts.length, 1);
  assert.equal(res.workouts[0].durationMinutes, 40);
  assert.equal(res.workouts[0].distanceKm, 8.2);
  assert.equal(res.workouts[0].avgHrBpm, 152);
});

test('Apple Health XML and Health Connect JSON parsers extract HRV, RHR, and Workouts', () => {
  const profile = createDefaultProfile({}, '2026-11-21');
  const xml = `<HealthData>
    <Record type="HKQuantityTypeIdentifierHeartRateVariabilitySDNN" value="94.2" startDate="2026-11-21 06:15:00 +0100" />
    <Record type="HKQuantityTypeIdentifierRestingHeartRate" value="47" startDate="2026-11-21 06:10:00 +0100" />
    <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="42" totalDistance="8.2" totalEnergyBurned="490" startDate="2026-11-21 07:30:00 +0100" />
  </HealthData>`;

  const ah = parseAppleHealthXml(xml, profile);
  assert.equal(ah.hrvObservations.length, 1);
  assert.equal(ah.hrvObservations[0].value, 94);
  assert.equal(ah.rhrObservations[0].value, 47);
  assert.equal(ah.workouts.length, 1);

  const hcJson = JSON.stringify({
    heartRateVariabilityRmssdRecords: [{ time: '2026-11-21T06:20:00Z', heartRateVariabilityMillis: 96 }],
    restingHeartRateRecords: [{ time: '2026-11-21T06:15:00Z', beatsPerMinute: 48 }],
    exerciseSessionRecords: [{ startTime: '2026-11-21T07:30:00Z', durationMinutes: 35, exerciseType: 'strength', title: 'Krafttraining' }],
  });
  const hc = parseHealthConnectJson(hcJson, profile);
  assert.equal(hc.hrvObservations[0].value, 96);
  assert.equal(hc.rhrObservations[0].value, 48);
  assert.equal(hc.workouts[0].sport, 'strength');
});
