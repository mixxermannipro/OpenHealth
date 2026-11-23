package io.github.mixxermannipro.openhealth

import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.activity.result.ActivityResultLauncher
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.HydrationRecord
import androidx.health.connect.client.records.MealType
import androidx.health.connect.client.records.NutritionRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.records.metadata.Metadata
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
import java.time.ZoneId
import java.time.ZoneOffset

@CapacitorPlugin(name = "HealthConnect")
class HealthConnectPlugin : Plugin() {

    private val pluginScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var permissionLauncher: ActivityResultLauncher<Set<String>>? = null
    private var pendingPermissionCall: PluginCall? = null

    private val readPermissions: Set<String> = HealthConnectSyncEngine.readRecordPermissions
    private val writePermissions: Set<String> = HealthConnectSyncEngine.writeRecordPermissions

    override fun load() {
        super.load()
        try {
            val contract = PermissionController.createRequestPermissionResultContract()
            permissionLauncher = activity.registerForActivityResult(contract) { granted ->
                val call = pendingPermissionCall
                pendingPermissionCall = null
                if (call != null) {
                    pluginScope.launch {
                        if (granted.contains(HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND)) {
                            HealthSyncScheduler.ensureScheduled(context, true)
                        }
                        call.resolve(buildPermissionPayload(granted))
                    }
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

    private fun isFeatureAvailable(client: HealthConnectClient, feature: Int): Boolean {
        return try {
            client.features.getFeatureStatus(feature) == HealthConnectFeatures.FEATURE_STATUS_AVAILABLE
        } catch (_: Exception) {
            false
        }
    }

    private fun buildPermissionPayload(granted: Set<String>): JSObject {
        val grantedArray = JSArray()
        granted.forEach { grantedArray.put(it) }

        var bgSupported = false
        var historySupported = false
        var activeReadPerms = readPermissions
        if (getSdkAvailability() == HealthConnectClient.SDK_AVAILABLE) {
            try {
                val client = HealthConnectClient.getOrCreate(context)
                activeReadPerms = HealthConnectSyncEngine.getSupportedReadPermissions(client)
                bgSupported = isFeatureAvailable(client, HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND)
                historySupported = isFeatureAvailable(client, HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_HISTORY)
            } catch (_: Exception) {
                // ignore
            }
        }

        val readGrantedCount = activeReadPerms.count { granted.contains(it) }
        val writeGrantedCount = writePermissions.count { granted.contains(it) }

        val bgGranted = granted.contains(HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND)
        val historyGranted = granted.contains(HealthPermission.PERMISSION_READ_HEALTH_DATA_HISTORY)
        val bgTelemetry = HealthConnectSyncEngine.getBackgroundSyncTelemetry(context)

        return JSObject().apply {
            put("granted", grantedArray)
            put("grantedCount", granted.size)
            put("readGrantedCount", readGrantedCount)
            put("writeGrantedCount", writeGrantedCount)
            put("totalCount", activeReadPerms.size + writePermissions.size)
            put("hasReadAccess", readGrantedCount > 0)
            put("hasWriteAccess", writeGrantedCount > 0)
            put("allGranted", granted.containsAll(activeReadPerms))
            put("backgroundReadSupported", bgSupported)
            put("backgroundReadGranted", bgGranted)
            put("historyReadSupported", historySupported)
            put("historyReadGranted", historyGranted)
            put("lastBackgroundSyncAt", bgTelemetry.optString("lastBackgroundSyncAt", ""))
            put("lastBackgroundSyncStatus", bgTelemetry.optString("lastBackgroundSyncStatus", "idle"))
            put("lastBackgroundSyncRecords", bgTelemetry.optInt("lastBackgroundSyncRecords", 0))
            put("hasPendingBackgroundSnapshot", bgTelemetry.optBoolean("hasPendingSnapshot", false))
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
        val includeBackground = call.getBoolean("includeBackground", true) ?: true
        val includeHistory = call.getBoolean("includeHistory", true) ?: true

        pluginScope.launch {
            try {
                val client = HealthConnectClient.getOrCreate(context)
                val requested = mutableSetOf<String>()
                requested.addAll(HealthConnectSyncEngine.getSupportedReadPermissions(client))
                if (includeWrite) requested.addAll(writePermissions)
                if (includeBackground && isFeatureAvailable(client, HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND)) {
                    requested.add(HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND)
                }
                if (includeHistory && isFeatureAvailable(client, HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_HISTORY)) {
                    requested.add(HealthPermission.PERMISSION_READ_HEALTH_DATA_HISTORY)
                }

                val alreadyGranted = client.permissionController.getGrantedPermissions()
                if (alreadyGranted.containsAll(requested)) {
                    if (alreadyGranted.contains(HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND)) {
                        HealthSyncScheduler.ensureScheduled(context, true)
                    }
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
    fun requestBackgroundPermission(call: PluginCall) {
        if (getSdkAvailability() != HealthConnectClient.SDK_AVAILABLE) {
            call.reject("HEALTH_CONNECT_UNAVAILABLE")
            return
        }
        val launcher = permissionLauncher ?: return call.reject("HEALTH_CONNECT_LAUNCHER_UNAVAILABLE")
        pluginScope.launch {
            try {
                val client = HealthConnectClient.getOrCreate(context)
                val requested = mutableSetOf<String>()
                if (isFeatureAvailable(client, HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND)) {
                    requested.add(HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND)
                }
                if (isFeatureAvailable(client, HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_HISTORY)) {
                    requested.add(HealthPermission.PERMISSION_READ_HEALTH_DATA_HISTORY)
                }
                val alreadyGranted = client.permissionController.getGrantedPermissions()
                if (requested.isEmpty() || alreadyGranted.containsAll(requested)) {
                    if (alreadyGranted.contains(HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND)) {
                        HealthSyncScheduler.ensureScheduled(context, true)
                    }
                    call.resolve(buildPermissionPayload(alreadyGranted))
                    return@launch
                }
                pendingPermissionCall = call
                activity.runOnUiThread {
                    try {
                        launcher.launch(requested)
                    } catch (e: Exception) {
                        pendingPermissionCall = null
                        call.reject("Could not launch background permission UI: ${e.message}", e)
                    }
                }
            } catch (e: Exception) {
                call.reject("Background permission error: ${e.message}", e)
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
                val snapshot = HealthConnectSyncEngine.readSnapshot(context, daysBack)
                // Clear any stale background snapshot now that we have a fresher live snapshot
                HealthConnectSyncEngine.consumeBackgroundSnapshot(context)
                call.resolve(JSObject.fromJSONObject(snapshot))
            } catch (e: Exception) {
                call.reject("Health Connect sync failed: ${e.message}", e)
            }
        }
    }

    @PluginMethod
    fun consumeBackgroundSnapshot(call: PluginCall) {
        pluginScope.launch {
            try {
                val snapshot = HealthConnectSyncEngine.consumeBackgroundSnapshot(context)
                if (snapshot != null) {
                    val result = JSObject.fromJSONObject(snapshot)
                    result.put("hasSnapshot", true)
                    call.resolve(result)
                } else {
                    call.resolve(JSObject().apply { put("hasSnapshot", false) })
                }
            } catch (e: Exception) {
                call.resolve(JSObject().apply { put("hasSnapshot", false) })
            }
        }
    }

    @PluginMethod
    fun triggerImmediateBackgroundSync(call: PluginCall) {
        HealthSyncScheduler.triggerImmediateRun(context)
        call.resolve(JSObject().apply { put("scheduled", true) })
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
}
