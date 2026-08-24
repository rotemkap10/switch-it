import { isWithinSupportedMapBounds } from "@/lib/map/seekerMapConfig";
import type { DeviceLocationFix } from "@/lib/map/request-current-device-location";

/**
 * Fallback map center when GPS is denied / timed out / unavailable.
 * Tel Aviv city center (not a specific development neighborhood).
 * MapLibre uses [lng, lat].
 */
export const MAP_FALLBACK_CENTER = {
  lat: 32.0853,
  lng: 34.7818,
} as const;

/** @deprecated Prefer MAP_FALLBACK_CENTER — name kept for older imports. */
export const MAP_DEFAULT_CENTER = MAP_FALLBACK_CENTER;

/**
 * How long Find Parking / Share a Spot wait for a trusted current fix
 * before mounting the map on the fallback center.
 */
export const INITIAL_MAP_LOCATION_WAIT_MS = 2_500;

export type DestinationCoords = {
  latitude: number;
  longitude: number;
};

function asInBoundsLngLat(
  latitude: number,
  longitude: number,
): [number, number] | null {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !isWithinSupportedMapBounds(longitude, latitude)
  ) {
    return null;
  }
  return [longitude, latitude];
}

/**
 * Resolve the first meaningful MapLibre center [lng, lat].
 * Priority: in-bounds destination → trusted current GPS → seed → fallback.
 *
 * `seedCenter` is for Share a Spot form coords (GPS or explicit choose-on-map)
 * and must never win over a trusted current fix.
 */
export function resolveInitialMapCenterLngLat(options: {
  destination?: DestinationCoords | null;
  trustedFix?: DeviceLocationFix | null;
  seedCenter?: DestinationCoords | null;
}): [number, number] {
  const destination = options.destination;
  if (destination) {
    const center = asInBoundsLngLat(
      destination.latitude,
      destination.longitude,
    );
    if (center) {
      return center;
    }
  }

  const fix = options.trustedFix;
  if (fix) {
    const center = asInBoundsLngLat(fix.latitude, fix.longitude);
    if (center) {
      return center;
    }
  }

  const seed = options.seedCenter;
  if (seed) {
    const center = asInBoundsLngLat(seed.latitude, seed.longitude);
    if (center) {
      return center;
    }
  }

  return [MAP_FALLBACK_CENTER.lng, MAP_FALLBACK_CENTER.lat];
}

export function isFallbackMapCenter(lng: number, lat: number): boolean {
  return (
    Math.abs(lng - MAP_FALLBACK_CENTER.lng) < 1e-6 &&
    Math.abs(lat - MAP_FALLBACK_CENTER.lat) < 1e-6
  );
}
