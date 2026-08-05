import { describe, expect, it } from "vitest";

import {
  cancelClaimSchema,
  cancelSpotSchema,
  claimSpotSchema,
  completeClaimSchema,
} from "@/lib/validations/claim";

const validUuid = "550e8400-e29b-41d4-a716-446655440000";

describe("claimSpotSchema", () => {
  it("accepts a valid spot_id uuid", () => {
    const result = claimSpotSchema.safeParse({ spot_id: validUuid });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.spot_id).toBe(validUuid);
    }
  });

  it("rejects a non-uuid spot_id", () => {
    expect(claimSpotSchema.safeParse({ spot_id: "not-a-uuid" }).success).toBe(
      false,
    );
  });

  it("rejects a missing spot_id", () => {
    expect(claimSpotSchema.safeParse({}).success).toBe(false);
  });
});

describe("completeClaimSchema", () => {
  it("accepts a valid claim_id and handoff_code", () => {
    const result = completeClaimSchema.safeParse({
      claim_id: validUuid,
      handoff_code: "12345",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid claim_id", () => {
    expect(
      completeClaimSchema.safeParse({
        claim_id: "abc",
        handoff_code: "12345",
      }).success,
    ).toBe(false);
  });

  it("rejects an invalid handoff_code", () => {
    expect(
      completeClaimSchema.safeParse({
        claim_id: validUuid,
        handoff_code: "12ab",
      }).success,
    ).toBe(false);
  });
});

describe("cancelClaimSchema", () => {
  it("accepts a valid claim_id uuid", () => {
    expect(
      cancelClaimSchema.safeParse({ claim_id: validUuid }).success,
    ).toBe(true);
  });

  it("rejects a non-uuid claim_id", () => {
    expect(cancelClaimSchema.safeParse({ claim_id: "" }).success).toBe(false);
  });
});

describe("cancelSpotSchema", () => {
  it("accepts a valid spot_id uuid", () => {
    expect(cancelSpotSchema.safeParse({ spot_id: validUuid }).success).toBe(
      true,
    );
  });

  it("rejects a non-uuid spot_id", () => {
    expect(cancelSpotSchema.safeParse({ spot_id: "123" }).success).toBe(false);
  });
});
