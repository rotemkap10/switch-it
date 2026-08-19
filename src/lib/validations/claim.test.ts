import { describe, expect, it } from "vitest";

import {
  cancelClaimSchema,
  cancelSpotSchema,
  claimSpotSchema,
  completeClaimSchema,
  reconcileClaimTimingSchema,
  startHandoffNowSchema,
} from "@/lib/validations/claim";

const validUuid = "550e8400-e29b-41d4-a716-446655440000";

describe("claimSpotSchema", () => {
  it("accepts a valid spot_id and seeker coordinates", () => {
    const result = claimSpotSchema.safeParse({
      spot_id: validUuid,
      seeker_latitude: "32.0853",
      seeker_longitude: "34.7818",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.spot_id).toBe(validUuid);
      expect(result.data.seeker_latitude).toBeCloseTo(32.0853);
      expect(result.data.seeker_longitude).toBeCloseTo(34.7818);
    }
  });

  it("rejects a non-uuid spot_id", () => {
    expect(
      claimSpotSchema.safeParse({
        spot_id: "not-a-uuid",
        seeker_latitude: 32.08,
        seeker_longitude: 34.78,
      }).success,
    ).toBe(false);
  });

  it("rejects missing seeker coordinates", () => {
    expect(claimSpotSchema.safeParse({ spot_id: validUuid }).success).toBe(
      false,
    );
  });

  it("rejects invalid seeker coordinates", () => {
    expect(
      claimSpotSchema.safeParse({
        spot_id: validUuid,
        seeker_latitude: 999,
        seeker_longitude: 34.78,
      }).success,
    ).toBe(false);
  });
});

describe("completeClaimSchema", () => {
  it("accepts a valid claim_id and two plate digits", () => {
    const result = completeClaimSchema.safeParse({
      claim_id: validUuid,
      plate_suffix: "67",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid claim_id", () => {
    expect(
      completeClaimSchema.safeParse({
        claim_id: "abc",
        plate_suffix: "67",
      }).success,
    ).toBe(false);
  });

  it("rejects an invalid plate suffix", () => {
    expect(
      completeClaimSchema.safeParse({
        claim_id: validUuid,
        plate_suffix: "6a",
      }).success,
    ).toBe(false);
  });
});

describe("cancelClaimSchema", () => {
  it("accepts a valid claim_id and seeker reason", () => {
    expect(
      cancelClaimSchema.safeParse({
        claim_id: validUuid,
        reason: "found_another_spot",
      }).success,
    ).toBe(true);
  });

  it("rejects a non-uuid claim_id", () => {
    expect(
      cancelClaimSchema.safeParse({
        claim_id: "",
        reason: "other",
      }).success,
    ).toBe(false);
  });

  it("rejects a publisher-only reason", () => {
    expect(
      cancelClaimSchema.safeParse({
        claim_id: validUuid,
        reason: "had_to_leave",
      }).success,
    ).toBe(false);
  });

  it("rejects a missing reason", () => {
    expect(
      cancelClaimSchema.safeParse({ claim_id: validUuid }).success,
    ).toBe(false);
  });
});

describe("startHandoffNowSchema", () => {
  it("accepts a valid spot_id uuid", () => {
    expect(
      startHandoffNowSchema.safeParse({ spot_id: validUuid }).success,
    ).toBe(true);
  });

  it("rejects a non-uuid spot_id", () => {
    expect(
      startHandoffNowSchema.safeParse({ spot_id: "not-a-spot" }).success,
    ).toBe(false);
  });
});

describe("reconcileClaimTimingSchema", () => {
  it("accepts a valid claim_id uuid", () => {
    expect(
      reconcileClaimTimingSchema.safeParse({ claim_id: validUuid }).success,
    ).toBe(true);
  });

  it("rejects a non-uuid claim_id", () => {
    expect(
      reconcileClaimTimingSchema.safeParse({ claim_id: "not-a-claim" }).success,
    ).toBe(false);
  });
});

describe("cancelSpotSchema", () => {
  it("accepts a valid spot_id and publisher reason", () => {
    expect(
      cancelSpotSchema.safeParse({
        spot_id: validUuid,
        reason: "had_to_leave",
      }).success,
    ).toBe(true);
  });

  it("rejects a non-uuid spot_id", () => {
    expect(
      cancelSpotSchema.safeParse({
        spot_id: "123",
        reason: "other",
      }).success,
    ).toBe(false);
  });

  it("rejects a seeker-only reason", () => {
    expect(
      cancelSpotSchema.safeParse({
        spot_id: validUuid,
        reason: "too_far",
      }).success,
    ).toBe(false);
  });
});
