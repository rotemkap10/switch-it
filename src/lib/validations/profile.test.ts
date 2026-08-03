import { describe, expect, it } from "vitest";

import { updateDisplayNameSchema } from "@/lib/validations/profile";

describe("updateDisplayNameSchema", () => {
  it("accepts a valid display_name", () => {
    const result = updateDisplayNameSchema.safeParse({
      display_name: "Alex",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.display_name).toBe("Alex");
    }
  });

  it("trims surrounding whitespace", () => {
    const result = updateDisplayNameSchema.safeParse({
      display_name: "  Alex  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.display_name).toBe("Alex");
    }
  });

  it("rejects empty display_name", () => {
    expect(
      updateDisplayNameSchema.safeParse({ display_name: "" }).success,
    ).toBe(false);
  });

  it("rejects whitespace-only display_name", () => {
    expect(
      updateDisplayNameSchema.safeParse({ display_name: "   " }).success,
    ).toBe(false);
  });

  it("rejects display_name shorter than 2 characters after trim", () => {
    expect(
      updateDisplayNameSchema.safeParse({ display_name: "A" }).success,
    ).toBe(false);

    expect(
      updateDisplayNameSchema.safeParse({ display_name: " A " }).success,
    ).toBe(false);
  });

  it("accepts display_name at the 2-character minimum", () => {
    expect(
      updateDisplayNameSchema.safeParse({ display_name: "Al" }).success,
    ).toBe(true);
  });

  it("accepts display_name at the 50-character maximum", () => {
    expect(
      updateDisplayNameSchema.safeParse({
        display_name: "a".repeat(50),
      }).success,
    ).toBe(true);
  });

  it("rejects display_name longer than 50 characters", () => {
    expect(
      updateDisplayNameSchema.safeParse({
        display_name: "a".repeat(51),
      }).success,
    ).toBe(false);
  });
});
