import { describe, expect, it } from "vitest";

import {
  formatLicensePlateForDisplay,
  isMaskedLicensePlateDisplay,
  licensePlateSuffix,
  maskLicensePlateForHandoff,
  normalizeLicensePlate,
  PLATE_MAX_DIGITS,
  PLATE_MIN_DIGITS,
} from "@/lib/vehicle/normalize-plate";

describe("normalizeLicensePlate", () => {
  it("removes spaces, hyphens, and common separators", () => {
    expect(normalizeLicensePlate("12-345-67")).toEqual({
      ok: true,
      normalized: "1234567",
    });
    expect(normalizeLicensePlate("12 345 67")).toEqual({
      ok: true,
      normalized: "1234567",
    });
    expect(normalizeLicensePlate("123–45–678")).toEqual({
      ok: true,
      normalized: "12345678",
    });
    expect(normalizeLicensePlate("12.345.67")).toEqual({
      ok: true,
      normalized: "1234567",
    });
    expect(normalizeLicensePlate("12/345/67")).toEqual({
      ok: true,
      normalized: "1234567",
    });
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeLicensePlate("  1234567  ")).toEqual({
      ok: true,
      normalized: "1234567",
    });
  });

  it("rejects letters and other invalid characters", () => {
    const result = normalizeLicensePlate("12-AB-345");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/digits/i);
    }
  });

  it("rejects empty and whitespace-only input", () => {
    expect(normalizeLicensePlate("").ok).toBe(false);
    expect(normalizeLicensePlate("   ").ok).toBe(false);
  });

  it("accepts supported Israeli-style lengths", () => {
    for (let len = PLATE_MIN_DIGITS; len <= PLATE_MAX_DIGITS; len += 1) {
      const digits = "1".repeat(len);
      expect(normalizeLicensePlate(digits)).toEqual({
        ok: true,
        normalized: digits,
      });
    }
  });

  it("rejects plates outside the supported length range", () => {
    expect(normalizeLicensePlate("1234").ok).toBe(false);
    expect(normalizeLicensePlate("123456789").ok).toBe(false);
  });
});

describe("formatLicensePlateForDisplay", () => {
  it("formats common lengths readably without forcing one pattern", () => {
    expect(formatLicensePlateForDisplay("12345")).toBe("12-345");
    expect(formatLicensePlateForDisplay("123456")).toBe("123-456");
    expect(formatLicensePlateForDisplay("1234567")).toBe("12-345-67");
    expect(formatLicensePlateForDisplay("12345678")).toBe("123-45-678");
  });

  it("strips non-digits before formatting", () => {
    expect(formatLicensePlateForDisplay("12-345-67")).toBe("12-345-67");
  });
});

describe("maskLicensePlateForHandoff", () => {
  it("masks the last two digits while keeping Israeli grouping", () => {
    expect(maskLicensePlateForHandoff("1234567")).toBe("12-345-**");
    expect(maskLicensePlateForHandoff("12-345-67")).toBe("12-345-**");
    expect(maskLicensePlateForHandoff("12345678")).toBe("123-45-6**");
    expect(maskLicensePlateForHandoff("12345")).toBe("12-3**");
    expect(maskLicensePlateForHandoff("123456")).toBe("123-4**");
  });

  it("does not include the hidden digits in the masked value", () => {
    expect(maskLicensePlateForHandoff("1234567")).not.toContain("67");
    expect(isMaskedLicensePlateDisplay("12-345-**")).toBe(true);
    expect(isMaskedLicensePlateDisplay("12-345-67")).toBe(false);
    expect(isMaskedLicensePlateDisplay("1234567")).toBe(false);
  });

  it("extracts the last two digits only from normalized plates", () => {
    expect(licensePlateSuffix("1234567")).toBe("67");
    expect(licensePlateSuffix("12-345-67")).toBe("67");
  });
});
