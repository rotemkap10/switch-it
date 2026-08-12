package il.ac.runi.switchit.handoff;

import android.Manifest;
import android.content.Intent;
import android.os.Build;

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

    @PluginMethod
    public void startHandoffTracking(PluginCall call) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
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
        if (getPermissionState("location") != PermissionState.GRANTED) {
            JSObject result = new JSObject();
            result.put("started", false);
            result.put("reason", "permission_denied");
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
        startService(call);
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
            call.resolve(result);
            return;
        }
        if (expiresAt <= System.currentTimeMillis()) {
            JSObject result = new JSObject();
            result.put("started", false);
            result.put("reason", "expired");
            call.resolve(result);
            return;
        }

        Intent intent = new Intent(getContext(), HandoffLocationForegroundService.class);
        intent.setAction(HandoffLocationForegroundService.ACTION_START);
        intent.putExtra(HandoffLocationForegroundService.EXTRA_CLAIM_ID, claimId.toLowerCase());
        intent.putExtra(HandoffLocationForegroundService.EXTRA_EXPIRES_AT, expiresAt.longValue());
        intent.putExtra(HandoffLocationForegroundService.EXTRA_ACCESS_TOKEN, accessToken);
        intent.putExtra(HandoffLocationForegroundService.EXTRA_SUPABASE_URL, supabaseUrl);
        intent.putExtra(HandoffLocationForegroundService.EXTRA_PUBLISHABLE_KEY, publishableKey);
        intent.putExtra(HandoffLocationForegroundService.EXTRA_EDGE_URL, edgeFunctionUrl);

        HandoffLocationForegroundService.setPlugin(this);
        ContextCompat.startForegroundService(getContext(), intent);

        JSObject result = new JSObject();
        result.put("started", true);
        call.resolve(result);
    }

    @PluginMethod
    public void stopHandoffTracking(PluginCall call) {
        Intent intent = new Intent(getContext(), HandoffLocationForegroundService.class);
        intent.setAction(HandoffLocationForegroundService.ACTION_STOP);
        intent.putExtra(
            HandoffLocationForegroundService.EXTRA_STOP_REASON,
            call.getString("reason", "stop")
        );
        getContext().startService(intent);
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
