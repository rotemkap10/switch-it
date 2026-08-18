import { describe, expect, it } from "vitest";

import {
  invalidPlateDigitsMessage,
  parseAttemptsRemaining,
  PLATE_VERIFICATION_LOCKED_MESSAGE,
} from "@/lib/handoff/plate-verification";

describe("plate verification copy", () => {
  it("reads remaining attempts from RPC detail without exposing digits", () => {
    expect(
      parseAttemptsRemaining({ details: "attempts_remaining=2" }),
    ).toBe(2);
    expect(invalidPlateDigitsMessage(2)).toBe(
      "Those digits don't match. 2 attempts remaining.",
    );
    expect(invalidPlateDigitsMessage(1)).toBe(
      "Those digits don't match. 1 attempt remaining.",
    );
    expect(invalidPlateDigitsMessage(null)).toBe("Those digits don't match.");
    expect(invalidPlateDigitsMessage(2)).not.toMatch(/\d{2}$/);
    expect(PLATE_VERIFICATION_LOCKED_MESSAGE).toBe(
      "Too many incorrect attempts. Try again in a moment.",
    );
    expect(PLATE_VERIFICATION_LOCKED_MESSAGE).not.toMatch(/\d{2}/);
  });
});
