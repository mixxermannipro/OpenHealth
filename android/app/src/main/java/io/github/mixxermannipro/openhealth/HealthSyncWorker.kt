package io.github.mixxermannipro.openhealth

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.work.BackoffPolicy
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * Permanent 15-minute WorkManager background sync worker for Android Health Connect.
 * Reads all newly recorded sleep, HRV, RHR, steps, workouts, vitals, body & nutrition records
 * locally in the background (when READ_HEALTH_DATA_IN_BACKGROUND is granted) and caches them
 * atomically so KADENZ is always up to date the instant it opens.
 */
class HealthSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        if (!HealthConnectSyncEngine.isBackgroundSyncEnabled(applicationContext)) {
            return Result.success()
        }

        val status = try {
            HealthConnectClient.getSdkStatus(applicationContext, "com.google.android.apps.healthdata")
        } catch (_: Exception) {
            HealthConnectClient.SDK_UNAVAILABLE
        }
        if (status != HealthConnectClient.SDK_AVAILABLE) {
            HealthConnectSyncEngine.recordBackgroundStatus(applicationContext, "hc_unavailable", 0)
            return Result.success()
        }

        return try {
            val client = HealthConnectClient.getOrCreate(applicationContext)
            val granted = client.permissionController.getGrantedPermissions()
            val hasReadAny = HealthConnectSyncEngine.readRecordPermissions.any { granted.contains(it) }
            val hasBgPerm = granted.contains(HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND)

            if (!hasReadAny) {
                HealthConnectSyncEngine.recordBackgroundStatus(applicationContext, "no_read_permission", 0)
                return Result.success()
            }

            if (!hasBgPerm) {
                HealthConnectSyncEngine.recordBackgroundStatus(applicationContext, "bg_permission_missing", 0)
                return Result.success()
            }

            val snapshot = HealthConnectSyncEngine.readSnapshot(applicationContext, daysBack = 14)
            HealthConnectSyncEngine.saveBackgroundSnapshot(applicationContext, snapshot)
            Result.success()
        } catch (se: SecurityException) {
            HealthConnectSyncEngine.recordBackgroundStatus(applicationContext, "security_denied", 0)
            Result.success()
        } catch (_: Exception) {
            HealthConnectSyncEngine.recordBackgroundStatus(applicationContext, "retry_scheduled", 0)
            Result.retry()
        }
    }
}

object HealthSyncScheduler {
    private const val PERIODIC_WORK_NAME = "kadenz_permanent_hc_sync_15m"
    private const val IMMEDIATE_WORK_NAME = "kadenz_immediate_hc_sync"

    fun ensureScheduled(context: Context, enabled: Boolean) {
        HealthConnectSyncEngine.setBackgroundSyncEnabled(context, enabled)
        val wm = WorkManager.getInstance(context.applicationContext)
        if (!enabled) {
            wm.cancelUniqueWork(PERIODIC_WORK_NAME)
            return
        }

        // Minimum Android WorkManager interval (15 minutes) with zero network/charging blockers
        // because Android Health Connect is 100% local on-device.
        val request = PeriodicWorkRequestBuilder<HealthSyncWorker>(15, TimeUnit.MINUTES)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 5, TimeUnit.MINUTES)
            .build()

        wm.enqueueUniquePeriodicWork(
            PERIODIC_WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            request
        )
    }

    fun triggerImmediateRun(context: Context) {
        val wm = WorkManager.getInstance(context.applicationContext)
        val request = OneTimeWorkRequestBuilder<HealthSyncWorker>()
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
            .build()
        wm.enqueueUniqueWork(
            IMMEDIATE_WORK_NAME,
            ExistingWorkPolicy.REPLACE,
            request
        )
    }
}
