package io.github.mixxermannipro.openhealth

import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

/**
 * Required by Android Health Connect to explain how KADENZ handles health permissions.
 * Displays a transparent Local-First privacy rationale directly inside Android settings.
 */
class PermissionsRationaleActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        WindowCompat.setDecorFitsSystemWindows(window, false)
        @Suppress("DEPRECATION")
        window.statusBarColor = Color.TRANSPARENT
        @Suppress("DEPRECATION")
        window.navigationBarColor = Color.TRANSPARENT
        WindowInsetsControllerCompat(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }

        val dp = { value: Int ->
            TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP,
                value.toFloat(),
                resources.displayMetrics
            ).toInt()
        }

        val scroll = ScrollView(this).apply {
            setBackgroundColor(Color.parseColor("#090A0C"))
            isFillViewport = true
        }

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24), dp(48), dp(24), dp(36))
        }

        ViewCompat.setOnApplyWindowInsetsListener(container) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(dp(24), bars.top + dp(28), dp(24), bars.bottom + dp(28))
            insets
        }

        val badge = TextView(this).apply {
            text = "KADENZ · OPENHEALTH (AGPL-3.0)"
            setTextColor(Color.parseColor("#5CE17C"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
            typeface = Typeface.DEFAULT_BOLD
        }

        val title = TextView(this).apply {
            text = "100 % lokale Gesundheitsdaten"
            setTextColor(Color.parseColor("#F5F6F8"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 26f)
            typeface = Typeface.DEFAULT_BOLD
            setPadding(0, dp(10), 0, dp(14))
        }

        val body = TextView(this).apply {
            text = """
                KADENZ nutzt Android Health Connect ausschließlich lokal auf deinem Gerät, um deine Erholung, Schlafphasen, Trainingsbelastung, Herzfrequenzvariabilität (HRV), Schritte, Gewicht und Energiebilanz zu berechnen.

                • Kein Server, keine Cloud, kein Konto: Alle Daten bleiben in deiner lokalen App-Datenbank (IndexedDB) auf diesem Smartphone.
                • Keine Weitergabe & kein Tracking: Es gibt keinerlei Analyse-SDKs, Werbung oder Übertragung von Gesundheitsdaten an Dritte.
                • Optionaler Schreibzugriff: Wenn du möchtest, kannst du in KADENZ erfasste Mahlzeiten, Wasser und Gewicht an Health Connect zurückschreiben.
                • Volle Kontrolle: Du kannst Berechtigungen jederzeit in Android Health Connect widerrufen oder ein lokales JSON-Backup exportieren.
            """.trimIndent()
            setTextColor(Color.parseColor("#A1A4AE"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            setLineSpacing(dp(4).toFloat(), 1.15f)
        }

        val closeBtn = Button(this).apply {
            text = "Verstanden"
            setTextColor(Color.parseColor("#090A0C"))
            setBackgroundColor(Color.parseColor("#F5F6F8"))
            typeface = Typeface.DEFAULT_BOLD
            val lp = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(48)
            ).apply {
                topMargin = dp(28)
            }
            layoutParams = lp
            gravity = Gravity.CENTER
            setOnClickListener { finish() }
        }

        container.addView(badge)
        container.addView(title)
        container.addView(body)
        container.addView(closeBtn)
        scroll.addView(container)

        setContentView(scroll)
    }
}
