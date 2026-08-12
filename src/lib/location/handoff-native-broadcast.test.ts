import { describe, expect, it } from "vitest";

import {
  decideHandoffNativeBroadcast,
  handoffSeekerLocationEdgeFunctionUrl,
  parseHandoffNativeBroadcastBody,
} from "@/lib/location/handoff-native-broadcast";

const claimId = "11111111-1111-4111-8111-111111111111";

function locationBody(overrides: Record<string, unknown> = {}) {
  return {
    claimId,
    event: "seeker-location",
    payload: {
      latitude: 32.08,
      longitude: 34.78,
      accuracyMeters: 12,
      headingDegrees: 90,
      sequence: 1,
      sentAt: Date.now(),
      ...overrides,
    },
  };
}

describe("native handoff broadcast payload", () => {
  it("accepts Phase 9B seeker-location shape", () => {
    const body = locationBody();
    expect(parseHandoffNativeBroadcastBody(body)).toEqual(body);
    const decision = decideHandoffNativeBroadcast(body, { allowed: true });
    expect(decision.ok).toBe(true);
    if (decision.ok) {
      expect(decision.topic).toBe(`claim-location:${claimId}`);
      expect(decision.event).toBe("seeker-location");
      expect(decision.payload).toMatchObject({
        latitude: 32.08,
        longitude: 34.78,
        accuracyMeters: 12,
        headingDegrees: 90,
        sequence: 1,
      });
    }
  });

  it("rejects unauthorized claims without broadcasting", () => {
    const decision = decideHandoffNativeBroadcast(locationBody(), {
      allowed: false,
    });
    expect(decision).toEqual({
      ok: false,
      status: 403,
      error: "unauthorized",
    });
  });

  it("rejects unusably inaccurate GPS", () => {
    const decision = decideHandoffNativeBroadcast(
      locationBody({ accuracyMeters: 180 }),
      { allowed: true },
    );
    expect(decision).toEqual({
      ok: false,
      status: 400,
      error: "invalid_body",
    });
  });

  it("rejects malformed claim ids", () => {
    const decision = decideHandoffNativeBroadcast(
      { ...locationBody(), claimId: "not-a-uuid" },
      { allowed: true },
    );
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.error).toBe("invalid_claim");
    }
  });

  it("builds the Edge Function URL from the public Supabase origin", () => {
    expect(
      handoffSeekerLocationEdgeFunctionUrl("https://example.supabase.co/"),
    ).toBe("https://example.supabase.co/functions/v1/handoff-seeker-location");
  });
});
