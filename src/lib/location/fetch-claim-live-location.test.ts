import { describe, expect, it, vi } from "vitest";

import {
  claimLiveLocationRowToPayload,
  fetchLatestClaimLiveLocation,
} from "@/lib/location/fetch-claim-live-location";

describe("claimLiveLocationRowToPayload", () => {
  it("maps a DB row to a seeker payload", () => {
    const payload = claimLiveLocationRowToPayload({
      latitude: 32.0853,
      longitude: 34.7818,
      accuracy_meters: 12,
      heading_degrees: null,
      sequence: 3,
      location_timestamp: "2026-08-17T10:00:00.000Z",
    });
    expect(payload).toMatchObject({
      latitude: 32.0853,
      longitude: 34.7818,
      accuracyMeters: 12,
      sequence: 3,
      sentAt: Date.parse("2026-08-17T10:00:00.000Z"),
    });
  });
});

describe("fetchLatestClaimLiveLocation", () => {
  it("returns null when no row exists", async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      })),
    };

    await expect(
      fetchLatestClaimLiveLocation(client as never, "claim-1"),
    ).resolves.toBeNull();
  });

  it("returns parsed payload for an existing row", async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: {
                latitude: 32.1,
                longitude: 34.8,
                accuracy_meters: 10,
                heading_degrees: null,
                sequence: 1,
                location_timestamp: "2026-08-17T10:00:00.000Z",
              },
              error: null,
            })),
          })),
        })),
      })),
    };

    const payload = await fetchLatestClaimLiveLocation(client as never, "claim-1");
    expect(payload?.latitude).toBe(32.1);
    expect(payload?.sequence).toBe(1);
  });
});
