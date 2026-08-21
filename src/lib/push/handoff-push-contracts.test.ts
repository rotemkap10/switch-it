import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("native handoff push contracts", () => {
  const root = process.cwd();

  it("does not show a foreground iOS alert so Realtime remains primary", () => {
    const config = readFileSync(resolve(root, "capacitor.config.ts"), "utf8");
    expect(config).toContain('presentationOptions: ["badge", "sound"]');
    expect(config).not.toContain('"alert"');
  });

  it("does not require APNs entitlements in the current Personal Team iOS build", () => {
    const entitlements = readFileSync(
      resolve(root, "ios/App/App/App.entitlements"),
      "utf8",
    );
    expect(entitlements).not.toContain("<key>aps-environment</key>");
    const info = readFileSync(resolve(root, "ios/App/App/Info.plist"), "utf8");
    expect(info).not.toContain("remote-notification");
    const gate = readFileSync(
      resolve(root, "src/lib/push/is-native-push-platform.ts"),
      "utf8",
    );
    expect(gate).toContain("export const IOS_APNS_PUSH_ENABLED = false");
  });

  it("keeps Android FCM dormant without google-services.json", () => {
    const gate = readFileSync(
      resolve(root, "src/lib/push/is-native-push-platform.ts"),
      "utf8",
    );
    expect(gate).toContain("export const ANDROID_FCM_PUSH_ENABLED = false");
    expect(existsSync(resolve(root, "android/app/google-services.json"))).toBe(
      false,
    );
    const appGradle = readFileSync(
      resolve(root, "android/app/build.gradle"),
      "utf8",
    );
    expect(appGradle).toContain("google-services.json not found");
  });

  it("does not request push permission from AppDelegate launch", () => {
    const delegate = readFileSync(
      resolve(root, "ios/App/App/AppDelegate.swift"),
      "utf8",
    );
    expect(delegate).toContain("didRegisterForRemoteNotificationsWithDeviceToken");
    expect(delegate).not.toContain("requestAuthorization");
    expect(delegate).not.toContain("registerForRemoteNotifications()");
  });

  it("uses APNs on iOS and FCM HTTP v1 on Android", () => {
    const providers = readFileSync(
      resolve(root, "supabase/functions/_shared/push-providers.ts"),
      "utf8",
    );
    expect(providers).toContain("api.push.apple.com");
    expect(providers).toContain("fcm.googleapis.com/v1/projects");
    expect(providers).not.toContain("fcm.googleapis.com/fcm/send");
  });

  it("keeps live coordinates out of push data", () => {
    const send = readFileSync(
      resolve(root, "supabase/functions/send-handoff-push/index.ts"),
      "utf8",
    );
    expect(send).toContain("claimId");
    expect(send).toContain("recipientRole");
    expect(send).not.toContain("latitude");
    expect(send).not.toContain("longitude");
  });

  it("claims pending events atomically and disables only invalid device tokens", () => {
    const send = readFileSync(
      resolve(root, "supabase/functions/send-handoff-push/index.ts"),
      "utf8",
    );
    expect(send).toContain('.eq("status", "pending")');
    expect(send).toContain("invalidToken");
    expect(send).toContain("enabled: false");
    expect(send).toContain('.eq("id", device.id)');
    expect(send).toContain("invalid token disabled");
  });

  it("nearby push is one-shot via enqueue RPC from the live-location function", () => {
    const edge = readFileSync(
      resolve(root, "supabase/functions/handoff-seeker-location/index.ts"),
      "utf8",
    );
    expect(edge).toContain("driver_nearby");
    expect(edge).toContain("enqueue_handoff_notification");
    expect(edge).toContain("DRIVER_NEARBY_PUSH_METERS");
  });

  it("does not modify native Core Location lifecycle for this feature", () => {
    const swift = readFileSync(
      resolve(
        root,
        "native/handoff-background-location/ios/Sources/HandoffBackgroundLocationPlugin/HandoffBackgroundLocationPlugin.swift",
      ),
      "utf8",
    );
    expect(swift).toContain("installManagerIfNeeded");
    expect(swift).toContain("didUpdateLocations raw");
  });
});
