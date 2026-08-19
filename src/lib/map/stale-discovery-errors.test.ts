import { describe, expect, it } from "vitest";

import { shouldRevalidateMapAfterClaimFailure } from "@/lib/map/stale-discovery-errors";

describe("shouldRevalidateMapAfterClaimFailure", () => {
  it("revalidates when the spot is no longer claimable", () => {
    expect(shouldRevalidateMapAfterClaimFailure("SPOT_UNAVAILABLE")).toBe(true);
    expect(shouldRevalidateMapAfterClaimFailure("SPOT_NOT_FOUND")).toBe(true);
    expect(shouldRevalidateMapAfterClaimFailure("SPOT_EXPIRED")).toBe(true);
    expect(
      shouldRevalidateMapAfterClaimFailure("ALREADY_RELEASED_THIS_SPOT"),
    ).toBe(true);
  });

  it("does not revalidate for unrelated claim errors", () => {
    expect(shouldRevalidateMapAfterClaimFailure("SELF_CLAIM")).toBe(false);
    expect(shouldRevalidateMapAfterClaimFailure("VEHICLE_PROFILE_REQUIRED")).toBe(
      false,
    );
    expect(shouldRevalidateMapAfterClaimFailure(undefined)).toBe(false);
  });
});
