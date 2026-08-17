import { afterEach, describe, expect, it, vi } from "vitest";

import {
  carImagesWidthForSize,
  getCarImagesPublicApiKey,
  isCarImagesLoaderEnabled,
  isUsableCarImagesUrl,
  normalizeCarImagesYear,
} from "@/lib/vehicle/carimages";
import { CARIMAGES_DEV_TEST_VEHICLES } from "@/lib/vehicle/carimages-test-vehicles";

describe("carimages helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads the public loader key and never treats an empty value as configured", () => {
    vi.stubEnv("NEXT_PUBLIC_CARIMAGES_API_KEY", "");
    expect(getCarImagesPublicApiKey()).toBeNull();

    vi.stubEnv("NEXT_PUBLIC_CARIMAGES_API_KEY", " ci_public_test ");
    expect(getCarImagesPublicApiKey()).toBe("ci_public_test");
  });

  it("does not inject the official loader during unit tests", () => {
    vi.stubEnv("NEXT_PUBLIC_CARIMAGES_API_KEY", "ci_public_test");
    expect(isCarImagesLoaderEnabled()).toBe(false);
  });

  it("maps compact frames to the free-tier 400px WebP size", () => {
    expect(carImagesWidthForSize("compact")).toBe("400");
    expect(carImagesWidthForSize("default")).toBe("800");
    expect(carImagesWidthForSize("hero")).toBe("800");
  });

  it("omits blank years so the loader can fuzzy-match without a year", () => {
    expect(normalizeCarImagesYear("2024")).toBe("2024");
    expect(normalizeCarImagesYear(2025)).toBe("2025");
    expect(normalizeCarImagesYear("  ")).toBeUndefined();
    expect(normalizeCarImagesYear(null)).toBeUndefined();
  });

  it("accepts only CDN catalog URLs as a usable match", () => {
    expect(
      isUsableCarImagesUrl(
        "https://cdn.carimagesapi.com/vehicles/hyundai/tucson/nx4-2024-now-800-wm.webp",
      ),
    ).toBe(true);
    expect(
      isUsableCarImagesUrl(
        "https://carimagesapi.com/image?make=NotARealMakeXYZ&model=NoSuchModel123",
      ),
    ).toBe(false);
    expect(isUsableCarImagesUrl("")).toBe(false);
  });

  it("lists the PoC test vehicles", () => {
    expect(CARIMAGES_DEV_TEST_VEHICLES).toEqual([
      { make: "Hyundai", model: "Tucson", year: 2025 },
      { make: "Toyota", model: "Corolla", year: 2024 },
      { make: "Kia", model: "Picanto", year: 2024 },
      { make: "Skoda", model: "Octavia", year: 2024 },
      { make: "Toyota", model: "Yaris", year: 2024 },
      { make: "Kia", model: "Niro", year: 2024 },
    ]);
  });
});
