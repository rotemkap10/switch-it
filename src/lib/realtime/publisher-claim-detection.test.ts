import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("publisher claim detection contracts", () => {
  const root = process.cwd();

  it("claim_spot sets parking_spots.status to claimed", () => {
    const sql = readFileSync(
      resolve(root, "supabase/migrations/20260802120400_claim_spot.sql"),
      "utf8",
    );
    expect(sql).toContain("status = 'claimed'");
    expect(sql).toContain("insert into public.claims");
    expect(sql).toContain("'active'");
  });

  it("publisher can SELECT own parking_spots regardless of status", () => {
    const sql = readFileSync(
      resolve(
        root,
        "supabase/migrations/20260816200000_parking_spots_realtime_terminal_select_grace.sql",
      ),
      "utf8",
    );
    expect(sql).toContain("owner_id = (select auth.uid())");
  });

  it("publisher can SELECT claims on spots they own", () => {
    const sql = readFileSync(
      resolve(root, "supabase/migrations/20260802111257_auth_profile_and_rls.sql"),
      "utf8",
    );
    expect(sql).toContain("claims_select_seeker_or_owner");
    expect(sql).toContain("spots.owner_id = (select auth.uid())");
  });

  it("claims select policy does not grant unrelated users visibility", () => {
    const sql = readFileSync(
      resolve(root, "supabase/migrations/20260802111257_auth_profile_and_rls.sql"),
      "utf8",
    );
    expect(sql).toContain("seeker_id = (select auth.uid())");
    expect(sql).not.toMatch(
      /create policy claims_select_seeker_or_owner[\s\S]*using \(true\)/,
    );
  });

  it("parking_spots and claims are in supabase_realtime publication", () => {
    const sql = readFileSync(
      resolve(
        root,
        "supabase/migrations/20260805220000_realtime_publication_spots_claims.sql",
      ),
      "utf8",
    );
    expect(sql).toContain("add table public.parking_spots");
    expect(sql).toContain("add table public.claims");
  });

  it("publisher waiting uses spot-scoped claims subscription before claim id is known", () => {
    const sync = readFileSync(
      resolve(root, "src/components/spots/PublisherRealtimeSync.tsx"),
      "utf8",
    );
    expect(sync).toContain("publisher-spot-claims:");
    expect(sync).toContain("filter: `spot_id=eq.${spotId}`");
    expect(sync).toContain("!claimId");
  });

  it("publisher claim realtime logging uses dedicated prefix", () => {
    const sync = readFileSync(
      resolve(root, "src/components/spots/PublisherRealtimeSync.tsx"),
      "utf8",
    );
    expect(sync).toContain("logClaimRealtime");
    const logger = readFileSync(
      resolve(root, "src/lib/realtime/log-claim-realtime.ts"),
      "utf8",
    );
    expect(logger).toContain("[switch-it:claim-realtime]");
  });

  it("publisher spot experience merges stale RSC with realtime claim hints", () => {
    const experience = readFileSync(
      resolve(root, "src/components/spots/PublisherSpotExperience.tsx"),
      "utf8",
    );
    expect(experience).toContain("mergePublisherSpotFromServer");
    expect(experience).toContain("onClaimHint");
  });

  it("publisher reconciles while an open spot exists (waiting or claimed)", () => {
    const sync = readFileSync(
      resolve(root, "src/components/spots/PublisherRealtimeSync.tsx"),
      "utf8",
    );
    expect(sync).toContain("useActiveHandoffReconciliation(Boolean(userId && spotId))");
  });

  it("publisher live location mounts from claimed spot card without extra user action", () => {
    const card = readFileSync(
      resolve(root, "src/components/spots/PublisherSpotCard.tsx"),
      "utf8",
    );
    expect(card).toContain("usePublisherLiveLocation");
    expect(card).toContain("enabled: claimed && !!activeClaimId");
    expect(card).toContain("publisher-claimed-map-priority");
  });

  it("native iPhone GPS lifecycle files are unchanged by publisher claim detection", () => {
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
    expect(swift).toContain("native post status=");
  });
});
