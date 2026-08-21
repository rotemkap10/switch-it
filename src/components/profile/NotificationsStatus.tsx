"use client";

import { useEffect, useState } from "react";

import {
  isNativePushEnabledForPlatform,
  isNativePushPlatform,
  nativePushPlatform,
} from "@/lib/push/is-native-push-platform";
import { checkNativePushPermission } from "@/lib/push/native-plugin";

function disabledPushLabel(platform: "ios" | "android" | null): string {
  if (platform === "android") {
    return "Android push disabled until FCM is configured";
  }
  if (platform === "ios") {
    return "Not available on this iOS build";
  }
  return "Not available on this build";
}

function disabledPushHelper(platform: "ios" | "android" | null): string {
  if (platform === "android") {
    return "Handoff alerts stay off until Firebase Cloud Messaging is configured for this Android build.";
  }
  if (platform === "ios") {
    return "Handoff alerts are not included in this iOS development build.";
  }
  return "Handoff alerts are not available on this build.";
}

export function NotificationsStatus() {
  const native = isNativePushPlatform();
  const enabled = isNativePushEnabledForPlatform();
  const platform = nativePushPlatform();
  const [label, setLabel] = useState(() => {
    if (!native) {
      return "Native app only";
    }
    if (!enabled) {
      return disabledPushLabel(platform);
    }
    return "Checking…";
  });

  useEffect(() => {
    if (!native || !enabled) {
      return;
    }
    void checkNativePushPermission().then((status) => {
      if (status === "granted") {
        setLabel("Enabled");
        return;
      }
      if (status === "denied") {
        setLabel("Disabled — enable in system Settings");
        return;
      }
      setLabel("Not enabled yet");
    });
  }, [enabled, native]);

  const helper =
    native && !enabled
      ? disabledPushHelper(platform)
      : "Handoff alerts use this device's system notification permission. Switch It cannot re-open the system prompt after a permanent denial.";

  return (
    <div data-testid="profile-notifications-status">
      <p className="text-sm font-medium text-foreground">Notifications</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
      <p className="mt-1 text-xs text-muted">{helper}</p>
    </div>
  );
}
