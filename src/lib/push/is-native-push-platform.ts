import { Capacitor } from "@capacitor/core";

/**
 * iOS APNs push is prepared in the repo but OFF for free Personal Team builds.
 *
 * Personal Team cannot provision the Push Notifications capability /
 * `aps-environment` entitlement. Keep this `false` until Switch It is enrolled
 * in the paid Apple Developer Program.
 *
 * Future iOS activation (no architecture change):
 * 1. Enable Push Notifications on App ID `il.ac.runi.switchit`
 * 2. Restore `aps-environment` in `ios/App/App/App.entitlements`
 *    (development for Xcode; production for TestFlight/App Store)
 * 3. Restore `remote-notification` in `ios/App/App/Info.plist` UIBackgroundModes
 *    (keep `location`)
 * 4. Configure APNs key/secrets (`APNS_KEY_ID`, `APNS_TEAM_ID`,
 *    `APNS_BUNDLE_ID`, `APNS_PRIVATE_KEY`, `APNS_PRODUCTION`)
 * 5. Set `IOS_APNS_PUSH_ENABLED` to `true` in this file
 * 6. `npx cap sync ios`
 * 7. Xcode Run on a physical device
 */
export const IOS_APNS_PUSH_ENABLED = false;

/** Native iOS/Android only. Web/PWA never register push in this task. */
export function isNativePushPlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function nativePushPlatform(): "ios" | "android" | null {
  if (!isNativePushPlatform()) {
    return null;
  }
  const id = Capacitor.getPlatform();
  if (id === "ios" || id === "android") {
    return id;
  }
  return null;
}

/**
 * Whether this install should request permission, register a token, or show
 * handoff push UI. Android FCM is enabled (needs google-services.json at runtime).
 * iOS APNs stays dormant until `IOS_APNS_PUSH_ENABLED` is flipped after paid
 * Apple Developer Program enrollment.
 */
export function isNativePushEnabledForPlatform(): boolean {
  const platform = nativePushPlatform();
  if (platform === "android") {
    return true;
  }
  if (platform === "ios") {
    return IOS_APNS_PUSH_ENABLED;
  }
  return false;
}
