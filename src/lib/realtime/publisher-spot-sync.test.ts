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
  handoff_started_at: null,
  handoff_extension_used_at: null,
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
      promoteToClaimed: true,
      handoffStartedAt: null,
      expiresAt: null,
      extensionUsedAt: null,
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
      promoteToClaimed: true,
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

  it("detects parking_spots UPDATE back to available after a pre-start release", () => {
    const hint = publisherClaimHintFromPayload(
      {
        table: "parking_spots",
        eventType: "UPDATE",
        new: {
          id: spot.id,
          status: "available",
          expires_at: spot.available_at,
          handoff_started_at: null,
        },
        old: { id: spot.id, status: "claimed" },
      } as never,
      spot.id,
    );
    expect(hint).toEqual({
      spotId: spot.id,
      claimId: null,
      source: "spot-update",
      promoteToClaimed: false,
      handoffStartedAt: null,
      expiresAt: spot.available_at,
      extensionUsedAt: null,
    });
  });

  it("detects parking_spots UPDATE back to available after a post-start release", () => {
    const handoffStartedAt = "2026-08-17T09:01:00.000Z";
    const expiresAt = "2026-08-17T09:04:00.000Z";
    const hint = publisherClaimHintFromPayload(
      {
        table: "parking_spots",
        eventType: "UPDATE",
        new: {
          id: spot.id,
          status: "available",
          expires_at: expiresAt,
          handoff_started_at: handoffStartedAt,
        },
        old: { id: spot.id, status: "claimed" },
      } as never,
      spot.id,
    );
    expect(hint).toEqual({
      spotId: spot.id,
      claimId: null,
      source: "spot-update",
      promoteToClaimed: false,
      handoffStartedAt,
      expiresAt,
      extensionUsedAt: null,
    });
  });

  it("detects claim cancelled as a demote hint", () => {
    const claimId = "7c611153-191e-430b-940e-ba25e5399571";
    const hint = publisherClaimHintFromPayload(
      {
        table: "claims",
        eventType: "UPDATE",
        new: { id: claimId, spot_id: spot.id, status: "cancelled" },
        old: { id: claimId, spot_id: spot.id, status: "active" },
      } as never,
      spot.id,
    );
    expect(hint).toEqual({
      spotId: spot.id,
      claimId,
      source: "claim-update",
      promoteToClaimed: false,
    });
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

  it("applies I'm leaving now timestamps from Realtime while RSC is still stale", () => {
    const claimedSpot = {
      ...spot,
      status: "claimed" as const,
      handoff_started_at: null,
      expires_at: "2026-08-17T09:03:00.000Z",
    };
    const merged = mergePublisherSpotFromServer(claimedSpot, claimId, {
      spotId: spot.id,
      claimId,
      source: "spot-update",
      promoteToClaimed: true,
      handoffStartedAt: "2026-08-17T09:01:00.000Z",
      expiresAt: "2026-08-17T09:04:00.000Z",
    });
    expect(merged.spot.handoff_started_at).toBe("2026-08-17T09:01:00.000Z");
    expect(merged.spot.expires_at).toBe("2026-08-17T09:04:00.000Z");
    expect(merged.activeClaimId).toBe(claimId);
  });

  it("keeps waiting status when an available spot starts without a claim", () => {
    const merged = mergePublisherSpotFromServer(spot, null, {
      spotId: spot.id,
      claimId: null,
      source: "mutation",
      promoteToClaimed: false,
      handoffStartedAt: "2026-08-17T09:01:00.000Z",
      expiresAt: "2026-08-17T09:04:00.000Z",
    });
    expect(merged.spot.status).toBe("available");
    expect(merged.spot.handoff_started_at).toBe("2026-08-17T09:01:00.000Z");
    expect(merged.activeClaimId).toBeNull();
  });

  it("returns to waiting when the seeker releases before handoff start", () => {
    const claimedSpot = {
      ...spot,
      status: "claimed" as const,
      expires_at: "2026-08-17T09:03:00.000Z",
    };
    const merged = mergePublisherSpotFromServer(claimedSpot, claimId, {
      spotId: spot.id,
      claimId: null,
      source: "spot-update",
      promoteToClaimed: false,
      expiresAt: spot.available_at,
      handoffStartedAt: null,
    });
    expect(merged.spot.status).toBe("available");
    expect(merged.spot.expires_at).toBe(spot.available_at);
    expect(merged.spot.handoff_started_at).toBeNull();
    expect(merged.activeClaimId).toBeNull();
  });

  it("returns to waiting with preserved handoff timing after a post-start release", () => {
    const handoffStartedAt = "2026-08-17T09:01:00.000Z";
    const expiresAt = "2026-08-17T09:04:00.000Z";
    const claimedSpot = {
      ...spot,
      status: "claimed" as const,
      handoff_started_at: handoffStartedAt,
      expires_at: expiresAt,
    };
    const merged = mergePublisherSpotFromServer(claimedSpot, claimId, {
      spotId: spot.id,
      claimId: null,
      source: "spot-update",
      promoteToClaimed: false,
      handoffStartedAt,
      expiresAt,
    });
    expect(merged.spot.status).toBe("available");
    expect(merged.spot.handoff_started_at).toBe(handoffStartedAt);
    expect(merged.spot.expires_at).toBe(expiresAt);
    expect(merged.activeClaimId).toBeNull();
  });

  it("does not drop a later seeker C when B's cancelled hint arrives after C claimed", () => {
    const claimedSpot = { ...spot, status: "claimed" as const };
    const seekerC = "cccccccccccccccccccccccccccccccc";
    const merged = mergePublisherSpotFromServer(claimedSpot, seekerC, {
      spotId: spot.id,
      claimId,
      source: "claim-update",
      promoteToClaimed: false,
    });
    expect(merged.spot.status).toBe("claimed");
    expect(merged.activeClaimId).toBe(seekerC);
  });
});
