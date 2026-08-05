import { describe, expect, it } from "vitest";

import {
  formatDistanceAway,
  haversineDistanceMeters,
  isValidLatLng,
} from "@/lib/map/distance";

describe("distance helpers", () => {
  it("validates lat/lng pairs", () => {
    expect(
      isValidLatLng({ latitude: 32.08, longitude: 34.78 }),
    ).toBe(true);
    expect(isValidLatLng({ latitude: 999, longitude: 34.78 })).toBe(false);
    expect(isValidLatLng(null)).toBe(false);
  });

  it("computes a short Tel Aviv distance in meters", () => {
    const meters = haversineDistanceMeters(
      { latitude: 32.0853, longitude: 34.7818 },
      { latitude: 32.0863, longitude: 34.7818 },
    );
    expect(meters).toBeGreaterThan(100);
    expect(meters).toBeLessThan(130);
  });

  it("formats meters and kilometers", () => {
    expect(formatDistanceAway(350)).toBe("350 m away");
    expect(formatDistanceAway(1400)).toBe("1.4 km away");
    expect(formatDistanceAway(-1)).toBe("");
  });
});
