package il.ac.runi.switchit.handoff;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "HandoffBackgroundLocation",
    permissions = {
        @Permission(
            alias = "location",
            strings = {
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            }
        ),
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class HandoffBackgroundLocationPlugin extends Plugin {

    private static final String TAG = "switch-it";
    private static final String LOG_PREFIX = "[switch-it:handoff-live] ";

    private void liveLog(String message) {
        Log.i(TAG, LOG_PREFIX + message);
    }

    @PluginMethod
    public void startHandoffTracking(PluginCall call) {
        String claimId = call.getString("claimId", "");
        liveLog("android start requested claimId=" + claimId);

        PermissionState locationState = getPermissionState("location");
        liveLog("android permission state location=" + locationState
            + " fine=" + permissionGranted(Manifest.permission.ACCESS_FINE_LOCATION)
            + " coarse=" + permissionGranted(Manifest.permission.ACCESS_COARSE_LOCATION)
            + " notifications=" + (Build.VERSION.SDK_INT >= 33
                ? String.valueOf(getPermissionState("notifications"))
                : "n/a"));

        if (locationState != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "onLocationPermission");
            return;
        }
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "onNotificationPermission");
            return;
        }
        startService(call);
    }

    @PermissionCallback
    private void onLocationPermission(PluginCall call) {
        liveLog("android permission callback location=" + getPermissionState("location"));
        if (getPermissionState("location") != PermissionState.GRANTED) {
            JSObject result = new JSObject();
            result.put("started", false);
            result.put("reason", "permission_denied");
            liveLog("android error reason=permission_denied");
            call.resolve(result);
            return;
        }
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "onNotificationPermission");
            return;
        }
        startService(call);
    }

    @PermissionCallback
    private void onNotificationPermission(PluginCall call) {
        // Notification denial still allows tracking; FGS may be less visible.
        liveLog("android permission callback notifications=" + getPermissionState("notifications")
            + " continuing=true");
        startService(call);
    }

    private boolean permissionGranted(String permission) {
        return ContextCompat.checkSelfPermission(getContext(), permission)
            == PackageManager.PERMISSION_GRANTED;
    }

    private void startService(PluginCall call) {
        String claimId = call.getString("claimId");
        String accessToken = call.getString("accessToken");
        String supabaseUrl = call.getString("supabaseUrl");
        String publishableKey = call.getString("publishableKey");
        String edgeFunctionUrl = call.getString("edgeFunctionUrl");
        Double expiresAt = call.getDouble("expiresAtEpochMs");

        if (claimId == null || accessToken == null || supabaseUrl == null
                || publishableKey == null || edgeFunctionUrl == null || expiresAt == null) {
            JSObject result = new JSObject();
            result.put("started", false);
            result.put("reason", "invalid_claim");
            liveLog("android error reason=invalid_claim");
            call.resolve(result);
            return;
        }
        if (expiresAt <= System.currentTimeMillis()) {
            JSObject result = new JSObject();
            result.put("started", false);
            result.put("reason", "expired");
            liveLog("android error reason=expired claimId=" + claimId);
            call.resolve(result);
            return;
        }

        String normalizedClaimId = claimId.toLowerCase();
        if (HandoffLocationForegroundService.isActive()
                && normalizedClaimId.equals(HandoffLocationForegroundService.getActiveClaimId())) {
            HandoffLocationForegroundService.setPlugin(this);
            JSObject result = new JSObject();
            result.put("started", true);
            result.put("alreadyRunning", true);
            liveLog("android start alreadyRunning=true claimId=" + normalizedClaimId);
            call.resolve(result);
            return;
        }

        Activity activity = getActivity();
        boolean activityVisible = activity != null
            && !activity.isFinishing()
            && !activity.isDestroyed();
        liveLog("android foreground service start requested claimId=" + normalizedClaimId
            + " activityVisible=" + activityVisible);

        Intent intent = new Intent(getContext(), HandoffLocationForegroundService.class);
        intent.setAction(HandoffLocationForegroundService.ACTION_START);
        intent.putExtra(HandoffLocationForegroundService.EXTRA_CLAIM_ID, normalizedClaimId);
        intent.putExtra(HandoffLocationForegroundService.EXTRA_EXPIRES_AT, expiresAt.longValue());
        intent.putExtra(HandoffLocationForegroundService.EXTRA_ACCESS_TOKEN, accessToken);
        intent.putExtra(HandoffLocationForegroundService.EXTRA_SUPABASE_URL, supabaseUrl);
        intent.putExtra(HandoffLocationForegroundService.EXTRA_PUBLISHABLE_KEY, publishableKey);
        intent.putExtra(HandoffLocationForegroundService.EXTRA_EDGE_URL, edgeFunctionUrl);

        HandoffLocationForegroundService.setPlugin(this);
        try {
            ContextCompat.startForegroundService(getContext(), intent);
        } catch (Exception error) {
            // Android 12+: ForegroundServiceStartNotAllowedException if Activity already backgrounded.
            JSObject result = new JSObject();
            result.put("started", false);
            result.put("reason", "foreground_start_denied");
            liveLog("android error reason=foreground_start_denied message=" + error.getMessage());
            call.resolve(result);
            return;
        }

        JSObject result = new JSObject();
        result.put("started", true);
        liveLog("android foreground service start dispatched claimId=" + normalizedClaimId);
        call.resolve(result);
    }

    @PluginMethod
    public void stopHandoffTracking(PluginCall call) {
        String reason = call.getString("reason", "stop");
        liveLog("android tracking stop requested reason=" + reason);
        Intent intent = new Intent(getContext(), HandoffLocationForegroundService.class);
        intent.setAction(HandoffLocationForegroundService.ACTION_STOP);
        intent.putExtra(HandoffLocationForegroundService.EXTRA_STOP_REASON, reason);
        try {
            getContext().startService(intent);
        } catch (Exception error) {
            liveLog("android error reason=stop_dispatch_failed message=" + error.getMessage());
        }
        call.resolve();
    }

    @PluginMethod
    public void getTrackingState(PluginCall call) {
        JSObject result = new JSObject();
        result.put("active", HandoffLocationForegroundService.isActive());
        result.put("claimId", HandoffLocationForegroundService.getActiveClaimId());
        call.resolve(result);
    }

    void emitUiState(String uiState) {
        JSObject data = new JSObject();
        data.put("uiState", uiState);
        notifyListeners("handoffLocationState", data);
    }
}
