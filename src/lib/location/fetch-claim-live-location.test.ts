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
  const claimId = "11111111-1111-4111-8111-111111111111";

  it("returns null for malformed claim ids without querying", async () => {
    const client = { from: vi.fn() };
    await expect(
      fetchLatestClaimLiveLocation(client as never, "claim-1"),
    ).resolves.toBeNull();
    expect(client.from).not.toHaveBeenCalled();
  });

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
      fetchLatestClaimLiveLocation(client as never, claimId),
    ).resolves.toBeNull();
  });

  it("normalizes claim id before querying", async () => {
    const eq = vi.fn(() => ({
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    }));
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq })),
      })),
    };

    await fetchLatestClaimLiveLocation(
      client as never,
      claimId.toUpperCase(),
    );
    expect(eq).toHaveBeenCalledWith("claim_id", claimId);
  });

  it("returns null when PostgREST returns permission denied", async () => {
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: null,
              error: {
                code: "42501",
                message: "permission denied for table claim_live_locations",
              },
            })),
          })),
        })),
      })),
    };

    await expect(
      fetchLatestClaimLiveLocation(client as never, claimId),
    ).resolves.toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      "[switch-it:handoff-live-receiver] snapshot fetch failed",
      expect.objectContaining({
        claimId,
        code: "42501",
      }),
    );
    consoleSpy.mockRestore();
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

    const payload = await fetchLatestClaimLiveLocation(client as never, claimId);
    expect(payload?.latitude).toBe(32.1);
    expect(payload?.sequence).toBe(1);
  });
});
