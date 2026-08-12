import { describe, expect, it } from "vitest";

import {
  CLAIM_ARRIVAL_NEAR_METERS,
  formatDistanceAway,
  formatPublisherDriverProgress,
  haversineDistanceMeters,
  isCloseToSpot,
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

  it("treats near-spot distance as informational arrival only", () => {
    expect(isCloseToSpot(CLAIM_ARRIVAL_NEAR_METERS)).toBe(true);
    expect(isCloseToSpot(40)).toBe(true);
    expect(isCloseToSpot(120)).toBe(false);
    expect(isCloseToSpot(null)).toBe(false);
  });

  it("formats publisher driver progress without ETA", () => {
    expect(formatPublisherDriverProgress(650)).toBe(
      "Driver is about 650 m away",
    );
    expect(formatPublisherDriverProgress(1400)).toBe(
      "Driver is about 1.4 km away",
    );
    expect(formatPublisherDriverProgress(40)).toBe("Driver is nearby");
    expect(formatPublisherDriverProgress(-1)).toBeNull();
  });
});
