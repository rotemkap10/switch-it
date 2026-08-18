import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("claim live location snapshot pipeline contracts", () => {
  const root = process.cwd();

  it("Edge Function upserts snapshot before broadcast for seeker-location", () => {
    const edge = readFileSync(
      resolve(root, "supabase/functions/handoff-seeker-location/index.ts"),
      "utf8",
    );
    const upsertIndex = edge.indexOf("snapshot upsert attempted");
    const broadcastIndex = edge.indexOf("broadcast attempted");
    expect(upsertIndex).toBeGreaterThan(-1);
    expect(broadcastIndex).toBeGreaterThan(upsertIndex);
    expect(edge).toContain("upsert_claim_live_location");
    expect(edge).toContain("snapshot upsert succeeded");
  });

  it("publisher subscribes then fetches latest snapshot on SUBSCRIBED", () => {
    const publisher = readFileSync(
      resolve(root, "src/lib/location/use-publisher-live-location.ts"),
      "utf8",
    );
    const subscribeIndex = publisher.indexOf("publisher channel subscribing");
    const fetchIndex = publisher.indexOf("reconcileLatestSnapshot");
    const subscribedIndex = publisher.indexOf("publisher channel subscribed");
    expect(subscribeIndex).toBeGreaterThan(-1);
    expect(subscribedIndex).toBeGreaterThan(subscribeIndex);
    expect(fetchIndex).toBeGreaterThan(-1);
    expect(publisher).toContain('reason = hadSubscribedRef.current ? "reconnect" : "initial"');
    expect(publisher).toContain("fetchLatestClaimLiveLocation");
  });

  it("uses shared sequence/timestamp ordering for broadcast vs snapshot", () => {
    const publisher = readFileSync(
      resolve(root, "src/lib/location/use-publisher-live-location.ts"),
      "utf8",
    );
    const ordering = readFileSync(
      resolve(root, "src/lib/location/location-ordering.ts"),
      "utf8",
    );
    expect(publisher).toContain("isNewerSeekerLocation");
    expect(ordering).toContain("isNewerSeekerLocation");
    expect(publisher).toContain("snapshot ignored stale");
  });

  it("reconciles snapshot on reconnect, visibility restore, and network online", () => {
    const publisher = readFileSync(
      resolve(root, "src/lib/location/use-publisher-live-location.ts"),
      "utf8",
    );
    expect(publisher).toContain('"visibility restore"');
    expect(publisher).toContain('"network online"');
    expect(publisher).toContain('"reconnect"');
  });

  it("stores no location history trail — one row per claim only", () => {
    const migration = readFileSync(
      resolve(
        root,
        "supabase/migrations/20260817140000_claim_live_locations_snapshot.sql",
      ),
      "utf8",
    );
    expect(migration).toContain("claim_id uuid primary key");
    expect(migration).toContain("on conflict (claim_id) do update");
    expect(migration).not.toContain("create table public.claim_live_location_history");
  });

  it("native iOS GPS lifecycle remains unchanged", () => {
    const swift = readFileSync(
      resolve(
        root,
        "native/handoff-background-location/ios/Sources/HandoffBackgroundLocationPlugin/HandoffBackgroundLocationPlugin.swift",
      ),
      "utf8",
    );
    expect(swift).toContain("installManagerIfNeeded");
    expect(swift).toContain("runOnMainSync");
    expect(swift).toContain("didUpdateLocations raw");
    expect(swift).not.toContain("claim_live_locations");
  });

  it("publisher map keeps Recenter interaction contract", () => {
    const map = readFileSync(
      resolve(root, "src/components/spots/PublisherLiveProgressMap.tsx"),
      "utf8",
    );
    expect(map).toContain("Recenter");
    expect(map).toContain("CurrentLocationControl");
    expect(map).not.toContain(">Follow<");
  });
});
