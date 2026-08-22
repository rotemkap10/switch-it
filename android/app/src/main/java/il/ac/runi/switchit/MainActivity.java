package il.ac.runi.switchit;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.webkit.WebView;

import com.capacitorjs.plugins.splashscreen.SplashScreenPlugin;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginHandle;

/**
 * Android shell hardening:
 * - Failsafe SplashScreen.hide if the remote WebView/JS never boots (launchAutoHide:false
 *   otherwise keeps Android 12+ keepOnScreenCondition true forever).
 * - Disable WebView overscroll so MapLibre fling inertia is not stolen by the system glow.
 */
public class MainActivity extends BridgeActivity {
    private static final String TAG = "SwitchItMainActivity";
    private static final long SPLASH_FAILSAFE_MS = 10_000L;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean splashFailsafeRan = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    "switch_it_handoff",
                    "Handoff alerts",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Parking handoff updates while you navigate");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }

        mainHandler.post(this::configureWebViewForMaps);
        mainHandler.postDelayed(this::runSplashFailsafe, SPLASH_FAILSAFE_MS);
    }

    @Override
    public void onStart() {
        super.onStart();
        configureWebViewForMaps();
    }

    @Override
    public void onDestroy() {
        mainHandler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }

    private void configureWebViewForMaps() {
        try {
            if (getBridge() == null || getBridge().getWebView() == null) {
                return;
            }
            WebView webView = getBridge().getWebView();
            // Android WebView glow/fling can absorb pan end velocity before MapLibre inertia.
            webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
            // Let MapLibre receive full touch velocity instead of nested scroll chaining.
            webView.setNestedScrollingEnabled(false);
        } catch (Exception error) {
            Log.w(TAG, "configureWebViewForMaps failed", error);
        }
    }

    /**
     * If Next.js never mounts (network/SW/remote URL failure), JS never calls
     * SplashScreen.hide() and Android 12+ stays on the launch splash forever.
     */
    private void runSplashFailsafe() {
        if (splashFailsafeRan) {
            return;
        }
        splashFailsafeRan = true;

        try {
            if (getBridge() == null) {
                return;
            }

            PluginHandle handle = getBridge().getPlugin("SplashScreen");
            if (handle != null && handle.getInstance() instanceof SplashScreenPlugin) {
                SplashScreenPlugin plugin = (SplashScreenPlugin) handle.getInstance();
                PluginCall call = new PluginCall(
                        null,
                        "SplashScreen",
                        PluginCall.CALLBACK_ID_DANGLING,
                        "hide",
                        new JSObject()
                );
                try {
                    plugin.hide(call);
                } catch (Exception hideError) {
                    // hide() runs before resolve(); a null MessageHandler may NPE on resolve.
                    Log.w(TAG, "SplashScreen.hide resolve ignored", hideError);
                }
                Log.i(TAG, "Splash failsafe: native SplashScreen.hide invoked");
                return;
            }

            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.evaluateJavascript(
                        "(function(){try{var p=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.SplashScreen;if(p&&p.hide){p.hide({});}}catch(e){}})();",
                        null
                );
                Log.i(TAG, "Splash failsafe: JS SplashScreen.hide attempted");
            }
        } catch (Exception error) {
            Log.w(TAG, "Splash failsafe failed", error);
        }
    }
}
