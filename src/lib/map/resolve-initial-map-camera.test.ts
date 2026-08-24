import { describe, expect, it } from "vitest";

import {
  INITIAL_MAP_LOCATION_WAIT_MS,
  MAP_FALLBACK_CENTER,
  isFallbackMapCenter,
  resolveInitialMapCenterLngLat,
} from "@/lib/map/resolve-initial-map-camera";

describe("resolveInitialMapCenterLngLat", () => {
  it("returns MapLibre [lng, lat] order for the Tel Aviv fallback", () => {
    const center = resolveInitialMapCenterLngLat({});
    expect(center).toEqual([MAP_FALLBACK_CENTER.lng, MAP_FALLBACK_CENTER.lat]);
    expect(center[0]).toBeCloseTo(34.7818, 3);
    expect(center[1]).toBeCloseTo(32.0853, 3);
    expect(isFallbackMapCenter(center[0], center[1])).toBe(true);
  });

  it("does not use the old Sokolov/Herzliya development coordinates", () => {
    const center = resolveInitialMapCenterLngLat({});
    expect(center).not.toEqual([34.843, 32.167]);
    expect(Math.abs(center[0] - 34.843)).toBeGreaterThan(0.01);
    expect(Math.abs(center[1] - 32.167)).toBeGreaterThan(0.01);
  });

  it("prefers a trusted current GPS fix over the fallback", () => {
    const center = resolveInitialMapCenterLngLat({
      trustedFix: {
        latitude: 32.26,
        longitude: 34.89,
        accuracy: 12,
        timestamp: Date.now(),
      },
    });
    expect(center).toEqual([34.89, 32.26]);
    expect(isFallbackMapCenter(center[0], center[1])).toBe(false);
  });

  it("prefers an in-bounds destination over GPS and fallback", () => {
    const center = resolveInitialMapCenterLngLat({
      destination: { latitude: 32.11, longitude: 34.82 },
      trustedFix: {
        latitude: 32.26,
        longitude: 34.89,
        accuracy: 12,
        timestamp: Date.now(),
      },
    });
    expect(center).toEqual([34.82, 32.11]);
  });

  it("ignores out-of-bounds GPS and falls back safely", () => {
    const center = resolveInitialMapCenterLngLat({
      trustedFix: {
        latitude: 0,
        longitude: 0,
        accuracy: 5,
        timestamp: Date.now(),
      },
    });
    expect(center).toEqual([MAP_FALLBACK_CENTER.lng, MAP_FALLBACK_CENTER.lat]);
  });

  it("prefers trusted GPS over a seed center (e.g. choose-on-map fallback)", () => {
    const center = resolveInitialMapCenterLngLat({
      seedCenter: {
        latitude: MAP_FALLBACK_CENTER.lat,
        longitude: MAP_FALLBACK_CENTER.lng,
      },
      trustedFix: {
        latitude: 32.26,
        longitude: 34.89,
        accuracy: 12,
        timestamp: Date.now(),
      },
    });
    expect(center).toEqual([34.89, 32.26]);
  });

  it("uses seed center when GPS is unavailable", () => {
    const center = resolveInitialMapCenterLngLat({
      seedCenter: { latitude: 32.11, longitude: 34.82 },
    });
    expect(center).toEqual([34.82, 32.11]);
  });

  it("keeps MapLibre [lng, lat] order and rejects swapped coordinates as out of bounds", () => {
    const center = resolveInitialMapCenterLngLat({
      trustedFix: {
        latitude: 32.26,
        longitude: 34.89,
        accuracy: 12,
        timestamp: Date.now(),
      },
    });
    expect(center[0]).toBe(34.89);
    expect(center[1]).toBe(32.26);

    const swapped = resolveInitialMapCenterLngLat({
      trustedFix: {
        latitude: 34.89,
        longitude: 32.26,
        accuracy: 12,
        timestamp: Date.now(),
      },
    });
    expect(swapped).toEqual([MAP_FALLBACK_CENTER.lng, MAP_FALLBACK_CENTER.lat]);
  });

  it("keeps a short wait budget before falling back", () => {
    expect(INITIAL_MAP_LOCATION_WAIT_MS).toBeGreaterThanOrEqual(2_000);
    expect(INITIAL_MAP_LOCATION_WAIT_MS).toBeLessThanOrEqual(4_000);
  });
});
