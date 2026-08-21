package il.ac.runi.switchit.handoff;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Foreground location service for one active Switch It parking handoff.
 * Uses Android LocationManager (GPS + network). Transmits via authenticated
 * Edge Function. No route history. Survives Switch It → Waze/Google Maps.
 */
public class HandoffLocationForegroundService extends Service implements LocationListener {

    public static final String ACTION_START = "il.ac.runi.switchit.handoff.START";
    public static final String ACTION_STOP = "il.ac.runi.switchit.handoff.STOP";
    public static final String EXTRA_CLAIM_ID = "claimId";
    public static final String EXTRA_EXPIRES_AT = "expiresAtEpochMs";
    public static final String EXTRA_ACCESS_TOKEN = "accessToken";
    public static final String EXTRA_SUPABASE_URL = "supabaseUrl";
    public static final String EXTRA_PUBLISHABLE_KEY = "publishableKey";
    public static final String EXTRA_EDGE_URL = "edgeFunctionUrl";
    public static final String EXTRA_STOP_REASON = "reason";

    private static final String TAG = "switch-it";
    private static final String LOG_PREFIX = "[switch-it:handoff-live] ";
    private static final String CHANNEL_ID = "switchit_handoff_location";
    private static final int NOTIFICATION_ID = 9101;
    private static final long MIN_SEND_MS = 3_000L;
    private static final long PREFERRED_SEND_MS = 4_000L;
    private static final long HEARTBEAT_MS = 10_000L;
    private static final double MEANINGFUL_MOVE_M = 20.0;
    private static final double HEADING_CHANGE_DEG = 35.0;
    private static final double ACCURACY_IMPROVE_M = 25.0;
    private static final float MAX_ACCURACY_M = 150f;
    private static final long MAX_STALE_LOCATION_MS = 60_000L;

    private static volatile boolean active = false;
    private static volatile String activeClaimId = null;
    private static volatile HandoffBackgroundLocationPlugin plugin;

    private LocationManager locationManager;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService network = Executors.newSingleThreadExecutor();
    private Runnable expiryRunnable;

    private String claimId;
    private long expiresAtEpochMs;
    private String accessToken;
    private String publishableKey;
    private String edgeFunctionUrl;
    private int sequence = 0;
    private Location lastSent;
    private long lastSentAtWallMs = 0L;
    private boolean updatesRegistered = false;

    public static void setPlugin(HandoffBackgroundLocationPlugin next) {
        plugin = next;
    }

    public static boolean isActive() {
        return active;
    }

    public static String getActiveClaimId() {
        return activeClaimId;
    }

    private void liveLog(String message) {
        Log.i(TAG, LOG_PREFIX + message);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            liveLog("android error reason=null_intent");
            stopSelf();
            return START_NOT_STICKY;
        }

        if (ACTION_STOP.equals(intent.getAction())) {
            String reason = intent.getStringExtra(EXTRA_STOP_REASON);
            liveLog("android tracking stopped reason=" + (reason != null ? reason : "stop"));
            stopTracking(true);
            return START_NOT_STICKY;
        }

        claimId = intent.getStringExtra(EXTRA_CLAIM_ID);
        expiresAtEpochMs = intent.getLongExtra(EXTRA_EXPIRES_AT, 0L);
        accessToken = intent.getStringExtra(EXTRA_ACCESS_TOKEN);
        publishableKey = intent.getStringExtra(EXTRA_PUBLISHABLE_KEY);
        edgeFunctionUrl = intent.getStringExtra(EXTRA_EDGE_URL);

        if (claimId == null || accessToken == null || edgeFunctionUrl == null
                || publishableKey == null
                || expiresAtEpochMs <= System.currentTimeMillis()) {
            liveLog("android error reason=invalid_start_extras claimId=" + claimId);
            stopSelf();
            return START_NOT_STICKY;
        }

        // Promote to FGS immediately — required before heavy work / backgrounding.
        try {
            startForegroundWithNotification();
        } catch (Exception error) {
            liveLog("android error reason=start_foreground_failed message=" + error.getMessage());
            stopSelf();
            return START_NOT_STICKY;
        }

        if (active && claimId.equals(activeClaimId)) {
            liveLog("android foreground service running already claimId=" + claimId
                + " updatesRegistered=" + updatesRegistered);
            if (!updatesRegistered) {
                beginUpdates();
            }
            scheduleExpiry();
            return START_REDELIVER_INTENT;
        }

        beginUpdates();
        return START_REDELIVER_INTENT;
    }

    private void startForegroundWithNotification() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Parking handoff location",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shown only during an active Switch It parking handoff.");
            manager.createNotificationChannel(channel);
        }

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Switch It")
            .setContentText("Sharing location for active parking handoff")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build();

        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            );
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        liveLog("android foreground service running claimId=" + claimId);
    }

    private boolean hasLocationPermission() {
        return ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED
            || ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_COARSE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
    }

    private void beginUpdates() {
        active = true;
        activeClaimId = claimId;
        sequence = 0;
        lastSent = null;
        lastSentAtWallMs = 0L;
        updatesRegistered = false;
        emitUi("acquiring");

        if (!hasLocationPermission()) {
            liveLog("android error reason=permission_missing_in_service claimId=" + claimId);
            emitUi("denied");
            stopTracking(false);
            return;
        }

        locationManager = (LocationManager) getSystemService(LOCATION_SERVICE);
        if (locationManager == null) {
            liveLog("android error reason=no_location_manager claimId=" + claimId);
            emitUi("unavailable");
            stopTracking(false);
            return;
        }

        boolean gpsEnabled = false;
        boolean networkEnabled = false;
        try {
            gpsEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER);
            networkEnabled = locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
        } catch (Exception error) {
            liveLog("android error reason=provider_check_failed message=" + error.getMessage());
        }

        liveLog("android location provider=LocationManager gpsEnabled=" + gpsEnabled
            + " networkEnabled=" + networkEnabled + " claimId=" + claimId);

        if (!gpsEnabled && !networkEnabled) {
            liveLog("android error reason=location_providers_disabled claimId=" + claimId);
            emitUi("unavailable");
            stopTracking(false);
            return;
        }

        try {
            if (gpsEnabled) {
                locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    MIN_SEND_MS,
                    10f,
                    this,
                    Looper.getMainLooper()
                );
                updatesRegistered = true;
            }
            if (networkEnabled) {
                locationManager.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    MIN_SEND_MS,
                    10f,
                    this,
                    Looper.getMainLooper()
                );
                updatesRegistered = true;
            }
        } catch (SecurityException error) {
            liveLog("android error reason=security_exception message=" + error.getMessage());
            emitUi("denied");
            stopTracking(false);
            return;
        } catch (Exception error) {
            liveLog("android error reason=request_updates_failed message=" + error.getMessage());
            emitUi("unavailable");
            stopTracking(false);
            return;
        }

        if (!updatesRegistered) {
            liveLog("android error reason=no_updates_registered claimId=" + claimId);
            emitUi("unavailable");
            stopTracking(false);
            return;
        }

        // Bootstrap with last-known so the first POST is not delayed until GPS locks.
        try {
            Location lastGps = gpsEnabled
                ? locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                : null;
            Location lastNetwork = networkEnabled
                ? locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
                : null;
            Location bootstrap = pickFresher(lastGps, lastNetwork);
            if (bootstrap != null) {
                liveLog("android location fix received source=lastKnown provider="
                    + bootstrap.getProvider() + " claimId=" + claimId);
                onLocationChanged(bootstrap);
            }
        } catch (SecurityException error) {
            liveLog("android error reason=last_known_denied message=" + error.getMessage());
        }

        scheduleExpiry();
    }

    private Location pickFresher(Location a, Location b) {
        if (a == null) {
            return b;
        }
        if (b == null) {
            return a;
        }
        return a.getTime() >= b.getTime() ? a : b;
    }

    private void scheduleExpiry() {
        if (expiryRunnable != null) {
            handler.removeCallbacks(expiryRunnable);
        }
        long delay = Math.max(0L, expiresAtEpochMs - System.currentTimeMillis());
        expiryRunnable = () -> {
            liveLog("android tracking stopped reason=expired claimId=" + claimId);
            stopTracking(true);
        };
        handler.postDelayed(expiryRunnable, delay);
    }

    private void stopTracking(boolean notifyPublisher) {
        if (expiryRunnable != null) {
            handler.removeCallbacks(expiryRunnable);
            expiryRunnable = null;
        }
        if (locationManager != null) {
            try {
                locationManager.removeUpdates(this);
            } catch (SecurityException ignored) {
                // ignore
            }
        }
        updatesRegistered = false;

        boolean wasActive = active;
        String stoppingClaim = claimId;
        String token = accessToken;
        String url = edgeFunctionUrl;
        String key = publishableKey;
        int stoppedSequence = sequence + 1;

        active = false;
        activeClaimId = null;
        sequence = 0;
        lastSent = null;
        lastSentAtWallMs = 0L;

        if (wasActive && notifyPublisher && stoppingClaim != null && token != null && url != null && key != null) {
            postEvent(url, token, key, stoppingClaim, "seeker-location-status", statusPayload(stoppedSequence), false);
        }

        try {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } catch (Exception ignored) {
            // ignore
        }
        stopSelf();
    }

    private JSONObject statusPayload(int seq) {
        JSONObject payload = new JSONObject();
        try {
            payload.put("status", "stopped");
            payload.put("sequence", seq);
            payload.put("sentAt", System.currentTimeMillis());
        } catch (Exception ignored) {
            // ignore
        }
        return payload;
    }

    @Override
    public void onLocationChanged(Location location) {
        if (!active) {
            return;
        }
        if (System.currentTimeMillis() >= expiresAtEpochMs) {
            liveLog("android tracking stopped reason=expired_on_fix claimId=" + claimId);
            stopTracking(true);
            return;
        }

        liveLog("android location fix received provider=" + location.getProvider()
            + " claimId=" + claimId
            + " accuracy=" + location.getAccuracy()
            + " ageMs=" + Math.max(0L, System.currentTimeMillis() - location.getTime()));

        float accuracy = location.getAccuracy();
        if (accuracy <= 0 || accuracy > MAX_ACCURACY_M) {
            emitUi("weak");
            liveLog("android location rejected claimId=" + claimId
                + " accuracy=" + accuracy + " reason=unusable_accuracy");
            return;
        }

        long ageMs = System.currentTimeMillis() - location.getTime();
        // After the first accepted fix, ignore very stale cached samples.
        if (lastSent != null && ageMs > MAX_STALE_LOCATION_MS) {
            liveLog("android location rejected claimId=" + claimId
                + " ageMs=" + ageMs + " reason=stale_cached");
            return;
        }

        liveLog("android location accepted provider=android claimId=" + claimId
            + " lat=" + location.getLatitude() + " lng=" + location.getLongitude()
            + " accuracy=" + accuracy + " timestamp=" + location.getTime());

        if (!shouldSend(location)) {
            return;
        }

        sequence += 1;
        lastSent = new Location(location);
        lastSentAtWallMs = System.currentTimeMillis();

        JSONObject payload = new JSONObject();
        try {
            payload.put("latitude", location.getLatitude());
            payload.put("longitude", location.getLongitude());
            payload.put("accuracyMeters", accuracy);
            if (location.hasBearing()) {
                float heading = location.getBearing() % 360f;
                if (heading < 0) {
                    heading += 360f;
                }
                payload.put("headingDegrees", heading);
            }
            payload.put("sequence", sequence);
            payload.put("sentAt", System.currentTimeMillis());
        } catch (Exception ignored) {
            return;
        }
        postEvent(edgeFunctionUrl, accessToken, publishableKey, claimId, "seeker-location", payload, true);
    }

    private boolean shouldSend(Location next) {
        if (lastSent == null) {
            return true;
        }
        // Wall clock — GPS timestamps on cached Android fixes can break throttle math.
        long elapsed = System.currentTimeMillis() - lastSentAtWallMs;
        if (elapsed < MIN_SEND_MS) {
            return false;
        }
        float moved = lastSent.distanceTo(next);
        if (elapsed >= PREFERRED_SEND_MS && moved >= MEANINGFUL_MOVE_M) {
            return true;
        }
        if (lastSent.hasBearing() && next.hasBearing()) {
            float delta = Math.abs(lastSent.getBearing() - next.getBearing()) % 360f;
            float turn = delta > 180f ? 360f - delta : delta;
            if (moved >= 5f && turn >= HEADING_CHANGE_DEG) {
                return true;
            }
        }
        if (lastSent.getAccuracy() - next.getAccuracy() >= ACCURACY_IMPROVE_M) {
            return true;
        }
        return elapsed >= HEARTBEAT_MS;
    }

    private void postEvent(
        String url,
        String token,
        String key,
        String claim,
        String event,
        JSONObject payload,
        boolean markSharingOnSuccess
    ) {
        network.execute(() -> {
            HttpURLConnection connection = null;
            try {
                JSONObject body = new JSONObject();
                body.put("claimId", claim);
                body.put("event", event);
                body.put("payload", payload);

                liveLog("android POST started event=" + event + " claimId=" + claim);
                connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(8_000);
                connection.setReadTimeout(8_000);
                connection.setDoOutput(true);
                connection.setRequestProperty("Authorization", "Bearer " + token);
                connection.setRequestProperty("apikey", key);
                connection.setRequestProperty("Content-Type", "application/json");
                byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream out = connection.getOutputStream()) {
                    out.write(bytes);
                }
                int code = connection.getResponseCode();
                String errorBody = "";
                if (code < 200 || code >= 300) {
                    errorBody = readLimited(connection.getErrorStream(), 240);
                }
                liveLog("android POST status=" + code
                    + " event=" + event + " claimId=" + claim
                    + (errorBody.isEmpty() ? "" : " body=" + errorBody));

                if (code == 401 || code == 403) {
                    handler.post(() -> stopTracking(false));
                    if (markSharingOnSuccess) {
                        emitUi("unavailable");
                    }
                    return;
                }
                if (code >= 200 && code < 300) {
                    if (markSharingOnSuccess) {
                        emitUi("sharing");
                    }
                    return;
                }
                if (markSharingOnSuccess) {
                    emitUi("unavailable");
                }
            } catch (Exception error) {
                liveLog("android POST status=error event=" + event
                    + " claimId=" + claim + " error=" + error.getMessage());
                if (markSharingOnSuccess) {
                    emitUi("unavailable");
                }
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
        });
    }

    private String readLimited(InputStream stream, int maxChars) {
        if (stream == null) {
            return "";
        }
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            StringBuilder builder = new StringBuilder();
            int ch;
            while ((ch = reader.read()) != -1 && builder.length() < maxChars) {
                char c = (char) ch;
                if (c == '\n' || c == '\r') {
                    builder.append(' ');
                } else {
                    builder.append(c);
                }
            }
            return builder.toString().trim();
        } catch (Exception ignored) {
            return "";
        }
    }

    private void emitUi(String uiState) {
        HandoffBackgroundLocationPlugin current = plugin;
        if (current != null) {
            handler.post(() -> current.emitUiState(uiState));
        }
    }

    @Override
    public void onProviderEnabled(String provider) {
        liveLog("android location provider enabled=" + provider + " claimId=" + claimId);
    }

    @Override
    public void onProviderDisabled(String provider) {
        liveLog("android location provider disabled=" + provider + " claimId=" + claimId);
        if (locationManager == null) {
            return;
        }
        try {
            boolean gps = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER);
            boolean network = locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
            if (!gps && !network && active) {
                emitUi("unavailable");
            }
        } catch (Exception ignored) {
            // ignore
        }
    }

    @Override
    @Deprecated
    public void onStatusChanged(String provider, int status, Bundle extras) {}

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        liveLog("android tracking stopped reason=service_destroy claimId=" + claimId);
        stopTracking(false);
        network.shutdownNow();
        super.onDestroy();
    }
}
