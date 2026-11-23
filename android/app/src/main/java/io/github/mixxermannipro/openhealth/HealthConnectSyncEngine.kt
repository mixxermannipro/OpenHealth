package io.github.mixxermannipro.openhealth

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.BasalBodyTemperatureRecord
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ElevationGainedRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.HydrationRecord
import androidx.health.connect.client.records.LeanBodyMassRecord
import androidx.health.connect.client.records.MealType
import androidx.health.connect.client.records.NutritionRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.RespiratoryRateRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SkinTemperatureRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsCadenceRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.Vo2MaxRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.reflect.KClass

/**
 * Shared local-first Health Connect sync engine used identically by both
 * foreground HealthConnectPlugin and background 15-minute HealthSyncWorker.
 */
object HealthConnectSyncEngine {

    private const val PREFS_NAME = "kadenz_native_prefs"
    private const val SNAPSHOT_FILE_NAME = "hc_background_snapshot.json"
    private const val KEY_BG_ENABLED = "bg_sync_enabled"
    private const val KEY_LAST_BG_SYNC_AT = "last_bg_sync_at_iso"
    private const val KEY_LAST_BG_SYNC_STATUS = "last_bg_sync_status"
    private const val KEY_LAST_BG_SYNC_RECORDS = "last_bg_sync_records"

    val readRecordPermissions: Set<String> = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(StepsCadenceRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(RestingHeartRateRecord::class),
        HealthPermission.getReadPermission(HeartRateVariabilityRmssdRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        HealthPermission.getReadPermission(DistanceRecord::class),
        HealthPermission.getReadPermission(ElevationGainedRecord::class),
        HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(WeightRecord::class),
        HealthPermission.getReadPermission(BodyFatRecord::class),
        HealthPermission.getReadPermission(LeanBodyMassRecord::class),
        HealthPermission.getReadPermission(Vo2MaxRecord::class),
        HealthPermission.getReadPermission(OxygenSaturationRecord::class),
        HealthPermission.getReadPermission(RespiratoryRateRecord::class),
        HealthPermission.getReadPermission(SkinTemperatureRecord::class),
        HealthPermission.getReadPermission(BasalBodyTemperatureRecord::class),
        HealthPermission.getReadPermission(HydrationRecord::class),
        HealthPermission.getReadPermission(NutritionRecord::class)
    )

    val writeRecordPermissions: Set<String> = setOf(
        HealthPermission.getWritePermission(WeightRecord::class),
        HealthPermission.getWritePermission(HydrationRecord::class),
        HealthPermission.getWritePermission(NutritionRecord::class)
    )

    fun isBackgroundSyncEnabled(context: Context): Boolean {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getBoolean(KEY_BG_ENABLED, true)
    }

    fun setBackgroundSyncEnabled(context: Context, enabled: Boolean) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_BG_ENABLED, enabled)
            .apply()
    }

    fun getBackgroundSyncTelemetry(context: Context): JSONObject {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val snapshotFile = File(context.filesDir, SNAPSHOT_FILE_NAME)
        return JSONObject().apply {
            put("enabled", prefs.getBoolean(KEY_BG_ENABLED, true))
            put("lastBackgroundSyncAt", prefs.getString(KEY_LAST_BG_SYNC_AT, null))
            put("lastBackgroundSyncStatus", prefs.getString(KEY_LAST_BG_SYNC_STATUS, "idle"))
            put("lastBackgroundSyncRecords", prefs.getInt(KEY_LAST_BG_SYNC_RECORDS, 0))
            put("hasPendingSnapshot", snapshotFile.exists() && snapshotFile.length() > 2L)
        }
    }

    fun recordBackgroundStatus(context: Context, status: String, recordCount: Int = 0) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_LAST_BG_SYNC_AT, Instant.now().toString())
            .putString(KEY_LAST_BG_SYNC_STATUS, status)
            .putInt(KEY_LAST_BG_SYNC_RECORDS, recordCount)
            .apply()
    }

    fun saveBackgroundSnapshot(context: Context, payload: JSONObject) {
        val target = File(context.filesDir, SNAPSHOT_FILE_NAME)
        val tmp = File(context.filesDir, "$SNAPSHOT_FILE_NAME.tmp")
        tmp.writeText(payload.toString(), Charsets.UTF_8)
        if (!tmp.renameTo(target)) {
            target.writeText(payload.toString(), Charsets.UTF_8)
            tmp.delete()
        }
        val count =
            payload.optJSONArray("workouts").let { it?.length() ?: 0 } +
                payload.optJSONArray("sleepSessions").let { it?.length() ?: 0 } +
                payload.optJSONArray("hrvObservations").let { it?.length() ?: 0 } +
                payload.optJSONArray("rhrObservations").let { it?.length() ?: 0 } +
                payload.optJSONArray("dailyActivities").let { it?.length() ?: 0 } +
                payload.optJSONArray("bodyMeasurements").let { it?.length() ?: 0 } +
                payload.optJSONArray("meals").let { it?.length() ?: 0 }
        recordBackgroundStatus(context, "ok", count)
    }

    fun consumeBackgroundSnapshot(context: Context): JSONObject? {
        val target = File(context.filesDir, SNAPSHOT_FILE_NAME)
        if (!target.exists()) return null
        return try {
            val content = target.readText(Charsets.UTF_8)
            target.delete()
            if (content.isBlank()) null else JSONObject(content)
        } catch (_: Exception) {
            target.delete()
            null
        }
    }

    suspend fun readSnapshot(context: Context, daysBack: Int): JSONObject {
        val client = HealthConnectClient.getOrCreate(context)
        val granted = client.permissionController.getGrantedPermissions()
        val hasHistory = granted.contains(HealthPermission.PERMISSION_READ_HEALTH_DATA_HISTORY)
        val effectiveDays = if (hasHistory) daysBack.coerceIn(1, 180) else daysBack.coerceIn(1, 30)

        val zone = ZoneId.systemDefault()
        val now = Instant.now()
        val startInstant = LocalDate.now(zone)
            .minusDays(effectiveDays.toLong())
            .atStartOfDay(zone)
            .toInstant()
        val range = TimeRangeFilter.between(startInstant, now)

        suspend fun <T : Record> safeRead(recordClass: KClass<T>): List<T> {
            val perm = HealthPermission.getReadPermission(recordClass)
            if (!granted.contains(perm)) return emptyList()
            return try {
                val all = mutableListOf<T>()
                var pageToken: String? = null
                do {
                    val response = client.readRecords(
                        ReadRecordsRequest(
                            recordType = recordClass,
                            timeRangeFilter = range,
                            pageToken = pageToken
                        )
                    )
                    all.addAll(response.records)
                    pageToken = response.pageToken
                } while (pageToken != null && all.size < 8000)
                all
            } catch (_: Exception) {
                emptyList()
            }
        }

        val stepsRecords = safeRead(StepsRecord::class)
        val cadenceRecords = safeRead(StepsCadenceRecord::class)
        val activeCalRecords = safeRead(ActiveCaloriesBurnedRecord::class)
        val totalCalRecords = safeRead(TotalCaloriesBurnedRecord::class)
        val sleepRecords = safeRead(SleepSessionRecord::class)
        val hrvRecords = safeRead(HeartRateVariabilityRmssdRecord::class)
        val rhrRecords = safeRead(RestingHeartRateRecord::class)
        val exerciseRecords = safeRead(ExerciseSessionRecord::class)
        val hrRecords = safeRead(HeartRateRecord::class)
        val distanceRecords = safeRead(DistanceRecord::class)
        val elevationRecords = safeRead(ElevationGainedRecord::class)
        val weightRecords = safeRead(WeightRecord::class)
        val bodyFatRecords = safeRead(BodyFatRecord::class)
        val leanMassRecords = safeRead(LeanBodyMassRecord::class)
        val vo2Records = safeRead(Vo2MaxRecord::class)
        val spo2Records = safeRead(OxygenSaturationRecord::class)
        val respRecords = safeRead(RespiratoryRateRecord::class)
        val skinTempRecords = safeRead(SkinTemperatureRecord::class)
        val basalTempRecords = safeRead(BasalBodyTemperatureRecord::class)
        val hydrationRecords = safeRead(HydrationRecord::class)
        val nutritionRecords = safeRead(NutritionRecord::class)

        // ------------------------------------------------------------------
        // 1. Sleep Sessions (merge split night segments + prefer main sleep)
        // ------------------------------------------------------------------
        val mergedSleeps = mergeNightSleepSessions(sleepRecords, zone)
        val sleepArray = JSONArray()
        val sleepWindowsByDate = mutableMapOf<String, Pair<Instant, Instant>>()
        for (item in mergedSleeps) {
            sleepWindowsByDate[item.dateKey] = item.startTime to item.endTime
            sleepArray.put(item.toJson())
        }

        // ------------------------------------------------------------------
        // 2. HRV Observations (RMSSD in ms)
        // ------------------------------------------------------------------
        val hrvByDate = hrvRecords.groupBy { toLocalDateKey(it.time, zone) }
        val hrvArray = JSONArray()
        for ((dateKey, list) in hrvByDate) {
            val valid = list.filter { it.heartRateVariabilityMillis in 5.0..300.0 }
            if (valid.isEmpty()) continue
            val avg = valid.map { it.heartRateVariabilityMillis }.average()
            val latest = valid.maxBy { it.time }
            val provider = mapPackageToProvider(latest.metadata.dataOrigin.packageName)
            hrvArray.put(JSONObject().apply {
                put("id", "hc_hrv_${dateKey}_${provider}")
                put("date", dateKey)
                put("timestamp", latest.time.toString())
                put("sourceProvider", provider)
                put("sourceRecordId", "hc_hrv_${latest.metadata.id}")
                put("provenance", "measured")
                put("value", (avg * 10.0).roundToInt() / 10.0)
            })
        }

        // ------------------------------------------------------------------
        // 3. Resting Heart Rate (+ smart overnight HR fallback for COROS/etc.)
        // ------------------------------------------------------------------
        val rhrByDate = rhrRecords.groupBy { toLocalDateKey(it.time, zone) }
        val rhrArray = JSONArray()
        val coveredRhrDates = mutableSetOf<String>()

        for ((dateKey, list) in rhrByDate) {
            val valid = list.filter { it.beatsPerMinute in 28..140 }
            if (valid.isEmpty()) continue
            val minBpm = valid.minOf { it.beatsPerMinute }
            val latest = valid.maxBy { it.time }
            val provider = mapPackageToProvider(latest.metadata.dataOrigin.packageName)
            coveredRhrDates.add(dateKey)
            rhrArray.put(JSONObject().apply {
                put("id", "hc_rhr_${dateKey}_${provider}")
                put("date", dateKey)
                put("timestamp", latest.time.toString())
                put("sourceProvider", provider)
                put("sourceRecordId", "hc_rhr_${latest.metadata.id}")
                put("provenance", "measured")
                put("value", minBpm)
            })
        }

        // Derive overnight resting HR (10th percentile during sleep or 00:00-06:30)
        // when wearables write HeartRateRecord without an explicit RestingHeartRateRecord
        if (hrRecords.isNotEmpty()) {
            val overnightSamplesByDate = mutableMapOf<String, MutableList<Pair<Int, String>>>()
            for (hr in hrRecords) {
                val pkg = hr.metadata.dataOrigin.packageName
                for (sample in hr.samples) {
                    val bpm = sample.beatsPerMinute.toInt()
                    if (bpm !in 32..115) continue
                    val zoned = sample.time.atZone(zone)
                    val dateKey = zoned.toLocalDate().format(DateTimeFormatter.ISO_LOCAL_DATE)
                    if (coveredRhrDates.contains(dateKey)) continue

                    val sleepWin = sleepWindowsByDate[dateKey]
                    val inSleep = sleepWin != null &&
                        sample.time >= sleepWin.first &&
                        sample.time <= sleepWin.second
                    val inNightWindow = zoned.hour in 0..5 || (zoned.hour == 6 && zoned.minute <= 30)
                    if (inSleep || inNightWindow) {
                        overnightSamplesByDate
                            .getOrPut(dateKey) { mutableListOf() }
                            .add(bpm to pkg)
                    }
                }
            }
            for ((dateKey, samples) in overnightSamplesByDate) {
                if (samples.size < 5) continue
                val sorted = samples.map { it.first }.sorted()
                val p10Idx = ((sorted.size - 1) * 0.10).roundToInt().coerceIn(0, sorted.lastIndex)
                val derivedRhr = sorted[p10Idx]
                val dominantPkg = samples.groupingBy { it.second }.eachCount().maxByOrNull { it.value }?.key.orEmpty()
                val provider = mapPackageToProvider(dominantPkg)
                rhrArray.put(JSONObject().apply {
                    put("id", "hc_rhr_derived_${dateKey}_${provider}")
                    put("date", dateKey)
                    put("timestamp", "${dateKey}T06:00:00Z")
                    put("sourceProvider", provider)
                    put("sourceRecordId", "hc_rhr_derived_${dateKey}")
                    put("provenance", "wearable_estimate")
                    put("value", derivedRhr)
                })
            }
        }

        // ------------------------------------------------------------------
        // 4. Workouts / Exercise Sessions (+ real HR timeSeries, elevation, cadence)
        // ------------------------------------------------------------------
        val workoutArray = JSONArray()
        for (ex in exerciseRecords) {
            val durMin = max(
                1,
                ((ex.endTime.toEpochMilli() - ex.startTime.toEpochMilli()) / 60000L).toInt()
            )
            val dateKey = toLocalDateKey(ex.startTime, zone)
            val provider = mapPackageToProvider(ex.metadata.dataOrigin.packageName)
            val sport = mapExerciseType(ex.exerciseType)

            val overlappingHrSamples = hrRecords
                .filter { it.endTime >= ex.startTime && it.startTime <= ex.endTime }
                .flatMap { it.samples }
                .filter { it.time >= ex.startTime && it.time <= ex.endTime && it.beatsPerMinute in 35..230 }
                .sortedBy { it.time }

            val avgHr = if (overlappingHrSamples.isNotEmpty()) {
                overlappingHrSamples.map { it.beatsPerMinute.toInt() }.average().roundToInt()
            } else {
                null
            }
            val maxHr = overlappingHrSamples.maxOfOrNull { it.beatsPerMinute.toInt() }

            // Downsample measured HR series to ~1-minute buckets (max 120 points) for crisp charts
            val timeSeriesArray = JSONArray()
            if (overlappingHrSamples.size >= 3) {
                val byMinute = overlappingHrSamples.groupBy { s ->
                    max(0, ((s.time.toEpochMilli() - ex.startTime.toEpochMilli()) / 60000L).toInt())
                }.toSortedMap()
                val step = max(1, (byMinute.size + 119) / 120)
                var idx = 0
                for ((minOffset, list) in byMinute) {
                    if (idx % step == 0 || idx == byMinute.size - 1) {
                        val avgPointHr = list.map { it.beatsPerMinute.toInt() }.average().roundToInt()
                        timeSeriesArray.put(JSONObject().apply {
                            put("minuteOffset", minOffset)
                            put("hrBpm", avgPointHr)
                        })
                    }
                    idx++
                }
            }

            val distKm = distanceRecords
                .filter { it.endTime > ex.startTime && it.startTime < ex.endTime }
                .groupBy { it.metadata.dataOrigin.packageName }
                .values
                .maxOfOrNull { recs -> recs.sumOf { it.distance.inKilometers } }
                ?: 0.0

            val elevGainM = elevationRecords
                .filter { it.endTime > ex.startTime && it.startTime < ex.endTime }
                .groupBy { it.metadata.dataOrigin.packageName }
                .values
                .maxOfOrNull { recs -> recs.sumOf { it.elevation.inMeters } }
                ?.takeIf { it >= 1.0 }

            val cadenceSamples = cadenceRecords
                .filter { it.endTime >= ex.startTime && it.startTime <= ex.endTime }
                .flatMap { it.samples }
                .filter { it.time >= ex.startTime && it.time <= ex.endTime && it.rate in 40.0..260.0 }
                .map { it.rate }
            val avgCadence = if (cadenceSamples.isNotEmpty()) cadenceSamples.average().roundToInt() else null

            val kcal = activeCalRecords
                .filter { it.endTime > ex.startTime && it.startTime < ex.endTime }
                .groupBy { it.metadata.dataOrigin.packageName }
                .values
                .maxOfOrNull { recs -> recs.sumOf { it.energy.inKilocalories } }
                ?.takeIf { it > 5.0 }
                ?: totalCalRecords
                    .filter { it.endTime > ex.startTime && it.startTime < ex.endTime }
                    .groupBy { it.metadata.dataOrigin.packageName }
                    .values
                    .maxOfOrNull { recs -> recs.sumOf { it.energy.inKilocalories } }
                    ?.takeIf { it > 5.0 }

            workoutArray.put(JSONObject().apply {
                put("id", "hc_wk_${ex.metadata.id}")
                put("date", dateKey)
                put("timestamp", ex.startTime.toString())
                put("startTimeIso", ex.startTime.toString())
                put("sourceProvider", provider)
                put("sourceRecordId", "hc_wk_${ex.metadata.id}")
                put("title", ex.title?.takeIf { it.isNotBlank() } ?: defaultSportTitle(sport))
                put("sport", sport)
                put("durationMinutes", durMin)
                if (distKm > 0.05) put("distanceKm", (distKm * 100.0).roundToInt() / 100.0)
                if (elevGainM != null) put("elevationGainM", elevGainM.roundToInt())
                if (avgCadence != null) put("cadenceSpm", avgCadence)
                if (avgHr != null) put("avgHrBpm", avgHr)
                if (maxHr != null) put("maxHrBpm", maxHr)
                if (kcal != null) put("caloriesKcal", kcal.roundToInt())
                if (timeSeriesArray.length() > 0) put("timeSeries", timeSeriesArray)
            })
        }

        // ------------------------------------------------------------------
        // 5. Daily Activities & Vitals (Steps, Active/Total kcal, VO2max, SpO2, Resp, Skin Temp)
        // ------------------------------------------------------------------
        val allActivityDates = mutableSetOf<String>()
        stepsRecords.forEach { allActivityDates.add(toLocalDateKey(it.startTime, zone)) }
        activeCalRecords.forEach { allActivityDates.add(toLocalDateKey(it.startTime, zone)) }
        totalCalRecords.forEach { allActivityDates.add(toLocalDateKey(it.startTime, zone)) }
        vo2Records.forEach { allActivityDates.add(toLocalDateKey(it.time, zone)) }
        spo2Records.forEach { allActivityDates.add(toLocalDateKey(it.time, zone)) }
        respRecords.forEach { allActivityDates.add(toLocalDateKey(it.time, zone)) }
        skinTempRecords.forEach { allActivityDates.add(toLocalDateKey(it.startTime, zone)) }
        basalTempRecords.forEach { allActivityDates.add(toLocalDateKey(it.time, zone)) }

        val activityArray = JSONArray()
        for (dateKey in allActivityDates) {
            val dayStepsList = stepsRecords.filter { toLocalDateKey(it.startTime, zone) == dateKey }
            val stepsByOrigin = dayStepsList.groupBy { it.metadata.dataOrigin.packageName }
                .mapValues { (_, recs) -> recs.sumOf { it.count } }
            val bestOriginEntry = stepsByOrigin.maxByOrNull { it.value }
            val steps = bestOriginEntry?.value?.toInt() ?: 0
            val provider = mapPackageToProvider(bestOriginEntry?.key ?: "")

            val dayActiveCals = activeCalRecords
                .filter { toLocalDateKey(it.startTime, zone) == dateKey }
                .groupBy { it.metadata.dataOrigin.packageName }
                .values
                .maxOfOrNull { list -> list.sumOf { it.energy.inKilocalories } }
                ?.roundToInt()

            val dayTotalCals = totalCalRecords
                .filter { toLocalDateKey(it.startTime, zone) == dateKey }
                .groupBy { it.metadata.dataOrigin.packageName }
                .values
                .maxOfOrNull { list -> list.sumOf { it.energy.inKilocalories } }
                ?.roundToInt()

            val dayVo2 = vo2Records
                .filter { toLocalDateKey(it.time, zone) == dateKey }
                .maxByOrNull { it.time }
                ?.vo2MillilitersPerMinuteKilogram

            val daySpo2 = spo2Records
                .filter { toLocalDateKey(it.time, zone) == dateKey }
                .map { it.percentage.value }
                .takeIf { it.isNotEmpty() }
                ?.average()

            val dayResp = respRecords
                .filter { toLocalDateKey(it.time, zone) == dateKey }
                .map { it.rate }
                .takeIf { it.isNotEmpty() }
                ?.average()

            val skinDeltaC = skinTempRecords
                .filter { toLocalDateKey(it.startTime, zone) == dateKey }
                .flatMap { it.deltas }
                .map { it.delta.inCelsius }
                .takeIf { it.isNotEmpty() }
                ?.average()
                ?: basalTempRecords
                    .filter { toLocalDateKey(it.time, zone) == dateKey }
                    .maxByOrNull { it.time }
                    ?.temperature?.inCelsius
                    ?.let { it - 36.6 }

            val dayExerciseMinutes = exerciseRecords
                .filter { toLocalDateKey(it.startTime, zone) == dateKey }
                .sumOf { max(1L, (it.endTime.toEpochMilli() - it.startTime.toEpochMilli()) / 60000L).toInt() }
            val activeMinutes = max(dayExerciseMinutes, steps / 130)

            activityArray.put(JSONObject().apply {
                put("id", "hc_act_${dateKey}")
                put("date", dateKey)
                put("timestamp", now.toString())
                put("sourceProvider", provider)
                put("sourceRecordId", "hc_act_${dateKey}")
                put("steps", steps)
                put("activeMinutes", activeMinutes)
                put("estimatedEnergyKcal", dayTotalCals ?: ((dayActiveCals ?: 0) + 1750))
                if (dayActiveCals != null) put("activeCaloriesKcal", dayActiveCals)
                if (dayVo2 != null) put("vo2MaxEstimate", (dayVo2 * 10.0).roundToInt() / 10.0)
                if (daySpo2 != null) put("spo2Percent", (daySpo2 * 10.0).roundToInt() / 10.0)
                if (dayResp != null) put("respiratoryRateBpm", (dayResp * 10.0).roundToInt() / 10.0)
                if (skinDeltaC != null) put("skinTempDeviationC", (skinDeltaC * 100.0).roundToInt() / 100.0)
            })
        }

        // ------------------------------------------------------------------
        // 6. Body Measurements (Weight, Body Fat %, Lean Body / Muscle Mass)
        // ------------------------------------------------------------------
        val bodyDates = (
            weightRecords.map { toLocalDateKey(it.time, zone) } +
                bodyFatRecords.map { toLocalDateKey(it.time, zone) } +
                leanMassRecords.map { toLocalDateKey(it.time, zone) }
            ).toSet()
        val bodyArray = JSONArray()
        for (dateKey in bodyDates) {
            val w = weightRecords.filter { toLocalDateKey(it.time, zone) == dateKey }.maxByOrNull { it.time }
            val bf = bodyFatRecords.filter { toLocalDateKey(it.time, zone) == dateKey }.maxByOrNull { it.time }
            val lm = leanMassRecords.filter { toLocalDateKey(it.time, zone) == dateKey }.maxByOrNull { it.time }
            if (w == null) continue
            val provider = mapPackageToProvider(w.metadata.dataOrigin.packageName)
            bodyArray.put(JSONObject().apply {
                put("id", "hc_body_${dateKey}")
                put("date", dateKey)
                put("timestamp", w.time.toString())
                put("sourceProvider", provider)
                put("sourceRecordId", "hc_body_${w.metadata.id}")
                put("weightKg", (w.weight.inKilograms * 10.0).roundToInt() / 10.0)
                if (bf != null) put("bodyFatPercent", (bf.percentage.value * 10.0).roundToInt() / 10.0)
                if (lm != null) put("muscleMassKg", (lm.mass.inKilograms * 10.0).roundToInt() / 10.0)
            })
        }

        // ------------------------------------------------------------------
        // 7. Hydration (daily total ml)
        // ------------------------------------------------------------------
        val hydrationByDate = hydrationRecords.groupBy { toLocalDateKey(it.startTime, zone) }
        val hydrationArray = JSONArray()
        for ((dateKey, recs) in hydrationByDate) {
            val totalMl = recs.sumOf { it.volume.inMilliliters }.roundToInt()
            if (totalMl <= 0) continue
            hydrationArray.put(JSONObject().apply {
                put("date", dateKey)
                put("ml", totalMl)
                put("updatedAt", now.toString())
            })
        }

        // ------------------------------------------------------------------
        // 8. External Nutrition Records (skip KADENZ's own records to avoid dupes)
        // ------------------------------------------------------------------
        val mealsArray = JSONArray()
        for (nut in nutritionRecords) {
            if (nut.metadata.dataOrigin.packageName == context.packageName) continue
            val kcal = nut.energy?.inKilocalories?.roundToInt() ?: 0
            if (kcal <= 0) continue
            val dateKey = toLocalDateKey(nut.startTime, zone)
            val category = when (nut.mealType) {
                MealType.MEAL_TYPE_BREAKFAST -> "breakfast"
                MealType.MEAL_TYPE_LUNCH -> "lunch"
                MealType.MEAL_TYPE_DINNER -> "dinner"
                else -> "snack"
            }
            val p = nut.protein?.inGrams?.roundToInt() ?: 0
            val c = nut.totalCarbohydrate?.inGrams?.roundToInt() ?: 0
            val f = nut.totalFat?.inGrams?.roundToInt() ?: 0
            val fib = nut.dietaryFiber?.inGrams?.roundToInt() ?: 0
            mealsArray.put(JSONObject().apply {
                put("id", "hc_meal_${nut.metadata.id}")
                put("date", dateKey)
                put("timestamp", nut.startTime.toString())
                put("category", category)
                put("title", nut.name?.takeIf { it.isNotBlank() } ?: "Health Connect Mahlzeit")
                put("totalCalories", kcal)
                put("proteinG", p)
                put("carbsG", c)
                put("fatG", f)
                put("fiberG", fib)
            })
        }

        return JSONObject().apply {
            put("syncedAt", now.toString())
            put("daysSynced", effectiveDays)
            put("grantedCount", granted.size)
            put("hrvObservations", hrvArray)
            put("rhrObservations", rhrArray)
            put("sleepSessions", sleepArray)
            put("workouts", workoutArray)
            put("dailyActivities", activityArray)
            put("bodyMeasurements", bodyArray)
            put("hydrationEntries", hydrationArray)
            put("meals", mealsArray)
        }
    }

    private data class NormalizedSleep(
        val id: String,
        val dateKey: String,
        val provider: String,
        val startTime: Instant,
        val endTime: Instant,
        val timeInBedMinutes: Int,
        val totalSleepMinutes: Int,
        val awakeMinutes: Int,
        val lightMinutes: Int,
        val deepMinutes: Int,
        val remMinutes: Int,
        val hasStageData: Boolean,
        val efficiencyPercent: Int,
        val awakeningsCount: Int,
        val stages: JSONArray
    ) {
        fun toJson(): JSONObject = JSONObject().apply {
            put("id", id)
            put("date", dateKey)
            put("timestamp", endTime.toString())
            put("sourceProvider", provider)
            put("sourceRecordId", id)
            put("bedtimeIso", startTime.toString())
            put("wakeTimeIso", endTime.toString())
            put("timeInBedMinutes", timeInBedMinutes)
            put("totalSleepMinutes", totalSleepMinutes)
            put("awakeMinutes", awakeMinutes)
            if (hasStageData) {
                put("lightMinutes", lightMinutes)
                put("deepMinutes", deepMinutes)
                put("remMinutes", remMinutes)
            }
            put("hasStageData", hasStageData)
            put("efficiencyPercent", efficiencyPercent)
            put("awakeningsCount", awakeningsCount)
            put("stages", stages)
        }
    }

    /**
     * Merges split overnight sleep blocks (gaps <= 90 min) and selects the primary
     * overnight sleep per wake-date so daytime naps never overwrite night sleep.
     */
    private fun mergeNightSleepSessions(
        rawSessions: List<SleepSessionRecord>,
        zone: ZoneId
    ): List<NormalizedSleep> {
        val valid = rawSessions
            .filter { ((it.endTime.toEpochMilli() - it.startTime.toEpochMilli()) / 60000L) >= 20L }
            .sortedBy { it.startTime }
        if (valid.isEmpty()) return emptyList()

        // Group contiguous / briefly interrupted night segments (gap <= 90 min) from same source
        val clusters = mutableListOf<MutableList<SleepSessionRecord>>()
        for (session in valid) {
            val prevCluster = clusters.lastOrNull()
            val prev = prevCluster?.lastOrNull()
            if (prev != null &&
                prev.metadata.dataOrigin.packageName == session.metadata.dataOrigin.packageName
            ) {
                val gapMin = (session.startTime.toEpochMilli() - prev.endTime.toEpochMilli()) / 60000L
                if (gapMin in -30L..90L) {
                    prevCluster.add(session)
                    continue
                }
            }
            clusters.add(mutableListOf(session))
        }

        val normalized = clusters.map { cluster ->
            val first = cluster.first()
            val last = cluster.last()
            val start = cluster.minOf { it.startTime }
            val end = cluster.maxOf { it.endTime }
            val wakeDateKey = toLocalDateKey(end, zone)
            val provider = mapPackageToProvider(first.metadata.dataOrigin.packageName)
            val timeInBedMin = max(1, ((end.toEpochMilli() - start.toEpochMilli()) / 60000L).toInt())

            var awakeMin = 0
            var lightMin = 0
            var deepMin = 0
            var remMin = 0
            var awakenings = 0
            val stagesArray = JSONArray()

            val allStages = cluster.flatMap { it.stages }.sortedBy { it.startTime }
            for (st in allStages) {
                val durMin = max(1, ((st.endTime.toEpochMilli() - st.startTime.toEpochMilli()) / 60000L).toInt())
                val offsetMin = max(0, ((st.startTime.toEpochMilli() - start.toEpochMilli()) / 60000L).toInt())
                val stageName = when (st.stage) {
                    SleepSessionRecord.STAGE_TYPE_AWAKE,
                    SleepSessionRecord.STAGE_TYPE_AWAKE_IN_BED,
                    SleepSessionRecord.STAGE_TYPE_OUT_OF_BED -> {
                        awakeMin += durMin
                        awakenings += 1
                        "awake"
                    }
                    SleepSessionRecord.STAGE_TYPE_DEEP -> {
                        deepMin += durMin
                        "deep"
                    }
                    SleepSessionRecord.STAGE_TYPE_REM -> {
                        remMin += durMin
                        "rem"
                    }
                    else -> {
                        lightMin += durMin
                        "light"
                    }
                }
                stagesArray.put(JSONObject().apply {
                    put("stage", stageName)
                    put("startOffsetMinutes", offsetMin)
                    put("durationMinutes", durMin)
                })
            }

            // Account for inter-segment awake gaps in split nights
            for (i in 1 until cluster.size) {
                val gapMin = ((cluster[i].startTime.toEpochMilli() - cluster[i - 1].endTime.toEpochMilli()) / 60000L).toInt()
                if (gapMin > 0) {
                    awakeMin += gapMin
                    awakenings += 1
                    val offsetMin = max(0, ((cluster[i - 1].endTime.toEpochMilli() - start.toEpochMilli()) / 60000L).toInt())
                    stagesArray.put(JSONObject().apply {
                        put("stage", "awake")
                        put("startOffsetMinutes", offsetMin)
                        put("durationMinutes", gapMin)
                    })
                }
            }

            val hasStageData = allStages.isNotEmpty() && (deepMin > 0 || remMin > 0 || lightMin > 0)
            val totalSleepMin = if (hasStageData) {
                max(1, lightMin + deepMin + remMin)
            } else {
                max(1, timeInBedMin - awakeMin)
            }
            val efficiencyPct = ((totalSleepMin.toDouble() / timeInBedMin.toDouble()) * 100.0)
                .roundToInt()
                .coerceIn(50, 100)

            NormalizedSleep(
                id = "hc_sleep_${first.metadata.id}",
                dateKey = wakeDateKey,
                provider = provider,
                startTime = start,
                endTime = end,
                timeInBedMinutes = timeInBedMin,
                totalSleepMinutes = totalSleepMin,
                awakeMinutes = awakeMin,
                lightMinutes = lightMin,
                deepMinutes = deepMin,
                remMinutes = remMin,
                hasStageData = hasStageData,
                efficiencyPercent = efficiencyPct,
                awakeningsCount = awakenings,
                stages = stagesArray
            )
        }

        // Choose the primary overnight sleep session per date (prefers stage data + longest sleep)
        return normalized
            .groupBy { it.dateKey }
            .values
            .map { sameDay ->
                sameDay.maxBy { s ->
                    s.totalSleepMinutes + (if (s.hasStageData) 60 else 0)
                }
            }
            .sortedBy { it.dateKey }
    }

    private fun toLocalDateKey(instant: Instant, zone: ZoneId): String {
        return instant.atZone(zone).toLocalDate().format(DateTimeFormatter.ISO_LOCAL_DATE)
    }

    fun mapPackageToProvider(pkg: String): String {
        val lower = pkg.lowercase()
        return when {
            lower.contains("garmin") -> "garmin"
            lower.contains("coros") -> "coros"
            lower.contains("polar") -> "polar"
            lower.contains("suunto") -> "suunto"
            lower.contains("shealth") || lower.contains("samsung") -> "samsung_health"
            lower.contains("fitbit") -> "fitbit"
            lower.contains("huami") || lower.contains("zepp") || lower.contains("amazfit") -> "amazfit"
            lower.contains("withings") -> "withings"
            lower.contains("oura") -> "oura"
            else -> "health_connect"
        }
    }

    private fun mapExerciseType(type: Int): String {
        return when (type) {
            ExerciseSessionRecord.EXERCISE_TYPE_RUNNING,
            ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL -> "running"
            ExerciseSessionRecord.EXERCISE_TYPE_WALKING -> "walking"
            ExerciseSessionRecord.EXERCISE_TYPE_BIKING,
            ExerciseSessionRecord.EXERCISE_TYPE_BIKING_STATIONARY -> "cycling"
            ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING,
            ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING -> "strength"
            ExerciseSessionRecord.EXERCISE_TYPE_CALISTHENICS,
            ExerciseSessionRecord.EXERCISE_TYPE_BOOT_CAMP,
            ExerciseSessionRecord.EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING -> "calisthenics"
            ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_OPEN_WATER,
            ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL -> "swimming"
            ExerciseSessionRecord.EXERCISE_TYPE_HIKING -> "hiking"
            ExerciseSessionRecord.EXERCISE_TYPE_FOOTBALL_AMERICAN,
            ExerciseSessionRecord.EXERCISE_TYPE_FOOTBALL_AUSTRALIAN,
            ExerciseSessionRecord.EXERCISE_TYPE_SOCCER -> "football"
            else -> "other"
        }
    }

    private fun defaultSportTitle(sport: String): String {
        return when (sport) {
            "running" -> "Lauf"
            "walking" -> "Spaziergang"
            "cycling" -> "Radfahrt"
            "strength" -> "Krafttraining"
            "calisthenics" -> "Eigengewicht-Training"
            "swimming" -> "Schwimmen"
            "hiking" -> "Wanderung"
            "football" -> "Fußball"
            else -> "Training"
        }
    }
}
