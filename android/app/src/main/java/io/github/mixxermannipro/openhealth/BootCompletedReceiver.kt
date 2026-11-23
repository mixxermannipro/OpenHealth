package io.github.mixxermannipro.openhealth

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Restores the permanent 15-minute Health Connect WorkManager schedule
 * automatically after device reboot or app update.
 */
class BootCompletedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        if (action == Intent.ACTION_BOOT_COMPLETED || action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            if (HealthConnectSyncEngine.isBackgroundSyncEnabled(context)) {
                HealthSyncScheduler.ensureScheduled(context, true)
            }
        }
    }
}
