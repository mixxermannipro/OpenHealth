package io.github.mixxermannipro.openhealth

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import androidx.activity.OnBackPressedCallback
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        registerPlugin(KadenzNativePlugin::class.java)
        registerPlugin(HealthConnectPlugin::class.java)
        super.onCreate(savedInstanceState)

        configureEdgeToEdge()
        configureBackNavigation()
        handleIncomingIntent(intent, isColdStart = true)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIncomingIntent(intent, isColdStart = false)
    }

    private fun configureEdgeToEdge() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        @Suppress("DEPRECATION")
        window.statusBarColor = Color.TRANSPARENT
        @Suppress("DEPRECATION")
        window.navigationBarColor = Color.TRANSPARENT

        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.isAppearanceLightStatusBars = false
        controller.isAppearanceLightNavigationBars = false

        ViewCompat.setOnApplyWindowInsetsListener(window.decorView) { _, windowInsets ->
            val insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            val density = resources.displayMetrics.density.coerceAtLeast(1f)
            val topPx = (insets.top / density)
            val bottomPx = (insets.bottom / density)
            val leftPx = (insets.left / density)
            val rightPx = (insets.right / density)

            KadenzNativePlugin.updateSafeAreaInsets(topPx, bottomPx, leftPx, rightPx)
            injectSafeAreaCss(topPx, bottomPx, leftPx, rightPx)
            windowInsets
        }
        ViewCompat.requestApplyInsets(window.decorView)
    }

    private fun injectSafeAreaCss(top: Float, bottom: Float, left: Float, right: Float) {
        val webView = bridge?.webView ?: return
        val js = """
            (function() {
              var r = document.documentElement;
              if (!r) return;
              r.style.setProperty('--android-safe-top', '${top}px');
              r.style.setProperty('--android-safe-bottom', '${bottom}px');
              r.style.setProperty('--android-safe-left', '${left}px');
              r.style.setProperty('--android-safe-right', '${right}px');
            })();
        """.trimIndent()
        webView.post {
            webView.evaluateJavascript(js, null)
        }
    }

    private fun configureBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val handledByJs = KadenzNativePlugin.dispatchHardwareBack()
                if (!handledByJs) {
                    moveTaskToBack(true)
                }
            }
        })
    }

    private fun handleIncomingIntent(intent: Intent?, isColdStart: Boolean) {
        if (intent == null) return

        val action = intent.action
        val type = intent.type

        // 1. Launcher App Shortcut (extra: kadenz_tab = "nutrition" | "sleep")
        val shortcutTab = intent.getStringExtra("kadenz_tab")
        if (!shortcutTab.isNullOrBlank()) {
            KadenzNativePlugin.handleIncomingPayload(
                kind = "tab_shortcut",
                rawText = shortcutTab.trim(),
                isColdStart = isColdStart
            )
            intent.removeExtra("kadenz_tab")
            return
        }

        // 2. Android Share Target (ACTION_SEND text/plain from Gemini, ChatGPT, Claude, etc.)
        if (Intent.ACTION_SEND == action && type != null && type.startsWith("text/")) {
            val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)?.trim().orEmpty()
            val sharedSubject = intent.getStringExtra(Intent.EXTRA_SUBJECT)?.trim().orEmpty()
            val combined = listOf(sharedSubject, sharedText)
                .filter { it.isNotBlank() }
                .joinToString("\n")
            if (combined.isNotBlank()) {
                KadenzNativePlugin.handleIncomingPayload(
                    kind = "share_intent",
                    rawText = combined,
                    isColdStart = isColdStart
                )
            }
            return
        }

        // 3. Custom Deep-Link Schemes (caltrack://, kadenz://, web+caltrack://, web+kadenz://)
        if (Intent.ACTION_VIEW == action) {
            val uri = intent.dataString?.trim()
            if (!uri.isNullOrBlank() &&
                (uri.startsWith("caltrack://", ignoreCase = true) ||
                    uri.startsWith("kadenz://", ignoreCase = true) ||
                    uri.startsWith("web+caltrack://", ignoreCase = true) ||
                    uri.startsWith("web+kadenz://", ignoreCase = true))
            ) {
                KadenzNativePlugin.handleIncomingPayload(
                    kind = "deeplink",
                    rawText = uri,
                    isColdStart = isColdStart
                )
            }
        }
    }
}
