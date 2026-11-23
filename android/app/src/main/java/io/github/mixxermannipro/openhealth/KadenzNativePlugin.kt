package io.github.mixxermannipro.openhealth

import android.Manifest
import android.annotation.SuppressLint
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.view.WindowInsetsControllerCompat
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.io.File

@CapacitorPlugin(
    name = "KadenzNative",
    permissions = [
        Permission(strings = [Manifest.permission.CAMERA], alias = "camera")
    ]
)
class KadenzNativePlugin : Plugin() {

    companion object {
        @Volatile
        private var activeInstance: KadenzNativePlugin? = null

        @Volatile
        private var pendingIntentPayload: JSObject? = null

        @Volatile
        private var safeTop: Float = 0f

        @Volatile
        private var safeBottom: Float = 0f

        @Volatile
        private var safeLeft: Float = 0f

        @Volatile
        private var safeRight: Float = 0f

        fun updateSafeAreaInsets(top: Float, bottom: Float, left: Float, right: Float) {
            safeTop = top
            safeBottom = bottom
            safeLeft = left
            safeRight = right
            val instance = activeInstance ?: return
            val data = JSObject().apply {
                put("top", top)
                put("bottom", bottom)
                put("left", left)
                put("right", right)
            }
            instance.notifyListeners("safeAreaInsets", data, false)
        }

        fun handleIncomingPayload(kind: String, rawText: String, isColdStart: Boolean) {
            val payload = JSObject().apply {
                put("kind", kind)
                put("rawText", rawText)
                put("receivedAt", System.currentTimeMillis())
            }
            val instance = activeInstance
            if (instance != null && !isColdStart && instance.hasListeners("incomingIntent")) {
                instance.notifyListeners("incomingIntent", payload, true)
            } else {
                pendingIntentPayload = payload
                if (instance != null && instance.hasListeners("incomingIntent")) {
                    pendingIntentPayload = null
                    instance.notifyListeners("incomingIntent", payload, true)
                }
            }
        }

        fun dispatchHardwareBack(): Boolean {
            val instance = activeInstance ?: return false
            if (!instance.hasListeners("hardwareBack")) return false
            instance.notifyListeners("hardwareBack", JSObject(), false)
            return true
        }
    }

    override fun load() {
        super.load()
        activeInstance = this
    }

    override fun handleOnDestroy() {
        if (activeInstance === this) {
            activeInstance = null
        }
        super.handleOnDestroy()
    }

    @PluginMethod
    fun getPendingIntent(call: PluginCall) {
        val payload = pendingIntentPayload
        pendingIntentPayload = null
        val result = JSObject()
        if (payload != null) {
            result.put("hasPending", true)
            result.put("kind", payload.getString("kind"))
            result.put("rawText", payload.getString("rawText"))
            result.put("receivedAt", payload.getLong("receivedAt"))
        } else {
            result.put("hasPending", false)
        }
        call.resolve(result)
    }

    @PluginMethod
    fun getSafeAreaInsets(call: PluginCall) {
        call.resolve(JSObject().apply {
            put("top", safeTop)
            put("bottom", safeBottom)
            put("left", safeLeft)
            put("right", safeRight)
        })
    }

    @PluginMethod
    fun setSystemBars(call: PluginCall) {
        val isDark = call.getBoolean("isDark", true) ?: true
        val bgColorStr = call.getString("backgroundColor")
        activity.runOnUiThread {
            try {
                val controller = WindowInsetsControllerCompat(activity.window, activity.window.decorView)
                controller.isAppearanceLightStatusBars = !isDark
                controller.isAppearanceLightNavigationBars = !isDark
                if (!bgColorStr.isNullOrBlank()) {
                    try {
                        activity.window.decorView.setBackgroundColor(Color.parseColor(bgColorStr))
                    } catch (_: IllegalArgumentException) {
                        // Ignore malformed color strings
                    }
                }
            } catch (_: Exception) {
                // Ignore window controller issues on older OEM skins
            }
            call.resolve()
        }
    }

    @PluginMethod
    fun readClipboard(call: PluginCall) {
        activity.runOnUiThread {
            try {
                val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
                val clip = clipboard?.primaryClip
                val text = if (clip != null && clip.itemCount > 0) {
                    clip.getItemAt(0).coerceToText(context)?.toString().orEmpty()
                } else {
                    ""
                }
                call.resolve(JSObject().apply {
                    put("text", text)
                })
            } catch (e: Exception) {
                call.resolve(JSObject().apply {
                    put("text", "")
                    put("error", e.message ?: "clipboard_read_failed")
                })
            }
        }
    }

    @PluginMethod
    fun writeClipboard(call: PluginCall) {
        val text = call.getString("text") ?: ""
        activity.runOnUiThread {
            try {
                val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
                clipboard?.setPrimaryClip(ClipData.newPlainText("KADENZ", text))
                call.resolve(JSObject().apply { put("ok", true) })
            } catch (e: Exception) {
                call.reject("Clipboard write failed: ${e.message}", e)
            }
        }
    }

    @PluginMethod
    fun haptic(call: PluginCall) {
        val pattern = call.getString("pattern") ?: "selection"
        try {
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val manager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                manager?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            }

            if (vibrator == null || !vibrator.hasVibrator()) {
                call.resolve(JSObject().apply { put("ok", false) })
                return
            }

            val effect = when (pattern) {
                "tick" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK)
                } else {
                    VibrationEffect.createOneShot(8, 80)
                }
                "selection" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK)
                } else {
                    VibrationEffect.createOneShot(12, 110)
                }
                "light" -> VibrationEffect.createOneShot(14, 110)
                "medium" -> VibrationEffect.createOneShot(22, 165)
                "success" -> VibrationEffect.createWaveform(longArrayOf(0, 14, 42, 20), intArrayOf(0, 140, 0, 210), -1)
                "warning" -> VibrationEffect.createWaveform(longArrayOf(0, 22, 48, 22), intArrayOf(0, 180, 0, 180), -1)
                "error" -> VibrationEffect.createWaveform(longArrayOf(0, 28, 45, 28, 45, 32), intArrayOf(0, 220, 0, 220, 0, 240), -1)
                else -> VibrationEffect.createOneShot(12, VibrationEffect.DEFAULT_AMPLITUDE)
            }

            vibrator.vibrate(effect)
            call.resolve(JSObject().apply { put("ok", true) })
        } catch (_: Exception) {
            call.resolve(JSObject().apply { put("ok", false) })
        }
    }

    @PluginMethod
    fun checkCameraPermission(call: PluginCall) {
        val granted = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED
        call.resolve(JSObject().apply { put("granted", granted) })
    }

    @PluginMethod
    fun requestCameraPermission(call: PluginCall) {
        if (getPermissionState("camera") == PermissionState.GRANTED) {
            call.resolve(JSObject().apply { put("granted", true) })
            return
        }
        requestPermissionForAlias("camera", call, "cameraPermissionCallback")
    }

    @PermissionCallback
    private fun cameraPermissionCallback(call: PluginCall) {
        val granted = getPermissionState("camera") == PermissionState.GRANTED
        call.resolve(JSObject().apply { put("granted", granted) })
    }

    @PluginMethod
    fun exportFile(call: PluginCall) {
        val filename = call.getString("filename") ?: "kadenz-backup.json"
        val content = call.getString("content") ?: ""
        val mimeType = call.getString("mimeType") ?: "application/json"

        try {
            val exportDir = File(context.cacheDir, "exports")
            if (!exportDir.exists()) {
                exportDir.mkdirs()
            }
            val safeName = filename.replace(Regex("[^a-zA-Z0-9._-]"), "_")
            val file = File(exportDir, safeName)
            file.writeText(content, Charsets.UTF_8)

            val uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                file
            )

            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = mimeType
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, safeName)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            val chooser = Intent.createChooser(shareIntent, "Backup speichern oder teilen")
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            activity.startActivity(chooser)

            call.resolve(JSObject().apply {
                put("ok", true)
                put("path", file.absolutePath)
            })
        } catch (e: Exception) {
            call.reject("Export failed: ${e.message}", e)
        }
    }

    @PluginMethod
    fun configureBackgroundSync(call: PluginCall) {
        val enabled = call.getBoolean("enabled", true) ?: true
        try {
            HealthSyncScheduler.ensureScheduled(context, enabled)
            call.resolve(JSObject().apply {
                put("ok", true)
                put("enabled", enabled)
            })
        } catch (e: Exception) {
            call.resolve(JSObject().apply {
                put("ok", false)
                put("error", e.message ?: "workmanager_error")
            })
        }
    }

    @PluginMethod
    fun isBatteryOptimizationIgnored(call: PluginCall) {
        val ignored = try {
            val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
            pm?.isIgnoringBatteryOptimizations(context.packageName) ?: false
        } catch (_: Exception) {
            false
        }
        call.resolve(JSObject().apply { put("ignored", ignored) })
    }

    @SuppressLint("BatteryLife")
    @PluginMethod
    fun requestIgnoreBatteryOptimization(call: PluginCall) {
        activity.runOnUiThread {
            try {
                val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
                if (pm?.isIgnoringBatteryOptimizations(context.packageName) == true) {
                    call.resolve(JSObject().apply { put("ignored", true) })
                    return@runOnUiThread
                }
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:${context.packageName}")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                activity.startActivity(intent)
                call.resolve(JSObject().apply { put("requested", true) })
            } catch (_: Exception) {
                try {
                    val fallback = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    activity.startActivity(fallback)
                    call.resolve(JSObject().apply { put("requested", true) })
                } catch (e: Exception) {
                    call.resolve(JSObject().apply { put("requested", false) })
                }
            }
        }
    }

    @PluginMethod
    fun isAppInstalled(call: PluginCall) {
        val packageName = call.getString("packageName") ?: ""
        val installed = if (packageName.isBlank()) {
            false
        } else {
            try {
                context.packageManager.getPackageInfo(packageName, 0)
                true
            } catch (_: Exception) {
                false
            }
        }
        call.resolve(JSObject().apply { put("installed", installed) })
    }

    @PluginMethod
    fun openExternalApp(call: PluginCall) {
        val packageName = call.getString("packageName") ?: ""
        if (packageName.isBlank()) {
            call.resolve(JSObject().apply { put("opened", false) })
            return
        }
        activity.runOnUiThread {
            try {
                val launchIntent = context.packageManager.getLaunchIntentForPackage(packageName)
                if (launchIntent != null) {
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    activity.startActivity(launchIntent)
                    call.resolve(JSObject().apply { put("opened", true) })
                } else {
                    val storeIntent = Intent(Intent.ACTION_VIEW).apply {
                        data = Uri.parse("market://details?id=$packageName")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    activity.startActivity(storeIntent)
                    call.resolve(JSObject().apply { put("opened", true); put("store", true) })
                }
            } catch (_: Exception) {
                call.resolve(JSObject().apply { put("opened", false) })
            }
        }
    }

    @PluginMethod
    fun minimizeApp(call: PluginCall) {
        activity.runOnUiThread {
            activity.moveTaskToBack(true)
            call.resolve()
        }
    }

    @PluginMethod
    fun getDeviceInfo(call: PluginCall) {
        val versionName = try {
            val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            pInfo.versionName ?: "1.1.0"
        } catch (_: Exception) {
            "1.1.0"
        }
        call.resolve(JSObject().apply {
            put("platform", "android")
            put("sdkInt", Build.VERSION.SDK_INT)
            put("manufacturer", Build.MANUFACTURER)
            put("model", Build.MODEL)
            put("appVersion", versionName)
        })
    }
}
