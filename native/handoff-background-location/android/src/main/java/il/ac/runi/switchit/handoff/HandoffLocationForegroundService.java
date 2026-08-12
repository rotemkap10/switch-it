package il.ac.runi.switchit.handoff;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Foreground location service for one active Switch It parking handoff.
 * Transmits via authenticated Edge Function. No route history.
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

    private static final String CHANNEL_ID = "switchit_handoff_location";
    private static final int NOTIFICATION_ID = 9101;
    private static final long MIN_SEND_MS = 3_000L;
    private static final long PREFERRED_SEND_MS = 4_000L;
    private static final long HEARTBEAT_MS = 10_000L;
    private static final double MEANINGFUL_MOVE_M = 20.0;
    private static final double HEADING_CHANGE_DEG = 35.0;
    private static final double ACCURACY_IMPROVE_M = 25.0;
    private static final float MAX_ACCURACY_M = 150f;

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

    public static void setPlugin(HandoffBackgroundLocationPlugin next) {
        plugin = next;
    }

    public static boolean isActive() {
        return active;
    }

    public static String getActiveClaimId() {
        return activeClaimId;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        if (ACTION_STOP.equals(intent.getAction())) {
            stopTracking(true);
            return START_NOT_STICKY;
        }

        claimId = intent.getStringExtra(EXTRA_CLAIM_ID);
        expiresAtEpochMs = intent.getLongExtra(EXTRA_EXPIRES_AT, 0L);
        accessToken = intent.getStringExtra(EXTRA_ACCESS_TOKEN);
        publishableKey = intent.getStringExtra(EXTRA_PUBLISHABLE_KEY);
        edgeFunctionUrl = intent.getStringExtra(EXTRA_EDGE_URL);

        if (claimId == null || accessToken == null || edgeFunctionUrl == null || expiresAtEpochMs <= System.currentTimeMillis()) {
            stopSelf();
            return START_NOT_STICKY;
        }

        if (active && claimId.equals(activeClaimId)) {
            startForegroundWithNotification();
            scheduleExpiry();
            return START_REDELIVER_INTENT;
        }

        startForegroundWithNotification();
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
    }

    private void beginUpdates() {
        active = true;
        activeClaimId = claimId;
        sequence = 0;
        lastSent = null;
        emitUi("acquiring");

        locationManager = (LocationManager) getSystemService(LOCATION_SERVICE);
        try {
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    MIN_SEND_MS,
                    15f,
                    this,
                    Looper.getMainLooper()
                );
            }
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(
                    LocationManager.NETWORK_PROVIDER,
                    MIN_SEND_MS,
                    15f,
                    this,
                    Looper.getMainLooper()
                );
            }
        } catch (SecurityException ignored) {
            emitUi("weak");
        }
        scheduleExpiry();
    }

    private void scheduleExpiry() {
        if (expiryRunnable != null) {
            handler.removeCallbacks(expiryRunnable);
        }
        long delay = Math.max(0L, expiresAtEpochMs - System.currentTimeMillis());
        expiryRunnable = () -> stopTracking(true);
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

        if (wasActive && notifyPublisher && stoppingClaim != null && token != null && url != null && key != null) {
            postEvent(url, token, key, stoppingClaim, "seeker-location-status", statusPayload(stoppedSequence));
        }

        stopForeground(STOP_FOREGROUND_REMOVE);
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
            stopTracking(true);
            return;
        }
        float accuracy = location.getAccuracy();
        if (accuracy <= 0 || accuracy > MAX_ACCURACY_M) {
            emitUi("weak");
            return;
        }
        if (!shouldSend(location)) {
            emitUi("sharing");
            return;
        }

        sequence += 1;
        lastSent = new Location(location);
        emitUi("sharing");

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
            } else {
                payload.put("headingDegrees", JSONObject.NULL);
            }
            payload.put("sequence", sequence);
            payload.put("sentAt", System.currentTimeMillis());
        } catch (Exception ignored) {
            return;
        }
        postEvent(edgeFunctionUrl, accessToken, publishableKey, claimId, "seeker-location", payload);
    }

    private boolean shouldSend(Location next) {
        if (lastSent == null) {
            return true;
        }
        long elapsed = next.getTime() - lastSent.getTime();
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
        JSONObject payload
    ) {
        network.execute(() -> {
            HttpURLConnection connection = null;
            try {
                JSONObject body = new JSONObject();
                body.put("claimId", claim);
                body.put("event", event);
                body.put("payload", payload);

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
                if (code == 401 || code == 403) {
                    handler.post(() -> stopTracking(false));
                }
            } catch (Exception ignored) {
                // No crash; no route history queue.
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
        });
    }

    private void emitUi(String uiState) {
        HandoffBackgroundLocationPlugin current = plugin;
        if (current != null) {
            handler.post(() -> current.emitUiState(uiState));
        }
    }

    @Override
    public void onProviderEnabled(String provider) {}

    @Override
    public void onProviderDisabled(String provider) {}

    @Override
    @Deprecated
    public void onStatusChanged(String provider, int status, Bundle extras) {}

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        stopTracking(false);
        network.shutdownNow();
        super.onDestroy();
    }
}
