import { describe, expect, it } from "vitest";

import { formatLocationLabel } from "@/lib/geocoding/format-location-label";

describe("formatLocationLabel", () => {
  it("prefers street, house number, and city", () => {
    expect(
      formatLocationLabel({
        street: "Dizengoff Street",
        houseNumber: "120",
        city: "Tel Aviv",
      }),
    ).toBe("Dizengoff Street 120, Tel Aviv");
  });

  it("falls back to street and city without a house number", () => {
    expect(
      formatLocationLabel({
        street: "Rothschild Boulevard",
        city: "Tel Aviv",
      }),
    ).toBe("Rothschild Boulevard, Tel Aviv");
  });

  it("uses named place and city", () => {
    expect(
      formatLocationLabel({
        namedPlace: "Azrieli Center",
        city: "Tel Aviv",
      }),
    ).toBe("Azrieli Center, Tel Aviv");
  });

  it("uses neighborhood and city", () => {
    expect(
      formatLocationLabel({
        neighborhood: "Florentin",
        city: "Tel Aviv",
      }),
    ).toBe("Florentin, Tel Aviv");
  });

  it("removes duplicate place names", () => {
    expect(
      formatLocationLabel({
        street: "Tel Aviv",
        city: "Tel Aviv",
      }),
    ).toBe("Tel Aviv");
  });

  it("returns null for country-only results", () => {
    expect(formatLocationLabel({ city: "Israel" })).toBeNull();
  });

  it("returns null when no useful parts exist", () => {
    expect(formatLocationLabel({})).toBeNull();
  });
});
