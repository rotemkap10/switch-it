/**
 * Pure helpers for external navigation deep links (Waze / Google / Apple Maps).
 * Destination coordinates only — no user identity or tracking params.
 */

export type NavigationCoords = {
  latitude: number;
  longitude: number;
};

export function isValidNavigationCoords(
  latitude: unknown,
  longitude: unknown,
): boolean {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/** Stable decimal formatting for deep-link coordinates. */
export function formatNavigationCoordinate(value: number): string {
  return value.toFixed(6);
}

function destinationPair(latitude: number, longitude: number): string {
  return `${formatNavigationCoordinate(latitude)},${formatNavigationCoordinate(longitude)}`;
}

export function buildWazeNavigateUrl(
  latitude: number,
  longitude: number,
): string | null {
  if (!isValidNavigationCoords(latitude, longitude)) {
    return null;
  }
  const ll = destinationPair(latitude, longitude);
  return `https://waze.com/ul?ll=${encodeURIComponent(ll)}&navigate=yes`;
}

export function buildGoogleMapsDirectionsUrl(
  latitude: number,
  longitude: number,
): string | null {
  if (!isValidNavigationCoords(latitude, longitude)) {
    return null;
  }
  const destination = destinationPair(latitude, longitude);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export function buildAppleMapsDirectionsUrl(
  latitude: number,
  longitude: number,
): string | null {
  if (!isValidNavigationCoords(latitude, longitude)) {
    return null;
  }
  const daddr = destinationPair(latitude, longitude);
  return `https://maps.apple.com/?daddr=${encodeURIComponent(daddr)}`;
}

/**
 * Offer Apple Maps only on clearly identifiable Apple phones/tablets.
 * Ambiguous desktop/Mac UAs are omitted rather than guessed.
 */
export function shouldOfferAppleMaps(
  userAgent: string = typeof navigator !== "undefined" ? navigator.userAgent : "",
): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent);
}

export type ExternalNavigationLinks = {
  waze: string;
  googleMaps: string;
  appleMaps: string | null;
};

export function buildExternalNavigationLinks(
  latitude: number,
  longitude: number,
  options?: { includeAppleMaps?: boolean },
): ExternalNavigationLinks | null {
  const waze = buildWazeNavigateUrl(latitude, longitude);
  const googleMaps = buildGoogleMapsDirectionsUrl(latitude, longitude);
  if (!waze || !googleMaps) {
    return null;
  }

  const includeApple =
    options?.includeAppleMaps ?? shouldOfferAppleMaps();
  const appleMaps = includeApple
    ? buildAppleMapsDirectionsUrl(latitude, longitude)
    : null;

  return { waze, googleMaps, appleMaps };
}
