import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("handoff live-location pipeline contracts", () => {
  const root = process.cwd();

  it("sender and receiver share getClaimLocationTopic", () => {
    const publisher = readFileSync(
      resolve(root, "src/lib/location/use-publisher-live-location.ts"),
      "utf8",
    );
    const seeker = readFileSync(
      resolve(root, "src/lib/location/use-seeker-live-location-share.ts"),
      "utf8",
    );
    const native = readFileSync(
      resolve(root, "src/lib/location/handoff-native-broadcast.ts"),
      "utf8",
    );
    const edge = readFileSync(
      resolve(root, "supabase/functions/handoff-seeker-location/index.ts"),
      "utf8",
    );

    expect(publisher).toContain("getClaimLocationTopic");
    expect(seeker).toContain("getClaimLocationTopic");
    expect(native).toContain("getClaimLocationTopic");
    expect(edge).toContain("getClaimLocationTopic");
    expect(edge).toContain("../_shared/claim-location-topic.ts");
  });

  it("Edge Function authorizes the seeker JWT then broadcasts via realtime.send", () => {
    const edge = readFileSync(
      resolve(root, "supabase/functions/handoff-seeker-location/index.ts"),
      "utf8",
    );
    const broadcast = readFileSync(
      resolve(root, "supabase/functions/_shared/broadcast-claim-location.ts"),
      "utf8",
    );
    expect(edge).toContain("can_send_claim_location");
    expect(edge).toContain("getUser");
    expect(edge).toContain("broadcastPrivateClaimLocation");
    expect(broadcast).toContain("realtime.send");
    expect(broadcast).toContain("/rest/v1/rpc/broadcast_claim_location");
    expect(broadcast).toContain("p_payload");
    expect(broadcast).toContain("p_topic");
    expect(broadcast).not.toContain("/rest/v1/rpc/send");
    expect(broadcast).not.toContain("Content-Profile");
    expect(broadcast).not.toContain("/realtime/v1/api/broadcast");
    expect(edge).not.toContain("/realtime/v1/api/broadcast");
    expect(edge).toContain("public.broadcast_claim_location");
  });

  it("stores at most one latest snapshot row per claim (no history trail)", () => {
    const migration = readFileSync(
      resolve(
        root,
        "supabase/migrations/20260817140000_claim_live_locations_snapshot.sql",
      ),
      "utf8",
    );
    const publisher = readFileSync(
      resolve(root, "src/lib/location/use-publisher-live-location.ts"),
      "utf8",
    );
    const edge = readFileSync(
      resolve(root, "supabase/functions/handoff-seeker-location/index.ts"),
      "utf8",
    );
    expect(migration).toContain("claim_id uuid primary key");
    expect(migration).toContain("on conflict (claim_id) do update");
    expect(publisher).toContain("fetchLatestClaimLiveLocation");
    expect(edge).toContain("upsert_claim_live_location");
    expect(edge).not.toContain("insert into public.claim_live_location_history");
  });

  it("web seeker posts via Edge Function instead of client Broadcast", () => {
    const seeker = readFileSync(
      resolve(root, "src/lib/location/use-seeker-live-location-share.ts"),
      "utf8",
    );
    const publish = readFileSync(
      resolve(root, "src/lib/location/publish-seeker-live-location.ts"),
      "utf8",
    );
    expect(seeker).toContain("publishSeekerLiveLocationViaEdge");
    expect(seeker).not.toContain('type: "broadcast"');
    expect(publish).toContain("handoffSeekerLocationEdgeFunctionUrl");
  });

  it("web client sends the same headers as native Android POST", () => {
    const publish = readFileSync(
      resolve(root, "src/lib/location/publish-seeker-live-location.ts"),
      "utf8",
    );
    const android = readFileSync(
      resolve(
        root,
        "native/handoff-background-location/android/src/main/java/il/ac/runi/switchit/handoff/HandoffLocationForegroundService.java",
      ),
      "utf8",
    );
    expect(publish).toContain('Authorization: `Bearer ${input.accessToken}`');
    expect(publish).toContain("apikey: config.publishableKey");
    expect(publish).toContain('"Content-Type": "application/json"');
    expect(android).toContain('"Authorization", "Bearer " + token');
    expect(android).toContain('"apikey", key');
    expect(android).toContain('"Content-Type", "application/json"');
  });

  it("native tracker stop is owned by one coordinator", () => {
    const share = readFileSync(
      resolve(root, "src/lib/location/use-seeker-live-location-share.ts"),
      "utf8",
    );
    const panel = readFileSync(
      resolve(root, "src/components/map/ActiveClaimPanel.tsx"),
      "utf8",
    );
    expect(share).toContain("if (manageNativeTracker)");
    expect(share).toContain('stopHandoffTracking("terminal")');
    expect(panel).toContain("manageNativeTracker: !liveShareOverride");
  });

  it("iOS omits missing heading and logs native post status", () => {
    const swift = readFileSync(
      resolve(
        root,
        "native/handoff-background-location/ios/Sources/HandoffBackgroundLocationPlugin/HandoffBackgroundLocationPlugin.swift",
      ),
      "utf8",
    );
    expect(swift).toContain("didUpdateLocations raw");
    expect(swift).toContain("locationManager didFail");
    expect(swift).toContain("kCLErrorLocationUnknown");
    expect(swift).toContain("location temporarily unavailable");
    expect(swift).toContain("CLLocationManager created");
    expect(swift).toContain("startUpdatingLocation calling");
    expect(swift).toContain("startUpdatingLocation returned");
    expect(swift).toContain("alreadyRunning=true");
    expect(swift).toContain("native post attempt");
    expect(swift).toContain("native post status=");
    expect(swift).toContain("appState=");
    expect(swift).toContain('emitUiState("sharing")');
    expect(swift).toContain('emitUiState("waiting")');
    expect(swift).toContain("markSharingOnSuccess");
    expect(swift).not.toContain('payload["headingDegrees"] = NSNull()');
    expect(swift).toContain("runOnMainSync");
    expect(swift).not.toMatch(
      /emitUiState\("sharing"\)[\s\S]{0,120}postEvent/,
    );
    expect(swift).not.toMatch(
      /locationUnknown[\s\S]{0,200}stop\(reason:/,
    );
  });

  it("native duplicate same-claim start is idempotent", () => {
    const swift = readFileSync(
      resolve(
        root,
        "native/handoff-background-location/ios/Sources/HandoffBackgroundLocationPlugin/HandoffBackgroundLocationPlugin.swift",
      ),
      "utf8",
    );
    expect(swift).toContain('return "already_running"');
    expect(swift).toContain("action=noop_no_manager_reset");
    expect(swift).toContain('"alreadyRunning": true');
    expect(swift).toContain("private var manager: CLLocationManager?");
  });

  it("native sharing starts from the claim session, not a navigation button", () => {
    const experience = readFileSync(
      resolve(root, "src/components/map/SeekerMapExperience.tsx"),
      "utf8",
    );
    const panel = readFileSync(
      resolve(root, "src/components/map/ActiveClaimPanel.tsx"),
      "utf8",
    );
    const nav = readFileSync(
      resolve(root, "src/components/map/ClaimNavigationActions.tsx"),
      "utf8",
    );
    expect(experience).toContain("void startSharing()");
    expect(panel).toContain("manageNativeTracker: !liveShareOverride");
    expect(nav).not.toContain("startSharing");
    expect(nav).not.toContain("startHandoffTracking");
  });

  it("native visibility changes do not stop the tracker", () => {
    const share = readFileSync(
      resolve(root, "src/lib/location/use-seeker-live-location-share.ts"),
      "utf8",
    );
    expect(share).toContain("if (getHandoffLocationService().isNative)");
    expect(share).toContain("does not pause when hidden");
  });

  it("publisher and Edge Function share exact claim-location topic helper", () => {
    const publisherTopic = readFileSync(
      resolve(root, "src/lib/location/topic.ts"),
      "utf8",
    );
    const edgeTopic = readFileSync(
      resolve(root, "supabase/functions/_shared/claim-location-topic.ts"),
      "utf8",
    );
    expect(publisherTopic).toContain('CLAIM_LOCATION_TOPIC_PREFIX');
    expect(edgeTopic).toContain('claim-location:');
    expect(publisherTopic).toContain("getClaimLocationTopic");
    expect(edgeTopic).toContain("getClaimLocationTopic");
  });

  it("terminal claim stop ends native sharing", () => {
    const share = readFileSync(
      resolve(root, "src/lib/location/use-seeker-live-location-share.ts"),
      "utf8",
    );
    expect(share).toContain('stopHandoffTracking("terminal")');
    expect(share).toContain("forceStop");
  });

  it("accepted GPS posts include claimId and log non-2xx status", () => {
    const swift = readFileSync(
      resolve(
        root,
        "native/handoff-background-location/ios/Sources/HandoffBackgroundLocationPlugin/HandoffBackgroundLocationPlugin.swift",
      ),
      "utf8",
    );
    const android = readFileSync(
      resolve(
        root,
        "native/handoff-background-location/android/src/main/java/il/ac/runi/switchit/handoff/HandoffLocationForegroundService.java",
      ),
      "utf8",
    );
    expect(swift).toContain("gps accepted");
    expect(swift).toContain("gps rejected");
    expect(swift).toContain("native post status=");
    expect(android).toContain("android POST started");
    expect(android).toContain("android POST status=");
    expect(android).toContain("android location accepted");
  });

  it("Android FGS survives leaving Switch It for Waze (stopWithTask false)", () => {
    const manifest = readFileSync(
      resolve(
        root,
        "native/handoff-background-location/android/src/main/AndroidManifest.xml",
      ),
      "utf8",
    );
    expect(manifest).toContain('android:foregroundServiceType="location"');
    expect(manifest).toContain('android:stopWithTask="false"');
    expect(manifest).not.toContain('android:stopWithTask="true"');
    expect(manifest).toContain("FOREGROUND_SERVICE_LOCATION");
    expect(manifest).not.toContain(
      'android.permission.ACCESS_BACKGROUND_LOCATION',
    );
  });

  it("starts live location before opening external navigation on Android", () => {
    const provider = readFileSync(
      resolve(root, "src/components/map/PostClaimNavigationProvider.tsx"),
      "utf8",
    );
    const startIdx = provider.indexOf("requestSeekerLiveLocationStart()");
    const openIdx = provider.indexOf("openExternalNavigationUrl(url)");
    expect(startIdx).toBeGreaterThan(-1);
    expect(openIdx).toBeGreaterThan(-1);
    expect(startIdx).toBeLessThan(openIdx);
  });

  it("publisher map uses Recenter, not Follow", () => {
    const map = readFileSync(
      resolve(root, "src/components/spots/PublisherLiveProgressMap.tsx"),
      "utf8",
    );
    const sources = readFileSync(
      resolve(root, "src/lib/map/publisher-live-map-sources.ts"),
      "utf8",
    );
    expect(map).toContain("Recenter");
    expect(map).toContain("CurrentLocationControl");
    expect(map).not.toContain(">Follow<");
    expect(sources).toContain("SEEKER_MARKER_IMAGE_IDS.seekerLive");
  });
});
