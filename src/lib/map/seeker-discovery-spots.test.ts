import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  applyParkingSpotRealtimeEvent,
  isSeekerVisibleParkingSpot,
  mergeServerDiscoverySpots,
  tombstoneDiscoverySpot,
} from "@/lib/map/seeker-discovery-spots";
import type { MapSpot } from "@/types/map-spot";

const userId = "seeker-1";
const now = Date.parse("2026-08-16T12:00:00.000Z");

const availableSpot: MapSpot = {
  id: "spot-a",
  latitude: 32.1,
  longitude: 34.8,
  address: "A",
  available_at: "2026-08-16T11:55:00.000Z",
  expires_at: "2026-08-16T12:30:00.000Z",
  canClaim: true,
};

const otherSpot: MapSpot = {
  id: "spot-b",
  latitude: 32.2,
  longitude: 34.9,
  address: "B",
  available_at: "2026-08-16T11:55:00.000Z",
  expires_at: "2026-08-16T12:30:00.000Z",
  canClaim: true,
};

function payload(
  eventType: "INSERT" | "UPDATE" | "DELETE",
  row: Record<string, unknown> | null,
  old?: Record<string, unknown> | null,
): RealtimePostgresChangesPayload<Record<string, unknown>> {
  return {
    schema: "public",
    table: "parking_spots",
    commit_timestamp: "2026-08-16T12:00:00.000Z",
    eventType,
    new: row ?? {},
    old: old ?? {},
    errors: null,
  } as RealtimePostgresChangesPayload<Record<string, unknown>>;
}

function availableRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "spot-a",
    status: "available",
    latitude: 32.1,
    longitude: 34.8,
    address: "A",
    available_at: "2026-08-16T11:55:00.000Z",
    expires_at: "2026-08-16T12:30:00.000Z",
    owner_id: "owner-1",
    ...overrides,
  };
}

describe("seeker discovery realtime reconciliation", () => {
  it("INSERT of available spot appears immediately", () => {
    const result = applyParkingSpotRealtimeEvent(
      [],
      new Map(),
      payload("INSERT", availableRow()),
      userId,
      now,
    );
    expect(result.action).toBe("upsert");
    expect(result.spots).toHaveLength(1);
    expect(result.spots[0]?.id).toBe("spot-a");
    expect(result.spots[0]?.canClaim).toBe(true);
  });

  it("available → cancelled UPDATE removes spot immediately", () => {
    const result = applyParkingSpotRealtimeEvent(
      [availableSpot, otherSpot],
      new Map(),
      payload("UPDATE", availableRow({ status: "cancelled" })),
      userId,
      now,
    );
    expect(result.action).toBe("remove");
    expect(result.spots.map((s) => s.id)).toEqual(["spot-b"]);
    expect(result.tombstones.has("spot-a")).toBe(true);
  });

  it("available → claimed UPDATE removes spot for other seekers", () => {
    const result = applyParkingSpotRealtimeEvent(
      [availableSpot],
      new Map(),
      payload("UPDATE", availableRow({ status: "claimed" })),
      userId,
      now,
    );
    expect(result.action).toBe("remove");
    expect(result.spots).toEqual([]);
  });

  it("available → expired removes spot", () => {
    const result = applyParkingSpotRealtimeEvent(
      [availableSpot],
      new Map(),
      payload("UPDATE", availableRow({ status: "expired" })),
      userId,
      now,
    );
    expect(result.action).toBe("remove");
    expect(result.spots).toEqual([]);
  });

  it("DELETE removes spot", () => {
    const result = applyParkingSpotRealtimeEvent(
      [availableSpot],
      new Map(),
      payload("DELETE", null, { id: "spot-a" }),
      userId,
      now,
    );
    expect(result.action).toBe("remove");
    expect(result.spots).toEqual([]);
  });

  it("UPDATE-to-available upserts correctly", () => {
    const result = applyParkingSpotRealtimeEvent(
      [],
      new Map([["spot-a", now]]),
      payload("UPDATE", availableRow()),
      userId,
      now,
    );
    expect(result.action).toBe("upsert");
    expect(result.spots).toHaveLength(1);
    expect(result.tombstones.has("spot-a")).toBe(false);
  });

  it("repeated realtime upsert does not duplicate markers", () => {
    const first = applyParkingSpotRealtimeEvent(
      [],
      new Map(),
      payload("INSERT", availableRow()),
      userId,
      now,
    );
    const second = applyParkingSpotRealtimeEvent(
      first.spots,
      first.tombstones,
      payload("UPDATE", availableRow({ address: "A2" })),
      userId,
      now,
    );
    expect(second.spots).toHaveLength(1);
    expect(second.spots[0]?.address).toBe("A2");
  });

  it("cancelled spot cannot be resurrected by stale initial fetch", () => {
    const afterCancel = applyParkingSpotRealtimeEvent(
      [availableSpot, otherSpot],
      new Map(),
      payload("UPDATE", availableRow({ status: "cancelled" })),
      userId,
      now,
    );
    const merged = mergeServerDiscoverySpots(
      [availableSpot, otherSpot],
      afterCancel.tombstones,
      now,
    );
    expect(merged.spots.map((s) => s.id)).toEqual(["spot-b"]);
    expect(merged.tombstones.has("spot-a")).toBe(true);
  });

  it("unrelated spot updates do not disturb other markers", () => {
    const result = applyParkingSpotRealtimeEvent(
      [availableSpot, otherSpot],
      new Map(),
      payload("UPDATE", availableRow({ id: "spot-a", address: "Moved" })),
      userId,
      now,
    );
    expect(result.spots).toHaveLength(2);
    expect(result.spots.find((s) => s.id === "spot-b")).toEqual(otherSpot);
    expect(result.spots.find((s) => s.id === "spot-a")?.address).toBe("Moved");
  });

  it("failed claim tombstone removes stale marker", () => {
    const result = tombstoneDiscoverySpot(
      [availableSpot, otherSpot],
      new Map(),
      "spot-a",
      now,
    );
    expect(result.action).toBe("remove");
    expect(result.spots.map((s) => s.id)).toEqual(["spot-b"]);
  });

  it("own available spot is visible but not claimable", () => {
    expect(isSeekerVisibleParkingSpot(availableRow(), now)).toBe(true);
    const result = applyParkingSpotRealtimeEvent(
      [],
      new Map(),
      payload("INSERT", availableRow({ owner_id: userId })),
      userId,
      now,
    );
    expect(result.spots[0]?.canClaim).toBe(false);
  });

  it("clears tombstone once server confirms the spot is gone", () => {
    const tombstones = new Map([["spot-a", now]]);
    const merged = mergeServerDiscoverySpots([otherSpot], tombstones, now);
    expect(merged.tombstones.has("spot-a")).toBe(false);
    expect(merged.spots.map((s) => s.id)).toEqual(["spot-b"]);
  });
});
