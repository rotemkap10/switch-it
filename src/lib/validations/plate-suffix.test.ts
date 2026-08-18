import { describe, expect, it } from "vitest";

import { plateSuffixSchema } from "@/lib/validations/plate-suffix";

describe("plateSuffixSchema", () => {
  it("accepts exactly two digits", () => {
    const result = plateSuffixSchema.safeParse("67");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("67");
    }
  });

  it("trims surrounding whitespace", () => {
    const result = plateSuffixSchema.safeParse("  09  ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("09");
    }
  });

  it("rejects invalid lengths", () => {
    expect(plateSuffixSchema.safeParse("6").success).toBe(false);
    expect(plateSuffixSchema.safeParse("678").success).toBe(false);
    expect(plateSuffixSchema.safeParse("").success).toBe(false);
  });

  it("rejects letters and separators", () => {
    expect(plateSuffixSchema.safeParse("6a").success).toBe(false);
    expect(plateSuffixSchema.safeParse("6-7").success).toBe(false);
    expect(plateSuffixSchema.safeParse("ab").success).toBe(false);
  });
});
