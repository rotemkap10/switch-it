import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { publishSeekerLiveLocationViaEdge } from "@/lib/location/publish-seeker-live-location";

describe("publishSeekerLiveLocationViaEdge", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "publishable-key",
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("posts seeker-location to the handoff edge function", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await publishSeekerLiveLocationViaEdge({
      claimId: "11111111-1111-4111-8111-111111111111",
      event: "seeker-location",
      accessToken: "jwt",
      payload: {
        latitude: 32.08,
        longitude: 34.78,
        accuracyMeters: 12,
        headingDegrees: null,
        sequence: 1,
        sentAt: Date.now(),
      },
    });

    expect(result).toEqual({ ok: true, accepted: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/handoff-seeker-location",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer jwt",
          apikey: "publishable-key",
        }),
      }),
    );
  });

  it("treats stale_sequence as a soft success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, accepted: false, reason: "stale_sequence" }),
      })),
    );

    const result = await publishSeekerLiveLocationViaEdge({
      claimId: "11111111-1111-4111-8111-111111111111",
      event: "seeker-location",
      accessToken: "jwt",
      payload: {
        latitude: 32.08,
        longitude: 34.78,
        accuracyMeters: 12,
        headingDegrees: null,
        sequence: 1,
        sentAt: Date.now(),
      },
    });

    expect(result).toEqual({
      ok: true,
      accepted: false,
      reason: "stale_sequence",
    });
  });

  it("returns missing_config when env is absent", async () => {
    vi.unstubAllEnvs();
    const result = await publishSeekerLiveLocationViaEdge({
      claimId: "11111111-1111-4111-8111-111111111111",
      event: "seeker-location-status",
      accessToken: "jwt",
      payload: {
        status: "paused",
        sequence: 1,
        sentAt: Date.now(),
      },
    });
    expect(result).toEqual({ ok: false, reason: "missing_config" });
  });
});
