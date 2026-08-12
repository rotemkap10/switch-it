import { describe, expect, it } from "vitest";

import {
  CLAIM_ARRIVAL_NEAR_METERS,
  EARTH_RADIUS_M,
  formatClaimDistanceLabel,
  formatDistanceAway,
  formatPublisherDriverProgress,
  haversineDistanceMeters,
  isCloseToSpot,
  isValidLatLng,
  isWithinClaimDistance,
  MAX_CLAIM_DISTANCE_METERS,
} from "@/lib/map/distance";

/** Offset latitude by approximately `meters` north of a base point. */
function offsetNorth(baseLat: number, baseLng: number, meters: number) {
  const dLat = (meters / EARTH_RADIUS_M) * (180 / Math.PI);
  return { latitude: baseLat + dLat, longitude: baseLng };
}

const TEL_AVIV = { latitude: 32.0853, longitude: 34.7818 };

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

describe("claim distance eligibility", () => {
  it("exposes a tunable 1500 m claim radius", () => {
    expect(MAX_CLAIM_DISTANCE_METERS).toBe(1500);
  });

  it("allows claims at 500 m, 1499 m, and exactly 1500 m", () => {
    expect(
      isWithinClaimDistance(TEL_AVIV, offsetNorth(TEL_AVIV.latitude, TEL_AVIV.longitude, 500)),
    ).toBe(true);
    expect(
      isWithinClaimDistance(
        TEL_AVIV,
        offsetNorth(TEL_AVIV.latitude, TEL_AVIV.longitude, 1499),
      ),
    ).toBe(true);

    const atBoundary = offsetNorth(
      TEL_AVIV.latitude,
      TEL_AVIV.longitude,
      MAX_CLAIM_DISTANCE_METERS,
    );
    const boundaryMeters = haversineDistanceMeters(TEL_AVIV, atBoundary);
    expect(boundaryMeters).toBeGreaterThan(1499);
    expect(boundaryMeters).toBeLessThan(1501);
    expect(isWithinClaimDistance(TEL_AVIV, atBoundary)).toBe(true);
  });

  it("rejects claims beyond 1500 m and several kilometers away", () => {
    expect(
      isWithinClaimDistance(
        TEL_AVIV,
        offsetNorth(TEL_AVIV.latitude, TEL_AVIV.longitude, 1501),
      ),
    ).toBe(false);
    expect(
      isWithinClaimDistance(
        TEL_AVIV,
        offsetNorth(TEL_AVIV.latitude, TEL_AVIV.longitude, 2400),
      ),
    ).toBe(false);
    expect(
      isWithinClaimDistance(
        TEL_AVIV,
        offsetNorth(TEL_AVIV.latitude, TEL_AVIV.longitude, 5000),
      ),
    ).toBe(false);
  });

  it("rejects missing or invalid seeker coordinates", () => {
    expect(isWithinClaimDistance(null, TEL_AVIV)).toBe(false);
    expect(
      isWithinClaimDistance({ latitude: 999, longitude: 34.78 }, TEL_AVIV),
    ).toBe(false);
    expect(isWithinClaimDistance(TEL_AVIV, null)).toBe(false);
  });

  it("formats claim distance labels with a too-far hint", () => {
    expect(formatClaimDistanceLabel(650)).toBe("650 m away");
    expect(formatClaimDistanceLabel(1200)).toBe("1.2 km away");
    expect(formatClaimDistanceLabel(2400)).toBe(
      "2.4 km away — Too far to claim",
    );
  });
});
