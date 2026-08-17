"use client";

import { stopHandoffTrackingBestEffort } from "@/lib/location/handoff-location-service";
import { disableCurrentPushDevice } from "@/lib/push/register-device";
import { isNativePushEnabledForPlatform } from "@/lib/push/is-native-push-platform";

/** Call from logout forms before the server action runs. */
export function onLogoutSubmit(): void {
  void stopHandoffTrackingBestEffort("logout");
  if (isNativePushEnabledForPlatform()) {
    void disableCurrentPushDevice();
  }
}
