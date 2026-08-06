import { describe, expect, it } from "vitest";

import { sanitizeLocationLabel } from "@/lib/geocoding/sanitize-location-label";

describe("sanitizeLocationLabel", () => {
  it("trims and collapses whitespace", () => {
    expect(sanitizeLocationLabel("  Dizengoff   Street  ")).toBe(
      "Dizengoff Street",
    );
  });

  it("removes control characters and line breaks", () => {
    expect(sanitizeLocationLabel("Main\r\nSt\t1")).toBe("Main St 1");
    expect(sanitizeLocationLabel("A\u0000B")).toBe("A B");
  });

  it("enforces 200 characters", () => {
    expect(sanitizeLocationLabel("a".repeat(201))?.length).toBe(200);
  });

  it("returns null for empty input", () => {
    expect(sanitizeLocationLabel("")).toBeNull();
    expect(sanitizeLocationLabel("   ")).toBeNull();
    expect(sanitizeLocationLabel(null)).toBeNull();
  });

  it("rejects coordinate-like and URL labels", () => {
    expect(sanitizeLocationLabel("32.0853, 34.7818")).toBeNull();
    expect(sanitizeLocationLabel("https://example.com")).toBeNull();
  });

  it("keeps HTML as plain text for React escaping", () => {
    expect(sanitizeLocationLabel("<b>Street</b>")).toBe("<b>Street</b>");
  });
});
