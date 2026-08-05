/** Earth mean radius in meters (WGS84 spherical approximation). */
const EARTH_RADIUS_M = 6_371_000;

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
