import { describe, expect, it } from "vitest";

import type { PublisherSpotSummary } from "@/components/spots/PublisherSpotCard";
import {
  mergePublisherSpotFromServer,
  publisherClaimHintFromPayload,
} from "@/lib/realtime/publisher-spot-sync";

const spot: PublisherSpotSummary = {
  id: "a0a29c9b-3257-4702-aa68-5edeaabe076c",
  status: "available",
  available_at: "2026-08-17T09:00:00.000Z",
  expires_at: "2026-08-17T09:30:00.000Z",
  address: "Test St",
  latitude: 32.1,
  longitude: 34.8,
};

describe("publisherClaimHintFromPayload", () => {
  it("detects parking_spots UPDATE to claimed", () => {
    const hint = publisherClaimHintFromPayload(
      {
        table: "parking_spots",
        eventType: "UPDATE",
        new: { id: spot.id, status: "claimed" },
        old: { id: spot.id, status: "available" },
      } as never,
      spot.id,
    );
    expect(hint).toEqual({
      spotId: spot.id,
      claimId: null,
      source: "spot-update",
    });
  });

  it("detects claims INSERT active for the spot", () => {
    const claimId = "7c611153-191e-430b-940e-ba25e5399571";
    const hint = publisherClaimHintFromPayload(
      {
        table: "claims",
        eventType: "INSERT",
        new: { id: claimId, spot_id: spot.id, status: "active" },
        old: {},
      } as never,
      spot.id,
    );
    expect(hint).toEqual({
      spotId: spot.id,
      claimId,
      source: "claim-insert",
    });
  });

  it("ignores claims on other spots", () => {
    const hint = publisherClaimHintFromPayload(
      {
        table: "claims",
        eventType: "INSERT",
        new: {
          id: "7c611153-191e-430b-940e-ba25e5399571",
          spot_id: "other-spot",
          status: "active",
        },
        old: {},
      } as never,
      spot.id,
    );
    expect(hint).toBeNull();
  });
});

describe("mergePublisherSpotFromServer", () => {
  const claimId = "7c611153-191e-430b-940e-ba25e5399571";

  it("trusts server when spot is already claimed", () => {
    const claimedSpot = { ...spot, status: "claimed" as const };
    const merged = mergePublisherSpotFromServer(claimedSpot, claimId, null);
    expect(merged.spot.status).toBe("claimed");
    expect(merged.activeClaimId).toBe(claimId);
  });

  it("optimistically transitions waiting UI when Realtime hint arrives first", () => {
    const merged = mergePublisherSpotFromServer(spot, null, {
      spotId: spot.id,
      claimId,
      source: "claim-insert",
    });
    expect(merged.spot.status).toBe("claimed");
    expect(merged.activeClaimId).toBe(claimId);
  });

  it("does not let stale available server props overwrite a claim hint", () => {
    const merged = mergePublisherSpotFromServer(spot, null, {
      spotId: spot.id,
      claimId: null,
      source: "spot-update",
    });
    expect(merged.spot.status).toBe("claimed");
    expect(merged.activeClaimId).toBeNull();
  });

  it("clears hint path once server claim id is present on claimed spot", () => {
    const claimedSpot = { ...spot, status: "claimed" as const };
    const merged = mergePublisherSpotFromServer(claimedSpot, claimId, {
      spotId: spot.id,
      claimId: "stale-hint",
      source: "claim-insert",
    });
    expect(merged.activeClaimId).toBe(claimId);
  });
});
