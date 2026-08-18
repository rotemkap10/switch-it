import { describe, expect, it } from "vitest";

import {
  carImagesOutcomeKey,
  forgetCarImagesOutcome,
  peekCarImagesOutcome,
  rememberCarImagesOutcome,
  resetCarImagesOutcomeCacheForTests,
} from "@/lib/vehicle/carimages-outcome-cache";

describe("carimages outcome cache", () => {
  it("stores ready and fallback outcomes per make/model/year/width", () => {
    resetCarImagesOutcomeCacheForTests();
    const tucson = carImagesOutcomeKey("Hyundai", "Tucson", "2025", "handoff");
    const tucsonHero = carImagesOutcomeKey("Hyundai", "Tucson", "2025", "hero");

    rememberCarImagesOutcome(tucson, {
      status: "ready",
      src: "https://cdn.carimagesapi.com/vehicles/hyundai/tucson/nx4.webp",
    });
    rememberCarImagesOutcome(tucsonHero, { status: "fallback" });

    expect(peekCarImagesOutcome(tucson)).toEqual({
      status: "ready",
      src: "https://cdn.carimagesapi.com/vehicles/hyundai/tucson/nx4.webp",
    });
    expect(peekCarImagesOutcome(tucsonHero)).toEqual({ status: "fallback" });

    forgetCarImagesOutcome(tucson);
    expect(peekCarImagesOutcome(tucson)).toBeUndefined();
    expect(peekCarImagesOutcome(tucsonHero)?.status).toBe("fallback");

    resetCarImagesOutcomeCacheForTests();
    expect(peekCarImagesOutcome(tucsonHero)).toBeUndefined();
  });
});
