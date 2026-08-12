/** Earth mean radius in meters (WGS84 spherical approximation). */
export const EARTH_RADIUS_M = 6_371_000;

/**
 * Max straight-line (aerial) distance for starting a claim.
 * Enforced in the claim_spot RPC; mirrored for client UX.
 * Tunable after real-world testing — keep in sync with the SQL migration.
 */
export const MAX_CLAIM_DISTANCE_METERS = 1500;

export type LatLng = {
  latitude: number;
  longitude: number;
};

export function isValidLatLng(value: LatLng | null | undefined): value is LatLng {
  return (
    !!value &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude) &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    value.longitude >= -180 &&
    value.longitude <= 180
  );
}

/** Straight-line distance in meters (Haversine). Not travel time. */
export function haversineDistanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** True when seeker is within the claim radius (inclusive of the boundary). */
export function isWithinClaimDistance(
  seeker: LatLng | null | undefined,
  spot: LatLng | null | undefined,
  maxMeters: number = MAX_CLAIM_DISTANCE_METERS,
): boolean {
  if (!isValidLatLng(seeker) || !isValidLatLng(spot)) {
    return false;
  }
  if (!Number.isFinite(maxMeters) || maxMeters < 0) {
    return false;
  }
  return haversineDistanceMeters(seeker, spot) <= maxMeters;
}

/** Human-readable approximate distance for discovery UI. */
export function formatDistanceAway(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) {
    return "";
  }

  if (meters < 1000) {
    return `${Math.round(meters)} m away`;
  }

  return `${(meters / 1000).toFixed(1)} km away`;
}

/**
 * Selected-spot distance line. When outside the claim radius, append a short
 * eligibility hint (server still enforces the limit).
 */
export function formatClaimDistanceLabel(meters: number): string {
  const base = formatDistanceAway(meters);
  if (!base) {
    return "";
  }
  if (meters > MAX_CLAIM_DISTANCE_METERS) {
    return `${base} — Too far to claim`;
  }
  return base;
}

/**
 * Informational arrival hint only — not a geofence and never auto-completes.
 * GPS can be inaccurate; the seeker stays in control.
 */
export const CLAIM_ARRIVAL_NEAR_METERS = 80;

export function isCloseToSpot(meters: number | null | undefined): boolean {
  return (
    typeof meters === "number" &&
    Number.isFinite(meters) &&
    meters >= 0 &&
    meters <= CLAIM_ARRIVAL_NEAR_METERS
  );
}

/**
 * Informational publisher progress from an already-received seeker Broadcast
 * sample. Not ETA and not a geofence.
 */
export function formatPublisherDriverProgress(
  meters: number,
): string | null {
  if (!Number.isFinite(meters) || meters < 0) {
    return null;
  }
  if (isCloseToSpot(meters)) {
    return "Driver is nearby";
  }
  if (meters < 1000) {
    return `Driver is about ${Math.round(meters)} m away`;
  }
  return `Driver is about ${(meters / 1000).toFixed(1)} km away`;
}
