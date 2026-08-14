import { describe, expect, it } from "vitest";

import {
  buildNativeSeekerLocationPostBody,
  serializeNativeSeekerLocationPostBody,
} from "@/lib/location/native-post-body";

describe("native location JSON body", () => {
  it("omits heading so missing course cannot break JSON", () => {
    const body = buildNativeSeekerLocationPostBody({
      claimId: "11111111-1111-4111-8111-111111111111",
      latitude: 32.08,
      longitude: 34.78,
      accuracyMeters: 12,
      headingDegrees: null,
      sequence: 1,
      sentAt: 1_700_000_000_000,
    });
    expect(JSON.stringify(body)).not.toContain("headingDegrees");
    expect(JSON.parse(JSON.stringify(body)).payload.latitude).toBe(32.08);
    expect(serializeNativeSeekerLocationPostBody({
      claimId: "11111111-1111-4111-8111-111111111111",
      latitude: 32.08,
      longitude: 34.78,
      accuracyMeters: 12,
      headingDegrees: null,
      sequence: 1,
      sentAt: 1_700_000_000_000,
    })).not.toContain("null");
  });

  it("includes heading when present", () => {
    const json = serializeNativeSeekerLocationPostBody({
      claimId: "11111111-1111-4111-8111-111111111111",
      latitude: 32.08,
      longitude: 34.78,
      accuracyMeters: 12,
      headingDegrees: 90,
      sequence: 1,
      sentAt: 1_700_000_000_000,
    });
    expect(JSON.parse(json).payload.headingDegrees).toBe(90);
  });
});
