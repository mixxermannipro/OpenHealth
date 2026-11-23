package io.github.mixxermannipro.openhealth

import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.activity.result.ActivityResultLauncher
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.HydrationRecord
import androidx.health.connect.client.records.MealType
import androidx.health.connect.client.records.NutritionRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.RespiratoryRateRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.Vo2MaxRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.health.connect.client.units.Energy
import androidx.health.connect.client.units.Mass
import androidx.health.connect.client.units.Volume
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import kotlin.math.max
import kotlin.math.roundToInt

@CapacitorPlugin(name = "HealthConnect")
class HealthConnectPlugin : Plugin() {

    private val pluginScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var permissionLauncher: ActivityResultLauncher<Set<String>>? = null
    private var pendingPermissionCall: PluginCall? = null

    private val readPermissions: Set<String> = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(RestingHeartRateRecord::class),
        HealthPermission.getReadPermission(HeartRateVariabilityRmssdRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        HealthPermission.getReadPermission(DistanceRecord::class),
        HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(WeightRecord::class),
        HealthPermission.getReadPermission(BodyFatRecord::class),
        HealthPermission.getReadPermission(Vo2MaxRecord::class),
        HealthPermission.getReadPermission(OxygenSaturationRecord::class),
        HealthPermission.getReadPermission(RespiratoryRateRecord::class),
        HealthPermission.getReadPermission(HydrationRecord::class),
        HealthPermission.getReadPermission(NutritionRecord::class)
    )

    private val writePermissions: Set<String> = setOf(
        HealthPermission.getWritePermission(WeightRecord::class),
        HealthPermission.getWritePermission(HydrationRecord::class),
        HealthPermission.getWritePermission(NutritionRecord::class)
    )

    private val allPermissions: Set<String> = readPermissions + writePermissions

    override fun load() {
        super.load()
        try {
            val contract = PermissionController.createRequestPermissionResultContract()
            permissionLauncher = activity.registerForActivityResult(contract) { granted ->
                val call = pendingPermissionCall
                pendingPermissionCall = null
                if (call != null) {
                    call.resolve(buildPermissionPayload(granted))
                }
            }
        } catch (_: Exception) {
            permissionLauncher = null
        }
    }

    override fun handleOnDestroy() {
        pluginScope.cancel()
        super.handleOnDestroy()
    }

    private fun getProviderPackageName(): String = "com.google.android.apps.healthdata"

    private fun getSdkAvailability(): Int {
        return try {
            HealthConnectClient.getSdkStatus(context, getProviderPackageName())
        } catch (_: Exception) {
            HealthConnectClient.SDK_UNAVAILABLE
        }
    }

    private fun buildPermissionPayload(granted: Set<String>): JSObject {
        val grantedArray = JSArray()
        granted.forEach { grantedArray.put(it) }
        val readGrantedCount = readPermissions.count { granted.contains(it) }
        val writeGrantedCount = writePermissions.count { granted.contains(it) }
        return JSObject().apply {
            put("granted", grantedArray)
            put("grantedCount", granted.size)
            put("readGrantedCount", readGrantedCount)
            put("writeGrantedCount", writeGrantedCount)
            put("totalCount", allPermissions.size)
            put("hasReadAccess", readGrantedCount > 0)
            put("hasWriteAccess", writeGrantedCount > 0)
            put("allGranted", granted.containsAll(readPermissions))
        }
    }

    @PluginMethod
    fun getStatus(call: PluginCall) {
        val statusCode = getSdkAvailability()
        val statusString = when (statusCode) {
            HealthConnectClient.SDK_AVAILABLE -> "available"
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "provider_update_required"
            else -> "unavailable"
        }
        call.resolve(JSObject().apply {
            put("available", statusCode == HealthConnectClient.SDK_AVAILABLE)
            put("status", statusString)
            put("sdkInt", Build.VERSION.SDK_INT)
        })
    }

    @PluginMethod
    override fun checkPermissions(call: PluginCall) {
        if (getSdkAvailability() != HealthConnectClient.SDK_AVAILABLE) {
            call.resolve(buildPermissionPayload(emptySet()))
            return
        }
        pluginScope.launch {
            try {
                val client = HealthConnectClient.getOrCreate(context)
                val granted = client.permissionController.getGrantedPermissions()
                call.resolve(buildPermissionPayload(granted))
            } catch (e: Exception) {
                call.reject("Failed to check Health Connect permissions: ${e.message}", e)
            }
        }
    }

    @PluginMethod
    override fun requestPermissions(call: PluginCall) {
        val statusCode = getSdkAvailability()
        if (statusCode != HealthConnectClient.SDK_AVAILABLE) {
            call.reject(
                if (statusCode == HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED)
                    "HEALTH_CONNECT_UPDATE_REQUIRED"
                else
                    "HEALTH_CONNECT_UNAVAILABLE"
            )
            return
        }

        val launcher = permissionLauncher
        if (launcher == null) {
            call.reject("HEALTH_CONNECT_LAUNCHER_UNAVAILABLE")
            return
        }

        val includeWrite = call.getBoolean("includeWrite", true) ?: true
        val requested = if (includeWrite) allPermissions else readPermissions

        pluginScope.launch {
            try {
                val client = HealthConnectClient.getOrCreate(context)
                val alreadyGranted = client.permissionController.getGrantedPermissions()
                if (alreadyGranted.containsAll(requested)) {
                    call.resolve(buildPermissionPayload(alreadyGranted))
                    return@launch
                }
                pendingPermissionCall = call
                activity.runOnUiThread {
                    try {
                        launcher.launch(requested)
                    } catch (e: Exception) {
                        pendingPermissionCall = null
                        call.reject("Could not launch Health Connect permission UI: ${e.message}", e)
                    }
                }
            } catch (e: Exception) {
                call.reject("Health Connect permission error: ${e.message}", e)
            }
        }
    }

    @PluginMethod
    fun openSettings(call: PluginCall) {
        activity.runOnUiThread {
            try {
                val intent = Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                activity.startActivity(intent)
                call.resolve(JSObject().apply { put("opened", "settings") })
            } catch (_: Exception) {
                try {
                    val storeIntent = Intent(Intent.ACTION_VIEW).apply {
                        data = Uri.parse("market://details?id=${getProviderPackageName()}")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    activity.startActivity(storeIntent)
                    call.resolve(JSObject().apply { put("opened", "play_store") })
                } catch (e: Exception) {
                    call.reject("Could not open Health Connect settings: ${e.message}", e)
                }
            }
        }
    }

    @PluginMethod
    fun syncData(call: PluginCall) {
        if (getSdkAvailability() != HealthConnectClient.SDK_AVAILABLE) {
            call.reject("HEALTH_CONNECT_UNAVAILABLE")
            return
        }

        val daysBack = (call.getInt("daysBack", 30) ?: 30).coerceIn(1, 180)

        pluginScope.launch {
            try {
                val client = HealthConnectClient.getOrCreate(context)
                val granted = client.permissionController.getGrantedPermissions()

                val zone = ZoneId.systemDefault()
                val now = Instant.now()
                val startInstant = LocalDate.now(zone)
                    .minusDays(daysBack.toLong())
                    .atStartOfDay(zone)
                    .toInstant()
                val range = TimeRangeFilter.between(startInstant, now)

                suspend fun <T : androidx.health.connect.client.records.Record> safeRead(
                    recordClass: kotlin.reflect.KClass<T>
                ): List<T> {
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
                        } while (pageToken != null && all.size < 5000)
                        all
                    } catch (_: Exception) {
                        emptyList()
                    }
                }

                val stepsRecords = safeRead(StepsRecord::class)
                val activeCalRecords = safeRead(ActiveCaloriesBurnedRecord::class)
                val totalCalRecords = safeRead(TotalCaloriesBurnedRecord::class)
                val sleepRecords = safeRead(SleepSessionRecord::class)
                val hrvRecords = safeRead(HeartRateVariabilityRmssdRecord::class)
                val rhrRecords = safeRead(RestingHeartRateRecord::class)
                val exerciseRecords = safeRead(ExerciseSessionRecord::class)
                val hrRecords = safeRead(HeartRateRecord::class)
                val distanceRecords = safeRead(DistanceRecord::class)
                val weightRecords = safeRead(WeightRecord::class)
                val bodyFatRecords = safeRead(BodyFatRecord::class)
                val vo2Records = safeRead(Vo2MaxRecord::class)
                val spo2Records = safeRead(OxygenSaturationRecord::class)
                val respRecords = safeRead(RespiratoryRateRecord::class)
                val hydrationRecords = safeRead(HydrationRecord::class)

                // 1. HRV Observations (daily latest/average)
                val hrvByDate = hrvRecords.groupBy { toLocalDateKey(it.time, zone) }
                val hrvArray = JSArray()
                for ((dateKey, list) in hrvByDate) {
                    val valid = list.filter { it.heartRateVariabilityMillis in 5.0..300.0 }
                    if (valid.isEmpty()) continue
                    val avg = valid.map { it.heartRateVariabilityMillis }.average()
                    val latest = valid.maxBy { it.time }
                    val provider = mapPackageToProvider(latest.metadata.dataOrigin.packageName)
                    hrvArray.put(JSObject().apply {
                        put("id", "hc_hrv_${dateKey}_${provider}")
                        put("date", dateKey)
                        put("timestamp", latest.time.toString())
                        put("sourceProvider", provider)
                        put("sourceRecordId", "hc_hrv_${latest.metadata.id}")
                        put("value", (avg * 10.0).roundToInt() / 10.0)
                    })
                }

                // 2. Resting Heart Rate Observations (daily minimum/average)
                val rhrByDate = rhrRecords.groupBy { toLocalDateKey(it.time, zone) }
                val rhrArray = JSArray()
                for ((dateKey, list) in rhrByDate) {
                    val valid = list.filter { it.beatsPerMinute in 28..140 }
                    if (valid.isEmpty()) continue
                    val minBpm = valid.minOf { it.beatsPerMinute }
                    val latest = valid.maxBy { it.time }
                    val provider = mapPackageToProvider(latest.metadata.dataOrigin.packageName)
                    rhrArray.put(JSObject().apply {
                        put("id", "hc_rhr_${dateKey}_${provider}")
                        put("date", dateKey)
                        put("timestamp", latest.time.toString())
                        put("sourceProvider", provider)
                        put("sourceRecordId", "hc_rhr_${latest.metadata.id}")
                        put("value", minBpm)
                    })
                }

                // 3. Sleep Sessions (with stages!)
                val sleepArray = JSArray()
                for (session in sleepRecords) {
                    val timeInBedMin = max(
                        1,
                        ((session.endTime.toEpochMilli() - session.startTime.toEpochMilli()) / 60000L).toInt()
                    )
                    if (timeInBedMin < 20) continue
                    val wakeDateKey = toLocalDateKey(session.endTime, zone)
                    val provider = mapPackageToProvider(session.metadata.dataOrigin.packageName)

                    var awakeMin = 0
                    var lightMin = 0
                    var deepMin = 0
                    var remMin = 0
                    var awakenings = 0
                    val stagesArray = JSArray()

                    for (st in session.stages) {
                        val durMin = max(
                            1,
                            ((st.endTime.toEpochMilli() - st.startTime.toEpochMilli()) / 60000L).toInt()
                        )
                        val offsetMin = max(
                            0,
                            ((st.startTime.toEpochMilli() - session.startTime.toEpochMilli()) / 60000L).toInt()
                        )
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
                        stagesArray.put(JSObject().apply {
                            put("stage", stageName)
                            put("startOffsetMinutes", offsetMin)
                            put("durationMinutes", durMin)
                        })
                    }

                    val hasStageData = session.stages.isNotEmpty() && (deepMin > 0 || remMin > 0 || lightMin > 0)
                    val totalSleepMin = if (hasStageData) {
                        max(1, lightMin + deepMin + remMin)
                    } else {
                        max(1, timeInBedMin - awakeMin)
                    }
                    val efficiencyPct = ((totalSleepMin.toDouble() / timeInBedMin.toDouble()) * 100.0)
                        .roundToInt()
                        .coerceIn(50, 100)

                    sleepArray.put(JSObject().apply {
                        put("id", "hc_sleep_${session.metadata.id}")
                        put("date", wakeDateKey)
                        put("timestamp", session.endTime.toString())
                        put("sourceProvider", provider)
                        put("sourceRecordId", "hc_sleep_${session.metadata.id}")
                        put("bedtimeIso", session.startTime.toString())
                        put("wakeTimeIso", session.endTime.toString())
                        put("timeInBedMinutes", timeInBedMin)
                        put("totalSleepMinutes", totalSleepMin)
                        put("awakeMinutes", awakeMin)
                        if (hasStageData) {
                            put("lightMinutes", lightMin)
                            put("deepMinutes", deepMin)
                            put("remMinutes", remMin)
                        }
                        put("hasStageData", hasStageData)
                        put("efficiencyPercent", efficiencyPct)
                        put("awakeningsCount", awakenings)
                        put("stages", stagesArray)
                    })
                }

                // 4. Workouts / Exercise Sessions (enriched with HR, Distance, Calories)
                val workoutArray = JSArray()
                for (ex in exerciseRecords) {
                    val durMin = max(
                        1,
                        ((ex.endTime.toEpochMilli() - ex.startTime.toEpochMilli()) / 60000L).toInt()
                    )
                    val dateKey = toLocalDateKey(ex.startTime, zone)
                    val provider = mapPackageToProvider(ex.metadata.dataOrigin.packageName)
                    val sport = mapExerciseType(ex.exerciseType)

                    val overlappingHr = hrRecords
                        .filter { it.endTime >= ex.startTime && it.startTime <= ex.endTime }
                        .flatMap { it.samples }
                        .filter { it.time >= ex.startTime && it.time <= ex.endTime }
                        .map { it.beatsPerMinute.toInt() }
                        .filter { it in 35..230 }

                    val avgHr = if (overlappingHr.isNotEmpty()) overlappingHr.average().roundToInt() else null
                    val maxHr = overlappingHr.maxOrNull()

                    val distKm = distanceRecords
                        .filter { it.endTime > ex.startTime && it.startTime < ex.endTime }
                        .sumOf { it.distance.inKilometers }

                    val kcal = activeCalRecords
                        .filter { it.endTime > ex.startTime && it.startTime < ex.endTime }
                        .sumOf { it.energy.inKilocalories }
                        .takeIf { it > 5.0 }
                        ?: totalCalRecords
                            .filter { it.endTime > ex.startTime && it.startTime < ex.endTime }
                            .sumOf { it.energy.inKilocalories }
                            .takeIf { it > 5.0 }

                    workoutArray.put(JSObject().apply {
                        put("id", "hc_wk_${ex.metadata.id}")
                        put("date", dateKey)
                        put("timestamp", ex.startTime.toString())
                        put("startTimeIso", ex.startTime.toString())
                        put("sourceProvider", provider)
                        put("sourceRecordId", "hc_wk_${ex.metadata.id}")
                        put("title", ex.title?.takeIf { it.isNotBlank() } ?: defaultSportTitle(sport))
                        put("sport", sport)
                        put("durationMinutes", durMin)
                        if (distKm > 0.05) {
                            put("distanceKm", (distKm * 100.0).roundToInt() / 100.0)
                        }
                        if (avgHr != null) put("avgHrBpm", avgHr)
                        if (maxHr != null) put("maxHrBpm", maxHr)
                        if (kcal != null) put("caloriesKcal", kcal.roundToInt())
                    })
                }

                // 5. Daily Activities (Steps, Active/Total Calories, VO2max, SpO2, Respiratory Rate)
                val allActivityDates = mutableSetOf<String>()
                stepsRecords.forEach { allActivityDates.add(toLocalDateKey(it.startTime, zone)) }
                activeCalRecords.forEach { allActivityDates.add(toLocalDateKey(it.startTime, zone)) }
                totalCalRecords.forEach { allActivityDates.add(toLocalDateKey(it.startTime, zone)) }
                vo2Records.forEach { allActivityDates.add(toLocalDateKey(it.time, zone)) }
                spo2Records.forEach { allActivityDates.add(toLocalDateKey(it.time, zone)) }
                respRecords.forEach { allActivityDates.add(toLocalDateKey(it.time, zone)) }

                val activityArray = JSArray()
                for (dateKey in allActivityDates) {
                    val dayStepsList = stepsRecords.filter { toLocalDateKey(it.startTime, zone) == dateKey }
                    // Avoid double counting steps across multiple apps writing to Health Connect by taking max per source
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

                    val dayExerciseMinutes = exerciseRecords
                        .filter { toLocalDateKey(it.startTime, zone) == dateKey }
                        .sumOf { max(1L, (it.endTime.toEpochMilli() - it.startTime.toEpochMilli()) / 60000L).toInt() }
                    val activeMinutes = max(dayExerciseMinutes, steps / 130)

                    activityArray.put(JSObject().apply {
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
                    })
                }

                // 6. Body Measurements (Weight & Body Fat)
                val bodyDates = (weightRecords.map { toLocalDateKey(it.time, zone) } +
                    bodyFatRecords.map { toLocalDateKey(it.time, zone) }).toSet()
                val bodyArray = JSArray()
                for (dateKey in bodyDates) {
                    val w = weightRecords.filter { toLocalDateKey(it.time, zone) == dateKey }.maxByOrNull { it.time }
                    val bf = bodyFatRecords.filter { toLocalDateKey(it.time, zone) == dateKey }.maxByOrNull { it.time }
                    if (w == null) continue
                    val provider = mapPackageToProvider(w.metadata.dataOrigin.packageName)
                    bodyArray.put(JSObject().apply {
                        put("id", "hc_body_${dateKey}")
                        put("date", dateKey)
                        put("timestamp", w.time.toString())
                        put("sourceProvider", provider)
                        put("sourceRecordId", "hc_body_${w.metadata.id}")
                        put("weightKg", (w.weight.inKilograms * 10.0).roundToInt() / 10.0)
                        if (bf != null) {
                            put("bodyFatPercent", (bf.percentage.value * 10.0).roundToInt() / 10.0)
                        }
                    })
                }

                // 7. Hydration (daily total ml)
                val hydrationByDate = hydrationRecords.groupBy { toLocalDateKey(it.startTime, zone) }
                val hydrationArray = JSArray()
                for ((dateKey, recs) in hydrationByDate) {
                    val totalMl = recs.sumOf { it.volume.inMilliliters }.roundToInt()
                    if (totalMl <= 0) continue
                    hydrationArray.put(JSObject().apply {
                        put("date", dateKey)
                        put("ml", totalMl)
                        put("updatedAt", now.toString())
                    })
                }

                call.resolve(JSObject().apply {
                    put("syncedAt", now.toString())
                    put("grantedCount", granted.size)
                    put("hrvObservations", hrvArray)
                    put("rhrObservations", rhrArray)
                    put("sleepSessions", sleepArray)
                    put("workouts", workoutArray)
                    put("dailyActivities", activityArray)
                    put("bodyMeasurements", bodyArray)
                    put("hydrationEntries", hydrationArray)
                })
            } catch (e: Exception) {
                call.reject("Health Connect sync failed: ${e.message}", e)
            }
        }
    }

    @PluginMethod
    fun writeWeight(call: PluginCall) {
        val weightKg = call.getDouble("weightKg") ?: return call.reject("Missing weightKg")
        if (getSdkAvailability() != HealthConnectClient.SDK_AVAILABLE) {
            call.resolve(JSObject().apply { put("written", false) })
            return
        }
        pluginScope.launch {
            try {
                val client = HealthConnectClient.getOrCreate(context)
                val granted = client.permissionController.getGrantedPermissions()
                if (!granted.contains(HealthPermission.getWritePermission(WeightRecord::class))) {
                    call.resolve(JSObject().apply { put("written", false) })
                    return@launch
                }
                val now = Instant.now()
                val offset = ZoneId.systemDefault().rules.getOffset(now)
                val record = WeightRecord(
                    time = now,
                    zoneOffset = offset,
                    weight = Mass.kilograms(weightKg),
                    metadata = Metadata.manualEntry()
                )
                client.insertRecords(listOf(record))
                call.resolve(JSObject().apply { put("written", true) })
            } catch (_: Exception) {
                call.resolve(JSObject().apply { put("written", false) })
            }
        }
    }

    @PluginMethod
    fun writeHydration(call: PluginCall) {
        val deltaMl = call.getDouble("deltaMl") ?: return call.reject("Missing deltaMl")
        if (deltaMl <= 0 || getSdkAvailability() != HealthConnectClient.SDK_AVAILABLE) {
            call.resolve(JSObject().apply { put("written", false) })
            return
        }
        pluginScope.launch {
            try {
                val client = HealthConnectClient.getOrCreate(context)
                val granted = client.permissionController.getGrantedPermissions()
                if (!granted.contains(HealthPermission.getWritePermission(HydrationRecord::class))) {
                    call.resolve(JSObject().apply { put("written", false) })
                    return@launch
                }
                val end = Instant.now()
                val start = end.minusSeconds(1)
                val offset = ZoneId.systemDefault().rules.getOffset(end)
                val record = HydrationRecord(
                    startTime = start,
                    startZoneOffset = offset,
                    endTime = end,
                    endZoneOffset = offset,
                    volume = Volume.milliliters(deltaMl),
                    metadata = Metadata.manualEntry()
                )
                client.insertRecords(listOf(record))
                call.resolve(JSObject().apply { put("written", true) })
            } catch (_: Exception) {
                call.resolve(JSObject().apply { put("written", false) })
            }
        }
    }

    @PluginMethod
    fun writeNutrition(call: PluginCall) {
        val title = call.getString("title") ?: "Mahlzeit"
        val calories = call.getDouble("calories") ?: 0.0
        val proteinG = call.getDouble("proteinG") ?: 0.0
        val carbsG = call.getDouble("carbsG") ?: 0.0
        val fatG = call.getDouble("fatG") ?: 0.0
        val fiberG = call.getDouble("fiberG") ?: 0.0
        val category = call.getString("category") ?: "snack"

        if (calories <= 0 || getSdkAvailability() != HealthConnectClient.SDK_AVAILABLE) {
            call.resolve(JSObject().apply { put("written", false) })
            return
        }

        pluginScope.launch {
            try {
                val client = HealthConnectClient.getOrCreate(context)
                val granted = client.permissionController.getGrantedPermissions()
                if (!granted.contains(HealthPermission.getWritePermission(NutritionRecord::class))) {
                    call.resolve(JSObject().apply { put("written", false) })
                    return@launch
                }
                val end = Instant.now()
                val start = end.minusSeconds(60)
                val offset: ZoneOffset = ZoneId.systemDefault().rules.getOffset(end)
                val mealType = when (category) {
                    "breakfast" -> MealType.MEAL_TYPE_BREAKFAST
                    "lunch" -> MealType.MEAL_TYPE_LUNCH
                    "dinner" -> MealType.MEAL_TYPE_DINNER
                    else -> MealType.MEAL_TYPE_SNACK
                }
                val record = NutritionRecord(
                    startTime = start,
                    startZoneOffset = offset,
                    endTime = end,
                    endZoneOffset = offset,
                    name = title,
                    mealType = mealType,
                    energy = Energy.kilocalories(calories),
                    protein = Mass.grams(proteinG),
                    totalCarbohydrate = Mass.grams(carbsG),
                    totalFat = Mass.grams(fatG),
                    dietaryFiber = Mass.grams(fiberG),
                    metadata = Metadata.manualEntry()
                )
                client.insertRecords(listOf(record))
                call.resolve(JSObject().apply { put("written", true) })
            } catch (_: Exception) {
                call.resolve(JSObject().apply { put("written", false) })
            }
        }
    }

    private fun toLocalDateKey(instant: Instant, zone: ZoneId): String {
        return instant.atZone(zone).toLocalDate().format(DateTimeFormatter.ISO_LOCAL_DATE)
    }

    private fun mapPackageToProvider(pkg: String): String {
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
