import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { isNativeHandoffPlatform } from "@/lib/location/is-native-handoff-platform";
import { getHandoffLocationService } from "@/lib/location/handoff-location-service";

describe("web live-location runtime selection", () => {
  const root = process.cwd();

  it("selects navigator.geolocation on web, not native provider", () => {
    const share = readFileSync(
      resolve(root, "src/lib/location/use-seeker-live-location-share.ts"),
      "utf8",
    );
    expect(share).toContain("navigator.geolocation.watchPosition");
    expect(share).toContain("publishSeekerLiveLocationViaEdge");
    expect(share).not.toContain("broadcast: { self: false, ack: true }");
  });

  it("uses Capacitor isNativePlatform only inside native shell detection", () => {
    const nativeDetect = readFileSync(
      resolve(root, "src/lib/location/is-native-handoff-platform.ts"),
      "utf8",
    );
    expect(nativeDetect).toContain("isNativePlatform");
    expect(isNativeHandoffPlatform()).toBe(false);
    expect(getHandoffLocationService().isNative).toBe(false);
  });

  it("keeps native Android foreground service path unchanged", () => {
    const service = readFileSync(
      resolve(root, "src/lib/location/handoff-location-service.ts"),
      "utf8",
    );
    const manifest = readFileSync(
      resolve(
        root,
        "native/handoff-background-location/android/src/main/AndroidManifest.xml",
      ),
      "utf8",
    );
    expect(service).toContain("isNativeHandoffPlatform()");
    expect(service).toContain("startHandoffTracking");
    expect(manifest).toContain('android:stopWithTask="false"');
  });

  it("uses the same edge function transport for web and native posts", () => {
    const publish = readFileSync(
      resolve(root, "src/lib/location/publish-seeker-live-location.ts"),
      "utf8",
    );
    const native = readFileSync(
      resolve(root, "src/lib/location/handoff-native-broadcast.ts"),
      "utf8",
    );
    expect(publish).toContain("handoffSeekerLocationEdgeFunctionUrl");
    expect(native).toContain("handoff-seeker-location");
  });
});
