import { describe, expect, it } from "vitest";

import { handoffCodeSchema } from "@/lib/validations/handoff-code";

describe("handoffCodeSchema", () => {
  it("accepts a valid 5-digit code", () => {
    const result = handoffCodeSchema.safeParse("12345");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("12345");
    }
  });

  it("trims surrounding whitespace", () => {
    const result = handoffCodeSchema.safeParse("  54321  ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("54321");
    }
  });

  it("rejects invalid lengths", () => {
    expect(handoffCodeSchema.safeParse("1234").success).toBe(false);
    expect(handoffCodeSchema.safeParse("123456").success).toBe(false);
    expect(handoffCodeSchema.safeParse("").success).toBe(false);
  });

  it("rejects letters and separators", () => {
    expect(handoffCodeSchema.safeParse("12a45").success).toBe(false);
    expect(handoffCodeSchema.safeParse("12-345").success).toBe(false);
    expect(handoffCodeSchema.safeParse("abcde").success).toBe(false);
  });

  it("does not coerce non-strings silently", () => {
    expect(handoffCodeSchema.safeParse(12345).success).toBe(false);
    expect(handoffCodeSchema.safeParse(null).success).toBe(false);
  });
});
