package io.github.mixxermannipro.openhealth

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

/**
 * Lightweight background sync checkpoint worker scheduled via WorkManager
 * when the user enables "Hintergrund-Abgleich" in KADENZ Settings.
 */
class HealthSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val prefs = applicationContext.getSharedPreferences("kadenz_native_prefs", Context.MODE_PRIVATE)
        prefs.edit().putLong("last_bg_sync_checkpoint_ms", System.currentTimeMillis()).apply()
        return Result.success()
    }
}
